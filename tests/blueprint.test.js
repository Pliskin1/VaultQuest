// Project Blueprint (learn/blueprint.js + content/blueprints/*.js) for both languages: what is rejected,
// what is accepted (several designs), follow-up questions and revisions, the two-round escape hatch, the
// gate before the workspace (in the engine, not just the button), saving/restoring, independent plans per
// language, and plan-aware workspace questions that quote only what the student wrote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS } from '../src/content/languages.js';
import {
  newBlueprint, setDraft, reviewSection, answerSection, keepSection, canKeep, canBuild, startBuilding, mayBuild, waive,
  cleanBlueprint, linkPlan, planQuote, planForReview, logBp, MAX_CHAT, isDone
} from '../src/learn/blueprint.js';
import { newAttempt, beginSubmission, toSave, fromSave, attemptKey } from '../src/learn/attempt.js';

const specOf = lang => LANGS[lang].levels[6].blueprint;
const idsOf = lang => specOf(lang).sections.map(s => s.id);
const fresh = lang => newBlueprint(idsOf(lang));
const write = (bp, lang, id, text) => { setDraft(bp, id, text); return reviewSection(bp, specOf(lang), id); };

export const PLANS = {
  js: {
    features: 'People can add a task by typing it and pressing Add, click a task to mark it done, and see how many tasks are left at the bottom.',
    data: 'I keep an array of task objects. Each task has a title with its text and a done value that is true or false.',
    logic: 'When Add is pressed I read the text from the input, push a new task onto the end of the array and clear the box. Clicking a task flips its done value. To count I filter the tasks that are not done; with no tasks that is 0.',
    uiData: 'After every change I call render, which redraws the whole list from the array and updates the counter, so the page always matches the data.',
    steps: 'First I show the tasks, then I make Add work, then marking as done, and finally the counter. After each step I run the checks and try it in the preview.'
  },
  py: {
    features: 'The player makes a guess and the game says too low, too high or correct. When the guess is right the game ends and tells how many tries it took.',
    data: 'The program remembers the secret number, the current guess, a counter of tries and whether the game is won.',
    logic: 'For each guess I compare it with the secret: if it is smaller it is too low, if it is bigger it is too high, otherwise correct. I repeat for the next guess and stop as soon as the guess is correct.',
    uiData: 'Each guess adds one to the tries counter and the program prints the hint in the terminal, so the player sees the result.',
    steps: 'First I write check and test it with a few numbers, then I write play and test it, including when the first guess is right.'
  }
};
// Other valid designs, in beginner words.
const ALTERNATIVES = {
  js: [
    { features: 'You can type something to do and add it, cross things off when finished, and the app shows how many are still left.',
      data: 'Two arrays: one for the tasks still to do and one for the finished ones. Each item is just the text of the task.',
      logic: 'Adding takes what was typed in the input box, adds it to the end of the to-do array so the old ones stay, and empties the box. Clicking moves a task to the other array. The number left is the length of the to-do array, and it is zero when it is empty.',
      uiData: 'Whenever something changes I draw both lists again and update the number, so the page shows exactly what is in the arrays.',
      steps: 'Start with showing the list, next the Add button, then finishing tasks and last the counter. I test each part in the preview before going on.' },
    { features: 'Someone adds new tasks with the button, marks a task as done by clicking it, and sees a count of the tasks remaining.',
      data: 'The page itself is the data: every task is an li element in the list, and a finished one gets the done class.',
      logic: 'On Add I make a new li with the input value, append it after the others and reset the input. A click toggles the done class. I count the li elements without the done class; with no items the count is 0.',
      uiData: 'Each time I add or click, I update the counter element right after the change, so it always matches the list on the page.',
      steps: 'First the list of tasks, then adding, then the click to finish, and finally the counter. I check every step in the preview.' }
  ],
  py: [
    { features: 'You keep guessing a number. After every guess you get a hint, higher or lower, until you get it right, then you see how many tries you needed.',
      data: 'A hidden random number, the guess the player typed, and a variable that counts the attempts. The loop runs until the guess equals the secret.',
      logic: 'In a while loop I ask for a guess and compare it with the secret: less means too low, greater means too high. I add one to the attempts each time and break out of the loop when they are equal.',
      uiData: 'input() gives me text, so I convert it to an int before comparing. Every guess updates the attempt counter and prints the hint for the player.',
      steps: 'First the comparison with a few test numbers, then the loop, then counting. I will test a first guess that is right and letters instead of a number.' },
    { features: 'The game takes guesses one at a time and answers each one with too low, too high or correct, and it ends with the number of tries.',
      data: 'The secret, the list of guesses, a counter for the tries and a flag that becomes True when the game is solved.',
      logic: 'I go through the guesses with a for loop and compare each one with the secret using if, elif and else. I count each guess and return the count as soon as one matches the secret, so later guesses are never looked at.',
      uiData: 'Each guess changes the counter, and check gives back the text that is shown to the player in the terminal.',
      steps: 'I start with check, test it with 3, 9 and 7, then write play and run it, also with an empty list of guesses.' }
  ]
};

