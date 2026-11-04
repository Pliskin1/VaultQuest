// One attempt at a vault — the same rules for every language. Language-specific code only judges an
// answer (pass/fail + mistake tags); this decides what it costs, runs Syntax Recovery and saves/restores
// the attempt. Pure apart from the attempt object it's given.
//
// Async safety: every submission gets a token. A judgement, mentor reply or transition that resolves after
// the attempt ended (vault left, cracked or replaced by a restored copy) or belongs to an older attempt is
// ignored.
//
// Lifecycle: active ──3 new wrong answers──▶ locked ──startRecovery──▶ recovering (3 questions; each correct
// answer restores one heart, wrong ones cost nothing) ──finishRecovery──▶ active again, same challenge,
// same answers and history (answers that already failed stay free).
import { fingerprint } from './fingerprint.js';
import { newSession, recordSubmission, beginRecovery, answerRecovery, finishRecovery as unlock } from './session.js';
import { getQuestion, RECOVERY_SIZE } from './recovery.js';
import { MAX_HEARTS } from './hearts.js';
import { newRun } from './progress.js';
import { reviewApproach, MAX_CHARS, MAX_ANSWERS } from './approach.js';
import { newBlueprint, cleanBlueprint, mayBuild } from './blueprint.js';

let seq = 0;
// What the vault screen needs to resume exactly where the student was.
export const newView = () => ({ ci: 0, combo: 0, mistakes: 0, hints: 0, chMistake: false, hintIdx: 0, drafts: {} });
// Explain-first plan (Mini Boss): the student's text and follow-up answers, whether the mentor accepted it,
// how often it was reviewed, the question asked last, and whether coding has started.
export const newApproach = () => ({ text: '', answers: [], accepted: false, reviews: 0, last: null, started: false });
// PRO Workspace (learn/workspace.js), per milestone: cleared once passed, best number of checks passed, free
// hints used. Plus the last run's check results/error/output, the mentor conversation, and the fingerprint of
// code that passed everything (SUBMIT needs exactly that code).
export const newWorkspace = ms => ({ cleared: Array(ms).fill(false), best: Array(ms).fill(0), hints: Array(ms).fill(0), runs: 0, results: [], error: null, timeout: false, output: '', chat: [], lastKey: null, passKey: null, shipped: false });
// run: rewards paid in this attempt (bookkeeping; XP is never taken back).
// opts.approach: this vault must be explained before any code can be submitted.
// opts.workspace: number of milestones — this attempt is a PRO project.
// opts.blueprint: the project's Blueprint section ids — nothing can be run before the plan is complete.
export const newAttempt = (lang, vault, curriculum = lang + '-1', opts = {}) => ({ id: ++seq, lang, vault, curriculum, session: newSession(), run: newRun(), view: newView(), busy: false, over: false, exhausted: false, ...(opts.approach ? { approach: newApproach() } : {}), ...(opts.workspace ? { workspace: newWorkspace(opts.workspace) } : {}), ...(opts.blueprint ? { blueprint: newBlueprint(opts.blueprint) } : {}) });
// Where an attempt is saved in the profile: one per curriculum and vault, so languages never mix.
export const attemptKey = (curriculum, vault) => `${curriculum}:${vault}`;

// Identity of an answer, namespaced so histories never mix across languages, vaults or challenges.
// mcq: option index · blank: text, trimmed with inner whitespace collapsed · code: fingerprint
// (trailing spaces and extra blank lines ignored; indentation, case and every other character count).
export function answerKey(a, challenge, type, value) {
  const v = type === 'mcq' ? 'opt:' + value
    : type === 'blank' ? 'txt:' + String(value ?? '').trim().replace(/\s+/g, ' ')
    : 'code:' + fingerprint(String(value ?? ''));
  return `${a.lang}:${a.vault}:${challenge}:${v}`;
}

export const isCurrent = (a, token) => !!(a && token && token.id === a.id && !a.over);

// Starts evaluating a submission → token, or null while one is being evaluated, the attempt is over/locked,
// its plan hasn't been accepted yet (explain-first is enforced here, not just in the UI), or a PRO project's
// Blueprint isn't complete.
export function beginSubmission(a) {
  if (!a || a.over || a.busy || a.session.locked || (a.approach && !a.approach.accepted) || (a.blueprint && !mayBuild(a.blueprint))) return null;
  a.busy = true;
  return { id: a.id };
}

// Applies the heart rules to a judged submission → outcome, or null if the token is stale or already used.
// `exhausted` is true for exactly one submission per lock: the one that took the last heart.
export function settleSubmission(a, token, { key, passed, tags = [], evidence = {} }) {
  if (!isCurrent(a, token) || token.settled) return null;
  token.settled = true; a.busy = false;
  const { session, outcome } = recordSubmission(a.session, { fingerprint: key, passed, tags, evidence });
  a.session = session;
  const exhausted = outcome.locked && !a.exhausted;
  if (exhausted) a.exhausted = true;
  return { ...outcome, exhausted };
}

