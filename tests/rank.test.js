// Unit tests for the leaderboard ranking logic in src/core/rank.js (weekKey + buildBoard).
// Run: node --test tests/rank.test.js
// "Now" is frozen with mock.timers so the current week key is deterministic.
// The edge-case probes at the end were todo bugs, now fixed in rank.js (rows normalised, one row per handle, only real players are "me").
import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { weekKey, buildBoard } from '../src/core/rank.js';
import { RIVALS } from '../src/content/leaderboard.js';

const NOW = Date.parse('2026-11-04T12:00:00.000Z'); // a Wednesday
const CUR = '2026-11-02'; // Monday of NOW's week
const OLD = '2026-10-26'; // previous Monday
const key = n => String(n).toLowerCase();
const BIG = 1000; // a `size` large enough to see the whole board

// Every row of a board, in rank order.
const fullBoard = (players, meName) => buildBoard(players, meName, BIG);
const row = (list, name) => list.find(r => r.name === name);
const swapCase = s => [...s].map(c => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');

// Ranking invariant: score descending, ties by name (case-insensitive), ranks 1..n without gaps.
function assertRanked(list) {
  list.forEach((r, i) => assert.equal(r.rank, i + 1, `rank of ${r.name}`));
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    assert.ok(a.score > b.score || (a.score === b.score && key(a.name).localeCompare(key(b.name)) <= 0),
      `${a.name}(${a.score}) should not be ranked above ${b.name}(${b.score})`);
  }
}

// Independent reference: rank = 1 + number of rows that beat this one (no sorting involved).
function refRanks(rows, score) {
  const m = new Map();
  for (const r of rows) {
    const beaten = rows.filter(o => o !== r && (score(o) > score(r) || (score(o) === score(r) && key(o.name).localeCompare(key(r.name)) < 0))).length;
    m.set(key(r.name), beaten + 1);
  }
  return m;
}

