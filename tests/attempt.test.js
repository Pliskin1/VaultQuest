// The shared vault-attempt engine (learn/attempt.js) — the same rules for JavaScript and Python.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAttempt, answerKey, beginSubmission, settleSubmission, cancelSubmission, endAttempt, isCurrent, whenExhausted } from '../src/learn/attempt.js';
import { migrate, grantReward, rollbackRun, rewardKey } from '../src/learn/progress.js';
import { V1, LIVE_NOW } from './fixtures/profiles.js';

// What a language adapter produces for vault 1 (option index, blank text, code).
const ANSWERS = {
  js: { wrongCode: 'const score = 10;\nscore = 20;\nconsole.log(score);', otherWrong: 'var score = 10;\nscore = 20;\nconsole.log(score);', right: 'let score = 10;\nscore = 20;\nconsole.log(score);', blank: 'let' },
  py: { wrongCode: 'name = "Ana"\nprint("Hello, " + Name)', otherWrong: 'name = "Ana"\nprint("Hello, " + NAME)', right: 'name = "Ana"\nprint("Hello, " + name)', blank: '==' }
};
// Submit synchronously: begin → judge → settle (what the UI does for an option or a blank).
const submit = (a, ch, type, value, passed) => settleSubmission(a, beginSubmission(a), { key: answerKey(a, ch, type, value), passed });
const tick = () => new Promise(r => setImmediate(r));

