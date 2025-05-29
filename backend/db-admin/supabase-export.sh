#!/bin/bash
set -euo pipefail

# PostgreSQL connection parameters
PGHOST="aws-0-us-west-1.pooler.supabase.com"
PGPORT="6543"
PGDATABASE="postgres"
PGUSER="postgres.zpdtjvlltxlfrzeicete"

# Prompt for the PostgreSQL password
read -s -p "Enter PostgreSQL password: " PGPASSWORD
export PGPASSWORD
echo

# Define the backup directory and file path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backup"
BACKUP_FILE="$BACKUP_DIR/backup.dump"

# Create the backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Execute pg_dump within a Docker container to export the specified tables
docker run --rm \
  -e PGHOST="$PGHOST" \
  -e PGPORT="$PGPORT" \
  -e PGDATABASE="$PGDATABASE" \
  -e PGUSER="$PGUSER" \
  -e PGPASSWORD="$PGPASSWORD" \
  -v "$BACKUP_DIR":/backup \
  postgres:latest \
  bash -c "pg_dump --no-owner --no-privileges --format=custom -t public.job_postings_details -t public.job_postings --file=/backup/backup.dump"

# Unset the password environment variable
unset PGPASSWORD

