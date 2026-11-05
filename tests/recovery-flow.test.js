// Syntax Recovery and saved attempts (learn/attempt.js) — one engine, run for both languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newAttempt, attemptKey, answerKey, beginSubmission, settleSubmission, endAttempt, whenExhausted,
  inRecovery, recoveryDone, currentQuestion, startRecovery, answerRecoveryQuestion, finishRecovery, toSave, fromSave
} from '../src/learn/attempt.js';
import { diagnose } from '../src/learn/diagnose.js';
import { migrate, grantReward, rewardKey } from '../src/learn/progress.js';
import { V1, LIVE_NOW } from './fixtures/profiles.js';
import { LANGS } from '../src/content/languages.js';
import { getQuestion } from '../src/learn/recovery.js';

const LIVE = { py: 'py-2', js: 'js-2' }; // World 1
const inOwnBank = (lang, id) => !!getQuestion(lang + '-2', id) && !getQuestion((lang === 'py' ? 'js' : 'py') + '-2', id);

const CH = 3; // challenges per vault in World 1
// Real wrong answers from Vault 1 of each World 1 curriculum (challenge index, type, answer, runtime error).
const WRONG = {
  py: [[0, 'mcq', 1], [1, 'blank', '"False"'], [2, 'code', 'task = {\n    "title": Read a book,\n    "done": False\n}\n', 'SyntaxError: invalid syntax. Perhaps you forgot a comma?'], [1, 'blank', 'True']],
  js: [[0, 'mcq', 1], [1, 'blank', '"false"'], [2, 'code', 'const task = {\n  title: Read a book,\n  done: false\n};\n', "SyntaxError: Unexpected identifier 'a'"], [1, 'blank', 'true']]
};
function submitWrong(a, [ci, type, answer, error]) {
  const t = beginSubmission(a);
  return settleSubmission(a, t, { key: answerKey(a, ci, type, answer), passed: false, ...diagnose({ lang: a.lang, challenge: LANGS[a.lang].levels[a.vault].ch[ci], type, answer, error }) });
}
const right = a => { const q = currentQuestion(a); return q.type === 'mcq' ? q.answer : q.answers[0]; };
const wrongAns = a => { const q = currentQuestion(a); return q.type === 'mcq' ? (q.answer + 1) % q.options.length : '??'; };
const roundTrip = (a, lang) => fromSave(JSON.parse(JSON.stringify(toSave(a))), { lang, vault: a.vault, curriculum: a.curriculum, challenges: CH });
function lockedAttempt(lang) {
  const a = newAttempt(lang, 0, lang + '-2');
  a.view = { ...a.view, ci: 2, mistakes: 3, drafts: { 2: lang === 'py' ? 'print("half-fixed")' : 'console.log("half-fixed");' } };
  const outs = WRONG[lang].slice(0, 3).map(w => submitWrong(a, w));
  assert.deepEqual(outs.map(o => o.hearts), [2, 1, 0]);
  assert.equal(outs[2].exhausted, true);
  return a;
}

