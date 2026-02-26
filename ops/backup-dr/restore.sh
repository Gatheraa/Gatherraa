#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  restore.sh --component <database|config|file-storage> --timestamp <UTC timestamp> [options]

Options:
  --component       Component to restore
  --timestamp       Backup timestamp (e.g. 20260224T010000Z)
  --target          Local target path (database/config)
  --table           PostgreSQL table name for granular table restore
  --schema          PostgreSQL schema name for granular schema restore
  --file-prefix     Prefix filter for file-storage restore
  --dry-run         Print actions without writing data

Environment:
  DB_TYPE=sqlite|postgres
  S3_BACKUP_BUCKET (required)
  S3_BACKUP_PREFIX (default: gatheraa)
  BACKUP_ENCRYPTION_KEY (required for encrypted artifacts)
EOF
}

COMPONENT=""
TIMESTAMP=""
TARGET=""
TABLE_NAME=""
SCHEMA_NAME=""
FILE_PREFIX=""
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --component) COMPONENT="$2"; shift 2 ;;
    --timestamp) TIMESTAMP="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    --table) TABLE_NAME="$2"; shift 2 ;;
    --schema) SCHEMA_NAME="$2"; shift 2 ;;
    --file-prefix) FILE_PREFIX="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "${COMPONENT}" || -z "${TIMESTAMP}" ]]; then
  usage
  exit 1
fi

S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_BACKUP_PREFIX="${S3_BACKUP_PREFIX:-gatheraa}"
DB_TYPE="${DB_TYPE:-sqlite}"
WORK_DIR="${WORK_DIR:-./ops/backup-dr/.restore/${TIMESTAMP}}"
mkdir -p "${WORK_DIR}"

if [[ -z "${S3_BACKUP_BUCKET}" ]]; then
  echo "S3_BACKUP_BUCKET is required"
  exit 1
fi

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] $*"
    return
  fi
  eval "$@"
}

decrypt_if_needed() {
  local file_path="$1"
  if [[ "${file_path}" != *.enc ]]; then
    echo "${file_path}"
    return
  fi

  : "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required to decrypt encrypted backup artifacts}"
  local out_file="${file_path%.enc}"
  run "openssl enc -d -aes-256-cbc -pbkdf2 -in '${file_path}' -out '${out_file}' -pass 'pass:${BACKUP_ENCRYPTION_KEY}'"
  echo "${out_file}"
}

restore_database() {
  local local_file="${WORK_DIR}/db-artifact"

  if [[ "${DB_TYPE}" == "sqlite" ]]; then
    aws s3 cp \
      "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/database/${TIMESTAMP}/database.sqlite.gz.enc" \
      "${local_file}.gz.enc" || aws s3 cp \
      "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/database/${TIMESTAMP}/database.sqlite.gz" \
      "${local_file}.gz"

    local selected
    selected="$(ls -1 "${local_file}"* | head -n1)"
    local decrypted
    decrypted="$(decrypt_if_needed "${selected}")"

    local output_db="${TARGET:-./app/backend/database-restored.sqlite}"
    run "gunzip -c '${decrypted}' > '${output_db}'"
    echo "Restored SQLite database to ${output_db}"
    return
  fi

  aws s3 cp \
    "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/database/${TIMESTAMP}/database.dump.enc" \
    "${local_file}.dump.enc" || aws s3 cp \
    "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/database/${TIMESTAMP}/database.dump" \
    "${local_file}.dump"

  local selected
  selected="$(ls -1 "${local_file}"* | head -n1)"
  local decrypted
  decrypted="$(decrypt_if_needed "${selected}")"

  local restore_args=""
  if [[ -n "${SCHEMA_NAME}" ]]; then
    restore_args+=" --schema='${SCHEMA_NAME}'"
  fi
  if [[ -n "${TABLE_NAME}" ]]; then
    restore_args+=" --table='${TABLE_NAME}'"
  fi

  : "${PGDATABASE:?PGDATABASE is required for PostgreSQL restore}"
  run "pg_restore --clean --if-exists --dbname='${PGDATABASE}' ${restore_args} '${decrypted}'"
  echo "Restored PostgreSQL backup into ${PGDATABASE}"
}

restore_config() {
  local local_file="${WORK_DIR}/config-artifact"

  aws s3 cp \
    "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/config/${TIMESTAMP}/config.tar.gz.enc" \
    "${local_file}.tar.gz.enc" || aws s3 cp \
    "s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/config/${TIMESTAMP}/config.tar.gz" \
    "${local_file}.tar.gz"

  local selected
  selected="$(ls -1 "${local_file}"* | head -n1)"
  local decrypted
  decrypted="$(decrypt_if_needed "${selected}")"

  local extract_target="${TARGET:-./ops/backup-dr/.restore/config-${TIMESTAMP}}"
  run "mkdir -p '${extract_target}'"
  run "tar -xzf '${decrypted}' -C '${extract_target}'"
  echo "Restored config archive to ${extract_target}"
}

restore_file_storage() {
  : "${TARGET:?--target must be provided for file-storage restore and should be an s3:// bucket/prefix}"
  local source="s3://${S3_BACKUP_BUCKET}/${S3_BACKUP_PREFIX}/file-storage/${TIMESTAMP}"
  local includes=""

  if [[ -n "${FILE_PREFIX}" ]]; then
    includes="--exclude '*' --include '${FILE_PREFIX}*'"
  fi

  run "aws s3 sync '${source}' '${TARGET}' ${includes}"
  echo "Restored file storage from ${source} to ${TARGET}"
}

case "${COMPONENT}" in
  database) restore_database ;;
  config) restore_config ;;
  file-storage) restore_file_storage ;;
  *) usage; exit 1 ;;
esac
