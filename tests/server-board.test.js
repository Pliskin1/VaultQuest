// Unit tests for server/board.js (in-memory leaderboard persisted to a JSON file).
// Every module instance points LEADERBOARD_FILE at a throwaway temp file; server/data/ is never touched.
// Extra instances are created with a cache-busting query (?inst=N) so each one reads its own file at import.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD_URL = pathToFileURL(path.join(ROOT, 'server', 'board.js')).href;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vq-board-'));
// Nested, not-yet-existing directory: persist() must create it.
const FILE = path.join(TMP, 'main', 'data', 'leaderboard.json');

// Count real file writes (board.js imports writeFileSync as a live ESM binding).
const realWriteFileSync = fs.writeFileSync;
const writes = [];
fs.writeFileSync = function (file, ...rest) { writes.push(path.resolve(String(file))); return realWriteFileSync.call(this, file, ...rest); };
syncBuiltinESMExports();
// Saves are atomic: written to <file>.tmp, then renamed over <file>.
const writesTo = f => writes.filter(w => w === path.resolve(f) || w === path.resolve(f) + '.tmp').length;
const noAt = p => { const { at, ...rest } = p; assert.equal(typeof at, 'number'); return rest; };

process.env.LEADERBOARD_FILE = FILE;
const { submit, board } = await import(BOARD_URL);
const { RIVALS } = await import(pathToFileURL(path.join(ROOT, 'src', 'content', 'leaderboard.js')).href);
const { weekKey } = await import(pathToFileURL(path.join(ROOT, 'src', 'core', 'rank.js')).href);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const FLUSH = 1250; // persist() writes 1 s after the first unsaved change
const me = (b, name) => b(name).all.me;
const weekMe = (b, name) => b(name).week.me;
const total = b => b(null).total;

let inst = 0;
// Fresh module instance reading `file` (written with `contents` first unless undefined).
async function freshBoard(contents, file = path.join(fs.mkdtempSync(path.join(TMP, 'inst-')), 'leaderboard.json')) {
  if (contents !== undefined) fs.writeFileSync(file, contents);
  process.env.LEADERBOARD_FILE = file;
  try { return { ...(await import(`${BOARD_URL}?inst=${++inst}`)), file }; }
  finally { process.env.LEADERBOARD_FILE = FILE; }
}
const player = (name, xp, extra = {}) => ({ name, xp, wk: 0, week: weekKey(), pro: false, vaults: 1, streak: 1, ...extra });

