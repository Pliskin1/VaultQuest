// Tests for the client leaderboard data layer (src/ui/board.js → fetchBoard()).
// state.js reads location / localStorage at import, so browser globals are stubbed BEFORE the dynamic import.
// Scenarios that need different import-time globals (demo mode, no player, blocked storage) run in a child process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { weekKey } from '../src/core/rank.js'; // pure module, safe to import statically
import { RIVALS } from '../src/content/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD_URL = pathToFileURL(path.join(ROOT, 'src', 'ui', 'board.js')).href;
const WK = weekKey();
const TODAY = new Date().toISOString().slice(0, 10);

const setGlobal = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });

// --- saved profiles on "this device" ---------------------------------------------------------------
// Current player is CUR = "alice"; her saved state still carries the old display case "Alice".
const SAVED = {
  alice: { name: 'Alice', lang: 'py', xp: 5000, done: { py: 3, js: 2 }, stars: {}, ach: [], streak: 4, lastDay: TODAY, questions: 0, pro: true, projects: [], wk: { start: WK, base: 4600 } },
  bob_2: { name: 'Bob_2', xp: 9000, done: { py: 8, js: 8 }, streak: 7, pro: true, wk: { start: WK, base: 8000 } },
  oldweek: { name: 'OldWeek', xp: 9500, done: { py: 2, js: 1 }, streak: 3, pro: false, wk: { start: '2020-01-06', base: 0 } },
  nowk: { name: 'NoWk', xp: 100, done: { py: 1 }, wk: null }
  // "ghost" is listed in users but has no saved state
};
const USERS = ['Alice', 'Bob_2', 'OldWeek', 'NoWk', 'ghost'];
const storageFor = (cur, users = USERS, saved = SAVED) => ({
  'vaultquest:users': JSON.stringify(users),
  ...(cur ? { 'vaultquest:user': JSON.stringify(cur) } : {}),
  ...Object.fromEntries(Object.entries(saved).map(([k, v]) => ['vaultquest:' + k, JSON.stringify(v)]))
});

const store = new Map(Object.entries(storageFor('alice')));
setGlobal('location', { search: '' });
setGlobal('localStorage', {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); }
});
const calls = [];
let respond = () => { throw new Error('fetch handler not set'); };
setGlobal('fetch', (url, init) => { calls.push({ url, init }); return respond(url, init); });

const { fetchBoard } = await import(BOARD_URL);
const { S } = await import(pathToFileURL(path.join(ROOT, 'src', 'core', 'state.js')).href);

const jsonResponse = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
const SERVER_BOARD = { total: 99, all: { top: [{ name: 'srv', rank: 1 }], me: null, above: null }, week: { top: [], me: null, above: null } };
function reset(handler) { calls.length = 0; respond = handler; }
const row = (board, name) => board.top.find(r => r.name.toLowerCase() === name.toLowerCase());
// Local board expected for the fixture above (11 rivals + 4 other profiles + alice).
const LOCAL_TOTAL = RIVALS.length + 5;
function assertLocal(r) {
  assert.equal(r.live, false);
  assert.equal(r.total, LOCAL_TOTAL);
  assert.equal(r.all.me.name, 'alice');
  assert.equal(row(r.all, 'Bob_2').xp, 9000);
}

test('import-time state: current player loaded from saved profile', () => {
  assert.equal(S.name, 'alice');
  assert.equal(S.xp, 5000);
  assert.equal(S.streak, 4);
});

test('fetch ok → live board, request carries this player\'s entry', async () => {
  reset(() => jsonResponse({ ...SERVER_BOARD, extra: 'kept' }));
  const r = await fetchBoard();
  assert.deepEqual(r, { ...SERVER_BOARD, extra: 'kept', live: true });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, '/api/leaderboard');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { name: 'alice', xp: 5000, wk: 400, week: WK, pro: true, vaults: 5, streak: 4 });
  assert.ok(init.signal instanceof AbortSignal, 'request is abortable (timeout)');
  assert.equal(init.signal.aborted, false);
});

test('a server body claiming live: false is still marked live', async () => {
  reset(() => jsonResponse({ ...SERVER_BOARD, live: false }));
  assert.equal((await fetchBoard()).live, true);
});

test('fetch non-ok (500 / 404 / 429) → local board, live: false', async () => {
  for (const status of [500, 404, 429]) {
    reset(() => jsonResponse(SERVER_BOARD, status));
    const r = await fetchBoard();
    assert.equal(calls.length, 1);
    assertLocal(r);
  }
});

test('fetch rejects or throws synchronously → local board', async () => {
  reset(() => Promise.reject(new TypeError('Failed to fetch')));
  assertLocal(await fetchBoard());
  reset(() => { throw new TypeError('sync failure'); });
  assertLocal(await fetchBoard());
});

