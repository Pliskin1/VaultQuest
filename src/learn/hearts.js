// The three-heart rule (JavaScript sessions only for now). Pure functions over plain objects.
// - A passing submission never costs a heart.
// - A failing one costs a heart only if this exact submission (by fingerprint) hasn't failed before.
// - At zero hearts the session locks; code and progress are kept elsewhere.
export const MAX_HEARTS = 3;

export function applySubmission(state, { fingerprint, passed }) {
  const failed = state.failedFingerprints ?? [];
  if (passed) return { ...state, failedFingerprints: failed, heartLost: false, duplicate: false };
  if (failed.includes(fingerprint)) return { ...state, failedFingerprints: failed, heartLost: false, duplicate: true };
  const hearts = Math.max(0, state.hearts - 1);
  return { ...state, hearts, failedFingerprints: [...failed, fingerprint], locked: hearts === 0, heartLost: true, duplicate: false };
}

// Syntax Recovery: a correct answer restores one heart; a wrong one costs nothing. Unlocks at full hearts.
export function applyRecoveryAnswer(state, correct) {
  if (!correct) return { ...state, restored: false };
  const hearts = Math.min(MAX_HEARTS, state.hearts + 1);
  return { ...state, hearts, restored: true, locked: hearts < MAX_HEARTS ? state.locked : false };
}
