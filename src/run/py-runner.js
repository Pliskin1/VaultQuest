// Lazy Pyodide runner. runPython → { stdout, stderr } (3s limit) or null when Python can't load.
import { pyHarness, parsePy } from './py-observe.js';
let worker = null, ready = null, seq = 0;

function boot() {
  if (ready) return ready;
  ready = new Promise(res => {
    try { worker = new Worker(new URL('./py-worker.js', import.meta.url)); } catch (e) { return res(false); }
    const to = setTimeout(() => { ready = null; res(false); }, 30000);
    worker.onmessage = e => { if (e.data.type === 'ready' || e.data.type === 'fail') { clearTimeout(to); res(e.data.type === 'ready'); } };
    worker.onerror = () => { clearTimeout(to); res(false); };
  });
  return ready;
}

export const preloadPython = () => { boot(); };

export async function runPython(code, timeout = 3000) {
  if (!(await boot())) { ready = null; worker?.terminate(); worker = null; return null; }
  return new Promise(res => {
    const id = ++seq;
    const to = setTimeout(() => {
      worker.terminate(); worker = null; ready = null; // reload a fresh interpreter next time
      res({ stdout: '', stderr: 'TimeoutError: your program ran longer than 3 seconds (infinite loop?)' });
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
