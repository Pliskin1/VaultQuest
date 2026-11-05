// JavaScript PRO project (To-Do App): the real harness, checks and adapter (run/project-js.js) against many
// student programs — different valid approaches pass, typical mistakes fail with the right mistake tags,
// hardcoding fails, loops/recursion/microtask storms stop, every check gets a fresh page. Frames are
// simulated in-process (tests/helpers/frame.js); real sandboxed frames are covered by browser verification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS } from '../src/content/languages.js';
import { runJsProject, jsData, guarded, syntaxError } from '../src/run/project-js.js';
import { srcdoc, bootScript } from '../src/run/sandbox/frame.js';
import { seedOf } from '../src/run/seed.js';
import { judgeRun, runTags } from '../src/learn/workspace.js';
import { newWorkspace } from '../src/learn/attempt.js';
import { vmFrame } from './helpers/frame.js';
import { RENDER } from './helpers/solutions.js';
import { Worker } from 'node:worker_threads';

const lv = LANGS.js.levels[6];
const run = (code, o = {}) => runJsProject(code, lv, { seed: seedOf(code), runFrame: vmFrame, ...o });
const passing = r => r.checks.filter(c => c.pass).map(c => c.id);
const failing = r => r.checks.filter(c => !c.pass).map(c => c.id);
const tagsOf = r => [...new Set(r.checks.flatMap(c => c.tags ?? []))];
const ALL = lv.checks.map(c => c.id);
const msChecks = k => lv.checks.filter(c => c.ms === k).map(c => c.id);

// ── valid approaches ──
// Keeps the state in the DOM: appends one element per task and counts the <li> without "done".
const DOM_STATE = `const list = document.getElementById("list");
const count = document.querySelector("#count");
function updateCount() {
  const left = [...list.children].filter(li => !li.classList.contains("done")).length;
  count.textContent = \`\${left} left\`;
}
function addItem(task) {
  const li = document.createElement("li");
  li.textContent = task.title;
  if (task.done) li.classList.add("done");
  li.addEventListener("click", () => { li.classList.toggle("done"); updateCount(); });
  list.append(li);
}
loadTasks().forEach(addItem);
updateCount();
document.querySelector("#add").addEventListener("click", () => {
  const input = document.querySelector("#task");
  addItem({ title: input.value, done: false });
  input.value = "";
  updateCount();
});
`;
// HTML string + event delegation + a counting loop, and "N tasks left".
const DELEGATION = `const tasks = loadTasks();
const list = $("#list");
const draw = () => {
  list.innerHTML = tasks.map((t, i) => \`<li data-i="\${i}" class="\${t.done ? "done" : ""}">\${t.title}</li>\`).join("");
  let left = 0;
  for (let i = 0; i < tasks.length; i++) { if (!tasks[i].done) left++; }
  $("#count").textContent = left + " tasks left";
};
list.addEventListener("click", e => {
  const li = e.target.closest("li");
  if (!li) return;
  const t = tasks[Number(li.getAttribute("data-i"))];
  t.done = !t.done;
  draw();
});
$("#add").onclick = function () {
  tasks.push({ title: $("#task").value, done: false });
  $("#task").value = "";
  draw();
};
draw();
`;
// A checkbox inside each task, toggled through the checkbox.
const CHECKBOX = RENDER.replace('li.textContent = task.title;', 'const box = document.createElement("input");\n    box.type = "checkbox";\n    box.checked = task.done;\n    li.appendChild(box);\n    li.append(" " + task.title);')
  .replace('li.onclick = () => { task.done = !task.done; render(); };', 'box.onclick = () => { task.done = !task.done; render(); };');

for (const [name, code] of [['one render() function', RENDER], ['state kept in the DOM', DOM_STATE], ['innerHTML + event delegation', DELEGATION], ['a checkbox per task', CHECKBOX]]) {
  test(`valid approach passes every check: ${name}`, async () => {
    const r = await run(code);
    assert.equal(r.error, null, JSON.stringify(r.error)); assert.equal(r.timeout, false);
    assert.deepEqual(failing(r), [], JSON.stringify(r.checks.filter(c => !c.pass)));
    assert.equal(passing(r).length, 16);
  });
}

test('there are several checks per milestone, more checks than milestones', () => {
  assert.equal(lv.ms.length, 4); assert.equal(lv.checks.length, 16);
  for (let k = 0; k < 4; k++) assert.ok(msChecks(k).length >= 3, `milestone ${k + 1}`);
  assert.equal(new Set(ALL).size, ALL.length);
});

