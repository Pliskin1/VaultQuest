// Language content for the shared engine: mistake metadata covers every live challenge, every tag it can
// produce has a Recovery question in that language's bank, and the questions are written in that language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS } from '../src/content/languages.js';
import { MISTAKES, ERRORS } from '../src/content/mistakes.js';
import { RECOVERY_BANKS } from '../src/content/recovery.js';

// Markers of the *other* language. Wrong options may use them on purpose (e.g. && in a Python question,
// to show it isn't Python), so prompts, code and correct answers are checked — not distractors.
const FOREIGN = {
  py: /console\.log|===|!==|\blet |\bconst |&&|\|\||\bfunction\s*\w*\s*\(|=>|;\s*$|\{|\}|\btypeof\b/m,
  js: /\bprint\(|\bdef\b|\belif\b|:\s*$|\bNone\b|\bTrue\b|\bFalse\b|\.append\(|\brange\(|^\s*#/m
};

for (const lang of ['py', 'js']) {
  const L = LANGS[lang], cur = L.curriculum, bank = RECOVERY_BANKS[cur];

  test(`${lang}: the live curriculum has a Recovery bank in the same language`, () => {
    assert.ok(bank, cur); assert.equal(bank.lang, lang);
  });

  test(`${lang}: every challenge of every vault has mistake metadata that fits it`, () => {
    L.levels.forEach((lv, v) => (lv.ch || []).forEach((c, ci) => {
      const m = MISTAKES[cur][`${v}:${ci}`];
      assert.ok(m?.tag, `${cur} ${v}:${ci} has no concept tag`);
      for (const k of Object.keys(m.answers ?? {})) {
        if (c.t === 'mcq') assert.ok(c.opts[+k] && !c.opts[+k][1], `${cur} ${v}:${ci}: option ${k} must be a wrong option`);
        else assert.ok(!c.ans.includes(k), `${cur} ${v}:${ci}: "${k}" is an accepted answer`);
      }
    }));
    for (const key of Object.keys(MISTAKES[cur])) { const [v, ci] = key.split(':').map(Number); assert.ok(L.levels[v]?.ch?.[ci], `${cur} ${key} isn't a challenge`); }
  });

  test(`${lang}: every mistake the adapter can report has a Recovery question in its own bank`, () => {
    const tags = new Set([...Object.values(MISTAKES[cur]).flatMap(m => [m.tag, ...Object.values(m.answers ?? {})]), ...ERRORS[lang].map(([, t]) => t)]);
    for (const t of tags) assert.ok(bank.questions.some(q => q.tags.includes(t)), `${cur}: no question for "${t}"`);
  });

  test(`${lang}: every vault has at least one refresher question`, () => {
    L.levels.forEach((lv, v) => { if (lv.ch) assert.ok(bank.questions.some(q => q.vault === v), `${cur} vault ${v}`); });
  });

  test(`${lang}: Recovery questions are written in ${L.name}, not the other language`, () => {
    for (const q of bank.questions) {
      const own = [q.prompt, q.code, q.type === 'mcq' ? q.options[q.answer] : q.answers[0]].join('\n');
      assert.ok(!FOREIGN[lang].test(own), `${q.id}: ${own.match(FOREIGN[lang])?.[0]}`);
      assert.ok(q.id.startsWith(lang + '-'), q.id);
    }
  });
}
