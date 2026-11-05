// Turns a failed submission into mistake tags with evidence — one function for every language. Tags are only
// added with evidence, most specific first: what the judged behaviour showed (the challenge's own mistake
// rules, learn/judge.js), the wrong answer itself (an option's tag, a known wrong blank), a real runtime error
// (content/mistakes.js), and finally the concept the challenge tests (`challenge.tag`).
import { ERRORS } from '../content/mistakes.js';

const lastLine = s => String(s ?? '').split('\n').map(l => l.trim()).filter(Boolean).pop()?.slice(0, 160) || null;

// challenge: the content object · type: 'mcq' (answer = option index) | 'blank' (answer = text) | 'code'
// found: tags already found by judging behaviour.
export function diagnose({ lang, challenge, type, answer, error, found = [] }) {
  const tags = [...found];
  const known = type === 'mcq' ? challenge?.opts?.[answer]?.[3] : type === 'blank' ? challenge?.answerTags?.[String(answer ?? '').trim()] : null;
  if (known) tags.push(known);
  if (error) { const hit = (ERRORS[lang] ?? []).find(([re]) => re.test(error)); if (hit) tags.push(hit[1]); }
  if (challenge?.tag) tags.push(challenge.tag);
  return {
    tags: [...new Set(tags)],
    evidence: { type, ...(type === 'code' ? {} : { answer: String(answer ?? '').slice(0, 80) }), ...(error ? { error: lastLine(error) } : {}) }
  };
}
