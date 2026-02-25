#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="${1:-}"
if [[ -z "${TIMESTAMP}" ]]; then
  echo "Usage: recovery-test.sh <timestamp>"
  exit 1
fi

S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_BACKUP_PREFIX="${S3_BACKUP_PREFIX:-gatheraa}"
PROMETHEUS_PUSHGATEWAY="${PROMETHEUS_PUSHGATEWAY:-}"
DB_TYPE="${DB_TYPE:-sqlite}"

if [[ -z "${S3_BACKUP_BUCKET}" ]]; then
  echo "S3_BACKUP_BUCKET is required"
  exit 1
fi

metric_push() {
  local body="$1"
  if [[ -n "${PROMETHEUS_PUSHGATEWAY}" ]]; then
    curl --silent --show-error --fail \
      --data-binary "${body}" \
      "${PROMETHEUS_PUSHGATEWAY%/}/metrics/job/backup-dr" >/dev/null
  fi
}

test_sqlite_restore() {
  local target="./ops/backup-dr/.restore-tests/database-${TIMESTAMP}.sqlite"
  ./ops/backup-dr/restore.sh --component database --timestamp "${TIMESTAMP}" --target "${target}"

  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${target}" "PRAGMA integrity_check;" | grep -q "ok"
  else
    [[ -s "${target}" ]]
  fi
}

test_config_restore() {
  local target="./ops/backup-dr/.restore-tests/config-${TIMESTAMP}"
  ./ops/backup-dr/restore.sh --component config --timestamp "${TIMESTAMP}" --target "${target}"
  [[ -d "${target}" ]]
}

main() {
  mkdir -p ./ops/backup-dr/.restore-tests

  if [[ "${DB_TYPE}" == "sqlite" ]]; then
    test_sqlite_restore
  else
    ./ops/backup-dr/restore.sh --component database --timestamp "${TIMESTAMP}" --dry-run
  fi

  test_config_restore

  local now
  now="$(date +%s)"
  metric_push "backup_recovery_test_last_success_timestamp_seconds ${now}
backup_recovery_test_last_run_status 1"

  echo "Recovery test passed for backup timestamp ${TIMESTAMP}"
}

trap 'metric_push "backup_recovery_test_last_run_status 0"' ERR
main
