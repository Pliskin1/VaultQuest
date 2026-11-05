// PRO at any time: the checkout no longer waits for the Mini Boss, but PRO (`S.pro`, one profile-wide flag) and
// learning progress stay separate. Buying early never marks or skips a FREE vault or the Mini Boss, an early
// PRO student is never offered PRO again after the Mini Boss, and the flag persists per profile across reloads,
// language switches and old saves. The screens ask learn/unlock.js, so the rules are tested there; each
// "page load" of state.js runs in a fresh child process with its own localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGS } from '../src/content/languages.js';
import { afterMiniBoss, afterCheckout, canEnter, lockReason, isDone, nextStep, roles } from '../src/learn/unlock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_URL = pathToFileURL(path.join(ROOT, 'src', 'core', 'state.js')).href;

const base = (lang, extra = {}) => ({ lang, done: { py: 0, js: 0 }, stars: {}, pro: false, projects: [], curriculum: { py: 'py-2', js: 'js-2' }, attempts: {}, ...extra });

for (const lang of ['js', 'py']) {
  const L = LANGS[lang], R = roles(L), can = (S, i) => canEnter(S, lang, L, i);

  test(`${lang}: buying PRO on vault 1 or 3 keeps the FREE order — nothing is skipped or marked done`, () => {
    for (const done of [0, 2]) { // on vault 1 / on vault 3
      const S = base(lang, { done: { py: done, js: done }, pro: true });
      assert.equal(can(S, done), true, 'the current vault stays open');
      assert.equal(can(S, done + 1), false, 'the next FREE vault stays locked');
      assert.equal(isDone(S, lang, L, done), false);
      assert.equal(can(S, 4), false); assert.match(lockReason(S, lang, L, 4), /Crack/);
      for (const i of [R.proVault, R.project, R.final]) { assert.equal(can(S, i), false, 'node ' + i); assert.match(lockReason(S, lang, L, i), /Mini Boss/); }
      assert.equal(afterCheckout(S, lang, L), done, 'after checkout the map highlights the current FREE vault, not Vault 6');
    }
  });

  test(`${lang}: a FREE student who beats the Mini Boss gets the upgrade offer; Vault 6 stays locked until PRO`, () => {
    const S = base(lang, { done: { py: 5, js: 5 } });
    assert.deepEqual(afterMiniBoss(S, L), { kind: 'upgrade', to: R.proVault });
    // dismissing the offer: World 1 stays cleared, PRO steps stay locked with a reason
    for (const i of [0, 1, 2, 3, 4]) assert.equal(isDone(S, lang, L, i), true);
    assert.equal(can(S, R.proVault), false); assert.match(lockReason(S, lang, L, R.proVault), /Unlock PRO/);
    // buying later opens Vault 6 (and only Vault 6)
    S.pro = true;
    assert.equal(can(S, R.proVault), true); assert.equal(can(S, R.project), false); assert.equal(can(S, R.final), false);
    assert.equal(afterCheckout(S, lang, L), R.proVault);
  });

  test(`${lang}: an early PRO student beats the Mini Boss → continues to Vault 6, no second offer`, () => {
    const S = base(lang, { done: { py: 4, js: 4 }, pro: true });
    assert.equal(can(S, 4), true); assert.equal(can(S, R.proVault), false);
    S.done[lang] = 5; // the Mini Boss saved normally
    assert.deepEqual(afterMiniBoss(S, L), { kind: 'continue', to: R.proVault });
    assert.equal(can(S, R.proVault), true); assert.equal(nextStep(S, lang, L), R.proVault);
    // Project 7 and the Final Boss still follow the normal order
    assert.equal(can(S, R.project), false); S.stars[lang + R.proVault] = 3; assert.equal(can(S, R.project), true);
    assert.equal(can(S, R.final), false);
  });
}

// ---- persistence through state.js (each run = one page load with the given localStorage) ----
const CHILD = `
const cfg = JSON.parse(process.env.VQ_CFG), store = new Map(Object.entries(cfg.storage));
Object.defineProperty(globalThis, 'location', { value: { search: '' }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, configurable: true });
const st = await import(cfg.url);
await new Function('st', cfg.run)(st);
process.stdout.write(JSON.stringify({ S: { name: st.S.name, pro: st.S.pro, lang: st.S.lang, xp: st.S.xp, done: st.S.done, v: st.S.v, legacy: st.S.legacy }, storage: Object.fromEntries(store) }));`;
const load = (storage, run = '') => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', CHILD], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, VQ_CFG: JSON.stringify({ url: STATE_URL, storage, run }) }, timeout: 30000 }));

test('PRO bought early persists across a reload and keeps XP and progress', () => {
  const a = load({}, `st.login('Ana'); st.S.lang = 'js'; st.S.xp = 700; st.S.done.js = 2; st.save(); st.S.pro = true; st.save();`);
  const b = load(a.storage);
  assert.equal(b.S.name, 'Ana'); assert.equal(b.S.pro, true);
  assert.equal(b.S.xp, 700); assert.deepEqual(b.S.done, { py: 0, js: 2 }, 'upgrading changes no progress');
});

test('PRO belongs to the active profile only — never leaks to another profile on the device', () => {
  const a = load({}, `st.login('Ana'); st.S.pro = true; st.save(); st.logout(); st.login('Ben'); st.save();`);
  assert.equal(a.S.name, 'Ben'); assert.equal(a.S.pro, false);
  assert.equal(JSON.parse(a.storage['vaultquest:ana']).pro, true);
  assert.equal(JSON.parse(a.storage['vaultquest:ben']).pro, false);
  const b = load({ ...a.storage, 'vaultquest:user': JSON.stringify('Ana') });
  assert.equal(b.S.pro, true);
});

test('switching language keeps the profile-wide PRO flag; each language keeps its own progress', () => {
  const a = load({}, `st.login('Ana'); st.S.lang = 'js'; st.S.done.js = 3; st.S.pro = true; st.save(); st.S.lang = 'py'; st.save();`);
  const b = load(a.storage);
  assert.equal(b.S.lang, 'py'); assert.equal(b.S.pro, true); assert.deepEqual(b.S.done, { py: 0, js: 3 });
  // PRO doesn't open Python's PRO path before Python's Mini Boss
  const S = { ...b.S, stars: {}, projects: [], attempts: {}, curriculum: { py: 'py-2', js: 'js-2' } };
  assert.equal(canEnter(S, 'py', LANGS.py, roles(LANGS.py).proVault), false);
});

test('a profile that never completed checkout stays FREE after reloads', () => {
  const a = load({}, `st.login('Cat'); st.S.done.py = 3; st.save();`); // opened the PRO page, closed the checkout: nothing saved
  const b = load(a.storage);
  assert.equal(b.S.pro, false);
});

test('old saves: an unversioned PRO save is upgraded and stays PRO; an old FREE save stays FREE', () => {
  const old = (name, pro) => ({ 'vaultquest:users': JSON.stringify([name]), 'vaultquest:user': JSON.stringify(name), ['vaultquest:' + name.toLowerCase()]: JSON.stringify({ name, lang: 'py', xp: 900, done: { py: 3, js: 0 }, stars: { py0: 3 }, ach: [], streak: 1, lastDay: '', questions: 0, pro, projects: [] }) });
  const p = load(old('OldPro', true)), f = load(old('OldFree', false));
  assert.equal(p.S.v, 4); assert.equal(p.S.pro, true); assert.equal(p.S.xp, 900); assert.equal(p.S.legacy['py-1'].done, 3);
  assert.equal(f.S.v, 4); assert.equal(f.S.pro, false);
});