describe('weekKey', () => {
  test('every weekday (start, middle and end of day) maps to that week\'s Monday', () => {
    assert.equal(new Date(CUR + 'T00:00:00Z').getUTCDay(), 1, 'sanity: CUR is a Monday');
    for (let d = 0; d < 7; d++) {
      const day = new Date(Date.UTC(2026, 10, 2 + d));
      for (const [h, m, s, ms] of [[0, 0, 0, 0], [12, 34, 56, 0], [23, 59, 59, 999]]) {
        const t = new Date(day); t.setUTCHours(h, m, s, ms);
        assert.equal(weekKey(t), CUR, t.toISOString());
      }
    }
  });

  test('Sunday 23:59:59.999 UTC is the old week, Monday 00:00 UTC starts the new one', () => {
    assert.equal(weekKey(new Date('2026-11-08T23:59:59.999Z')), '2026-11-02');
    assert.equal(weekKey(new Date('2026-11-09T00:00:00.000Z')), '2026-11-09');
    assert.equal(weekKey(new Date('2026-11-09T00:00:00.001Z')), '2026-11-09');
  });

  test('year boundaries roll back into December of the previous year', () => {
    assert.equal(weekKey(new Date('2026-01-01T00:00:00Z')), '2025-12-29'); // Thursday
    assert.equal(weekKey(new Date('2025-12-31T18:00:00Z')), '2025-12-29');
    assert.equal(weekKey(new Date('2026-01-04T23:59:59.999Z')), '2025-12-29'); // Sunday
    assert.equal(weekKey(new Date('2026-01-05T00:00:00Z')), '2026-01-05'); // Monday
    assert.equal(weekKey(new Date('2027-01-01T10:00:00Z')), '2026-12-28'); // Friday
    assert.equal(weekKey(new Date('2020-12-31T10:00:00Z')), '2020-12-28'); // leap-year end
  });

  test('month boundaries and leap days', () => {
    assert.equal(weekKey(new Date('2024-02-29T12:00:00Z')), '2024-02-26');
    assert.equal(weekKey(new Date('2024-03-03T23:00:00Z')), '2024-02-26');
    assert.equal(weekKey(new Date('2026-03-01T05:00:00Z')), '2026-02-23');
    assert.equal(weekKey(new Date('2026-11-01T12:00:00Z')), OLD);
  });

  test('always returns a zero-padded YYYY-MM-DD Monday', () => {
    for (const iso of ['2026-01-07T00:00:00Z', '2026-09-03T00:00:00Z', '2026-03-05T00:00:00Z']) {
      const k = weekKey(new Date(iso));
      assert.match(k, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(k + 'T00:00:00Z').getUTCDay(), 1, `${k} is a Monday`);
    }
  });

  test('instants written with a non-UTC offset are bucketed by their UTC day', () => {
    // Monday 00:30 in UTC+2 is still Sunday 22:30 UTC -> previous week.
    assert.equal(weekKey(new Date('2026-11-09T00:30:00+02:00')), '2026-11-02');
    // Sunday 22:00 in UTC-5 is already Monday 03:00 UTC -> new week.
    assert.equal(weekKey(new Date('2026-11-08T22:00:00-05:00')), '2026-11-09');
    // +14:00 extreme.
    assert.equal(weekKey(new Date('2026-11-09T13:59:59+14:00')), '2026-11-02');
    assert.equal(weekKey(new Date('2026-11-09T14:00:00+14:00')), '2026-11-09');
  });

  test('the process time zone does not shift the result', (t) => {
    const prev = process.env.TZ;
    const instants = [
      ['2026-11-08T23:59:59.999Z', '2026-11-02'],
      ['2026-11-09T00:00:00.000Z', '2026-11-09'],
      ['2026-01-01T00:00:00.000Z', '2025-12-29'],
      ['2026-03-29T01:30:00.000Z', '2026-03-23'] // EU DST switch day (Sunday)
    ];
    // Local "Monday 2026-11-09 00:30" falls on a different UTC day depending on the zone.
    const zones = [
      ['UTC', 0, '2026-11-09'],
      ['Pacific/Kiritimati', -840, '2026-11-02'], // UTC+14 -> Sunday 10:30 UTC
      ['Europe/Berlin', -60, '2026-11-02'], // UTC+1 -> Sunday 23:30 UTC
      ['Asia/Kolkata', -330, '2026-11-02'], // UTC+5:30 -> Sunday 19:00 UTC
      ['America/New_York', 300, '2026-11-09'], // UTC-5 -> Monday 05:30 UTC
      ['Pacific/Pago_Pago', 660, '2026-11-09'] // UTC-11 -> Monday 11:30 UTC
    ];
    try {
      for (const [tz, offset, localMonday] of zones) {
        process.env.TZ = tz;
        const probe = new Date(2026, 10, 9, 0, 30);
        if (probe.getTimezoneOffset() !== offset) { t.skip(`cannot switch process TZ to ${tz} here`); return; }
        for (const [iso, want] of instants) assert.equal(weekKey(new Date(iso)), want, `${iso} in ${tz}`);
        assert.equal(weekKey(probe), localMonday, `local Monday 00:30 in ${tz}`);
      }
    } finally {
      if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
    }
  });

  test('default argument uses the current time', (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: NOW });
    assert.equal(weekKey(), CUR);
    t.mock.timers.setTime(Date.parse('2026-11-08T23:59:59.999Z'));
    assert.equal(weekKey(), CUR);
    t.mock.timers.tick(1);
    assert.equal(weekKey(), '2026-11-09');
  });

  test('does not mutate the Date it is given', () => {
    const d = new Date('2026-11-06T15:00:00Z'), before = d.getTime();
    weekKey(d);
    assert.equal(d.getTime(), before);
  });
});

