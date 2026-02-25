#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${BACKUP_ROOT:-./ops/backup-dr/.runtime}"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
MANIFEST_FILE="${BACKUP_DIR}/manifest.json"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

DB_TYPE="${DB_TYPE:-sqlite}" # sqlite|postgres
DATABASE_PATH="${DATABASE_PATH:-./app/backend/database.sqlite}"
DATABASE_URL="${DATABASE_URL:-}"

BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_BACKUP_PREFIX="${S3_BACKUP_PREFIX:-gatheraa}"
S3_FILE_STORAGE_BUCKET="${S3_FILE_STORAGE_BUCKET:-}"
S3_FILE_STORAGE_PREFIX="${S3_FILE_STORAGE_PREFIX:-uploads}"
S3_CONFIG_BUCKET="${S3_CONFIG_BUCKET:-}"
CROSS_REGION_BACKUP_BUCKET="${CROSS_REGION_BACKUP_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_SECONDARY_REGION="${AWS_SECONDARY_REGION:-us-west-2}"
BACKUP_KMS_KEY_ID="${BACKUP_KMS_KEY_ID:-}"
PROMETHEUS_PUSHGATEWAY="${PROMETHEUS_PUSHGATEWAY:-}"

mkdir -p "${BACKUP_DIR}"

log() {
  printf '[backup] %s\n' "$*"
}

metric_push() {
  local body="$1"
  if [[ -n "${PROMETHEUS_PUSHGATEWAY}" ]]; then
    curl --silent --show-error --fail \
      --data-binary "${body}" \
      "${PROMETHEUS_PUSHGATEWAY%/}/metrics/job/backup-dr" >/dev/null
  fi
}

encrypt_if_needed() {
  local source_file="$1"
  if [[ -z "${BACKUP_ENCRYPTION_KEY}" ]]; then
    echo "${source_file}"
    return
  fi

  local encrypted="${source_file}.enc"
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -in "${source_file}" \
    -out "${encrypted}" \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}"
  rm -f "${source_file}"
  echo "${encrypted}"
}

s3_put() {
  local file_path="$1"
  local s3_uri="$2"

  if [[ -z "${S3_BACKUP_BUCKET}" ]]; then
    return
  fi

  if [[ -n "${BACKUP_KMS_KEY_ID}" ]]; then
    aws s3 cp "${file_path}" "${s3_uri}" \
      --region "${AWS_REGION}" \
      --sse aws:kms \
      --sse-kms-key-id "${BACKUP_KMS_KEY_ID}"
  else
    aws s3 cp "${file_path}" "${s3_uri}" \
      --region "${AWS_REGION}" \
      --sse AES256
  fi
}

backup_database() {
  local db_file
  case "${DB_TYPE}" in
    sqlite)
      if [[ ! -f "${DATABASE_PATH}" ]]; then
        log "SQLite database not found at ${DATABASE_PATH}"
        return 1
      fi

      db_file="${BACKUP_DIR}/database.sqlite"
      if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "${DATABASE_PATH}" ".backup '${db_file}'"
      else
        cp "${DATABASE_PATH}" "${db_file}"
      fi
      gzip -f "${db_file}"
      db_file="${db_file}.gz"
      ;;
    postgres)
      db_file="${BACKUP_DIR}/database.dump"
      if [[ -n "${DATABASE_URL}" ]]; then
        pg_dump --format=custom --file "${db_file}" "${DATABASE_URL}"
      else
        : "${PGHOST:?PGHOST is required for postgres backup when DATABASE_URL is not set}"
        : "${PGPORT:=5432}"
        : "${PGUSER:?PGUSER is required for postgres backup when DATABASE_URL is not set}"
        : "${PGDATABASE:?PGDATABASE is required for postgres backup when DATABASE_URL is not set}"
        pg_dump --format=custom --file "${db_file}" --host "${PGHOST}" --port "${PGPORT}" --username "${PGUSER}" "${PGDATABASE}"
      fi
      ;;
    *)
      log "Unsupported DB_TYPE: ${DB_TYPE}"
      return 1
      ;;
  esac

  local checksum
  checksum="$(sha256sum "${db_file}" | awk '{print $1}')"
  local secure_db_file
  secure_db_file="$(encrypt_if_needed "${db_file}")"

  printf '{"type":"database","source":"%s","artifact":"%s","sha256":"%s"}\n' \
    "${DB_TYPE}" "$(basename "${secure_db_file}")" "${checksum}" >>"${MANIFEST_FILE}"

  if [[ -n "${S3_BACKUP_BUCKET}" ]]; then
    s3_put "${secure_db_file}" "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/database/${TIMESTAMP}/$(basename "${secure_db_file}")"
  fi
}

