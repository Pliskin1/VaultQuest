// Shipping a PRO project and the portfolio built from it — one set of rules for every language.
// A project is shipped only from a fresh verification run of the exact code being submitted: every one of
// the project's checks must run and pass, with no error and no timeout (verifyForShip). The portfolio record
// keeps what was really verified — check and milestone counts, hearts, runs, the shipped code (and the
// program's output for terminal projects) and the real ship time. A review score is kept only when it came
// from the AI reviewer; nothing is invented. Re-shipping replaces the record of the same project, language
// and curriculum, so there is never a duplicate. Older portfolio entries are kept untouched and shown as
// what they are: shipped in an earlier version, without a verification record.
import { projectCurriculum, isEarlierVersion } from './progress.js';
import { fingerprint } from './fingerprint.js';
import { MAX_CODE } from './workspace.js';

export { MAX_CODE };
export const MAX_OUTPUT = 2000;

// run: an adapter result (run/project-js.js / run/project-py.js) for the code being shipped.
export function verifyForShip(lv, run) {
  const total = lv.checks.length;
  if (!run || run.cancelled || run.unavailable || run.unsafe) return { ok: false, reason: 'not-run', passed: 0, total, failed: [] };
  const byId = new Map((run.checks ?? []).map(c => [c.id, c]));
  const failed = lv.checks.filter(c => !byId.get(c.id)?.pass).map(c => c.id);
  const passed = total - failed.length;
  const reason = run.timeout ? 'timeout' : run.error ? 'error' : failed.length ? 'checks' : null;
  return { ok: !reason, reason, passed, total, failed };
}

// The portfolio record for a verified ship (verify.ok must be true). It keeps exactly the code that was
// verified: code over the workspace limit is never shipped (the workspace refuses it before submitting).
// blueprint: true only for a completed Blueprint (started — never for a waived one).
export function shipRecord({ lv, lang, curriculum, a, code, run, verify, review = null, now = Date.now() }) {
  if (!verify?.ok || typeof code !== 'string' || code.length > MAX_CODE) return null;
  const ws = a.workspace;
  return {
    title: lv.title, lang, curriculum, shippedAt: now, verified: true,
    checks: { passed: verify.passed, total: verify.total },
    milestones: { cleared: ws.cleared.filter(Boolean).length, total: ws.cleared.length },
    hearts: a.session.hearts, runs: ws.runs,
    code, fp: fingerprint(code),
    ...(typeof run?.output === 'string' && lv.kind === 'py' ? { output: run.output.slice(-MAX_OUTPUT) } : {}),
    ...(review?.ai && Number.isFinite(review.score) ? { review: { score: Math.max(0, Math.min(100, Math.round(review.score))), ai: true } } : {}),
    blueprint: a.blueprint?.started === true
  };
}

const sameProject = (p, rec) => (typeof p === 'string' ? p : p?.title) === rec.title && (typeof p === 'string' ? 'js' : p?.lang) === rec.lang && projectCurriculum(p) === rec.curriculum;
// Adds or replaces the record of this project/language/curriculum; every other entry stays as it was.
export const upsertProject = (projects, rec) => [...(Array.isArray(projects) ? projects : []).filter(p => !sameProject(p, rec)), rec];

// What the portfolio shows for an entry (old or new). `verified` only for a consistent new record.
export function portfolioEntry(p, live, levelsByLang) {
  const old = typeof p === 'string' ? { title: p, lang: 'js' } : (p && typeof p === 'object' ? p : {});
  const title = typeof old.title === 'string' ? old.title : 'Project', lang = old.lang === 'py' ? 'py' : 'js';
  const lv = levelsByLang?.[lang]?.find(l => l.t === 'project' && l.title === title);
  const total = lv?.checks?.length ?? 0;
  const ok = old.verified === true && lv && Number.isInteger(old.checks?.passed) && old.checks.passed === total && old.checks.total === total
    && typeof old.code === 'string' && old.fp === fingerprint(old.code) && Number.isInteger(old.milestones?.cleared) && Number.isInteger(old.milestones?.total);
  return {
    title, lang, earlier: isEarlierVersion(typeof p === 'string' ? p : { ...old, lang }, live), verified: !!ok,
    ...(ok ? {
      checks: old.checks, milestones: old.milestones, hearts: Number.isInteger(old.hearts) ? old.hearts : null, runs: Number.isInteger(old.runs) ? old.runs : null,
      shippedAt: Number.isFinite(old.shippedAt) && old.shippedAt > 0 ? old.shippedAt : null, code: old.code,
      output: typeof old.output === 'string' ? old.output : null, review: old.review?.ai === true && Number.isFinite(old.review.score) ? old.review.score : null, blueprint: old.blueprint === true
    } : {}),
    reopen: !!lv
  };
}

// Honest scripted final review: only facts from the verified run.
export function finalText({ lv, verify, a }) {
  const runs = a.workspace.runs, h = a.session.hearts;
  const plan = a.blueprint?.started ? ' You planned it in your Blueprint first, and every milestone now passes.' : '';
  return `**Shipped.** All ${verify.total} checks pass on the exact code you submitted — after ${runs} run${runs === 1 ? '' : 's'}, with ${h}/3 heart${h === 1 ? '' : 's'} left.${plan} ${lv.next}`;
}