describe('buildBoard', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: NOW }));
  afterEach(() => mock.timers.reset());

  test('preconditions on the rival content these tests rely on', () => {
    assert.ok(RIVALS.length >= 10, 'need at least 10 rivals to exercise the default top-10');
    assert.equal(new Set(RIVALS.map(r => key(r.name))).size, RIVALS.length, 'rival handles are unique');
    assert.ok(RIVALS.every(r => Number.isFinite(r.xp) && r.xp > 0 && r.xp < 60000), 'rivals have 1..60k XP');
    assert.ok(RIVALS.every(r => Number.isFinite(r.wk) && r.wk > 0 && r.wk < 20000), 'rivals have 1..20k weekly XP');
  });

  test('no real players: only rivals, total = RIVALS.length, nobody is "me"', () => {
    const b = buildBoard([], null);
    assert.equal(b.total, RIVALS.length);
    assert.equal(b.all.top.length, Math.min(10, RIVALS.length));
    for (const board of [b.all, b.week]) {
      assert.equal(board.me, null);
      assert.equal(board.above, null);
      assert.ok(board.top.every(r => r.me === false));
    }
    const all = fullBoard([], null).all.top;
    assert.deepEqual(all.map(r => r.name).sort(), RIVALS.map(r => r.name).sort());
    assertRanked(all);
    // Rivals always count as "this week", so their weekly XP is used.
    const wk = fullBoard([], null).week.top;
    assertRanked(wk);
    for (const r of RIVALS) assert.equal(row(wk, r.name).score, r.wk);
  });

  test('a real player is added and ranked by XP among the rivals', () => {
    const XP = 3000;
    assert.ok(!RIVALS.some(r => r.xp === XP), 'precondition: no rival has exactly 3000 XP');
    const want = 1 + RIVALS.filter(r => r.xp > XP).length;
    const b = buildBoard([{ name: 'Zara', xp: XP, wk: 0, week: CUR, pro: true, vaults: 2, streak: 4 }], 'Zara');
    assert.equal(b.total, RIVALS.length + 1);
    assert.equal(b.all.me.name, 'Zara');
    assert.equal(b.all.me.rank, want);
    assert.equal(b.all.me.score, XP);
    assert.equal(b.all.me.me, true);
    assert.deepEqual([b.all.me.pro, b.all.me.vaults, b.all.me.streak], [true, 2, 4]);
    const sorted = [...RIVALS].sort((a, c) => c.xp - a.xp);
    if (want > 1) {
      assert.equal(b.all.above.rank, want - 1);
      assert.equal(b.all.above.name, sorted[want - 2].name);
    }
    assertRanked(fullBoard([{ name: 'Zara', xp: XP, wk: 0, week: CUR }], 'Zara').all.top);
  });

  test('a real player using a rival\'s handle replaces that rival (case-insensitive), total unchanged', () => {
    const rival = RIVALS[0], handle = swapCase(rival.name);
    assert.notEqual(handle, rival.name);
    const b = fullBoard([{ name: handle, xp: 7, wk: 3, week: CUR, pro: false, vaults: 0, streak: 1 }], handle);
    assert.equal(b.total, RIVALS.length);
    const matches = b.all.top.filter(r => key(r.name) === key(rival.name));
    assert.equal(matches.length, 1, 'exactly one row for that handle');
    assert.equal(matches[0].name, handle, 'the real player keeps its own casing');
    assert.equal(matches[0].xp, 7);
    assert.equal(matches[0].me, true);
    assert.equal(row(b.week.top, handle).score, 3);
    // Every other rival is untouched.
    for (const r of RIVALS.slice(1)) assert.equal(row(b.all.top, r.name).xp, r.xp);
  });

  test('replacing every rival leaves exactly the real players', () => {
    const players = RIVALS.map((r, i) => ({ name: r.name.toUpperCase(), xp: 100 + i, wk: 0, week: CUR }));
    const b = fullBoard(players, null);
    assert.equal(b.total, RIVALS.length);
    assert.ok(b.all.top.every(r => r.name === r.name.toUpperCase()), 'no original rival row left');
    assertRanked(b.all.top);
  });

  test('ties are broken by name, case-insensitively (not by code point)', () => {
    // Code-point order would be Bob, Carl, alice; case-insensitive order is alice, Bob, Carl.
    const players = ['Carl', 'Bob', 'alice'].map(name => ({ name, xp: 1e6, wk: 5e5, week: CUR }));
    const b = buildBoard(players, null);
    assert.deepEqual(b.all.top.slice(0, 3).map(r => [r.name, r.rank]), [['alice', 1], ['Bob', 2], ['Carl', 3]]);
    assert.deepEqual(b.week.top.slice(0, 3).map(r => [r.name, r.rank]), [['alice', 1], ['Bob', 2], ['Carl', 3]]);
  });

  test('a tie with a rival is broken by name too', () => {
    const rival = RIVALS[0];
    assert.ok(key(rival.name) > 'aaa' && key(rival.name) < 'zzz', 'precondition on rival name');
    const b = fullBoard([
      { name: 'zzz', xp: rival.xp, wk: 0, week: CUR },
      { name: 'aaa', xp: rival.xp, wk: 0, week: CUR }
    ], null);
    const r = n => row(b.all.top, n).rank;
    assert.equal(r('aaa') + 1, r(rival.name));
    assert.equal(r(rival.name) + 1, r('zzz'));
  });

  test('ranks are 1..n with no gaps on both boards, every row exactly once', () => {
    const players = [
      { name: 'tie1', xp: 1985, wk: 410, week: CUR },
      { name: 'Tie2', xp: 1985, wk: 410, week: CUR },
      { name: 'zero', xp: 0, wk: 0, week: CUR },
      { name: 'old', xp: 5000, wk: 4000, week: OLD }
    ];
    const b = fullBoard(players, 'zero');
    for (const board of [b.all, b.week]) {
      assert.equal(board.top.length, b.total);
      assert.deepEqual(board.top.map(r => r.rank), Array.from({ length: b.total }, (_, i) => i + 1));
      assert.equal(new Set(board.top.map(r => key(r.name))).size, b.total);
      assertRanked(board.top);
    }
  });

  test('matches an independent "count who beats you" ranking model', () => {
    const players = [
      { name: 'Ana', xp: 2550, wk: 2000, week: CUR },
      { name: 'bea', xp: 1340, wk: 100, week: OLD },
      { name: 'Cid', xp: 9999, wk: 9999, week: CUR },
      { name: 'dan', xp: 1, wk: 1, week: CUR }
    ];
    const rows = [
      ...RIVALS.map(r => ({ ...r, wk: r.wk })),
      ...players.map(p => ({ ...p, wk: p.week === CUR ? p.wk : 0 }))
    ];
    const b = fullBoard(players, null);
    const refAll = refRanks(rows, r => r.xp), refWeek = refRanks(rows, r => r.wk), refBefore = refRanks(rows, r => r.xp - r.wk);
    for (const r of b.all.top) {
      assert.equal(r.rank, refAll.get(key(r.name)), `all-time rank of ${r.name}`);
      assert.equal(r.move, refBefore.get(key(r.name)) - r.rank, `move of ${r.name}`);
    }
    for (const r of b.week.top) assert.equal(r.rank, refWeek.get(key(r.name)), `weekly rank of ${r.name}`);
  });

  test('top respects size', () => {
    const players = [{ name: 'Zara', xp: 3000, wk: 0, week: CUR }];
    const total = RIVALS.length + 1;
    const full = fullBoard(players, null);
    for (const [size, want] of [[undefined, Math.min(10, total)], [3, 3], [1, 1], [0, 0], [total, total], [total + 50, total]]) {
      const b = buildBoard(players, null, size);
      assert.equal(b.all.top.length, want, `all, size=${size}`);
      assert.equal(b.week.top.length, want, `week, size=${size}`);
      assert.deepEqual(b.all.top, full.all.top.slice(0, want));
      assert.deepEqual(b.week.top, full.week.top.slice(0, want));
      assert.equal(b.total, total, 'total is independent of size');
    }
  });

  test('the "me" match is case-insensitive and flags exactly one row', () => {
    const b = fullBoard([{ name: 'Zara', xp: 3000, wk: 50, week: CUR }], 'zARA');
    for (const board of [b.all, b.week]) {
      assert.equal(board.me.name, 'Zara');
      assert.equal(board.me.me, true);
      assert.equal(board.top.filter(r => r.me).length, 1);
      assert.deepEqual(board.me, board.top.find(r => r.me));
    }
  });

  test('me and above are null when meName is null, undefined, empty or unknown', () => {
    const players = [{ name: 'Zara', xp: 3000, wk: 50, week: CUR }];
    for (const meName of [null, undefined, '', 'nobody_here']) {
      const b = fullBoard(players, meName);
      for (const board of [b.all, b.week]) {
        assert.equal(board.me, null, `me for ${JSON.stringify(meName)}`);
        assert.equal(board.above, null, `above for ${JSON.stringify(meName)}`);
        assert.ok(board.top.every(r => r.me === false));
      }
    }
  });

  test('a player ranked #1 has no one above', () => {
    const b = buildBoard([{ name: 'Champ', xp: 1e7, wk: 1e6, week: CUR }], 'champ');
    for (const board of [b.all, b.week]) {
      assert.equal(board.me.rank, 1);
      assert.equal(board.above, null);
    }
  });

  test('"above" is the row directly above me', () => {
    const b = fullBoard([{ name: 'Zara', xp: 3000, wk: 50, week: CUR }], 'Zara');
    for (const board of [b.all, b.week]) {
      if (board.me.rank === 1) continue;
      assert.deepEqual(board.above, board.top[board.me.rank - 2]);
    }
  });

  test('a player outside the top N is still returned as me with the true rank', () => {
    const players = [{ name: 'tail', xp: 0, wk: 0, week: CUR }];
    const b = buildBoard(players, 'tail', 3);
    const full = fullBoard(players, 'tail');
    assert.equal(b.all.top.length, 3);
    assert.ok(!b.all.top.some(r => r.me), 'not in the top 3');
    assert.equal(b.all.me.rank, b.total);
    assert.deepEqual(b.all.me, full.all.me);
    assert.deepEqual(b.all.above, full.all.top[b.total - 2]);
    assert.equal(b.week.me.rank, b.total);
    assert.deepEqual(b.week.me, full.week.me);
    // With the default size as well.
    const d = buildBoard(players, 'tail');
    assert.equal(d.all.top.length, 10);
    assert.equal(d.all.me.rank, RIVALS.length + 1);
  });

  test('weekly board: stale-week wk counts as 0, current-week wk counts, missing week counts as 0', () => {
    const players = [
      { name: 'fresh', xp: 50000, wk: 40000, week: CUR },
      { name: 'stale', xp: 60000, wk: 45000, week: OLD },
      { name: 'noweek', xp: 70000, wk: 30000 }
    ];
    const b = fullBoard(players, 'stale');
    assert.equal(row(b.week.top, 'fresh').score, 40000);
    assert.equal(row(b.week.top, 'fresh').rank, 1);
    assert.equal(row(b.week.top, 'stale').score, 0);
    assert.equal(row(b.week.top, 'noweek').score, 0);
    assert.equal(b.week.me.score, 0);
    assertRanked(b.week.top);
    // The all-time board is unaffected by the week.
    assert.equal(row(b.all.top, 'stale').score, 60000);
    assert.equal(row(b.all.top, 'noweek').score, 70000);
    assert.equal(row(b.all.top, 'fresh').score, 50000);
  });

  test('the same stale player counts again once the clock is back in its week', () => {
    const players = [{ name: 'late', xp: 50000, wk: 40000, week: CUR }];
    assert.equal(buildBoard(players, 'late').week.me.score, 40000);
    mock.timers.setTime(Date.parse('2026-11-09T00:00:00.000Z')); // next Monday
    assert.equal(buildBoard(players, 'late').week.me.score, 0);
  });

  test('all-time move: hand-computed example', () => {
    // Before = xp - (this week's wk). echo's wk is from an old week, so it does not count.
    //   now:    alpha 100000, bravo 99000, charlie 98000, echo 95000, delta 90000
    //   before: alpha 100000, echo 95000, delta 89000, bravo 79000, charlie 68000
    const players = [
      { name: 'alpha', xp: 100000, wk: 0, week: CUR },
      { name: 'bravo', xp: 99000, wk: 20000, week: CUR },
      { name: 'charlie', xp: 98000, wk: 30000, week: CUR },
      { name: 'delta', xp: 90000, wk: 1000, week: CUR },
      { name: 'echo', xp: 95000, wk: 50000, week: OLD }
    ];
    const b = buildBoard(players, 'delta');
    assert.deepEqual(b.all.top.slice(0, 5).map(r => [r.name, r.rank, r.move]), [
      ['alpha', 1, 0],
      ['bravo', 2, 2],
      ['charlie', 3, 2],
      ['echo', 4, -2],
      ['delta', 5, -2]
    ]);
    assert.equal(b.all.me.move, -2);
    // Weekly board never shows arrows, even though the all-time board does.
    assert.ok(fullBoard(players, 'delta').week.top.every(r => r.move === 0));
    assert.equal(b.week.me.move, 0);
    assert.deepEqual(b.week.top.slice(0, 2).map(r => [r.name, r.score]), [['charlie', 30000], ['bravo', 20000]]);
  });

  test('all-time move is 0 for everyone when nobody earned XP this week', () => {
    // Real players take every rival handle with last week's numbers, so no one has weekly XP.
    const players = RIVALS.map(r => ({ name: r.name, xp: r.xp, wk: r.wk, week: OLD }));
    const b = fullBoard(players, null);
    assert.ok(b.all.top.every(r => r.move === 0));
    assert.ok(b.week.top.every(r => r.score === 0));
  });

  test('all-time moves sum to zero (a permutation of ranks)', () => {
    const players = [
      { name: 'rocket', xp: 4000, wk: 4000, week: CUR },
      { name: 'sleepy', xp: 3000, wk: 0, week: CUR }
    ];
    const b = fullBoard(players, null);
    assert.equal(b.all.top.reduce((s, r) => s + r.move, 0), 0);
    assert.ok(row(b.all.top, 'rocket').move > 0, 'a player who earned all XP this week climbs');
    assert.ok(b.week.top.every(r => r.move === 0));
  });

  test('does not mutate the players array, its objects, or RIVALS', () => {
    const players = [
      { name: 'stale', xp: 60000, wk: 45000, week: OLD, pro: 1, vaults: 3, streak: 2 },
      { name: swapCase(RIVALS[0].name), xp: 5, wk: 5, week: CUR }
    ];
    const playersCopy = structuredClone(players), rivalsCopy = structuredClone(RIVALS);
    const refs = [...players];
    const b = fullBoard(players, 'stale');
    assert.deepEqual(players, playersCopy);
    assert.equal(players.length, 2);
    players.forEach((p, i) => assert.equal(p, refs[i], 'same array entries'));
    assert.deepEqual(RIVALS, rivalsCopy);
    assert.ok(RIVALS.every(r => !('week' in r)), 'rivals did not get a week stamped on them');
    // Output rows are new objects.
    assert.ok(b.all.top.every(r => !players.includes(r) && !RIVALS.includes(r)));
  });

  test('score equals xp on the all-time board and effective weekly XP on the weekly board', () => {
    const players = [
      { name: 'cur', xp: 1234, wk: 234, week: CUR },
      { name: 'old', xp: 4321, wk: 321, week: OLD }
    ];
    const b = fullBoard(players, null);
    const effWk = new Map([...RIVALS.map(r => [key(r.name), r.wk]), ['cur', 234], ['old', 0]]);
    for (const r of b.all.top) assert.equal(r.score, r.xp, r.name);
    for (const r of b.week.top) assert.equal(r.score, effWk.get(key(r.name)), r.name);
    // xp on weekly rows is still the total.
    assert.equal(row(b.week.top, 'old').xp, 4321);
  });

  test('row shape: fixed keys, pro coerced to boolean, internal fields not leaked', () => {
    const b = fullBoard([
      { name: 'p1', xp: 10, wk: 1, week: CUR, pro: 1, vaults: 1, streak: 1, secret: 'x' },
      { name: 'p2', xp: 20, wk: 2, week: CUR }
    ], 'p1');
    for (const r of [...b.all.top, ...b.week.top]) {
      assert.deepEqual(Object.keys(r).sort(), ['me', 'move', 'name', 'pro', 'rank', 'score', 'streak', 'vaults', 'xp']);
      assert.equal(typeof r.pro, 'boolean');
      assert.equal(typeof r.me, 'boolean');
    }
    assert.equal(row(b.all.top, 'p1').pro, true);
    assert.equal(row(b.all.top, 'p2').pro, false);
  });
});

