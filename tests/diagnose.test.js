// Mistake detection (learn/diagnose.js + content/mistakes.js) and how it targets Recovery, per language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../src/learn/diagnose.js';
import { pickRecovery } from '../src/learn/recovery.js';

const py = (vault, challenge, type, answer, error) => diagnose({ curriculum: 'py-1', lang: 'py', vault, challenge, type, answer, error });
const js = (vault, challenge, type, answer, error) => diagnose({ curriculum: 'js-1', lang: 'js', vault, challenge, type, answer, error });

test('py: a known wrong option is the main mistake, the challenge concept follows', () => {
  assert.deepEqual(py(0, 0, 'mcq', 1).tags, ['quotes-in-output', 'print-values']);
  assert.deepEqual(py(0, 0, 'mcq', 3).tags, ['variable-defined', 'print-values']);
  assert.deepEqual(py(2, 0, 'mcq', 2).tags, ['if-else-branch']); // no finer tag known: just the concept
});

test('py: known wrong blanks, trimmed', () => {
  assert.deepEqual(py(0, 1, 'blank', ' == ').tags, ['assign-vs-compare', 'assignment']);
  assert.deepEqual(py(2, 2, 'blank', '&&').tags, ['python-and-keyword', 'logical-and']);
  assert.deepEqual(py(2, 2, 'blank', 'both').tags, ['logical-and']);
});

test('py: real Pyodide errors become evidence', () => {
  assert.deepEqual(py(0, 2, 'code', 'x', "Traceback (most recent call last):\n  File \"main.py\", line 2, in <module>\nNameError: name 'Name' is not defined").tags, ['name-error', 'case-sensitive']);
  assert.deepEqual(py(2, 1, 'code', 'x', "  File \"main.py\", line 2\n    if score >= 50\n                  ^\nSyntaxError: expected ':'").tags, ['missing-colon']);
  assert.deepEqual(py(2, 1, 'code', 'x', 'IndentationError: expected an indented block after \'if\' statement on line 2').tags, ['indentation', 'missing-colon']);
  assert.deepEqual(py(3, 1, 'code', 'x', "TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'").tags, ['none-value', 'return-vs-print']);
  assert.deepEqual(py(4, 2, 'code', 'x', 'IndexError: list index out of range').tags, ['index-range']);
  assert.deepEqual(py(4, 2, 'code', 'x', 'TimeoutError: your program ran longer than 3 seconds (infinite loop?)').tags, ['infinite-loop', 'index-range']);
  assert.deepEqual(py(1, 2, 'code', 'x', 'TypeError: can only concatenate str (not "int") to str').tags, ['str-int-concat', 'type-conversion']);
});

test('js: known wrong options and blanks', () => {
  assert.deepEqual(js(0, 0, 'mcq', 2).tags, ['number-plus', 'reassign-let']);
  assert.deepEqual(js(0, 1, 'blank', 'let').tags, ['const-vs-let', 'const-keyword']);
  assert.deepEqual(js(1, 2, 'blank', '==').tags, ['loose-equality', 'strict-equality']);
  assert.deepEqual(js(2, 2, 'blank', 'and').tags, ['js-and-operator', 'logical-and']);
});

test('js: real Worker errors become evidence', () => {
  assert.deepEqual(js(0, 2, 'code', 'x', 'TypeError: Assignment to constant variable.').tags, ['const-reassign']);
  assert.deepEqual(js(2, 1, 'code', 'x', 'SyntaxError: missing ) after argument list').tags, ['syntax-error', 'condition-parens']);
  assert.deepEqual(js(3, 1, 'code', 'x', "TypeError: Cannot read properties of undefined (reading 'toUpperCase')").tags, ['undefined-value', 'return-vs-log']);
  assert.deepEqual(js(0, 2, 'code', 'x', 'ReferenceError: scor is not defined').tags, ['undefined-variable', 'const-reassign']);
  assert.deepEqual(js(4, 2, 'code', 'x', 'Error: your code ran longer than 1 second (infinite loop?)').tags, ['infinite-loop', 'off-by-one']);
});

test('no evidence, no diagnosis: unknown challenges and unknown curricula give no tags', () => {
  assert.deepEqual(py(9, 9, 'mcq', 1).tags, []);
  assert.deepEqual(diagnose({ curriculum: 'zz-1', lang: 'zz', vault: 0, challenge: 0, type: 'code', answer: 'x', error: 'SyntaxError' }).tags, []);
  assert.deepEqual(py(0, 2, 'code', 'x', 'Some unrecognised failure').tags, ['case-sensitive']); // only the concept
});

test('evidence keeps the answer for options/blanks and the last error line for code — never the whole code', () => {
  assert.deepEqual(py(0, 1, 'blank', '==').evidence, { type: 'blank', answer: '==' });
  const e = js(3, 1, 'code', 'function greet(name) { /* secret */ }', "Hi Ana\nTypeError: Cannot read properties of undefined (reading 'toUpperCase')").evidence;
  assert.deepEqual(e, { type: 'code', error: "TypeError: Cannot read properties of undefined (reading 'toUpperCase')" });
});

// From mistakes to questions: the same shared selection, each language's own bank.
test('py: Recovery targets the Python mistakes actually made', () => {
  const attempts = [{ passed: false, ...py(0, 1, 'blank', '==') }, { passed: false, ...py(0, 2, 'code', 'x', "NameError: name 'Name' is not defined") }, { passed: false, ...py(0, 0, 'mcq', 1) }];
  const r = pickRecovery(attempts, 'py-1', 0);
  assert.deepEqual(r.questionIds, ['py-assign', 'py-case', 'py-print']);
  assert.deepEqual(r.targeted, r.questionIds);
});

test('js: Recovery targets the JavaScript mistakes actually made', () => {
  const attempts = [{ passed: false, ...js(0, 1, 'blank', 'let') }, { passed: false, ...js(0, 2, 'code', 'x', 'TypeError: Assignment to constant variable.') }, { passed: false, ...js(0, 0, 'mcq', 1) }];
  const r = pickRecovery(attempts, 'js-1', 0);
  assert.deepEqual(r.questionIds, ['js-const', 'js-const-change', 'js-let']);
});

test('one repeated mistake: one targeted question, refreshers for the rest from the same vault', () => {
  const same = { passed: false, ...py(2, 2, 'blank', 'or') };
  const r = pickRecovery([same, same, same], 'py-1', 2);
  assert.equal(r.questionIds[0], 'py-and'); assert.deepEqual(r.targeted, ['py-and']);
  assert.ok(r.questionIds.every(id => id.startsWith('py-')));
});
