import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, grantReward, rollbackRun, newRun, rewardKey, projectCurriculum, isEarlierVersion, SAVE_VERSION } from '../src/learn/progress.js';
import { LANGS, freeOf } from '../src/content/languages.js';
import { V1, LIVE_NOW } from './fixtures/profiles.js';

const NOW = '2026-11-04T12:00:00.000Z';
const up = (s, live = LIVE_NOW) => migrate(s, live, NOW);
const keys = (s, prefix) => Object.keys(s.awarded).filter(k => k.startsWith(prefix)).sort();
const vault = (cur, i) => [0, 1, 2, 'bonus'].map(p => rewardKey(cur, i, p));
const project = (cur, i) => ['m0', 'm1', 'm2', 'm3', 'ship'].map(p => rewardKey(cur, i, p));
const sorted = a => [...a].sort();
const reload = s => up(JSON.parse(JSON.stringify(s))); // what a page reload does with a save

// ── content configuration ──
test('both languages: 5 FREE nodes (4 vaults + the Mini Boss) and the World 1 curricula are live', () => {
  assert.equal(freeOf('py'), 5); assert.equal(freeOf('js'), 5);
  assert.deepEqual({ py: LANGS.py.curriculum, js: LANGS.js.curriculum }, LIVE_W1);
});

// ── The live switch to World 1 (py-1 → py-2, js-1 → js-2), for every kind of existing profile ──
const LIVE_W1 = { py: 'py-2', js: 'js-2' };
const w1 = s => migrate(s, LIVE_W1, NOW);
const KEEP = ['xp', 'ach', 'pro', 'projects', 'streak', 'questions', 'name', 'lang'];
const attemptOf = (lang, vault, locked) => ({ lang, vault, curriculum: lang + '-1', session: { hearts: locked ? 0 : 2, locked, failedFingerprints: ['f'], attempts: [], recovery: null }, run: { paid: [] }, view: { ci: 1 } });
const PROFILES = {
  newUser: { name: 'New', lang: 'py', xp: 0, done: { py: 0, js: 0 }, stars: {}, ach: [], fresh: [], streak: 1, lastDay: '', questions: 0, pro: false, projects: [] },
  jsOnly: V1.jsOne, pyOnly: V1.pyPartial, both: V1.proPy, jsArraysAndShipped: V1.jsShipped, ancient: V1.ancient,
  v2: { ...V1.jsOne, v: 2, curriculum: { py: 'py-1', js: 'js-1' }, awarded: { 'js-1:0:0': null }, legacy: {} },
  v3Unfinished: { ...V1.pyPartial, v: 3, curriculum: { py: 'py-1', js: 'js-1' }, awarded: {}, legacy: {}, attempts: { 'py-1:2': attemptOf('py', 2, false) } },
  v3InOldRecovery: { ...V1.jsOne, v: 3, curriculum: { py: 'py-1', js: 'js-1' }, awarded: {}, legacy: {}, attempts: { 'js-1:1': attemptOf('js', 1, true) } }
};

for (const [id, p] of Object.entries(PROFILES)) {
  test(`World 1 switch · ${id}: history kept, old progress archived, new curriculum starts fresh, idempotent`, () => {
    const before = migrate(p, LIVE_NOW, NOW), after = w1(p);
    for (const f of KEEP) assert.deepEqual(after[f], p[f] ?? before[f], `${id}.${f}`); // XP, achievements, PRO, projects…
    assert.deepEqual(after.curriculum, LIVE_W1);
    assert.deepEqual(after.done, { ...(p.done ?? {}), py: 0, js: 0 }); assert.deepEqual(after.stars, {});
    assert.deepEqual(after.attempts, {}); // no old attempt (or old Recovery) leaks into World 1
    for (const lang of ['py', 'js']) {
      const old = after.legacy[lang + '-1'];
      assert.equal(old.done, Number(p.done?.[lang]) || 0, `${id} ${lang}`);
      assert.deepEqual(old.stars, Object.fromEntries(Object.entries(p.stars ?? {}).filter(([k]) => k.startsWith(lang))));
    }
    for (const [k, v] of Object.entries(before.awarded)) assert.equal(after.awarded[k], v, `reward ${k} kept`);
    assert.ok(!Object.keys(after.awarded).some(k => k.startsWith('js-2') || k.startsWith('py-2'))); // nothing of World 1 pre-paid
    assert.deepEqual(w1(after), after); assert.deepEqual(w1(JSON.parse(JSON.stringify(after))), after); // reopening changes nothing
    for (const [k, a] of Object.entries(p.attempts ?? {})) assert.deepEqual(after.legacy[k.slice(0, 4)].attempts[k], a);
  });
}

