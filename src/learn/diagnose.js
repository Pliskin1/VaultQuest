// Turns a failed submission into mistake tags with evidence — one function for every language; the
// language-specific knowledge lives in content/mistakes.js. Tags are only added with evidence: the wrong
// answer itself, a real runtime error, or the concept the failed challenge tests. Most specific first.
import { MISTAKES, ERRORS } from '../content/mistakes.js';

const firstLine = s => String(s ?? '').split('\n').map(l => l.trim()).filter(Boolean).pop()?.slice(0, 160) || null;

// type: 'mcq' (answer = option index) | 'blank' (answer = text) | 'code' (answer = code, error = stderr)
export function diagnose({ curriculum, lang, vault, challenge, type, answer, error }) {
  const entry = MISTAKES[curriculum]?.[`${vault}:${challenge}`], tags = [];
  const known = entry?.answers?.[type === 'mcq' ? answer : String(answer ?? '').trim()];
  if (known) tags.push(known);
  if (error) { const hit = (ERRORS[lang] ?? []).find(([re]) => re.test(error)); if (hit) tags.push(hit[1]); }
  if (entry?.tag) tags.push(entry.tag);
  return {
    tags: [...new Set(tags)],
    evidence: { type, ...(type === 'code' ? {} : { answer: String(answer ?? '').slice(0, 80) }), ...(error ? { error: firstLine(error) } : {}) }
  };
}
