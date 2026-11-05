// Python PRO project (Guess the Number): the real harness (run/project-py.js) run by the system's python3
// against many student programs — the same harness Pyodide runs in the browser. Valid approaches pass,
// typical mistakes fail with the right tags, fixed answers fail, every check gets a fresh program.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { LANGS } from '../src/content/languages.js';
import { pyProjectHarness, parsePyProject, pyChecks } from '../src/run/project-py.js';
import { seedOf } from '../src/run/seed.js';
import { judgeRun, runTags } from '../src/learn/workspace.js';
import { newWorkspace } from '../src/learn/attempt.js';

const lv = LANGS.py.levels[6];
// Like run/py-runner.js: stdout/stderr, and a timeout message when the program runs too long.
function python(src, timeout = 4000) {
  try { return { stdout: execFileSync('python3', ['-I', '-c', src], { timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' }; }
  catch (e) { return e.signal || e.code === 'ETIMEDOUT' ? { stdout: '', stderr: `TimeoutError: your program ran longer than ${timeout / 1000} seconds (infinite loop?)` } : { stdout: e.stdout ?? '', stderr: e.stderr ?? '' }; }
}
const run = (code, seed = seedOf(code), timeout) => parsePyProject(python(pyProjectHarness(code, lv.demo, pyChecks(lv, seed)), timeout), lv.checks);
const passing = r => r.checks.filter(c => c.pass).map(c => c.id);
const failing = r => r.checks.filter(c => !c.pass).map(c => c.id);
const tagsOf = r => [...new Set(r.checks.flatMap(c => c.tags ?? []))];
const msChecks = k => lv.checks.filter(c => c.ms === k).map(c => c.id);

const IF_ELIF = 'def check(guess, secret):\n    if guess < secret:\n        return "Too low"\n    elif guess > secret:\n        return "Too high"\n    else:\n        return "Correct!"\n\n\ndef play(secret, guesses):\n    tries = 0\n    for g in guesses:\n        tries += 1\n        if check(g, secret) == "Correct!":\n            return tries\n    return tries\n';
const EQUAL_FIRST = 'def check(guess, secret):\n    if guess == secret:\n        return "Correct!"\n    if guess > secret:\n        return "Too high"\n    return "Too low"\n\n\ndef play(secret, guesses):\n    for tries, g in enumerate(guesses, start=1):\n        if g == secret:\n            return tries\n';
const WHILE_LOOP = 'def check(guess, secret):\n    return "Correct!" if guess == secret else ("Too low" if guess < secret else "Too high")\n\n\ndef play(secret, guesses):\n    i = 0\n    while guesses[i] != secret:\n        i += 1\n    return i + 1\n';
const INDEX = 'RESULTS = {-1: "Too low", 0: "Correct!", 1: "Too high"}\n\ndef check(guess, secret):\n    return RESULTS[(guess > secret) - (guess < secret)]\n\n\ndef play(secret, guesses):\n    return guesses.index(secret) + 1\n';

for (const [name, code] of [['if / elif / else, play reuses check', IF_ELIF], ['equality first, enumerate', EQUAL_FIRST], ['conditional expression, while loop', WHILE_LOOP], ['lookup table, list.index', INDEX]]) {
  test(`valid approach passes every check: ${name}`, () => {
    const r = run(code);
    assert.equal(r.error, null, JSON.stringify(r.error)); assert.equal(r.timeout, false);
    assert.deepEqual(failing(r), [], JSON.stringify(r.checks.filter(c => !c.pass)));
    assert.match(r.output, /> guess 42 {3}Correct!\nSolved in 4 tries/); // the terminal preview
  });
}

test('several checks per milestone, more checks than milestones', () => {
  assert.equal(lv.ms.length, 4); assert.ok(lv.checks.length >= 12);
  for (let k = 0; k < 4; k++) assert.ok(msChecks(k).length >= 3, `milestone ${k + 1}`);
});

test('the starter fails with "nothing returned" and passes nothing that needs an answer', () => {
  const r = run(lv.starter);
  assert.deepEqual(passing(r), ['play-keeps-list']);
  assert.ok(tagsOf(r).includes('missing-return'));
});

test('fixed answers fail: the numbers change with every program', () => {
  const r = run('def check(guess, secret):\n    if (guess, secret) == (3, 7):\n        return "Too low"\n    if (guess, secret) == (9, 7):\n        return "Too high"\n    return "Correct!"\n\n\ndef play(secret, guesses):\n    return 4\n');
  assert.ok(passing(r).includes('low-basic') && failing(r).includes('low-random') && failing(r).includes('high-random'));
  assert.ok(passing(r).includes('play-example') && failing(r).includes('play-first') && failing(r).includes('play-stops'));
  assert.notDeepEqual(pyChecks(lv, 1), pyChecks(lv, 2));
  assert.deepEqual(pyChecks(lv, 5), pyChecks(lv, 5));
});

test('typical mistakes are diagnosed', () => {
  const swapped = run(IF_ELIF.replace('"Too low"', '"TMP"').replace('"Too high"', '"Too low"').replace('"TMP"', '"Too high"'));
  assert.ok(tagsOf(swapped).includes('compare-direction'));
  const text = run(IF_ELIF.replace('"Correct!"\n\n', '"correct!"\n\n'));
  assert.ok(failing(text).includes('correct-basic') && tagsOf(text).includes('string-mismatch'));
  const printed = run(IF_ELIF.replace('return "Too low"', 'print("Too low")'));
  assert.ok(failing(printed).includes('low-basic') && tagsOf(printed).includes('missing-return'));
  const all = run(IF_ELIF.replace(/def play[\s\S]*/, 'def play(secret, guesses):\n    return len(guesses)\n'));
  assert.ok(failing(all).includes('play-stops') && tagsOf(all).includes('counts-all-guesses'));
  assert.ok(passing(all).includes('play-example'), 'the example alone can\'t tell');
  const index = run(IF_ELIF.replace(/def play[\s\S]*/, 'def play(secret, guesses):\n    for i in range(len(guesses)):\n        if guesses[i] == secret:\n            return i\n'));
  assert.ok(tagsOf(index).includes('off-by-one'));
  const mutates = run(IF_ELIF.replace(/def play[\s\S]*/, 'def play(secret, guesses):\n    n = guesses.index(secret) + 1\n    guesses.clear()\n    return n\n'));
  assert.deepEqual(failing(mutates), ['play-keeps-list']); assert.ok(tagsOf(mutates).includes('mutates-input'));
});

test('milestones are judged separately: only "Too low" done', () => {
  const r = run('def check(guess, secret):\n    if guess < secret:\n        return "Too low"\n\n\ndef play(secret, guesses):\n    pass\n');
  const j = judgeRun(newWorkspace(4), r, 4);
  assert.deepEqual(j.passing, [true, false, false, false]); assert.deepEqual(j.newly, [0]); assert.equal(j.focus, 1);
});

test('a syntax error is reported with its line; nothing runs', () => {
  const r = run('def check(guess, secret)\n    return "Too low"\n');
  assert.equal(r.error.kind, 'syntax'); assert.equal(r.error.line, 1); assert.deepEqual(passing(r), []);
  assert.ok(runTags('py', r, judgeRun(newWorkspace(4), r, 4)).includes('syntax-error'));
  const ind = run('def check(guess, secret):\nreturn 1\n');
  assert.equal(ind.error.name, 'IndentationError');
  assert.ok(runTags('py', ind, judgeRun(newWorkspace(4), ind, 4)).includes('indentation'));
});

test('runtime errors inside a function are reported with the line in game.py', () => {
  const r = run(IF_ELIF.replace('tries += 1', 'tries += one'));
  assert.equal(r.error.name, 'NameError'); assert.equal(r.error.line, 13);
  assert.ok(runTags('py', r, judgeRun(newWorkspace(4), r, 4)).includes('name-error'));
});

test('input() can\'t hang the checks: it fails at once with a clear error', () => {
  const r = run('secret = int(input("Secret? "))\n' + IF_ELIF);
  assert.equal(r.error.name, 'EOFError'); assert.deepEqual(passing(r), []);
});

test('a program that never ends is stopped and reported as a timeout', () => {
  const r = run('def check(guess, secret):\n    while True:\n        pass\n', undefined, 1500);
  assert.equal(r.timeout, true); assert.ok(r.checks.every(c => !c.pass && c.tags.includes('loop-timeout')));
  assert.ok(runTags('py', r, judgeRun(newWorkspace(4), r, 4)).includes('loop-timeout'));
});

test('exit() in student code can\'t end the harness early', () => {
  const r = run(IF_ELIF + '\nexit()\n');
  assert.equal(r.error?.name, 'SystemExit');
});

test('every check gets a fresh program: globals changed by one check don\'t leak', () => {
  const r = run('calls = []\n\n' + IF_ELIF.replace('def check(guess, secret):\n', 'def check(guess, secret):\n    calls.append(1)\n    if len(calls) > 12:\n        return "leaked"\n'));
  assert.deepEqual(failing(r), [], JSON.stringify(r.checks.filter(c => !c.pass)));
});
