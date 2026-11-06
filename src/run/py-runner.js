// Lazy Pyodide runner. runPython → { stdout, stderr } (3s limit) or null when Python isn't available.
// The first load downloads Pyodide (needs internet). A slow download is never thrown away: a run waits for
// it up to RUN_WAIT and otherwise returns null while the same download keeps going (pythonStatus() is then
// 'loading'), so the next run picks it up. Only a real failure (or LOAD_LIMIT) starts over.
import { pyHarness, parsePy } from './py-observe.js';
const RUN_WAIT = 30000, LOAD_LIMIT = 120000;
let worker = null, ready = null, seq = 0, status = 'idle';
// 'idle' (not requested) · 'loading' (first download, needs internet) · 'ready' · 'failed' (retried next run)
export const pythonStatus = () => status;

function boot() {
  if (ready) return ready;
  status = 'loading';
  ready = new Promise(res => {
    try { worker = new Worker(new URL('./py-worker.js', import.meta.url)); } catch (e) { return res(false); }
    const to = setTimeout(() => res(false), LOAD_LIMIT);
    worker.onmessage = e => { if (e.data.type === 'ready' || e.data.type === 'fail') { clearTimeout(to); res(e.data.type === 'ready'); } };
    worker.onerror = () => { clearTimeout(to); res(false); };
  }).then(ok => {
    status = ok ? 'ready' : 'failed';
    if (!ok) { worker?.terminate(); worker = null; ready = null; } // the next run tries again from scratch
    return ok;
  });
  return ready;
}

export const preloadPython = () => { boot(); };

export async function runPython(code, timeout = 3000) {
  const ok = await Promise.race([boot(), new Promise(r => setTimeout(() => r(false), RUN_WAIT))]);
  if (!ok) return null; // failed — or still downloading (status 'loading'), which keeps going in the background
  return new Promise(res => {
    const id = ++seq;
    const to = setTimeout(() => {
      worker.terminate(); worker = null; ready = null; // reload a fresh interpreter next time
      res({ stdout: '', stderr: `TimeoutError: your program ran longer than ${timeout / 1000} seconds (infinite loop?)` });
    }, timeout);
    worker.onmessage = e => { if (e.data.type === 'result' && e.data.id === id) { clearTimeout(to); res(e.data); } };
    worker.postMessage({ id, code });
  });
}

// Observation run for behaviour-judged challenges (run/py-observe.js) → observation, { timedOut: true },
// or null when Python can't load.
export async function observePython(code, spec, timeout = 3000) {
  const r = await runPython(pyHarness(code, spec), timeout);
  return r ? parsePy(r) : null;
}
