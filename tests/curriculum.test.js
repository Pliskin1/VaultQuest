// World 1 for both languages, judged for real: JavaScript through jsObserve (the same function the browser's
// Worker runs), Python through the same harness Pyodide runs — here executed by the system python3.
// Every challenge: correct and alternative answers pass; known wrong answers fail with the right mistake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { LANGS } from '../src/content/languages.js';
import { jsObserve } from '../src/run/js-observe.js';
import { pyHarness, parsePy } from '../src/run/py-observe.js';
import { judge, fillCode } from '../src/learn/judge.js';
import { diagnose } from '../src/learn/diagnose.js';

const PY = spawnSync('python3', ['-c', 'print(1)'], { encoding: 'utf8' }).stdout?.trim() === '1';
const runPy = (code, spec) => {
  const r = spawnSync('python3', ['-I', '-'], { input: pyHarness(code, spec), encoding: 'utf8', timeout: 5000 });
  return r.error?.code === 'ETIMEDOUT' ? { timedOut: true } : parsePy({ stdout: r.stdout, stderr: r.stderr });
};

function attempt(lang, c, answer) {
  if (c.t === 'mcq') return { passed: !!c.opts[answer][1], tags: diagnose({ lang, challenge: c, type: 'mcq', answer }).tags };
  const code = c.t === 'fill' ? fillCode(c, answer) : answer;
  const obs = lang === 'js' ? jsObserve(code, c.observe) : runPy(code, c.observe);
  const j = judge(c, obs, { code, answer: c.t === 'fill' ? answer : null });
  const d = diagnose({ lang, challenge: c, type: c.t === 'fill' ? 'blank' : 'code', answer, error: j.error, found: j.tags });
  return { passed: j.passed, tags: d.tags, j };
}