for (const lang of ['js', 'py']) {
  const X = ANSWERS[lang];

  test(`${lang}: a vault attempt starts with three hearts`, () => {
    const a = newAttempt(lang, 0);
    assert.equal(a.session.hearts, 3); assert.equal(a.session.locked, false); assert.equal(a.over, false);
  });

  test(`${lang}: new wrong −1, identical retry free, different wrong −1, correct free`, () => {
    const a = newAttempt(lang, 0);
    assert.deepEqual(submit(a, 2, 'code', X.wrongCode, false), { heartLost: true, duplicate: false, hearts: 2, locked: false, exhausted: false });
    assert.deepEqual(submit(a, 2, 'code', X.wrongCode + '\n\n  ', false), { heartLost: false, duplicate: true, hearts: 2, locked: false, exhausted: false });
    assert.equal(submit(a, 2, 'code', X.otherWrong, false).hearts, 1);
    assert.deepEqual(submit(a, 2, 'code', X.right, true), { heartLost: false, duplicate: false, hearts: 1, locked: false, exhausted: false });
  });

  test(`${lang}: the same wrong option or blank twice is free; whitespace in a blank doesn't matter, its content does`, () => {
    const a = newAttempt(lang, 0);
    assert.equal(submit(a, 0, 'mcq', 1, false).hearts, 2);
    assert.equal(submit(a, 0, 'mcq', 1, false).duplicate, true);
    assert.equal(submit(a, 1, 'blank', X.blank, false).hearts, 1);
    assert.equal(submit(a, 1, 'blank', `  ${X.blank} `, false).duplicate, true);
    assert.equal(answerKey(a, 1, 'blank', 'a  b'), answerKey(a, 1, 'blank', 'a b'));
    assert.notEqual(answerKey(a, 1, 'blank', '='), answerKey(a, 1, 'blank', '=='));
  });

  test(`${lang}: meaningful code differences are separate attempts`, () => {
    const a = newAttempt(lang, 0), key = c => answerKey(a, 2, 'code', c);
    assert.notEqual(key('if x:\n    y()'), key('if x:\ny()')); // indentation
    assert.notEqual(key(X.wrongCode), key(X.wrongCode.toUpperCase())); // case
    assert.notEqual(key('print("a")'), key("print('a')")); // quotes
    assert.equal(key('x = 1   \n\n\n\ny = 2'), key('x = 1\n\ny = 2')); // trailing spaces / extra blank lines
  });

  test(`${lang}: the same answer in another challenge, vault or language is a new attempt`, () => {
    const a = newAttempt(lang, 0), b = newAttempt(lang, 1), other = newAttempt(lang === 'js' ? 'py' : 'js', 0);
    submit(a, 0, 'mcq', 1, false);
    assert.equal(submit(a, 1, 'mcq', 1, false).duplicate, false); // other challenge
    assert.equal(submit(b, 0, 'mcq', 1, false).duplicate, false); // other vault
    assert.equal(other.session.hearts, 3); // other language: own session
    assert.notEqual(answerKey(a, 0, 'mcq', 1), answerKey(other, 0, 'mcq', 1));
    assert.notEqual(answerKey(a, 0, 'mcq', 1), answerKey(b, 0, 'mcq', 1));
  });

  test(`${lang}: hearts never go below zero; zero hearts is reported exactly once, then nothing is accepted`, () => {
    const a = newAttempt(lang, 0);
    const outs = [1, 2, 3].map(k => submit(a, 0, 'mcq', k, false));
    assert.deepEqual(outs.map(o => o.hearts), [2, 1, 0]);
    assert.deepEqual(outs.map(o => o.exhausted), [false, false, true]);
    assert.equal(beginSubmission(a), null); // locked
    assert.equal(a.session.hearts, 0);
  });

  test(`${lang}: double-clicks — a second submission can't start while one is being judged`, () => {
    const a = newAttempt(lang, 0), t1 = beginSubmission(a);
    assert.ok(t1); assert.equal(beginSubmission(a), null);
    settleSubmission(a, t1, { key: answerKey(a, 2, 'code', X.wrongCode), passed: false });
    assert.ok(beginSubmission(a)); // free again once judged
    const b = newAttempt(lang, 0), t = beginSubmission(b);
    cancelSubmission(b, t);
    assert.ok(beginSubmission(b)); // a cancelled run also frees it
  });

  test(`${lang}: one submission is judged once — settling its token again does nothing`, () => {
    const a = newAttempt(lang, 0);
    for (const k of [1, 2]) submit(a, 0, 'mcq', k, false);
    const t = beginSubmission(a), key = answerKey(a, 0, 'mcq', 3);
    assert.equal(settleSubmission(a, t, { key, passed: false }).exhausted, true);
    assert.equal(settleSubmission(a, t, { key, passed: false }), null); // no second zero-hearts report
    assert.equal(settleSubmission(a, t, { key: 'other', passed: false }), null);
    assert.equal(a.session.hearts, 0); assert.equal(a.session.attempts.length, 3);
  });

  test(`${lang}: a stale code run (attempt left or restarted) can't change the new attempt`, async () => {
    let current = newAttempt(lang, 0);
    const old = current, t = beginSubmission(old); // code is running…
    endAttempt(old); current = newAttempt(lang, 0); // …player restarts the vault
    await tick();
    assert.equal(settleSubmission(current, t, { key: answerKey(current, 2, 'code', X.wrongCode), passed: false }), null);
    assert.equal(settleSubmission(old, t, { key: 'k', passed: false }), null);
    assert.equal(current.session.hearts, 3); assert.equal(current.session.attempts.length, 0);
    assert.equal(isCurrent(current, t), false);
  });

  test(`${lang}: rapid wrong answers (replies still typing) cause exactly one reset — Phase 2 race regression`, async () => {
    let current = newAttempt(lang, 0), resets = 0;
    const replies = [];
    // Three wrong answers before any mentor reply has finished; each reply's continuation checks `exhausted`.
    for (const k of [1, 2, 3]) {
      const t = beginSubmission(current), out = settleSubmission(current, t, { key: answerKey(current, 1, 'blank', 'w' + k), passed: false });
      replies.push(tick().then(() => out.exhausted && whenExhausted(() => current, t, { announce: tick, pause: tick, next: () => { resets++; current = newAttempt(lang, 0); } })));
    }
    await Promise.all(replies);
    assert.equal(resets, 1);
    assert.equal(current.session.hearts, 3);
  });

  test(`${lang}: leaving the vault during the "Out of hearts" message cancels the reset`, async () => {
    let current = newAttempt(lang, 0);
    for (const k of [1, 2]) submit(current, 0, 'mcq', k, false);
    const t = beginSubmission(current), out = settleSubmission(current, t, { key: answerKey(current, 0, 'mcq', 3), passed: false });
    assert.equal(out.exhausted, true);
    let ran = false;
    const pending = whenExhausted(() => current, t, { announce: tick, pause: async () => { endAttempt(current); current = null; await tick(); }, next: () => { ran = true; } });
    assert.equal(await pending, false); // player went back to the map
    assert.equal(ran, false);
    // …and also when they already opened another vault (or language) meanwhile.
    let cur2 = newAttempt(lang, 0);
    for (const k of [1, 2, 3]) submit(cur2, 0, 'mcq', k, false);
    const old = cur2;
    const p2 = whenExhausted(() => cur2, { id: old.id }, { announce: tick, pause: async () => { endAttempt(old); cur2 = newAttempt(lang === 'js' ? 'py' : 'js', 2); }, next: () => { ran = true; } });
    assert.equal(await p2, false); assert.equal(ran, false);
    assert.equal(cur2.session.hearts, 3);
    // Left before the last reply even finished: no "Out of hearts" announcement either.
    let cur3 = newAttempt(lang, 0), announced = false;
    for (const k of [1, 2, 3]) submit(cur3, 0, 'mcq', k, false);
    const t3 = { id: cur3.id };
    endAttempt(cur3); cur3 = null;
    assert.equal(await whenExhausted(() => cur3, t3, { announce: () => { announced = true; }, pause: tick, next: () => { ran = true; } }), false);
    assert.equal(announced, false); assert.equal(ran, false);
  });

  test(`${lang}: zero-hearts reset takes back only this attempt's XP; history survives; replays never re-pay`, async () => {
    const cur = `${lang}-1`, s = migrate(lang === 'py' ? V1.pyPartial : V1.jsOne, LIVE_NOW); // vault 1 completed long ago
    let current = newAttempt(lang, 2);
    const xp0 = s.xp, history = structuredClone(s.awarded);
    // Correct on challenge 0 (pays), then three wrong answers on challenge 1.
    submit(current, 0, 'mcq', 0, true); grantReward(s, rewardKey(cur, 2, 0), 50, current.run);
    let last;
    for (const v of ['a', 'b', 'c']) { const t = beginSubmission(current); last = { t, out: settleSubmission(current, t, { key: answerKey(current, 1, 'blank', v), passed: false }) }; }
    await whenExhausted(() => current, last.t, { announce: tick, pause: tick, next: () => { rollbackRun(s, current.run); endAttempt(current); current = newAttempt(lang, 2); } });
    assert.equal(s.xp, xp0); // only the +50 from this attempt was taken back
    assert.deepEqual(s.awarded, history); // older rewards untouched
    // Same challenge again in the new attempt: pays once, with three fresh hearts.
    assert.equal(current.session.hearts, 3);
    assert.equal(submit(current, 0, 'mcq', 0, true).heartLost, false);
    assert.equal(grantReward(s, rewardKey(cur, 2, 0), 50, current.run), 50);
    assert.equal(grantReward(s, rewardKey(cur, 2, 0), 50, current.run), 0);
    // A previously completed vault pays nothing in any attempt.
    assert.equal(grantReward(s, rewardKey(cur, 0, 0), 50, newAttempt(lang, 0).run), 0);
  });

  test(`${lang}: reloading mid-attempt keeps earned XP, never pays it twice, and starts a fresh attempt`, () => {
    const cur = `${lang}-1`, s = migrate({ ...V1.ancient, lang }, LIVE_NOW), a = newAttempt(lang, 0);
    submit(a, 0, 'mcq', 0, true); grantReward(s, rewardKey(cur, 0, 0), 50, a.run);
    submit(a, 1, 'blank', 'x', false);
    const reloaded = migrate(JSON.parse(JSON.stringify(s)), LIVE_NOW), b = newAttempt(lang, 0); // page reload
    assert.equal(reloaded.xp, 140);
    assert.equal(grantReward(reloaded, rewardKey(cur, 0, 0), 50, b.run), 0);
    assert.equal(b.session.hearts, 3); assert.deepEqual(b.session.failedFingerprints, []);
    assert.notEqual(b.id, a.id);
  });
}

test('a reset in one language leaves an attempt in the other language untouched', async () => {
  const js = newAttempt('js', 0); let py = newAttempt('py', 0);
  submit(js, 0, 'mcq', 1, false);
  for (const k of [1, 2, 3]) submit(py, 0, 'mcq', k, false);
  await whenExhausted(() => py, { id: py.id }, { announce: tick, pause: tick, next: () => { endAttempt(py); py = newAttempt('py', 0); } });
  assert.equal(js.session.hearts, 2); assert.equal(js.over, false);
  assert.equal(py.session.hearts, 3);
});

test('attempts get unique ids; ending one is idempotent and frees nothing else', () => {
  const a = newAttempt('js', 0), b = newAttempt('js', 0);
  assert.notEqual(a.id, b.id);
  endAttempt(a); endAttempt(a); endAttempt(null);
  assert.equal(beginSubmission(a), null);
  assert.ok(beginSubmission(b));
});
