# Quad — Backup & Restore Runbook

> QD-019 — Required by the Round 2 security audit before staging launch.
> This document specifies the production backup strategy for MongoDB and
> Cloudinary, the restore-drill procedure, and the quarterly drill
> cadence. **Read this before going live.**

## 1. MongoDB — Primary data store

### 1.1 Production topology

- **Atlas M10+ cluster** (or self-hosted replica set, 3 nodes, journalling on).
- WAL / oplog retention: **≥ 72 hours** (enables point-in-time recovery).
- All write Concerns: `{ w: "majority", j: true }` — set globally in
  `mongoose.connect()` options once we move to a real replica set.

### 1.2 Backup strategy (primary)

Use **Atlas Continuous Cloud Backup with PITR** (point-in-time recovery,
≤ 72 h granularity). Snapshots retained:
- Daily snapshots: **30 days**
- Weekly snapshots: **12 weeks**
- Monthly snapshots: **12 months**

This is configured at the Atlas project level — see the ops wiki for the
exact cluster name. PITR means we can restore to *any second* within the
last 72 hours, which is the recovery granularity we promise users in the
Privacy Policy.

### 1.3 Backup strategy (secondary, defense-in-depth)

A daily `mongodump` cron on a separate host, exporting to
**encrypted S3** (SSE-KMS, bucket versioning ON, bucket lifecycle: 90
days to GLACIER, 365 days expire). The cron runs at 03:00 IST, off-peak
for the campus. Script: [`ops/scripts/mongodump-to-s3.sh`](../ops/scripts/mongodump-to-s3.sh)

```cron
# /etc/cron.d/quad-backup
0 3 * * * quad MONGO_URI=... AWS_PROFILE=quad-backups BACKUP_BUCKET=quad-backups-prod BACKUP_KMS_KEY_ID=... /opt/quad/ops/scripts/mongodump-to-s3.sh >> /var/log/quad-backup.log 2>&1
```

> **Why mongodump over Atlas-only?** Atlas continuous backups are
> convenient but locked to a single Atlas account. If the Atlas account
> is compromised (the most common cloud data-loss scenario), the attacker
> can delete both the cluster *and* its snapshots. The mongodump-to-S3
> pipeline is in a separate AWS account whose credentials are not stored
> on the app server, so a single compromise can't wipe both.

### 1.4 Restore drill procedure (must run quarterly)

1. Pick a snapshot from yesterday.
2. Provision a throwaway Atlas cluster (`quad-restore-drill-YYYYMMDD`).
3. Restore the snapshot into the throwaway cluster via Atlas UI:
   "Restore → Restore to a new cluster → choose snapshot date/time".
4. Run the **restore smoke tests** (Section 1.5) against the throwaway
   cluster. All must pass.
5. Verify a random user record exists (compare `_id` and `email` from
   the production admin dashboard).
6. Tear down the throwaway cluster.
7. File the drill report at `docs/drills/restore-drill-YYYYMMDD.md`
   (template in `docs/drills/_template.md`).

### 1.5 Restore smoke tests

```bash
MONGO_URI="$DRILL_CLUSTER_URI" node scripts/restore-smoke.mjs
```

The script ([`scripts/restore-smoke.mjs`](../scripts/restore-smoke.mjs))
runs 6 checks:
- `db.users.countDocuments()` ≥ 1
- `db.listings.countDocuments({ status: 'active' })` ≥ 1
- `db.orders.countDocuments()` ≥ 1
- A recent notification (last 24 h) exists.
- A created-then-deleted listing is gone (verifies deletes are durable,
  not just creates).
- The `auditlogs` collection exists (QD-015 audit log).

### 1.6 RPO / RTO targets

- **RPO** (Recovery Point Objective): **≤ 5 minutes** of data loss when
  Atlas PITR is available (72h oplog retention). Falls back to **≤ 24 hours**
  if the Atlas account itself is compromised and only the mongodump-to-S3
  secondary backup is usable. The two-tier story is intentional
  defense-in-depth: a single compromise (Atlas OR S3) cannot lose more
  than 24 hours of data; only a simultaneous compromise of both could.
- **RTO** (Recovery Time Objective): **≤ 4 hours** from incident
  declaration to full traffic restored. Practice via the quarterly drill.

---

## 2. Cloudinary — Image / document storage

### 2.1 Why we don't take separate Cloudinary backups

Cloudinary assets are **immutable**: once uploaded, an asset's
`public_id` and URL never change. The URL is the source of truth. We
therefore rely on:

1. **Cloudinary's own geo-distributed redundancy** (assets stored in S3
   with multi-region replication under the hood).
2. **Our MongoDB records** — every asset's `public_id` is stored in
   `User.verification.idCardPublicId`, `User.verification.aadharPublicId`,
   `Listing.images[].publicId`, `User.avatarUrl`, etc. If Cloudinary
   ever loses an asset, the Mongo record still references the
   `public_id` so we can identify exactly what was lost.
3. **The asset-URL convention** — every URL is of the form
   `https://res.cloudinary.com/<cloud_name>/image/upload/<public_id>.<ext>`.
   As long as we know the `cloud_name` (env var `CLOUDINARY_CLOUD_NAME`)
   and the `public_id` (stored in Mongo), we can rebuild the URL.

### 2.2 Self-hosted backup (defense-in-depth)

Optionally, run a weekly Cloudinary→S3 sync via the Cloudinary Admin API
(list all resources, download each, store under
`s3://quad-backups-prod/cloudinary/<public_id>`). Script:
`ops/scripts/cloudinary-to-s3.mjs` (to be authored). This is
**non-blocking** — if Cloudinary ever goes down, the app keeps running
(slow path: image URLs 404, but the marketplace still works for
text-only flows like messaging).

### 2.3 Restore drill (Cloudinary)

1. Pick a recent `public_id` from `db.listings.findOne().images[0].publicId`.
2. Verify the URL still resolves with HTTP 200.
3. If using the self-hosted backup: delete a *copy* of the asset in a
   test Cloudinary cloud, restore from S3, re-verify.

---

## 3. Quarterly drill cadence

| Quarter | Date       | Owner       | Outcome |
|---------|------------|-------------|---------|
| Q1      | YYYY-MM-DD | (assign)    | TBD     |
| Q2      | YYYY-MM-DD | (assign)    | TBD     |
| Q3      | YYYY-MM-DD | (assign)    | TBD     |
| Q4      | YYYY-MM-DD | (assign)    | TBD     |

The first drill MUST be performed before staging launch (acceptance
criterion for QD-019). File the report at
`docs/drills/restore-drill-initial.md`.

---

## 4. Incident playbook (data-loss event)

1. **Declare** — post in #quad-incidents, page on-call.
2. **Stop the bleeding** — if Mongo is corrupted, stop the backend
   (`pm2 stop quad-backend`) so no new writes overwrite recoverable state.
3. **Identify recovery point** — last good snapshot timestamp.
4. **Restore** — Atlas UI → Restore snapshot to new cluster → repoint
   `MONGO_URI` → restart backend.
5. **Verify** — run `scripts/restore-smoke.mjs`.
6. **Communicate** — post-update to users via the in-app banner and the
   status page (`status.quad.app`).
7. **Post-mortem** within 7 days — file at `docs/postmortems/`.

---

## 5. Reference

- Audit finding: `QD-019 — No backup/restore runbook for MongoDB or
  Cloudinary`.
- OWASP cheat sheet: https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html
- MongoDB backup docs: https://www.mongodb.com/docs/atlas/backup/
- Cloudinary Admin API: https://cloudinary.com/documentation/admin_api
