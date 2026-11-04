// PRO project (Python): Guess the Number. The student writes game.py (`check` and `play`); the checks are
// Python snippets run by run/project-py.js, each against a fresh copy of the program, with randomised
// numbers (seeded by the code) so returning fixed answers fails. `expect(actual, expected, label)` is the
// harness's comparison (same type and value; True is not 1).
//   check: { id, ms, py(rng) → Python source, tags(actual, expected) → mistake tags, ask, ask2 }

const n = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const q = s => JSON.stringify(s); // a Python string literal for plain ASCII text

// Why a check() answer is wrong: nothing returned / the opposite branch / almost the right text.
const checkTags = want => actual => {
  if (actual === null) return ['missing-return'];
  if (typeof actual === 'string' && actual.trim().toLowerCase() === want.toLowerCase()) return ['string-mismatch'];
  if (want !== 'Correct!' && (actual === 'Too low' || actual === 'Too high')) return ['compare-direction'];
  return ['if-branch'];
};
// Why a play() count is wrong: nothing returned / one short / kept counting past the right guess.
const playTags = (actual, expected) => (actual === null ? ['missing-return'] : actual === expected - 1 ? ['off-by-one'] : typeof actual === 'number' && actual > expected ? ['counts-all-guesses'] : ['count-tries']);

const ASK = {
  low: ['When the guess is smaller than the secret, which line of `check` decides the answer — and does it `return` it?', 'Read your comparison out loud with the numbers 3 and 7. Is it `True`?'],
  high: ['What is the opposite of “too low”, and which branch of `check` handles it?', 'Try your function in your head with 9 and 7: which branch runs first?'],
  correct: ['After “too low” and “too high”, what is the only case left — and what text should come back?', 'Is the text exactly `"Correct!"`, capital C and the exclamation mark included?'],
  play: ['Walking through the guesses one by one, when should `play` stop counting?', 'If the secret is the second guess, which number should come back — and what does yours return?'],
  keep: ['Counting only needs to look at the guesses. Does `play` change the list it was given?', 'Which line removes, adds or reorders items in `guesses`?']
};
const C = (id, ms, py, tags, [ask, ask2]) => ({ id, ms, py, tags, ask, ask2 });

export const CHECKS = [
  C('low-basic', 0, () => 'expect(check(3, 7), "Too low", "check(3, 7)")', checkTags('Too low'), ASK.low),
  C('low-random', 0, r => { const s = n(r, 20, 90), g = n(r, 1, s - 1); return `expect(check(${g}, ${s}), "Too low", "check(${g}, ${s})")`; }, checkTags('Too low'), ASK.low),
  C('low-close', 0, r => { const s = n(r, 2, 99); return `expect(check(${s - 1}, ${s}), "Too low", "check(${s - 1}, ${s})")`; }, checkTags('Too low'), ASK.low),
  C('high-basic', 1, () => 'expect(check(9, 7), "Too high", "check(9, 7)")', checkTags('Too high'), ASK.high),
  C('high-random', 1, r => { const s = n(r, 10, 80), g = n(r, s + 1, 100); return `expect(check(${g}, ${s}), "Too high", "check(${g}, ${s})")`; }, checkTags('Too high'), ASK.high),
  C('high-close', 1, r => { const s = n(r, 1, 98); return `expect(check(${s + 1}, ${s}), "Too high", "check(${s + 1}, ${s})")`; }, checkTags('Too high'), ASK.high),
  C('correct-basic', 2, () => 'expect(check(7, 7), "Correct!", "check(7, 7)")', checkTags('Correct!'), ASK.correct),
  C('correct-random', 2, r => { const s = n(r, 1, 100); return `expect(check(${s}, ${s}), "Correct!", "check(${s}, ${s})")`; }, checkTags('Correct!'), ASK.correct),
  C('three-ways', 2, r => { const s = n(r, 10, 90); return [[s - 5, 'Too low'], [s + 5, 'Too high'], [s, 'Correct!']].map(([g, w]) => `expect(check(${g}, ${s}), ${q(w)}, "check(${g}, ${s})")`).join('\n'); }, checkTags('Correct!'), ASK.correct),
  C('play-example', 3, () => 'expect(play(42, [50, 25, 37, 42]), 4, "play(42, [50, 25, 37, 42])")', playTags, ASK.play),
  C('play-first', 3, r => { const s = n(r, 1, 50); const g = [s, s + 10, s + 3]; return `expect(play(${s}, ${q(g)}), 1, "play(${s}, [${g.join(', ')}])")`; }, playTags, ASK.play),
  C('play-stops', 3, r => { const s = n(r, 10, 60); const g = [s + 4, s, s - 2, s]; return `expect(play(${s}, ${q(g)}), 2, "play(${s}, [${g.join(', ')}])")`; }, playTags, ASK.play),
  C('play-random', 3, r => {
    const s = n(r, 1, 100), k = n(r, 2, 5), g = [];
    while (g.length < k - 1) { const x = n(r, 1, 100); if (x !== s) g.push(x); }
    g.push(s, n(r, 1, 100));
    return `expect(play(${s}, ${q(g)}), ${k}, "play(${s}, [${g.join(', ')}])")`;
  }, playTags, ASK.play),
  C('play-keeps-list', 3, r => { const s = n(r, 10, 60); const g = [s + 7, s - 3, s]; return `g = ${q(g)}\nplay(${s}, g)\nexpect(g, ${q(g)}, "the guesses list after play(${s}, [${g.join(', ')}])")`; }, () => ['mutates-input'], ASK.keep)
];