// Probes for questionable inputs. Each states the behaviour we think is correct.
describe('buildBoard edge cases', () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: NOW }));
  afterEach(() => mock.timers.reset());

  test('two real players whose handles differ only by case appear once', () => {
    const players = [
      { name: 'Sam', xp: 500, wk: 0, week: CUR },
      { name: 'sam', xp: 9000, wk: 8800, week: CUR }
    ];
    const b = fullBoard(players, 'SAM');
    for (const board of [b.all, b.week]) {
      assert.equal(board.top.filter(r => key(r.name) === 'sam').length, 1, 'one row per handle');
      assert.equal(board.top.filter(r => r.me).length, 1, 'only one "me" row');
    }
    assert.equal(b.total, RIVALS.length + 1);
    assert.equal(b.all.top.reduce((s, r) => s + r.move, 0), 0, 'moves are a permutation');
  });

  test('missing vaults/streak are reported as 0, not undefined', () => {
    const b = fullBoard([{ name: 'ghost', xp: 10, wk: 0, week: CUR }], 'ghost');
    assert.equal(b.all.me.vaults, 0);
    assert.equal(b.all.me.streak, 0);
  });

  test('missing or NaN xp is ranked as 0 XP', () => {
    for (const bad of [undefined, NaN]) {
      const players = [{ name: 'aaa', xp: bad, wk: 0, week: CUR }, { name: 'bbb', xp: 1, wk: 0, week: CUR }];
      const b = fullBoard(players, 'aaa');
      const me = b.all.me;
      assert.equal(me.rank, b.total, `xp=${bad} should be last (below bbb with 1 XP), got rank ${me.rank}`);
      assert.equal(me.score, 0, `score for xp=${bad}`);
      assertRanked(b.all.top);
    }
  });

  test('weekly XP greater than total XP is capped at total XP', () => {
    const b = fullBoard([{ name: 'zed', xp: 100, wk: 500, week: CUR }], 'zed');
    assert.ok(b.week.me.score <= b.all.me.xp, `weekly ${b.week.me.score} > total ${b.all.me.xp}`);
  });

  test('negative xp / wk are clamped to 0', () => {
    const b = fullBoard([
      { name: 'neg', xp: -50, wk: -20, week: CUR },
      { name: 'zzz_zero', xp: 0, wk: 0, week: CUR }
    ], 'neg');
    assert.equal(b.all.me.score, 0);
    assert.equal(b.week.me.score, 0);
    // Clamped to 0 it ties with zzz_zero and wins the name tie-break.
    assert.ok(b.all.me.rank < row(b.all.top, 'zzz_zero').rank);
  });

  test('meName that only matches a made-up rival is not "me"', () => {
    const b = buildBoard([], key(RIVALS[0].name));
    assert.equal(b.all.me, null);
    assert.equal(b.week.me, null);
  });
});
