// Python World 1 (curriculum py-2): the same four FREE vaults and progression as JavaScript — a task, a list
// of tasks, a function that adds tasks, and conditions on whether a task is done — in idiomatic Python
// (dictionaries, len(), append, for … in, def, None, == / not). Same format as content/js-world1.js.
import { check, result, binding, call, listAfter, pyShow as show } from './kit.js';

const isNew = t => t && t.title === 'Read' && t.done === false;

export const PY_WORLD1 = [
  // ── Vault 1 · Create Your First Task ──
  { concept: 'A **task** can be a dictionary: `{"title": "Read", "done": False}` — a title (a string, in quotes) and whether it\'s done (a boolean, `True` or `False`). Read one value with its key: `task["title"]`.',
    ch: [
      { t: 'mcq', tag: 'dict-access', q: 'What does this program print?', code: 'task = {"title": "Buy milk", "done": False}\nprint(task["title"])',
        opts: [['Buy milk', 1], ['"Buy milk"', 0, '`print` shows the **value** of a string. Does it show the quote marks around it?', 'quotes-in-output'], ['title', 0, '`task["title"]` reads what is **stored under** that key. Is that the key itself, or its value?', 'key-vs-value'], ['False', 0, '`False` is stored under `"done"`. Which key does this line look up?', 'key-vs-value']],
        hints: ['`task["title"]` looks up one key in the dictionary.', 'The value stored under `"title"` is a piece of text.', 'When a string is printed, are its quote marks part of the output?'] },
      { t: 'fill', tag: 'boolean', q: 'Give the task a **boolean** so it starts unfinished.', code: 'task = {"title": "Learn Python", "done": ___}',
        observe: { globals: ['task'] },
        checks: [
          check('bool', '`"done"` is a boolean', o => result(typeof binding(o, 'task')?.done === 'boolean', 'a boolean', show(binding(o, 'task')?.done))),
          check('open', 'The task starts unfinished', o => result(binding(o, 'task')?.done === false, 'False', show(binding(o, 'task')?.done)))],
        mistakes: [
          { tag: 'boolean-capital', when: ({ error }) => /NameError: name '(false|true)' is not defined/.test(error), why: 'Python doesn\'t know that name. How are Python\'s two booleans spelled — look at the first letter.' },
          { tag: 'boolean-as-string', when: ({ obs }) => typeof binding(obs, 'task')?.done === 'string', why: '`"done"` became **text**, not a yes/no value. What is the difference between `False` and `"False"`?' },
          { tag: 'boolean-wrong-value', when: ({ obs }) => binding(obs, 'task')?.done === true, why: 'That makes the task **finished** already. Which boolean means "not done yet"?' }],
        hints: ['A boolean is a yes/no value, written without quotes.', 'Python\'s booleans start with a capital letter.', '"Unfinished" means not done — which of the two says no?'] },
      { t: 'code', kind: 'fix', tag: 'dict-syntax', q: 'This task crashes. Fix it so `task` has a title and is unfinished.', code: 'task = {\n    "title": Read a book,\n    "done": False\n}\n',
        observe: { globals: ['task'] },
        checks: [
          check('runs', 'The code runs', o => result(!o.loadError, 'no error', o.loadError?.message ?? 'no error')),
          check('title', '`"title"` is some text', o => { const t = binding(o, 'task')?.title; return result(typeof t === 'string' && t.trim() !== '', 'a string', show(t)); }),
          check('open', '`"done"` is False', o => result(binding(o, 'task')?.done === false, 'False', show(binding(o, 'task')?.done)))],
        mistakes: [
          { tag: 'string-not-quoted', when: ({ code }) => /["']title["']\s*:\s*[A-Za-z][^,\n]*\s[A-Za-z]/.test(code), why: 'Look at the title. How does Python tell the difference between text and code — what does text need around it?' },
          { tag: 'missing-comma', when: ({ code, error }) => /^SyntaxError/.test(error) && /["']title["']\s*:\s*(["'])[^\n]*\1\s*\n\s*["']done/.test(code), why: 'The title is text now. Compare the end of the `"title"` line with how one entry is separated from the next.' }],
        hints: ['Read the error: which line can Python not understand?', '`Read a book` is meant to be text. What does text need around it?', 'Each `key: value` pair is separated from the next one by a comma.'] }
    ] },

  // ── Vault 2 · Organize Your Tasks ──
  { concept: 'A **list** keeps many items in order: `["Read", "Code"]`. `len(tasks)` counts them, `tasks.append(item)` adds one at the end, and `for task in tasks:` visits each one in turn — the lines inside the loop are indented.',
    ch: [
      { t: 'mcq', tag: 'list-len', q: 'What does this program print?', code: 'tasks = ["Wash up", "Read", "Code"]\nprint(len(tasks))',
        opts: [['3', 1], ['2', 0, '`len` counts the items. How many strings are in the list?', 'length-vs-index'], ['Code', 0, 'That\'s the last item. Does `len` give an item, or how many there are?', 'length-vs-index'], ['["Wash up", "Read", "Code"]', 0, '`len(...)` doesn\'t show the list itself. What does it measure?', 'length-vs-index']],
        hints: ['`len` gives a count, not a position.', 'Count the strings between the brackets.', 'Positions start at 0 — but counting starts at 1.'] },
      { t: 'fill', tag: 'list-append', q: 'Add `new_task` to the list, so it has **three** tasks.', code: 'tasks = ["Wash up", "Read"]\nnew_task = "Code"\ntasks.___(new_task)',
        observe: { globals: ['tasks'] },
        checks: [
          check('three', '`tasks` has 3 items', o => { const t = binding(o, 'tasks'); return result(Array.isArray(t) && t.length === 3, '3 items', Array.isArray(t) ? `${t.length} items` : show(t)); }),
          check('code', '"Code" is in the list', o => { const t = binding(o, 'tasks'); return result(Array.isArray(t) && t.includes('Code'), 'contains "Code"', show(t)); })],
        mistakes: [
          { tag: 'push-length', when: ({ answer }) => answer.trim() === 'len', why: '`len` tells you how many items there are. Can it also add one?' },
          { tag: 'not-a-method', when: ({ error }) => /AttributeError: 'list' object has no attribute/.test(error), why: 'Python says lists don\'t have that method. Which list method **adds** an item at the end?' }],
        hints: ['You need a list method that adds an item.', 'It adds the item at the end of the list.', 'Its name means "attach at the end".'] },
      { t: 'code', kind: 'write', tag: 'loop-titles', q: 'Print every task\'s **title** with `print`, in order. Use a `for` loop.',
        code: 'tasks = [\n    {"title": "Wash up", "done": True},\n    {"title": "Read", "done": False},\n    {"title": "Code", "done": False},\n]\n\n# print each title here\n',
        observe: { logs: true },
        checks: [check('titles', 'Prints Wash up, Read, Code — one per line', o => result(JSON.stringify(o.logs) === JSON.stringify(['Wash up', 'Read', 'Code']), 'Wash up · Read · Code', o.logs.length ? o.logs.join(' · ') : 'nothing'))],
        mistakes: [
          { tag: 'no-output', when: ({ obs }) => !obs.loadError && obs.logs.length === 0, why: 'Nothing was printed. Which line of your code calls `print` — and does it run?' },
          { tag: 'logs-whole-object', when: ({ obs }) => obs.logs.some(l => l.startsWith('{')), why: 'Each line shows a whole task. How do you read just one value from a dictionary?' },
          { tag: 'off-by-one', when: ({ obs, error }) => /IndexError/.test(error) || (obs.logs.length > 0 && obs.logs.length !== 3), why: 'Count the printed lines. Where does your loop start, and where does it stop?' }],
        hints: ['`for task in tasks:` visits each task; the line inside is indented.', 'Inside the loop, print one value from the current task.', 'Look the title up by its key.'] }
    ] },

  // ── Vault 3 · Make Things Work ──
  { concept: 'A **function** is a named recipe: `def add(a, b):` followed by an indented body. **Parameters** receive the inputs and `return` hands the result back — `print` only shows it. A function without `return` gives back `None`.',
    ch: [
      { t: 'mcq', tag: 'return-value', q: 'What does this program print?', code: 'def double(n):\n    n * 2\n\nprint(double(4))',
        opts: [['None', 1], ['8', 0, '`n * 2` is calculated — but is the result handed back to the caller?', 'missing-return'], ['4', 0, 'Is anything handed back from `double`? Look for the keyword that does that.', 'missing-return'], ['Error', 0, 'Nothing crashes here. The question is what `double(4)` gives back.', 'missing-return']],
        hints: ['Look at what the function **gives back**, not what it calculates.', 'Which keyword hands a value back — and is it there?', 'A function that hands nothing back gives Python\'s "no value".'] },
      { t: 'fill', tag: 'task-shape', q: 'New tasks should start **unfinished**. Fill the blank.', code: 'def new_task(title):\n    return {"title": title, "done": ___}',
        observe: { calls: [{ id: 'read', fn: 'new_task', args: ['Read'] }] },
        checks: [check('shape', '`new_task("Read")` gives an unfinished task called Read', o => { const v = call(o, 'read').value; return result(isNew(v), '{"title": "Read", "done": False}', show(v)); })],
        mistakes: [
          { tag: 'boolean-capital', when: ({ obs }) => /NameError: name '(false|true)' is not defined/.test(call(obs, 'read').error ?? ''), why: 'Python doesn\'t know that name. How are Python\'s booleans spelled?' },
          { tag: 'boolean-as-string', when: ({ obs }) => typeof call(obs, 'read').value?.done === 'string', why: '`"done"` is text here. Which kind of value says yes or no?' },
          { tag: 'boolean-wrong-value', when: ({ obs }) => call(obs, 'read').value?.done === true, why: 'A new task would start finished. Which boolean means "not done"?' }],
        hints: ['`"done"` should be a yes/no value.', 'No quotes — and Python\'s booleans start with a capital letter.', 'A brand-new task hasn\'t been finished yet.'] },
      { t: 'code', kind: 'write', tag: 'add-task', q: 'Write `add_task(tasks, title)`: it adds a new **unfinished** task with that title to the list.', code: 'def add_task(tasks, title):\n    pass\n',
        observe: { calls: [{ id: 'empty', fn: 'add_task', args: [[], 'Read'] }, { id: 'one', fn: 'add_task', args: [[{ title: 'Code', done: false }], 'Read'] }] },
        checks: [
          check('empty', 'Adds a task to an empty list', o => { const l = listAfter(o, 'empty'); return result(Array.isArray(l) && l.length === 1 && isNew(l[0]), '[{"title": "Read", "done": False}]', show(l)); }),
          check('keep', 'Keeps the tasks already there', o => { const l = listAfter(o, 'one'); return result(Array.isArray(l) && l.length === 2 && l.some(t => t?.title === 'Code'), '2 tasks, "Code" kept', show(l)); }),
          check('new', 'The new task is unfinished', o => { const l = listAfter(o, 'one'); return result(Array.isArray(l) && l.some(isNew), 'includes {"title": "Read", "done": False}', show(l)); })],
        mistakes: [
          { tag: 'not-started', when: ({ obs }) => !obs.loadError && call(obs, 'empty').value === null && (call(obs, 'empty').args?.[0] ?? []).length === 0, why: 'Calling `add_task` doesn\'t change anything yet. What should happen to `tasks`?' },
          { tag: 'title-as-task', when: ({ obs }) => (listAfter(obs, 'empty') ?? []).includes('Read'), why: 'The list now holds the text "Read" on its own. What does a task look like in this app?' },
          { tag: 'missing-done', when: ({ obs }) => (listAfter(obs, 'empty') ?? []).some(t => t && typeof t === 'object' && !('done' in t)), why: 'The new task has a title. What else does every task need to know about itself?' }],
        hints: ['Build a dictionary for the new task.', 'Every task has a `"title"` and a `"done"` value — and new tasks aren\'t done.', 'Add it to the list (or return a new list that includes it).'] }
    ] },

  // ── Vault 4 · Check Task Status ──
  { concept: '`if condition:` runs its indented block only when the condition is True; `else:` handles everything else. Compare with `==` — a single `=` **stores** a value — and flip a condition with `not`.',
    ch: [
      { t: 'mcq', tag: 'if-branch', q: 'What does this program print?', code: 'task = {"title": "Read", "done": False}\nif task["done"]:\n    print("Finished")\nelse:\n    print("Keep going")',
        opts: [['Keep going', 1], ['Finished', 0, 'The first block only runs when the condition is True. What is `task["done"]` here?', 'truthy-condition'], ['Finished Keep going', 0, 'Can both blocks of an `if / else` run?', 'truthy-condition'], ['Nothing', 0, 'One of the two blocks always runs. Which one does `False` choose?', 'truthy-condition']],
        hints: ['What is the value of `task["done"]`?', '`if` runs its block only for a True condition.', 'Otherwise, the `else` block runs.'] },
      { t: 'fill', tag: 'compare', q: 'Make `is_open` return `True` only for **unfinished** tasks.', code: 'def is_open(task):\n    return task["done"] ___ False',
        observe: { calls: [{ id: 'open', fn: 'is_open', args: [{ title: 'Read', done: false }] }, { id: 'done', fn: 'is_open', args: [{ title: 'Code', done: true }] }] },
        checks: [
          check('open', 'An unfinished task is open', o => result(call(o, 'open').value === true, 'True', show(call(o, 'open').value))),
          check('done', 'A finished task is not open', o => result(call(o, 'done').value === false, 'False', show(call(o, 'done').value)))],
        mistakes: [
          { tag: 'assignment-in-condition', when: ({ answer }) => answer.trim() === '=', why: 'A single `=` **stores** a value — Python won\'t even accept it here. Is this line meant to change the task, or to ask about it?' },
          { tag: 'inverted-condition', when: ({ answer }) => /^(!=|is\s+not)$/.test(answer.trim()), why: 'Try it by hand with an unfinished task: is `"done"` equal to `False`, or not?' }],
        hints: ['You need an operator that **compares** two values.', 'A single `=` would try to store a value instead.', 'Python\'s equality operator is two characters long.'] },
      { t: 'code', kind: 'write', tag: 'status-label', q: 'Write `status_label(task)`: return `"Done"` for a finished task and `"To do"` otherwise.', code: 'def status_label(task):\n    pass\n',
        observe: { calls: [{ id: 'done', fn: 'status_label', args: [{ title: 'Code', done: true }] }, { id: 'open', fn: 'status_label', args: [{ title: 'Read', done: false }] }] },
        checks: [
          check('done', 'A finished task → "Done"', o => result(call(o, 'done').value === 'Done', '"Done"', show(call(o, 'done').value))),
          check('open', 'An unfinished task → "To do"', o => result(call(o, 'open').value === 'To do', '"To do"', show(call(o, 'open').value)))],
        mistakes: [
          { tag: 'log-vs-return', when: ({ obs }) => obs.callLogs.length > 0 && call(obs, 'done').value === null, why: 'Your function **printed** a label but gave back `None`. What\'s the difference between printing a value and returning it?' },
          { tag: 'assignment-in-condition', when: ({ code }) => /^\s*(el)?if\b[^\n:]*[^=!<>:]=[^=][^\n]*:/m.test(code), why: 'Look at your `if` line. Does it **check** `task["done"]`, or try to change it?' },
          { tag: 'inverted-condition', when: ({ obs }) => call(obs, 'done').value === 'To do' && call(obs, 'open').value === 'Done', why: 'Both labels appear — but on the wrong tasks. Which block runs for a finished task?' },
          { tag: 'string-mismatch', when: ({ obs }) => [call(obs, 'done').value, call(obs, 'open').value].some(v => typeof v === 'string' && !['Done', 'To do'].includes(v) && ['done', 'to do', 'todo'].includes(v.toLowerCase().trim())), why: 'Strings must match exactly. Compare your label with the one asked for, letter by letter.' },
          { tag: 'not-started', when: ({ obs }) => !obs.loadError && obs.callLogs.length === 0 && call(obs, 'done').value === null && call(obs, 'open').value === null, why: 'The function doesn\'t give anything back yet. What should it decide first?' }],
        hints: ['Decide based on `task["done"]`.', '`if / else` picks one of two values.', 'Hand the label back with `return`, spelled exactly as in the task.'] }
    ] }
];
