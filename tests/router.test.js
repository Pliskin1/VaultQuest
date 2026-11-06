// Screen transitions (src/core/router.js). A screen's own entrance animations start the moment it is shown,
// together with its fade-in: started after go() resolved, they replayed content the fade had already revealed
// (login and language screens "rendered twice"). Runs on a tiny stand-in for the DOM and Web Animations.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const log = [];
function screen(id) {
  const cls = new Set(), anims = [];
  return {
    classList: { add: c => { cls.add(c); log.push(`${id} shown`); }, remove: c => { cls.delete(c); log.push(`${id} hidden`); }, contains: c => cls.has(c) },
    animate(kf) {
      let done;
      const a = { finished: new Promise(r => { done = r; }), cancel: () => { anims.splice(anims.indexOf(a) >>> 0, 1); done(); } };
      anims.push(a); log.push(`${id} fade ${kf[0].opacity}→${kf.at(-1).opacity}`);
      setImmediate(() => done()); // every animation finishes on the next turn
      return a;
    },
    getAnimations: () => [...anims]
  };
}
const S = Object.fromEntries(['s-title', 's-login', 's-lang', 's-map'].map(id => [id, screen(id)]));
globalThis.document = { querySelector: sel => S[sel.slice(1)] ?? null, querySelectorAll: () => [] };
S['s-title'].classList.add('on');
const { go, current } = await import('../src/core/router.js');

test('enter runs the moment the new screen is shown, while its fade-in is still playing', async () => {
  log.length = 0;
  let seen = null;
  await go('s-login', () => { seen = { on: S['s-login'].classList.contains('on'), fading: S['s-login'].getAnimations().length === 1 }; log.push('enter'); });
  assert.deepEqual(seen, { on: true, fading: true });
  assert.deepEqual(log, ['s-title fade 1→0', 's-title hidden', 's-login shown', 's-login fade 0→1', 'enter']);
  assert.equal(current(), 's-login');
  assert.equal(S['s-login'].getAnimations().length, 0, 'the screen’s own fade is cleaned up afterwards');
});

test('enter is not called when that screen is already showing (a double click can’t replay its entrance)', async () => {
  let calls = 0;
  await go('s-login', () => calls++);
  await go('s-login', () => calls++);
  assert.equal(calls, 0);
  assert.equal(current(), 's-login');
});

test('transitions still run one after another, each entrance with its own screen; enter is optional', async () => {
  log.length = 0;
  const p1 = go('s-lang', () => log.push('enter lang')), p2 = go('s-map'), p3 = go('s-title', () => log.push('enter title'));
  await Promise.all([p1, p2, p3]);
  assert.deepEqual(log.filter(l => /shown|enter/.test(l)), ['s-lang shown', 'enter lang', 's-map shown', 's-title shown', 'enter title']);
  assert.equal(current(), 's-title');
});

test('screens no longer start entrance animations after go() resolves', async () => {
  const fs = await import('node:fs'), path = await import('node:path'), { fileURLToPath } = await import('node:url');
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/go\('s-[\w-]+'\)\.then\(([^]*?)\n\s*\}\);/g)) assert.doesNotMatch(m[1], /\banim\(/, `${f}: entrance animation after go() — pass it as go(id, enter)`);
    assert.doesNotMatch(src, /go\('s-[\w-]+'\)\.then\((flipCards|\(\) => \$\$\()/, f);
  }
});
