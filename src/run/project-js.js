// PRO Workspace adapter for JavaScript. Every check runs the student's app.js in its own fresh sandboxed
// frame (run/sandbox/) with its own randomised data, so checks can't leak into each other or into the app.
// Code is checked for syntax first (parsing only — nothing runs), then instrumented with the loop guard
// (run/sandbox/instrument.js). Result: { checks: [{ id, ms, pass, msg, expected, actual, tags }],
// error: { name, message, line, kind: 'syntax'|'runtime' } | null, timeout, logs, code (instrumented) }.
import { instrument } from './sandbox/instrument.js';
import { runCheckFrame, cancelChecks } from './sandbox/frame.js';
import { rng } from './seed.js';

export { cancelChecks };

// Parses without running anything → SyntaxError message, or null.
export function syntaxError(code) {
  try { new Function(code); return null; } catch (e) { return e instanceof SyntaxError ? e.message : null; }
}

// Instrumented code that still parses → string, or null (then the code is not run at all).
export function guarded(code) {
  for (const bodies of [true, false]) {
    const r = instrument(code, { bodies });
    if (typeof r.code === 'string' && !syntaxError(r.code)) return r.code;
  }
  return null;
}

export const envOf = lv => ({ html: lv.html, css: lv.css, helpers: lv.helpers, prelude: lv.prelude, checks: Object.fromEntries(lv.checks.map(c => [c.id, c.run])) });
// The data each check starts from, for this seed (same code → same data).
export const jsData = (lv, seed) => { const r = rng(seed); return lv.checks.map(c => c.data(r)); };

const firstError = rs => rs.flatMap(r => r.errors ?? [])[0] ?? null;

// → result (see top). `isStale()` lets the caller stop early when the student left meanwhile.
// runFrame: how one check runs (a sandboxed frame; the tests pass an in-process stand-in).
export async function runJsProject(code, lv, { seed, isStale = () => false, parallel = 4, runFrame = runCheckFrame }) {
  const env = envOf(lv), data = jsData(lv, seed);
  const fail = (msg, extra = {}) => lv.checks.map(c => ({ id: c.id, ms: c.ms, pass: false, msg, tags: [], ...extra }));
  if (syntaxError(code)) {
    // Run it once unguarded only to read the browser's message and line: a script that doesn't parse never executes.
    const r = await runFrame(env, { code, data: data[0], check: lv.checks[0].id }, 2500);
    if (r.cancelled) return { cancelled: true };
    const e = firstError([r]) ?? { name: 'SyntaxError', message: syntaxError(code), line: null };
    return { checks: fail('app.js has a syntax error, so nothing ran', { tags: ['syntax-error'] }), error: { ...e, name: 'SyntaxError', kind: 'syntax' }, timeout: false, logs: [] };
  }
  const safe = guarded(code);
  if (!safe) return { unsafe: true };
  const results = new Array(lv.checks.length);
  // The first check runs alone: if the code never finishes before any check even starts, every other
  // check would only wait out the same loop, so they are reported as stopped without running.
  for (let k = 0; k < lv.checks.length; k += k ? parallel : 1) {
    if (isStale()) return { cancelled: true };
    const batch = lv.checks.slice(k, k ? k + parallel : 1).map((c, j) => runFrame(env, { code: safe, data: data[k + j], check: c.id, budget: 250 }, 2500));
    const rs = await Promise.all(batch);
    if (rs.some(r => r.cancelled)) return { cancelled: true };
    rs.forEach((r, j) => { results[k + j] = r; });
    if (k === 0 && (rs[0].timeout || rs[0].loopPhase === 'code')) { for (let j = 1; j < results.length; j++) results[j] = { loop: true, errors: [] }; break; }
  }
  const timeout = results.some(r => r.loop || r.timeout);
  const error = firstError(results);
  const checks = lv.checks.map((c, k) => {
    const r = results[k];
    if (r.timeout || r.loop) return { id: c.id, ms: c.ms, pass: false, msg: 'the code never stopped running', tags: ['loop-timeout'] };
    return { id: c.id, ms: c.ms, pass: !!r.pass, msg: r.pass ? '' : r.msg || 'this check failed', expected: r.expected ?? null, actual: r.actual ?? null, tags: r.tags ?? [] };
  });
  return { checks, error: error && !(timeout && error.name === 'TimeoutError') ? { ...error, kind: error.syntax ? 'syntax' : 'runtime' } : null, timeout, logs: results[0]?.logs ?? [], code: safe };
}
