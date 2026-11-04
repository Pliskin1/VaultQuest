import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySubmission, applyRecoveryAnswer, MAX_HEARTS } from '../src/learn/hearts.js';
import { fingerprint, normaliseCode } from '../src/learn/fingerprint.js';

const start = { hearts: 3, failedFingerprints: [], locked: false };

test('three hearts to start', () => assert.equal(MAX_HEARTS, 3));

test('a passing submission never costs a heart', () => {
  const s = applySubmission(start, { fingerprint: 'a', passed: true });
  assert.equal(s.hearts, 3); assert.equal(s.heartLost, false); assert.equal(s.duplicate, false);
});

test('a new failing submission costs exactly one heart', () => {
  const s = applySubmission(start, { fingerprint: 'a', passed: false });
  assert.equal(s.hearts, 2); assert.equal(s.heartLost, true); assert.deepEqual(s.failedFingerprints, ['a']);
});

test('re-submitting an identical failing submission costs nothing', () => {
  const once = applySubmission(start, { fingerprint: 'a', passed: false });
  const again = applySubmission(once, { fingerprint: 'a', passed: false });
  assert.equal(again.hearts, 2); assert.equal(again.duplicate, true); assert.equal(again.heartLost, false);
  assert.deepEqual(again.failedFingerprints, ['a']);
});

test('three distinct failures lock at zero; hearts never go negative', () => {
  let s = start;
  for (const fp of ['a', 'b', 'c']) s = applySubmission(s, { fingerprint: fp, passed: false });
  assert.equal(s.hearts, 0); assert.equal(s.locked, true);
  assert.equal(applySubmission(s, { fingerprint: 'd', passed: false }).hearts, 0);
});

test('a pass after failures keeps the remembered fingerprints', () => {
  const s = applySubmission(applySubmission(start, { fingerprint: 'a', passed: false }), { fingerprint: 'b', passed: true });
  assert.equal(s.hearts, 2); assert.deepEqual(s.failedFingerprints, ['a']);
});

test('does not mutate its input', () => {
  const before = structuredClone(start);
  applySubmission(start, { fingerprint: 'a', passed: false });
  assert.deepEqual(start, before);
});

test('recovery: a correct answer restores one heart, a wrong one costs nothing', () => {
  assert.equal(applyRecoveryAnswer({ hearts: 0, locked: true }, true).hearts, 1);
  const w = applyRecoveryAnswer({ hearts: 1, locked: true }, false);
  assert.equal(w.hearts, 1); assert.equal(w.restored, false); assert.equal(w.locked, true);
});

test('recovery: unlocks only when all three hearts are back, never above three', () => {
  let s = { hearts: 0, locked: true };
  s = applyRecoveryAnswer(s, true); s = applyRecoveryAnswer(s, true);
  assert.equal(s.locked, true);
  s = applyRecoveryAnswer(s, true);
  assert.equal(s.hearts, 3); assert.equal(s.locked, false);
  assert.equal(applyRecoveryAnswer(s, true).hearts, 3);
});

test('fingerprint ignores trailing spaces, CRLF and extra blank lines', () => {
  assert.equal(fingerprint('let a = 1;\n\n\nlet b = 2;  '), fingerprint('let a = 1;\n\nlet b = 2;'));
  assert.equal(fingerprint('let a = 1;\r\nlet b = 2;\r\n'), fingerprint('let a = 1;\nlet b = 2;'));
  assert.equal(fingerprint('\n\nx();\n\n'), fingerprint('x();'));
});

test('fingerprint distinguishes real changes, including indentation and case', () => {
  assert.notEqual(fingerprint('let a = 1;'), fingerprint('let a = 2;'));
  assert.notEqual(fingerprint('if (x) {\n  y();\n}'), fingerprint('if (x) {\ny();\n}'));
  assert.notEqual(fingerprint('tasks'), fingerprint('Tasks'));
});

test('fingerprint is a stable 8-hex-digit string', () => {
  assert.match(fingerprint('const x = 1;'), /^[0-9a-f]{8}$/);
  assert.equal(fingerprint(''), fingerprint('   \n  '));
  assert.equal(normaliseCode('a  \n\n\n\nb'), 'a\n\nb');
});
