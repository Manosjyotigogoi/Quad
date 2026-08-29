// Escapes regex metacharacters in a user-controlled string before it's
// used as a `$regex` source against MongoDB. Without this, a malicious
// title like `(a+)+$` triggers catastrophic backtracking inside Mongo's
// PCRE engine (QD-003 — ReDoS in saved-search matching).
//
// This implementation also escapes the `\\` character first so the
// other escapes aren't themselves re-interpreted.
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(str) {
  return String(str ?? '').replace(REGEX_META, '\\$&');
}
