// Syntax Recovery question selection. Prefers the student's own mistakes: each failed attempt's main
// mistake (its first tag) ranks ahead of side effects; within each group tags rank by frequency,
// earliest first on ties. Each tag maps to its first unused question; the rest is filled in a fixed order.
import { RECOVERY_QUESTIONS, GENERAL_ORDER } from '../content/recovery.js';

export const RECOVERY_SIZE = 3;
const byId = Object.fromEntries(RECOVERY_QUESTIONS.map(q => [q.id, q]));
export const getQuestion = id => byId[id];

export function selectRecoveryQuestions(attempts) {
  const rank = tagsOf => {
    const counts = new Map();
    for (const a of attempts) { if (a.passed) continue; for (const t of tagsOf(a)) counts.set(t, (counts.get(t) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  };
  const primary = rank(a => (a.tags?.length ? [a.tags[0]] : []));
  const secondary = rank(a => a.tags?.slice(1) ?? []).filter(t => !primary.includes(t));

  const chosen = [];
  for (const tag of [...primary, ...secondary]) {
    const q = RECOVERY_QUESTIONS.find(q => q.tags.includes(tag) && !chosen.includes(q.id));
    if (q) chosen.push(q.id);
    if (chosen.length === RECOVERY_SIZE) return chosen;
  }
  for (const id of GENERAL_ORDER) {
    if (!chosen.includes(id)) chosen.push(id);
    if (chosen.length === RECOVERY_SIZE) break;
  }
  return chosen;
}

// mcq: option index · fill: exact match after trimming.
export function checkRecoveryAnswer(q, answer) {
  if (q.type === 'mcq') return answer === q.answer;
  return q.answers.includes(String(answer ?? '').trim());
}
