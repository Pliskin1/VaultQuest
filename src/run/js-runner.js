// JS execution. execApp: project code against the to-do DOM (main thread, needs the DOM).
// runJsChallenge: fix-the-bug code in a throwaway Worker with a 1s kill switch, console.log captured.
const APP_HTML = '<div class="pv-todo"><h3>My tasks</h3><div class="pv-row"><input id="task" placeholder="New task…" aria-label="New task"><button id="add">Add</button></div><ul id="list"></ul><p id="count"></p></div>';

// Inject an iteration cap into braced loops so a runaway loop throws instead of freezing the tab.
const LOOP = /\b(for|while)\s*\(((?:[^()]|\([^()]*\))*)\)\s*\{/g;
const guardLoops = code => code.replace(LOOP, '$1($2){if(++__lg>5e6)throw new Error("Loop ran too long (infinite loop?)");').replace(/\bdo\s*\{/g, 'do{if(++__lg>5e6)throw new Error("Loop ran too long (infinite loop?)");');

export function execApp(code, root) {
  root.innerHTML = APP_HTML;
  const q = s => root.querySelector(s);
  try { new Function('$', 'let __lg=0;' + guardLoops(code))(q); return null; } catch (e) { return e; }
}

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
