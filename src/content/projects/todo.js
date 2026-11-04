// PRO project (JavaScript): To-Do App. index.html and style.css are given (read-only tabs); the student
// writes app.js. The checks run inside the sandboxed frame (run/sandbox/harness.js), so `run`, `helpers`
// and `prelude` must be self-contained arrow functions — they can't use anything from this module.
//
// Each check gets fresh, randomised data from `loadTasks()` (`data`, seeded by the code), so a page that
// hardcodes the starting tasks or a fixed "N left" fails. Checks judge what the page does, never how the
// code is written: any approach that behaves correctly passes.
//   check: { id, ms (milestone index), data(rng) → { tasks, add? }, run(t) → t.pass() | t.fail(msg, {expected, actual, tags}),
//            ask (one guiding question, no solution), ask2 (more specific, when it failed last run too) }

export const HTML = '<div class="pv-todo"><h3>My tasks</h3><div class="pv-row"><input id="task" placeholder="New task…" aria-label="New task" autocomplete="off"><button id="add">Add</button></div><ul id="list"></ul><p id="count"></p></div>';

export const CSS = `* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: #F4F1EA; color: #1B1B1F; font: 14px/1.4 Inter, -apple-system, "Segoe UI", system-ui, sans-serif; }
.pv-todo h3 { margin: 0 0 10px; font-size: 20px; }
.pv-row { display: flex; gap: 8px; }
.pv-row input { flex: 1; min-width: 0; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #D8D2C4; background: #fff; font: inherit; color: #1B1B1F; outline: none; }
.pv-row button { height: 36px; padding: 0 14px; border-radius: 8px; border: 0; background: #1B1B1F; color: #F4F1EA; font: 600 14px inherit; cursor: pointer; }
.pv-todo ul { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-todo li { padding: 8px 10px; border-radius: 8px; background: #fff; border: 1px solid #E6E0D3; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.pv-todo li::before { content: ""; width: 14px; height: 14px; border-radius: 4px; border: 2px solid #B8B0A0; flex: none; }
.pv-todo li.done { color: #9A9384; text-decoration: line-through; }
.pv-todo li.done::before { background: #4FD8C4; border-color: #4FD8C4; }
.pv-todo p { margin: 10px 0 0; font-size: 13px; color: #6B6658; font-family: ui-monospace, Menlo, monospace; }`;

// What the read-only tabs show.
export const FILES = {
  'index.html': `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <div class="pv-todo">
      <h3>My tasks</h3>
      <div class="pv-row">
        <input id="task" placeholder="New task…">
        <button id="add">Add</button>
      </div>
      <ul id="list"></ul>
      <p id="count"></p>
    </div>
    <script src="app.js"></script>
  </body>
</html>
`,
  'style.css': CSS + '\n'
};

// Globals the student's code can use: `$` (the starter uses it) and `loadTasks()` (the saved tasks).
export const prelude = (W, data) => {
  W.$ = sel => W.document.querySelector(sel);
  W.loadTasks = () => JSON.parse(JSON.stringify((data && data.tasks) || []));
};

// Helpers for the checks (inside the frame): read the list, add a task, click a task, read #count.
export const helpers = t => {
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const items = () => t.qsa('#list li');
  const texts = () => items().map(li => clean(li.textContent));
  return {
    items, texts,
    show: a => (a.length ? a.map(x => '"' + x + '"').join(', ') : 'no tasks'),
    // each <li> shows its task's title, in order (extra text such as a delete button is fine)
    matches(titles) { const got = texts(); return got.length === titles.length && titles.every((x, k) => got[k] === x || got[k].includes(x)); },
    strangers(titles) { return texts().filter(g => !titles.some(x => g.includes(x))); },
    async add(text) {
      const input = t.qs('#task'), btn = t.qs('#add');
      if (!input || !btn) throw t.missing('#task or #add');
      input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
      t.click(btn); await t.tick();
    },
    async toggle(k) {
      const li = items()[k];
      if (!li) throw t.missing('task ' + (k + 1) + ' in #list');
      t.click(li.querySelector('input[type="checkbox"]') || li); await t.tick();
    },
    doneList: () => items().map(li => li.classList.contains('done')),
    count() { const el = t.qs('#count'); return el ? clean(el.textContent) : null; },
    left() { const c = t.count(); const m = c && /(-?\d+)\s*(?:tasks?\s+)?left\b/i.exec(c); return m ? +m[1] : null; },
    // the tag for a wrong count: missing / not "N left" / counting every task / counting done ones / stale
    countTag(want, all, done) { const n = t.left(); return n === null ? 'count-not-shown' : n === all && want !== all ? 'counts-all-tasks' : n === done && want !== done ? 'count-done-vs-left' : 'count-wrong'; }
  };
};