test('World 1 switch: languages are independent — switching one never touches the other', () => {
  const pyFirst = migrate(V1.proPy, { py: 'py-2', js: 'js-1' }, NOW);
  assert.equal(pyFirst.done.js, 4); assert.equal(pyFirst.stars.js0, 3); assert.equal(pyFirst.legacy['js-1'], undefined);
  assert.equal(pyFirst.done.py, 0); assert.equal(pyFirst.legacy['py-1'].done, 4);
  const thenJs = w1(pyFirst);
  assert.equal(thenJs.legacy['py-1'].archivedAt, pyFirst.legacy['py-1'].archivedAt); // not archived twice
  assert.equal(thenJs.legacy['js-1'].done, 4); assert.equal(thenJs.xp, V1.proPy.xp);
});

test('World 1 switch: old completion never counts — every World 1 reward is still earnable once', () => {
  const s = w1(V1.proPy);
  for (const lang of ['py', 'js']) for (let v = 0; v < 4; v++) {
    for (const part of [0, 1, 2, 'bonus']) assert.equal(grantReward(s, rewardKey(lang + '-2', v, part), 10), 10);
    assert.equal(grantReward(s, rewardKey(lang + '-2', v, 'bonus'), 10), 0);
  }
  assert.equal(grantReward(s, rewardKey('py-1', 5, 'ship'), 300), 0); // the shipped Guess the Number stays paid
});

// ── v1 → v2 ──
test('v1 → v3 keeps every existing field and only adds the new ones', () => {
  for (const [id, f] of Object.entries(V1)) {
    const s = up(f);
    const { v, curriculum, awarded, legacy, attempts, ...rest } = s;
    assert.deepEqual(rest, f, id); // XP, achievements, Pro, projects, stars, streak, unknown fields untouched
    assert.equal(v, SAVE_VERSION, id);
    assert.deepEqual(curriculum, { py: 'py-1', js: 'js-1' }, id);
    assert.deepEqual(legacy, {}, id); assert.deepEqual(attempts, {}, id);
    assert.ok(awarded && typeof awarded === 'object', id);
  }
});

test('v1 → v2 marks everything already completed as paid (both languages)', () => {
  assert.deepEqual(keys(up(V1.pyPartial), ''), sorted([...vault('py-1', 0), ...vault('py-1', 1)]));
  assert.deepEqual(keys(up(V1.jsOne), ''), sorted(vault('js-1', 0)));
  const js = up(V1.jsShipped);
  assert.deepEqual(keys(js, 'js-1:'), sorted([0, 1, 2, 3, 4].flatMap(i => vault('js-1', i)).concat(project('js-1', 5))));
  assert.deepEqual(keys(js, 'py-1:'), []);
  const py = up(V1.proPy);
  assert.deepEqual(keys(py, 'py-1:'), sorted([0, 1, 2, 3, 4].flatMap(i => vault('py-1', i)).concat(project('py-1', 5))));
  assert.deepEqual(keys(py, 'js-1:'), sorted([0, 1, 2, 3].flatMap(i => vault('js-1', i))));
  assert.deepEqual(keys(up(V1.ancient), ''), []);
  for (const v of Object.values(up(V1.proPy).awarded)) assert.equal(v, null); // amount unknown → null
});

test('migration does not mutate its input', () => {
  const f = structuredClone(V1.jsShipped);
  up(f); up(f, { py: 'py-2', js: 'js-2' });
  assert.deepEqual(f, V1.jsShipped);
});

test('idempotent: re-migrating and repeated reloads change nothing', () => {
  for (const f of Object.values(V1)) {
    const once = up(f);
    assert.deepEqual(up(once), once);
    assert.deepEqual(reload(reload(reload(once))), once);
  }
});

test('an upgraded save keeps rewards earned since — they are never re-marked or reset', () => {
  const s = up(V1.jsOne);
  grantReward(s, rewardKey('js-1', 1, 0), 50);
  const again = reload(s);
  assert.equal(again.awarded['js-1:1:0'], 50);
  assert.equal(again.xp, 380);
});

test('anything that is not a save → null; saves from a newer build are left alone', () => {
  for (const bad of [null, undefined, 5, 'x', [], [1]]) assert.equal(up(bad), null);
  const future = { v: 99, xp: 5, anything: true };
  assert.deepEqual(up(future), future);
});

