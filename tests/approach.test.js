// Explain first (learn/approach.js) and its gate in the shared engine (learn/attempt.js), for both languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewApproach } from '../src/learn/approach.js';
import {
  newAttempt, beginSubmission, settleSubmission, answerKey, explainApproach, answerApproach, startCoding, inPlanning,
  startRecovery, answerRecoveryQuestion, currentQuestion, finishRecovery, toSave, fromSave, inRecovery
} from '../src/learn/attempt.js';
import { LANGS } from '../src/content/languages.js';
import { getQuestion } from '../src/learn/recovery.js';

const rulesOf = lang => LANGS[lang].levels[4].ch[0].approach.rules;
const review = (lang, text, answers = [], last = null) => reviewApproach({ text, answers }, rulesOf(lang), last);
const opts = lang => ({ lang, vault: 4, curriculum: lang + '-2', challenges: 1, approach: true });
const roundTrip = (a, lang) => fromSave(JSON.parse(JSON.stringify(toSave(a))), opts(lang));
const GOOD = 'I will go through each task in the list and check if its done value is true. If it is, I add one to a counter that starts at 0, and at the end I return the counter.';

for (const lang of ['js', 'py']) {
  test(`${lang}: empty, too short, unrelated or keyword-list explanations are rejected`, () => {
    for (const t of ['', '   ', 'idk', 'count the done ones', 'I like pizza and the weather is really nice today, honestly.', 'loop done count return zero total tasks filter',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.']) {
      const r = review(lang, t);
      assert.equal(r.accepted, false, JSON.stringify(t)); assert.equal(r.rule, 'short', JSON.stringify(t));
      assert.match(r.question, /in your own words/);
    }
  });

  test(`${lang}: different valid explanations are accepted — no exact phrase needed`, () => {
    for (const t of [GOOD,
      'Filter the tasks so only the finished ones are left, then give back how many there are. For an empty list that is just zero.',
      'Start a total at zero. Look at every task one by one; when a task is done, increase the total by one. Return the total at the end.',
      'I am going to loop over all the tasks and count each one whose done flag is true, returning that number, which is 0 when there are no tasks.',
      'Use sum over the tasks, adding 1 for every task that is complete, and return it; with no tasks the sum is 0.']) {
      assert.equal(review(lang, t).accepted, true, t);
    }
  });

  test(`${lang}: incomplete plans get one Socratic question about what's missing — never the code`, () => {
    const cases = [
      ['I will count the tasks and return the number at the end, starting from zero.', 'iterate'],
      ['I go through each task in the list and count them, and then return the count, zero if empty.', 'status'],
      ['I look at every task and count the ones that are not done, then return that count, starting at zero.', 'only-done'],
      ['I go through each task in the list and check whether it is done, and at the end I return it.', 'count'],
      ['I go through each task in the list and count the ones that are done, then print the count, zero if empty.', 'print'],
      ['I go through each task in the list and count the ones that are done, starting from zero.', 'result'],
      ['I go through each task in the list and count the ones that are done, then return the number.', 'empty']];
    for (const [t, rule] of cases) {
      const r = review(lang, t);
      assert.equal(r.accepted, false, t); assert.equal(r.rule, rule, `${t} → ${r.rule}`);
      assert.ok(r.question.trim().endsWith('?'), r.question);
      assert.ok(!/\b(filter|reduce|sum\(|for \(|for \w+ in|\+\+|\+= ?1|return \w)/.test(r.question), `leaks code: ${r.question}`);
    }
  });

  test(`${lang}: answers to the mentor's questions complete the plan (PLAN §E Stage 4)`, () => {
    const plan = 'I go through each task in the list and count the ones that are done, then return the number.';
    const r1 = review(lang, plan);
    assert.equal(r1.rule, 'empty');
    const r2 = review(lang, plan, ['For an empty list it should return 0.'], r1.rule);
    assert.equal(r2.accepted, true);
    const r3 = review(lang, 'I will count the tasks and return the number at the end, starting from zero.', ['I look at every task'], 'iterate');
    assert.match(r3.question, /^Thanks — that helps\./); // progress is acknowledged before the next question
  });

  test(`${lang}: the engine refuses code submissions until the plan is accepted — not just the UI`, () => {
    const a = newAttempt(lang, 4, lang + '-2', { approach: true }), rules = rulesOf(lang);
    assert.equal(inPlanning(a), true);
    assert.equal(beginSubmission(a), null); // no plan yet
    assert.equal(startCoding(a), false);
    explainApproach(a, 'I count stuff', rules);
    assert.equal(a.approach.accepted, false); assert.equal(beginSubmission(a), null); assert.equal(startCoding(a), false);
    const r = explainApproach(a, GOOD, rules);
    assert.equal(r.accepted, true); assert.equal(a.approach.reviews, 2);
    assert.ok(beginSubmission(a)); // the gate is the accepted plan
    assert.equal(startCoding(a), true); assert.equal(inPlanning(a), false);
    assert.equal(explainApproach(a, 'something else', rules), null); // an accepted plan isn't re-reviewed
    assert.equal(a.approach.text, GOOD);
    // Vaults without explain-first are unaffected.
    assert.ok(beginSubmission(newAttempt(lang, 0, lang + '-2')));
  });

  test(`${lang}: the plan, its answers and acceptance survive refresh; a damaged save can't skip the plan`, () => {
    const a = newAttempt(lang, 4, lang + '-2', { approach: true }), rules = rulesOf(lang);
    explainApproach(a, 'I go through each task in the list and count the ones that are done, then return the number.', rules);
    const mid = roundTrip(a, lang);
    assert.deepEqual(mid.approach, a.approach); assert.equal(mid.approach.accepted, false); assert.equal(beginSubmission(mid), null);
    answerApproach(mid, 'An empty list gives 0.', rules); startCoding(mid);
    const done = roundTrip(mid, lang);
    assert.deepEqual(done.approach, mid.approach); assert.equal(done.approach.started, true);
    const forged = JSON.parse(JSON.stringify(toSave(a))); forged.approach.started = true; // started without acceptance
    assert.equal(fromSave(forged, opts(lang)).approach.started, false);
    const junk = JSON.parse(JSON.stringify(toSave(a))); junk.approach = 'garbage';
    assert.deepEqual(fromSave(junk, opts(lang)).approach, { text: '', answers: [], accepted: false, reviews: 0, last: null, started: false });
    assert.equal(fromSave(JSON.parse(JSON.stringify(toSave(a))), { ...opts(lang), approach: false }).approach, undefined); // ordinary vaults carry no plan
  });

  test(`${lang}: Recovery in the Mini Boss uses its own questions and returns with plan and code intact`, () => {
    const a = newAttempt(lang, 4, lang + '-2', { approach: true }), rules = rulesOf(lang);
    explainApproach(a, GOOD, rules); startCoding(a);
    a.view = { ...a.view, drafts: { 0: lang === 'py' ? 'def count_completed(tasks):\n    return 2' : 'function countCompleted(tasks) { return 2; }' } };
    const plan = structuredClone(a.approach), view = structuredClone(a.view);
    const outs = [['counts-unfinished', 'count-done'], ['hardcoded-answer', 'count-done'], ['mutates-input', 'count-done']].map((tags, k) => {
      const t = beginSubmission(a); return settleSubmission(a, t, { key: answerKey(a, 0, 'code', 'wrong ' + k), passed: false, tags });
    });
    assert.deepEqual(outs.map(o => o.hearts), [2, 1, 0]); assert.equal(outs[2].exhausted, true);
    const r = startRecovery(a);
    assert.equal(r.bank, lang + '-2'); assert.equal(r.questionIds.length, 3);
    assert.ok(r.questionIds.every(id => getQuestion(lang + '-2', id)));
    assert.ok(r.targeted.includes(lang === 'py' ? 'py-hardcode' : 'js-hardcode') && r.targeted.includes(lang === 'py' ? 'py-mutate' : 'js-mutate'), r.targeted.join());
    const mid = roundTrip(a, lang); assert.equal(inRecovery(mid), true); assert.deepEqual(mid.approach, plan); // refresh mid-Recovery
    for (let q = 0; q < 3; q++) { const qq = currentQuestion(mid); answerRecoveryQuestion(mid, qq.id, qq.type === 'mcq' ? qq.answer : qq.answers[0]); }
    assert.equal(finishRecovery(mid), true);
    assert.equal(mid.session.hearts, 3); assert.deepEqual(mid.approach, plan); assert.deepEqual(mid.view, view);
    assert.ok(beginSubmission(mid)); // straight back to coding — no re-explaining
  });
}

test('the plan text is capped, and answers are kept to a bounded history', () => {
  const a = newAttempt('py', 4, 'py-2', { approach: true }), rules = rulesOf('py');
  explainApproach(a, 'x'.repeat(5000), rules);
  assert.equal(a.approach.text.length, 800);
  for (let k = 0; k < 30; k++) answerApproach(a, 'y'.repeat(1000), rules);
  assert.equal(a.approach.answers.length, 12); assert.ok(a.approach.answers.every(x => x.length === 300));
});
