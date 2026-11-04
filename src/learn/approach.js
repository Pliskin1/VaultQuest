// Explain-first: reviews a student's plan before the Mini Boss's code unlocks — one engine for every language.
// A plan is accepted only when, in the student's own words (plan + answers to follow-up questions), it covers:
// looking at every task, checking whether each is done, counting only the finished ones, giving the number back
// (not just printing it), and what happens with an empty list. One Socratic question at a time, never the code.
// Deliberately tolerant of wording; deliberately strict about substance: too-short text, unrelated text and
// keyword lists without sentences are not plans.
export const MIN_WORDS = 8, MAX_CHARS = 800, MAX_ANSWERS = 12;

const words = s => (s.match(/[\p{L}\p{N}_']+/gu) || []);
// Small words real sentences contain and keyword lists don't.
const GLUE = new Set(['the', 'a', 'an', 'and', 'then', 'if', 'it', 'its', "it's", 'each', 'every', 'of', 'to', 'i', "i'll", 'we', 'will', 'that', 'which', 'when', 'with', 'is', 'are', 'in', 'for', 'from', 'at', 'by', 'how', 'many', 'so', 'my', 'them', 'they', 'one', 'all', 'only', 'should', 'would', 'go', 'look', 'check']);
const NEGATED = /\b(not|isn'?t|aren'?t|wasn'?t)\s+(yet\s+)?(done|finished|complete[d]?)\b|\b(unfinished|incomplete|not\s+yet|remaining|still\s+open)\b|\bleft\s+to\s+do\b/gi;
const FINISHED = /\b(done|finished|complete[sd]?|true|ticked)\b/i;
const RETURNS = /\b(return\w*|give[sn]?\s+(it\s+|that\s+|them\s+|this\s+|the\s+\w+\s+)?back|gives?\s+back|hand(s|ed)?\s+(it\s+|that\s+|the\s+\w+\s+)?back|send(s)?\s+(it\s+|that\s+)?back|output)\b/i;

// t: { list: 'list' | 'array', done: how the done flag is written, fn: the function's name }
export function approachRules(t) {
  return [
    { id: 'iterate', covered: s => /\b(each|every|all\s+(of\s+)?the\s+tasks|all\s+tasks|loop\w*|go(es|ing)?\s+(over|through)|look(s|ing)?\s+(at|through|over)|iterat\w*|walk\w*\s+(through|over)|visit\w*|one\s+(by|at\s+a\s+time)|filter\w*|reduce|sum\w*|comprehension|for\s+(each|every|all))\b/i.test(s),
      question: `How will you look at the tasks — just one of them, or every task in the ${t.list}?` },
    { id: 'status', covered: s => FINISHED.test(s) || /\bstatus\b/i.test(s),
      question: `How will your function know whether one particular task is finished? What will it look at?` },
    { id: 'only-done', covered: s => !new RegExp(NEGATED.source, 'i').test(s) || FINISHED.test(s.replace(NEGATED, ' ')),
      question: 'The Mini Boss asks how many tasks are **done**. Which tasks will you count — the finished ones, or the unfinished ones?' },
    { id: 'count', covered: s => /\b(count\w*|tally|add(s|ing)?\s+(one|1)|\+\s*1|\+\+|\+=\s*1|increase\w*|increment\w*|how\s+many|number\s+of|total|length|len|sum\w*|plus\s+one|add\s+up)\b/i.test(s),
      question: 'Once you have found a finished task, what happens to your total?' },
    { id: 'print', covered: s => !/\b(print\w*|console\.log|log(s|ged)?\s+it|show(s)?\s+it|display\w*)\b/i.test(s) || RETURNS.test(s),
      question: `Will you **print** the number, or give it back to whoever called \`${t.fn}\`? What's the difference?` },
    { id: 'result', covered: s => RETURNS.test(s),
      question: 'When your function has finished counting, what does it do with the number?' },
    { id: 'empty', covered: s => /\b(0|zero|empty|no\s+tasks|nothing\s+to\s+count|none)\b/i.test(s) || /\bstart\w*\s+(at|from|with)\s+(0|zero)\b/i.test(s),
      question: `What should it give back for an empty ${t.list} — does your plan already handle that?` }
  ];
}

const SHORT = 'Tell me a bit more, in your own words: what will your function go through, what will it check, and what will it give back?';
export const ACCEPTED = 'That’s a complete plan: look at every task, check whether it’s done, count only those, and give the number back — zero when there are no tasks. **Coding is unlocked.** Now write it.';

// plan: { text, answers } · rules: approachRules(...) · last: the rule asked last time (or null)
// → { accepted, rule, question, progressed } — `progressed`: the last question has now been answered.
export function reviewApproach({ text = '', answers = [] }, rules, last = null) {
  const own = String(text).trim(), all = [own, ...answers].join('\n'), w = words(own);
  const glue = words(all).filter(x => GLUE.has(x.toLowerCase())).length;
  const relevant = rules.some(r => r.id !== 'print' && r.id !== 'only-done' && r.covered(all));
  if (w.length < MIN_WORDS || glue < 2 || !relevant) return { accepted: false, rule: 'short', question: SHORT, progressed: false };
  const open = rules.find(r => !r.covered(all));
  const progressed = !!last && last !== 'short' && (!open || open.id !== last);
  if (!open) return { accepted: true, rule: null, question: ACCEPTED, progressed };
  return { accepted: false, rule: open.id, question: (progressed ? 'Thanks — that helps. ' : '') + open.question, progressed };
}
