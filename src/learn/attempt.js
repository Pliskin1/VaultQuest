// One attempt at a vault — the same rules for every language. Language-specific code only judges an
// answer (pass/fail); this decides what it costs. Pure apart from the attempt object it's given.
//
// Async safety: every submission gets a token. A judgement, mentor reply or reset that resolves after
// the attempt ended (vault left, cracked or reset) or belongs to an older attempt is ignored.
import { fingerprint } from './fingerprint.js';
import { newSession, recordSubmission } from './session.js';
import { newRun } from './progress.js';

let seq = 0;
// run: rewards paid in this attempt (so a reset can take back exactly those).
export const newAttempt = (lang, vault) => ({ id: ++seq, lang, vault, session: newSession(), run: newRun(), busy: false, over: false, exhausted: false });

// Identity of an answer, namespaced so histories never mix across languages, vaults or challenges.
// mcq: option index · blank: text, trimmed with inner whitespace collapsed · code: fingerprint
// (trailing spaces and extra blank lines ignored; indentation, case and every other character count).
export function answerKey(a, challenge, type, value) {
  const v = type === 'mcq' ? 'opt:' + value
    : type === 'blank' ? 'txt:' + String(value ?? '').trim().replace(/\s+/g, ' ')
    : 'code:' + fingerprint(String(value ?? ''));
  return `${a.lang}:${a.vault}:${challenge}:${v}`;
}

export const isCurrent = (a, token) => !!(a && token && token.id === a.id && !a.over);

// Starts evaluating a submission → token, or null while one is being evaluated or the attempt is over/locked.
export function beginSubmission(a) {
  if (!a || a.over || a.busy || a.session.locked) return null;
  a.busy = true;
  return { id: a.id };
}

// Applies the heart rules to a judged submission → outcome, or null if the token is stale.
// `exhausted` is true for exactly one submission per attempt: the one that took the last heart.
export function settleSubmission(a, token, { key, passed, tags = [] }) {
  if (!isCurrent(a, token) || token.settled) return null;
  token.settled = true; a.busy = false;
  const { session, outcome } = recordSubmission(a.session, { fingerprint: key, passed, tags });
  a.session = session;
  const exhausted = outcome.locked && !a.exhausted;
  if (exhausted) a.exhausted = true;
  return { ...outcome, exhausted };
}

// Releases a submission that couldn't be judged (nothing recorded).
export function cancelSubmission(a, token) { if (isCurrent(a, token) && !token.settled) { token.settled = true; a.busy = false; } }

// The attempt is finished — cracked, left or reset. Pending callbacks from it become stale.
export function endAttempt(a) { if (a) { a.over = true; a.busy = false; } }

// Zero hearts, run once by the submission that took the last heart. `announce` and `pause` are the UI's;
// `next` (today: restart the vault; Phase 4: Syntax Recovery) runs only if that attempt is still the
// current one afterwards — not after the player left the vault. → whether `next` ran.
export async function whenExhausted(current, token, { announce, pause, next }) {
  if (!isCurrent(current(), token)) return false; // already left before the reply finished
  await announce();
  await pause();
  if (!isCurrent(current(), token)) return false;
  await next();
  return true;
}