test('a v2 save missing its new fields is repaired, not crashed on', () => {
  const s = up({ v: 2, xp: 10, done: { py: 0, js: 0 }, stars: {} });
  assert.deepEqual(s.curriculum, LIVE_NOW); assert.deepEqual(s.awarded, {}); assert.deepEqual(s.legacy, {});
});

// ── future curricula: js-1 → js-2 and py-1 → py-2 ──
test('js-2: old JS progress is archived, the new path starts at vault 1, everything else stays', () => {
  const before = up(V1.jsShipped), after = up(before, { py: 'py-1', js: 'js-2' });
  assert.deepEqual(after.legacy['js-1'], { lang: 'js', done: 4, stars: { js0: 3, js1: 3, js2: 2, js3: 3, js4: 2, js5: 3 }, attempts: {}, archivedAt: NOW });
  assert.equal(after.done.js, 0);
  assert.ok(!Object.keys(after.stars).some(k => k.startsWith('js'))); // old stars can't open new nodes (D4)
  assert.equal(after.curriculum.js, 'js-2'); assert.equal(after.curriculum.py, 'py-1');
  for (const f of ['xp', 'ach', 'pro', 'projects', 'custom', 'streak', 'questions']) assert.deepEqual(after[f], before[f], f);
  assert.deepEqual(after.awarded, before.awarded); // historical rewards (incl. Arrays & Loops js-1:4:*) are kept
  assert.ok(vault('js-1', 4).every(k => k in after.awarded));
  // Old completion never counts as new: the first js-2 challenge still pays.
  assert.equal(grantReward(after, rewardKey('js-2', 0, 0), 50), 50);
});

test('py-2: old Python progress is archived independently of JavaScript', () => {
  const before = up(V1.proPy), after = up(before, { py: 'py-2', js: 'js-1' });
  assert.equal(after.legacy['py-1'].done, 4);
  assert.deepEqual(Object.keys(after.legacy['py-1'].stars).sort(), ['py0', 'py1', 'py2', 'py3', 'py4', 'py5']);
  assert.equal(after.done.py, 0); assert.equal(after.done.js, 4);
  assert.deepEqual(Object.keys(after.stars).sort(), ['js0', 'js1', 'js2', 'js3']);
  assert.equal(after.legacy['js-1'], undefined);
  assert.equal(after.xp, before.xp);
});

test('both new curricula at once, straight from a v1 save, and idempotent afterwards', () => {
  const live = { py: 'py-2', js: 'js-2' }, s = migrate(V1.proPy, live, NOW);
  assert.equal(s.legacy['py-1'].done, 4); assert.equal(s.legacy['js-1'].done, 4);
  assert.deepEqual(s.done, { py: 0, js: 0 }); assert.deepEqual(s.stars, {});
  assert.ok(vault('py-1', 0).every(k => s.awarded[k] === null)); // backfilled before archiving
  assert.deepEqual(migrate(s, live, '2030-01-01T00:00:00.000Z'), s); // later reloads: same archive, same date
});

test('an existing archive is never overwritten', () => {
  const s = up(V1.jsShipped);
  s.legacy['js-1'] = { lang: 'js', done: 2, stars: {}, archivedAt: 'earlier' };
  assert.equal(up(s, { py: 'py-1', js: 'js-2' }).legacy['js-1'].archivedAt, 'earlier');
});

