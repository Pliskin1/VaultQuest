// Stand-in for run/sandbox/frame.js runCheckFrame in Node: the same boot script (harness + checks + helpers +
// prelude) in a fresh test DOM per check, with the same message shape and a watchdog.
import { bootScript } from '../../src/run/sandbox/frame.js';
import { frameContext } from './dom.js';

export function vmFrame(env, cfg, timeout = 2500) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; clearTimeout(to); resolve(r); } };
    const to = setTimeout(() => finish({ timeout: true, pass: false, loop: true, errors: [] }), timeout);
    const f = frameContext({ html: env.html, onMessage: m => { if (m?.vq === 'result' && m.nonce === 'test') finish(m); } });
    try { f.run(bootScript(env, { ...cfg, mode: 'check', nonce: 'test' })); } catch (e) { finish({ pass: false, errors: [{ name: e.name, message: e.message }] }); }
  });
}