for (const lang of ['js', 'py']) {
  const spec = specOf(lang), ids = idsOf(lang), other = lang === 'js' ? 'py' : 'js';

  test(`${lang}: five sections — features, data, logic, UI ↔ data, steps — each with purpose, question and rules`, () => {
    assert.deepEqual(ids, ['features', 'data', 'logic', 'uiData', 'steps']);
    for (const s of spec.sections) { assert.ok(s.purpose && s.question.endsWith('?') && s.accept && s.rules.length >= 2, s.id); for (const r of s.rules) assert.ok(r.question.trim().endsWith('?') && r.retry && r.ack, r.id); }
  });

  test(`${lang}: empty, too short, keyword lists and unrelated text are never accepted`, () => {
    for (const id of ids) {
      const bp = fresh(lang);
      assert.equal(reviewSection(bp, spec, id).verdict, 'empty');
      assert.equal(bp.sections[id].rounds, 0); // an empty box isn't a round of feedback
      for (const bad of ['idk', 'tasks', 'add done count left list array', 'loop guess secret number compare']) assert.equal(write(bp, lang, id, bad).verdict, 'short', bad);
      const r = write(bp, lang, id, 'My favourite food is pizza and I really like going to the beach in the summer with my friends.');
      assert.equal(r.verdict, 'unrelated', id);
      assert.equal(isDone(bp.sections[id]), false);
    }
  });

  test(`${lang}: a complete plan is accepted section by section, and the gate opens only at the end`, () => {
    const bp = fresh(lang);
    ids.forEach((id, k) => {
      assert.equal(canBuild(bp, spec), false);
      const r = write(bp, lang, id, PLANS[lang][id]);
      assert.equal(r.verdict, 'accepted', `${id}: ${r.text}`);
      assert.equal(r.done, k === ids.length - 1);
    });
    assert.equal(canBuild(bp, spec), true);
  });

  for (const [n, plan] of ALTERNATIVES[lang].entries()) {
    test(`${lang}: alternative design ${n + 1} is accepted too — no single right plan`, () => {
      const bp = fresh(lang);
      for (const id of ids) { const r = write(bp, lang, id, plan[id]); assert.equal(r.verdict, 'accepted', `${id}: ${r.text}`); }
    });
  }

  test(`${lang}: incomplete plans get one follow-up question about what's missing — never the answer`, () => {
    const cases = lang === 'js' ? [
      ['features', 'People can add a task by typing and pressing Add, click it to mark it done, and see a counter of how many tasks are done.', 'features-left'],
      ['data', 'I keep all the tasks in an array, and each task has a title with its text.', 'data-done'],
      ['logic', 'When Add is pressed I put the new task in the list, and clicking a task marks it done. I count the tasks that are not done, zero when empty.', 'logic-input'],
      ['logic', 'When Add is pressed I read the input value, set the list to only the new task and clear the box. A click toggles done. I count the unfinished ones, zero if empty.', 'logic-keep'],
      ['logic', 'On Add I read the input text, push a new task to the end of the array and clear the box. A click toggles done. I count the tasks that are not done with filter.', 'logic-empty'],
      ['uiData', 'I call render to redraw the list from the array so the page matches the data and shows the counter.', 'ui-count-when'],
      ['steps', 'First I show the tasks, then Add, then marking done, and finally the counter at the end.', 'steps-check']
    ] : [
      ['features', 'The player types a number and the game tells them whether it is too low or too high, over and over.', 'features-end'],
      ['data', 'The program keeps the guess the player typed and a counter of the tries so far.', 'data-secret'],
      ['logic', 'For each guess I compare it with the secret. If the guess is bigger it is too low, otherwise too high. I repeat until it is correct and then stop.', 'logic-direction'],
      ['logic', 'I compare each guess with the secret to say if it is lower or higher and then I ask for the next guess in a loop again and again.', 'logic-stop'],
      ['uiData', 'The guess comes from input and is compared with the secret, then the game prints the hint and counts the try.', 'ui-input'],
      ['steps', 'First I write the comparison and test it, then the loop and test it again with some numbers.', 'steps-edge']
    ];
    for (const [id, text, rule] of cases) {
      const bp = fresh(lang), r = write(bp, lang, id, text);
      assert.equal(r.verdict, 'gap', `${id}: ${text}`); assert.equal(r.rule, rule, `${text} → ${r.rule}`);
      assert.ok(r.text.trim().endsWith('?'), r.text);
      assert.equal(bp.sections[id].status, 'incomplete'); assert.equal(bp.sections[id].question, r.text);
    }
  });

  test(`${lang}: a real answer resolves the question; a reply that doesn't answer it is not accepted`, () => {
    const bp = fresh(lang), id = lang === 'js' ? 'features' : 'logic';
    const text = lang === 'js' ? 'People can add a task by typing and pressing Add, click it to mark it done, and see a counter of how many tasks are done.'
      : 'I compare each guess with the secret to say if it is lower or higher and then I ask for the next guess in a loop again and again.';
    write(bp, lang, id, text);
    const miss = answerSection(bp, spec, id, 'ok sure, whatever you think is best');
    assert.equal(miss.verdict, 'gap'); assert.match(miss.text, /^I'm not sure that answers it yet\. Let me ask it another way\./);
    const hit = answerSection(bp, spec, id, lang === 'js' ? 'Only the unfinished ones, the tasks still left to do.' : 'It stops as soon as the guess equals the secret, so there are no more guesses after that.');
    assert.equal(hit.verdict, 'accepted', hit.text); assert.ok(bp.sections[id].resolved.length === 1);
    assert.ok(hit.text.length > 20);
  });

  test(`${lang}: the same question is never repeated word for word`, () => {
    const bp = fresh(lang), id = 'steps', text = lang === 'js' ? 'First I show the tasks, then Add, then marking done, and finally the counter at the end.' : 'First I write the comparison and test it, then the loop and test it again with some numbers.';
    const q = [write(bp, lang, id, text).text, answerSection(bp, spec, id, 'hmm, not sure').text, answerSection(bp, spec, id, 'no idea really').text];
    assert.equal(new Set(q).size, 3, q.join('\n'));
    assert.match(q[2], /twice already/);
  });

  test(`${lang}: escape hatch — after two rounds a substantive answer may be kept; meaningless text never can`, () => {
    const bp = fresh(lang), id = 'steps', text = lang === 'js' ? 'First I show the tasks, then Add, then marking done, and finally the counter at the end.' : 'First I write the comparison and test it, then the loop and test it again with some numbers.';
    const r1 = write(bp, lang, id, text);
    assert.equal(r1.escape, false); assert.equal(canKeep(bp, id), false); assert.equal(keepSection(bp, spec, id), false);
    const r2 = answerSection(bp, spec, id, 'I am not sure what you mean');
    assert.equal(r2.escape, true); assert.equal(canKeep(bp, id), true);
    assert.equal(keepSection(bp, spec, id), true); assert.equal(bp.sections[id].status, 'kept'); assert.equal(bp.sections[id].accepted, text);
    // nonsense, however often it is sent, never opens the escape hatch
    const junk = fresh(lang);
    write(junk, lang, 'data', 'blah'); answerSection(junk, spec, 'data', 'no'); answerSection(junk, spec, 'data', 'nope'); answerSection(junk, spec, 'data', 'idk');
    assert.ok(junk.sections.data.rounds >= 3); assert.equal(canKeep(junk, 'data'), false); assert.equal(keepSection(junk, spec, 'data'), false);
    const off = fresh(lang);
    for (let k = 0; k < 4; k++) write(off, lang, 'data', `My favourite food is pizza and I really like the beach in summer, day ${k}.`);
    assert.equal(canKeep(off, 'data'), false);
    // pressing "Ask mentor" again without changing anything is not a round
    const lazy = fresh(lang);
    write(lazy, lang, 'steps', text);
    for (let k = 0; k < 3; k++) { const r = reviewSection(lazy, spec, 'steps'); assert.equal(r.verdict, 'same'); assert.match(r.text, /hasn't changed/); }
    assert.equal(lazy.sections.steps.rounds, 1); assert.equal(canKeep(lazy, 'steps'), false);
    // rounds spent on "too short" / "unrelated" don't count toward a later real question
    const mixed = fresh(lang);
    write(mixed, lang, 'steps', 'idk'); write(mixed, lang, 'steps', 'I like pizza and the beach in the summer a lot, really.'); write(mixed, lang, 'steps', text);
    assert.equal(canKeep(mixed, 'steps'), false);
  });

  test(`${lang}: revisions — editing a clear section reopens it until it is reviewed again; undoing the edit restores it`, () => {
    const bp = fresh(lang), id = 'data';
    write(bp, lang, id, PLANS[lang][id]);
    assert.equal(bp.sections[id].status, 'accepted');
    setDraft(bp, id, PLANS[lang][id] + ' Also something else.');
    assert.equal(bp.sections[id].status, 'changed'); assert.equal(isDone(bp.sections[id]), false);
    setDraft(bp, id, PLANS[lang][id]); assert.equal(bp.sections[id].status, 'accepted');
    setDraft(bp, id, PLANS[lang][id] + ' Plus one more detail about it.');
    assert.equal(reviewSection(bp, spec, id).verdict, 'accepted'); assert.equal(bp.sections[id].revisions, 1);
    setDraft(bp, id, ''); assert.equal(bp.sections[id].status, 'empty');
  });

  test(`${lang}: the gate is in the engine — no runs and no START BUILDING before the plan is complete`, () => {
    const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids });
    assert.equal(beginSubmission(a), null);
    assert.equal(startBuilding(a.blueprint, spec), false);
    for (const id of ids.slice(0, 4)) write(a.blueprint, lang, id, PLANS[lang][id]);
    assert.equal(startBuilding(a.blueprint, spec), false); assert.equal(beginSubmission(a), null);
    write(a.blueprint, lang, 'steps', PLANS[lang].steps);
    assert.equal(startBuilding(a.blueprint, spec), true); assert.equal(mayBuild(a.blueprint), true);
    assert.ok(beginSubmission(a));
    assert.equal(setDraft(a.blueprint, 'data', 'changed after starting'), false); // the plan is fixed once building starts
    assert.equal(reviewSection(a.blueprint, spec, 'data'), null);
  });

  test(`${lang}: a forged or damaged save can't skip the Blueprint`, () => {
    const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids });
    write(a.blueprint, lang, 'features', PLANS[lang].features);
    const raw = JSON.parse(JSON.stringify(toSave(a)));
    raw.blueprint.started = true; // claims building started with one section done
    raw.blueprint.sections.data = { draft: 'x', accepted: 'something else', status: 'accepted', doneAs: 'accepted' };
    const b = fromSave(raw, { lang, vault: 6, curriculum: lang + '-2', challenges: 1, workspace: 4, blueprint: ids });
    assert.equal(b.blueprint.started, false); assert.equal(b.blueprint.sections.data.status, 'changed');
    assert.equal(beginSubmission(b), null);
    assert.deepEqual(cleanBlueprint('junk', ids), newBlueprint(ids));
    assert.deepEqual(cleanBlueprint({ sections: { features: 5 }, current: 99, chat: 'x' }, ids).current, 0);
  });

  test(`${lang}: drafts, answers, questions, current section and the conversation survive a refresh`, () => {
    const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids });
    write(a.blueprint, lang, 'features', PLANS[lang].features);
    write(a.blueprint, lang, 'steps', lang === 'js' ? 'First I show the tasks, then Add, then marking done, and finally the counter at the end.' : 'First I write the comparison and test it, then the loop and test it again with some numbers.');
    answerSection(a.blueprint, specOf(lang), 'steps', 'not sure');
    setDraft(a.blueprint, 'data', 'half-written dra');
    a.blueprint.current = 2;
    logBp(a.blueprint, { w: 'u', text: 'hello', section: 'steps' }); logBp(a.blueprint, { w: 'm', text: 'Hi?', label: 'BLUEPRINT', kind: 'hint', section: 'steps' });
    const b = fromSave(JSON.parse(JSON.stringify(toSave(a))), { lang, vault: 6, curriculum: lang + '-2', challenges: 1, workspace: 4, blueprint: ids });
    assert.deepEqual(b.blueprint, a.blueprint);
  });

  test(`${lang}: the conversation keeps the last ${MAX_CHAT} messages`, () => {
    const bp = fresh(lang);
    for (let k = 0; k < 80; k++) logBp(bp, { w: 'm', text: 'm' + k });
    assert.equal(bp.chat.length, MAX_CHAT); assert.equal(bp.chat.at(-1).text, 'm79');
  });

  test(`${lang}: JavaScript and Python plans are independent`, () => {
    assert.notEqual(attemptKey(lang + '-2', 6), attemptKey(other + '-2', 6));
    const mine = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids });
    for (const id of ids) write(mine.blueprint, lang, id, PLANS[lang][id]);
    startBuilding(mine.blueprint, spec);
    const raw = JSON.parse(JSON.stringify(toSave(mine)));
    assert.equal(fromSave(raw, { lang: other, vault: 6, curriculum: other + '-2', challenges: 1, workspace: 4, blueprint: idsOf(other) }), null);
    // the other language's own plan text isn't accepted as this one
    const cross = fresh(lang);
    assert.notEqual(write(cross, lang, 'data', PLANS[other].data).verdict, 'accepted');
  });

  test(`${lang}: a project shipped before Blueprints is waived (not started), so its workspace opens`, () => {
    const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids });
    waive(a.blueprint);
    assert.equal(a.blueprint.started, false); assert.equal(mayBuild(a.blueprint), true); assert.ok(beginSubmission(a));
    assert.equal(linkPlan(a.blueprint, spec, ['loop-timeout', 'add-replaces']), null); // no plan, nothing to quote
    assert.equal(planForReview(a.blueprint, spec), null);
  });
}

