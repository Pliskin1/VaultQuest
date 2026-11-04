// Language content for the shared engine: every mistake a live challenge can report has a Recovery question
// in that language's bank, every vault has refreshers, and nothing shows the other language's syntax.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS } from '../src/content/languages.js';
import { ERRORS } from '../src/content/mistakes.js';
import { RECOVERY_BANKS } from '../src/content/recovery.js';

// Markers of the *other* language. Wrong options may use them on purpose (e.g. `push` in a Python question,
// to show it isn't Python), so prompts, code, hints, feedback and correct answers are checked — not distractors.
const FOREIGN = {
  py: /console\.log|===|!==|\blet |\bconst |&&|\|\||\bfunction\s*\w*\s*\(|=>|;\s*$|\btypeof\b|\bundefined\b|\btrue\b|\bfalse\b|\bnull\b|\.push\(|\.length\b/m,
  js: /\bprint\(|\bdef\b|\belif\b|:\s*$|\bNone\b|\bTrue\b|\bFalse\b|\.append\(|\brange\(|^\s*#\s|\blen\(/m
};
const challengeTags = c => [c.tag, ...(c.opts ?? []).map(o => o[3]), ...Object.values(c.answerTags ?? {}), ...(c.mistakes ?? []).map(m => m.tag)].filter(Boolean);
// Everything a student sees for a FREE challenge (wrong options excluded).
const shown = c => [c.q, c.code, ...(c.approach ? [c.approach.prompt, c.approach.sample, ...c.approach.rules.map(r => r.question)] : []), ...(c.hints ?? []), ...(c.mistakes ?? []).map(m => m.why), ...(c.opts ?? []).filter(o => o[1]).map(o => o[0]), ...(c.opts ?? []).filter(o => !o[1]).map(o => o[2])].join('\n');

for (const lang of ['py', 'js']) {
  const L = LANGS[lang], cur = L.curriculum, bank = RECOVERY_BANKS[cur];
  const challenges = L.levels.flatMap((lv, v) => (lv.ch ?? []).map((c, k) => ({ c, where: `${cur} ${v}:${k}`, v })));

  test(`${lang}: the live curriculum has a Recovery bank in the same language`, () => {
    assert.ok(bank, cur); assert.equal(bank.lang, lang);
  });

  test(`${lang}: every challenge (World 1 and the Pro vault) names the concept it tests`, () => {
    for (const { c, where } of challenges) assert.ok(c.tag, where);
  });

  test(`${lang}: every mistake a challenge or the runtime can report has a Recovery question in its own bank`, () => {
    const tags = new Set([...challenges.flatMap(({ c }) => challengeTags(c)), ...ERRORS[lang].map(([, t]) => t)]);
    for (const t of tags) assert.ok(bank.questions.some(q => q.tags.includes(t)), `${cur}: no question for "${t}"`);
  });

  test(`${lang}: every vault with challenges has at least two refresher questions`, () => {
    L.levels.forEach((lv, v) => { if (lv.ch) assert.ok(bank.questions.filter(q => q.vault === v).length >= 2, `${cur} vault ${v}`); });
  });

  test(`${lang}: World 1 challenges are written in ${L.name} only — instructions, code, hints and feedback`, () => {
    for (const { c, where, v } of challenges) if (v < L.free) { const t = shown(c); assert.ok(!FOREIGN[lang].test(t), `${where}: ${t.match(FOREIGN[lang])?.[0]}`); }
    for (let v = 0; v < L.free; v++) assert.ok(!FOREIGN[lang].test(L.levels[v].concept), `${cur} vault ${v} concept`);
  });

  test(`${lang}: Recovery questions are written in ${L.name}, not the other language`, () => {
    const other = RECOVERY_BANKS[lang === 'py' ? LANGS.js.curriculum : LANGS.py.curriculum];
    for (const q of bank.questions) {
      const own = [q.prompt, q.code, q.hint, q.explain, q.type === 'mcq' ? q.options[q.answer] : q.answers[0]].join('\n');
      assert.ok(!FOREIGN[lang].test(own), `${q.id}: ${own.match(FOREIGN[lang])?.[0]}`);
      assert.ok(!other.questions.some(o => o.id === q.id), `${q.id} is in both banks`);
    }
  });
}
