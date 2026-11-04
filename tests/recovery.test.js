import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRecoveryQuestions, pickRecovery, checkRecoveryAnswer, getQuestion, getBank, RECOVERY_SIZE } from '../src/learn/recovery.js';
import { RECOVERY_BANKS } from '../src/content/recovery.js';
import { TODO_GENERAL } from '../src/content/recovery-todo.js';

const fail = (...tags) => ({ passed: false, tags });

// ── js-2: the To-Do bank ported from the Demo (selection must match the Demo exactly) ──
test('js-2 · Mini Boss mistakes pick their own questions', () => {
  const ids = selectRecoveryQuestions([fail('counts-unfinished'), fail('assignment-in-condition'), fail('log-vs-return')], 'js-2');
  assert.deepEqual(ids, ['not-operator', 'compare-not-assign', 'return-value']);
});

test('js-2 · PRO To-Do mistakes pick their own questions', () => {
  const ids = selectRecoveryQuestions([fail('count-done-vs-left'), fail('assignment-in-condition'), fail('selector-missing-hash')], 'js-2');
  assert.deepEqual(ids, ['not-operator', 'compare-not-assign', 'id-selector']);
});

test('js-2 · primary tags rank ahead of side-effect tags, then by frequency', () => {
  const ids = selectRecoveryQuestions([fail('syntax-error', 'loop-timeout'), fail('missing-comma'), fail('syntax-error')], 'js-2');
  assert.deepEqual(ids, ['brackets', 'object-commas', 'loop-stop']);
});

test('js-2 · no mistakes: filled from its general order', () => {
  assert.deepEqual(selectRecoveryQuestions([], 'js-2'), TODO_GENERAL.slice(0, 3));
});

// ── shared selection rules, both live banks ──
for (const bank of ['py-1', 'js-1']) {
  test(`${bank} · two tags sharing a question do not produce a duplicate`, () => {
    const q = getBank(bank).questions.find(q => q.tags.length > 1);
    const ids = selectRecoveryQuestions([fail(q.tags[0]), fail(q.tags[1])], bank, 0);
    assert.equal(ids.length, RECOVERY_SIZE); assert.equal(new Set(ids).size, RECOVERY_SIZE); assert.equal(ids[0], q.id);
  });

  test(`${bank} · passing attempts are ignored; unknown tags fall back to refreshers`, () => {
    const loop = getBank(bank).questions.find(q => q.tags.includes('infinite-loop'));
    assert.ok(!pickRecovery([{ passed: true, tags: ['infinite-loop'] }], bank, 0).questionIds.includes(loop.id));
    const r = pickRecovery([fail('no-such-tag')], bank, 1);
    assert.equal(r.questionIds.length, 3); assert.deepEqual(r.targeted, []);
  });

  test(`${bank} · refreshers come from the current vault first, then earlier vaults`, () => {
    for (let vault = 0; vault <= 4; vault++) {
      const qs = pickRecovery([], bank, vault).questionIds.map(id => getQuestion(bank, id));
      const here = getBank(bank).questions.filter(q => q.vault === vault).length;
      qs.forEach((q, k) => assert.ok(k < here ? q.vault === vault : q.vault <= vault, `${bank} vault ${vault}: ${q.id}`));
    }
  });

  test(`${bank} · targeted questions are reported, refreshers are not`, () => {
    const q = getBank(bank).questions[0];
    const r = pickRecovery([fail(q.tags[0])], bank, 3);
    assert.deepEqual(r.targeted, [q.id]); assert.equal(r.questionIds[0], q.id); assert.equal(r.questionIds.length, 3);
  });
}

test('an unknown bank selects nothing', () => {
  assert.deepEqual(pickRecovery([fail('x')], 'zz-9', 0), { questionIds: [], targeted: [] });
  assert.equal(getQuestion('zz-9', 'x'), null);
});

test('checks multiple-choice and fill-in answers', () => {
  assert.equal(checkRecoveryAnswer(getQuestion('js-2', 'not-operator'), 1), true);
  assert.equal(checkRecoveryAnswer(getQuestion('js-2', 'not-operator'), 0), false);
  assert.equal(checkRecoveryAnswer(getQuestion('js-2', 'not-operator'), '1'), false);
  assert.equal(checkRecoveryAnswer(getQuestion('js-2', 'id-selector'), ' # '), true);
  assert.equal(checkRecoveryAnswer(getQuestion('js-2', 'id-selector'), '.'), false);
  assert.equal(checkRecoveryAnswer(getQuestion('py-1', 'py-assign'), 1), true);
  assert.equal(checkRecoveryAnswer(getQuestion('py-1', 'py-assign'), 0), false);
});

test('every bank: unique, answerable questions whose hints never give the answer away', () => {
  assert.equal(RECOVERY_BANKS['js-2'].questions.length, 17);
  for (const [id, bank] of Object.entries(RECOVERY_BANKS)) {
    assert.equal(new Set(bank.questions.map(q => q.id)).size, bank.questions.length, id);
    assert.ok(bank.questions.length >= RECOVERY_SIZE, id);
    for (const q of bank.questions) {
      assert.ok(q.prompt && q.hint && q.explain && q.concept && q.tags.length, `${id}/${q.id}`);
      if (q.type === 'mcq') {
        assert.ok(q.options[q.answer], q.id);
        assert.equal(new Set(q.options).size, q.options.length, `${q.id}: duplicate options`);
        assert.ok(!q.hint.includes(q.options[q.answer]), `${q.id}: hint contains the answer`);
      } else {
        assert.equal(q.type, 'fill', q.id);
        assert.ok(q.code.includes(q.blank), q.id);
        assert.ok(!q.answers.some(a => q.hint.includes('`' + a + '`')), `${q.id}: hint contains the answer`);
      }
    }
    for (const g of bank.general ?? []) assert.ok(getQuestion(id, g), g);
  }
});
