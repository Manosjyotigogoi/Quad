// Boot check — spins up mongodb-memory-server, sets the URI, then imports
// server.js. If anything in the startup chain throws (model compilation,
// route mounting, middleware setup), the process exits non-zero and the
// boot check fails.
//
// This mirrors the audit's `npm ci && node server.js` smoke test, but
// without requiring a real MongoDB instance.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGO_URI = mongo.getUri();
process.env.JWT_SECRET = 'boot-test-secret';
process.env.COLLEGE_EMAIL_DOMAIN = 'example.edu';
process.env.PORT = '5099'; // avoid clashing with a real dev server

console.log('[boot-check] in-memory mongo URI:', mongo.getUri());

let httpServer;
let imported;
try {
  // Dynamic import so we can wait for it.
  imported = await import('./server.js');
  console.log('[boot-check] server.js imported OK');
  // server.js starts listening on connectDB().then(). Wait a moment for
  // the listen() call to land.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  // The Express app should now be listening. Hit /api/health.
  const res = await fetch(`http://localhost:${process.env.PORT}/api/health`);
  const body = await res.json();
  if (res.status !== 200 || body.status !== 'ok') {
    console.error('[boot-check] /api/health did not return 200/ok:', res.status, body);
    process.exit(1);
  }
  console.log('[boot-check] /api/health returned 200 ok');
  console.log('[boot-check] PASS — server boots cleanly');
  process.exit(0);
} catch (err) {
  console.error('[boot-check] FAIL — server.js failed to boot:');
  console.error(err);
  process.exit(1);
}