// Releases a submission that couldn't be judged (nothing recorded).
export function cancelSubmission(a, token) { if (isCurrent(a, token) && !token.settled) { token.settled = true; a.busy = false; } }

// The attempt object is finished with — cracked, left, or replaced. Pending callbacks from it become stale.
export function endAttempt(a) { if (a) { a.over = true; a.busy = false; } }

// Zero hearts, run once by the submission that took the last heart. `announce` and `pause` are the UI's;
// `next` (open Syntax Recovery) runs only if that attempt is still the current one afterwards.
export async function whenExhausted(current, token, { announce, pause, next }) {
  if (!isCurrent(current(), token)) return false; // already left before the reply finished
  await announce();
  await pause();
  if (!isCurrent(current(), token)) return false;
  await next();
  return true;
}

// ── Syntax Recovery ──
export const inRecovery = a => !!a?.session.locked;
export const recoveryDone = a => !!a?.session.recovery && a.session.recovery.index >= RECOVERY_SIZE;
// The question to answer now, or null when all three are done.
export function currentQuestion(a) {
  const r = a?.session.recovery;
  return r && r.index < RECOVERY_SIZE ? getQuestion(r.bank, r.questionIds[r.index]) : null;
}

// Locks in three questions for this attempt's mistakes (from its curriculum's bank). Idempotent.
export function startRecovery(a) {
  if (!a || a.over || !a.session.locked) return null;
  a.session = beginRecovery(a.session, { bank: a.curriculum, vault: a.vault });
  return a.session.recovery;
}

// Answers the question with id `questionId` → { correct, question, complete, hearts } or null (stale
// attempt, not recovering, or the answer was meant for a question that's no longer current).
export function answerRecoveryQuestion(a, questionId, answer) {
  if (!a || a.over || !a.session.recovery) return null;
  const { session, result } = answerRecovery(a.session, answer, questionId);
  if (!result) return null;
  a.session = session;
  return { ...result, hearts: session.hearts };
}

// All three answered: back to the same challenge with full hearts. Earlier wrong answers stay free.
export function finishRecovery(a) {
  if (!a || a.over) return false;
  const { session, ok } = unlock(a.session);
  if (!ok) return false;
  a.session = session; a.exhausted = false; // the next lock reports zero hearts again
  return true;
}

// ── Explain first (Mini Boss) ──
// Reviews the plan text (+ earlier answers) → review result (learn/approach.js), or null if not applicable.
export function explainApproach(a, text, rules) {
  if (!a?.approach || a.over || a.approach.accepted) return null;
  a.approach.text = String(text ?? '').slice(0, MAX_CHARS);
  return review(a, rules);
}
// A chat answer to the mentor's follow-up question counts toward the plan.
export function answerApproach(a, answer, rules) {
  if (!a?.approach || a.over || a.approach.accepted) return null;
  a.approach.answers = [...a.approach.answers, String(answer ?? '').slice(0, 300)].slice(-MAX_ANSWERS);
  return review(a, rules);
}
function review(a, rules) {
  const r = reviewApproach(a.approach, rules, a.approach.last);
  a.approach = { ...a.approach, reviews: a.approach.reviews + 1, last: r.rule, accepted: r.accepted };
  return r;
}
// Coding starts only once the plan is accepted.
export function startCoding(a) {
  if (!a?.approach?.accepted || a.over) return false;
  a.approach = { ...a.approach, started: true };
  return true;
}
export const inPlanning = a => !!a?.approach && !a.approach.started;

// ── Saving and restoring (inside the profile save) ──
export const toSave = a => ({ lang: a.lang, vault: a.vault, curriculum: a.curriculum, session: a.session, run: a.run, view: a.view, ...(a.approach ? { approach: a.approach } : {}), ...(a.workspace ? { workspace: a.workspace } : {}), ...(a.blueprint ? { blueprint: a.blueprint } : {}) });

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

function cleanRecovery(r, curriculum) {
  if (!isObj(r) || r.bank !== curriculum || !Array.isArray(r.questionIds)) return null;
  const ids = strings(r.questionIds);
  if (ids.length !== RECOVERY_SIZE || new Set(ids).size !== RECOVERY_SIZE || !ids.every(id => getQuestion(curriculum, id))) return null;
  const index = int(r.index, 0, RECOVERY_SIZE, 0);
  return { bank: curriculum, questionIds: ids, targeted: strings(r.targeted).filter(id => ids.includes(id)), index, correctIds: ids.slice(0, index), wrong: int(r.wrong, 0, 1e6, 0) };
}

function cleanApproach(p) {
  if (!isObj(p)) return newApproach();
  const accepted = p.accepted === true;
  return { text: typeof p.text === 'string' ? p.text.slice(0, MAX_CHARS) : '', answers: strings(p.answers).map(x => x.slice(0, 300)).slice(-MAX_ANSWERS),
    accepted, reviews: int(p.reviews, 0, 1e6, 0), last: typeof p.last === 'string' ? p.last : null, started: accepted && p.started === true };
}

