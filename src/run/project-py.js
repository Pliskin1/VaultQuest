// PRO Workspace adapter for Python (Pyodide in a Worker, run/py-runner.js). One program run per RUN & TEST:
// it compiles game.py, runs it once with the project's demo for the terminal preview, then runs every check
// against a fresh copy of the program (its own namespace, its own stdout). A program that never finishes
// is stopped by the runner's timeout and the worker is replaced. Result shape matches run/project-js.js.
import { runPython } from './py-runner.js';
import { rng } from './seed.js';

const MARK = '__VQ_PROJECT__';

// The whole harness as Python source. checks: [{ id, src }] (src already generated from the seed).
export function pyProjectHarness(code, demo, checks) {
  return `import json as _vq_json, io as _vq_io, contextlib as _vq_cl, traceback as _vq_tb, copy as _vq_copy, builtins as _vq_bi
_vq_src = ${JSON.stringify(code)}
_vq_out = {"compile": None, "run": None, "output": "", "checks": []}

class _VqFail(Exception):
    pass

def _vq_json_ok(v):
    try:
        _vq_json.dumps(v)
        return v
    except Exception:
        return repr(v)

def _vq_expect(actual, expected, label):
    same = type(actual) is type(expected) and actual == expected
    if not same:
        raise _VqFail({"label": label, "expected": repr(expected), "actual": repr(actual), "value": _vq_json_ok(actual), "want": _vq_json_ok(expected)})

def _vq_err(e):
    line = None
    if isinstance(e, SyntaxError):
        line = e.lineno
    else:
        for f in _vq_tb.extract_tb(e.__traceback__):
            if f.filename == "game.py":
                line = f.lineno
    msg = e.msg if isinstance(e, SyntaxError) else str(e)
    return {"name": type(e).__name__, "message": str(msg)[:300], "line": line}

def _vq_no_input(prompt=""):
    raise EOFError("EOF when reading a line")

try:
    _vq_code = compile(_vq_src, "game.py", "exec")
except SyntaxError as e:
    _vq_out["compile"] = _vq_err(e)

if _vq_out["compile"] is None:
    _vq_buf = _vq_io.StringIO()
    _vq_ns = {"__name__": "__main__", "input": _vq_no_input}
    try:
        with _vq_cl.redirect_stdout(_vq_buf):
            exec(_vq_code, _vq_ns)
            try:
                exec(${JSON.stringify(demo)}, _vq_ns)
            except Exception as e:
                print(f"{type(e).__name__}: {e}")
    except BaseException as e:
        _vq_out["run"] = _vq_err(e)
    _vq_out["output"] = _vq_buf.getvalue()[-4000:]
    for _vq_c in _vq_json.loads(${JSON.stringify(JSON.stringify(checks))}):
        _vq_r = {"id": _vq_c["id"], "pass": False}
        _vq_ns = {"__name__": "game", "input": _vq_no_input}
        try:
            with _vq_cl.redirect_stdout(_vq_io.StringIO()):
                exec(_vq_code, _vq_ns)
                _vq_ns["expect"] = _vq_expect
                exec(_vq_c["src"], _vq_ns)
            _vq_r["pass"] = True
        except _VqFail as f:
            _vq_r.update(f.args[0])
        except BaseException as e:
            _vq_r["error"] = _vq_err(e)
        _vq_out["checks"].append(_vq_r)

print(${JSON.stringify(MARK)} + _vq_json.dumps(_vq_out))
`;
}

// Program output + MARK line → { checks, error, output, timeout } for the given check specs.
export function parsePyProject(r, specs) {
  const stdout = String(r?.stdout ?? ''), stderr = String(r?.stderr ?? '');
  const line = stdout.split('\n').find(l => l.startsWith(MARK));
  if (!line) {
    const timeout = /TimeoutError|ran longer than/.test(stderr);
    const message = stderr.split('\n').filter(Boolean).pop() || 'the program stopped before the checks could run';
    return {
      timeout, output: stdout.slice(-4000),
      error: timeout ? null : { name: (/^(\w+Error)/.exec(message) || [, 'Error'])[1], message, line: null, kind: 'runtime' },
      checks: specs.map(s => ({ id: s.id, ms: s.ms, pass: false, msg: timeout ? 'the program never finished' : 'the checks could not run', tags: timeout ? ['loop-timeout'] : [] }))
    };
  }
  const o = JSON.parse(line.slice(MARK.length));
  const error = o.compile ? { ...o.compile, kind: 'syntax' } : o.run ? { ...o.run, kind: 'runtime' } : null;
  const checks = specs.map(s => {
    const c = (o.checks || []).find(x => x.id === s.id);
    if (!c) return { id: s.id, ms: s.ms, pass: false, msg: error?.kind === 'syntax' ? 'game.py has a syntax error, so nothing could run' : 'the check did not run', tags: [] };
    if (c.pass) return { id: s.id, ms: s.ms, pass: true };
    if (c.error) return { id: s.id, ms: s.ms, pass: false, msg: `${c.error.name}: ${c.error.message}`, error: c.error, tags: [] };
    return { id: s.id, ms: s.ms, pass: false, msg: `${c.label} should return ${c.expected}`, expected: c.expected, actual: c.actual, tags: s.tags ? s.tags(c.value ?? null, c.want) : [] };
  });
  // An error inside a check (not a wrong value) counts as the run's error too — it is what to fix first.
  const inCheck = checks.find(c => c.error)?.error;
  return { checks, error: error ?? (inCheck ? { ...inCheck, kind: 'runtime' } : null), timeout: false, output: o.output || '' };
}

// The checks as Python source for this seed.
export const pyChecks = (lv, seed) => { const r = rng(seed); return lv.checks.map(c => ({ id: c.id, src: c.py(r) })); };

// → { checks, error, timeout, output } or { unavailable: true } when Python can't load (offline).
export async function runPyProject(code, lv, { seed }) {
  const r = await runPython(pyProjectHarness(code, lv.demo, pyChecks(lv, seed)), 5000);
  if (!r) return { unavailable: true };
  return parsePyProject(r, lv.checks);
}