// [vault][challenge] → { pass: [answers], fail: [[answer, tag that must be diagnosed first-ish]] }
const CASES = {
  js: [
    [{ pass: [0], fail: [[1, 'quotes-in-output'], [2, 'property-vs-value'], [3, 'property-vs-value']] },
     { pass: ['false', '!true', '1 > 2'], fail: [['"false"', 'boolean-as-string'], ['true', 'boolean-wrong-value'], ['nope', 'undefined-variable'], ['', 'syntax-error']] },
     { pass: ['const task = {\n  title: "Read a book",\n  done: false\n};', "const task = { title: 'Groceries', done: false };", 'const task = {\n  title: `Read a book`,\n  done: !true\n};'],
       fail: [['const task = {\n  title: Read a book,\n  done: false\n};\n', 'string-not-quoted'], ['const task = {\n  title: "Read a book"\n  done: false\n};', 'missing-comma'], ['const task = { title: "Read", done: true };', 'object-syntax']] }],
    [{ pass: [0], fail: [[1, 'length-vs-index'], [3, 'length-vs-index']] },
     { pass: ['push', 'unshift'], fail: [['length', 'push-length'], ['add', 'not-a-method'], ['concat', 'array-push']] },
     { pass: ['const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\nfor (const task of tasks) {\n  console.log(task.title);\n}',
         'const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\ntasks.forEach(t => console.log(t.title));',
         'const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\nfor (let i = 0; i < tasks.length; i++) console.log(tasks[i].title);'],
       fail: [['const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\nfor (const t of tasks) console.log(t);', 'logs-whole-object'],
         ['const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\nfor (let i = 0; i <= tasks.length; i++) console.log(tasks[i].title);', 'off-by-one'],
         ['const tasks = [{ title: "Wash up", done: true }, { title: "Read", done: false }, { title: "Code", done: false }];\nfor (let i = 1; i < tasks.length; i++) console.log(tasks[i].title);', 'off-by-one'],
         ['const tasks = [];\n// print each title here\n', 'no-output']] }],
    [{ pass: [0], fail: [[1, 'missing-return']] },
     { pass: ['false', '!true'], fail: [['"false"', 'boolean-as-string'], ['true', 'boolean-wrong-value']] },
     { pass: ['function addTask(tasks, title) {\n  tasks.push({ title: title, done: false });\n}', 'function addTask(tasks, title) {\n  return [...tasks, { title, done: false }];\n}', 'const addTask = (tasks, title) => tasks.concat([{ done: false, title }]);'],
       fail: [['function addTask(tasks, title) {\n\n}\n', 'not-started'], ['function addTask(tasks, title) {\n  tasks.push(title);\n}', 'title-as-task'], ['function addTask(tasks, title) {\n  tasks.push({ title });\n}', 'missing-done'],
         ['function addTask(tasks, title) {\n  return [{ title, done: false }];\n}', 'add-task'], ['function addtask(tasks, title) {}', 'missing-function']] }],
    [{ pass: [0], fail: [[1, 'truthy-condition'], [3, 'truthy-condition']] },
     { pass: ['===', '=='], fail: [['=', 'assignment-in-condition'], ['!==', 'inverted-condition'], ['!=', 'inverted-condition']] },
     { pass: ['function statusLabel(task) {\n  if (task.done) {\n    return "Done";\n  } else {\n    return "To do";\n  }\n}', 'const statusLabel = task => (task.done ? "Done" : "To do");', 'function statusLabel(task) {\n  if (task.done === false) return "To do";\n  return "Done";\n}'],
       fail: [['function statusLabel(task) {\n  if (task.done) console.log("Done"); else console.log("To do");\n}', 'log-vs-return'], ['function statusLabel(task) {\n  if (task.done = true) return "Done";\n  return "To do";\n}', 'assignment-in-condition'],
         ['function statusLabel(task) {\n  return task.done ? "To do" : "Done";\n}', 'inverted-condition'], ['function statusLabel(task) {\n  return task.done ? "done" : "to do";\n}', 'string-mismatch'], ['function statusLabel(task) {\n\n}\n', 'not-started']] }]
  ],
  py: [
    [{ pass: [0], fail: [[1, 'quotes-in-output'], [2, 'key-vs-value'], [3, 'key-vs-value']] },
     { pass: ['False', 'not True', '1 > 2'], fail: [['"False"', 'boolean-as-string'], ['false', 'boolean-capital'], ['True', 'boolean-wrong-value'], ['', 'syntax-error']] },
     { pass: ['task = {\n    "title": "Read a book",\n    "done": False\n}', "task = {'title': 'Groceries', 'done': False}", 'task = dict(title="Read a book", done=False)'],
       fail: [['task = {\n    "title": Read a book,\n    "done": False\n}\n', 'string-not-quoted'], ['task = {\n    "title": "Read a book"\n    "done": False\n}', 'missing-comma'], ['task = {"title": "Read", "done": True}', 'dict-syntax']] }],
    [{ pass: [0], fail: [[1, 'length-vs-index'], [3, 'length-vs-index']] },
     { pass: ['append'], fail: [['push', 'not-a-method'], ['add', 'not-a-method'], ['extend', 'list-append'], ['len', 'push-length']] },
     { pass: ['tasks = [{"title": "Wash up", "done": True}, {"title": "Read", "done": False}, {"title": "Code", "done": False}]\nfor task in tasks:\n    print(task["title"])',
         'tasks = [{"title": "Wash up", "done": True}, {"title": "Read", "done": False}, {"title": "Code", "done": False}]\nfor i in range(len(tasks)):\n    print(tasks[i]["title"])',
         'tasks = [{"title": "Wash up", "done": True}, {"title": "Read", "done": False}, {"title": "Code", "done": False}]\nprint("\\n".join(t["title"] for t in tasks))'],
       fail: [['tasks = [{"title": "Wash up", "done": True}, {"title": "Read", "done": False}, {"title": "Code", "done": False}]\nfor task in tasks:\n    print(task)', 'logs-whole-object'],
         ['tasks = [{"title": "Wash up", "done": True}, {"title": "Read", "done": False}, {"title": "Code", "done": False}]\nfor i in range(len(tasks) + 1):\n    print(tasks[i]["title"])', 'off-by-one'],
         ['tasks = [{"title": "Wash up", "done": True}]\nfor task in tasks:\nprint(task["title"])', 'indentation'],
         ['tasks = []\n# print each title here\n', 'no-output']] }],
    [{ pass: [0], fail: [[1, 'missing-return']] },
     { pass: ['False', 'not True'], fail: [['"False"', 'boolean-as-string'], ['true', 'boolean-capital'], ['True', 'boolean-wrong-value']] },
     { pass: ['def add_task(tasks, title):\n    tasks.append({"title": title, "done": False})', 'def add_task(tasks, title):\n    return tasks + [{"title": title, "done": False}]', 'def add_task(tasks, title):\n    new = {"done": False}\n    new["title"] = title\n    tasks.append(new)\n    return tasks'],
       fail: [['def add_task(tasks, title):\n    pass\n', 'not-started'], ['def add_task(tasks, title):\n    tasks.append(title)', 'title-as-task'], ['def add_task(tasks, title):\n    tasks.append({"title": title})', 'missing-done'],
         ['def add_task(tasks, title):\n    return [{"title": title, "done": False}]', 'add-task'], ['def addtask(tasks, title):\n    pass', 'name-error']] }],
    [{ pass: [0], fail: [[1, 'truthy-condition'], [3, 'truthy-condition']] },
     { pass: ['==', 'is'], fail: [['=', 'assignment-in-condition'], ['!=', 'inverted-condition'], ['is not', 'inverted-condition']] },
     { pass: ['def status_label(task):\n    if task["done"]:\n        return "Done"\n    else:\n        return "To do"', 'def status_label(task):\n    return "Done" if task["done"] else "To do"', 'def status_label(task):\n    if task["done"] == False:\n        return "To do"\n    return "Done"'],
       fail: [['def status_label(task):\n    if task["done"]:\n        print("Done")\n    else:\n        print("To do")', 'log-vs-return'], ['def status_label(task):\n    if task["done"] = True:\n        return "Done"\n    return "To do"', 'assignment-in-condition'],
         ['def status_label(task):\n    return "To do" if task["done"] else "Done"', 'inverted-condition'], ['def status_label(task):\n    return "done" if task["done"] else "to do"', 'string-mismatch'], ['def status_label(task):\n    pass\n', 'not-started']] }]
  ]
};

