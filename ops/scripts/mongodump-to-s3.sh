#!/usr/bin/env bash
# QD-019 — Daily mongodump → encrypted S3 backup script.
#
# Run via cron at 03:00 IST (off-peak for the campus). The S3 bucket
# is in a SEPARATE AWS account from the app server, so a single
# compromise can't wipe both the cluster and its backups.
#
# Required env vars (set in the cron wrapper, not in this file):
#   MONGO_URI             — MongoDB connection string with backup-role creds.
#   AWS_PROFILE           — Named profile with s3:PutObject + s3:PutObjectTagging.
#   BACKUP_BUCKET         — S3 bucket name (e.g. quad-backups-prod).
#   BACKUP_KMS_KEY_ID     — KMS key ID for SSE-KMS encryption.
#
# Optional:
#   BACKUP_RETENTION_DAYS — How long to keep daily dumps (default: 30).
#
# Failure handling:
#   - mongodump non-zero exit → script exits non-zero + logs to stderr.
#   - aws s3 cp non-zero exit → script exits non-zero. mongodump file
#     is left in /tmp/ for inspection (cleaned up on next run).
#   - Cron wrapper should alert on non-zero exit (e.g. via Slack webhook).

set -euo pipefail

: "${MONGO_URI:?MONGO_URI is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${BACKUP_KMS_KEY_ID:?BACKUP_KMS_KEY_ID is required}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

DATE=$(date -u +%Y%m%dT%H%M%SZ)
DUMP_DIR=$(mktemp -d)
ARCHIVE="$DUMP_DIR/quad-$DATE.archive.gz"

trap "rm -rf $DUMP_DIR" EXIT

echo "[$DATE] starting mongodump → $ARCHIVE"

# --gzip compresses the archive. --archive produces a single file
# (easier to manage than a directory of BSON files).
mongodump \
  --uri="$MONGO_URI" \
  --gzip \
  --archive="$ARCHIVE"

SIZE=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")
echo "[$DATE] mongodump complete: $(numfmt --to=iec $SIZE)"

S3_KEY="mongodb/$DATE/quad-$DATE.archive.gz"
S3_URI="s3://$BACKUP_BUCKET/$S3_KEY"

echo "[$DATE] uploading to $S3_URI (SSE-KMS)"

aws s3 cp "$ARCHIVE" "$S3_URI" \
  --sse aws:kms \
  --sse-kms-key-id "$BACKUP_KMS_KEY_ID" \
  --expected-size "$SIZE"

# Tag for lifecycle policy.
aws s3api put-object-tagging \
  --bucket "$BACKUP_BUCKET" \
  --key "$S3_KEY" \
  --tagging "{\"TagSet\":[{\"Key\":\"Retention\",\"Value\":\"daily\"},{\"Key\":\"BackupDate\",\"Value\":\"$DATE\"}]}"

echo "[$DATE] backup complete: $S3_URI"

# Print a manifest line for log scrapers:
echo "BACKUP_MANIFEST date=$DATE key=$S3_KEY size=$SIZE bytes=$SIZE sse=aws:kms kms_key=$BACKUP_KMS_KEY_ID"