test('js: a failed check that contradicts the plan gets a question quoting the student\'s own sentence', () => {
  const bp = fresh('js');
  for (const id of idsOf('js')) write(bp, 'js', id, PLANS.js[id]);
  startBuilding(bp, specOf('js'));
  const l = linkPlan(bp, specOf('js'), ['add-replaces']);
  assert.equal(l.section, 'logic');
  assert.ok(PLANS.js.logic.includes(l.quote.replace(/…$/, '')), l.quote); // a real quote, never invented
  assert.match(l.question, /^Your Blueprint says: “.+” Does your Add code do that/);
  assert.ok(linkPlan(bp, specOf('js'), ['count-stale']).question.includes('When does your code actually write #count?'));
  assert.equal(linkPlan(bp, specOf('js'), ['nothing-related']), null);
});

test('py: a program that never stops is compared with the plan to stop at the right guess', () => {
  const bp = fresh('py');
  for (const id of idsOf('py')) write(bp, 'py', id, PLANS.py[id]);
  startBuilding(bp, specOf('py'));
  const l = linkPlan(bp, specOf('py'), ['loop-timeout']);
  assert.equal(l.section, 'logic'); assert.ok(PLANS.py.logic.includes(l.quote.replace(/…$/, '')));
  assert.match(l.question, /never stopped/);
});

