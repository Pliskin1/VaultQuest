// Syntax Recovery question selection — one algorithm for every language; the bank (content/recovery.js)
// is chosen by curriculum. Prefers the student's own mistakes: each failed attempt's main mistake (its
// first tag) ranks ahead of side effects; within each group tags rank by frequency, earliest first on ties.
// Each tag maps to its first unused question. If the mistakes don't fill three questions, the rest are
// refreshers on this vault's concept, then earlier vaults (latest first), then the bank's general order.
import { RECOVERY_BANKS } from '../content/recovery.js';

export const RECOVERY_SIZE = 3;
export const getBank = id => RECOVERY_BANKS[id] ?? null;
export const getQuestion = (bankId, id) => getBank(bankId)?.questions.find(q => q.id === id) ?? null;

function rankTags(attempts) {
  const rank = tagsOf => {
    const counts = new Map();
    for (const a of attempts) { if (a.passed) continue; for (const t of tagsOf(a)) counts.set(t, (counts.get(t) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  };
  const primary = rank(a => (a.tags?.length ? [a.tags[0]] : []));
  return [...primary, ...rank(a => a.tags?.slice(1) ?? []).filter(t => !primary.includes(t))];
}

// → { questionIds, targeted }: targeted = the ids chosen because of the student's own mistakes.
export function pickRecovery(attempts, bankId, vault = 0) {
  const bank = getBank(bankId);
  if (!bank) return { questionIds: [], targeted: [] };
  const qs = bank.questions, chosen = [];
  for (const tag of rankTags(attempts)) {
    const q = qs.find(q => q.tags.includes(tag) && !chosen.includes(q.id));
    if (q) chosen.push(q.id);
    if (chosen.length === RECOVERY_SIZE) break;
  }
  const targeted = [...chosen];
  const refreshers = [
    ...qs.filter(q => q.vault === vault),
    ...qs.filter(q => q.vault < vault).sort((a, b) => b.vault - a.vault),
    ...(bank.general ?? []).map(id => qs.find(q => q.id === id)).filter(Boolean),
    ...qs
  ];
  for (const q of refreshers) { if (chosen.length === RECOVERY_SIZE) break; if (!chosen.includes(q.id)) chosen.push(q.id); }
  return { questionIds: chosen, targeted };
}

export const selectRecoveryQuestions = (attempts, bankId, vault) => pickRecovery(attempts, bankId, vault).questionIds;

// mcq: option index · fill: exact match after trimming.
export function checkRecoveryAnswer(q, answer) {
  if (q.type === 'mcq') return answer === q.answer;
  return q.answers.includes(String(answer ?? '').trim());
}
