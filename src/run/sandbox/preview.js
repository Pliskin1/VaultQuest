// Live Preview for JavaScript projects: the student's app in a real, interactive sandboxed frame
// (sandbox/frame.js). Each show() replaces the frame, so an older run can never paint over a newer one;
// messages from a replaced frame are ignored. Runtime errors and console output are reported to `on`.
import { srcdoc, makeFrame, nonce } from './frame.js';

export function createPreview(container, on = {}) {
  let cur = null; // { frame, id, onMsg }
  const pending = new Map(); let seq = 0;
  function stop() {
    if (!cur) return;
    removeEventListener('message', cur.onMsg); cur.frame.remove(); cur = null;
    for (const [, r] of pending) r(null); pending.clear();
  }
  return {
    // Shows `code` (already instrumented) in a new frame. env: project html/css/prelude; data: loadTasks().
    show(env, code, data) {
      stop();
      const id = nonce(), frame = makeFrame(srcdoc({ html: env.html, css: env.css, prelude: env.prelude }, { mode: 'preview', nonce: id, code, data, budget: 250, timerMax: 600 }), 'Live preview of your app');
      frame.className = 'pv-frame';
      const onMsg = e => {
        const d = e.data;
        if (!cur || e.source !== frame.contentWindow || !d || d.nonce !== id) return;
        if (d.vq === 'error') on.error?.(d.error, d.loop);
        else if (d.vq === 'log') on.log?.(d.line, d.level);
        else if (d.vq === 'status') on.status?.(d);
        else if (d.vq === 'acted') { pending.get(d.id)?.(d); pending.delete(d.id); }
      };
      cur = { frame, id, onMsg };
      addEventListener('message', onMsg);
      container.appendChild(frame);
    },
    // Drives the preview (demo recording): { op: 'rect'|'type'|'click', sel, i?, text? } → { found, rect }
    // with rect in page coordinates, or null if the preview was replaced meanwhile.
    act(cmd) {
      if (!cur) return Promise.resolve(null);
      const { frame, id } = cur, k = ++seq;
      return new Promise(res => {
        const to = setTimeout(() => { pending.delete(k); res(null); }, 1500);
        pending.set(k, d => {
          clearTimeout(to);
          if (!d?.rect) return res(d);
          const b = frame.getBoundingClientRect();
          res({ ...d, rect: { x: b.left + d.rect.x, y: b.top + d.rect.y, w: d.rect.w, h: d.rect.h } });
        });
        frame.contentWindow?.postMessage({ vq: 'act', nonce: id, id: k, ...cmd }, '*');
      });
    },
    clear: stop
  };
}