for (const lang of ['py', 'js']) {
  test(`${lang}: zero hearts locks the attempt; Recovery picks three questions from this language's own mistakes`, () => {
    const a = lockedAttempt(lang);
    assert.equal(inRecovery(a), true); assert.equal(beginSubmission(a), null); // no submissions while locked
    const r = startRecovery(a);
    assert.equal(r.bank, lang + '-2'); assert.equal(r.questionIds.length, 3);
    assert.ok(r.questionIds.every(id => inOwnBank(lang, id)), r.questionIds.join());
    assert.ok(r.targeted.length >= 2, 'mistakes were diagnosed'); // all three were diagnosable
    assert.deepEqual(startRecovery(a), r); // starting again keeps the same questions
    assert.equal(startRecovery(newAttempt(lang, 0)), null); // only a locked attempt recovers
  });

  test(`${lang}: wrong Recovery answers cost nothing; each correct answer restores exactly one heart`, () => {
    const a = lockedAttempt(lang); startRecovery(a);
    const profile = migrate(V1.jsShipped, LIVE_NOW), xp = profile.xp, awarded = structuredClone(profile.awarded);
    for (let q = 0; q < 3; q++) {
      const id = currentQuestion(a).id, before = a.session.hearts;
      const w = answerRecoveryQuestion(a, id, wrongAns(a));
      assert.equal(w.correct, false); assert.equal(w.hearts, before); assert.equal(currentQuestion(a).id, id); // same question again
      const c = answerRecoveryQuestion(a, id, right(a));
      assert.equal(c.correct, true); assert.equal(c.hearts, before + 1);
      assert.equal(c.complete, q === 2);
    }
    assert.equal(a.session.recovery.wrong, 3);
    assert.equal(recoveryDone(a), true); assert.equal(currentQuestion(a), null);
    assert.equal(profile.xp, xp); assert.deepEqual(profile.awarded, awarded); // Recovery never touches XP or rewards
  });

  test(`${lang}: a double-click can't answer the next question; stale or finished attempts accept nothing`, () => {
    const a = lockedAttempt(lang); startRecovery(a);
    const first = currentQuestion(a).id;
    assert.equal(answerRecoveryQuestion(a, first, right(a)).correct, true);
    assert.equal(answerRecoveryQuestion(a, first, 0), null); // second click of the same button, after the next question appeared
    assert.equal(a.session.hearts, 1); assert.equal(a.session.recovery.index, 1);
    endAttempt(a);
    assert.equal(answerRecoveryQuestion(a, currentQuestion(a).id, right(a)), null);
    assert.equal(finishRecovery(a), false);
  });

  test(`${lang}: finishing returns to the same challenge with three hearts, code, answers and history kept`, () => {
    const a = lockedAttempt(lang), view = structuredClone(a.view), failed = [...a.session.failedFingerprints], history = structuredClone(a.session.attempts);
    startRecovery(a);
    assert.equal(finishRecovery(a), false); // not before all three are answered
    for (let q = 0; q < 3; q++) answerRecoveryQuestion(a, currentQuestion(a).id, right(a));
    assert.equal(finishRecovery(a), true);
    assert.deepEqual({ hearts: a.session.hearts, locked: a.session.locked, recovery: a.session.recovery }, { hearts: 3, locked: false, recovery: null });
    assert.deepEqual(a.view, view); // challenge index, mistakes, drafts untouched
    assert.deepEqual(a.session.failedFingerprints, failed); assert.deepEqual(a.session.attempts, history);
    // An answer that already failed is still free after Recovery; a new one costs a heart.
    assert.equal(submitWrong(a, WRONG[lang][2]).duplicate, true);
    assert.equal(submitWrong(a, WRONG[lang][3]).hearts, 2);
  });

  test(`${lang}: Recovery works again after losing all hearts a second time`, () => {
    const a = lockedAttempt(lang); startRecovery(a);
    for (let q = 0; q < 3; q++) answerRecoveryQuestion(a, currentQuestion(a).id, right(a));
    finishRecovery(a);
    const outs = [WRONG[lang][3], [0, 'mcq', 3], [1, 'blank', 'zzz']].map(w => submitWrong(a, w));
    assert.deepEqual(outs.map(o => [o.hearts, o.exhausted]), [[2, false], [1, false], [0, true]]); // zero hearts reported again
    const r = startRecovery(a);
    assert.equal(r.index, 0); assert.equal(r.questionIds.length, 3);
    for (let q = 0; q < 3; q++) answerRecoveryQuestion(a, currentQuestion(a).id, right(a));
    assert.equal(finishRecovery(a), true); assert.equal(a.session.hearts, 3);
  });

  test(`${lang}: the same exhausted event can't open Recovery twice (rapid wrong answers)`, async () => {
    let current = lockedAttempt(lang), opened = 0;
    const tok = { id: current.id }, tick = () => new Promise(r => setImmediate(r));
    await Promise.all([1, 2, 3].map(() => whenExhausted(() => current, tok, { announce: tick, pause: tick, next: () => { opened++; endAttempt(current); current = roundTrip(current, lang); } })));
    assert.equal(opened, 1);
  });

  // ── saving and restoring ──
  test(`${lang}: a refresh with one heart keeps one heart, the challenge, drafts and the answers already tried`, () => {
    const a = newAttempt(lang, 0, lang + '-2');
    submitWrong(a, WRONG[lang][0]); submitWrong(a, WRONG[lang][1]);
    a.view = { ...a.view, ci: 1, combo: 0, mistakes: 2, hints: 1, hintIdx: 1, chMistake: true, drafts: { 1: 'typed' } };
    const b = roundTrip(a, lang);
    assert.notEqual(b.id, a.id); assert.equal(b.over, false);
    assert.equal(b.session.hearts, 1); assert.equal(b.session.locked, false);
    assert.deepEqual(b.view, a.view); assert.deepEqual(b.session.failedFingerprints, a.session.failedFingerprints);
    assert.equal(submitWrong(b, WRONG[lang][1]).duplicate, true); // still remembered after the refresh
  });

  test(`${lang}: a refresh with zero hearts (before or during Recovery) lands back in Recovery, progress kept`, () => {
    const a = lockedAttempt(lang);
    const b = roundTrip(a, lang); // saved the moment hearts hit zero, before questions were picked
    assert.equal(inRecovery(b), true); assert.equal(b.session.hearts, 0); assert.equal(b.exhausted, true);
    assert.deepEqual(startRecovery(b).questionIds, startRecovery(a).questionIds); // same mistakes → same questions
    answerRecoveryQuestion(a, currentQuestion(a).id, wrongAns(a));
    answerRecoveryQuestion(a, currentQuestion(a).id, right(a));
    const c = roundTrip(a, lang); // mid-Recovery
    assert.deepEqual(c.session.recovery, a.session.recovery); assert.equal(c.session.hearts, 1);
    for (let q = 0; q < 2; q++) answerRecoveryQuestion(c, currentQuestion(c).id, right(c));
    const d = roundTrip(c, lang); // all answered, not yet returned
    assert.equal(recoveryDone(d), true); assert.equal(d.session.hearts, 3); assert.equal(inRecovery(d), true);
    assert.equal(finishRecovery(d), true); assert.equal(d.view.drafts[2], a.view.drafts[2]);
  });

  test(`${lang}: damaged saves are repaired without ever unlocking a locked attempt`, () => {
    const a = lockedAttempt(lang); startRecovery(a);
    answerRecoveryQuestion(a, currentQuestion(a).id, right(a));
    const save = JSON.parse(JSON.stringify(toSave(a))), opts = { lang, vault: 0, curriculum: lang + '-2', challenges: CH };
    const tampered = s => fromSave(s, opts);
    assert.equal(tampered({ ...save, session: { ...save.session, hearts: 3 } }).session.hearts, 1); // hearts = questions answered
    assert.equal(tampered({ ...save, session: { ...save.session, locked: false, hearts: 0 } }).session.locked, true);
    const noRec = tampered({ ...save, session: { ...save.session, recovery: { bank: lang === 'py' ? 'js-1' : 'py-1', questionIds: ['x'] } } });
    assert.equal(noRec.session.recovery, null); assert.equal(noRec.session.hearts, 0); assert.equal(inRecovery(noRec), true); // picked again
    assert.equal(tampered({ ...save, session: { ...save.session, recovery: { ...save.session.recovery, questionIds: ['nope', 'no', 'n'] } } }).session.recovery, null);
    const junk = tampered({ ...save, session: 'garbage', view: { ci: 99, drafts: { 0: 5, 1: 'ok', x: 'no' } }, run: 7 });
    assert.deepEqual({ hearts: junk.session.hearts, locked: junk.session.locked, ci: junk.view.ci, drafts: junk.view.drafts, paid: junk.run.paid }, { hearts: 3, locked: false, ci: 0, drafts: { 1: 'ok' }, paid: [] });
    for (const bad of [null, 'x', [], { ...save, lang: lang === 'py' ? 'js' : 'py' }, { ...save, vault: 1 }, { ...save, curriculum: lang + '-1' }]) assert.equal(tampered(bad), null);
  });

  test(`${lang}: attempts live in the profile save, keyed per curriculum, and survive reloads and migration`, () => {
    const profile = migrate(V1.proPy, LIVE), a = lockedAttempt(lang);
    profile.attempts[attemptKey(a.curriculum, 0)] = toSave(a);
    const reloaded = migrate(JSON.parse(JSON.stringify(profile)), LIVE);
    assert.deepEqual(reloaded.attempts, JSON.parse(JSON.stringify(profile.attempts)));
    const other = lang === 'py' ? 'js-2' : 'py-2';
    assert.equal(fromSave(reloaded.attempts[attemptKey(other, 0)], { lang: other.slice(0, 2), vault: 0, curriculum: other, challenges: CH }), null); // other language: nothing
    assert.equal(inRecovery(fromSave(reloaded.attempts[attemptKey(a.curriculum, 0)], { lang, vault: 0, curriculum: a.curriculum, challenges: CH })), true);
  });

  test(`${lang}: XP earned before Recovery stays; replaying solved challenges never pays again after a reload`, () => {
    const profile = migrate({ ...V1.ancient, lang }, LIVE), a = newAttempt(lang, 1, lang + '-2');
    assert.equal(grantReward(profile, rewardKey(a.curriculum, 1, 0), 50, a.run), 50);
    for (const w of [[1, 'blank', 'a'], [1, 'blank', 'b'], [1, 'blank', 'c']]) submitWrong(a, w);
    startRecovery(a); for (let q = 0; q < 3; q++) answerRecoveryQuestion(a, currentQuestion(a).id, right(a)); finishRecovery(a);
    const after = migrate(JSON.parse(JSON.stringify(profile)), LIVE), b = roundTrip(a, lang);
    assert.equal(after.xp, 140);
    assert.equal(grantReward(after, rewardKey(b.curriculum, 1, 0), 50, b.run), 0);
    assert.deepEqual(b.run.paid, [[rewardKey(a.curriculum, 1, 0), 50]]);
  });
}