const bools = (v, n) => Array.from({ length: n }, (_, k) => Array.isArray(v) && v[k] === true);
const ints = (v, n, hi) => Array.from({ length: n }, (_, k) => int(Array.isArray(v) ? v[k] : 0, 0, hi, 0));
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
function cleanWorkspace(w, ms) {
  if (!isObj(w)) return newWorkspace(ms);
  const results = (Array.isArray(w.results) ? w.results : []).filter(isObj).slice(0, 40)
    .map(r => ({ id: str(r.id, 40), ms: int(r.ms, 0, ms - 1, 0), pass: r.pass === true, msg: str(r.msg, 300), ...(typeof r.exp === 'string' ? { exp: r.exp.slice(0, 120), act: str(r.act, 120) } : {}) })).filter(r => r.id);
  const chat = (Array.isArray(w.chat) ? w.chat : []).filter(c => isObj(c) && typeof c.text === 'string').slice(-40)
    .map(c => ({ w: c.w === 'u' ? 'u' : 'm', text: c.text.slice(0, 1500), ...(typeof c.label === 'string' ? { label: c.label.slice(0, 40) } : {}), ...(typeof c.kind === 'string' ? { kind: c.kind.slice(0, 10) } : {}) }));
  const e = isObj(w.error) ? { name: str(w.error.name, 40) || 'Error', message: str(w.error.message, 300), line: int(w.error.line, 1, 1e6, null), kind: w.error.kind === 'syntax' ? 'syntax' : 'runtime' } : null;
  return { cleared: bools(w.cleared, ms), best: ints(w.best, ms, 100), hints: ints(w.hints, ms, 3), runs: int(w.runs, 0, 1e6, 0), results, error: e, timeout: w.timeout === true,
    output: str(w.output, 4000), chat, lastKey: typeof w.lastKey === 'string' ? w.lastKey : null, passKey: typeof w.passKey === 'string' ? w.passKey : null, shipped: w.shipped === true };
}

// Restores a saved attempt for exactly this language, curriculum and vault → attempt, or null (nothing
// usable saved). Damaged fields are repaired conservatively: a locked attempt stays locked, hearts never
// exceed what was earned back, a recovery that can't be read is picked again from the same mistakes, and
// coding never counts as started without an accepted plan.
// approach: this vault is explain-first (a missing or damaged plan starts again from an empty one).
// workspace: number of milestones of a PRO project (damaged project state starts again, code drafts kept).
// blueprint: the project's Blueprint section ids (a damaged plan can't count as complete).
export function fromSave(raw, { lang, vault, curriculum, challenges, approach = false, workspace = 0, blueprint = null }) {
  if (!isObj(raw) || raw.lang !== lang || raw.vault !== vault || raw.curriculum !== curriculum) return null;
  const s = isObj(raw.session) ? raw.session : {}, v = isObj(raw.view) ? raw.view : {};
  let hearts = int(s.hearts, 0, MAX_HEARTS, s.locked === true ? 0 : MAX_HEARTS);
  const locked = s.locked === true || hearts === 0;
  const recovery = locked ? cleanRecovery(s.recovery, curriculum) : null;
  if (locked) hearts = recovery ? recovery.index : 0; // hearts in recovery = questions answered correctly
  const attempts = (Array.isArray(s.attempts) ? s.attempts : []).filter(isObj).map(x => ({
    fingerprint: String(x.fingerprint ?? ''), passed: x.passed === true, tags: strings(x.tags), evidence: isObj(x.evidence) ? x.evidence : {}, failedIds: strings(x.failedIds), ts: Number(x.ts) || 0
  }));
  const drafts = isObj(v.drafts) ? Object.fromEntries(Object.entries(v.drafts).filter(([k, d]) => /^\d+$/.test(k) && typeof d === 'string').map(([k, d]) => [k, d.slice(0, 20000)])) : {};
  const paid = (Array.isArray(raw.run?.paid) ? raw.run.paid : []).filter(p => Array.isArray(p) && typeof p[0] === 'string' && Number.isFinite(p[1]));
  return {
    id: ++seq, lang, vault, curriculum, busy: false, over: false, exhausted: locked,
    session: { hearts, locked, failedFingerprints: strings(s.failedFingerprints), attempts, recovery },
    run: { paid },
    ...(approach ? { approach: cleanApproach(raw.approach) } : {}),
    ...(workspace ? { workspace: cleanWorkspace(raw.workspace, workspace) } : {}),
    ...(blueprint ? { blueprint: cleanBlueprint(raw.blueprint, blueprint) } : {}),
    view: { ci: int(v.ci, 0, challenges, 0), combo: int(v.combo, 0, 1e6, 0), mistakes: int(v.mistakes, 0, 1e6, 0), hints: int(v.hints, 0, 1e6, 0), chMistake: v.chMistake === true, hintIdx: int(v.hintIdx, 0, 3, 0), drafts }
  };
}
