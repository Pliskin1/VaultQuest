// PRO Workspace — the same project rules for every language, on top of the shared attempt engine
// (learn/attempt.js: hearts, fingerprints, Syntax Recovery, saving). A language adapter (run/project-js.js,
// run/project-py.js) only executes the code and reports check results; this decides what a run means:
// which milestones it clears, whether it costs a heart, what the mentor is told and what is saved.
//
// A run = one RUN & TEST press, judged as a whole:
// - progress: it clears a milestone for the first time, passes more checks of the milestone in focus than
//   ever before, or (with every milestone cleared) passes everything → never costs a heart;
// - the exact same code again → a repeat: shown again, never costs a heart, never recorded twice;
// - the untouched starter code → not an attempt yet: shown, never costs a heart, never recorded;
// - anything else (failing checks, errors, timeouts) → costs a heart, like a wrong answer in a vault.
// Milestones stay cleared once passed (their XP is paid once, by reward key), but SUBMIT needs a run of the
// current code that passes every check.
import { answerKey, settleSubmission, cancelSubmission } from './attempt.js';
import { diagnose } from './diagnose.js';

export const MAX_CHAT = 40, MAX_HINTS = 3;

// Which milestones this run passes, what it newly clears and where the feedback should focus.
// run: { checks: [{ id, ms, pass }], error } · ws: the attempt's workspace.
export function judgeRun(ws, run, msCount) {
  const per = k => run.checks.filter(c => c.ms === k);
  const passing = Array.from({ length: msCount }, (_, k) => per(k).length > 0 && per(k).every(c => c.pass));
  const newly = passing.flatMap((p, k) => (p && !ws.cleared[k] ? [k] : []));
  const cleared = ws.cleared.map((c, k) => c || passing[k]);
  const allPass = passing.every(Boolean) && !run.error;
  const current = cleared.indexOf(false); // -1: every milestone cleared
  const focus = current === -1 ? Math.max(0, passing.indexOf(false)) : current;
  const passedInFocus = per(focus).filter(c => c.pass).length;
  const better = passedInFocus > (ws.best[focus] ?? 0) && !newly.length;
  const failed = run.checks.filter(c => !c.pass);
  return {
    passing, newly, cleared, allPass, current, focus, better, failed,
    focusFailed: failed.filter(c => c.ms === focus),
    progress: newly.length > 0 || better || (current === -1 && allPass)
  };
}

// Mistake tags for a run: the failed checks' own tags (most specific first), then the error's.
export function runTags(lang, run, judged) {
  const own = judged.focusFailed.flatMap(c => c.tags ?? []);
  const other = judged.failed.flatMap(c => c.tags ?? []);
  const kind = run.timeout ? ['loop-timeout'] : run.error?.kind === 'syntax' ? ['syntax-error'] : [];
  const err = run.error ? diagnose({ lang, type: 'code', error: `${run.error.name}: ${run.error.message}` }).tags : [];
  return [...new Set([...kind, ...err, ...own, ...other])].slice(0, 8);
}

// Applies a judged run to the attempt → outcome { duplicate, starter, heartLost, hearts, locked, exhausted }, or
// null if the token is stale (the student left, or the attempt was replaced while the checks ran).
// starter: the code to compare with for "untouched starter".
export function settleRun(a, token, { code, run, judged, tags = [], starter = null }) {
  if (!a?.workspace || !token || token.id !== a.id || a.over || token.settled) return null;
  const key = answerKey(a, 0, 'code', code);
  const ws = a.workspace;
  const repeat = a.session.attempts.some(x => x.fingerprint === key);
  const untouched = starter !== null && key === answerKey(a, 0, 'code', starter);
  let out;
  if (repeat || untouched) { cancelSubmission(a, token); out = { duplicate: repeat && !untouched, starter: untouched, heartLost: false, hearts: a.session.hearts, locked: a.session.locked, exhausted: false }; }
  else {
    const evidence = { type: 'code', ms: judged.focus, ...(run.error ? { error: `${run.error.name}: ${run.error.message}`.slice(0, 160) } : {}), ...(run.timeout ? { timeout: true } : {}) };
    out = settleSubmission(a, token, { key, passed: judged.progress, tags, evidence });
    if (!out) return null;
  }
  const best = ws.best.map((b, k) => Math.max(b, run.checks.filter(c => c.ms === k && c.pass).length));
  a.workspace = {
    ...ws, cleared: judged.cleared, best, runs: ws.runs + (repeat || untouched ? 0 : 1), lastKey: key,
    passKey: judged.allPass ? key : null,
    results: run.checks.slice(0, 40).map(c => ({ id: c.id, ms: c.ms, pass: !!c.pass, msg: String(c.msg ?? '').slice(0, 300), ...(c.pass || c.expected == null ? {} : { exp: String(c.expected).slice(0, 120), act: String(c.actual ?? 'nothing').slice(0, 120) }) })),
    error: run.error ? { name: String(run.error.name ?? 'Error').slice(0, 40), message: String(run.error.message ?? '').slice(0, 300), line: Number.isInteger(run.error.line) ? run.error.line : null, kind: run.error.kind === 'syntax' ? 'syntax' : 'runtime' } : null,
    timeout: !!run.timeout,
    output: typeof run.output === 'string' ? run.output.slice(-4000) : ws.output
  };
  return out;
}

