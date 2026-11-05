// HTTP tests for POST /api/leaderboard (server/index.js), run against real server processes.
// Each server gets a free port and its own temp LEADERBOARD_FILE; all of them are killed in after().
// AI routes (/api/mentor, /api/review) are never called.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { RIVALS } = await import(pathToFileURL(path.join(ROOT, 'src', 'content', 'leaderboard.js')).href);
const { weekKey } = await import(pathToFileURL(path.join(ROOT, 'src', 'core', 'rank.js')).href);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vq-api-'));
const children = new Set();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

// Starts `node server/index.js`; resolves once it logs "VaultQuest API on".
async function startServer(label, { file = path.join(TMP, label, 'leaderboard.json'), env = {} } = {}) {
  const port = await freePort();
  const childEnv = { ...process.env, PORT: String(port), LEADERBOARD_FILE: file, ...env };
  for (const [k, v] of Object.entries(childEnv)) if (v === undefined) delete childEnv[k];
  const child = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: server did not start in time\n${out}`)), 20000);
    const onData = () => { if (out.includes('VaultQuest API on')) { clearTimeout(timer); child.stdout.off('data', onData); resolve(); } };
    child.stdout.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${label}: server exited (${code}) before listening\n${out}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    child, file, base, output: () => out,
    alive: () => child.exitCode === null && child.signalCode === null,
    async post(body, { raw, type = 'application/json', headers = {} } = {}) {
      const init = { method: 'POST', headers: { ...(type ? { 'content-type': type } : {}), ...headers } };
      if (raw !== undefined) init.body = raw; else if (body !== undefined) init.body = JSON.stringify(body);
      const r = await fetch(base + '/api/leaderboard', init);
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, type: r.headers.get('content-type') || '', text, json };
    },
    async health() { const r = await fetch(base + '/api/health'); return { status: r.status, json: await r.json() }; }
  };
}

function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}

const isBoard = j => j && typeof j.total === 'number' && j.all && j.week && Array.isArray(j.all.top) && Array.isArray(j.week.top) && 'me' in j.all && 'above' in j.all;
const STACK = /\bat\s+\S+\s+\(/; // "at fn (file:line)" frames of a stack trace
const ROW_KEYS = ['me', 'move', 'name', 'pro', 'rank', 'score', 'streak', 'vaults', 'xp'];

let srv;
before(async () => {
  // Like `npm run server` / `npm run dev`: NODE_ENV unset (Express "development").
  srv = await startServer('main', { env: { NODE_ENV: undefined } });
});
after(async () => {
  await Promise.all([...children].map(stop));
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('GET /api/health is ok', async () => {
  const h = await srv.health();
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
  assert.equal(typeof h.json.ai, 'boolean');
});

test('POST without a body / {} / array / no name → 200, board with me: null, nothing saved', async () => {
  const base = await srv.post({});
  assert.equal(base.status, 200);
  assert.ok(isBoard(base.json));
  assert.equal(base.json.total, RIVALS.length, 'fresh server: rivals only');
  const cases = [
    ['no body, no content-type', srv.post(undefined, { type: null })],
    ['no body, JSON content-type', srv.post(undefined)],
    ['empty object', srv.post({})],
    ['array body', srv.post([{ name: 'arr_user', xp: 999999 }])],
    ['empty array', srv.post([])],
    ['fields but no name', srv.post({ xp: 999999, wk: 5 })],
    ['name: null', srv.post({ name: null, xp: 999999 })],
    ['name: ""', srv.post({ name: '', xp: 999999 })],
    ['text/plain JSON', srv.post(undefined, { raw: JSON.stringify({ name: 'plain_user', xp: 999999 }), type: 'text/plain' })],
    ['form-encoded', srv.post(undefined, { raw: 'name=form_user&xp=999999', type: 'application/x-www-form-urlencoded' })]
  ];
  for (const [label, p] of cases) {
    const r = await p;
    assert.equal(r.status, 200, label);
    assert.ok(isBoard(r.json), label);
    assert.equal(r.json.all.me, null, label);
    assert.equal(r.json.week.me, null, label);
    assert.equal(r.json.total, RIVALS.length, `${label}: nothing saved`);
  }
});

test('invalid names → 200, me: null, not saved', async () => {
  for (const name of ['<script>alert(1)</script>', 'a', 'x'.repeat(17), 'ä_user', 'has space', 'ab\n', 12345, true, ['ab_cd'], { a: 1 }]) {
    const r = await srv.post({ name, xp: 999999 });
    assert.equal(r.status, 200, JSON.stringify(name));
    assert.ok(isBoard(r.json));
    assert.equal(r.json.all.me, null, JSON.stringify(name));
    assert.equal(r.json.total, RIVALS.length, `${JSON.stringify(name)} must not be saved`);
  }
});

test('valid name → saved, me present with the correct rank / above / move', async () => {
  const r = await srv.post({ name: 'Api_Player', xp: 3000, wk: 600, week: '2000-01-03', pro: true, vaults: 5, streak: 4 });
  assert.equal(r.status, 200);
  assert.match(r.type, /application\/json/);
  const { all, week, total } = r.json;
  assert.equal(total, RIVALS.length + 1);
  const xpAbove = RIVALS.filter(p => p.xp > 3000).length;
  const wkAbove = RIVALS.filter(p => p.wk > 600).length;
  const beforeAbove = RIVALS.filter(p => p.xp - p.wk > 3000 - 600).length;
  assert.deepEqual(all.me, { name: 'Api_Player', pro: true, xp: 3000, vaults: 5, streak: 4, score: 3000, rank: xpAbove + 1, move: beforeAbove - xpAbove, me: true });
  assert.deepEqual(week.me, { name: 'Api_Player', pro: true, xp: 3000, vaults: 5, streak: 4, score: 600, rank: wkAbove + 1, move: 0, me: true });
  assert.equal(all.above.rank, all.me.rank - 1);
  assert.ok(all.above.score >= all.me.score);
  assert.equal(week.above.rank, week.me.rank - 1);
  assert.deepEqual(all.top[all.me.rank - 1], all.me, 'me row is the same row in top');
  assert.equal(all.top.filter(x => x.me).length, 1);
});

test('response shape: { total, all: {top, me, above}, week: {top, me, above} }', async () => {
  const r = await srv.post({ name: 'api_player', xp: 3000, wk: 600, pro: true, vaults: 5, streak: 4 });
  const j = r.json;
  assert.deepEqual(Object.keys(j).sort(), ['all', 'total', 'week']);
  for (const scope of ['all', 'week']) {
    const b = j[scope];
    assert.deepEqual(Object.keys(b).sort(), ['above', 'me', 'top']);
    assert.ok(b.top.length <= 10 && b.top.length === Math.min(10, j.total));
    b.top.forEach((row, i) => {
      assert.deepEqual(Object.keys(row).sort(), ROW_KEYS);
      assert.equal(row.rank, i + 1);
      assert.equal(typeof row.name, 'string');
      assert.equal(typeof row.pro, 'boolean');
      for (const k of ['xp', 'vaults', 'streak', 'score', 'rank', 'move']) assert.ok(Number.isInteger(row[k]), `${scope}.${k}`);
      if (i) assert.ok(b.top[i - 1].score >= row.score, 'sorted by score desc');
    });
    for (const row of [b.me, b.above]) if (row) assert.deepEqual(Object.keys(row).sort(), ROW_KEYS);
  }
  assert.ok(j.week.top.every(row => row.move === 0), 'weekly board has no arrows');
  assert.ok(j.all.top.every(row => row.score === row.xp));
});

test('upsert via the API is case-insensitive and updates the display name', async () => {
  const n = (await srv.post({})).json.total;
  const r = await srv.post({ name: 'API_PLAYER', xp: 3100, wk: 0 });
  assert.equal(r.json.total, n);
  assert.equal(r.json.all.me.name, 'API_PLAYER');
  assert.equal(r.json.all.me.xp, 3100);
});

test('a real player with a rival handle replaces the rival', async () => {
  const n = (await srv.post({})).json.total;
  const r = await srv.post({ name: 'NEOBYTE', xp: 1, wk: 0 });
  assert.equal(r.json.total, n);
  assert.equal(r.json.all.me.name, 'NEOBYTE');
  assert.equal(r.json.all.me.xp, 1);
  assert.ok(!r.json.all.top.some(x => x.name === 'NeoByte'));
});

test('malformed JSON → 400 with a short JSON error (no stack trace, even in dev mode), server keeps running', async () => {
  for (const raw of ['{bad json', '{"name":"x",}', '{"name":"unterminated']) {
    const r = await srv.post(undefined, { raw });
    assert.equal(r.status, 400, raw);
    assert.deepEqual(r.json, { error: 'bad request' });
    assert.doesNotMatch(r.text, STACK);
  }
  assert.ok(srv.alive());
  assert.equal((await srv.health()).status, 200);
});

test('JSON primitives as body → 400 (express.json strict mode), server keeps running', async () => {
  for (const raw of ['"just a string"', 'null', '42', 'true']) {
    const r = await srv.post(undefined, { raw });
    assert.equal(r.status, 400, raw);
  }
  assert.ok(srv.alive());
});

test('body over 32kb → 413, nothing saved, server keeps running; just under the limit still works', async () => {
  const n = (await srv.post({})).json.total;
  const big = await srv.post({ name: 'big_user', xp: 5, pad: 'x'.repeat(40 * 1024) });
  assert.equal(big.status, 413);
  assert.ok(srv.alive());
  assert.equal((await srv.health()).status, 200);
  assert.equal((await srv.post({})).json.total, n, 'oversized body not saved');

  const ok = await srv.post({ name: 'almost_big', xp: 5, pad: 'x'.repeat(30 * 1024) });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.all.me.name, 'almost_big');
  assert.equal(ok.json.total, n + 1);
});

test('deeply nested / prototype-polluting bodies do not crash the server', async t => {
  const depth = 16000; // stays under 32kb
  const nested = await srv.post(undefined, { raw: '['.repeat(depth) + ']'.repeat(depth) });
  assert.ok([200, 400].includes(nested.status), `status ${nested.status}`);
  t.diagnostic(`16000-deep nested array body → ${nested.status}`);
  const pp = await srv.post(undefined, { raw: '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"name":"proto_user","xp":7}' });
  assert.equal(pp.status, 200);
  assert.equal(pp.json.all.me.xp, 7);
  assert.ok(srv.alive());
  assert.equal((await srv.health()).status, 200);
});

test('scores are written to LEADERBOARD_FILE within ~1 s and reloaded by a restarted server', async () => {
  await srv.post({ name: 'Persist_Top', xp: 999999, wk: 10, pro: true, vaults: 8, streak: 3 });
  await sleep(1300);
  const saved = JSON.parse(fs.readFileSync(srv.file, 'utf8'));
  assert.ok(Array.isArray(saved));
  const { at, ...persisted } = saved.find(p => p.name === 'Persist_Top');
  assert.equal(typeof at, 'number', 'last-saved time stored');
  assert.deepEqual(persisted, { name: 'Persist_Top', xp: 999999, wk: 10, week: weekKey(), pro: true, vaults: 8, streak: 3 });
  assert.ok(saved.some(p => p.name === 'API_PLAYER'));
  assert.ok(!saved.some(p => /big_user|plain_user|form_user|arr_user|script/.test(p.name)));

  const totalBefore = (await srv.post({})).json.total;
  const again = await startServer('restart', { file: srv.file, env: { NODE_ENV: undefined } });
  try {
    const r = await again.post({});
    assert.equal(r.json.total, totalBefore);
    assert.equal(r.json.all.top[0].name, 'Persist_Top');
    assert.equal(r.json.all.top[0].xp, 999999);
  } finally { await stop(again.child); }
});

test('rate limit: 120 writes per IP are saved, the 121st is not but still gets a board', async () => {
  // Fresh server so the limiter starts at 0. NODE_ENV=production like `npm start`.
  const rl = await startServer('ratelimit', { env: { NODE_ENV: 'production' } });
  try {
    for (let i = 1; i <= 120; i++) {
      const r = await rl.post({ name: 'rl_user', xp: i, wk: 0 });
      assert.equal(r.status, 200);
      assert.equal(r.json.all.me?.xp, i, `write #${i} saved`);
    }
    // Over the limit: not stored, but the caller is still ranked with the score they sent.
    const r121 = await rl.post({ name: 'rl_user', xp: 5000, wk: 0 });
    assert.equal(r121.status, 200);
    assert.ok(isBoard(r121.json));
    assert.equal(r121.json.all.me.xp, 5000, 'caller sees their own (unsaved) score');
    const peek = await rl.post({ name: 'rl_user' }); // no xp → nothing to save or rank: shows the stored entry
    assert.equal(peek.json.all.me.xp, 120, '121st write not saved');
    const r122 = await rl.post({ name: 'rl_new', xp: 1 });
    assert.equal(r122.status, 200);
    assert.equal(r122.json.all.me?.xp, 1, 'a rate-limited newcomer is still ranked');
    assert.equal((await rl.post({ name: 'rl_new' })).json.all.me, null, 'new handle not saved while limited');
    const read = await rl.post({});
    assert.equal(read.status, 200);
    assert.equal(read.json.total, RIVALS.length + 1, 'reads still work');
    assert.equal((await rl.health()).json.ok, true);
    assert.ok(rl.alive());

    // Production mode: malformed JSON → 400 without leaking a stack trace / file paths.
    const bad = await rl.post(undefined, { raw: '{bad json' });
    assert.equal(bad.status, 400);
    assert.doesNotMatch(bad.text, STACK);
    assert.doesNotMatch(bad.text, /node_modules|[A-Za-z]:\\/);
  } finally { await stop(rl.child); }
});

test('main server is still alive and healthy after all of the above', async () => {
  assert.ok(srv.alive(), srv.output());
  const h = await srv.health();
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
});
