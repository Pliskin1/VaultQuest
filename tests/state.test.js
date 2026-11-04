// core/state.js against an in-memory localStorage: loading, upgrading, backups, corrupt saves, demo mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { V1 } from './fixtures/profiles.js';

let n = 0;
function memoryStorage(initial = {}, fail = () => false) {
  const m = new Map(Object.entries(initial));
  return {
    m, getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (fail(k)) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => m.delete(k)
  };
}
// A fresh copy of state.js, as on a page load, against the given storage and URL.
async function boot(storage, search = '') {
  globalThis.localStorage = storage; globalThis.location = { search };
  const warn = console.warn; console.warn = () => {};
  try { return await import(`../src/core/state.js?boot=${++n}`); } finally { console.warn = warn; }
}
const as = (f, extra = {}) => ({ 'vaultquest:users': JSON.stringify([f.name]), 'vaultquest:user': JSON.stringify(f.name), ['vaultquest:' + f.name.toLowerCase()]: JSON.stringify(f), ...extra });

test('an existing v1 profile is backed up untouched, then upgraded: old progress archived, everything else kept', async () => {
  const text = JSON.stringify(V1.jsShipped), st = memoryStorage(as(V1.jsShipped));
  const { S, save } = await boot(st);
  for (const f of ['xp', 'ach', 'pro', 'projects', 'custom', 'questions']) assert.deepEqual(S[f], V1.jsShipped[f], f);
  assert.equal(st.getItem('vaultquest:jsshipped.backup.v1'), text);
  assert.equal(S.v, 4); assert.deepEqual(S.curriculum, { py: 'py-2', js: 'js-2' }); assert.deepEqual(S.attempts, {});
  assert.deepEqual(S.done, { py: 0, js: 0 }); assert.deepEqual(S.stars, {}); // the new World 1 starts fresh…
  assert.deepEqual(S.legacy['js-1'].stars, V1.jsShipped.stars); assert.equal(S.legacy['js-1'].done, 4); // …the old one is kept
  save();
  const saved = JSON.parse(st.getItem('vaultquest:jsshipped'));
  assert.equal(saved.v, 4); assert.equal(saved.xp, 1990); assert.equal(saved.awarded['js-1:5:ship'], null);
});

test('later page loads: no second backup, nothing changes', async () => {
  const st = memoryStorage(as(V1.proPy));
  (await boot(st)).save();
  const first = st.getItem('vaultquest:propy'), backups = [...st.m.keys()].filter(k => k.includes('.backup'));
  for (let i = 0; i < 3; i++) (await boot(st)).save();
  assert.deepEqual(JSON.parse(st.getItem('vaultquest:propy')), JSON.parse(first));
  assert.deepEqual([...st.m.keys()].filter(k => k.includes('.backup')), backups);
  assert.equal(backups.length, 1);
});

test('if the backup cannot be written, the original profile is never overwritten', async () => {
  const text = JSON.stringify(V1.pyPartial), st = memoryStorage(as(V1.pyPartial), k => k.includes('.backup'));
  const { S, save } = await boot(st);
  assert.equal(S.xp, 420); // the player still sees their progress…
  S.xp = 999; save();
  assert.equal(st.getItem('vaultquest:pypartial'), text); // …but nothing is written over the original
});

test('a corrupt save is copied aside before the profile starts fresh', async () => {
  const st = memoryStorage({ 'vaultquest:users': '["Ana"]', 'vaultquest:user': '"Ana"', 'vaultquest:ana': '{"xp": 12, broken' });
  const { S, save } = await boot(st);
  assert.equal(S.xp, 0);
  assert.equal(st.getItem('vaultquest:ana.corrupt'), '{"xp": 12, broken');
  save();
  assert.equal(JSON.parse(st.getItem('vaultquest:ana')).v, 4);
  assert.equal(st.getItem('vaultquest:ana.corrupt'), '{"xp": 12, broken');
});

