// VaultQuest content — ported 1:1 from the prototype. Edit content here, not in screens.
// Challenge types: mcq | blank | fix | project.
//  mcq.opts: [label, isCorrect, whyWrong?]   blank.ans: accepted answers, blank.wrong: {answer: explanation}
//  fix.checks: [{bad|need: RegExp, out: fake stderr, why: explanation}]  (used for instant feedback + fallback when real execution is unavailable)
//  project.tests: (code, sandboxRoot, execApp) => null | failureMessage
// Text uses `code` and **bold** markdown only.
// Per language: `free` = how many levels from the start are FREE (index >= free is Pro); `curriculum` = id of
// this content version. Progress and reward keys are tied to it — bump it (py-2, js-2) when the content is
// replaced, and saved progress on the old version is archived instead of counting as the new one.
export const freeOf = lang => LANGS[lang].free;
export const LANGS={
 py:{name:'Python',world:'The Foundations',free:4,curriculum:'py-1',titles:['Variables','Data types','Conditions','Functions','Loops & Lists','Project: Guess the Number','Project: Expense Tracker','Boss: Weather CLI'],
  levels:[
  {concept:'A **variable** is a labeled box that holds a value. You create one with a single `=` : `score = 10`. Names are case-sensitive, so `score` and `Score` are different boxes.',
   ch:[
    {t:'mcq',q:'What does this program print?',code:'name = "Ana"\nage = 21\nprint(name, age)',opts:[
      ['Ana 21',1],['"Ana" 21',0,'Close! But `print` shows a string\'s **value**, without the quotes around it.'],['name age',0,'`name` and `age` have no quotes, so they\'re variables — Python prints what\'s **inside** them.'],['Error',0,'Nothing is broken here: both variables exist before `print` uses them.']],
     hints:['Variables are boxes. `print()` shows what\'s inside the box, not its label.','Strings are printed without their quotes.','A comma in `print` puts a space between values.']},
    {t:'blank',q:'Store the number 10 in a variable called <span class="code">score</span>.',code:'score ___ 10\nprint(score)',ans:['='],
     wrong:{'==':'`==` **asks a question** — "is score equal to 10?". To **store** a value you need a single `=`, the assignment operator.',':':'Colons start blocks like `if` or `def`. To store a value, use `=`.'},
     why:'Not quite. Which operator puts a value **into** a variable?',
     hints:['You\'re not comparing anything — you\'re putting a value into a box.','The operator you need is one character long.','Assignment is a single `=`.']},
    {t:'fix',q:'This should greet the player, but it crashes. Fix the bug.',code:'name = "Ana"\nprint("Hello, " + Name)',
     checks:[{bad:/\bName\b/,out:'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\nNameError: name \'Name\' is not defined',why:'Python is **case-sensitive**: `name` and `Name` are two different variables. Line 2 asks for `Name`, which was never created.'},
             {need:/print\(\s*["']Hello, ["']\s*\+\s*name\s*\)/,out:'SyntaxError: invalid syntax',why:'Keep the shape of the line: `print("Hello, " + name)`.'}],
     ok:'Hello, Ana',hints:['Read the error: which name does Python say isn\'t defined?','Compare line 1 and line 2 letter by letter.','Capital letters matter: `Name` ≠ `name`.']}
   ]},
  {concept:'Every value has a **type**: `int` (whole numbers), `float` (decimals), `str` (text in quotes) and `bool` (True/False). Use `int()`, `float()` and `str()` to convert.',
   ch:[
    {t:'mcq',q:'What does this print?',code:'print(type(3.0))',opts:[["<class 'float'>",1],["<class 'int'>",0,'`3.0` has a decimal point, so it\'s a **float** even though it\'s a whole number.'],["<class 'str'>",0,'There are no quotes, so it isn\'t a string.'],['3.0',0,'`type()` returns the **type** of a value, not the value itself.']],hints:['Look closely at the number: is there a dot?','Decimal numbers have their own type.','It\'s a float.']},
    {t:'mcq',q:'Predict the output.',code:'print("5" + "5")',opts:[['55',1],['10',0,'Both values are in quotes — they\'re **strings**, so `+` glues them together instead of adding.'],['TypeError',0,'`str + str` is allowed. It\'s `str + int` that breaks.'],['5 5',0,'`+` joins strings exactly as they are; it doesn\'t add a space.']],hints:['Are these numbers or text?','For strings, `+` means "join".','"5" joined with "5"…']},
    {t:'blank',q:'Turn the text "42" into a whole number so the math works.',code:'age = ___("42")\nprint(age + 1)',ans:['int'],wrong:{'str':'It\'s already a string — you need to turn it **into a number**.','float':'That works, but prints `43.0`. The task wants a whole number.'},why:'Which function converts text to a whole number?',hints:['You need a conversion function.','Whole numbers are called integers.','`int("42")` gives you 42.']}
   ]},
  {concept:'`if` lets your program decide. The line ends with a colon `:` and the code inside is **indented**. Combine checks with `and`, `or`, `not`.',
   ch:[
    {t:'mcq',q:'What does this print?',code:'x = 7\nif x > 5:\n    print("big")\nelse:\n    print("small")',opts:[['big',1],['small',0,'7 is greater than 5, so the `if` branch runs, not `else`.'],['big small',0,'Only **one** branch of an if/else ever runs.'],['Nothing',0,'The condition is True, so the first print runs.']],hints:['Is 7 > 5 True or False?','Only one branch runs.','True → the if-branch.']},
    {t:'fix',q:'The program should print "pass" — but it won\'t even run.',code:'score = 72\nif score >= 50\n    print("pass")',checks:[{need:/if\s+score\s*>=\s*50\s*:/,out:'  File "main.py", line 2\n    if score >= 50\n                  ^\nSyntaxError: expected \':\'',why:'Every `if` line must end with a **colon** `:` — it tells Python an indented block is coming.'}],ok:'pass',hints:['Look at the end of line 2.','What symbol do `if`, `for` and `def` lines end with?','Add `:` after `50`.']},
    {t:'blank',q:'Print only when <b>both</b> numbers are positive.',code:'if a > 0 ___ b > 0:\n    print("both positive")',ans:['and'],wrong:{'or':'`or` is True if just **one** is positive. You need both.','&&':'That\'s JavaScript. Python spells it as a word.'},why:'Which word means "both must be true"?',hints:['Both conditions must be True.','It\'s an English word.','`and`.']}
   ]},
  {concept:'A **function** is reusable code: `def name(params):`. Use `return` to **give a value back** to the caller — `print` only shows it on screen.',
   ch:[
    {t:'mcq',q:'What does this print?',code:'def double(n):\n    return n * 2\n\nprint(double(4))',opts:[['8',1],['4',0,'`double` returns `n * 2`, so 4 becomes 8.'],['None',0,'The function **returns** a value, so it isn\'t None.'],['n * 2',0,'Python calculates the expression; it doesn\'t print the code.']],hints:['What is n inside the function?','n is 4.','4 * 2.']},
    {t:'fix',q:'<span class="code">temp + 1</span> crashes. Make the function give its result back.',code:'def to_f(c):\n    result = c * 9 / 5 + 32\n    print(result)\n\ntemp = to_f(100)\nprint(temp + 1)',checks:[{need:/return\s+result/,out:"212.0\nTraceback (most recent call last):\n  File \"main.py\", line 6\nTypeError: unsupported operand type(s) for +: 'NoneType' and 'int'",why:'`print` shows the value, but the function hands **nothing** back — so `temp` is `None`. Use `return result`.'}],ok:'213.0',hints:['What is `temp` after line 5?','A function without `return` gives back `None`.','Replace `print(result)` with `return result`.']},
    {t:'blank',q:'Make <span class="code">greet</span> give the text back.',code:'def greet(name):\n    ___ "Hi " + name',ans:['return'],wrong:{'print':'`print` would show it, but the caller would get `None`.'},why:'Which keyword hands a value back?',hints:['Think "give back".','It starts with r.','`return`.']}
   ]}
  ,{concept:'Loops repeat work: `for item in items:` walks a list, `range(n)` counts. Lists grow with `.append()` and start at index 0.',
   ch:[
    {t:'mcq',q:'How many lines does this print?',code:'for i in range(3):\n    print(i)',opts:[['3 lines: 0, 1, 2',1],['3 lines: 1, 2, 3',0,'`range(3)` starts at **0**, so it gives 0, 1, 2.'],['4 lines',0,'`range(3)` stops **before** 3.'],['1 line',0,'The print is inside the loop, so it runs every time.']],hints:['Where does range start?','range(3) gives three numbers.','0, 1, 2.']},
    {t:'blank',q:'Add 4 to the end of the list.',code:'nums = [1, 2, 3]\nnums.___(4)',ans:['append'],wrong:{'add':'Lists use `append`; `add` belongs to sets.','push':'`push` is JavaScript. Python lists use `append`.'},why:'Which list method adds to the end?',hints:['It means "attach at the end".','Starts with a.','`append`.']},
    {t:'fix',q:'This loop crashes on the last step. Fix it.',code:'items = ["a", "b", "c"]\nfor i in range(len(items) + 1):\n    print(items[i])',checks:[{need:/range\(\s*len\(items\)\s*\)/,out:'a\nb\nc\nIndexError: list index out of range',why:'Indexes go from 0 to `len - 1`. The `+ 1` asks for one item too many.'}],ok:'a\nb\nc',hints:['How many items are there?','What is the last valid index?','Remove `+ 1`.']}
   ]}
  ,{t:'project',kind:'py',title:'Guess the Number',brief:'Build the brain of a number-guessing game. You write **game.py**: a `check` function that judges each guess and a `play` function that counts the tries. Your AI mentor reviews every run.',
   starter:'# Guess the Number — write the game logic.\n# check(guess, secret) -> "Too low", "Too high" or "Correct!"\n# play(secret, guesses) -> how many guesses it took to hit the secret\n\ndef check(guess, secret):\n    pass\n\n\ndef play(secret, guesses):\n    pass\n',
   ms:[{n:'Too low',d:'check(3, 7) returns "Too low".'},{n:'Too high',d:'check(9, 7) returns "Too high".'},{n:'Correct!',d:'check(7, 7) returns "Correct!".'},{n:'Count the tries',d:'play(42, [50, 25, 37, 42]) returns 4.'}],
   pyTests:[['check(3, 7)','Too low'],['check(9, 7)','Too high'],['check(7, 7)','Correct!'],['play(42, [50, 25, 37, 42])',4]],
   demo:'secret = 42\nfor g in [50, 25, 37, 42]:\n    print(f"> guess {g}   {check(g, secret)}")\nprint(f"Solved in {play(secret, [50, 25, 37, 42])} tries")',
   final:'**Final review: 90/100.** `check` reads like plain English and `play` reuses it instead of repeating the comparisons. Next step: let the player type guesses with `input()` and pick the secret with `random.randint`.',
   review(code,k){if(k===3&&/return\s+len\(\s*guesses\s*\)/.test(code))return'`len(guesses)` counts **every** guess in the list — but the game should stop at the first correct one. Loop through the guesses and return how many you used when `check` says `"Correct!"`.';
     return['Compare `guess` with `secret`: when the guess is smaller, return `"Too low"`.','Add the opposite case: a guess bigger than the secret returns `"Too high"`.','When neither is true the guess is right — return `"Correct!"` (exact text, with the `!`).','Loop over `guesses` with a counter; when `check(g, secret)` is `"Correct!"`, return the counter.'][k]}}

  ]},
 js:{name:'JavaScript',world:'Web Basics',free:4,curriculum:'js-1',titles:['Variables','Types','Conditions','Functions','Arrays & Loops','Project: To-Do App','Project: Pomodoro Timer','Boss: Weather App'],
  levels:[
  {concept:'Declare variables with `let` (can change) or `const` (can\'t be reassigned). Avoid the old `var`.',
   ch:[
    {t:'mcq',q:'What gets logged?',code:'let x = 5;\nx = x + 2;\nconsole.log(x);',opts:[['7',1],['5',0,'`x` is reassigned to 5 + 2 before logging.'],['52',0,'Both are numbers, so `+` adds.'],['Error',0,'`let` variables can be reassigned.']],hints:['x starts at 5.','Then it becomes x + 2.','5 + 2.']},
    {t:'blank',q:'Declare a value that never changes.',code:'___ PI = 3.14;',ans:['const'],wrong:{'let':'`let` works, but allows reassigning. For a fixed value use `const`.','var':'`var` is the old way. Modern JS uses `const` for constants.'},why:'Which keyword makes a constant?',hints:['Short for "constant".','5 letters.','`const`.']},
    {t:'fix',q:'This crashes. Make the score changeable.',code:'const score = 10;\nscore = 20;\nconsole.log(score);',checks:[{bad:/const\s+score/,out:'TypeError: Assignment to constant variable.',why:'A `const` can\'t be reassigned. If the value needs to change, declare it with `let`.'}],ok:'20',hints:['Which line throws?','Constants can\'t change.','Use `let`.']}
   ]},
  {concept:'JS has `number`, `string`, `boolean`, `object` and more. `===` compares value **and** type; `==` converts types first.',
   ch:[
    {t:'mcq',q:'What gets logged?',code:'console.log("5" + 5);',opts:[['"55"',1],['10',0,'One side is a string, so `+` concatenates.'],['NaN',0,'Concatenation works fine here.'],['Error',0,'JS converts the number to a string.']],hints:['One value is a string.','String + anything = string.','"5" + "5".']},
    {t:'mcq',q:'What is typeof []?',code:'console.log(typeof []);',opts:[['"object"',1],['"array"',0,'Arrays are a kind of object in JS — use `Array.isArray()` to check.'],['"list"',0,'JS has no list type.'],['undefined',0,'`typeof` always returns a string.']],hints:['Arrays are special…','…objects.','"object".']},
    {t:'blank',q:'Make the comparison strict so it logs false.',code:'console.log(5 ___ "5"); // false',ans:['==='],wrong:{'==':'`==` converts types first, so `5 == "5"` is true. Use strict equality.'},why:'Which operator also compares the type?',hints:['Strict equality.','Three characters.','`===`.']}
   ]}
  ,{concept:'`if (condition) { … } else { … }` — the condition sits in parentheses. Combine checks with `&&` (and), `||` (or), `!` (not).',
   ch:[
    {t:'mcq',q:'What gets logged?',code:'const age = 20;\nif (age >= 18) {\n  console.log("adult");\n} else {\n  console.log("minor");\n}',opts:[['adult',1],['minor',0,'20 is at least 18, so the `if` branch runs.'],['adult minor',0,'Only one branch runs.'],['Nothing',0,'The condition is true.']],hints:['Is 20 >= 18?','Yes.','"adult".']},
    {t:'fix',q:'This won\'t even run. Fix the condition.',code:'const score = 72;\nif (score > 50 {\n  console.log("pass");\n}',checks:[{need:/if\s*\(\s*score\s*>\s*50\s*\)/,out:'SyntaxError: missing ) after condition',why:'The condition must be wrapped in parentheses — you opened `(` but never closed it.'}],ok:'pass',hints:['Count the parentheses on line 2.','One is missing.','Add `)` after 50.']},
    {t:'blank',q:'Log only when both numbers are positive.',code:'if (a > 0 ___ b > 0) {\n  console.log("both positive");\n}',ans:['&&'],wrong:{'and':'Python says `and`; JavaScript uses `&&`.','||':'`||` means OR. You need both.'},why:'Which operator means AND in JavaScript?',hints:['Two symbols.','Ampersands.','`&&`.']}
   ]},
  {concept:'Functions bundle logic: `function name(a) { return … }` or arrow style `const f = a => …`. Without `return`, a function gives back `undefined`.',
   ch:[
    {t:'mcq',q:'What gets logged?',code:'const double = n => n * 2;\nconsole.log(double(5));',opts:[['10',1],['5',0,'`double` returns `n * 2`.'],['undefined',0,'Short arrow functions return their expression automatically.'],['n * 2',0,'JS evaluates the expression.']],hints:['n is 5.','5 * 2.','10.']},
    {t:'fix',q:'<span class="code">msg.toUpperCase()</span> crashes. Make greet return its text.',code:'function greet(name) {\n  console.log("Hi " + name);\n}\nconst msg = greet("Ana");\nconsole.log(msg.toUpperCase());',checks:[{need:/return\s+["'`]Hi ["'`]\s*\+\s*name/,out:"Hi Ana\nTypeError: Cannot read properties of undefined (reading 'toUpperCase')",why:'`greet` logs the text but returns nothing, so `msg` is `undefined`. Use `return "Hi " + name`.'}],ok:'HI ANA',hints:['What is msg?','Functions without return give undefined.','`return "Hi " + name`.']},
    {t:'blank',q:'Make add give back the sum.',code:'function add(a, b) {\n  ___ a + b;\n}',ans:['return'],wrong:{'console.log':'Logging shows it, but the caller gets `undefined`.'},why:'Which keyword hands a value back?',hints:['Think "give back".','6 letters.','`return`.']}
   ]},
  {concept:'Arrays hold lists: `arr.length`, `arr.map()`, `arr.filter()`. Loop with `for (let i = 0; i < arr.length; i++)` — indexes run from 0 to length − 1.',
   ch:[
    {t:'mcq',q:'What gets logged?',code:'const nums = [4, 8, 15];\nconsole.log(nums.length);',opts:[['3',1],['2',0,'`length` counts items, not the last index.'],['15',0,'That\'s the last value, not the count.'],['undefined',0,'Arrays always have a length.']],hints:['Count the items.','Three of them.','3.']},
    {t:'blank',q:'Create a new array with every number doubled.',code:'const doubled = [1, 2, 3].___(n => n * 2);',ans:['map'],wrong:{'forEach':'`forEach` runs code per item but returns `undefined`. You want a new array: `map`.','filter':'`filter` keeps or drops items; it doesn\'t transform them.'},why:'Which method transforms every item into a new array?',hints:['It "maps" old values to new ones.','3 letters.','`map`.']},
    {t:'fix',q:'Off-by-one! Fix the loop.',code:'const items = ["a", "b", "c"];\nfor (let i = 0; i <= items.length; i++) {\n  console.log(items[i].toUpperCase());\n}',checks:[{need:/i\s*<\s*items\.length/,out:"A\nB\nC\nTypeError: Cannot read properties of undefined (reading 'toUpperCase')",why:'Indexes run 0 to `length - 1`. `i <= items.length` reaches index 3, which doesn\'t exist. Use `<`.'}],ok:'A\nB\nC',hints:['What is the last valid index?','length is 3, last index is 2.','Use `<` instead of `<=`.']}
   ]},
  {t:'project',title:'To-Do App',brief:'Build a working to-do list. The HTML is ready — you write **app.js**. Hit all four milestones; your AI mentor reviews every run.',
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
