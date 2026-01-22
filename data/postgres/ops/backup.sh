#!/usr/bin/env bash

set -euo pipefail

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups"
FILENAME="quailcomp_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Creating backup: $FILENAME"

pg_dump \
  --format=custom \
  --file="$BACKUP_DIR/$FILENAME" \
  quailcomp

echo "Backup completed:"
echo "  $BACKUP_DIR/$FILENAME"
