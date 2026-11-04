// Python observation: the same report as run/js-observe.js, from real Python. pyHarness() wraps the student's
// code in a small Python program that runs it (as main.py), reads named globals, calls named functions with
// JSON arguments and prints one JSON line; parsePy() turns that output back into an observation.
// Runs in Pyodide in the browser (run/py-runner.js) and in CPython in the tests — same harness either way.
const CALLS = '__VQ_CALLS__', OBS = '__VQ_OBS__';

// JSON text is also a valid Python string literal, so values are embedded with JSON.stringify.
export function pyHarness(code, spec = {}) {
  return `import json as __vq_json, traceback as __vq_tb
__vq_spec = __vq_json.loads(${JSON.stringify(JSON.stringify(spec))})
def __vq_line(e):
    if isinstance(e, SyntaxError):
        return e.lineno
    for f in reversed(__vq_tb.extract_tb(e.__traceback__)):
        if f.filename == "main.py":
            return f.lineno
    return None
def __vq_msg(e):
    return __vq_tb.format_exception_only(type(e), e)[-1].strip()
def __vq_plain(v, d=0):
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if d > 6:
        return repr(v)
    if isinstance(v, (list, tuple)):
        return [__vq_plain(x, d + 1) for x in v]
    if isinstance(v, dict):
        return {str(k): __vq_plain(x, d + 1) for k, x in v.items()}
    if callable(v):
        return "[Function]"
    return repr(v)
__vq_load = None
try:
    exec(compile(${JSON.stringify(String(code))}, "main.py", "exec"), globals())
except BaseException as __vq_e:
    __vq_load = {"message": __vq_msg(__vq_e), "line": __vq_line(__vq_e)}
print(${JSON.stringify(CALLS)})
__vq_globals = {}
for __vq_n in __vq_spec.get("globals", []):
    __vq_globals[__vq_n] = __vq_plain(globals()[__vq_n]) if __vq_n in globals() else {"__missing__": True}
__vq_calls = []
for __vq_c in (__vq_spec.get("calls", []) if __vq_load is None else []):
    __vq_f = globals().get(__vq_c["fn"])
    if not callable(__vq_f):
        __vq_calls.append({"id": __vq_c["id"], "error": "NameError: name '" + __vq_c["fn"] + "' is not defined"})
        continue
    __vq_a = __vq_json.loads(__vq_json.dumps(__vq_c.get("args", [])))
    try:
        __vq_r = __vq_f(*__vq_a)
        __vq_calls.append({"id": __vq_c["id"], "value": __vq_plain(__vq_r), "args": __vq_plain(__vq_a)})
    except BaseException as __vq_e:
        __vq_calls.append({"id": __vq_c["id"], "error": __vq_msg(__vq_e), "args": __vq_plain(__vq_a)})
print(${JSON.stringify(OBS)} + __vq_json.dumps({"loadError": __vq_load, "globals": __vq_globals, "calls": __vq_calls}))
`;
}

const unmissing = g => Object.fromEntries(Object.entries(g || {}).map(([k, v]) => [k, v && v.__missing__ === true ? undefined : v]));

// { stdout, stderr } from running pyHarness() → observation, or { timedOut: true }.
export function parsePy({ stdout = '', stderr = '' }) {
  const lines = String(stdout).split('\n'), c = lines.indexOf(CALLS), o = lines.findIndex(l => l.startsWith(OBS));
  if (/TimeoutError|ran longer than/.test(stderr) && o < 0) return { timedOut: true };
  if (o < 0) return { loadError: { message: String(stderr).trim().split('\n').pop() || 'Python stopped unexpectedly' }, globals: {}, calls: [], logs: lines.slice(0, c < 0 ? lines.length : c).filter(Boolean), callLogs: [] };
  const r = JSON.parse(lines[o].slice(OBS.length)), cut = c < 0 ? o : c; // c < 0: the student's last print didn't end its line
  return { loadError: r.loadError, globals: unmissing(r.globals), calls: r.calls, logs: lines.slice(0, cut), callLogs: c < 0 ? [] : lines.slice(c + 1, o) };
}