test('an older corrupt copy is kept; a different one is stored next to it', async () => {
  const st = memoryStorage({ 'vaultquest:user': '"Ana"', 'vaultquest:ana': 'garbage-2', 'vaultquest:ana.corrupt': 'garbage-1' });
  await boot(st);
  assert.equal(st.getItem('vaultquest:ana.corrupt'), 'garbage-1');
  assert.ok([...st.m.entries()].some(([k, v]) => k.startsWith('vaultquest:ana.corrupt-') && v === 'garbage-2'));
});

test('if a corrupt save cannot be copied, it is not overwritten either', async () => {
  const st = memoryStorage({ 'vaultquest:user': '"Ana"', 'vaultquest:ana': '[1,2' }, k => k.includes('.corrupt'));
  const { S, save } = await boot(st);
  S.xp = 50; save();
  assert.equal(st.getItem('vaultquest:ana'), '[1,2');
});

test('new profiles start as v4 with the live curricula, no rewards and no attempts', async () => {
  const st = memoryStorage();
  const { S, login } = await boot(st);
  login('Ben');
  const saved = JSON.parse(st.getItem('vaultquest:ben'));
  assert.deepEqual({ v: saved.v, curriculum: saved.curriculum, awarded: saved.awarded, legacy: saved.legacy, attempts: saved.attempts, xp: saved.xp }, { v: 4, curriculum: { py: 'py-2', js: 'js-2' }, awarded: {}, legacy: {}, attempts: {}, xp: 0 });
  assert.equal(S.name, 'Ben');
  assert.equal([...st.m.keys()].some(k => k.includes('.backup')), false);
});

test('rewards use the live curriculum and pay once; unchanged Pro content keeps its old reward identity', async () => {
  const st = memoryStorage(as(V1.jsShipped)); // shipped the To-Do App and cracked Arrays & Loops in js-1
  const { S, rk, reward } = await boot(st);
  assert.equal(rk(0, 0), 'js-2:0:0'); assert.equal(rk(1, 'bonus', 'py'), 'py-2:1:bonus');
  assert.equal(reward(rk(0, 0), 50), 50); // the new World 1 is genuinely new: it pays once…
  assert.equal(reward(rk(0, 0), 50), 0); // …and only once
  assert.equal(rk(4, 0), 'js-2:4:0'); // the Mini Boss is new
  assert.equal(rk(5, 0), 'js-1:4:0'); assert.equal(rk(6, 'ship'), 'js-1:5:ship'); assert.equal(rk(5, 0, 'py'), 'py-1:4:0'); // moved, same identity
  assert.equal(reward(rk(5, 0), 50), 0); // Arrays & Loops: already earned in js-1
  assert.equal(reward(rk(6, 'm0'), 50), 0); assert.equal(reward(rk(6, 'ship'), 300), 0); // the shipped project can't pay again
  assert.equal(S.xp, 1990 + 50);
});

test('reserved handles are blocked for new accounts only', async () => {
  const fresh = await boot(memoryStorage());
  for (const h of ['user', 'users', 'User', 'USERS']) { assert.equal(fresh.validHandle(h), false, h); assert.equal(fresh.isReserved(h), true, h); }
  for (const h of ['Ana', 'user1', 'my-users', 'Ben_2']) assert.equal(fresh.validHandle(h), true, h);
  assert.equal(fresh.validHandle('a'), false);
  const existing = await boot(memoryStorage({ 'vaultquest:users': '["Users"]' }));
  assert.equal(existing.validHandle('users'), true); // an existing profile keeps working
});

test('demo modes never read or write profile data', async () => {
  for (const mode of ['?demo=1', '?demo=pro']) {
    const st = memoryStorage(as(V1.jsShipped)), before = new Map(st.m);
    const { S, save, login, reward } = await boot(st, mode);
    assert.equal(S.name, 'DEMO'); assert.equal(S.xp, 0);
    reward('js-1:5:m0', 50); S.xp += 10; save(); login('Someone');
    assert.deepEqual(st.m, before, mode);
  }
});