test('switching language: a locked JavaScript attempt never affects a Python one, and vice versa', () => {
  const js = lockedAttempt('js'), py = newAttempt('py', 0, 'py-2');
  startRecovery(js);
  assert.equal(py.session.hearts, 3); assert.equal(inRecovery(py), false);
  assert.notEqual(attemptKey(js.curriculum, 0), attemptKey(py.curriculum, 0));
  const pyLocked = lockedAttempt('py'); startRecovery(pyLocked);
  assert.ok(pyLocked.session.recovery.questionIds.every(id => inOwnBank('py', id)));
  assert.ok(js.session.recovery.questionIds.every(id => inOwnBank('js', id)));
});

test('curriculum switch: an unfinished (even locked) js-1 attempt is archived with the old progress, never resumed', () => {
  const profile = migrate(V1.jsShipped, LIVE_NOW), old = { ...JSON.parse(JSON.stringify(toSave(lockedAttempt('js')))), curriculum: 'js-1' };
  profile.attempts['js-1:0'] = old; profile.attempts['py-1:2'] = { keep: true };
  const next = migrate(profile, { py: 'py-1', js: 'js-2' });
  assert.deepEqual(Object.keys(next.attempts), ['py-1:2']);
  assert.deepEqual(next.legacy['js-1'].attempts['js-1:0'], old);
  assert.equal(fromSave(old, { lang: 'js', vault: 0, curriculum: 'js-2', challenges: CH }), null); // can't be loaded into World 1
});
