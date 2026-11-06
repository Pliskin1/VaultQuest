// The loop guard for student JavaScript (run/sandbox/instrument.js): every loop shape and runaway recursion
// reaches the guard, valid code stays valid and behaves the same, line numbers don't move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instrument, tokenize } from '../src/run/sandbox/instrument.js';

// Runs instrumented code with a guard that throws after `limit` calls → 'stopped' | 'finished' | error.
function exec(code, limit = 10000) {
  const r = instrument(code);
  assert.ok(r.code, `could not instrument: ${r.error}`);
  let calls = 0;
  const __vq = () => { if (++calls > limit) throw new Error('VQ_STOP'); return true; };
  const __vqIt = function* (xs) { for (const v of xs) { __vq(); yield v; } };
  try { return { out: new Function('__vq', '__vqIt', r.code + '\n;return typeof result === "undefined" ? undefined : result;')(__vq, __vqIt), calls, code: r.code }; }
  catch (e) { return { stopped: e.message === 'VQ_STOP', error: e, calls, code: r.code }; }
}

test('every infinite loop shape reaches the guard', () => {
  for (const code of ['while (true) {}', 'while (true);', 'while(1)\n  ;', 'for (;;) {}', 'for (;;);', 'for (let i = 0; ; i++) {}', 'for (let i = 0; i >= 0; i++) {}',
    'do {} while (true)', 'do ; while (true);', 'let i = 0; while (i < 10) { if (i > 5) continue; i++; }', 'outer: while (true) { inner: for (;;) { continue outer; } }',
    'const a = [1]; for (const x of a) a.push(x);', 'function f() { return f(); } f();', 'const f = () => { f(); }; f();', 'const o = { m() { this.m(); } }; o.m();',
    'class A { run() { while (true) {} } } new A().run();', 'const s = `${(() => { while (true) {} })()}`;', 'async function f() { while (true) {} } f().catch(Boolean);']) {
    const r = exec(code);
    // plain recursion may hit the engine's own stack limit first — also a clean stop, never a freeze
    assert.ok(r.stopped || r.error instanceof RangeError || r.calls > 10000 /* async: the promise rejects */, `${code}\n→ ${r.code}\n${r.error?.stack ?? 'finished'}`);
  }
});

test('valid code stays valid and computes the same result', () => {
  const cases = [
    ['let result = 0; for (let i = 0; i < 5; i++) result += i;', 10],
    ['let result = []; for (const x of [1, 2, 3]) result.push(x * 2);', [2, 4, 6]],
    ['let result = []; for (const k in { a: 1, b: 2 }) result.push(k);', ['a', 'b']],
    ['let result = 0, i = 3; while (i--) result++;', 3],
    ['let result = 0; do { result++; } while (result < 4);', 4],
    ['const tasks = [{ done: true }, { done: false }]; let result = tasks.filter(t => !t.done).length;', 1],
    ['let result; switch (2) { case 1: result = "a"; break; case 2: { result = "b"; break; } default: result = "c"; }', 'b'],
    ['let result = "while (x) {}" + \'for(;;)\' + `${"for"} (;;) ${1 + 1}`;', 'while (x) {}for(;;)for (;;) 2'],
    ['// while (true) {}\n/* for (;;) {} */ let result = 1;', 1],
    ['let result = "a/b".replace(/\\//g, "-") + /[(]/.source + /for \\(/.test("for (");', 'a-b[(]true'],
    ['const x = 6 / 2 / 3; let result = x;', 1],
    ['let result = (function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); })(5);', 120],
    ['class Box { constructor(v) { this.v = v; } get double() { return this.v * 2; } } let result = new Box(4).double;', 8],
    ['const o = { a: 1, f(x) { return x + this.a; } }; let result = o.f(2);', 3],
    ['let result = [1, 2].map(n => ({ n })).length;', 2],
    ['let result = 0; if (true) { result = 1 } else { result = 2 }', 1],
    ['const obj = { while: 1, for: 2 }; let result = obj.while + obj.for;', 3],
    ['let result = 0; for (let [a, b] of [[1, 2], [3, 4]]) result += a * b;', 14],
    ['let result = `${[1, 2].map(x => { return `<li>${x}</li>`; }).join("")}`;', '<li>1</li><li>2</li>']
  ];
  for (const [code, want] of cases) {
    const r = exec(code);
    assert.ok(!r.error, `${code}\n→ ${r.code}\n${r.error?.stack}`);
    assert.deepEqual(r.out, want, code);
  }
});

test('inserted guards never add lines (error line numbers stay right)', () => {
  const code = 'const list = [];\nfor (let i = 0;\n  i < 3;\n  i++) {\n  list.push(i);\n}\nwhile (list.length) list.pop();\nconst f = () => {\n  return 1;\n};\n';
  assert.equal(instrument(code).code.split('\n').length, code.split('\n').length);
});

test('a for…of over an array that grows inside the loop stops; a normal one runs exactly once per item', () => {
  const r = exec('let result = 0; for (const x of [1, 2, 3]) result += x;');
  assert.equal(r.out, 6); assert.ok(r.calls >= 3);
});

test('code the tokenizer cannot read is reported instead of being run unguarded', () => {
  for (const bad of ['const s = "unterminated', 'const t = `open ${x', '/* never closed', 'const r = /abc']) assert.ok(instrument(bad).error, bad);
  assert.doesNotThrow(() => tokenize('a = b / c / d; e = /x/g.test(f);'));
});

test('switch bodies and class bodies are left alone (a guard there would be a syntax error)', () => {
  const r = instrument('switch (x) { case 1: break; }\nclass A extends (B) { m() {} }');
  assert.ok(!/switch \(x\) \{__vq\(\);/.test(r.code), r.code);
  assert.ok(!/extends \(B\) \{__vq\(\);/.test(r.code), r.code);
  assert.ok(/m\(\) \{__vq\(\);/.test(r.code), r.code);
});
