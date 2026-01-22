#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./restore.sh path/to/backup.dump"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️ RESTORE WARNING ⚠️"
echo "This will overwrite data in the quailcomp database"

read -r -p "Type 'RESTORE quailcomp' to continue: " CONFIRM

if [[ "$CONFIRM" != "RESTORE quailcomp" ]]; then
  echo "Confirmation failed. Aborting"
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --dbname=quailcomp \
  "$BACKUP_FILE"

echo "Restore completed successfully"
