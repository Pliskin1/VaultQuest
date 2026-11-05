// Sandboxed frames for student JavaScript (PRO Workspace). Every run gets a brand-new frame:
//   <iframe sandbox="allow-scripts" srcdoc=…>  — opaque origin: no access to the app's page, cookies or
//   localStorage; no forms, popups, dialogs or navigation of the app; CSP default-src 'none' (no network).
// The frame posts back to the parent; a message counts only if it comes from that exact frame and carries
// that run's nonce. A watchdog removes the frame if no result arrives in time. This is a teaching sandbox,
// not a hardened security boundary.
import { harness } from './harness.js';

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:";
// JSON that is safe inside an inline <script>.
const js = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const fnMap = o => '{' + Object.entries(o).map(([k, f]) => `${js(k)}:(${f})`).join(',') + '}';

export const nonce = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

// The script that starts the harness. env: { html, css, checks: {id: fn}, helpers: fn, prelude: fn }
export const bootScript = (env, cfg) => `(${harness})(${js(cfg)},${fnMap(env.checks ?? {})},${env.helpers ? `(${env.helpers})` : 'null'},${env.prelude ? `(${env.prelude})` : 'null'});`;

// The frame's whole page as text.
export function srcdoc(env, cfg) {
  const boot = bootScript(env, cfg);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${env.css ?? ''}</style></head><body>${env.html ?? ''}<script>${boot}</script></body></html>`;
}

// Host for the invisible check frames (real layout, off screen).
let host = null;
function checkHost() {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;height:420px;overflow:hidden;pointer-events:none;visibility:hidden';
  document.body.appendChild(host);
  return host;
}

export function makeFrame(doc, title) {
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('referrerpolicy', 'no-referrer');
  f.title = title;
  f.srcdoc = doc;
  return f;
}

const live = new Set(); // pending check runs, so leaving the workspace can drop them all

// Runs one check in a fresh hidden frame → the harness's result, or { timeout: true } from the watchdog,
// or { cancelled: true }.
export function runCheckFrame(env, cfg, timeout = 2500) {
  return new Promise(resolve => {
    const id = nonce(), f = makeFrame(srcdoc(env, { ...cfg, mode: 'check', nonce: id }), 'check');
    const run = { done };
    function done(r) {
      if (!live.has(run)) return;
      live.delete(run); clearTimeout(to); removeEventListener('message', onMsg); f.remove();
      resolve(r);
    }
    function onMsg(e) {
      const d = e.data;
      if (e.source !== f.contentWindow || !d || d.nonce !== id || d.vq !== 'result') return;
      done(d);
    }
    live.add(run);
    addEventListener('message', onMsg);
    const to = setTimeout(() => done({ timeout: true, pass: false, loop: true, errors: [] }), timeout);
    checkHost().appendChild(f);
  });
}

// Drops every pending check (their promises resolve as cancelled) — used when the student leaves.
export function cancelChecks() { for (const r of [...live]) r.done({ cancelled: true }); }
