#!/usr/bin/env node
// QD-025 — One-time migration to backfill the denormalized
// `verificationStatus` field onto every existing Listing document.
//
// Run AFTER deploying the new code that reads the field (otherwise
// existing listings appear as 'not_submitted' to the verifiedOnly
// filter). Run BEFORE announcing the launch.
//
// Usage:
//   MONGO_URI="$PROD_MONGO_URI" node scripts/backfill-verification-status.mjs
//
// Strategy: for each User, look up their current verification.status
// and updateMany all their Listings in one bulk operation. Single pass.

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const users = db.collection('users');
  const listings = db.collection('listings');

  const cursor = users.find({}, { projection: { _id: 1, 'verification.status': 1 } });
  let totalUsers = 0;
  let totalListingsUpdated = 0;
  let totalListingsUntouched = 0;

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    const status = user.verification?.status || 'not_submitted';
    const result = await listings.updateMany(
      { seller: user._id, verificationStatus: { $ne: status } },
      { $set: { verificationStatus: status } }
    );
    totalUsers++;
    if (result.modifiedCount > 0) {
      totalListingsUpdated += result.modifiedCount;
      console.log(`  user ${user._id} → ${status}: updated ${result.modifiedCount} listings`);
    } else {
      totalListingsUntouched += result.matchedCount;
    }
  }

  console.log('\n--- Backfill summary ---');
  console.log(`Users scanned:           ${totalUsers}`);
  console.log(`Listings updated:        ${totalListingsUpdated}`);
  console.log(`Listings already correct: ${totalListingsUntouched}`);

  // Sanity check: are there any listings still missing verificationStatus?
  const missing = await listings.countDocuments({ verificationStatus: { $exists: false } });
  if (missing > 0) {
    console.error(`WARNING: ${missing} listings still have no verificationStatus field!`);
    process.exit(1);
  }
  console.log('All listings now have verificationStatus. ✓');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
