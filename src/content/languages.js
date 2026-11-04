// VaultQuest content. Edit content here (and in the world files it imports), not in screens.
// Per language: `free` = how many levels from the start are FREE (index >= free is Pro); `curriculum` = id of
// this content version. Progress, saved attempts and reward keys are tied to it — bump it when the content is
// replaced, and saved progress on the old version is archived instead of counting as the new one
// (learn/progress.js). A level with `rewards` keeps that reward identity across curricula (unchanged content
// must not pay twice).
// FREE vaults (content/py-world1.js, content/js-world1.js): types mcq | fill | code, judged by behaviour
// (learn/judge.js) — see the format note at the top of js-world1.js. The fifth FREE node is the Mini Boss
// (content/boss.js): explain first, then code. World 1 is cleared when every FREE node is done.
// Pro vault (older format): mcq.opts [label, isCorrect, whyWrong?] · blank.ans accepted answers, blank.wrong
//  {answer: explanation} · fix.checks [{bad|need: RegExp, out, why}] judged on real output + those checks.
//  `tag` = the concept tested, `answerTags` = finer tags for known wrong blanks (learn/diagnose.js).
// PRO projects (content/projects/*.js): milestones, behaviour checks, hints and scripted mentor questions —
// run by the PRO Workspace (learn/workspace.js + run/project-js.js / run/project-py.js). Text uses `code` and **bold** only.
import { PY_WORLD1 } from './py-world1.js';
import { JS_WORLD1 } from './js-world1.js';
import { JS_BOSS, PY_BOSS } from './boss.js';
import { TODO } from './projects/todo.js';
import { GUESS } from './projects/guess.js';
import { TODO_BLUEPRINT } from './blueprints/todo.js';
import { GUESS_BLUEPRINT } from './blueprints/guess.js';

export const freeOf = lang => LANGS[lang].free;
export const LANGS={
 py:{name:'Python',world:'The Foundations',free:5,curriculum:'py-2',titles:['Create Your First Task','Organize Your Tasks','Make Things Work','Check Task Status','Mini Boss: Count Completed Tasks','Loops & Lists','Project: Guess the Number','Boss: Weather CLI'],
  levels:[...PY_WORLD1, PY_BOSS,
  {rewards:'py-1:4',concept:'Loops repeat work: `for item in items:` walks a list, `range(n)` counts. Lists grow with `.append()` and start at index 0.',
   ch:[
    {t:'mcq',tag:'range-start',q:'How many lines does this print?',code:'for i in range(3):\n    print(i)',opts:[['3 lines: 0, 1, 2',1],['3 lines: 1, 2, 3',0,'`range(3)` starts at **0**, so it gives 0, 1, 2.'],['4 lines',0,'`range(3)` stops **before** 3.'],['1 line',0,'The print is inside the loop, so it runs every time.']],hints:['Where does range start?','range(3) gives three numbers.','0, 1, 2.']},
    {t:'blank',tag:'list-append',answerTags:{add:'list-append',push:'list-append'},q:'Add 4 to the end of the list.',code:'nums = [1, 2, 3]\nnums.___(4)',ans:['append'],wrong:{'add':'Lists use `append`; `add` belongs to sets.','push':'`push` is JavaScript. Python lists use `append`.'},why:'Which list method adds to the end?',hints:['It means "attach at the end".','Starts with a.','`append`.']},
    {t:'fix',tag:'index-range',q:'This loop crashes on the last step. Fix it.',code:'items = ["a", "b", "c"]\nfor i in range(len(items) + 1):\n    print(items[i])',checks:[{need:/range\(\s*len\(items\)\s*\)/,out:'a\nb\nc\nIndexError: list index out of range',why:'Indexes go from 0 to `len - 1`. The `+ 1` asks for one item too many.'}],ok:'a\nb\nc',hints:['How many items are there?','What is the last valid index?','Remove `+ 1`.']}
   ]},
  {t:'project',rewards:'py-1:5',kind:'py',...GUESS,blueprint:GUESS_BLUEPRINT}
  ]},
 js:{name:'JavaScript',world:'Web Basics',free:5,curriculum:'js-2',titles:['Create Your First Task','Organize Your Tasks','Make Things Work','Check Task Status','Mini Boss: Count Completed Tasks','Arrays & Loops','Project: To-Do App','Boss: Weather App'],
  levels:[...JS_WORLD1, JS_BOSS,
  {rewards:'js-1:4',concept:'Arrays hold lists: `arr.length`, `arr.map()`, `arr.filter()`. Loop with `for (let i = 0; i < arr.length; i++)` — indexes run from 0 to length − 1.',
   ch:[
    {t:'mcq',tag:'array-length',q:'What gets logged?',code:'const nums = [4, 8, 15];\nconsole.log(nums.length);',opts:[['3',1],['2',0,'`length` counts items, not the last index.'],['15',0,'That\'s the last value, not the count.'],['undefined',0,'Arrays always have a length.']],hints:['Count the items.','Three of them.','3.']},
    {t:'blank',tag:'array-map',answerTags:{forEach:'map-vs-foreach',filter:'map-vs-filter'},q:'Create a new array with every number doubled.',code:'const doubled = [1, 2, 3].___(n => n * 2);',ans:['map'],wrong:{'forEach':'`forEach` runs code per item but returns `undefined`. You want a new array: `map`.','filter':'`filter` keeps or drops items; it doesn\'t transform them.'},why:'Which method transforms every item into a new array?',hints:['It "maps" old values to new ones.','3 letters.','`map`.']},
    {t:'fix',tag:'off-by-one',q:'Off-by-one! Fix the loop.',code:'const items = ["a", "b", "c"];\nfor (let i = 0; i <= items.length; i++) {\n  console.log(items[i].toUpperCase());\n}',checks:[{need:/i\s*<\s*items\.length/,out:"A\nB\nC\nTypeError: Cannot read properties of undefined (reading 'toUpperCase')",why:'Indexes run 0 to `length - 1`. `i <= items.length` reaches index 3, which doesn\'t exist. Use `<`.'}],ok:'A\nB\nC',hints:['What is the last valid index?','length is 3, last index is 2.','Use `<` instead of `<=`.']}
   ]},
  {t:'project',rewards:'js-1:5',kind:'js',...TODO,blueprint:TODO_BLUEPRINT}
  ]}
};
