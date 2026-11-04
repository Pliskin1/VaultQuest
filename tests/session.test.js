import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSession, recordSubmission, beginRecovery, answerRecovery, finishRecovery } from '../src/learn/session.js';
import { getQuestion } from '../src/learn/recovery.js';
import { fingerprint } from '../src/learn/fingerprint.js';

const BANK = { bank: 'js-2' }; // these scenarios use the To-Do mistake tags ported from the Demo

const submit = (s, code, passed, tags = []) => recordSubmission(s, { fingerprint: fingerprint(code), passed, tags }, 1);
const rightAnswer = s => { const q = getQuestion(s.recovery.bank, s.recovery.questionIds[s.recovery.index]); return q.type === 'mcq' ? q.answer : q.answers[0]; };
const wrongAnswer = s => { const q = getQuestion(s.recovery.bank, s.recovery.questionIds[s.recovery.index]); return q.type === 'mcq' ? (q.answer + 1) % q.options.length : '?'; };

const BOSS = {
  counts: 'function countCompleted(tasks) {\n  return tasks.filter((t) => !t.done).length;\n}',
  assign: 'function countCompleted(tasks) {\n  let n = 0;\n  tasks.forEach((t) => { if (t.done = true) n++; });\n  return n;\n}',
  logs: 'function countCompleted(tasks) {\n  console.log(tasks.filter((t) => t.done).length);\n}'
};

test('a new session has three hearts and nothing recorded', () => {
  assert.deepEqual(newSession(), { hearts: 3, locked: false, failedFingerprints: [], attempts: [], recovery: null });
  assert.notEqual(newSession().attempts, newSession().attempts);
});

test('identical failing code is free and not recorded twice', () => {
  let { session, outcome } = submit(newSession(), BOSS.counts, false, ['counts-unfinished']);
  assert.deepEqual(outcome, { heartLost: true, duplicate: false, hearts: 2, locked: false });
  ({ session, outcome } = submit(session, BOSS.counts + '\n\n', false, ['counts-unfinished']));
  assert.deepEqual(outcome, { heartLost: false, duplicate: true, hearts: 2, locked: false });
  assert.equal(session.attempts.length, 1);
  assert.deepEqual(session.attempts[0], { fingerprint: fingerprint(BOSS.counts), passed: false, tags: ['counts-unfinished'], evidence: {}, failedIds: [], ts: 1 });
});

test('full cycle: lock → recovery from own mistakes → back with fingerprints kept', () => {
  let s = newSession();
  s = submit(s, BOSS.counts, false, ['counts-unfinished']).session;
  s = submit(s, BOSS.assign, false, ['assignment-in-condition']).session;
  const last = submit(s, BOSS.logs, false, ['log-vs-return']);
  s = last.session;
  assert.deepEqual(last.outcome, { heartLost: true, duplicate: false, hearts: 0, locked: true });

  assert.equal(beginRecovery(newSession(), BANK).recovery, null); // only a locked session can recover
  s = beginRecovery(s, BANK);
  assert.deepEqual(s.recovery.questionIds, ['not-operator', 'compare-not-assign', 'return-value']);
  assert.equal(beginRecovery(s, BANK), s); // starting again keeps progress

  let r = answerRecovery(s, wrongAnswer(s));
  assert.equal(r.result.correct, false);
  assert.equal(r.session.hearts, 0); // a wrong answer costs nothing…
  assert.equal(r.session.recovery.index, 0); // …and the same question stays
  assert.equal(r.session.recovery.wrong, 1);
  s = r.session;

  s = answerRecovery(s, rightAnswer(s)).session;
  s = answerRecovery(s, rightAnswer(s)).session;
  assert.equal(s.hearts, 2);
  assert.equal(finishRecovery(s).ok, false); // only with all three hearts back
  r = answerRecovery(s, rightAnswer(s));
  assert.equal(r.result.complete, true);
  assert.equal(answerRecovery(r.session, 1).result, null); // nothing more to answer

  const done = finishRecovery(r.session);
  assert.equal(done.ok, true);
  assert.deepEqual({ hearts: done.session.hearts, locked: done.session.locked, recovery: done.session.recovery }, { hearts: 3, locked: false, recovery: null });
  assert.equal(done.session.attempts.length, 3);

  // Old wrong code is still free after recovery; a new mistake costs a heart again.
  assert.equal(submit(done.session, BOSS.logs, false).outcome.duplicate, true);
  assert.equal(submit(done.session, 'function countCompleted() { return 0; }', false).outcome.hearts, 2);
});

test('a session survives a save/reload (JSON round trip) mid-recovery', () => {
  let s = newSession();
  for (const [code, tag] of [[BOSS.counts, 'counts-unfinished'], [BOSS.assign, 'assignment-in-condition'], [BOSS.logs, 'log-vs-return']]) s = submit(s, code, false, [tag]).session;
  s = beginRecovery(s, BANK);
  s = answerRecovery(s, rightAnswer(s)).session;
  const reloaded = JSON.parse(JSON.stringify(s));
  assert.deepEqual(reloaded, s);
  assert.equal(reloaded.hearts, 1);
  assert.equal(answerRecovery(reloaded, rightAnswer(reloaded)).session.hearts, 2);
});

test('session functions never mutate their input', () => {
  const s = newSession(), before = structuredClone(s);
  submit(s, BOSS.counts, false, ['x']);
  assert.deepEqual(s, before);
  const locked = { ...newSession(), hearts: 0, locked: true, attempts: [{ passed: false, tags: ['syntax-error'] }] }, lb = structuredClone(locked);
  const rec = beginRecovery(locked, BANK);
  answerRecovery(rec, 0); finishRecovery(rec);
  assert.deepEqual(locked, lb);
});
