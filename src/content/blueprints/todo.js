// Project Blueprint for the JavaScript To-Do App (learn/blueprint.js). Five sections, each with its purpose,
// a project question, the words that show an answer is about this project (`vocab`), and ordered rules: a
// rule applies when the plan is missing a piece of reasoning or shows a misconception; its question asks
// for it (never the answer), `retry` asks again differently, `resolves` decides whether a reply answers it.
// Rules look for ideas, not exact wording — several designs pass (one array of task objects, two arrays,
// the page itself as the data, re-rendering or updating single elements).
// ctx: { own (section text), answers (replies), text (both), plan (every section + replies), resolved }

const LEFT = /\b(left|remaining|remain|unfinished|not (yet )?(done|finished|complete[d]?)|incomplete|still to do|to do|open tasks?|undone)\b/i;
const COUNT = /\b(how many|count\w*|number of|tally|total)\b/i;
const COUNTS_DONE = /\b(how many|count\w*|number of|total)\b[^.?!\n]*\b(done|completed?|finished|ticked)\b|\b(done|completed|finished|ticked)\b[^.?!\n]*\b(count\w*|how many|number|total)\b/i;
// When the screen updates (not how: "redraw" alone doesn't say when).
const TIMING = /\b(every ?time|each time|whenever|after (each|every|adding|completing|a change|any|that|it)|as soon as|right after|immediately)\b/i;
const ON_CHANGE = /\b(every|each|whenever|after|when|always|also)\b[^.?!\n]*\b(add\w*|complet\w*|click\w*|tick\w*|toggl\w*|chang\w*|done|finish\w*|mark\w*|new task)/i;
const has = re => c => re.test(c.text);
const lacks = re => c => !re.test(c.text);

