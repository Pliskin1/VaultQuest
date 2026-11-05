// Unit tests for weekly XP tracking in src/core/state.js (rollWeek / weekXp / save / resetState).
// Run: node --test tests/week-xp.test.js
// state.js reads `location.search` and localStorage when it is imported, so every scenario stubs those
// globals and imports a *fresh* module instance (a unique ?instance=N query defeats the ESM cache).
// Tests marked { todo: 'BUG: …' } document behaviour we believe is wrong; they run, but don't fail the suite.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const NOW = '2026-11-04T12:00:00.000Z'; // a Wednesday
const CUR = '2026-11-02'; // Monday of NOW's week
const OLD = '2026-10-26'; // previous Monday

// Map-backed Storage stub that records every call.
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const calls = [];
  return {
    calls,
    getItem(k) { calls.push(['get', k]); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { calls.push(['set', k]); map.set(k, String(v)); },
    removeItem(k) { calls.push(['remove', k]); map.delete(k); },
    saved(k) { return map.has(k) ? JSON.parse(map.get(k)) : undefined; } // test helper, not recorded
  };
}

// Storage that must never be touched.
function forbiddenStorage() {
  const calls = [];
  const deny = name => k => { calls.push([name, k]); throw new Error('storage blocked'); };
  return { calls, getItem: deny('get'), setItem: deny('set'), removeItem: deny('remove') };
}

// The baseline also stores `last` (XP at the last save); most tests only care about start/base.
const wkOf = wk => wk && { start: wk.start, base: wk.base };

const freeze = (t, iso = NOW) => t.mock.timers.enable({ apis: ['Date'], now: Date.parse(iso) });

let seq = 0;
async function loadState(opts = {}) {
  const search = opts.search ?? '';
  const storage = 'storage' in opts ? opts.storage : memoryStorage(); // { storage: undefined } = no localStorage at all
  globalThis.location = { search };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  const mod = await import(`../src/core/state.js?instance=${++seq}`);
  return { ...mod, storage };
}

// A saved profile as state.js writes it (only the fields that matter here).
const profile = (name, xp, wk, extra = {}) => ({ name, lang: 'py', xp, done: { py: 0, js: 0 }, streak: 2, lastDay: '2026-11-03', wk, ...extra });