// ── data (outside the frame) ──
const TITLES = ['Water the plants', 'Call grandma', 'Fix the bike', 'Read chapter 3', 'Buy oat milk', 'Plan the trip', 'Write the report', 'Feed the cat', 'Book the dentist', 'Clean the desk', 'Return the books', 'Practice guitar'];
const NEW = ['Pay the rent', 'Walk the dog', 'Learn regex', 'Bake bread', 'Send the invoice', 'Stretch for 5 minutes', 'Reply to Sam', 'Order a new lamp'];
const pick = (r, list, n) => { const pool = [...list], out = []; while (out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; };
const tasks = (r, n, done = []) => pick(r, TITLES, n).map((title, k) => ({ title, done: done.includes(k) }));
const words = (r, n) => pick(r, NEW, n);

// ── checks (inside the frame) ──
const showsAll = async t => {
  const want = t.data.tasks.map(x => x.title), got = t.texts(), odd = t.strangers(want);
  if (t.matches(want)) return t.pass();
  if (odd.length) return t.fail('#list shows tasks that are not in the data from loadTasks()', { expected: t.show(want), actual: t.show(got), tags: ['render-hardcoded'] });
  return t.fail(want.length ? '#list should show every task from loadTasks(), in order' : '#list should be empty when loadTasks() returns no tasks', { expected: t.show(want), actual: t.show(got), tags: got.length ? ['render-mismatch'] : ['not-rendered'] });
};
const addsOne = async t => {
  const want = [...t.data.tasks.map(x => x.title), t.data.add[0]];
  await t.add(t.data.add[0]);
  const got = t.texts();
  if (t.matches(want)) return t.pass();
  if (got.length === 1 && got[0].includes(t.data.add[0])) return t.fail('adding a task should keep the tasks that were already there', { expected: t.show(want), actual: t.show(got), tags: ['add-replaces'] });
  return t.fail('pressing Add should show the typed task at the end of #list', { expected: t.show(want), actual: t.show(got), tags: ['add-missing'] });
};
const clears = async t => {
  await t.add(t.data.add[0]);
  const v = t.qs('#task').value;
  return v === '' ? t.pass() : t.fail('the input should be empty again after Add', { expected: 'an empty input', actual: '"' + v + '"', tags: ['input-not-cleared'] });
};
const addsTwo = async t => {
  const [a, b] = t.data.add, want = [...t.data.tasks.map(x => x.title), a, b];
  await t.add(a); await t.add(b);
  const got = t.texts();
  if (t.matches(want)) return t.pass();
  return t.fail('after two Adds, both new tasks should be in #list, after the old ones', { expected: t.show(want), actual: t.show(got), tags: got.length <= 1 ? ['add-replaces'] : ['add-missing'] });
};
const togglesOn = async t => {
  await t.toggle(1);
  const d = t.doneList();
  if (d[1] && !d[0] && !d[2]) return t.pass();
  return t.fail(d[1] ? 'only the clicked task should get the "done" class' : 'clicking a task should give its <li> the "done" class', { expected: 'task 2 done, the others not', actual: d.map((x, k) => 'task ' + (k + 1) + (x ? ' done' : ' not done')).join(', '), tags: d[1] ? ['toggle-wrong'] : ['toggle-missing'] });
};
const togglesOff = async t => {
  await t.toggle(0);
  if (!t.doneList()[0]) return t.fail('clicking a task should give its <li> the "done" class', { expected: 'done after one click', actual: 'not done', tags: ['toggle-missing'] });
  await t.toggle(0);
  return !t.doneList()[0] ? t.pass() : t.fail('clicking a done task again should remove "done"', { expected: 'not done after a second click', actual: 'still done', tags: ['toggle-stuck'] });
};
const doneFromData = async t => {
  const want = t.data.tasks.map(x => x.done), got = t.doneList();
  return want.length === got.length && want.every((x, k) => x === got[k]) ? t.pass()
    : t.fail('tasks that are already done in loadTasks() should show the "done" class', { expected: want.map((x, k) => 'task ' + (k + 1) + (x ? ' done' : ' not done')).join(', '), actual: got.length ? got.map((x, k) => 'task ' + (k + 1) + (x ? ' done' : ' not done')).join(', ') : 'no tasks', tags: ['done-not-rendered'] });
};
const keepsDone = async t => {
  await t.toggle(0);
  if (!t.doneList()[0]) return t.fail('clicking a task should give its <li> the "done" class', { expected: 'task 1 done', actual: 'not done', tags: ['toggle-missing'] });
  await t.add(t.data.add[0]);
  const d = t.doneList();
  return d[0] && d.length === 3 && !d[2] ? t.pass() : t.fail('a task marked done should stay done after another task is added', { expected: 'task 1 still done, the new task not done', actual: d.map((x, k) => 'task ' + (k + 1) + (x ? ' done' : ' not done')).join(', '), tags: ['done-lost'] });
};
const togglesNew = async t => {
  await t.add(t.data.add[0]);
  const n = t.items().length;
  if (n !== 3) return t.fail('pressing Add should show the typed task at the end of #list', { expected: '3 tasks', actual: n + ' tasks', tags: ['add-missing'] });
  await t.toggle(2);
  return t.doneList()[2] ? t.pass() : t.fail('a task added with Add should toggle "done" when clicked, too', { expected: 'the new task done', actual: 'not done', tags: ['toggle-missing'] });
};
const countsStart = async t => {
  const all = t.data.tasks.length, done = t.data.tasks.filter(x => x.done).length, want = all - done;
  return t.left() === want ? t.pass() : t.fail('#count should say how many tasks are not done yet', { expected: '"' + want + ' left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: [t.countTag(want, all, done)] });
};
const countsToggle = async t => {
  const all = t.data.tasks.length;
  await t.toggle(0);
  if (t.left() !== all - 1) return t.fail('#count should go down when a task is marked done', { expected: '"' + (all - 1) + ' left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: [t.left() === all ? 'count-stale' : t.countTag(all - 1, all, 1)] });
  await t.toggle(0);
  return t.left() === all ? t.pass() : t.fail('#count should go back up when a done task is clicked again', { expected: '"' + all + ' left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: ['count-stale'] });
};
const countsAdd = async t => {
  const want = t.data.tasks.length + 1;
  await t.add(t.data.add[0]);
  return t.left() === want ? t.pass() : t.fail('#count should go up when a task is added', { expected: '"' + want + ' left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: [t.left() === want - 1 ? 'count-stale' : t.countTag(want, want, 0)] });
};
const countsEmpty = async t => (t.left() === 0 ? t.pass() : t.fail('with no tasks at all, #count should say "0 left"', { expected: '"0 left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: [t.left() === null ? 'count-not-shown' : 'count-wrong'] }));
const countsAllDone = async t => {
  await t.toggle(0); await t.toggle(1);
  return t.left() === 0 ? t.pass() : t.fail('when every task is done, #count should say "0 left"', { expected: '"0 left"', actual: t.count() ? '"' + t.count() + '"' : 'nothing', tags: [t.left() === 2 ? 'count-stale' : 'count-wrong'] });
};

const ASK = {
  show: ['After your code runs, how many `<li>` elements does #list hold — and where does each one get its text?', 'Which line of your code runs once for every task that `loadTasks()` gave you?'],
  hard: ['The checks start with different tasks each time. Does your list come from `tasks`, or from text typed into the code?', 'If `loadTasks()` returned three tasks you have never seen, what would your page show?'],
  add: ['When Add is clicked, what should change first: the data in `tasks`, or the page — and how does the other one find out?', 'After the click, which of your lines puts the new task on the page — and does it keep the tasks that were already there?'],
  clear: ['After a task is added, what should be left in the input box?', 'Which property of the `#task` input holds the text the user typed?'],
  toggle: ['When a task is clicked, where is it remembered that it is done — and how does the `<li>` show it?', 'Which element gets the click handler, and what does the handler change?'],
  keep: ['When the list is drawn again after Add, where does each `<li>` find out whether its task is done?', 'Does your drawing code read each task\'s `done` value — or only its title?'],
  count: ['Which tasks count as “left”, and which property tells you?', 'Where in your code is #count written — and does that code run again after every change?']
};
const C = (id, ms, data, run, [ask, ask2]) => ({ id, ms, data, run, ask, ask2 });

export const CHECKS = [
  C('show-all', 0, r => ({ tasks: tasks(r, 3) }), showsAll, ASK.show),
  C('show-other', 0, r => ({ tasks: tasks(r, 2) }), showsAll, ASK.hard),
  C('show-empty', 0, () => ({ tasks: [] }), showsAll, ASK.show),
  C('add-one', 1, r => ({ tasks: tasks(r, 2), add: words(r, 1) }), addsOne, ASK.add),
  C('add-clears', 1, r => ({ tasks: tasks(r, 2), add: words(r, 1) }), clears, ASK.clear),
  C('add-twice', 1, r => ({ tasks: tasks(r, 2), add: words(r, 2) }), addsTwo, ASK.add),
  C('toggle-on', 2, r => ({ tasks: tasks(r, 3) }), togglesOn, ASK.toggle),
  C('toggle-off', 2, r => ({ tasks: tasks(r, 2) }), togglesOff, ASK.toggle),
  C('done-from-data', 2, r => ({ tasks: tasks(r, 3, [1 + Math.floor(r() * 2)]) }), doneFromData, ASK.keep),
  C('done-kept', 2, r => ({ tasks: tasks(r, 2), add: words(r, 1) }), keepsDone, ASK.keep),
  C('toggle-new', 2, r => ({ tasks: tasks(r, 2), add: words(r, 1) }), togglesNew, ASK.toggle),
  C('count-start', 3, r => ({ tasks: tasks(r, 3, [Math.floor(r() * 3)]) }), countsStart, ASK.count),
  C('count-toggle', 3, r => ({ tasks: tasks(r, 3) }), countsToggle, ASK.count),
  C('count-add', 3, r => ({ tasks: tasks(r, 2), add: words(r, 1) }), countsAdd, ASK.count),
  C('count-empty', 3, () => ({ tasks: [] }), countsEmpty, ASK.count),
  C('count-all-done', 3, r => ({ tasks: tasks(r, 2) }), countsAllDone, ASK.count)
];

// Errors and timeouts: one guiding question each (scripted fallback for the mentor).
const at = e => (e.line ? ` (line ${e.line})` : '');
export const ERROR_ASK = {
  timeout: 'Your code never finished, so I stopped it before it could freeze the page. Look at your loops: what changes each time round — and when does the condition become false?',
  error(e) {
    const m = e.message;
    if (e.kind === 'syntax' || e.name === 'SyntaxError') return `**Syntax error${at(e)}:** \`${m}\`. Nothing ran yet. Which bracket, quote or comma on that line — or the line before — is missing its partner?`;
    const name = /^(\S+) is not defined/.exec(m);
    if (name) return `\`${name[1]}\` is not defined${at(e)}. Where did you create it — and is the spelling exactly the same, capitals included?`;
    if (/of null/.test(m)) return `\`${m}\`${at(e)} — a selector found nothing. Which selector did you pass, and does index.html have an element with exactly that id?`;
    if (/is not a function/.test(m)) return `\`${m}\`${at(e)}. What kind of value is it really? A \`console.log\` of it would tell you.`;
    return `\`${e.name}: ${m}\`${at(e)}. What value did that line expect, and what did it actually get?`;
  }
};

export const TODO = {
  title: 'To-Do App', file: 'app.js', cmd: 'npm test', url: 'localhost:3000 — my-todo-app',
  brief: 'Build a working to-do list. The HTML and CSS are ready — you write **app.js**. `loadTasks()` gives you the saved tasks; your page has to show whatever it returns. Hit all four milestones; your AI mentor reviews every run.',
  starter: '// The HTML is ready: #task, #add, #list, #count\n// loadTasks() gives you the saved tasks: [{ title: "…", done: false }, …]\nconst tasks = loadTasks();\nconst list = $("#list");\n\n',
  ms: [
    { n: 'Show the tasks', d: 'Render every task from loadTasks() as an <li> in #list.',
      hints: ['Every task in `tasks` needs its own `<li>`. Which tool from World 1 visits each item of an array once?',
        'Inside that loop: create an element, give it the task\'s `title` as its text, then put it inside `list`. Which method adds a child element?',
        'Put the drawing in one function and call it at the end of the file. Does your page now show the data, whatever `loadTasks()` returned?'],
      alt: 'Another valid way: build the `<li>` HTML as one string with `map` and `join`, then set `list.innerHTML` once. The checks only look at what the page shows.' },
    { n: 'Add new tasks', d: 'Add puts the input text in a new task, shows it, then clears the input.',
      hints: ['The Add button needs a click handler. What should happen to `tasks` when it is clicked — before anything changes on the page?',
        'Read the text from `#task`, add a new task object to `tasks`, then empty the input. How does the list on the page find out?',
        'If one function draws the whole list from `tasks`, adding is: change the data, then draw again. Does your drawing function clear the list before it draws?'],
      alt: '`addEventListener("click", …)` instead of `onclick` works just the same — use whichever reads better to you.' },
    { n: 'Mark as done', d: 'Done tasks show the "done" class; clicking a task toggles it — and it stays when you add more.',
      hints: ['Where does a task remember that it is done — on the page, or in its object in `tasks`?',
        'Give each `<li>` a click handler that flips its task\'s `done` value, then draw again. While drawing, how do you add the `done` class only to finished tasks?',
        'If your drawing code reads `task.done` to decide the class, the mark survives every redraw — including the one after Add. Does yours?'],
      alt: 'Another way: one click listener on `#list` that finds the clicked `<li>` with `event.target.closest("li")` — called event delegation.' },
    { n: 'Count what\'s left', d: 'Show "N left" in #count — and keep it right after every change.',
      hints: ['Which tasks count as “left” — and which property tells you?',
        'Count the tasks whose `done` is false — a loop with a counter works, so does `filter`. How do you then put that number, followed by " left", into `#count`?',
        'The count has to be written on start, after Add and after every click. Is there one place in your code that runs at all three moments?'],
      alt: 'A loop with a counter is just as valid as `filter(...).length` — both read the same data.' }
  ],
  checks: CHECKS, html: HTML, css: CSS, files: FILES, prelude, helpers, errorAsk: ERROR_ASK,
  preview: { tasks: [{ title: 'Learn JavaScript', done: false }, { title: 'Crack a vault', done: false }] },
  final: '**Final review: 92/100.** Every check passes: the list, Add, done marks and the count all follow your `tasks` data. Next step: save `tasks` with `localStorage` so they survive a refresh.'
};