// SUBMIT is open only for the exact code whose last run passed every check.
export const canSubmit = (a, code) => !!a?.workspace?.passKey && a.workspace.passKey === answerKey(a, 0, 'code', code);

// Free hints for the milestone in focus: up to three, each more specific, never the solution.
export function nextHint(a, ms, hints) {
  const ws = a?.workspace;
  if (!ws || a.over) return null;
  const n = ws.hints[ms] ?? 0;
  if (n >= Math.min(MAX_HINTS, hints.length)) return null;
  a.workspace = { ...ws, hints: ws.hints.map((h, k) => (k === ms ? n + 1 : h)) };
  return { level: n + 1, text: hints[n] };
}

// The mentor conversation is part of the attempt, so leaving or refreshing keeps it.
export function logChat(a, entry) {
  const ws = a?.workspace;
  if (!ws || a.over) return;
  const e = { w: entry.w === 'u' ? 'u' : 'm', text: String(entry.text ?? '').slice(0, 1500), ...(entry.label ? { label: String(entry.label).slice(0, 40) } : {}), ...(entry.kind ? { kind: String(entry.kind).slice(0, 10) } : {}) };
  a.workspace = { ...ws, chat: [...ws.chat, e].slice(-MAX_CHAT) };
}

export function markShipped(a) { if (a?.workspace && !a.over) a.workspace = { ...a.workspace, shipped: true }; }

// What the AI reviewer is told (server/ai.js): the milestone in focus, the failing checks with expected vs
// actual, the error, and how many runs it took — never more than it needs.
export function reviewPayload({ lang, lv, judged, run, code, a, final = false }) {
  const f = judged?.focus ?? 0;
  return {
    lang, project: lv.title, milestones: lv.ms.map(m => m.n), milestone: final ? null : { n: f + 1, name: lv.ms[f].n, goal: lv.ms[f].d },
    code, final, runs: a?.workspace?.runs ?? 0,
    failing: final ? [] : (judged?.failed ?? []).slice(0, 6).map(c => ({ milestone: c.ms + 1, message: c.msg, expected: c.expected ?? null, actual: c.actual ?? null })),
    error: run?.error ? `${run.error.name}: ${run.error.message}${run.error.line ? ` (line ${run.error.line})` : ''}` : run?.timeout ? 'Timeout: the code never stopped running' : null
  };
}

// Scripted (no-AI) Socratic feedback: what failed, in plain words, and one guiding question — never code
// that solves it. `again`: this check also failed on the previous run (the question gets more specific).
export function scriptedFeedback({ lv, judged, run, errorAsk, again = false }) {
  if (run.timeout) return errorAsk.timeout;
  if (run.error) return errorAsk.error(run.error);
  const c = judged.focusFailed[0] ?? judged.failed[0];
  if (!c) return null;
  const spec = lv.checks.find(x => x.id === c.id);
  const ask = (again && spec?.ask2) || spec?.ask || 'What did you expect to see here, and what does your code actually do?';
  const seen = c.expected != null ? ` Expected ${c.expected}, got ${c.actual ?? 'nothing'}.` : '';
  return `**${lv.ms[c.ms].n}** — ${c.msg}.${seen} ${ask}`;
}