test('ok response with a malformed body → local board', async () => {
  const bodies = [
    { total: 1, all: SERVER_BOARD.all },        // missing week
    { total: 1, week: SERVER_BOARD.week },      // missing all
    { total: 1, all: null, week: SERVER_BOARD.week },
    null, [], 'oops', 42
  ];
  for (const body of bodies) {
    reset(() => jsonResponse(body));
    assertLocal(await fetchBoard());
  }
  reset(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')) }));
  assertLocal(await fetchBoard());
});

test('local board: other saved profiles are included with correct weekly XP, current player once, live entry used', async () => {
  const prevXp = S.xp;
  S.xp = 5200; // XP earned this session, not yet in the saved profile
  try {
    reset(() => Promise.reject(new TypeError('offline')));
    const r = await fetchBoard();
    assert.equal(r.live, false);
    assert.equal(r.total, LOCAL_TOTAL, '11 rivals + 4 other profiles + me (no duplicate of the saved "Alice")');
    assert.equal(r.all.top.filter(x => x.name.toLowerCase() === 'alice').length, 1);

    // all-time: OldWeek 9500, Bob_2 9000, alice 5200, then rivals
    assert.deepEqual(r.all.top.slice(0, 3).map(x => [x.name, x.score, x.rank]), [['OldWeek', 9500, 1], ['Bob_2', 9000, 2], ['alice', 5200, 3]]);
    assert.deepEqual(r.all.me, { name: 'alice', pro: true, xp: 5200, vaults: 5, streak: 4, score: 5200, rank: 3, move: 0, me: true });
    assert.equal(r.all.above.name, 'Bob_2');
    const bob = row(r.all, 'Bob_2');
    assert.deepEqual([bob.pro, bob.vaults, bob.streak, bob.me], [true, 16, 7, false]);
    const old = row(r.all, 'OldWeek');
    assert.deepEqual([old.vaults, old.streak], [3, 3]);
    assert.equal(old.move, 0, 'OldWeek had 0 weekly XP, so its start-of-week rank equals its rank now');

    // weekly: Bob_2 1000 (current week), alice 600 (live), OldWeek's stale baseline counts 0
    assert.deepEqual([r.week.top[0].name, r.week.top[0].score], ['Bob_2', 1000]);
    assert.equal(r.week.me.score, 600);
    const wkAbove = RIVALS.filter(x => x.wk > 600).length + 1; // + Bob_2
    assert.equal(r.week.me.rank, wkAbove + 1);
    assert.ok(!row(r.week, 'OldWeek'), 'stale-week profile must not reach the weekly top 10 with its total XP');
    assert.ok(!row(r.week, 'NoWk') && !row(r.week, 'ghost'));
  } finally { S.xp = prevXp; }
});

test('local board, every row (rivals temporarily removed): defaults for missing state / streak / wk', async () => {
  const rivals = RIVALS.splice(0); // RIVALS is shared with rank.js; restored below
  try {
    reset(() => jsonResponse({}, 503));
    const r = await fetchBoard();
    assert.equal(r.live, false);
    assert.equal(r.total, 5);
    const R = (name, pro, xp, vaults, streak, score, rank, me = false) => ({ name, pro, xp, vaults, streak, score, rank, move: 0, me });
    assert.deepEqual(r.all.top, [
      R('OldWeek', false, 9500, 3, 3, 9500, 1),
      R('Bob_2', true, 9000, 16, 7, 9000, 2),
      R('alice', true, 5000, 5, 4, 5000, 3, true),
      R('NoWk', false, 100, 1, 1, 100, 4),     // no streak saved → 1
      R('ghost', false, 0, 0, 1, 0, 5)         // listed user without saved state
    ]);
    assert.deepEqual(r.week.top.map(x => [x.name, x.score, x.rank]),
      [['Bob_2', 1000, 1], ['alice', 400, 2], ['ghost', 0, 3], ['NoWk', 0, 4], ['OldWeek', 0, 5]]);
    assert.equal(r.week.above.name, 'Bob_2');
  } finally { RIVALS.push(...rivals); }
});

// Was a todo bug: a non-string entry in vaultquest:users made localBoard() throw outside the try.
test('fetchBoard never rejects, even with a corrupted saved profile list', async () => {
  const prev = new Map(store);
  store.set('vaultquest:users', JSON.stringify([null, 'Bob_2', 42]));
  try {
    reset(() => Promise.reject(new Error('offline')));
    const r = await fetchBoard();
    assert.equal(r.live, false);
    assert.equal(r.all.me.name, 'alice');
  } finally { store.clear(); for (const [k, v] of prev) store.set(k, v); }
});

test('timeout: request is aborted after 6 s and the local board is returned', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  reset((_, init) => {
    signal = init.signal;
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  });
  const p = fetchBoard();
  assert.ok(signal instanceof AbortSignal);
  t.mock.timers.tick(5999);
  assert.equal(signal.aborted, false, 'not aborted before 6 s');
  t.mock.timers.tick(1);
  assert.equal(signal.aborted, true, 'aborted at 6 s');
  assertLocal(await p);
});

