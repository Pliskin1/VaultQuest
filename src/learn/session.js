// One challenge session (a JS vault, the Mini Boss or a JS Pro project): three hearts, the attempts
// that cost them, and Syntax Recovery progress. Pure functions — callers decide where a session lives.
import { applySubmission, applyRecoveryAnswer, MAX_HEARTS } from './hearts.js';
import { pickRecovery, getQuestion, checkRecoveryAnswer, RECOVERY_SIZE } from './recovery.js';

// attempts: one entry per distinct submission { fingerprint, passed, tags, evidence, failedIds, ts }
export const newSession = () => ({ hearts: MAX_HEARTS, locked: false, failedFingerprints: [], attempts: [], recovery: null });

// Applies the heart rules to one submission → { session, outcome }. Repeats aren't recorded twice.
export function recordSubmission(session, { fingerprint, passed, tags = [], evidence = {}, failedIds = [] }, now = Date.now()) {
  const next = applySubmission({ hearts: session.hearts, failedFingerprints: session.failedFingerprints, locked: session.locked }, { fingerprint, passed });
  const isRepeat = session.attempts.some(a => a.fingerprint === fingerprint);
  const locked = Boolean(next.locked);
  return {
    session: { ...session, hearts: next.hearts, locked, failedFingerprints: next.failedFingerprints,
      attempts: isRepeat ? session.attempts : [...session.attempts, { fingerprint, passed, tags, evidence, failedIds, ts: now }] },
    outcome: { heartLost: next.heartLost, duplicate: next.duplicate, hearts: next.hearts, locked }
  };
}

// bank: the curriculum's question bank id (e.g. 'py-1'); vault: for refreshers when mistakes are unclear.
export function beginRecovery(session, { bank, vault = 0 }) {
  if (!session.locked || session.recovery) return session;
  const { questionIds, targeted } = pickRecovery(session.attempts, bank, vault);
  return { ...session, recovery: { bank, questionIds, targeted, index: 0, correctIds: [], wrong: 0 } };
}

// Answers the current recovery question → { session, result }. Wrong answers never cost anything.
// With `questionId`, an answer meant for another question (a double-click landing after the next one
// appeared) is ignored.
export function answerRecovery(session, answer, questionId = null) {
  const r = session.recovery;
  if (!r || r.index >= RECOVERY_SIZE) return { session, result: null };
  if (questionId !== null && questionId !== r.questionIds[r.index]) return { session, result: null };
  const question = getQuestion(r.bank, r.questionIds[r.index]);
  const correct = checkRecoveryAnswer(question, answer);
  const next = applyRecoveryAnswer({ hearts: session.hearts, locked: session.locked }, correct);
  return {
    session: { ...session, hearts: next.hearts,
      recovery: correct ? { ...r, index: r.index + 1, correctIds: [...r.correctIds, question.id] } : { ...r, wrong: r.wrong + 1 } },
    result: { correct, question, complete: correct && next.hearts === MAX_HEARTS }
  };
}

// Unlocks the same challenge once all hearts are back. Fingerprints are kept, so old wrong code stays free.
export function finishRecovery(session) {
  if (session.hearts < MAX_HEARTS) return { session, ok: false };
  return { session: { ...session, locked: false, recovery: null }, ok: true };
}
