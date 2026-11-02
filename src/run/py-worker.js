// Classic worker: loads Pyodide from CDN, runs each program in a fresh namespace.
/* global importScripts, loadPyodide */
let py = null;
try {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
  loadPyodide().then(p => { py = p; postMessage({ type: 'ready' }); }).catch(e => postMessage({ type: 'fail', error: String(e) }));
} catch (e) { postMessage({ type: 'fail', error: String(e) }); }

// Strip Pyodide's internal frames so the learner sees a normal traceback for main.py.
function clean(msg) {
  const lines = msg.split('\n'), i = lines.findIndex(l => l.includes('"<exec>"'));
  if (i < 0) return lines.filter(Boolean).pop() || msg;
  const body = lines.slice(i).join('\n').replace(/"<exec>"/g, '"main.py"');
  return /^\s*File/.test(lines[i]) && !/SyntaxError|IndentationError/.test(body) ? 'Traceback (most recent call last):\n' + body : body;
}

onmessage = async e => {
  const { id, code } = e.data, out = [];
  let err = '';
  py.setStdout({ batched: s => out.push(s) });
  py.setStderr({ batched: s => { err += s + '\n'; } });
  const g = py.globals.get('dict')();
  try { await py.runPythonAsync(code, { globals: g }); } catch (x) { err += clean(String(x.message || x)); }
  g.destroy();
  postMessage({ type: 'result', id, stdout: out.join('\n'), stderr: err.trim() });
};
