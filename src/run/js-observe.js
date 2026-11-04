// Runs a student's JavaScript and reports what happened — never whether it's right (content decides that,
// see learn/judge.js). Reports: values of named top-level bindings, results of calling named functions with
// JSON arguments (and those arguments afterwards, to see mutation), and console output.
// Self-contained: it runs inside the observation Worker (run/js-observe-worker.js) and directly in tests.
//  spec: { globals?: [name], calls?: [{ id, fn, args }], logs?: bool }
//  → { loadError: { message } | null, globals: { name: value }, calls: [{ id, value?, args?, error? }], logs: [line], callLogs: [line] }
export function jsObserve(code, spec = {}) {
  const NAME = /^[A-Za-z_$][\w$]*$/;
  const logs = [];
  const text = v => typeof v === 'string' ? v : v === undefined ? 'undefined' : (() => { try { return JSON.stringify(v) ?? String(v); } catch (e) { return String(v); } })();
  const log = (...a) => { logs.push(a.map(text).join(' ')); };
  const fakeConsole = { log, info: log, warn: log, error: log };
  const plain = (v, depth = 0, seen = new Set()) => {
    if (typeof v === 'function') return '[Function]';
    if (typeof v === 'bigint' || typeof v === 'symbol') return String(v);
    if (v === null || typeof v !== 'object') return v;
    if (depth > 6 || seen.has(v)) return '[Circular]';
    seen.add(v);
    const out = Array.isArray(v) ? v.map(x => plain(x, depth + 1, seen)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x, depth + 1, seen)]));
    seen.delete(v);
    return out;
  };
  const message = e => (e && e.name ? `${e.name}: ${e.message}` : String(e));
  const globals = (spec.globals || []).filter(n => NAME.test(n));
  const fns = [...new Set((spec.calls || []).map(c => c.fn).filter(n => NAME.test(n)))];
  // Appended after the student's code (same scope, so top-level let/const are visible). On a new line, so a
  // trailing // comment can't swallow it.
  const probe = '\n;return [{' + globals.map(n => `${JSON.stringify(n)}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(',') +
    '}, {' + fns.map(n => `${JSON.stringify(n)}: typeof ${n} === "function" ? ${n} : undefined`).join(',') + '}];';
  let found;
  try { found = new Function('console', String(code) + probe)(fakeConsole); }
  catch (e) { return { loadError: { message: message(e) }, globals: {}, calls: [], logs, callLogs: [] }; }
  const [g, f] = Array.isArray(found) ? found : [{}, {}];
  const loaded = logs.length;
  const calls = (spec.calls || []).slice(0, 20).map(c => {
    const fn = f[c.fn], args = JSON.parse(JSON.stringify(c.args || []));
    if (typeof fn !== 'function') return { id: c.id, error: `${c.fn} is not defined as a function` };
    try { const value = fn(...args); return { id: c.id, value: plain(value), args: plain(args) }; }
    catch (e) { return { id: c.id, error: message(e), args: plain(args) }; }
  });
  return { loadError: null, globals: plain(g), calls, logs: logs.slice(0, loaded), callLogs: logs.slice(loaded) };
}
