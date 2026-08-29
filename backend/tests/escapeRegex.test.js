import { describe, it, expect } from 'vitest';
import { escapeRegex } from '../utils/escapeRegex.js';

// QD-003 — ReDoS regression test. The catastrophic-backtracking title
// `(a+)+$` is the canonical example. With escapeRegex applied, the
// title is turned into a literal regex source (no metacharacters) so
// Mongo's PCRE engine returns in microseconds instead of hanging.
describe('QD-003 — escapeRegex helper', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
    expect(escapeRegex('hello.*world')).toBe('hello\\.\\*world');
    expect(escapeRegex('[bracket]')).toBe('\\[bracket\\]');
    expect(escapeRegex('a|b')).toBe('a\\|b');
    expect(escapeRegex('a\\b')).toBe('a\\\\b');
  });

  it('escapes a catastrophic-backtracking title under 1ms', () => {
    const evil = '(a+)+$';
    const start = process.hrtime.bigint();
    const escaped = escapeRegex(evil);
    const elapsedNs = Number(process.hrtime.bigint() - start);
    expect(escaped).toBe('\\(a\\+\\)\\+\\$');
    expect(elapsedNs).toBeLessThan(1_000_000); // 1ms in nanoseconds
  });

  it('handles null/undefined input safely', () => {
    expect(escapeRegex(null)).toBe('');
    expect(escapeRegex(undefined)).toBe('');
    expect(escapeRegex('')).toBe('');
  });

  it('produces a regex that matches the literal input string', () => {
    const input = '(a+)+$';
    const escaped = escapeRegex(input);
    const re = new RegExp(escaped);
    expect(re.test(input)).toBe(true);
    // And does NOT match a non-containing string.
    expect(re.test('not the input')).toBe(false);
  });
});