test('timeout timer is cleared once the request settles (no late abort)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const handler of [() => jsonResponse(SERVER_BOARD), () => jsonResponse({}, 500), () => Promise.reject(new Error('x'))]) {
    reset(handler);
    await fetchBoard();
    const { signal } = calls[0].init;
    t.mock.timers.tick(10_000);
    assert.equal(signal.aborted, false);
  }
});

test('unreadable saved profile list (invalid JSON) → rivals + me, no rejection', async () => {
  const prev = new Map(store);
  store.set('vaultquest:users', '{not json');
  try {
    reset(() => Promise.reject(new Error('offline')));
    const r = await fetchBoard();
    assert.equal(r.live, false);
    assert.equal(r.total, RIVALS.length + 1, 'unreadable profile list → rivals + me');
  } finally { store.clear(); for (const [k, v] of prev) store.set(k, v); }
});

// --- scenarios with different import-time globals: fresh Node process each -------------------------
const CHILD = `
const cfg = JSON.parse(process.env.VQ_CFG);
const def = (n, v) => Object.defineProperty(globalThis, n, { value: v, configurable: true, writable: true });
const store = new Map(Object.entries(cfg.storage || {}));
let touches = 0;
const blocked = () => { touches++; throw new Error('SecurityError: storage blocked'); };
def('location', { search: cfg.search });
def('localStorage', cfg.blocked ? { getItem: blocked, setItem: blocked, removeItem: blocked } : {
  getItem: k => { touches++; return store.has(k) ? store.get(k) : null; },
  setItem: (k, v) => { touches++; store.set(k, String(v)); },
  removeItem: k => { touches++; store.delete(k); }
});
const calls = [];
def('fetch', async (url, init) => { calls.push({ url, body: init && init.body }); return { ok: true, status: 200, json: async () => ({ total: 1, all: { top: [], me: null, above: null }, week: { top: [], me: null, above: null } }) }; });
const { fetchBoard } = await import(cfg.url);
const r = await fetchBoard();
process.stdout.write(JSON.stringify({ calls, r, touches }));
`;
function runChild(cfg) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', CHILD], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, VQ_CFG: JSON.stringify({ url: BOARD_URL, ...cfg }) }, timeout: 30000
  });
  return JSON.parse(out);
}

test('demo mode (?demo=1): fetch is never called, storage never touched, offline board with DEMO', () => {
  for (const search of ['?demo=1', '?demo', '?demo=pro']) {
    const { calls: c, r, touches } = runChild({ search, storage: storageFor('alice') });
    assert.equal(c.length, 0, search);
    assert.equal(touches, 0, `${search}: demo must not read/write localStorage`);
    assert.equal(r.live, false);
    assert.equal(r.total, RIVALS.length + 1, 'demo shows only rivals + DEMO (no saved profiles)');
    assert.equal(r.all.me.name, 'DEMO');
  }
});

test('no player name (no saved current user): no fetch, local board without "me"', () => {
  const { calls: c, r } = runChild({ search: '', storage: storageFor(null) });
  assert.equal(c.length, 0);
  assert.equal(r.live, false);
  assert.equal(r.all.me, null);
  assert.equal(r.week.me, null);
  assert.equal(r.total, RIVALS.length + USERS.length, 'other saved profiles still shown');
});

test('a logged-in player in a fresh process posts once and gets the live board', () => {
  const { calls: c, r } = runChild({ search: '', storage: storageFor('Bob_2') });
  assert.equal(c.length, 1);
  assert.equal(c[0].url, '/api/leaderboard');
  assert.deepEqual(JSON.parse(c[0].body), { name: 'Bob_2', xp: 9000, wk: 1000, week: WK, pro: true, vaults: 16, streak: 1, });
  assert.equal(r.live, true);
});

test('blocked localStorage (throws on access): no crash, no fetch, rivals-only local board', () => {
  const { calls: c, r } = runChild({ search: '', blocked: true });
  assert.equal(c.length, 0);
  assert.equal(r.live, false);
  assert.equal(r.total, RIVALS.length);
  assert.equal(r.all.me, null);
});