describe('weekXp', () => {
  test('brand-new profile: 0, then grows with S.xp', async (t) => {
    freeze(t);
    const st = await loadState();
    assert.equal(st.currentUser(), null);
    assert.equal(st.weekXp(), 0, 'before login');
    st.login('alice');
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 0 });
    assert.equal(st.weekXp(), 0);
    st.S.xp += 50;
    assert.equal(st.weekXp(), 50);
    st.S.xp += 70;
    assert.equal(st.weekXp(), 120);
    assert.equal(st.S.wk.base, 0, 'baseline does not move inside the week');
  });

  test('saved profile from an older week: baseline resets to current XP on load', async (t) => {
    freeze(t);
    const storage = memoryStorage({
      'vaultquest:user': 'bob',
      'vaultquest:users': ['bob'],
      'vaultquest:bob': profile('bob', 1500, { start: OLD, base: 900 })
    });
    const st = await loadState({ storage });
    assert.equal(st.currentUser(), 'bob');
    assert.equal(st.S.xp, 1500);
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 1500 });
    assert.equal(st.weekXp(), 0, 'last week\'s 600 XP does not carry over');
    st.S.xp += 40;
    assert.equal(st.weekXp(), 40);
  });

  test('older-week profile opened via login() (case-insensitive key) also resets', async (t) => {
    freeze(t);
    const storage = memoryStorage({ 'vaultquest:users': ['bob'], 'vaultquest:bob': profile('bob', 800, { start: OLD, base: 100 }) });
    const st = await loadState({ storage });
    st.login('Bob');
    assert.equal(st.S.xp, 800);
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 800 });
    assert.equal(st.weekXp(), 0);
  });

  test('saved profile from the current week keeps its baseline', async (t) => {
    freeze(t);
    const storage = memoryStorage({ 'vaultquest:user': 'cleo', 'vaultquest:cleo': profile('cleo', 1500, { start: CUR, base: 1200 }) });
    const st = await loadState({ storage });
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 1200 });
    assert.equal(st.weekXp(), 300);
  });

  test('profile saved before weekly XP existed (no wk field): baseline = current XP', async (t) => {
    freeze(t);
    const legacy = profile('dora', 2222, undefined);
    delete legacy.wk;
    const storage = memoryStorage({ 'vaultquest:user': 'dora', 'vaultquest:dora': legacy });
    const st = await loadState({ storage });
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 2222 });
    assert.equal(st.weekXp(), 0);
  });

  test('week rolls over during a session: Monday 00:00 UTC starts again from 0', async (t) => {
    freeze(t, '2026-11-08T22:00:00.000Z'); // Sunday
    const st = await loadState();
    st.login('eve');
    st.S.xp += 100; st.save(); // the app saves after every XP change
    assert.equal(st.weekXp(), 100);
    assert.equal(st.S.wk.start, '2026-11-02');
    t.mock.timers.setTime(Date.parse('2026-11-08T23:59:59.999Z'));
    assert.equal(st.weekXp(), 100, 'still Sunday');
    t.mock.timers.tick(1); // Monday 00:00:00.000 UTC
    assert.equal(st.weekXp(), 0);
    assert.deepEqual(wkOf(st.S.wk), { start: '2026-11-09', base: 100 });
    st.S.xp += 30;
    assert.equal(st.weekXp(), 30);
  });

  test('S.xp dropping below the baseline (level retry / hint penalty) gives 0, never negative', async (t) => {
    freeze(t);
    const storage = memoryStorage({ 'vaultquest:user': 'finn', 'vaultquest:finn': profile('finn', 1000, { start: OLD, base: 0 }) });
    const st = await loadState({ storage });
    assert.equal(st.S.wk.base, 1000);
    st.S.xp = 1050; // earned 50 in a level...
    assert.equal(st.weekXp(), 50);
    st.S.xp = 940; // ...retry restores the start XP, then a hint costs 10 more (below the baseline)
    const w = st.weekXp();
    assert.equal(w, 0);
    assert.ok(!Object.is(w, -0));
    assert.equal(st.S.wk.base, 1000, 'baseline is not moved by a drop');
    st.S.xp = 1000;
    assert.equal(st.weekXp(), 0);
    st.S.xp = 1060;
    assert.equal(st.weekXp(), 60);
  });

  test('resetState: weekly XP back to 0, and still counts from 0 after the page reload', async (t) => {
    freeze(t);
    const storage = memoryStorage();
    const st = await loadState({ storage });
    st.login('gina');
    st.S.xp = 800; st.save();
    assert.equal(st.weekXp(), 800);
    st.resetState();
    assert.equal(st.S.name, 'gina');
    assert.equal(st.S.xp, 0);
    assert.equal(st.weekXp(), 0);
    assert.equal(storage.saved('vaultquest:gina').xp, 0, 'reset is saved');
    // profile.js reloads the page right after resetState(); simulate that with a fresh module instance.
    const again = await loadState({ storage });
    assert.equal(again.currentUser(), 'gina');
    assert.deepEqual(wkOf(again.S.wk), { start: CUR, base: 0 });
    again.S.xp += 80;
    assert.equal(again.weekXp(), 80);
  });

  // Was a todo bug: resetState left S.wk = null, so the baseline was taken after the XP was added.
  test('resetState without a reload: XP earned before the next weekXp() call still counts', async (t) => {
    freeze(t);
    const st = await loadState();
    st.login('hank');
    st.S.xp = 500;
    st.resetState();
    st.S.xp += 80; // e.g. a vault cracked; level.js adds XP, then fetchBoard() calls weekXp()
    assert.equal(st.weekXp(), 80);
  });

  // Was a todo bug: the new week's baseline was taken at the first weekXp() call, after the vault bonus.
  test('XP earned after a mid-session week rollover counts for the new week', async (t) => {
    freeze(t, '2026-11-08T23:00:00.000Z'); // Sunday evening
    const st = await loadState();
    st.login('ivy');
    st.S.xp = 300; st.save();
    assert.equal(st.weekXp(), 300);
    t.mock.timers.setTime(Date.parse('2026-11-09T00:10:00.000Z')); // Monday
    st.S.xp += 200; st.save(); // vault cracked on Monday (level.js: add XP, save, then fetchBoard)
    assert.equal(st.weekXp(), 200);
  });

  test('rollover with XP added but not yet saved still counts that XP for the new week', async (t) => {
    freeze(t, '2026-11-08T23:00:00.000Z');
    const st = await loadState();
    st.login('ivo2');
    st.S.xp = 300; st.save();
    t.mock.timers.setTime(Date.parse('2026-11-09T00:10:00.000Z'));
    st.S.xp += 50; // weekXp() called before the save
    assert.equal(st.weekXp(), 50);
  });
});