test('a v2 save (Phase 2 build) is backed up untouched as .backup.v2, then upgraded without losing anything', async () => {
  const v2 = { ...V1.jsOne, v: 2, curriculum: { py: 'py-1', js: 'js-1' }, awarded: { 'js-1:0:0': null, 'js-1:1:0': 50 }, legacy: {} }, text = JSON.stringify(v2);
  const st = memoryStorage(as(v2));
  const { S, save } = await boot(st);
  assert.equal(st.getItem('vaultquest:jsone.backup.v2'), text);
  assert.equal(S.v, 4); assert.deepEqual(S.attempts, {}); assert.deepEqual(S.awarded, v2.awarded); assert.equal(S.xp, v2.xp);
  save();
  for (let i = 0; i < 2; i++) (await boot(st)).save(); // later loads: no further backups
  assert.equal([...st.m.keys()].filter(k => k.includes('.backup')).length, 1);
});

test('a saved locked attempt is still locked after a page load (Recovery cannot be skipped by refreshing)', async () => {
  const locked = { lang: 'py', vault: 0, curriculum: 'py-2', session: { hearts: 0, locked: true, failedFingerprints: ['a', 'b', 'c'], attempts: [], recovery: null }, run: { paid: [] }, view: { ci: 2, drafts: { 2: 'print(x)' } } };
  const v3 = { ...V1.pyPartial, done: { py: 0, js: 0 }, stars: {}, v: 4, curriculum: { py: 'py-2', js: 'js-2' }, awarded: {}, legacy: {}, attempts: { 'py-2:0': locked } };
  const st = memoryStorage(as(v3));
  const { S } = await boot(st);
  assert.deepEqual(S.attempts['py-2:0'], locked);
  assert.equal([...st.m.keys()].some(k => k.includes('.backup')), false); // nothing to upgrade
});

test('a v3 save on the old curricula (Phase 4 build) is backed up, then archived — including a locked old attempt', async () => {
  const oldLocked = { lang: 'py', vault: 0, curriculum: 'py-1', session: { hearts: 0, locked: true, failedFingerprints: ['a'], attempts: [], recovery: null }, run: { paid: [] }, view: { ci: 2 } };
  const v3 = { ...V1.proPy, v: 3, curriculum: { py: 'py-1', js: 'js-1' }, awarded: { 'py-1:0:0': 50, 'py-1:5:ship': 300 }, legacy: {}, attempts: { 'py-1:0': oldLocked } }, text = JSON.stringify(v3);
  const st = memoryStorage(as(v3));
  const { S, save } = await boot(st);
  assert.equal(st.getItem('vaultquest:propy.backup.v3'), text);
  assert.deepEqual(S.attempts, {}); assert.deepEqual(S.legacy['py-1'].attempts['py-1:0'], oldLocked); // no old Recovery to get stuck in
  assert.equal(S.legacy['py-1'].done, 4); assert.equal(S.legacy['js-1'].done, 4);
  assert.deepEqual({ xp: S.xp, pro: S.pro, ach: S.ach, projects: S.projects, awarded: S.awarded }, { xp: v3.xp, pro: true, ach: v3.ach, projects: v3.projects, awarded: v3.awarded });
  save();
  for (let i = 0; i < 2; i++) (await boot(st)).save(); // reopening: archived once, no duplicate backups
  const again = JSON.parse(st.getItem('vaultquest:propy'));
  assert.equal(again.xp, v3.xp); assert.equal(again.legacy['py-1'].done, 4);
  assert.equal([...st.m.keys()].filter(k => k.includes('.backup')).length, 1);
});

