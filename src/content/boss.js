// The fifth FREE node of World 1 in both languages: MINI BOSS — Count Completed Tasks (docs/PLAN.md §H).
// Explain first (learn/approach.js), then write the function; judged by behaviour on six inputs, including a
// list with other titles and counts so a hard-coded answer can't pass. Same format as content/js-world1.js,
// plus `approach` (the plan prompt, a sample of the data, the review rules) and fixed rewards.
import { check, result, call, jsShow, pyShow } from './kit.js';
import { approachRules } from '../learn/approach.js';

const T = (title, done) => ({ title, done });
const MIXED = [T('Learn to code', true), T('Crack a vault', false), T('Ship VaultQuest', true), T('Plan the demo', false), T('Rehearse', false)]; // 2 of 5
const NONE = [T('Wash up', false), T('Read', false), T('Code', false)];
const ALL = [T('Wash up', true), T('Read', true), T('Code', true)];
const OTHER = [T('Water plants', true), T('Call mum', true), T('Pay rent', false), T('Walk the dog', true)]; // 3 of 4
const CALLS = fn => ({ calls: [{ id: 'mixed', fn, args: [MIXED] }, { id: 'none', fn, args: [NONE] }, { id: 'all', fn, args: [ALL] }, { id: 'empty', fn, args: [[]] }, { id: 'other', fn, args: [OTHER] }] });
const values = o => ['mixed', 'none', 'all', 'empty', 'other'].map(id => call(o, id).value);

function boss({ lang, fn, show, nothing, code, prompt, concept, sample, hints, terms, why }) {
  const v = (o, id) => call(o, id).value;
  const ran = o => !o.loadError && !call(o, 'mixed').error; // the function exists and the call itself didn't fail
  return {
    boss: true, bonusXp: 150, concept,
    ch: [{
      t: 'code', kind: 'write', tag: 'count-done', xp: 100, q: prompt, code, observe: CALLS(fn),
      approach: { prompt: 'Before you code: how will you solve it? What will you go through, what will you check, and what will your function give back?', sample, rules: approachRules(terms) },
      checks: [
        check('mixed', 'Counts 2 finished tasks out of 5', o => result(v(o, 'mixed') === 2, '2', show(v(o, 'mixed')))),
        check('none', 'No finished tasks gives 0', o => result(v(o, 'none') === 0, '0', show(v(o, 'none')))),
        check('all', 'All finished gives 3', o => result(v(o, 'all') === 3, '3', show(v(o, 'all')))),
        check('empty', `An empty ${terms.list} gives 0`, o => result(v(o, 'empty') === 0, '0', show(v(o, 'empty')))),
        check('other', 'Works for other tasks too: 3 of 4', o => result(v(o, 'other') === 3, '3', show(v(o, 'other')))),
        check('unchanged', `Leaves the ${terms.list} unchanged`, o => { const c = call(o, 'mixed'); return result(!c.error && JSON.stringify(c.args?.[0]) === JSON.stringify(MIXED), 'the same 5 tasks', c.error ? 'not checked (error)' : show(c.args?.[0])); })],
      mistakes: [
        { tag: 'assignment-in-condition', when: ({ code }) => lang === 'js' ? /if\s*\([^)]*[^=!<>]=[^=>][^)]*\)/.test(code) : /^\s*(el)?if\b[^\n:]*[^=!<>:]=[^=][^\n]*:/m.test(code), why: why.assign },
        { tag: 'returns-array', when: ({ obs }) => Array.isArray(v(obs, 'mixed')), why: `Your function gives back a ${terms.list} of tasks. The Mini Boss asks **how many** — what kind of value is that?` },
        { tag: 'counts-unfinished', when: ({ obs }) => v(obs, 'mixed') === 3 && v(obs, 'none') === 3 && v(obs, 'all') === 0, why: 'For 5 tasks with 2 finished it gave **3** — and 3 when none are finished. Which tasks is your code counting right now?' },
        { tag: 'counts-all-tasks', when: ({ obs }) => v(obs, 'mixed') === 5 && v(obs, 'none') === 3 && v(obs, 'all') === 3 && v(obs, 'empty') === 0, why: 'It gives back how many tasks there are in total. Where does your code check whether each one is finished?' },
        { tag: 'hardcoded-answer', when: ({ obs }) => { const x = values(obs); return typeof x[0] === 'number' && new Set(x).size === 1; }, why: 'Every list gets the same answer. Would that number still be right for a different list of tasks?' },
        { tag: 'mutates-input', when: ({ obs }) => { const c = call(obs, 'mixed'); return !c.error && JSON.stringify(c.args?.[0]) !== JSON.stringify(MIXED); }, why: `After counting, the ${terms.list} isn't the same any more. Does counting need to change the tasks?` },
        { tag: 'log-vs-return', when: ({ obs }) => ran(obs) && obs.callLogs.length > 0 && v(obs, 'mixed') === nothing, why: why.log },
        { tag: 'not-started', when: ({ obs, code }) => ran(obs) && obs.callLogs.length === 0 && v(obs, 'mixed') === nothing && why.blank.test(code), why: `\`${fn}\` doesn't do anything yet. What did your plan say it should go through first?` },
        { tag: 'missing-return', when: ({ obs }) => ran(obs) && obs.callLogs.length === 0 && v(obs, 'mixed') === nothing, why: why.ret }],
      hints
    }]
  };
}