for (const lang of ['js', 'py']) {
  const L = LANGS[lang];
  test(`${lang}: World 1 is four FREE vaults of exactly three complete challenges`, () => {
    assert.equal(L.free, 4);
    for (let v = 0; v < 4; v++) {
      const vault = L.levels[v];
      assert.ok(vault.concept && L.titles[v], `vault ${v}`);
      assert.equal(vault.ch.length, 3, `vault ${v}`);
      vault.ch.forEach((c, k) => {
        const where = `${lang} ${v}:${k}`;
        assert.ok(['mcq', 'fill', 'code'].includes(c.t), where);
        assert.ok(c.q && c.code && c.tag, where);
        assert.equal(c.hints?.length, 3, `${where}: three hints`);
        if (c.t === 'mcq') { assert.equal(c.opts.filter(o => o[1]).length, 1, where); c.opts.forEach((o, i) => o[1] || assert.ok(o[2] && o[3], `${where} option ${i}: feedback + tag`)); }
        else {
          assert.ok(c.observe && c.checks?.length && c.mistakes?.length, where);
          if (c.t === 'fill') assert.equal(c.code.split('___').length, 2, `${where}: one blank`);
          c.mistakes.forEach(m => assert.ok(m.tag && m.why && typeof m.when === 'function', where));
        }
      });
    }
    assert.deepEqual(L.titles.slice(0, 4), ['Create Your First Task', 'Organize Your Tasks', 'Make Things Work', 'Check Task Status']);
  });

  CASES[lang].forEach((vault, v) => vault.forEach((cases, k) => {
    const c = L.levels[v].ch[k], name = `${lang} vault ${v + 1} · challenge ${k + 1} (${c.t}${c.kind ? ' ' + c.kind : ''})`;
    test(`${name}: correct answers pass, wrong answers fail with the right mistake`, { skip: lang === 'py' && !PY && 'python3 not available' }, () => {
      for (const a of cases.pass) { const r = attempt(lang, c, a); assert.equal(r.passed, true, `should pass: ${JSON.stringify(a)}\n${JSON.stringify(r.j?.results)} ${r.j?.error ?? ''}`); }
      for (const [a, tag] of cases.fail) {
        const r = attempt(lang, c, a);
        assert.equal(r.passed, false, `should fail: ${JSON.stringify(a)}`);
        assert.ok(r.tags.includes(tag), `${JSON.stringify(a)} → expected "${tag}" in ${JSON.stringify(r.tags)}`);
      }
    });
  }));

  test(`${lang}: starter code never passes, and an endless loop is reported as a timeout`, { skip: lang === 'py' && !PY && 'python3 not available' }, () => {
    for (let v = 0; v < 4; v++) for (const c of L.levels[v].ch) if (c.t === 'code') assert.equal(attempt(lang, c, c.code).passed, false, `${lang} ${v}: starter passes`);
    const loop = L.levels[1].ch[2];
    const j = judge(loop, lang === 'js' ? { timedOut: true } : runPy('while True:\n    pass', loop.observe), { code: '' });
    assert.equal(j.passed, false); assert.deepEqual(j.tags, ['loop-timeout']);
  });
}

test('py: the observation harness reports runtime errors with the student\'s line number', { skip: !PY && 'python3 not available' }, () => {
  const o = runPy('x = 1\ny = x + undefined_name\n', { globals: ['x'] });
  assert.equal(o.loadError.message, "NameError: name 'undefined_name' is not defined");
  assert.equal(o.loadError.line, 2);
  const s = runPy('if True\n    pass\n', {});
  assert.match(s.loadError.message, /^SyntaxError/); assert.equal(s.loadError.line, 1);
  assert.deepEqual(runPy('print("a")\nprint("b")', {}).logs, ['a', 'b']);
});

test('js: observation reads top-level bindings, calls functions, sees mutation, and never runs on the real console', () => {
  const o = jsObserve('let n = 2;\nconst f = a => { a.push(n); console.log("called"); return a.length; };', { globals: ['n', 'missing'], calls: [{ id: 'x', fn: 'f', args: [[1]] }, { id: 'y', fn: 'nope', args: [] }] });
  assert.deepEqual(o.globals, { n: 2, missing: undefined });
  assert.deepEqual(o.calls[0], { id: 'x', value: 2, args: [[1, 2]] });
  assert.match(o.calls[1].error, /not defined as a function/);
  assert.deepEqual(o.callLogs, ['called']);
  assert.equal(jsObserve('const = ;', {}).loadError.message.startsWith('SyntaxError'), true);
});