export const TODO_BLUEPRINT = {
  project: 'To-Do App',
  brief: 'Before you write a line of **app.js**, plan the app in your own words. Five short sections — your mentor reads each one and asks about anything that is missing. It will never design the app for you, and there is no single right design.',
  sections: [
    { id: 'features', title: 'Features', purpose: 'What should the application do? List what someone can do with it, from their side of the screen.',
      question: 'What should someone be able to do with your to-do app?',
      vocab: /\b(task|todo|to-do|list|item|add\w*|done|complet\w*|finish\w*|count\w*|left|remain\w*|tick\w*|check\w*|mark\w*|delete|remove|type|button)\b/i,
      accept: 'Your **Features** cover what someone can do: add tasks, finish them, and see what is left.',
      rules: [
        { id: 'features-add', applies: lacks(/\b(add\w*|new|create\w*|type\w*|write\w*|enter\w*|put)\b/i), question: 'How will someone put a new task into the list?',
          retry: 'Someone has a new thing to do. What do they do on the page so it appears in the list?', resolves: a => /\b(add\w*|type\w*|button|input|enter\w*|write\w*|new)\b/i.test(a), ack: 'Got it — adding tasks is in.' },
        { id: 'features-done', applies: lacks(/\b(done|complet\w*|finish\w*|tick\w*|check\w*|cross\w*|mark\w*)\b/i), question: 'How does someone show that they have finished a task?',
          retry: 'You finished "Buy milk". What do you do in the app so it knows?', resolves: a => /\b(done|complet\w*|finish\w*|tick\w*|check\w*|click\w*|mark\w*|cross\w*|tap\w*)\b/i.test(a), ack: 'Clear — finishing a task is part of the plan.' },
        { id: 'features-left', applies: c => COUNTS_DONE.test(c.text) && !LEFT.test(c.text),
          question: 'The app has to show how many tasks are **left**. Should that number include the finished tasks, or only the unfinished ones?',
          retry: 'Picture three tasks where one is finished. Which number should the app show?', resolves: a => LEFT.test(a) || /\b2\b|\btwo\b|\bonly (the )?(ones|tasks) (that are )?not\b/i.test(a),
          ack: 'Right — the number shows the tasks still left to do.' },
        { id: 'features-count', applies: c => !COUNT.test(c.text) && !LEFT.test(c.text), question: 'The finished app also tells you how much is still to do. Where does that appear in your plan?',
          retry: 'Glancing at the app, how would someone know how much work is left?', resolves: a => COUNT.test(a) || LEFT.test(a), ack: 'Good — the counter is in the plan.' }
      ] },
    { id: 'data', title: 'Data', purpose: 'What information must the application store? Think about what it has to remember about every task.',
      question: 'What does your app need to remember — about each task, and about all of them together?',
      vocab: /\b(task\w*|title|text|name|list|array|object|done|status|store\w*|save\w*|remember\w*|keep\w*|variable|boolean|flag|data)\b/i,
      accept: 'Your **Data** says what each task remembers and where the tasks are kept.',
      rules: [
        { id: 'data-title', applies: lacks(/\b(title|text|name|words?|description|label|string|what it says|content|li|elements?)\b/i), question: 'Each task says something, like "Buy milk". Where does your plan keep that?',
          retry: 'If you wrote a task on a sticky note, what is on the note — and where is that in your data?', resolves: a => /\b(title|text|name|words?|description|label|string|says|content)\b/i.test(a), ack: 'Okay — each task keeps its text.' },
        { id: 'data-done', applies: lacks(/\b(done|complet\w*|finish\w*|status|true|false|boolean|class|flag|tick\w*|check\w*|two (arrays|lists)|separate (array|list)|another (array|list))\b/i),
          question: 'You keep the tasks. How will your app know whether a task is finished?', retry: 'Two tasks look the same on screen, but one is finished. What does your data remember to tell them apart?',
          resolves: a => /\b(done|complet\w*|finish\w*|status|true|false|boolean|class|flag|tick\w*|check\w*|separate|two|another)\b/i.test(a), ack: 'Good — now each task knows whether it is finished.' },
        { id: 'data-together', applies: lacks(/\b(list|array|arrays|lists|collection|together|all (the|my|of the) tasks|page|dom|li|elements?)\b/i),
          question: 'Where are all the tasks kept together, so your code can go through them?', retry: 'Your app has five tasks. In one place, where does it keep all five?',
          resolves: a => /\b(list|array|collection|together|page|dom|elements?|one place|variable)\b/i.test(a), ack: 'Right — the tasks live together in one place.' }
      ] },
    { id: 'logic', title: 'Logic', purpose: 'How will the application change that information? Walk through what happens when someone uses each feature.',
      question: 'What has to happen to your data when someone adds a task, finishes one, or wants to know how many are left?',
      vocab: /\b(add\w*|push\w*|append\w*|creat\w*|new|click\w*|toggl\w*|mark\w*|done|count\w*|left|filter\w*|loop\w*|chang\w*|updat\w*|input|press\w*|flip\w*|remov\w*)\b/i,
      accept: 'Your **Logic** walks through adding, finishing and counting — that is the heart of the app.',
      rules: [
        { id: 'logic-input', applies: c => /\badd\w*|\bnew task|\bcreat\w*/i.test(c.text) && !/\b(input|text ?box|box|field|value|typed|type\w*|what (the user|someone|they) (wrote|typed|entered))\b/i.test(c.text),
          question: 'When someone presses Add, where does the new task\'s text come from — and what happens to the text box afterwards?', retry: 'After pressing Add, what should someone see in the text box where they typed?',
          resolves: a => /\b(input|box|field|value|clear\w*|empty|typed|type\w*|reset\w*|blank)\b/i.test(a), ack: 'Right — read the text box, then clear it.' },
        { id: 'logic-keep', applies: c => /\badd\w*/i.test(c.text) && (/\b(replace\w*|overwrit\w*|instead of)\b/i.test(c.text) || !/\b(keep\w*|existing|end of|push\w*|append\w*|add\w* (it |the task |them )?(to|onto|into|at)|onto|already|the rest|others|old ones|together with|plus|as well|grow\w*|extra|one more)\b/i.test(c.text)),
          question: 'When a new task is added, what happens to the tasks that are already in the list?', retry: 'You have "Read" and "Cook". You add "Run". Which tasks should the list hold now?',
          resolves: a => /\b(keep\w*|stay\w*|still|existing|already|end|push\w*|append\w*|add\w* (it |the task |them )?(to|onto|into)|old|others|rest|together|all three|three|both|as well|plus)\b/i.test(a) && !/\b(replace\w*|only the new|disappear\w*|gone)\b/i.test(a),
          ack: 'Yes — the new task joins the ones already there.' },
        { id: 'logic-toggle', applies: lacks(/\b(toggl\w*|flip\w*|switch\w*|mark\w*|done|finish\w*|complet\w*|tick\w*|check\w*|opposite|undo)\b|\bmov\w*\b[^.\n]{0,24}\b(to|into)\b/i), question: 'What has to change when someone clicks a task to finish it?',
          retry: 'Someone clicks "Cook". What is different in your data afterwards?', resolves: a => /\b(toggl\w*|flip\w*|switch\w*|mark\w*|done|finish\w*|complet\w*|true|class|chang\w*|opposite)\b/i.test(a), ack: 'Good — clicking changes the task\'s finished state.' },
        { id: 'logic-count', applies: lacks(/\b(count\w*|left|remain\w*|length|how many|filter\w*|loop\w*|go(es|ing)? (through|over)|add\w* up|tally|each|every|minus|subtract\w*)\b/i), question: 'How will your code work out the number of tasks left?',
          retry: 'If you had the list on paper, how would you find how many are left?', resolves: a => /\b(count\w*|filter\w*|loop\w*|go(ing)? through|each|every|length|add up|not done|unfinished|minus|subtract\w*)\b/i.test(a), ack: 'That works — that is how the number gets worked out.' },
        { id: 'logic-empty', applies: c => !/\b(empty|no tasks|zero|0|nothing|none|no items)\b/i.test(c.plan), question: 'What should your counter say when there are no tasks at all — and does your plan handle that?',
          retry: 'Someone deletes or finishes everything. What number appears?', resolves: a => /\b(0|zero|empty|nothing|none|no tasks|no items)\b/i.test(a), ack: 'Good — an empty list is covered too.' }
      ] },
    { id: 'uiData', title: 'UI ↔ Data', purpose: 'How do user actions affect the stored data and the screen? The list and the counter on the page must always match your data.',
      question: 'When someone adds or finishes a task, how do the list and the counter on the screen find out?',
      vocab: /\b(screen|page|show\w*|display\w*|list|render\w*|draw\w*|updat\w*|refresh\w*|chang\w*|click\w*|count\w*|ui|html|li|dom|element\w*|see)\b/i,
      accept: 'Your **UI ↔ Data** keeps the screen in step with the data after every change.',
      rules: [
        { id: 'ui-sync', applies: lacks(/\b(render\w*|redraw\w*|updat\w*|refresh\w*|show\w* (it )?again|rebuild\w*|draw\w*|re-?display\w*|sync\w*|match\w*|appear\w*|reflect\w*|append\w*|chang\w* (the )?(page|screen|list))\b/i),
          question: 'When your data changes, how does the screen find out?', retry: 'You push a new task into your data. What makes it appear on the page?',
          resolves: a => /\b(render\w*|redraw\w*|updat\w*|refresh\w*|again|rebuild\w*|draw\w*|display\w*|append\w*|creat\w* (an? )?(li|element))\b/i.test(a), ack: 'Right — the screen follows the data whenever it changes.' },
        { id: 'ui-count-when', applies: c => !TIMING.test(c.text) && !ON_CHANGE.test(c.text),
          question: 'When should the counter update? What happens on screen right after someone finishes or adds a task?', retry: 'You click a task to finish it. What has to happen so the number on screen changes too?',
          resolves: a => TIMING.test(a) || ON_CHANGE.test(a), ack: 'Good — if the counter updates after every change, it can never show an old number.' }
      ] },
    { id: 'steps', title: 'Steps', purpose: 'In what order will you build it? Small steps, each one checked before the next.',
      question: 'In what order will you build the app, and how will you check that each step works?',
      vocab: /\b(first|then|next|after\w*|start\w*|finally|step\w*|build\w*|test\w*|check\w*|milestone\w*|last|before)\b/i,
      accept: 'Your **Steps** build the app piece by piece and check each piece — that is how bugs stay small.',
      rules: [
        { id: 'steps-order', applies: c => (c.text.match(/\b(first|then|next|after\w*|before|start\w*|finally|last|second|third|\d[.)])/gi) || []).length < 2,
          question: 'What will you build first, and what builds on it?', retry: 'If you could only build one piece today, which would it be — and which piece comes after it?',
          resolves: a => /\b(first|then|next|after|before|start|finally|last)\b/i.test(a), ack: 'Good — there is an order to it now.' },
        { id: 'steps-check', applies: lacks(/\b(check\w*|test\w*|see|verify\w*|make sure|try\w*|run\w*|works?|preview)\b/i), question: 'After each step, how will you check that it works before moving on?',
          retry: 'You just finished the Add button. What do you do before starting on the counter?', resolves: a => /\b(check\w*|test\w*|see|verify|make sure|try\w*|click\w*|works?|run\w*|preview)\b/i.test(a),
          ack: 'Good — checking each step means bugs show up early, while they are small.' }
      ] }
  ],
  // Workspace: a failed check that contradicts the student's own plan → a question about that part of it.
  links: [
    { tags: ['add-replaces', 'add-missing'], section: 'logic', mentions: /\b(keep\w*|existing|already|push\w*|append\w*|end|add\w*|old|others|together)\b/i,
      ask: q => `Your Blueprint says: “${q}” Does your Add code do that — what happens to the tasks that were already there?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: what did you plan to happen to the existing tasks when one is added? Does your code do that?' },
    { tags: ['count-stale'], section: 'uiData', mentions: /\b(every|each|whenever|after|updat\w*|redraw\w*|render\w*|count\w*)\b/i,
      ask: q => `Your Blueprint says: “${q}” When does your code actually write #count?`, askNoQuote: 'Open **MY BLUEPRINT** → **UI ↔ Data**: when did you plan the counter to update? When does your code write it?' },
    { tags: ['counts-all-tasks', 'count-done-vs-left', 'count-wrong', 'count-not-shown'], section: 'features', mentions: /\b(left|remain\w*|unfinished|not (yet )?(done|finished)|count\w*|how many)\b/i,
      ask: q => `Your plan says: “${q}” Which tasks is your code counting right now?`, askNoQuote: 'Open **MY BLUEPRINT** → **Features**: what did you say the number shows? Which tasks is your code counting?' },
    { tags: ['done-lost', 'done-not-rendered'], section: 'data', mentions: /\b(done|status|finish\w*|complet\w*|true|false|class|flag)\b/i,
      ask: q => `Your Blueprint keeps this: “${q}” Where does your drawing code read it?`, askNoQuote: 'Open **MY BLUEPRINT** → **Data**: how does a task remember that it is finished? Does your drawing code read it?' },
    { tags: ['toggle-missing', 'toggle-stuck', 'toggle-wrong'], section: 'logic', mentions: /\b(click\w*|toggl\w*|mark\w*|flip\w*|finish\w*|done)\b/i,
      ask: q => `Your plan says: “${q}” What does your click handler change?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: what did you plan to change when a task is clicked?' },
    { tags: ['input-not-cleared'], section: 'logic', mentions: /\b(clear\w*|empty|reset\w*|blank|input|box)\b/i,
      ask: q => `Your plan says: “${q}” What is left in the text box after Add in your code?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: what happens to the text box after Add?' },
    { tags: ['not-rendered', 'render-mismatch', 'render-hardcoded'], section: 'uiData', mentions: /\b(show\w*|render\w*|draw\w*|display\w*|list|page|screen)\b/i,
      ask: q => `Your Blueprint says: “${q}” Where does your code turn the tasks from \`loadTasks()\` into list items?`, askNoQuote: 'Open **MY BLUEPRINT** → **UI ↔ Data**: how did you plan the list to appear on the page?' }
  ]
};
