// JavaScript World 1 (curriculum js-2): four FREE vaults that build the pieces of the To-Do app — a task
// object, a list of tasks, a function that adds tasks, and conditions on whether a task is done.
// Source: docs/PLAN.md §D.2–D.5. Format (shared with content/py-world1.js):
//  mcq:  opts [label, isCorrect, why, mistakeTag]
//  fill: code is a template with ___; the filled code really runs and `checks` judge what it did
//  code: editable starter (kind 'fix' | 'write'); runs for real, judged by `checks`
//  observe: what the runner reports (globals / calls / logs) · mistakes: [{ tag, when(ctx), why }] (learn/judge.js)
//  tag: the concept the challenge tests (any wrong answer is evidence of it) · hints: three, free, never the code.
import { check, result, binding, call, listAfter, jsShow as show } from './kit.js';

const isNew = t => t && t.title === 'Read' && t.done === false;

export const JS_WORLD1 = [
  // ── Vault 1 · Create Your First Task ──
  { concept: 'A **task** is an object: a title (a string, in quotes) and whether it\'s done (a boolean, `true` or `false`). Read one property with a dot: `task.title`.',
    ch: [
      { t: 'mcq', tag: 'dot-access', q: 'What does this program print?', code: 'const task = { title: "Buy milk", done: false };\nconsole.log(task.title);',
        opts: [['Buy milk', 1], ['"Buy milk"', 0, '`console.log` shows the **value** of a string. Does it print the quote marks around it?', 'quotes-in-output'], ['title', 0, '`task.title` reads what is **stored under** `title`. Is that the property\'s name, or its value?', 'property-vs-value'], ['false', 0, '`false` is stored under `done`. Which property does `task.title` read?', 'property-vs-value']],
        hints: ['`task.title` reads one property of the object.', 'The value stored under `title` is a piece of text.', 'When a string is printed, are its quote marks part of the output?'] },
      { t: 'fill', tag: 'boolean-literal', q: 'Give the task a **boolean** so it starts unfinished.', code: 'const task = { title: "Learn JS", done: ___ };',
        observe: { globals: ['task'] },
        checks: [
          check('bool', '`done` is a boolean', o => result(typeof binding(o, 'task')?.done === 'boolean', 'a boolean', show(binding(o, 'task')?.done))),
          check('open', 'The task starts unfinished', o => result(binding(o, 'task')?.done === false, 'false', show(binding(o, 'task')?.done)))],
        mistakes: [
          { tag: 'boolean-as-string', when: ({ obs }) => typeof binding(obs, 'task')?.done === 'string', why: '`done` became **text**, not a yes/no value. What is the difference between `false` and `"false"`?' },
          { tag: 'boolean-wrong-value', when: ({ obs }) => binding(obs, 'task')?.done === true, why: 'That makes the task **finished** already. Which boolean means "not done yet"?' }],
        hints: ['A boolean is a yes/no value.', 'Booleans are written without quotes.', '"Unfinished" means not done — which of the two booleans says no?'] },
      { t: 'code', kind: 'fix', tag: 'object-syntax', q: 'This task object crashes. Fix it so `task` has a title and is unfinished.', code: 'const task = {\n  title: Read a book,\n  done: false\n};\n',
        observe: { globals: ['task'] },
        checks: [
          check('runs', 'The code runs', o => result(!o.loadError, 'no error', o.loadError?.message ?? 'no error')),
          check('title', '`title` is some text', o => { const t = binding(o, 'task')?.title; return result(typeof t === 'string' && t.trim() !== '', 'a string', show(t)); }),
          check('open', '`done` is false', o => result(binding(o, 'task')?.done === false, 'false', show(binding(o, 'task')?.done)))],
        mistakes: [
          { tag: 'string-not-quoted', when: ({ code }) => /title\s*:\s*[A-Za-z][^,\n]*\s[A-Za-z]/.test(code), why: 'Look at the title. How does JavaScript tell the difference between text and code — what does text need around it?' },
          { tag: 'missing-comma', when: ({ code, error }) => /^SyntaxError/.test(error) && /title\s*:\s*(["'`])[^\n]*\1\s*\n\s*done/.test(code), why: 'The title is text now. Compare the end of the `title` line with how one property is separated from the next.' }],
        hints: ['Read the error message: which line can JavaScript not understand?', '`Read a book` is meant to be text. What does text need around it?', 'Each property is `name: value`, separated from the next one by a comma.'] }
    ] },

  // ── Vault 2 · Organize Your Tasks ──
  { concept: 'An **array** keeps many items in order: `["Read", "Code"]`. `.length` counts them, `.push(item)` adds one at the end, and a loop visits each item in turn.',
    ch: [
      { t: 'mcq', tag: 'array-length', q: 'What does this program print?', code: 'const tasks = ["Wash up", "Read", "Code"];\nconsole.log(tasks.length);',
        opts: [['3', 1], ['2', 0, '`length` counts the items. How many strings are in the array?', 'length-vs-index'], ['"Code"', 0, 'That\'s the last item. Does `length` give an item, or how many items there are?', 'length-vs-index'], ['undefined', 0, 'Every array has a `length`. What does it count?', 'length-vs-index']],
        hints: ['`length` is a count, not a position.', 'Count the strings between the brackets.', 'Positions start at 0 — but counting starts at 1.'] },
      { t: 'fill', tag: 'array-push', q: 'Add `newTask` to the array, so it has **three** tasks.', code: 'const tasks = ["Wash up", "Read"];\nconst newTask = "Code";\ntasks.___(newTask);',
        observe: { globals: ['tasks'] },
        checks: [
          check('three', '`tasks` has 3 items', o => { const t = binding(o, 'tasks'); return result(Array.isArray(t) && t.length === 3, '3 items', Array.isArray(t) ? `${t.length} items` : show(t)); }),
          check('code', '"Code" is in the list', o => { const t = binding(o, 'tasks'); return result(Array.isArray(t) && t.includes('Code'), 'contains "Code"', show(t)); })],
        mistakes: [
          { tag: 'push-length', when: ({ answer }) => answer.trim() === 'length', why: '`length` tells you how many items there are. Can it also add one?' },
          { tag: 'not-a-method', when: ({ error }) => /is not a function/.test(error), why: 'JavaScript says that isn\'t an array method. Which method **adds** an item to an array?' }],
        hints: ['You want an array method that adds an item.', 'It adds the item at the end of the list.', 'Think of the array as a stack you add onto.'] },
      { t: 'code', kind: 'write', tag: 'loop-titles', q: 'Print every task\'s **title** with `console.log`, in order. Use a loop of any kind.',
        code: 'const tasks = [\n  { title: "Wash up", done: true },\n  { title: "Read", done: false },\n  { title: "Code", done: false }\n];\n\n// print each title here\n',
        observe: { logs: true },
        checks: [check('titles', 'Prints Wash up, Read, Code — one per line', o => result(JSON.stringify(o.logs) === JSON.stringify(['Wash up', 'Read', 'Code']), 'Wash up · Read · Code', o.logs.length ? o.logs.join(' · ') : 'nothing'))],
        mistakes: [
          { tag: 'no-output', when: ({ obs }) => !obs.loadError && obs.logs.length === 0, why: 'Nothing was printed. Which line of your code calls `console.log` — and does it run?' },
          { tag: 'logs-whole-object', when: ({ obs }) => obs.logs.some(l => l.startsWith('{')), why: 'Each line shows a whole task. How do you read just one property of an object?' },
          { tag: 'off-by-one', when: ({ obs, error }) => /Cannot read properties of undefined/.test(error) || obs.logs.includes('undefined') || (obs.logs.length > 0 && obs.logs.length !== 3), why: 'Count the printed lines. Where does your loop start, and where does it stop?' }],
        hints: ['`for (const task of tasks) { … }` visits each task in turn.', 'Inside the loop, print one property of the current task.', 'You want each title — not the whole object.'] }
    ] },

  // ── Vault 3 · Make Things Work ──
  { concept: 'A **function** is a named recipe: `function add(a, b) { return a + b; }`. **Parameters** receive the inputs, and `return` hands the result back — `console.log` only prints it.',
    ch: [
      { t: 'mcq', tag: 'return-value', q: 'What does this program print?', code: 'function double(n) {\n  n * 2;\n}\nconsole.log(double(4));',
        opts: [['undefined', 1], ['8', 0, '`n * 2` is calculated — but is the result handed back to the caller?', 'missing-return'], ['4', 0, 'Is anything handed back from `double`? Look for the keyword that does that.', 'missing-return'], ['NaN', 0, '`n * 2` works fine. The question is what `double(4)` gives back.', 'missing-return']],
        hints: ['Look at what the function **gives back**, not what it calculates.', 'Which keyword hands a value back — and is it there?', 'A function that hands nothing back gives a special "no value".'] },
      { t: 'fill', tag: 'task-shape', q: 'New tasks should start **unfinished**. Fill the blank.', code: 'function newTask(title) {\n  return { title: title, done: ___ };\n}',
        observe: { calls: [{ id: 'read', fn: 'newTask', args: ['Read'] }] },
        checks: [check('shape', '`newTask("Read")` gives an unfinished task called Read', o => { const v = call(o, 'read').value; return result(isNew(v), '{ title: "Read", done: false }', show(v)); })],
        mistakes: [
          { tag: 'boolean-as-string', when: ({ obs }) => typeof call(obs, 'read').value?.done === 'string', why: '`done` is text here. Which kind of value says yes or no?' },
          { tag: 'boolean-wrong-value', when: ({ obs }) => call(obs, 'read').value?.done === true, why: 'A new task would start finished. Which boolean means "not done"?' }],
        hints: ['`done` should be a yes/no value.', 'No quotes around it.', 'A brand-new task hasn\'t been finished yet.'] },
      { t: 'code', kind: 'write', tag: 'add-task', q: 'Write `addTask(tasks, title)`: it adds a new **unfinished** task with that title to the list.', code: 'function addTask(tasks, title) {\n\n}\n',
        observe: { calls: [{ id: 'empty', fn: 'addTask', args: [[], 'Read'] }, { id: 'one', fn: 'addTask', args: [[{ title: 'Code', done: false }], 'Read'] }] },
        checks: [
          check('empty', 'Adds a task to an empty list', o => { const l = listAfter(o, 'empty'); return result(Array.isArray(l) && l.length === 1 && isNew(l[0]), '[{ title: "Read", done: false }]', show(l)); }),
          check('keep', 'Keeps the tasks already there', o => { const l = listAfter(o, 'one'); return result(Array.isArray(l) && l.length === 2 && l.some(t => t?.title === 'Code'), '2 tasks, "Code" kept', show(l)); }),
          check('new', 'The new task is unfinished', o => { const l = listAfter(o, 'one'); return result(Array.isArray(l) && l.some(isNew), 'includes { title: "Read", done: false }', show(l)); })],
        mistakes: [
          { tag: 'not-started', when: ({ obs }) => !obs.loadError && call(obs, 'empty').value === undefined && (call(obs, 'empty').args?.[0] ?? []).length === 0, why: 'Calling `addTask` doesn\'t change anything yet. What should happen to `tasks`?' },
          { tag: 'title-as-task', when: ({ obs }) => (listAfter(obs, 'empty') ?? []).includes('Read'), why: 'The list now holds the text "Read" on its own. What does a task look like in this app?' },
          { tag: 'missing-done', when: ({ obs }) => (listAfter(obs, 'empty') ?? []).some(t => t && typeof t === 'object' && !('done' in t)), why: 'The new task has a title. What else does every task need to know about itself?' }],
        hints: ['Build a task object for the new title.', 'Every task has a `title` and a `done` flag — and new tasks aren\'t done.', 'Put the new task into the list (or give back a new list that includes it).'] }
    ] },

  // ── Vault 4 · Check Task Status ──
  { concept: '`if (condition) { … } else { … }` runs one branch or the other. Compare with `===` — a single `=` **stores** a value — and flip a condition with `!`.',
    ch: [
      { t: 'mcq', tag: 'if-branch', q: 'What does this program print?', code: 'const task = { title: "Read", done: false };\nif (task.done) {\n  console.log("Finished");\n} else {\n  console.log("Keep going");\n}',
        opts: [['Keep going', 1], ['Finished', 0, 'The first block only runs when the condition is true. What is `task.done` here?', 'truthy-condition'], ['Finished Keep going', 0, 'Can both branches of an `if / else` run?', 'truthy-condition'], ['Nothing', 0, 'One of the two branches always runs. Which one does `false` choose?', 'truthy-condition']],
        hints: ['What is the value of `task.done`?', '`if` runs its first block only for a true condition.', 'Otherwise, the `else` block runs.'] },
      { t: 'fill', tag: 'compare', q: 'Make `isOpen` return `true` only for **unfinished** tasks.', code: 'function isOpen(task) {\n  return task.done ___ false;\n}',
        observe: { calls: [{ id: 'open', fn: 'isOpen', args: [{ title: 'Read', done: false }] }, { id: 'done', fn: 'isOpen', args: [{ title: 'Code', done: true }] }] },
        checks: [
          check('open', 'An unfinished task is open', o => result(call(o, 'open').value === true, 'true', show(call(o, 'open').value))),
          check('done', 'A finished task is not open', o => result(call(o, 'done').value === false, 'false', show(call(o, 'done').value)))],
        mistakes: [
          { tag: 'assignment-in-condition', when: ({ answer }) => answer.trim() === '=', why: 'A single `=` **stores** a value. Is this line meant to change the task, or to ask about it?' },
          { tag: 'inverted-condition', when: ({ answer }) => /^!==?$/.test(answer.trim()), why: 'Try it by hand with an unfinished task: is `done` equal to `false`, or not?' }],
        hints: ['You need an operator that **compares** two values.', 'A single `=` would change `task.done` instead.', 'JavaScript\'s strict comparison checks the value and the type.'] },
      { t: 'code', kind: 'write', tag: 'status-label', q: 'Write `statusLabel(task)`: return `"Done"` for a finished task and `"To do"` otherwise.', code: 'function statusLabel(task) {\n\n}\n',
        observe: { calls: [{ id: 'done', fn: 'statusLabel', args: [{ title: 'Code', done: true }] }, { id: 'open', fn: 'statusLabel', args: [{ title: 'Read', done: false }] }] },
        checks: [
          check('done', 'A finished task → "Done"', o => result(call(o, 'done').value === 'Done', '"Done"', show(call(o, 'done').value))),
          check('open', 'An unfinished task → "To do"', o => result(call(o, 'open').value === 'To do', '"To do"', show(call(o, 'open').value)))],
        mistakes: [
          { tag: 'log-vs-return', when: ({ obs }) => obs.callLogs.length > 0 && call(obs, 'done').value === undefined, why: 'Your function **printed** a label but gave back `undefined`. What\'s the difference between printing a value and returning it?' },
          { tag: 'assignment-in-condition', when: ({ code }) => /if\s*\([^)]*[^=!<>]=[^=>][^)]*\)/.test(code), why: 'Look at your `if` condition. Does it **check** `task.done`, or change it?' },
          { tag: 'inverted-condition', when: ({ obs }) => call(obs, 'done').value === 'To do' && call(obs, 'open').value === 'Done', why: 'Both labels appear — but on the wrong tasks. Which branch runs for a finished task?' },
          { tag: 'string-mismatch', when: ({ obs }) => [call(obs, 'done').value, call(obs, 'open').value].some(v => typeof v === 'string' && !['Done', 'To do'].includes(v) && ['done', 'to do', 'todo'].includes(v.toLowerCase().trim())), why: 'Strings must match exactly. Compare your label with the one asked for, letter by letter.' },
          { tag: 'not-started', when: ({ obs }) => !obs.loadError && obs.callLogs.length === 0 && call(obs, 'done').value === undefined && call(obs, 'open').value === undefined, why: 'The function doesn\'t give anything back yet. What should it decide first?' }],
        hints: ['Decide based on `task.done`.', '`if / else` (or `? :`) picks one of two values.', 'Hand the label back with `return`, spelled exactly as in the task.'] }
    ] }
];