const at = e => (e.line ? ` (line ${e.line})` : '');
export const ERROR_ASK = {
  timeout: 'Your program never finished, so I stopped it. If you use a `while` loop: what changes each time round — and when does its condition become `False`?',
  error(e) {
    const m = e.message;
    if (e.kind === 'syntax' || /SyntaxError|IndentationError|TabError/.test(e.name)) return `**${e.name}${at(e)}:** \`${m}\`. Nothing ran yet. Python reads structure from colons and indentation — is a \`:\` missing, or is a line indented differently from its neighbours?`;
    const name = /name '([^']+)' is not defined/.exec(m);
    if (name) return `\`${name[1]}\` is not defined${at(e)}. Where did you create it — and is the spelling exactly the same?`;
    if (/NoneType/.test(m)) return `\`${e.name}: ${m}\`${at(e)}. Something was \`None\` — which function gave nothing back? Does every path through it end in \`return\`?`;
    if (/EOF when reading a line|EOFError/.test(e.name + m)) return 'The checks call your functions directly, so nobody is there to answer `input()`. Which values should come in as parameters instead?';
    return `\`${e.name}: ${m}\`${at(e)}. What value did that line expect, and what did it actually get?`;
  }
};

export const GUESS = {
  title: 'Guess the Number', file: 'game.py', cmd: 'pytest game.py', url: 'python game.py — terminal',
  brief: 'Build the brain of a number-guessing game. You write **game.py**: a `check` function that judges each guess and a `play` function that counts the tries. Your AI mentor reviews every run.',
  starter: '# Guess the Number — write the game logic.\n# check(guess, secret) -> "Too low", "Too high" or "Correct!"\n# play(secret, guesses) -> how many guesses it took to hit the secret\n\ndef check(guess, secret):\n    pass\n\n\ndef play(secret, guesses):\n    pass\n',
  ms: [
    { n: 'Too low', d: 'check(3, 7) returns "Too low" — for any guess below the secret.',
      hints: ['`check` has to give an answer back, not print it. Which keyword sends a value back to whoever called the function?',
        'Compare `guess` with `secret`. Which comparison is `True` when the guess is too small?',
        'That comparison in an `if`, returning the exact text `"Too low"` — capital T, no extra spaces. Is that what yours returns?'],
      alt: 'Checking `guess == secret` first and the other cases after is just as valid — the checks only look at what `check` returns.' },
    { n: 'Too high', d: 'check(9, 7) returns "Too high" — for any guess above the secret.',
      hints: ['You already handle “too small”. What is the opposite situation?',
        '`elif` lets the same function answer a second way. Which comparison means the guess is bigger?',
        'The text must be exactly `"Too high"`. Can that branch be reached, or does an earlier `return` always win?'],
      alt: 'Two separate `if` statements, each with its own `return`, work as well as `if` / `elif`.' },
    { n: 'Correct!', d: 'check(7, 7) returns "Correct!".',
      hints: ['After “too low” and “too high”, what is the only case left?',
        '`else` catches everything the earlier branches did not. What should it return?',
        'Exactly `"Correct!"` — with the exclamation mark. Is every path through `check` ending in a `return`?'],
      alt: 'An explicit `elif guess == secret:` instead of `else:` is equally correct — some find it clearer.' },
    { n: 'Count the tries', d: 'play(42, [50, 25, 37, 42]) returns 4 — it stops at the first correct guess.',
      hints: ['Walk through the guesses one by one. What do you need to keep track of while you walk?',
        'Keep a counter, add one per guess, and stop as soon as the guess is right. Which keyword leaves the function at once with a value?',
        'If you `return` the counter inside the loop at the first correct guess, later guesses never count. Does yours do that?'],
      alt: '`for tries, g in enumerate(guesses, start=1):` is another tidy way to count — reusing `check(g, secret) == "Correct!"` keeps the rules in one place.' }
  ],
  checks: CHECKS, errorAsk: ERROR_ASK,
  demo: 'secret = 42\nfor g in [50, 25, 37, 42]:\n    print(f"> guess {g}   {check(g, secret)}")\nprint(f"Solved in {play(secret, [50, 25, 37, 42])} tries")',
  final: '**Final review: 90/100.** Every check passes: `check` answers all three cases and `play` stops at the first correct guess. Next step: let the player type guesses with `input()` and pick the secret with `random.randint`.'
};