// ── mistakes ──
const STARTER_PLUS = s => lv.starter + s;
const M1 = STARTER_PLUS('function render() {\n  list.innerHTML = "";\n  tasks.forEach(task => {\n    const li = document.createElement("li");\n    li.textContent = task.title;\n    list.appendChild(li);\n  });\n}\nrender();\n');

test('the starter passes nothing but the empty-list check', async () => {
  const r = await run(lv.starter);
  assert.deepEqual(passing(r), ['show-empty']);
  assert.ok(tagsOf(r).includes('not-rendered'));
});

test('milestone 1 only: the list renders, nothing else is claimed', async () => {
  const r = await run(M1);
  assert.deepEqual(passing(r).filter(id => msChecks(0).includes(id)), msChecks(0));
  assert.ok(failing(r).includes('add-one') && failing(r).includes('count-start'));
});

test('hardcoded tasks and a hardcoded count fail — the checks use different data each time', async () => {
  const code = '$("#list").innerHTML = "<li>Learn JavaScript</li><li>Crack a vault</li>";\n$("#count").textContent = "2 left";\n';
  const r = await run(code);
  assert.ok(failing(r).includes('show-all') && failing(r).includes('show-other'));
  assert.ok(tagsOf(r).includes('render-hardcoded'));
  assert.ok(failing(r).includes('count-start') || failing(r).includes('count-add'));
  // a page copied from one run's data still fails on other data
  const d = jsData(lv, 1)[0].tasks, copy = `$("#list").innerHTML = ${JSON.stringify(d.map(t => `<li>${t.title}</li>`).join(''))};`;
  const r2 = await run(copy);
  assert.ok(failing(r2).includes('show-other'), 'show-other uses different tasks than show-all');
});

test('innerHTML = "<li>…</li>" in the Add handler wipes the list (add-replaces)', async () => {
  const r = await run(M1 + '\n$("#add").onclick = () => {\n  list.innerHTML = "<li>" + $("#task").value + "</li>";\n};\n');
  assert.ok(failing(r).includes('add-one') && failing(r).includes('add-twice'));
  assert.ok(tagsOf(r).includes('add-replaces'));
});

test('forgetting to clear the input fails only that check of milestone 2', async () => {
  const r = await run(RENDER.replace('  $("#task").value = "";\n', ''));
  assert.deepEqual(failing(r), ['add-clears']);
  assert.deepEqual([...r.checks.find(c => c.id === 'add-clears').tags], ['input-not-cleared']);
});

test('done marks kept only on the page are lost when the list is redrawn (done-lost / done-not-rendered)', async () => {
  const code = RENDER.replace('    if (task.done) li.classList.add("done");\n', '').replace('li.onclick = () => { task.done = !task.done; render(); };', 'li.onclick = () => { li.classList.toggle("done"); };');
  const r = await run(code);
  assert.ok(failing(r).includes('done-kept') && failing(r).includes('done-from-data'));
  assert.ok(tagsOf(r).includes('done-lost') && tagsOf(r).includes('done-not-rendered'));
  assert.ok(passing(r).includes('toggle-on') && passing(r).includes('toggle-off'));
});

test('a count worked out once at the start goes stale; counting every task is caught', async () => {
  const once = RENDER.replace('  const left = tasks.filter(t => !t.done).length;\n  $("#count").textContent = left + " left";\n', '').replace('\nrender();\n', '\nrender();\n$("#count").textContent = tasks.filter(t => !t.done).length + " left";\n');
  const r = await run(once);
  assert.ok(passing(r).includes('count-start') && passing(r).includes('count-empty'));
  assert.ok(failing(r).includes('count-toggle') && failing(r).includes('count-add'));
  assert.ok(tagsOf(r).includes('count-stale'));
  const all = await run(RENDER.replace('tasks.filter(t => !t.done).length', 'tasks.length'));
  assert.ok(tagsOf(all).includes('counts-all-tasks'));
  const noWord = await run(RENDER.replace('left + " left"', 'left'));
  assert.ok(tagsOf(noWord).includes('count-not-shown'));
});

// ── errors, loops, isolation ──
test('a syntax error is reported with its line, and nothing runs', async () => {
  const r = await run(lv.starter + 'function render( {\n}\n');
  assert.equal(r.error.kind, 'syntax'); assert.equal(r.error.name, 'SyntaxError'); assert.ok(r.error.line >= 5, JSON.stringify(r.error));
  assert.deepEqual(passing(r), []);
  const j = judgeRun(newWorkspace(4), r, 4);
  assert.ok(runTags('js', r, j).includes('syntax-error'));
});

