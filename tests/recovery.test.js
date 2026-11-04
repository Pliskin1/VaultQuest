import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRecoveryQuestions, checkRecoveryAnswer, getQuestion, RECOVERY_SIZE } from '../src/learn/recovery.js';
import { RECOVERY_QUESTIONS, GENERAL_ORDER } from '../src/content/recovery.js';

const fail = (...tags) => ({ passed: false, tags });

test('Mini Boss mistakes pick their own questions', () => {
  // counts unfinished → `if (t.done = true)` → console.log instead of return (Ana's demo path)
  const ids = selectRecoveryQuestions([fail('counts-unfinished'), fail('assignment-in-condition'), fail('log-vs-return')]);
  assert.deepEqual(ids, ['not-operator', 'compare-not-assign', 'return-value']);
});

test('PRO To-Do mistakes pick their own questions', () => {
  const ids = selectRecoveryQuestions([fail('count-done-vs-left'), fail('assignment-in-condition'), fail('selector-missing-hash')]);
  assert.deepEqual(ids, ['not-operator', 'compare-not-assign', 'id-selector']);
});

test('primary tags rank ahead of side-effect tags, then by frequency', () => {
  const ids = selectRecoveryQuestions([fail('syntax-error', 'loop-timeout'), fail('missing-comma'), fail('syntax-error')]);
  assert.deepEqual(ids, ['brackets', 'object-commas', 'loop-stop']);
});

test('two tags sharing a question do not produce a duplicate', () => {
  const ids = selectRecoveryQuestions([fail('counts-unfinished'), fail('inverted-condition')]);
  assert.equal(new Set(ids).size, RECOVERY_SIZE);
  assert.equal(ids[0], 'not-operator');
});

test('always three distinct questions, filled from the general order', () => {
  const ids = selectRecoveryQuestions([]);
  assert.deepEqual(ids, GENERAL_ORDER.slice(0, 3));
  assert.equal(selectRecoveryQuestions([fail('no-such-tag')]).length, 3);
});

test('passing attempts are ignored', () => {
  assert.ok(!selectRecoveryQuestions([{ passed: true, tags: ['loop-timeout'] }]).includes('loop-stop'));
});

test('checks multiple-choice and fill-in answers', () => {
  assert.equal(checkRecoveryAnswer(getQuestion('not-operator'), 1), true);
  assert.equal(checkRecoveryAnswer(getQuestion('not-operator'), 0), false);
  assert.equal(checkRecoveryAnswer(getQuestion('not-operator'), '1'), false);
  assert.equal(checkRecoveryAnswer(getQuestion('id-selector'), ' # '), true);
  assert.equal(checkRecoveryAnswer(getQuestion('id-selector'), '.'), false);
  assert.equal(checkRecoveryAnswer(getQuestion('filter-length'), undefined), false);
});

test('the bank: 17 unique, answerable questions whose hints never give the answer away', () => {
  assert.equal(RECOVERY_QUESTIONS.length, 17);
  assert.equal(new Set(RECOVERY_QUESTIONS.map(q => q.id)).size, 17);
  for (const q of RECOVERY_QUESTIONS) {
    assert.ok(q.prompt && q.hint && q.explain && q.tags.length, q.id);
    if (q.type === 'mcq') {
      assert.ok(q.options[q.answer], q.id);
      assert.ok(!q.hint.includes(q.options[q.answer]), `${q.id}: hint contains the answer`);
    } else {
      assert.equal(q.type, 'fill', q.id);
      assert.ok(q.code.includes(q.blank), q.id);
      assert.ok(!q.answers.some(a => q.hint.includes('`' + a + '`')), `${q.id}: hint contains the answer`);
    }
  }
  for (const id of GENERAL_ORDER) assert.ok(getQuestion(id), id);
});

test('every planned mistake tag has a recovery question (PLAN.md §G.2)', () => {
  const tags = ['count-done-vs-left', 'counts-unfinished', 'inverted-condition', 'assignment-in-condition', 'selector-missing-hash', 'null-element',
    'syntax-error', 'undefined-variable', 'missing-function', 'missing-left-word', 'returns-array', 'counts-all-tasks', 'loop-timeout',
    'string-not-quoted', 'missing-comma', 'boolean-as-string', 'property-vs-value', 'logs-whole-object', 'not-a-method', 'push-length',
    'title-as-task', 'missing-return', 'log-vs-return', 'truthy-condition', 'string-mismatch', 'off-by-one'];
  for (const t of tags) assert.ok(RECOVERY_QUESTIONS.some(q => q.tags.includes(t)), t);
});
