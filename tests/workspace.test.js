// The PRO Workspace rules (learn/workspace.js on learn/attempt.js) — identical for both languages: which runs
// cost hearts, repeats, partial progress, milestones, SUBMIT, hints, the saved conversation, Syntax Recovery
// with the project's own questions, refresh/restore and damaged saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newAttempt, beginSubmission, endAttempt, toSave, fromSave, startRecovery, currentQuestion, answerRecoveryQuestion, finishRecovery, inRecovery, newWorkspace
} from '../src/learn/attempt.js';
import { judgeRun, settleRun, runTags, canSubmit, nextHint, logChat, markShipped, reviewPayload, scriptedFeedback, MAX_CHAT } from '../src/learn/workspace.js';
import { getQuestion } from '../src/learn/recovery.js';
import { LANGS } from '../src/content/languages.js';

const P = 6; // the project's level index in both languages
const lvOf = lang => LANGS[lang].levels[P];
const opts = lang => ({ lang, vault: P, curriculum: lang + '-2', challenges: 1, workspace: 4 });
const fresh = lang => newAttempt(lang, P, lang + '-2', { workspace: 4 });
const roundTrip = (a, lang) => fromSave(JSON.parse(JSON.stringify(toSave(a))), opts(lang));
// A synthetic run: `pass(id)` decides each check; error/timeout optional.
const runOf = (lang, pass, extra = {}) => ({ checks: lvOf(lang).checks.map(c => ({ id: c.id, ms: c.ms, pass: pass(c), msg: pass(c) ? '' : 'failed', tags: pass(c) ? [] : ['tag-' + c.ms] })), error: null, timeout: false, ...extra });
const upTo = (lang, k, extra = []) => runOf(lang, c => c.ms < k || extra.includes(c.id));
function submit(a, lang, code, run) {
  const t = beginSubmission(a); if (!t) return null;
  const judged = judgeRun(a.workspace, run, 4);
  return { judged, out: settleRun(a, t, { code, run, judged, tags: runTags(lang, run, judged) }) };
}

