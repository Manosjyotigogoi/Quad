import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// QD-017 THIRD-PASS — graceful shutdown integration test.
//
// Spawns a separate Node process that runs tests/graceful-shutdown-runner.mjs.
// The runner:
//   1. Spins up mongodb-memory-server
//   2. Spawns server.js as a child with the mongo URI
//   3. Verifies /api/ready returns 200
//   4. Sends SIGTERM
//   5. Verifies /api/ready returns 503 (or connection refused)
//   6. Verifies the server exits with code 0 within 5s
//   7. Exits with 0 on success, non-zero on failure
//
// We use a separate runner because vitest's setup.js already spins up
// its own mongo instance — running this in-process would conflict.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.resolve(__dirname, 'graceful-shutdown-runner.mjs');

describe('QD-017 — graceful shutdown integration test', () => {
  it(
    'SIGTERM flips /api/ready to 503 and exits cleanly within 5s',
    () => {
      // Run the runner synchronously; non-zero exit = test failure.
      let stdout = '';
      let stderr = '';
      try {
        stdout = execFileSync('node', [RUNNER], {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 30_000,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (err) {
        stdout = err.stdout || '';
        stderr = err.stderr || '';
        // Re-throw with a clear message.
        throw new Error(
          `Graceful shutdown runner failed (exit ${err.status || 'n/a'}).\n` +
            `--- STDOUT ---\n${stdout}\n` +
            `--- STDERR ---\n${stderr}\n`
        );
      }

      // The runner prints structured output — verify the success markers.
      expect(stdout).toContain('READY_BEFORE=200');
      // During shutdown, /ready should return either 503 (caught the
      // window where the server is shutting down but still listening)
      // or 0 (server already exited cleanly — also acceptable).
      expect(stdout).toMatch(/READY_DURING_SHUTDOWN=(503|0)/);
      expect(stdout).toContain('EXIT_CODE=0');
    },
    60_000
  );
});