// ── once-only rewards (same rules for both languages) ──
for (const lang of ['py', 'js']) {
  const cur = lang + '-1';

  test(`${lang}: a reward pays once; replays pay +0`, () => {
    const s = up({ ...V1.ancient, lang });
    assert.equal(grantReward(s, rewardKey(cur, 0, 0), 50), 50);
    assert.equal(grantReward(s, rewardKey(cur, 0, 0), 50), 0);
    assert.equal(grantReward(s, rewardKey(cur, 0, 1), 60), 60);
    assert.equal(s.xp, 90 + 110);
  });

  test(`${lang}: rewards marked by the v1 migration pay nothing`, () => {
    const s = up(lang === 'py' ? V1.pyPartial : V1.jsOne), xp = s.xp;
    assert.equal(grantReward(s, rewardKey(cur, 0, 2), 70), 0);
    assert.equal(grantReward(s, rewardKey(cur, 0, 'bonus'), 240), 0);
    assert.equal(s.xp, xp);
  });

  test(`${lang}: a better star rating on replay pays no extra bonus (D2)`, () => {
    const s = up({ ...V1.ancient, lang }), k = rewardKey(cur, 2, 'bonus');
    assert.equal(grantReward(s, k, 150 + 2 * 50 + 2 * 30), 310); // first crack, 2 stars
    assert.equal(grantReward(s, k, 150 + 2 * 50 + 3 * 30), 0); // replay with 3 stars
    assert.equal(s.awarded[k], 310);
  });

  test(`${lang}: project milestones and ship pay once`, () => {
    const s = up({ ...V1.ancient, lang });
    for (let r = 0; r < 2; r++) for (const p of ['m0', 'm1', 'm2', 'm3']) grantReward(s, rewardKey(cur, 5, p), 50);
    assert.equal(grantReward(s, rewardKey(cur, 5, 'ship'), 300), 300);
    assert.equal(grantReward(s, rewardKey(cur, 5, 'ship'), 300), 0);
    assert.equal(s.xp, 90 + 4 * 50 + 300);
  });

  test(`${lang}: zero-hearts reset takes back only this attempt's XP and rewards`, () => {
    const s = up(lang === 'py' ? V1.pyPartial : V1.jsOne); // vault 0 completed earlier (keys null)
    grantReward(s, rewardKey(cur, 2, 0), 50); // earned in an earlier session (vault 3 is unfinished in both fixtures)
    const xpBefore = s.xp, awardedBefore = structuredClone(s.awarded);
    const run = newRun();
    assert.equal(grantReward(s, rewardKey(cur, 0, 0), 50, run), 0); // replayed challenge: nothing paid, nothing to take back
    assert.equal(grantReward(s, rewardKey(cur, 2, 0), 50, run), 0); // already earned before this attempt
    assert.equal(grantReward(s, rewardKey(cur, 2, 1), 60, run), 60); // new in this attempt
    assert.equal(grantReward(s, rewardKey(cur, 2, 2), 70, run), 70);
    assert.equal(rollbackRun(s, run), 130);
    assert.equal(s.xp, xpBefore); // historical XP never subtracted
    assert.deepEqual(s.awarded, awardedBefore); // earlier rewards still there
    assert.equal(rollbackRun(s, run), 0); // a second reset takes nothing more
    // The rolled-back rewards can be earned again — once.
    const run2 = newRun();
    assert.equal(grantReward(s, rewardKey(cur, 2, 1), 50, run2), 50);
    assert.equal(grantReward(s, rewardKey(cur, 2, 1), 50, run2), 0);
  });

  test(`${lang}: rewards survive a reload mid-attempt and are not paid twice afterwards`, () => {
    const s = up({ ...V1.ancient, lang }), run = newRun();
    grantReward(s, rewardKey(cur, 0, 0), 50, run);
    const reloaded = reload(s); // the in-memory attempt is gone; the save keeps what was paid
    assert.equal(reloaded.xp, 140);
    assert.equal(grantReward(reloaded, rewardKey(cur, 0, 0), 50, newRun()), 0);
  });

  test(`${lang}: a reset never removes a reward that was changed after it was paid`, () => {
    const s = up({ ...V1.ancient, lang }), run = newRun(), k = rewardKey(cur, 0, 0);
    grantReward(s, k, 50, run);
    s.awarded[k] = null; // e.g. replaced by a later migration
    assert.equal(rollbackRun(s, run), 0);
    assert.ok(k in s.awarded);
  });
}

// ── portfolio history (D3) ──
test('portfolio entries know their curriculum, including pre-versioning ones', () => {
  assert.equal(projectCurriculum('To-Do App'), 'js-1');
  assert.equal(projectCurriculum({ title: 'Guess the Number', lang: 'py', score: 90 }), 'py-1');
  assert.equal(projectCurriculum({ title: 'X', lang: 'js', curriculum: 'js-2' }), 'js-2');
  assert.equal(isEarlierVersion('To-Do App', LIVE_NOW), false);
  assert.equal(isEarlierVersion({ title: 'Guess the Number', lang: 'py' }, LIVE_NOW), false);
  assert.equal(isEarlierVersion('To-Do App', { py: 'py-1', js: 'js-2' }), true);
  assert.equal(isEarlierVersion({ title: 'Guess the Number', lang: 'py' }, { py: 'py-2', js: 'js-1' }), true);
  assert.equal(isEarlierVersion({ title: 'T', lang: 'js', curriculum: 'js-2' }, { py: 'py-1', js: 'js-2' }), false);
});
