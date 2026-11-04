// VaultQuest content. Edit content here (and in the world files it imports), not in screens.
// Per language: `free` = how many levels from the start are FREE (index >= free is Pro); `curriculum` = id of
// this content version. Progress, saved attempts and reward keys are tied to it — bump it when the content is
// replaced, and saved progress on the old version is archived instead of counting as the new one
// (learn/progress.js). A level with `rewards` keeps that reward identity across curricula (unchanged content
// must not pay twice).
// FREE vaults (content/py-world1.js, content/js-world1.js): types mcq | fill | code, judged by behaviour
// (learn/judge.js) — see the format note at the top of js-world1.js.
// Pro vault (older format): mcq.opts [label, isCorrect, whyWrong?] · blank.ans accepted answers, blank.wrong
//  {answer: explanation} · fix.checks [{bad|need: RegExp, out, why}] judged on real output + those checks.
//  `tag` = the concept tested, `answerTags` = finer tags for known wrong blanks (learn/diagnose.js).
// project.tests: (code, sandboxRoot, execApp) => null | failureMessage. Text uses `code` and **bold** only.
import { PY_WORLD1 } from './py-world1.js';
import { JS_WORLD1 } from './js-world1.js';

export const freeOf = lang => LANGS[lang].free;
export const LANGS={
 py:{name:'Python',world:'The Foundations',free:4,curriculum:'py-2',titles:['Create Your First Task','Organize Your Tasks','Make Things Work','Check Task Status','Loops & Lists','Project: Guess the Number','Project: Expense Tracker','Boss: Weather CLI'],
  levels:[...PY_WORLD1,
  {rewards:'py-1:4',concept:'Loops repeat work: `for item in items:` walks a list, `range(n)` counts. Lists grow with `.append()` and start at index 0.',
   ch:[
    {t:'mcq',tag:'range-start',q:'How many lines does this print?',code:'for i in range(3):\n    print(i)',opts:[['3 lines: 0, 1, 2',1],['3 lines: 1, 2, 3',0,'`range(3)` starts at **0**, so it gives 0, 1, 2.'],['4 lines',0,'`range(3)` stops **before** 3.'],['1 line',0,'The print is inside the loop, so it runs every time.']],hints:['Where does range start?','range(3) gives three numbers.','0, 1, 2.']},
    {t:'blank',tag:'list-append',answerTags:{add:'list-append',push:'list-append'},q:'Add 4 to the end of the list.',code:'nums = [1, 2, 3]\nnums.___(4)',ans:['append'],wrong:{'add':'Lists use `append`; `add` belongs to sets.','push':'`push` is JavaScript. Python lists use `append`.'},why:'Which list method adds to the end?',hints:['It means "attach at the end".','Starts with a.','`append`.']},
    {t:'fix',tag:'index-range',q:'This loop crashes on the last step. Fix it.',code:'items = ["a", "b", "c"]\nfor i in range(len(items) + 1):\n    print(items[i])',checks:[{need:/range\(\s*len\(items\)\s*\)/,out:'a\nb\nc\nIndexError: list index out of range',why:'Indexes go from 0 to `len - 1`. The `+ 1` asks for one item too many.'}],ok:'a\nb\nc',hints:['How many items are there?','What is the last valid index?','Remove `+ 1`.']}
   ]},
  {t:'project',rewards:'py-1:5',kind:'py',title:'Guess the Number',brief:'Build the brain of a number-guessing game. You write **game.py**: a `check` function that judges each guess and a `play` function that counts the tries. Your AI mentor reviews every run.',
   starter:'# Guess the Number — write the game logic.\n# check(guess, secret) -> "Too low", "Too high" or "Correct!"\n# play(secret, guesses) -> how many guesses it took to hit the secret\n\ndef check(guess, secret):\n    pass\n\n\ndef play(secret, guesses):\n    pass\n',
   ms:[{n:'Too low',d:'check(3, 7) returns "Too low".'},{n:'Too high',d:'check(9, 7) returns "Too high".'},{n:'Correct!',d:'check(7, 7) returns "Correct!".'},{n:'Count the tries',d:'play(42, [50, 25, 37, 42]) returns 4.'}],
   pyTests:[['check(3, 7)','Too low'],['check(9, 7)','Too high'],['check(7, 7)','Correct!'],['play(42, [50, 25, 37, 42])',4]],
   demo:'secret = 42\nfor g in [50, 25, 37, 42]:\n    print(f"> guess {g}   {check(g, secret)}")\nprint(f"Solved in {play(secret, [50, 25, 37, 42])} tries")',
   final:'**Final review: 90/100.** `check` reads like plain English and `play` reuses it instead of repeating the comparisons. Next step: let the player type guesses with `input()` and pick the secret with `random.randint`.',
   review(code,k){if(k===3&&/return\s+len\(\s*guesses\s*\)/.test(code))return'`len(guesses)` counts **every** guess in the list — but the game should stop at the first correct one. Loop through the guesses and return how many you used when `check` says `"Correct!"`.';
     return['Compare `guess` with `secret`: when the guess is smaller, return `"Too low"`.','Add the opposite case: a guess bigger than the secret returns `"Too high"`.','When neither is true the guess is right — return `"Correct!"` (exact text, with the `!`).','Loop over `guesses` with a counter; when `check(g, secret)` is `"Correct!"`, return the counter.'][k]}}
  ]},
 js:{name:'JavaScript',world:'Web Basics',free:4,curriculum:'js-2',titles:['Create Your First Task','Organize Your Tasks','Make Things Work','Check Task Status','Arrays & Loops','Project: To-Do App','Project: Pomodoro Timer','Boss: Weather App'],
  levels:[...JS_WORLD1,
  {rewards:'js-1:4',concept:'Arrays hold lists: `arr.length`, `arr.map()`, `arr.filter()`. Loop with `for (let i = 0; i < arr.length; i++)` — indexes run from 0 to length − 1.',
   ch:[
    {t:'mcq',tag:'array-length',q:'What gets logged?',code:'const nums = [4, 8, 15];\nconsole.log(nums.length);',opts:[['3',1],['2',0,'`length` counts items, not the last index.'],['15',0,'That\'s the last value, not the count.'],['undefined',0,'Arrays always have a length.']],hints:['Count the items.','Three of them.','3.']},
    {t:'blank',tag:'array-map',answerTags:{forEach:'map-vs-foreach',filter:'map-vs-filter'},q:'Create a new array with every number doubled.',code:'const doubled = [1, 2, 3].___(n => n * 2);',ans:['map'],wrong:{'forEach':'`forEach` runs code per item but returns `undefined`. You want a new array: `map`.','filter':'`filter` keeps or drops items; it doesn\'t transform them.'},why:'Which method transforms every item into a new array?',hints:['It "maps" old values to new ones.','3 letters.','`map`.']},
    {t:'fix',tag:'off-by-one',q:'Off-by-one! Fix the loop.',code:'const items = ["a", "b", "c"];\nfor (let i = 0; i <= items.length; i++) {\n  console.log(items[i].toUpperCase());\n}',checks:[{need:/i\s*<\s*items\.length/,out:"A\nB\nC\nTypeError: Cannot read properties of undefined (reading 'toUpperCase')",why:'Indexes run 0 to `length - 1`. `i <= items.length` reaches index 3, which doesn\'t exist. Use `<`.'}],ok:'A\nB\nC',hints:['What is the last valid index?','length is 3, last index is 2.','Use `<` instead of `<=`.']}
   ]},
  {t:'project',rewards:'js-1:5',title:'To-Do App',brief:'Build a working to-do list. The HTML is ready — you write **app.js**. Hit all four milestones; your AI mentor reviews every run.',
   starter:'// The HTML is ready: #task, #add, #list, #count\nconst tasks = ["Learn JavaScript", "Crack a vault"];\nconst list = $("#list");\n\n',
   ms:[{n:'Show the tasks',d:'Render every item of tasks as an <li> in #list.'},{n:'Add new tasks',d:'Add pushes the input text, then clears it.'},{n:'Mark as done',d:'Clicking a task toggles the "done" class.'},{n:'Count what\'s left',d:'Show "N left" in #count.'}],
   tests:[
    (code,r,execApp)=>{const e=execApp(code,r);if(e)return 'Error: '+e.message;const n=r.querySelectorAll('#list li').length;return n===2?null:`expected 2 tasks, found ${n}`},
    (code,r,execApp)=>{const e=execApp(code,r);if(e)return 'Error: '+e.message;const a=r.querySelector('#add'),i=r.querySelector('#task');if(!a||!i)return'missing #add or #task';i.value='Test task';a.click();const n=r.querySelectorAll('#list li').length;if(n!==3)return`expected 3 tasks after Add, found ${n}`;if(r.querySelector('#task').value!=='')return'input should be cleared';return null},
    (code,r,execApp)=>{const e=execApp(code,r);if(e)return 'Error: '+e.message;const li=r.querySelector('#list li');if(!li)return'no tasks to click';li.click();const l2=r.querySelector('#list li');return l2&&l2.classList.contains('done')?null:'clicking should toggle "done"'},
    (code,r,execApp)=>{const e=execApp(code,r);if(e)return 'Error: '+e.message;const li=r.querySelector('#list li');if(li)li.click();const t=((r.querySelector('#count')||{}).textContent||'').trim();return /\b1 left\b/.test(t)?null:`#count should say "1 left", got "${t||'nothing'}"`}],
   final:'**Final review: 92/100.** One `render()` owns the list, clear names, events wired cleanly. Next step: save `tasks` to `localStorage` so they survive a refresh.',
   review(code,k){if(k===1&&/innerHTML\s*=\s*["'`]<li>/.test(code))return'`list.innerHTML = …` **replaces** everything inside the list — that\'s why your two tasks vanished. Push the text into `tasks`, clear the input, then call `render()` again so one function owns the list.';
     return['Loop over `tasks` and append one `<li>` per item to `#list`.','On click: `tasks.push(...)` the input value, clear the input, then re-render.','Give each `<li>` an onclick that toggles the `done` class.','Subtract the `.done` items from `tasks.length` and write "N left" into `#count`.'][k]}}
  ]}
};
