// Mistake detection (learn/diagnose.js) on the live World 1 content, and how it targets Recovery per language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../src/learn/diagnose.js';
import { pickRecovery } from '../src/learn/recovery.js';
import { LANGS } from '../src/content/languages.js';

const ch = (lang, v, k) => LANGS[lang].levels[v].ch[k];
const d = (lang, v, k, type, answer, error, found) => diagnose({ lang, challenge: ch(lang, v, k), type, answer, error, found });

test('order of evidence: judged behaviour, then the wrong answer, then a runtime error, then the concept', () => {
  assert.deepEqual(d('js', 1, 1, 'blank', 'length', 'TypeError: tasks.length is not a function', ['push-length', 'not-a-method']).tags, ['push-length', 'not-a-method', 'array-push']);
  assert.deepEqual(d('py', 0, 1, 'blank', 'false', "NameError: name 'false' is not defined", ['boolean-capital']).tags, ['boolean-capital', 'name-error', 'boolean']);
});

test('py: wrong options carry their own mistake; the challenge concept follows', () => {
  assert.deepEqual(d('py', 0, 0, 'mcq', 1).tags, ['quotes-in-output', 'dict-access']);
  assert.deepEqual(d('py', 0, 0, 'mcq', 2).tags, ['key-vs-value', 'dict-access']);
  assert.deepEqual(d('py', 3, 0, 'mcq', 2).tags, ['truthy-condition', 'if-branch']);
});

test('py: real Python errors become evidence', () => {
  assert.deepEqual(d('py', 1, 2, 'code', 'x', 'IndentationError: expected an indented block after \'for\' statement on line 2').tags, ['indentation', 'loop-titles']);
  assert.deepEqual(d('py', 0, 2, 'code', 'x', 'SyntaxError: invalid syntax. Perhaps you forgot a comma?').tags, ['syntax-error', 'dict-syntax']);
  assert.deepEqual(d('py', 1, 1, 'blank', 'push', "AttributeError: 'list' object has no attribute 'push'").tags, ['not-a-method', 'list-append']);
  assert.deepEqual(d('py', 2, 2, 'code', 'x', "KeyError: 'Title'").tags, ['key-error', 'add-task']);
  assert.deepEqual(d('py', 1, 2, 'code', 'x', 'IndexError: list index out of range').tags, ['index-range', 'loop-titles']);
  assert.deepEqual(d('py', 1, 2, 'code', 'x', 'Timeout: the code kept running and was stopped (an endless loop?)').tags, ['loop-timeout', 'loop-titles']);
  assert.deepEqual(d('py', 4, 1, 'blank', 'push').tags, ['list-append']); // Pro vault: known wrong blank
});

test('js: wrong options and real Worker errors become evidence', () => {
  assert.deepEqual(d('js', 0, 0, 'mcq', 1).tags, ['quotes-in-output', 'dot-access']);
  assert.deepEqual(d('js', 0, 2, 'code', 'x', 'SyntaxError: Unexpected identifier \'a\'').tags, ['syntax-error', 'object-syntax']);
  assert.deepEqual(d('js', 2, 2, 'code', 'x', 'addTask is not defined as a function').tags, ['missing-function', 'add-task']);
  assert.deepEqual(d('js', 1, 2, 'code', 'x', "TypeError: Cannot read properties of undefined (reading 'title')").tags, ['undefined-value', 'loop-titles']);
  assert.deepEqual(d('js', 4, 1, 'blank', 'forEach').tags, ['map-vs-foreach', 'array-map']); // Pro vault
  assert.deepEqual(d('js', 4, 2, 'code', 'x', 'Error: your code ran longer than 1 second (infinite loop?)').tags, ['loop-timeout', 'off-by-one']);
});

test('no evidence, no invented diagnosis', () => {
  assert.deepEqual(diagnose({ lang: 'js', challenge: null, type: 'code', answer: 'x', error: 'Something odd' }).tags, []);
  assert.deepEqual(d('py', 2, 2, 'code', 'x', 'Some unrecognised failure').tags, ['add-task']); // only the concept tested
});

test('evidence keeps the answer for options/blanks and the last error line for code — never the whole code', () => {
  assert.deepEqual(d('py', 0, 1, 'blank', '"False"').evidence, { type: 'blank', answer: '"False"' });
  assert.deepEqual(d('js', 3, 2, 'code', 'function secret() {}', 'line 1\nTypeError: boom').evidence, { type: 'code', error: 'TypeError: boom' });
});

// From mistakes to questions: the same shared selection, each language's own bank.
const failed = (...ds) => ds.map(x => ({ passed: false, ...x }));
test('py: Recovery targets the Python mistakes actually made in Vault 1', () => {
  const r = pickRecovery(failed(d('py', 0, 0, 'mcq', 2), d('py', 0, 1, 'blank', 'false', "NameError: name 'false' is not defined", ['boolean-capital']), d('py', 0, 2, 'code', 'x', 'SyntaxError: invalid syntax', ['string-not-quoted'])), 'py-2', 0);
  assert.deepEqual(r.questionIds, ['py-dict-key', 'py-bool', 'py-quote-text']);
  assert.deepEqual(r.targeted, r.questionIds);
});

test('js: Recovery targets the JavaScript mistakes actually made in Vault 3', () => {
  const r = pickRecovery(failed(d('js', 2, 0, 'mcq', 1), d('js', 2, 2, 'code', 'x', '', ['title-as-task']), d('js', 2, 2, 'code', 'y', '', ['not-started'])), 'js-2', 2);
  assert.deepEqual(r.questionIds, ['return-value', 'js-task-shape', 'js-empty-fn']);
});

test('one repeated mistake: one targeted question, refreshers from the same vault and language', () => {
  const same = { passed: false, ...d('py', 3, 1, 'blank', '!=', '', ['inverted-condition']) };
  const r = pickRecovery([same, same, same], 'py-2', 3);
  assert.deepEqual(r.targeted, ['py-not', 'py-compare']); // the main mistake first, then the concept the challenge tests
  assert.equal(r.questionIds[0], 'py-not'); assert.ok(!r.targeted.includes(r.questionIds[2])); // the third is a refresher
  assert.equal(r.questionIds.length, 3); assert.ok(r.questionIds.every(id => id.startsWith('py-')));
});