after(async () => {
  await sleep(FLUSH + 200); // let every pending debounced write land before deleting the temp dir
  fs.writeFileSync = realWriteFileSync;
  syncBuiltinESMExports();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('starts with only the rivals when the leaderboard file does not exist', () => {
  assert.equal(fs.existsSync(FILE), false);
  const b = board(null);
  assert.equal(b.total, RIVALS.length);
  assert.equal(b.all.me, null);
  assert.equal(b.week.me, null);
});

test('valid submit appears on the board with clamped / coerced fields', () => {
  submit({ name: 'Clamp_Max', xp: 5e6, wk: 2.5e6, pro: 'yes', vaults: 150, streak: 1e5 });
  assert.deepEqual(
    (({ name, xp, pro, vaults, streak, score, rank, me }) => ({ name, xp, pro, vaults, streak, score, rank, me }))(me(board, 'Clamp_Max')),
    { name: 'Clamp_Max', xp: 1e6, pro: false, vaults: 99, streak: 9999, score: 1e6, rank: 1, me: true });
  assert.equal(weekMe(board, 'Clamp_Max').score, 1e6);

  submit({ name: 'Clamp_Min', xp: -50, wk: -1, pro: 0, vaults: -3, streak: -9 });
  let m = me(board, 'Clamp_Min');
  assert.deepEqual([m.xp, m.pro, m.vaults, m.streak, weekMe(board, 'Clamp_Min').score], [0, false, 0, 0, 0]);

  submit({ name: 'Floats', xp: 1234.99, wk: 10.7, vaults: 3.9, streak: 2.2, pro: 1 });
  m = me(board, 'Floats');
  assert.deepEqual([m.xp, m.pro, m.vaults, m.streak, weekMe(board, 'Floats').score], [1234, false, 3, 2, 10], 'pro only when literally true');
  submit({ name: 'RealPro', xp: 5, pro: true });
  assert.equal(me(board, 'RealPro').pro, true);

  submit({ name: 'NaNs', xp: 0, wk: NaN, vaults: {}, streak: undefined, pro: undefined });
  m = me(board, 'NaNs');
  assert.deepEqual([m.xp, m.pro, m.vaults, m.streak, weekMe(board, 'NaNs').score], [0, false, 0, 0, 0]);
  // xp must be a finite number: otherwise the submit is ignored (a bare name can't zero a player)
  for (const xp of ['abc', '4200', NaN, Infinity, null, undefined, {}]) submit({ name: 'BadXp', xp });
  assert.equal(me(board, 'BadXp'), null);

  submit({ name: 'Strings', xp: 4200, wk: ' 77 ', vaults: '5', streak: '6', pro: '' });
  m = me(board, 'Strings');
  assert.deepEqual([m.xp, m.pro, m.vaults, m.streak, weekMe(board, 'Strings').score], [4200, false, 5, 6, 77]);

  submit({ name: 'Infinite', xp: 5e9, wk: -Infinity, vaults: 1e309, streak: -1e309 });
  m = me(board, 'Infinite');
  assert.deepEqual([m.xp, m.vaults, m.streak, weekMe(board, 'Infinite').score], [1e6, 99, 0, 0]);

  // Only the explicitly whitelisted fields are kept (checked again in the persisted file below).
  submit({ name: 'Extra', xp: 1, evil: '<img src=x onerror=alert(1)>', admin: true, rank: 1, ...JSON.parse('{"__proto__":{"polluted":1}}') });
  assert.equal(me(board, 'Extra').xp, 1);
  assert.equal({}.polluted, undefined);
});

test('the server stamps its own week; a stale client week does not zero weekly XP', () => {
  submit({ name: 'OldClock', xp: 500, wk: 120, week: '1999-01-04' });
  assert.equal(weekMe(board, 'OldClock').score, 120);
});

test('invalid handles are ignored', () => {
  const before = total(board);
  const bad = ['a', 'a'.repeat(17), 'has space', 'ä', 'bä_user', '<script>', '<script>alert(1)</script>', '', 'abc\n', 'ab.cd', '../etc', 'ab/cd', 'a\u0000b'];
  submit({ name: String.fromCharCode(0x212A) + 'ira_dev', xp: 999999 }); // Kelvin sign: lowercases to ASCII "k", must still be rejected
  for (const name of bad) submit({ name, xp: 999999 });
  for (const name of [12345, null, undefined, true, ['abc'], { toString: () => 'abc' }, new String('abcd')]) submit({ name, xp: 999999 });
  submit({ xp: 999999 }); // missing name
  assert.equal(total(board), before, 'no invalid handle may be added');
  for (const name of bad) assert.equal(me(board, name), null, `"${name}" must not be on the board`);
  assert.ok(!board(null).all.top.some(r => r.xp === 999999), 'no ignored submit reached the board');
});

test('handle length boundaries (2 and 16) and the allowed punctuation are accepted', () => {
  for (const name of ['ab', 'A'.repeat(16), 'a-b_C9']) {
    submit({ name, xp: 7 });
    assert.equal(me(board, name)?.xp, 7, name);
  }
});

test('handles that look like Object.prototype keys behave like normal players', () => {
  for (const [i, name] of ['__proto__', 'constructor', 'hasOwnProperty', 'toString'].entries()) {
    submit({ name, xp: 100 + i });
    assert.equal(me(board, name)?.xp, 100 + i, name);
  }
  assert.equal({}.xp, undefined);
  assert.equal(typeof {}.hasOwnProperty, 'function');
});

test('case-insensitive upsert updates the display name and does not duplicate', () => {
  submit({ name: 'CaseUser', xp: 100, wk: 5 });
  const n = total(board);
  submit({ name: 'CASEUSER', xp: 300, wk: 9 });
  assert.equal(total(board), n);
  for (const lookup of ['caseuser', 'CaseUser', 'CASEUSER']) {
    const m = me(board, lookup);
    assert.equal(m.name, 'CASEUSER');
    assert.equal(m.xp, 300);
  }
  assert.equal(weekMe(board, 'caseuser').score, 9);
});

test('a real player using a rival handle replaces the rival (no duplicate)', () => {
  const rival = RIVALS.find(r => r.name === 'Mira');
  assert.ok(rival, 'fixture: rival Mira exists');
  const n = total(board);
  submit({ name: 'mira', xp: 10, wk: 0, pro: false, vaults: 0, streak: 1 });
  assert.equal(total(board), n, 'rival removed, real player added');
  const m = me(board, 'MIRA');
  assert.deepEqual([m.name, m.xp, m.pro, m.vaults], ['mira', 10, false, 0]);
  assert.equal(weekMe(board, 'Mira').score, 0, 'rival weekly XP must not leak into the real player');
  assert.ok(!board(null).all.top.some(r => r.name === 'Mira' && r.xp === rival.xp), 'rival row is gone');
});

test('persistence: deferred, at most one write per second, file holds the players as JSON', async () => {
  await sleep(FLUSH); // flush anything pending from earlier tests
  const c0 = writesTo(FILE);
  assert.ok(c0 >= 1, 'earlier submits were saved');
  for (let i = 0; i < 25; i++) submit({ name: 'Burst', xp: i, wk: i });
  assert.equal(writesTo(FILE), c0, 'write is deferred');
  await sleep(FLUSH);
  assert.equal(writesTo(FILE), c0 + 1, '25 submits within a second → one write');

  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.ok(Array.isArray(saved));
  const byKey = new Map(saved.map(p => [p.name.toLowerCase(), p]));
  assert.equal(byKey.size, saved.length, 'one entry per handle (case-insensitive)');
  assert.deepEqual(noAt(byKey.get('burst')), { name: 'Burst', xp: 24, wk: 24, week: weekKey(), pro: false, vaults: 0, streak: 0 });
  assert.deepEqual(noAt(byKey.get('extra')), { name: 'Extra', xp: 1, wk: 0, week: weekKey(), pro: false, vaults: 0, streak: 0 }, 'unknown fields dropped');
  assert.equal(byKey.get('oldclock').week, weekKey(), 'week stamped by the server');
  assert.equal(byKey.get('caseuser').name, 'CASEUSER');
  assert.equal(byKey.get('mira').xp, 10);
  assert.equal(byKey.get('clamp_max').xp, 1e6);
  assert.ok(byKey.has('__proto__'));
  assert.ok(saved.every(p => /^[A-Za-z0-9_\-]{2,16}$/.test(p.name)), 'only valid handles persisted');
  assert.ok(!saved.some(p => p.name === 'NeoByte'), 'rivals are not persisted');
  assert.equal(saved.length, total(board) - (RIVALS.length - 1), 'every real player saved (mira replaced a rival)');

  submit({ name: 'Burst', xp: 99 });
  await sleep(FLUSH);
  assert.equal(writesTo(FILE), c0 + 2, 'a later change triggers the next write');
  assert.equal(JSON.parse(fs.readFileSync(FILE, 'utf8')).find(p => p.name === 'Burst').xp, 99);
});

test('a new instance loads the saved file on startup (round trip)', async () => {
  const copy = path.join(fs.mkdtempSync(path.join(TMP, 'copy-')), 'leaderboard.json');
  fs.copyFileSync(FILE, copy);
  const b2 = await freshBoard(undefined, copy);
  assert.deepEqual(b2.board('caseuser'), board('caseuser'));
  assert.deepEqual(b2.board(null), board(null));
});

test('loads an existing file; loaded handles are upserted case-insensitively', async () => {
  const b2 = await freshBoard(JSON.stringify([
    player('Loaded_Top', 999999, { wk: 50, pro: true, vaults: 8, streak: 3 }),
    player('loaded_two', 20),
    player('Old_Week', 3000, { wk: 900, week: '2020-01-06' })
  ]));
  assert.equal(b2.board(null).total, RIVALS.length + 3);
  const m = b2.board('loaded_top').all.me;
  assert.deepEqual([m.name, m.xp, m.rank, m.pro, m.vaults, m.streak], ['Loaded_Top', 999999, 1, true, 8, 3]);
  assert.equal(b2.board('Loaded_Top').week.me.score, 50);
  assert.equal(b2.board('old_week').week.me.score, 0, 'weekly XP from a past week does not count');
  b2.submit({ name: 'LOADED_TWO', xp: 21 });
  assert.equal(b2.board(null).total, RIVALS.length + 3);
  assert.equal(b2.board('loaded_two').all.me.name, 'LOADED_TWO');
});

test('missing or corrupt files start empty without crashing, and the next save writes valid JSON', async () => {
  const missing = await freshBoard(undefined);
  assert.equal(missing.board(null).total, RIVALS.length);
  for (const contents of ['{not json', '', 'null', '{"a":1}', '42', '"str"', '[1,2]', '[null]', '\u0000\u0001garbage']) {
    const b2 = await freshBoard(contents);
    assert.equal(b2.board(null).total, RIVALS.length, JSON.stringify(contents));
  }
  const b3 = await freshBoard('{truncated');
  b3.submit({ name: 'After_Corrupt', xp: 5 });
  await sleep(FLUSH);
  assert.ok(JSON.parse(fs.readFileSync(b3.file, 'utf8')).some(p => p.name === 'After_Corrupt'));
});

test('a failing save is logged and does not crash or lose in-memory data', async t => {
  const blocker = path.join(TMP, 'not-a-dir');
  fs.writeFileSync(blocker, 'x'); // parent "directory" is a file → mkdir/write fail
  const warn = t.mock.method(console, 'warn', () => {});
  const b2 = await freshBoard(undefined, path.join(blocker, 'sub', 'leaderboard.json'));
  b2.submit({ name: 'Unsaved', xp: 42 });
  await sleep(FLUSH);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /\[board\] save failed/);
  assert.equal(b2.board('unsaved').all.me.xp, 42);
});

test('5000-player cap: a newcomer replaces the player who saved longest ago; existing handles still update', async () => {
  const b2 = await freshBoard(undefined);
  for (let i = 0; i < 5000; i++) b2.submit({ name: 'p' + i, xp: i });
  assert.equal(b2.board(null).total, RIVALS.length + 5000);
  b2.submit({ name: 'newcomer', xp: 1e6 });
  assert.equal(b2.board('newcomer').all.me.xp, 1e6, 'newcomers are never locked out');
  assert.equal(b2.board('p0').all.me, null, 'oldest save evicted');
  assert.equal(b2.board(null).total, RIVALS.length + 5000);
  b2.submit({ name: 'mira', xp: 1e6 }); // rival handle: real player replaces the rival, p1 makes room
  assert.equal(b2.board('p1').all.me, null);
  assert.equal(b2.board(null).total, RIVALS.length - 1 + 5000);
  b2.submit({ name: 'P42', xp: 777777 });
  const m = b2.board('p42').all.me;
  assert.deepEqual([m.name, m.xp, m.rank], ['P42', 777777, 3]);
  assert.equal(b2.board(null).total, RIVALS.length - 1 + 5000, 'updating an existing handle evicts nobody');
});

test('the cap also counts players loaded from the file', async () => {
  const b2 = await freshBoard(JSON.stringify(Array.from({ length: 5000 }, (_, i) => player('f' + i, i))));
  b2.submit({ name: 'late_joiner', xp: 1 });
  assert.equal(b2.board('late_joiner').all.me?.xp, 1, 'joins by evicting the oldest loaded entry');
  assert.equal(b2.board('f0').all.me, null);
  b2.submit({ name: 'F7', xp: 123456 });
  assert.equal(b2.board('f7').all.me.xp, 123456);
});

// --- Former todo bugs (fixed): bad entries skipped on load, unreadable file kept as a .corrupt-* copy. ---

test('one malformed entry in the file does not discard the valid entries after it', async () => {
  const b2 = await freshBoard(JSON.stringify([player('Good_A', 10), { xp: 5 }, player('Good_B', 20)]));
  assert.equal(b2.board('good_a').all.me?.xp, 10);
  assert.equal(b2.board('good_b').all.me?.xp, 20);
});

test('an unreadable leaderboard file is not silently overwritten (data loss)', async t => {
  t.mock.method(console, 'warn', () => {});
  const original = '[{"name":"Lost_Player","xp":5000' + ' '.repeat(10); // e.g. truncated by a crash mid-write
  const b2 = await freshBoard(original);
  b2.submit({ name: 'Newbie', xp: 1 });
  await sleep(FLUSH);
  const dir = path.dirname(b2.file);
  const kept = fs.readdirSync(dir).some(f => fs.readFileSync(path.join(dir, f), 'utf8').includes('Lost_Player'));
  assert.ok(kept, 'original contents should be kept (backup) or the file left untouched');
});
