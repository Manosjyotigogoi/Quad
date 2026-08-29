# Restore Drill Report — YYYY-MM-DD

> Replace placeholders before filing.

## Drill metadata
- **Date conducted:** YYYY-MM-DD
- **Operator:** (name)
- **Snapshot source:** (Atlas snapshot ID or mongodump file)
- **Snapshot timestamp:** YYYY-MM-DD HH:MM:SS UTC
- **Throwaway cluster:** quad-restore-drill-YYYYMMDD

## Restore steps
1. [ ] Provisioned throwaway cluster.
2. [ ] Restored snapshot.
3. [ ] Ran `MONGO_URI="$DRILL_CLUSTER_URI" node scripts/restore-smoke.mjs`.
4. [ ] Verified a random user record exists (compare `_id` + `email`).
5. [ ] Verified a deleted listing is gone.
6. [ ] Tore down throwaway cluster.

## Smoke-test results
| Check                                   | Expected | Actual | Pass? |
|-----------------------------------------|----------|--------|-------|
| `db.users.countDocuments() ≥ 1`         | ≥ 1      | TBD    | ☐    |
| `db.listings.countDocuments({status:'active'}) ≥ 1` | ≥ 1 | TBD    | ☐    |
| `db.orders.countDocuments() ≥ 1`        | ≥ 1      | TBD    | ☐    |
| Recent notification exists (last 24h)   | 1        | TBD    | ☐    |
| Deleted listing is gone                 | 0        | TBD    | ☐    |

## RPO / RTO measurement
- **Snapshot age at restore time:** ___ hours
- **Time to restore + verify:** ___ minutes
- **Within RPO target (≤ 5 min)?** (Y/N — note that PITR covers the gap;
  snapshot age is the upper bound)
- **Within RTO target (≤ 4 h)?** (Y/N)

## Issues encountered
- (none / list)

## Sign-off
- **Operator:** ____
- **Reviewer:** ____
- **Filed at:** docs/drills/restore-drill-YYYYMMDD.md