test('quotes may come from the student\'s own answers to the mentor, never from anywhere else', () => {
  const bp = fresh('py'), spec = specOf('py');
  const text = 'I compare each guess with the secret to say if it is lower or higher and then I ask for the next guess in a loop again and again.';
  write(bp, 'py', 'logic', text); answerSection(bp, spec, 'logic', 'It stops as soon as the guess equals the secret.');
  for (const id of idsOf('py')) if (id !== 'logic') write(bp, 'py', id, PLANS.py[id]);
  assert.ok(startBuilding(bp, spec));
  assert.equal(linkPlan(bp, spec, ['loop-timeout']).quote, 'It stops as soon as the guess equals the secret.');
});

test('without a matching sentence there is no quote — the question points to the section instead', () => {
  const bp = fresh('js');
  for (const id of idsOf('js')) write(bp, 'js', id, ALTERNATIVES.js[1][id]);
  startBuilding(bp, specOf('js'));
  assert.equal(planQuote(bp, 'logic', /\bnever-mentioned-word\b/), null);
  const spec = { ...specOf('js'), links: [{ tags: ['x'], section: 'logic', mentions: /\bzebra\b/, ask: q => `“${q}”`, askNoQuote: 'Open MY BLUEPRINT → Logic?' }] };
  assert.deepEqual(linkPlan(bp, spec, ['x']), { section: 'logic', title: 'Logic', quote: null, question: 'Open MY BLUEPRINT → Logic?' });
});

test('Blueprint texts stay in their language: no JavaScript in the Python Blueprint and the other way round', () => {
  const FOREIGN = { py: /console\.log|===|\bconst |\blet |=>|\bnull\b|\bundefined\b|\.push\(|\.length\b|\barray\b|innerHTML|\bDOM\b/i, js: /\bprint\(|\bdef\b|\belif\b|\bNone\b|\bTrue\b|\bFalse\b|\.append\(|\binput\(\)|\bterminal\b/ };
  for (const lang of ['js', 'py']) {
    const s = specOf(lang);
    const texts = [s.brief, ...s.sections.flatMap(x => [x.purpose, x.question, x.accept, ...x.rules.flatMap(r => [r.question, r.retry, r.ack])]), ...s.links.map(l => l.askNoQuote + l.ask('…'))];
    for (const t of texts) assert.ok(!FOREIGN[lang].test(t), `${lang}: ${t}`);
  }
});