export const JS_BOSS = boss({
  lang: 'js', fn: 'countCompleted', show: jsShow, nothing: undefined, terms: { list: 'array', fn: 'countCompleted' },
  code: 'function countCompleted(tasks) {\n\n}\n',
  prompt: 'Write `countCompleted(tasks)`: return how many tasks in the list are done.',
  concept: '**Mini Boss.** Everything from World 1 at once: an array of task objects, a loop (or `filter` / `reduce`), a condition on `task.done`, a counter and `return`. Explain your plan first — then write it.',
  sample: 'const tasks = [\n  { title: "Learn to code", done: true },\n  { title: "Crack a vault", done: false },\n  { title: "Ship VaultQuest", done: true }\n];\ncountCompleted(tasks); // → 2',
  hints: ['Start a count at zero, then look at every task.', 'Only add to the count when that task is done.', 'Hand the count back at the end — printing it isn\'t enough.'],
  why: { assign: 'Look at your `if` condition. Does it **check** `task.done`, or change it?', log: 'Your function **printed** a number but gave back `undefined`. What\'s the difference between printing a value and returning it?', ret: 'Your function works something out but gives back `undefined`. Which keyword hands the count back to the caller?', blank: /^\s*function\s+countCompleted\s*\([^)]*\)\s*\{\s*\}\s*$/ }
});

export const PY_BOSS = boss({
  lang: 'py', fn: 'count_completed', show: pyShow, nothing: null, terms: { list: 'list', fn: 'count_completed' },
  code: 'def count_completed(tasks):\n    pass\n',
  prompt: 'Write `count_completed(tasks)`: return how many tasks in the list are done.',
  concept: '**Mini Boss.** Everything from World 1 at once: a list of task dictionaries, a `for` loop (or a comprehension), a condition on `task["done"]`, a counter and `return`. Explain your plan first — then write it.',
  sample: 'tasks = [\n    {"title": "Learn to code", "done": True},\n    {"title": "Crack a vault", "done": False},\n    {"title": "Ship VaultQuest", "done": True},\n]\ncount_completed(tasks)  # → 2',
  hints: ['Start a count at zero, then look at every task.', 'Only add to the count when that task is done.', 'Hand the count back at the end — printing it isn\'t enough.'],
  why: { assign: 'Look at your `if` line. Does it **check** `task["done"]`, or try to change it?', log: 'Your function **printed** a number but gave back `None`. What\'s the difference between printing a value and returning it?', ret: 'Your function works something out but gives back `None`. Which keyword hands the count back to the caller?', blank: /^\s*def\s+count_completed\s*\([^)]*\)\s*:\s*(pass)?\s*$/ }
});