for (const lang of ['js', 'py']) {
  const lv = lvOf(lang), first = k => lv.checks.find(c => c.ms === k).id;

  test(`${lang}: clearing a milestone is progress — no heart lost, milestone stays cleared`, () => {
    const a = fresh(lang);
    const { judged, out } = submit(a, lang, 'v1', upTo(lang, 1));
    assert.deepEqual(judged.newly, [0]); assert.equal(judged.focus, 1);
    assert.equal(out.heartLost, false); assert.equal(a.session.hearts, 3);
    assert.deepEqual(a.workspace.cleared, [true, false, false, false]);
    submit(a, lang, 'v2', upTo(lang, 0)); // breaks milestone 1 again
    assert.deepEqual(a.workspace.cleared, [true, false, false, false]); // cleared once = paid once, stays ticked
  });

  test(`${lang}: a run with no progress costs a heart; the same code again is free (also after a pass)`, () => {
    const a = fresh(lang);
    assert.equal(submit(a, lang, 'bad', upTo(lang, 0)).out.heartLost, true);
    assert.equal(a.session.hearts, 2);
    const again = submit(a, lang, 'bad\n\n', upTo(lang, 0)).out; // trailing whitespace = same code
    assert.equal(again.duplicate, true); assert.equal(again.heartLost, false); assert.equal(a.session.hearts, 2);
    submit(a, lang, 'good', upTo(lang, 1));
    const rerun = submit(a, lang, 'good', upTo(lang, 1)).out;
    assert.equal(rerun.duplicate, true); assert.equal(a.session.hearts, 2);
    assert.equal(a.session.attempts.length, 2); // repeats are never recorded twice
  });

  test(`${lang}: running the untouched starter is not an attempt — no heart, nothing recorded`, () => {
    const a = fresh(lang), t = beginSubmission(a), run = upTo(lang, 0), judged = judgeRun(a.workspace, run, 4);
    const out = settleRun(a, t, { code: lv.starter + '\n\n', run, judged, starter: lv.starter });
    assert.equal(out.starter, true); assert.equal(out.heartLost, false); assert.equal(out.duplicate, false);
    assert.equal(a.session.hearts, 3); assert.equal(a.session.attempts.length, 0); assert.equal(a.workspace.runs, 0);
    assert.equal(beginSubmission(a) !== null, true); // the run is released
  });

  test(`${lang}: passing more checks of the current milestone than ever before is progress too`, () => {
    const a = fresh(lang), m1 = lv.checks.filter(c => c.ms === 0).map(c => c.id);
    assert.equal(submit(a, lang, 'one', runOf(lang, c => c.id === m1[0])).out.heartLost, false); // 1 > 0
    assert.equal(submit(a, lang, 'other one', runOf(lang, c => c.id === m1[1])).out.heartLost, true); // still 1
    assert.equal(submit(a, lang, 'two', runOf(lang, c => c.id === m1[0] || c.id === m1[1])).out.heartLost, false);
    assert.deepEqual(a.workspace.best, [2, 0, 0, 0]);
  });

  test(`${lang}: errors and timeouts are failed runs and carry their mistake tags`, () => {
    const a = fresh(lang);
    const e = submit(a, lang, 'syntax', runOf(lang, () => false, { error: { name: 'SyntaxError', message: 'x', line: 2, kind: 'syntax' } }));
    assert.equal(e.out.heartLost, true); assert.equal(a.workspace.error.line, 2);
    assert.ok(a.session.attempts[0].tags.includes('syntax-error'));
    const t = submit(a, lang, 'loop', runOf(lang, () => false, { timeout: true }));
    assert.ok(a.session.attempts[1].tags.includes('loop-timeout')); assert.equal(t.out.hearts, 1); assert.equal(a.workspace.timeout, true);
  });

  test(`${lang}: rapid RUN clicks are one run; a run that ends after leaving is ignored`, () => {
    const a = fresh(lang), t = beginSubmission(a);
    assert.equal(beginSubmission(a), null); assert.equal(beginSubmission(a), null);
    const run = upTo(lang, 0), judged = judgeRun(a.workspace, run, 4);
    endAttempt(a); // the student went back to the map while the checks ran
    assert.equal(settleRun(a, t, { code: 'x', run, judged }), null);
    assert.equal(a.session.hearts, 3); assert.equal(a.workspace.runs, 0);
  });

  test(`${lang}: SUBMIT only for the exact code that passed everything`, () => {
    const a = fresh(lang);
    submit(a, lang, 'almost', runOf(lang, c => c.id !== first(3)));
    assert.equal(canSubmit(a, 'almost'), false);
    const { judged } = submit(a, lang, 'done', runOf(lang, () => true));
    assert.equal(judged.allPass, true); assert.deepEqual(a.workspace.cleared, [true, true, true, true]);
    assert.equal(canSubmit(a, 'done'), true); assert.equal(canSubmit(a, 'done\n'), true); assert.equal(canSubmit(a, 'done // edited'), false);
    // after everything is cleared, breaking it again costs a heart (and closes SUBMIT)
    assert.equal(submit(a, lang, 'broken', runOf(lang, c => c.ms !== 2)).out.heartLost, true);
    assert.equal(canSubmit(a, 'done'), false);
  });

  test(`${lang}: three failed runs → Recovery with the project's own questions, then back with everything intact`, () => {
    const a = fresh(lang);
    submit(a, lang, 'ok', upTo(lang, 1));
    a.view = { ...a.view, drafts: { 0: 'my code' } };
    logChat(a, { w: 'u', text: 'why?' }); logChat(a, { w: 'm', text: 'Which line…?', label: 'MENTOR' });
    const tags = lang === 'js' ? ['add-replaces', 'input-not-cleared', 'count-stale'] : ['compare-direction', 'missing-return', 'counts-all-guesses'];
    const outs = tags.map((tag, k) => { const run = runOf(lang, c => c.ms < 1); run.checks.find(c => c.ms === 1).tags = [tag]; return submit(a, lang, 'bad ' + k, run).out; });
    assert.deepEqual(outs.map(o => o.hearts), [2, 1, 0]); assert.deepEqual(outs.map(o => o.exhausted), [false, false, true]);
    assert.equal(beginSubmission(a), null); // locked: nothing runs until Recovery is done
    const r = startRecovery(a);
    assert.equal(r.bank, lang + '-2');
    assert.ok(r.targeted.length >= 2, r.targeted.join());
    assert.ok(r.questionIds.every(id => getQuestion(lang + '-2', id)?.vault <= P));
    const ws = structuredClone(a.workspace), view = structuredClone(a.view);
    const mid = roundTrip(a, lang); // refresh during Recovery
    assert.equal(inRecovery(mid), true); assert.equal(mid.session.hearts, 0); assert.deepEqual(mid.workspace, ws);
    for (let q = 0; q < 3; q++) { const qq = currentQuestion(mid); answerRecoveryQuestion(mid, qq.id, qq.type === 'mcq' ? qq.answer : qq.answers[0]); }
    assert.equal(finishRecovery(mid), true);
    assert.equal(mid.session.hearts, 3); assert.deepEqual(mid.workspace, ws); assert.deepEqual(mid.view, view);
    assert.equal(submit(mid, lang, 'bad 0', upTo(lang, 1)).out.duplicate, true); // old failed code stays free
  });

  test(`${lang}: hints are free, at most three per milestone, and saved`, () => {
    const a = fresh(lang), hints = lv.ms[0].hints;
    assert.equal(hints.length, 3);
    const got = [nextHint(a, 0, hints), nextHint(a, 0, hints), nextHint(a, 0, hints), nextHint(a, 0, hints)];
    assert.deepEqual(got.map(h => h?.level ?? null), [1, 2, 3, null]);
    assert.equal(a.session.hearts, 3); assert.deepEqual(roundTrip(a, lang).workspace.hints, [3, 0, 0, 0]);
  });

  test(`${lang}: code, milestones, results and the conversation survive a refresh`, () => {
    const a = fresh(lang);
    a.view = { ...a.view, drafts: { 0: 'def x' } };
    submit(a, lang, 'v', runOf(lang, c => c.ms === 0, { output: '> guess 1   Too low' }));
    logChat(a, { w: 'm', text: '**Show** ✓', label: 'CODE REVIEW', kind: 'good' });
    const b = roundTrip(a, lang);
    assert.deepEqual(b.workspace, a.workspace); assert.equal(b.view.drafts[0], 'def x');
    assert.deepEqual(b.session, a.session);
  });

  test(`${lang}: a damaged save is repaired conservatively`, () => {
    const a = fresh(lang);
    for (let k = 0; k < 3; k++) submit(a, lang, 'bad' + k, upTo(lang, 0));
    const raw = JSON.parse(JSON.stringify(toSave(a)));
    raw.session.hearts = 3; // forged hearts on a locked attempt
    raw.workspace = { cleared: 'yes', best: [99, -1], hints: [9], chat: [{ w: 'm', text: 5 }, { w: 'x', text: 'ok', label: 'L'.repeat(99) }], results: 'junk', passKey: 3 };
    const b = fromSave(raw, opts(lang));
    assert.equal(b.session.locked, true); assert.equal(b.session.hearts, 0);
    assert.deepEqual(b.workspace.cleared, [false, false, false, false]); assert.deepEqual(b.workspace.best, [99, 0, 0, 0]);
    assert.deepEqual(b.workspace.hints, [0, 0, 0, 0]); assert.deepEqual(b.workspace.results, []); assert.equal(b.workspace.passKey, null);
    assert.deepEqual(b.workspace.chat, [{ w: 'm', text: 'ok', label: 'L'.repeat(40) }]);
    assert.deepEqual(fromSave({ ...raw, workspace: undefined }, opts(lang)).workspace, newWorkspace(4));
    assert.equal(fromSave(raw, { ...opts(lang), curriculum: lang + '-1' }), null); // other curriculum: not this attempt
  });

  test(`${lang}: the conversation keeps the last ${MAX_CHAT} messages; shipping is remembered`, () => {
    const a = fresh(lang);
    for (let k = 0; k < 60; k++) logChat(a, { w: k % 2 ? 'm' : 'u', text: 'm' + k });
    assert.equal(a.workspace.chat.length, MAX_CHAT); assert.equal(a.workspace.chat.at(-1).text, 'm59');
    markShipped(a); assert.equal(roundTrip(a, lang).workspace.shipped, true);
  });

  test(`${lang}: what the mentor gets — focus milestone, failing checks, error — and the scripted question`, () => {
    const a = fresh(lang), run = { ...upTo(lang, 1), error: null };
    const c = run.checks.find(x => x.ms === 1); c.expected = 'A'; c.actual = 'B';
    const judged = judgeRun(a.workspace, run, 4);
    const p = reviewPayload({ lang, lv, judged, run, code: 'code', a });
    assert.equal(p.milestone.n, 2); assert.equal(p.milestone.name, lv.ms[1].n); assert.ok(p.failing.some(f => f.expected === 'A' && f.actual === 'B'));
    const text = scriptedFeedback({ lv, judged, run, errorAsk: lv.errorAsk });
    assert.ok(text.trim().endsWith('?'), text); assert.match(text, /Expected A, got B/);
    const again = scriptedFeedback({ lv, judged, run, errorAsk: lv.errorAsk, again: true });
    assert.notEqual(again, text); // a second miss gets a more specific question
    const err = scriptedFeedback({ lv, judged, run: { ...run, error: { name: 'SyntaxError', message: 'bad', line: 3, kind: 'syntax' } }, errorAsk: lv.errorAsk });
    assert.match(err, /line 3/); assert.ok(err.trim().endsWith('?'));
    assert.ok(scriptedFeedback({ lv, judged, run: { ...run, timeout: true }, errorAsk: lv.errorAsk }).includes('?'));
  });
}

test('scripted mentor questions and hints never contain a full solution line', () => {
  const SOLUTION = { js: /tasks\.filter\(t => !t\.done\)\.length\s*\+|list\.appendChild\(li\);\s*\}|\.onclick = \(\) => \{ task\.done/, py: /return "Too low"|return tries|elif guess > secret:/ };
  for (const lang of ['js', 'py']) {
    const lv = lvOf(lang), texts = [...lv.ms.flatMap(m => m.hints), ...lv.checks.flatMap(c => [c.ask, c.ask2])];
    for (const t of texts) { assert.ok(!SOLUTION[lang].test(t), t); assert.ok(t.trim().endsWith('?'), `not a question: ${t}`); }
  }
});