describe('weekXp in demo mode (?demo=1)', () => {
  test('works without touching storage', async (t) => {
    freeze(t);
    const storage = forbiddenStorage();
    const st = await loadState({ search: '?demo=1', storage });
    assert.equal(st.DEMO, true);
    assert.equal(st.DEMO_MODE, '1');
    assert.equal(st.S.name, 'DEMO');
    assert.equal(st.currentUser(), 'demo');
    assert.equal(st.weekXp(), 0);
    assert.deepEqual(wkOf(st.S.wk), { start: CUR, base: 0 });
    st.S.xp += 120;
    assert.equal(st.weekXp(), 120);
    st.save();
    st.login('someone');
    assert.equal(st.S.name, 'DEMO', 'login is a no-op in demo mode');
    assert.equal(st.weekXp(), 120);
    st.resetState();
    assert.equal(st.weekXp(), 0);
    assert.deepEqual(storage.calls, [], 'storage was never touched');
  });

  test('imports and works when localStorage does not exist at all', async (t) => {
    freeze(t);
    const st = await loadState({ search: '?demo=1', storage: undefined });
    assert.equal(globalThis.localStorage, undefined);
    assert.equal(st.DEMO, true);
    assert.equal(st.weekXp(), 0);
    st.S.xp += 50;
    assert.equal(st.weekXp(), 50);
    assert.doesNotThrow(() => { st.save(); st.login('x'); st.resetState(); });
    assert.equal(st.weekXp(), 0);
  });

  test('ignores a stored profile', async (t) => {
    freeze(t);
    const storage = memoryStorage({ 'vaultquest:user': 'bob', 'vaultquest:bob': profile('bob', 1500, { start: CUR, base: 0 }) });
    const st = await loadState({ search: '?demo', storage });
    assert.equal(st.DEMO, true);
    assert.equal(st.S.xp, 0);
    assert.equal(st.weekXp(), 0);
    assert.deepEqual(storage.calls, []);
  });

  // Was a todo bug: demo state started with wk = null.
  test('XP earned in the demo before the first weekXp() call counts as weekly XP', async (t) => {
    freeze(t);
    const st = await loadState({ search: '?demo=1', storage: forbiddenStorage() });
    st.S.xp += 120;
    assert.equal(st.weekXp(), 120);
  });
});

describe('weekly baseline persistence', () => {
  test('login() saves the baseline with the profile', async (t) => {
    freeze(t);
    const storage = memoryStorage();
    const st = await loadState({ storage });
    st.login('jade');
    assert.deepEqual(wkOf(storage.saved('vaultquest:jade').wk), { start: CUR, base: 0 });
    assert.equal(storage.saved('vaultquest:user'), 'jade');
    assert.deepEqual(storage.saved('vaultquest:users'), ['jade']);
  });

  test('a saved baseline survives a reload, so weekly XP is not wiped', async (t) => {
    freeze(t);
    const storage = memoryStorage();
    const st = await loadState({ storage });
    st.login('kai');
    st.S.xp += 200; st.save();
    const again = await loadState({ storage });
    assert.equal(again.S.xp, 200);
    assert.equal(again.weekXp(), 200);
  });

  test('a rolled-over baseline is written on the next save()', async (t) => {
    freeze(t);
    const storage = memoryStorage();
    const st = await loadState({ storage });
    st.login('lou');
    st.S.xp = 200; st.save();
    t.mock.timers.setTime(Date.parse('2026-11-09T08:00:00.000Z')); // next Monday
    assert.equal(st.weekXp(), 0);
    assert.equal(storage.saved('vaultquest:lou').wk.start, CUR, 'weekXp() itself does not write');
    st.save();
    assert.deepEqual(wkOf(storage.saved('vaultquest:lou').wk), { start: '2026-11-09', base: 200 });
    // ...and a reload later that week keeps counting from that baseline.
    st.S.xp = 260; st.save();
    const again = await loadState({ storage });
    assert.equal(again.weekXp(), 60);
  });

  test('profiles() exposes the saved baseline for the offline board', async (t) => {
    freeze(t);
    const storage = memoryStorage();
    const st = await loadState({ storage });
    st.login('mo');
    st.S.xp = 70; st.save();
    const p = st.profiles().find(x => x.name === 'mo');
    assert.deepEqual(wkOf(p.wk), { start: CUR, base: 0 });
    assert.equal(p.xp, 70);
  });
});
