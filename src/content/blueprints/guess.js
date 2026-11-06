// Project Blueprint for the Python Guess the Number game (learn/blueprint.js) — same five sections and the
// same rule format as the To-Do Blueprint, with Python's own ideas: comparing a guess with the secret,
// "too low / too high" feedback, a loop that ends when the guess is right, input() giving text, unusual
// guesses. Several designs pass: a while loop asking for input, a for loop over a list of guesses, a
// function per job, a flag or a break to stop.
// ctx: { own (section text), answers (replies), text (both), plan (every section + replies), resolved }

const STOP = /\b(stop\w*|until|break\w*|end\w*|return\w*|finish\w*|exit\w*|quit\w*|over|leave\w*|done|no more)\b/i;
const has = re => c => re.test(c.text);
const lacks = re => c => !re.test(c.text);

export const GUESS_BLUEPRINT = {
  project: 'Guess the Number game',
  brief: 'Before you write **game.py**, plan the game in your own words. Five short sections — your mentor reads each one and asks about anything that is missing. It will never design the game for you, and there is no single right design.',
  sections: [
    { id: 'features', title: 'Features', purpose: 'What should the program do? Describe the game from the player\'s side.',
      question: 'What happens in your game, from the moment the player makes a guess until the game is over?',
      vocab: /\b(guess\w*|number|secret|game|player|low|high|correct|right|tries|attempt\w*|higher|lower|win\w*|hint\w*)\b/i,
      accept: 'Your **Features** describe the game from the player\'s side: guesses, hints after each one, and how it ends.',
      rules: [
        { id: 'features-feedback', applies: lacks(/\b(too (low|high|small|big)|higher|lower|bigger|smaller|less|more|correct|right|hint\w*|feedback|tell\w*|clue\w*)\b/i),
          question: 'After each guess, what does the player find out?', retry: 'The secret is 7 and the player guesses 3. What should the game say?',
          resolves: a => /\b(too (low|high|small|big)|higher|lower|bigger|smaller|correct|right|hint\w*|tell\w*|say\w*)\b/i.test(a), ack: 'Right — every guess gets an answer back.' },
        { id: 'features-end', applies: lacks(/\b(end\w*|stop\w*|win\w*|until|game (is )?over|is over|finish\w*|correct|right|guess\w* it|found)\b/i),
          question: 'How does the game end?', retry: 'The player has just guessed the secret. What happens next?', resolves: a => /\b(end\w*|stop\w*|win\w*|over|finish\w*|correct|right|found|done)\b/i.test(a), ack: 'Clear — the game has an ending.' },
        { id: 'features-tries', applies: lacks(/\b(tries|try|attempt\w*|count\w*|how many|took|number of guesses|score|turns?)\b/i),
          question: 'When the game is won, what does the player learn about how they did?', retry: 'Two players both win. How would they know who did better?',
          resolves: a => /\b(tries|try|attempt\w*|count\w*|how many|took|guesses|score|turns?)\b/i.test(a), ack: 'Good — the number of tries is part of the game.' }
      ] },
    { id: 'data', title: 'Data', purpose: 'What information must the program store? Think about what it remembers while the game runs.',
      question: 'What does your program need to remember while the game is running?',
      vocab: /\b(secret|number|guess\w*|count\w*|tries|attempt\w*|variable\w*|store\w*|remember\w*|int|integer|list|state|won|solved|value\w*|keep\w*)\b/i,
      accept: 'Your **Data** names what the game remembers: the secret, the guesses, the tries and whether it is over.',
      rules: [
        { id: 'data-secret', applies: lacks(/\b(secret|hidden|target|answer|the number to guess|random|correct number|right number|chosen number)\b/i),
          question: 'What does the program have to remember that the player cannot see?', retry: 'Before the first guess, which number is already decided?',
          resolves: a => /\b(secret|hidden|target|answer|random|chosen|picked|correct number)\b/i.test(a), ack: 'Yes — the secret is the one thing the player never sees.' },
        { id: 'data-tries', applies: lacks(/\b(tries|try|attempt\w*|count\w*|counter|number of guesses|how many|turns?)\b/i),
          question: 'How will the program keep track of how many guesses were made?', retry: 'After three guesses, where does the number 3 live in your program?',
          resolves: a => /\b(tries|attempt\w*|count\w*|counter|variable|how many|turns?|add (one|1)|\+= ?1|plus one)\b/i.test(a), ack: 'Good — a counter for the tries.' },
        { id: 'data-state', applies: lacks(/\b(won|win\w*|solved|found|finished|over|playing|state|boolean|flag|correct|done|until|stop\w*|keep going|still going)\b/i),
          question: 'How will the program know whether the game is still going or already won?', retry: 'Halfway through the game, what tells your program to ask for another guess?',
          resolves: a => /\b(won|win|solved|found|finished|over|state|boolean|flag|correct|until|stop\w*|loop|while|equal|same)\b/i.test(a), ack: 'Right — the program always knows whether the game is over.' }
      ] },
    { id: 'logic', title: 'Logic', purpose: 'How will the program work with that information? Walk through what happens to one guess, then to many.',
      question: 'What does your program do with each guess — and what makes it stop?',
      vocab: /\b(compar\w*|if|elif|else|less|greater|smaller|bigger|lower|higher|equal\w*|loop\w*|while|for|repeat\w*|until|return\w*|check\w*|count\w*|guess\w*)\b/i,
      accept: 'Your **Logic** compares each guess, answers it, counts it and stops at the right one.',
      rules: [
        { id: 'logic-compare', applies: lacks(/\b(compar\w*|less|greater|smaller|bigger|lower|higher|below|above|equal\w*|same|match\w*)\b|[<>]|==/i),
          question: 'How will the program decide whether a guess is too low, too high or right?', retry: 'The secret is 7. How does the program tell 3 apart from 9 and from 7?',
          resolves: a => /\b(compar\w*|less|greater|smaller|bigger|lower|higher|below|above|equal\w*|same)\b|[<>]|==/i.test(a), ack: 'Good — every guess is compared with the secret.' },
        { id: 'logic-direction', applies: has(/too low[^.,;\n]*\b(bigger|greater|higher|above|more than)\b|too high[^.,;\n]*\b(smaller|less|lower|below)\b|\b(bigger|greater|higher|above|more)\b[^.,;\n]*too low|\b(smaller|less|lower|below)\b[^.,;\n]*too high/i),
          question: 'Picture a secret of 7 and a guess of 3. Is that guess too low or too high — and which comparison tells you?', retry: 'A guess that is smaller than the secret — what should the game say about it?',
          resolves: a => /\b(too low|smaller|less|lower|below)\b|</i.test(a) && !/\btoo high\b[^.]*\b(smaller|less|below)\b/i.test(a), ack: 'Right — a guess below the secret is too low.' },
        { id: 'logic-repeat', applies: lacks(/\b(loop\w*|while|for|repeat\w*|each|every|again|until|one by one|keep (asking|going|guessing)|next guess|all the guesses)\b/i),
          question: 'How will the program handle more than one guess?', retry: 'The first guess was wrong. What happens next in your program?',
          resolves: a => /\b(loop\w*|while|for|repeat\w*|each|every|again|until|next|keep)\b/i.test(a), ack: 'Good — the program goes through guess after guess.' },
        { id: 'logic-stop', applies: c => !STOP.test(c.text) || !/\b(correct|right|equal\w*|same|match\w*|guess\w* it|found|win\w*)\b/i.test(c.text),
          question: 'Your program repeats for each guess. What makes it stop — and when exactly?', retry: 'The player guesses right on the third try. What should happen to a fourth guess?',
          resolves: a => STOP.test(a) || /\b(no more|don'?t (check|count)|ignore\w*|never asked)\b/i.test(a), ack: 'Yes — it stops at the right guess, so it can never run forever.' }
      ] },
    { id: 'uiData', title: 'UI ↔ Data', purpose: 'How do the player\'s guesses change what the program remembers, and what appears in the terminal?',
      question: 'When a guess comes in, what changes in what your program remembers — and what does the player see in the terminal?',
      vocab: /\b(input|print\w*|terminal|output|show\w*|typ\w*|enter\w*|screen|message|display\w*|player|guess\w*|return\w*|chang\w*|updat\w*)\b/i,
      accept: 'Your **UI ↔ Data** links each guess to what the program remembers and what it shows.',
      rules: [
        { id: 'ui-output', applies: lacks(/\b(print\w*|show\w*|display\w*|output|terminal|screen|message|tell\w*|says?|return\w*|see\w*)\b/i),
          question: 'After each guess, what appears in the terminal — and where does that text come from?', retry: 'The player guessed 50. What line of text do they see?',
          resolves: a => /\b(print\w*|show\w*|display\w*|output|terminal|message|tell\w*|say\w*|return\w*)\b/i.test(a), ack: 'Good — the player always sees an answer.' },
        { id: 'ui-input', applies: c => /\binput\b/i.test(c.text) && !/\b(int|integer|whole number|convert\w*|cast\w*|turn\w* (it )?into a number|text|string|str|digits?)\b/i.test(c.text),
          question: '`input()` gives you text. How will you compare it with the secret number?', retry: 'The player types 42. Is that the number 42, or the text "42" — and does the difference matter?',
          resolves: a => /\b(int|integer|convert\w*|cast\w*|number|turn\w*)\b/i.test(a), ack: 'Right — turn the text into a number before comparing.' },
        { id: 'ui-state', applies: lacks(/\b(chang\w*|updat\w*|add\w*|increas\w*|count\w*|store\w*|remember\w*|save\w*|becomes|set\w*|plus one|goes up)\b|\+=/i),
          question: 'When a guess comes in, what does the program change in what it remembers?', retry: 'After the second guess, which value in your program is different from before?',
          resolves: a => /\b(chang\w*|updat\w*|add\w*|increas\w*|count\w*|store\w*|remember\w*|goes up|plus one|set\w*)\b|\+=/i.test(a), ack: 'Good — each guess updates what the program remembers.' }
      ] },
    { id: 'steps', title: 'Steps', purpose: 'In what order will you build and test the game? Small steps, each one checked before the next.',
      question: 'In what order will you build the game, and how will you check that each part works?',
      vocab: /\b(first|then|next|after\w*|start\w*|finally|step\w*|build\w*|test\w*|check\w*|milestone\w*|last|before|write)\b/i,
      accept: 'Your **Steps** build the game in small pieces and test each one, including the unusual cases.',
      rules: [
        { id: 'steps-order', applies: c => (c.text.match(/\b(first|then|next|after\w*|before|start\w*|finally|last|second|third|\d[.)])/gi) || []).length < 2,
          question: 'What will you write first, and what builds on it?', retry: 'If you could only write one function today, which one — and which comes after it?',
          resolves: a => /\b(first|then|next|after|before|start|finally|last)\b/i.test(a), ack: 'Good — there is an order to it now.' },
        { id: 'steps-check', applies: lacks(/\b(check\w*|test\w*|see|verify\w*|make sure|try\w*|run\w*|works?)\b/i), question: 'After each part, how will you check that it works before moving on?',
          retry: 'You just wrote the part that compares one guess. How do you know it is right before writing the rest?', resolves: a => /\b(check\w*|test\w*|see|verify|make sure|try\w*|run\w*|works?|call\w*)\b/i.test(a),
          ack: 'Good — testing each part means bugs show up early, while they are small.' },
        { id: 'steps-edge', applies: c => !/\b(edge|unusual|special|first (guess|try)|right away|straight away|immediately|invalid|not a number|letters|wrong input|empty|negative|out of range|outside|too big|zero|same guess|twice|never)\b/i.test(c.plan),
          question: 'Which unusual cases will you test — for example the very first guess being right, or a guess that is not a valid number?', retry: 'Think of a guess that could surprise your program. What is it, and what should happen?',
          resolves: a => /\b(edge|unusual|first|right away|invalid|not a number|letters|wrong|empty|negative|range|outside|big|zero|twice|word|text)\b/i.test(a), ack: 'Good — the unusual cases are where bugs hide.' }
      ] }
  ],
  links: [
    { tags: ['loop-timeout'], section: 'logic', mentions: STOP,
      ask: q => `Your plan says: “${q}” Your program never stopped — which line is meant to make that happen?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: what did you plan to make the game stop? Which line in your code does that?' },
    { tags: ['counts-all-guesses', 'off-by-one', 'count-tries'], section: 'logic', mentions: /\b(stop\w*|count\w*|tries|attempt\w*|first|until|return\w*|correct|right)\b/i,
      ask: q => `Your Blueprint says: “${q}” At which guess does your \`play\` stop counting?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: when did you plan to stop counting tries?' },
    { tags: ['compare-direction', 'if-branch'], section: 'logic', mentions: /\b(low|high|less|greater|smaller|bigger|compar\w*|below|above)\b|[<>]/i,
      ask: q => `Your plan says: “${q}” Which comparison in \`check\` matches that — try it with 3 and 7?`, askNoQuote: 'Open **MY BLUEPRINT** → **Logic**: how did you plan to tell "too low" from "too high"?' },
    { tags: ['missing-return', 'string-mismatch'], section: 'features', mentions: /\b(too low|too high|correct|tell\w*|say\w*|hint\w*|feedback|answer\w*)\b/i,
      ask: q => `Your Blueprint says: “${q}” Does \`check\` give exactly that answer back with \`return\`?`, askNoQuote: 'Open **MY BLUEPRINT** → **Features**: what did you plan each guess to get back?' },
    { tags: ['mutates-input'], section: 'uiData', mentions: /\b(chang\w*|updat\w*|remember\w*|store\w*|list)\b/i,
      ask: q => `Your plan says: “${q}” Is the list of guesses something \`play\` should change?`, askNoQuote: 'Open **MY BLUEPRINT** → **UI ↔ Data**: which values did you plan each guess to change?' }
  ]
};
