# Backup & Disaster Recovery

This implementation adds automated backup and disaster recovery workflows for:
- Database backups (SQLite or PostgreSQL)
- S3-backed file storage backups
- Configuration backups
- Cross-region replication
- Encrypted backup artifacts
- Recovery testing + monitoring alerts

## Components

- `ops/backup-dr/backup.sh` — automated backup job (db, files, config) with encryption and optional S3 upload/cross-region replication.
- `ops/backup-dr/restore.sh` — granular restore for `database`, `config`, `file-storage`.
- `ops/backup-dr/recovery-test.sh` — automated recovery test that validates restore integrity and emits success/failure metrics.
- `ops/backup-dr/enable-pitr-rds.sh` — enables AWS Backup continuous backup (PITR) for RDS resources.
- `ops/backup-dr/velero/*.yaml` — optional Kubernetes backup schedule/restore manifests.

## Automation

Schedule automatic backups with cron:

```bash
# Every 6 hours
0 */6 * * * cd /workspaces/Gatherraa && ./ops/backup-dr/backup.sh >> /var/log/gatheraa-backup.log 2>&1

# Weekly recovery drill (Sunday 03:00 UTC) using latest known timestamp
0 3 * * 0 cd /workspaces/Gatherraa && ./ops/backup-dr/recovery-test.sh "$(date -u +\%Y\%m\%dT01\%M\%SZ)" >> /var/log/gatheraa-recovery-test.log 2>&1
```

## Required Environment Variables

### Core backup

- `DB_TYPE=sqlite|postgres`
- `DATABASE_PATH` (for SQLite)
- `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGUSER`/`PGDATABASE` (for Postgres)
- `S3_BACKUP_BUCKET`
- `S3_BACKUP_PREFIX` (default: `gatheraa`)
- `BACKUP_ENCRYPTION_KEY` (recommended)
- `BACKUP_KMS_KEY_ID` (recommended when using AWS KMS)

### File storage backup

- `S3_FILE_STORAGE_BUCKET`
- `S3_FILE_STORAGE_PREFIX` (default: `uploads`)

### Cross-region replication

- `CROSS_REGION_BACKUP_BUCKET`
- `AWS_REGION`
- `AWS_SECONDARY_REGION`

### Monitoring

- `PROMETHEUS_PUSHGATEWAY` (for example `http://pushgateway:9091`)

## Point-in-Time Recovery (PITR)

### For PostgreSQL/RDS

Run:

```bash
export BACKUP_VAULT_NAME=gatheraa-vault
export BACKUP_PLAN_NAME=gatheraa-rds-plan
export RDS_RESOURCE_ARN=arn:aws:rds:us-east-1:123456789012:db:gatheraa-prod
export BACKUP_ROLE_ARN=arn:aws:iam::123456789012:role/service-role/AWSBackupDefaultServiceRole
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=123456789012
./ops/backup-dr/enable-pitr-rds.sh
```

This creates an AWS Backup plan with continuous backups enabled (`EnableContinuousBackup=true`) for PITR.

### For SQLite

SQLite is restored from timestamped snapshots. True WAL-based PITR is not native in this implementation; for strict PITR use PostgreSQL + AWS Backup continuous backup.

## Granular Restore Options

### Database restore

```bash
# Full SQLite restore
./ops/backup-dr/restore.sh --component database --timestamp 20260224T010000Z --target ./app/backend/database-restored.sqlite

# PostgreSQL table-level restore
DB_TYPE=postgres PGDATABASE=gatheraa \
./ops/backup-dr/restore.sh --component database --timestamp 20260224T010000Z --schema public --table events
```

### File storage restore

```bash
./ops/backup-dr/restore.sh --component file-storage --timestamp 20260224T010000Z --target s3://gatheraa-restore/uploads --file-prefix events/
```

### Config restore

```bash
./ops/backup-dr/restore.sh --component config --timestamp 20260224T010000Z --target ./restore/config
```

## Recovery Testing Procedure

1. Select a recent backup timestamp from backup logs/manifests.
2. Execute `./ops/backup-dr/recovery-test.sh <timestamp>`.
3. Verify emitted metrics:
   - `backup_recovery_test_last_run_status`
   - `backup_recovery_test_last_success_timestamp_seconds`
4. Record results in operations runbook.

## Backup Verification

- Each generated artifact is hashed with SHA-256 and recorded in `manifest.ndjson`.
- Upload success is validated by `aws s3 cp` exit status.
- Recovery test validates restorable state.

## Monitoring and Alerting

Prometheus alert rules now include:
- backup failures (`backup_last_run_status`)
- stale backups (`backup_last_success_timestamp_seconds`)
- failed cross-region replication (`backup_cross_region_replication_status`)
- stale recovery drill (`backup_recovery_test_last_success_timestamp_seconds`)
