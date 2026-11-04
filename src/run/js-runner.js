// JS execution for the vaults. runJsChallenge: fix-the-bug code in a throwaway Worker with a 1s kill switch,
// console.log captured. (PRO project code runs in sandboxed frames instead: run/project-js.js.)
const WORKER_SRC = `onmessage=e=>{const out=[];const f=v=>typeof v==='string'?v:(()=>{try{return JSON.stringify(v)}catch(_){return String(v)}})();
console.log=console.info=console.warn=console.error=(...a)=>out.push(a.map(f).join(' '));
let err='';try{new Function(e.data)()}catch(x){err=x&&x.name?x.name+': '+x.message:String(x)}
postMessage({stdout:out.join('\\n'),stderr:err})}`;
let url = null;

// Observation run for behaviour-judged challenges (run/js-observe.js) in a fresh module Worker. The time
// limit starts once the worker is ready, so loading it never counts as the student's code being slow.
// → observation, { timedOut: true }, or null if workers are unavailable.
export function observeJs(code, spec, timeout = 1000) {
  let w;
  try { w = new Worker(new URL('./js-observe-worker.js', import.meta.url), { type: 'module' }); }
  catch (e) { return Promise.resolve(null); }
  return new Promise(res => {
    let to = setTimeout(() => { w.terminate(); res(null); }, 15000); // the worker never started
    const done = r => { clearTimeout(to); w.terminate(); res(r); };
    w.onmessage = e => {
      if (e.data && e.data.ready) { clearTimeout(to); to = setTimeout(() => done({ timedOut: true }), timeout); w.postMessage({ code, spec }); }
      else done(e.data);
    };
    w.onerror = e => { e.preventDefault(); done({ loadError: { message: e.message || 'Error' }, globals: {}, calls: [], logs: [], callLogs: [] }); };
  });
}

// → { stdout, stderr } or null if workers are unavailable (caller falls back to regex checks).
export function runJsChallenge(code, timeout = 1000) {
  let w;
  try { url = url || URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })); w = new Worker(url); }
  catch (e) { return Promise.resolve(null); }
  return new Promise(res => {
    const to = setTimeout(() => { w.terminate(); res({ stdout: '', stderr: 'Error: your code ran longer than 1 second (infinite loop?)' }); }, timeout);
    w.onmessage = e => { clearTimeout(to); w.terminate(); res(e.data); };
    w.onerror = e => { clearTimeout(to); w.terminate(); e.preventDefault(); res({ stdout: '', stderr: e.message || 'Error' }); };
    w.postMessage(code);
  });
}