backup_config() {
  local config_archive="${BACKUP_DIR}/config.tar.gz"

  tar -czf "${config_archive}" \
    docker-compose.monitoring.yml \
    monitoring \
    observability \
    docs/openapi \
    app/backend/src/migrations \
    app/backend/src/seed 2>/dev/null || true

  local checksum
  checksum="$(sha256sum "${config_archive}" | awk '{print $1}')"
  local secure_config_archive
  secure_config_archive="$(encrypt_if_needed "${config_archive}")"

  printf '{"type":"config","artifact":"%s","sha256":"%s"}\n' \
    "$(basename "${secure_config_archive}")" "${checksum}" >>"${MANIFEST_FILE}"

  if [[ -n "${S3_BACKUP_BUCKET}" ]]; then
    local target_bucket="${S3_CONFIG_BUCKET:-${S3_BACKUP_BUCKET}}"
    s3_put "${secure_config_archive}" "s3://${target_bucket}/${S3_BACKUP_PREFIX}/config/${TIMESTAMP}/$(basename "${secure_config_archive}")"
  fi
}

backup_file_storage() {
  if [[ -z "${S3_FILE_STORAGE_BUCKET}" || -z "${S3_BACKUP_BUCKET}" ]]; then
    log "Skipping file storage backup; set S3_FILE_STORAGE_BUCKET and S3_BACKUP_BUCKET to enable"
    return 0
  fi

  local file_sync_prefix="${S3_BACKUP_PREFIX}/file-storage/${TIMESTAMP}"
  aws s3 sync \
    "s3://${S3_FILE_STORAGE_BUCKET}/${S3_FILE_STORAGE_PREFIX}" \
    "s3://${S3_BACKUP_BUCKET}/${file_sync_prefix}" \
    --region "${AWS_REGION}" \
    --sse AES256

  printf '{"type":"file-storage","source":"%s/%s","target":"%s/%s"}\n' \
    "${S3_FILE_STORAGE_BUCKET}" "${S3_FILE_STORAGE_PREFIX}" "${S3_BACKUP_BUCKET}" "${file_sync_prefix}" >>"${MANIFEST_FILE}"
}

replicate_cross_region() {
  if [[ -z "${CROSS_REGION_BACKUP_BUCKET}" || -z "${S3_BACKUP_BUCKET}" ]]; then
    return 0
  fi

  aws s3 sync \
    "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/${TIMESTAMP}" \
    "s3://${CROSS_REGION_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/${TIMESTAMP}" \
    --source-region "${AWS_REGION}" \
    --region "${AWS_SECONDARY_REGION}" \
    --sse AES256

  metric_push "backup_cross_region_replication_status 1"
}

local_retention_cleanup() {
  find "${BACKUP_ROOT}" -maxdepth 1 -mindepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
}

record_success_metrics() {
  local now
  now="$(date +%s)"
  metric_push "backup_last_success_timestamp_seconds{component=\"database\"} ${now}
backup_last_success_timestamp_seconds{component=\"config\"} ${now}
backup_last_success_timestamp_seconds{component=\"file-storage\"} ${now}
backup_last_run_status{component=\"database\"} 1
backup_last_run_status{component=\"config\"} 1
backup_last_run_status{component=\"file-storage\"} 1"
}

record_failure_metric() {
  metric_push "backup_last_run_status{component=\"database\"} 0"
}

main() {
  trap 'record_failure_metric' ERR

  log "Starting backup run for timestamp ${TIMESTAMP}"
  backup_database
  backup_config
  backup_file_storage

  cp "${MANIFEST_FILE}" "${BACKUP_DIR}/manifest.ndjson"
  if [[ -n "${S3_BACKUP_BUCKET}" ]]; then
    s3_put "${BACKUP_DIR}/manifest.ndjson" "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/manifests/${TIMESTAMP}.ndjson"
  fi

  replicate_cross_region || metric_push "backup_cross_region_replication_status 0"
  local_retention_cleanup
  record_success_metrics

  log "Backup completed successfully: ${BACKUP_DIR}"
}

main "$@"
