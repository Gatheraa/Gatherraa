#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_VAULT_NAME:?BACKUP_VAULT_NAME is required}"
: "${BACKUP_PLAN_NAME:?BACKUP_PLAN_NAME is required}"
: "${RDS_RESOURCE_ARN:?RDS_RESOURCE_ARN is required}"
: "${BACKUP_ROLE_ARN:?BACKUP_ROLE_ARN is required}"

AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_KMS_KEY_ID="${BACKUP_KMS_KEY_ID:-}"

create_vault() {
  if aws backup describe-backup-vault --backup-vault-name "${BACKUP_VAULT_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    echo "Backup vault ${BACKUP_VAULT_NAME} already exists"
    return
  fi

  if [[ -n "${BACKUP_KMS_KEY_ID}" ]]; then
    aws backup create-backup-vault \
      --backup-vault-name "${BACKUP_VAULT_NAME}" \
      --encryption-key-arn "${BACKUP_KMS_KEY_ID}" \
      --region "${AWS_REGION}" >/dev/null
  else
    aws backup create-backup-vault \
      --backup-vault-name "${BACKUP_VAULT_NAME}" \
      --region "${AWS_REGION}" >/dev/null
  fi

  echo "Created backup vault ${BACKUP_VAULT_NAME}"
}

create_plan() {
  local plan_file
  plan_file="$(mktemp)"
  cat >"${plan_file}" <<EOF
{
  "BackupPlanName": "${BACKUP_PLAN_NAME}",
  "Rules": [
    {
      "RuleName": "daily-backup-with-pitr",
      "TargetBackupVaultName": "${BACKUP_VAULT_NAME}",
      "ScheduleExpression": "cron(0 1 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 360,
      "EnableContinuousBackup": true,
      "Lifecycle": {
        "MoveToColdStorageAfterDays": 30,
        "DeleteAfterDays": 365
      },
      "CopyActions": [
        {
          "DestinationBackupVaultArn": "arn:aws:backup:${AWS_REGION}:${AWS_ACCOUNT_ID}:backup-vault:cross-region-${BACKUP_VAULT_NAME}",
          "Lifecycle": {
            "MoveToColdStorageAfterDays": 30,
            "DeleteAfterDays": 365
          }
        }
      ]
    }
  ]
}
EOF

  local plan_id
  plan_id="$(aws backup create-backup-plan --backup-plan "file://${plan_file}" --region "${AWS_REGION}" --query 'BackupPlanId' --output text)"
  rm -f "${plan_file}"
  echo "${plan_id}"
}

assign_resource() {
  local plan_id="$1"
  local selection_file
  selection_file="$(mktemp)"

  cat >"${selection_file}" <<EOF
{
  "SelectionName": "${BACKUP_PLAN_NAME}-selection",
  "IamRoleArn": "${BACKUP_ROLE_ARN}",
  "Resources": ["${RDS_RESOURCE_ARN}"]
}
EOF

  aws backup create-backup-selection \
    --backup-plan-id "${plan_id}" \
    --backup-selection "file://${selection_file}" \
    --region "${AWS_REGION}" >/dev/null

  rm -f "${selection_file}"
  echo "Assigned resource ${RDS_RESOURCE_ARN} to plan ${plan_id}"
}

main() {
  create_vault
  local plan_id
  plan_id="$(create_plan)"
  assign_resource "${plan_id}"
  echo "PITR enabled through AWS Backup plan: ${BACKUP_PLAN_NAME} (${plan_id})"
}

main