test('if the backup before a curriculum switch fails, the original save is never overwritten', async () => {
  const v3 = { ...V1.jsOne, v: 3, curriculum: { py: 'py-1', js: 'js-1' }, awarded: {}, legacy: {}, attempts: {} }, text = JSON.stringify(v3);
  const st = memoryStorage(as(v3), k => k.includes('.backup'));
  const { S, save } = await boot(st);
  assert.equal(S.curriculum.js, 'js-2'); // the session still runs on the new curriculum…
  S.xp += 5; save();
  assert.equal(st.getItem('vaultquest:jsone'), text); // …but nothing is written over the original
});

test('a v3 save from the Phase 5 build (World 1 without the Mini Boss) is backed up, then its Pro vault and project state move up one level', async () => {
  const proVault = { lang: 'js', vault: 4, curriculum: 'js-2', session: { hearts: 2, locked: false, failedFingerprints: ['x'], attempts: [], recovery: null }, run: { paid: [] }, view: { ci: 1 } };
  const v3 = { ...V1.jsOne, v: 3, done: { py: 4, js: 4 }, stars: { js0: 3, js1: 3, js2: 3, js3: 3, js4: 2, js5: 3, py0: 3, py4: 1 }, curriculum: { py: 'py-2', js: 'js-2' }, awarded: { 'js-1:4:bonus': 290 }, legacy: {}, attempts: { 'js-2:4': proVault, 'js-2:1': { keep: 1 } } }, text = JSON.stringify(v3);
  const st = memoryStorage(as(v3));
  const { S, save, rk } = await boot(st);
  assert.equal(st.getItem('vaultquest:jsone.backup.v3'), text);
  assert.deepEqual(S.stars, { js0: 3, js1: 3, js2: 3, js3: 3, js5: 2, js6: 3, py0: 3, py5: 1 }); // the Mini Boss (level 4) starts unplayed
  assert.deepEqual(S.attempts['js-2:5'], { ...proVault, vault: 5 }); assert.deepEqual(S.attempts['js-2:1'], { keep: 1 }); assert.equal(S.attempts['js-2:4'], undefined);
  assert.deepEqual(S.done, { py: 4, js: 4 }); // four vaults done → the Mini Boss is next
  assert.equal(rk(5, 'bonus'), 'js-1:4:bonus'); assert.equal(S.awarded['js-1:4:bonus'], 290); // the Pro vault's reward stays paid
  save(); (await boot(st)).save();
  assert.deepEqual(JSON.parse(st.getItem('vaultquest:jsone')).stars, S.stars); // idempotent across reloads
});

test('v3 → v4 is independent per language: a language still on its old curriculum is archived, the World 1 one is shifted', async () => {
  const v3 = { ...V1.proPy, v: 3, curriculum: { py: 'py-1', js: 'js-2' }, done: { py: 4, js: 4 }, stars: { py0: 3, py4: 3, py5: 3, js0: 3, js4: 2 }, awarded: {}, legacy: {}, attempts: {} };
  const { S } = await boot(memoryStorage(as(v3)));
  assert.deepEqual(S.legacy['py-1'].stars, { py0: 3, py4: 3, py5: 3 }); assert.equal(S.done.py, 0); // Python: old curriculum archived as is
  assert.deepEqual(S.stars, { js0: 3, js5: 2 }); assert.equal(S.done.js, 4); // JavaScript: Pro vault stars moved up one
  assert.equal(S.legacy['js-2'], undefined);
});

test('if the backup before the v3 → v4 upgrade fails, the original save is never overwritten', async () => {
  const v3 = { ...V1.jsOne, v: 3, done: { py: 0, js: 4 }, stars: { js4: 2 }, curriculum: { py: 'py-2', js: 'js-2' }, awarded: {}, legacy: {}, attempts: {} }, text = JSON.stringify(v3);
  const st = memoryStorage(as(v3), k => k.includes('.backup'));
  const { S, save } = await boot(st);
  assert.deepEqual(S.stars, { js5: 2 }); // the session sees the upgraded save…
  S.xp += 1; save();
  assert.equal(st.getItem('vaultquest:jsone'), text); // …but the original stays untouched
});
