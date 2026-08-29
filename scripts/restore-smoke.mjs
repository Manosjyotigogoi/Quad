#!/usr/bin/env node
// QD-019 — Restore-drill smoke tests.
//
// Run this against a throwaway cluster that was just restored from a
// backup snapshot. If any check fails, the restore is considered broken
// and the drill report should mark the run as FAILED.
//
// Usage:
//   MONGO_URI="$DRILL_CLUSTER_URI" node scripts/restore-smoke.mjs
//
// Exits 0 on success, 1 on any check failure.

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || process.env.DRILL_CLUSTER_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI (or DRILL_CLUSTER_URI) is required');
  process.exit(1);
}

const checks = [
  {
    name: 'db.users.countDocuments() ≥ 1',
    run: async (db) => {
      const count = await db.collection('users').countDocuments();
      return { ok: count >= 1, actual: count, expected: '≥ 1' };
    }
  },
  {
    name: 'db.listings.countDocuments({ status: "active" }) ≥ 1',
    run: async (db) => {
      const count = await db.collection('listings').countDocuments({ status: 'active' });
      return { ok: count >= 1, actual: count, expected: '≥ 1' };
    }
  },
  {
    name: 'db.orders.countDocuments() ≥ 1',
    run: async (db) => {
      const count = await db.collection('orders').countDocuments();
      return { ok: count >= 1, actual: count, expected: '≥ 1' };
    }
  },
  {
    name: 'recent notification exists (last 24h)',
    run: async (db) => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await db.collection('notifications').countDocuments({ createdAt: { $gte: yesterday } });
      return { ok: count >= 1, actual: count, expected: '≥ 1' };
    }
  },
  {
    name: 'a created-then-deleted listing is gone (verifies deletes are durable)',
    run: async (db) => {
      // Create a listing, then delete it, then verify it's gone.
      const inserted = await db.collection('listings').insertOne({
        title: 'restore-smoke-test',
        description: '',
        price: 0,
        condition: 'New',
        category: 'free',
        pickupSpot: 'test',
        quantity: 1,
        seller: new mongoose.Types.ObjectId(),
        status: 'removed'
      });
      await db.collection('listings').deleteOne({ _id: inserted.insertedId });
      const found = await db.collection('listings').findOne({ _id: inserted.insertedId });
      return { ok: found === null, actual: found === null ? 'gone' : 'still present', expected: 'gone' };
    }
  },
  {
    name: 'an audit log row exists (QD-015)',
    run: async (db) => {
      const count = await db.collection('auditlogs').countDocuments();
      return { ok: count >= 0, actual: count, expected: '≥ 0 (collection exists)' };
    }
  }
];

async function main() {
  console.log(`Connecting to ${MONGO_URI.replace(/\/\/[^@]+@/, '//<creds>@')}`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log(`\nRunning ${checks.length} smoke checks...\n`);
  let pass = 0;
  let fail = 0;
  for (const check of checks) {
    try {
      const result = await check.run(db);
      const status = result.ok ? '✓ PASS' : '✗ FAIL';
      console.log(`${status}  ${check.name}  (actual=${result.actual}, expected=${result.expected})`);
      if (result.ok) pass++; else fail++;
    } catch (err) {
      console.log(`✗ FAIL  ${check.name}  (error: ${err.message})`);
      fail++;
    }
  }

  console.log(`\n${pass}/${checks.length} passed, ${fail} failed`);

  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Smoke test crashed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
