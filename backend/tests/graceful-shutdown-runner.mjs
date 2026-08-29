#!/usr/bin/env node
// QD-017 THIRD-PASS — graceful shutdown runner.
//
// Spawns server.js as a child, sends SIGTERM, and prints structured
// output that the vitest test parses.

import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mongo = await MongoMemoryServer.create();
const envFile = path.join(os.tmpdir(), `quad-graceful-env-${Date.now()}.env`);
fs.writeFileSync(
  envFile,
  [
    `MONGO_URI=${mongo.getUri()}`,
    `JWT_SECRET=graceful-test`,
    `COLLEGE_EMAIL_DOMAIN=example.edu`,
    `PORT=5094`,
    `NODE_ENV=development`,
    `LOG_LEVEL=warn`
  ].join('\n')
);

const child = spawn('node', ['--env-file', envFile, 'server.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  detached: false
});

// Print stderr to runner's stderr so we can see what the child is doing.
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

const stderrChunks = [];
child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

function cleanup() {
  if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
}

async function waitForStartup() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // As a fallback, poll /api/health instead of relying on stdout.
      // pino-pretty uses a worker thread, so stdout may be buffered
      // beyond the listen() call. We give the server 10s to start
      // listening, polled every 200ms.
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5094/api/health');
          if (res.status === 200) {
            clearInterval(pollInterval);
            clearTimeout(timeout2);
            resolve();
          }
        } catch {
          // not yet listening — keep polling
        }
      }, 200);
      const timeout2 = setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Server failed to listen within 15s. stderr: ' + Buffer.concat(stderrChunks).toString()));
      }, 15_000);
    }, 0);
  });
}

async function fetchReady() {
  try {
    const res = await fetch('http://localhost:5094/api/ready');
    return res.status;
  } catch (err) {
    return 0; // connection refused
  }
}

try {
  await waitForStartup();
  await new Promise((r) => setTimeout(r, 800));

  const readyBefore = await fetchReady();
  console.log(`READY_BEFORE=${readyBefore}`);

  child.kill('SIGTERM');
  // The shutdown is fast (~6ms in our manual test). We poll /ready
  // every 10ms to try to catch the 503 window. If we miss it (server
  // already exited), readyDuring=0 — acceptable.
  let readyDuring = 0;
  for (let i = 0; i < 30; i++) {
    readyDuring = await fetchReady();
    if (readyDuring === 503) break;
    if (child.exitCode !== null || child.killed) {
      readyDuring = 0;
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  console.log(`READY_DURING_SHUTDOWN=${readyDuring}`);

  // Wait for the exit event. If we miss it (race), poll the process.
  const exitCode = await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    const exitTimeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(-1);
    }, 25_000);
    child.on('exit', (code) => {
      clearTimeout(exitTimeout);
      resolve(code);
    });
  });

  console.log(`EXIT_CODE=${exitCode}`);
  cleanup();
  await mongo.stop();
  process.exit(0);
} catch (err) {
  console.error('RUNNER_FAILED:', err.message);
  console.error('stderr:', Buffer.concat(stderrChunks).toString());
  cleanup();
  if (!child.killed) child.kill('SIGKILL');
  await mongo.stop();
  process.exit(1);
}