test('a runtime error names the line and is diagnosed (null element)', async () => {
  const r = await run(lv.starter + '$("#lst").textContent = "x";\n');
  assert.equal(r.error.kind, 'runtime'); assert.equal(r.error.line, 6); assert.match(r.error.message, /null/);
  assert.ok(runTags('js', r, judgeRun(newWorkspace(4), r, 4)).includes('null-element'));
});

for (const [name, code] of [
  ['while (true) {} at the top', 'while (true) {}'],
  ['while (true); at the top', 'while (true);'],
  ['for (;;) {} at the top', 'for (;;) {}'],
  ['an array that grows while it is looped over', 'const t = loadTasks(); for (const x of t) t.push(x);'],
  ['a loop that never ends inside the Add handler', RENDER.replace('  render();\n};', '  while (true) {}\n};')],
  ['runaway recursion on click', RENDER.replace('li.onclick = () => { task.done = !task.done; render(); };', 'li.onclick = function boom() { boom(); };')]
]) {
  test(`stops instead of freezing: ${name}`, async () => {
    // two checks are enough here (each stopped loop uses up the guard's time budget)
    const few = { ...lv, checks: lv.checks.filter(c => c.id === 'show-all' || c.id === 'toggle-new') };
    const t0 = Date.now(), r = await runJsProject(code, few, { seed: 3, runFrame: vmFrame });
    assert.ok(Date.now() - t0 < 15000);
    assert.ok(r.timeout || r.error, JSON.stringify(r).slice(0, 300));
    assert.ok(failing(r).length > 0);
  });
}

test('a microtask chain that never yields is stopped (repeated async callbacks)', async () => {
  const w = new Worker(new URL('./helpers/microtask-worker.js', import.meta.url), { workerData: { code: 'const f = () => Promise.resolve().then(f); f();' } });
  const r = await new Promise((res, rej) => { w.once('message', res); w.once('error', rej); });
  await w.terminate();
  assert.deepEqual(r, { timeout: true, failing: 2 });
});

test('every check gets a fresh page: state from one check never leaks into another', async () => {
  const leaky = 'window.__runs = (window.__runs || 0) + 1;\nif (window.__runs > 1) throw new Error("state leaked");\n' + RENDER;
  const r = await run(leaky);
  assert.deepEqual(failing(r), []);
});

test('student code can\'t forge a passing result without the run\'s secret', async () => {
  const forge = lv.starter + 'for (const id of ["show-all", "add-one"]) parent.postMessage({ vq: "result", check: id, pass: true, nonce: "guess" }, "*");\n';
  const r = await run(forge);
  assert.ok(failing(r).includes('show-all') && failing(r).includes('add-one'));
});

test('the same code always gets the same data; different code gets different data', () => {
  assert.deepEqual(jsData(lv, seedOf(RENDER)), jsData(lv, seedOf(RENDER)));
  assert.notDeepEqual(jsData(lv, seedOf(RENDER)), jsData(lv, seedOf(RENDER + '// x')));
  assert.equal(seedOf('a\n\n\nb  '), seedOf('a\n\nb')); // insignificant whitespace = same code
});

test('a run whose student left meanwhile stops and reports cancelled', async () => {
  let calls = 0;
  const r = await run(RENDER, { isStale: () => ++calls > 1 });
  assert.deepEqual(r, { cancelled: true });
});

test('the frame page: sandbox CSP, no network, and student code can\'t break out of the script tag', () => {
  const doc = srcdoc({ html: lv.html, css: lv.css, checks: {}, prelude: lv.prelude }, { mode: 'preview', nonce: 'n1', code: 'const s = "</script><script>parent.alert(1)</script>";', data: {} });
  assert.match(doc, /Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'/);
  assert.equal(doc.split('</script>').length, 2, 'only the harness script tag closes');
  assert.ok(!/<script>parent/.test(doc));
  assert.doesNotThrow(() => new Function(bootScript({ checks: { a: async t => t.pass() } }, { code: '</script>' })));
});

test('code is guarded before it runs, and code that does not parse is never instrumented', () => {
  assert.match(guarded('while (x) {}'), /__vq\(\)&&\(x\)/);
  assert.ok(syntaxError('const = 1;')); assert.equal(syntaxError(RENDER), null);
});
