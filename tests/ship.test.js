// Shipping and the portfolio (learn/ship.js) for both languages, against real runs: JavaScript through the
// real harness and checks (tests/helpers/frame.js), Python through the real harness and python3. Only
// fully verified code ships; records are real, never duplicated, and old entries stay as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { LANGS } from '../src/content/languages.js';
import { verifyForShip, shipRecord, upsertProject, portfolioEntry, finalText, MAX_CODE } from '../src/learn/ship.js';
import { newAttempt, beginSubmission, toSave, fromSave } from '../src/learn/attempt.js';
import { judgeRun, settleRun, canSubmit } from '../src/learn/workspace.js';
import { startBuilding } from '../src/learn/blueprint.js';
import { runJsProject } from '../src/run/project-js.js';
import { pyProjectHarness, parsePyProject, pyChecks } from '../src/run/project-py.js';
import { seedOf } from '../src/run/seed.js';
import { fingerprint } from '../src/learn/fingerprint.js';
import { vmFrame } from './helpers/frame.js';
import { RENDER } from './helpers/solutions.js';

const LIVE = { py: 'py-2', js: 'js-2' }, LEVELS = { py: LANGS.py.levels, js: LANGS.js.levels };
const lvOf = lang => LANGS[lang].levels[6];
const PY_GOOD = 'def check(guess, secret):\n    if guess < secret:\n        return "Too low"\n    elif guess > secret:\n        return "Too high"\n    else:\n        return "Correct!"\n\n\ndef play(secret, guesses):\n    tries = 0\n    for g in guesses:\n        tries += 1\n        if check(g, secret) == "Correct!":\n            return tries\n    return tries\n';
const PY_LEN = PY_GOOD.replace(/def play[\s\S]*/, 'def play(secret, guesses):\n    return len(guesses)\n');
function python(code) {
  const src = pyProjectHarness(code, lvOf('py').demo, pyChecks(lvOf('py'), seedOf(code)));
  try { return parsePyProject({ stdout: execFileSync('python3', ['-I', '-c', src], { timeout: 4000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' }, lvOf('py').checks); }
  catch (e) { return parsePyProject({ stdout: e.stdout ?? '', stderr: e.signal ? 'TimeoutError: ran longer than 4 seconds' : e.stderr ?? '' }, lvOf('py').checks); }
}
const run = (lang, code) => lang === 'js' ? runJsProject(code, lvOf('js'), { seed: seedOf(code), runFrame: vmFrame }) : Promise.resolve(python(code));
const GOOD = { js: RENDER, py: PY_GOOD }, BAD = { js: () => lvOf('js').starter, py: () => PY_LEN };
const ids = lang => lvOf(lang).blueprint.sections.map(s => s.id);
// An attempt that really got to "all milestones cleared" by running the good code.
async function finished(lang) {
  const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids(lang) });
  a.blueprint.waived = true;
  const r = await run(lang, GOOD[lang]), t = beginSubmission(a), j = judgeRun(a.workspace, r, 4);
  settleRun(a, t, { code: GOOD[lang], run: r, judged: j });
  return { a, r };
}

for (const lang of ['js', 'py']) {
  const lv = lvOf(lang);

  test(`${lang}: the real solution passes the final verification and makes a record of what was verified`, async () => {
    const { a, r } = await finished(lang);
    const v = verifyForShip(lv, r);
    assert.deepEqual(v, { ok: true, reason: null, passed: lv.checks.length, total: lv.checks.length, failed: [] });
    const rec = shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, now: 1700000000000 });
    assert.equal(rec.title, lv.title); assert.equal(rec.lang, lang); assert.equal(rec.curriculum, lang + '-2'); assert.equal(rec.verified, true);
    assert.deepEqual(rec.checks, { passed: lv.checks.length, total: lv.checks.length }); assert.deepEqual(rec.milestones, { cleared: 4, total: 4 });
    assert.equal(rec.code, GOOD[lang]); assert.equal(rec.fp, fingerprint(GOOD[lang])); assert.equal(rec.shippedAt, 1700000000000);
    assert.equal(rec.hearts, 3); assert.equal(rec.runs, 1);
    if (lang === 'py') assert.match(rec.output, /Solved in 4 tries/); else assert.equal(rec.output, undefined);
    assert.equal(rec.review, undefined); // no AI review → no score at all
  });

  test(`${lang}: unfinished or failing code never ships`, async () => {
    const r = await run(lang, BAD[lang]());
    const v = verifyForShip(lv, r);
    assert.equal(v.ok, false); assert.equal(v.reason, 'checks'); assert.ok(v.passed < v.total && v.failed.length > 0);
    assert.equal(shipRecord({ lv, lang, curriculum: lang + '-2', a: newAttempt(lang, 6, lang + '-2', { workspace: 4 }), code: 'x', run: r, verify: v }), null);
    const all = await run(lang, GOOD[lang]);
    for (const broken of [{ ...all, timeout: true }, { ...all, error: { name: 'Error', message: 'x' } }, { ...all, checks: all.checks.slice(1) }, { cancelled: true }, { unavailable: true }, { unsafe: true }, null]) {
      assert.equal(verifyForShip(lv, broken).ok, false, JSON.stringify(broken)?.slice(0, 80));
    }
  });

  test(`${lang}: a forged "passed" state can't ship — the final verification runs the code again`, async () => {
    const a = newAttempt(lang, 6, lang + '-2', { workspace: 4, blueprint: ids(lang) });
    a.blueprint.waived = true;
    const starter = lv.starter, raw = JSON.parse(JSON.stringify(toSave(a)));
    raw.workspace.passKey = `${lang}:6:0:code:${fingerprint(starter)}`; raw.workspace.cleared = [true, true, true, true];
    const forged = fromSave(raw, { lang, vault: 6, curriculum: lang + '-2', challenges: 1, workspace: 4, blueprint: ids(lang) });
    assert.equal(canSubmit(forged, starter), true); // the UI would offer SUBMIT…
    assert.equal(verifyForShip(lv, await run(lang, starter)).ok, false); // …but the verification refuses it
  });

  test(`${lang}: an AI review score is kept only when the AI gave it`, async () => {
    const { a, r } = await finished(lang), v = verifyForShip(lv, r);
    assert.deepEqual(shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, review: { score: 94, ai: true } }).review, { score: 94, ai: true });
    assert.equal(shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, review: { score: 94, ai: false } }).review, undefined);
    assert.equal(shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, review: { score: null, ai: true } }).review, undefined);
  });

  test(`${lang}: the scripted final review states only verified facts — no score`, async () => {
    const { a, r } = await finished(lang), v = verifyForShip(lv, r);
    const t = finalText({ lv, verify: v, a });
    assert.ok(!/\/100|score/i.test(t), t); assert.match(t, new RegExp(`All ${v.total} checks pass`)); assert.match(t, /after 1 run, with 3\/3 hearts left/);
    assert.ok(!/Blueprint/.test(t)); // waived: no plan, so no claim about one
    for (const id of ids(lang)) a.blueprint.sections[id] = { ...a.blueprint.sections[id], draft: 'x', accepted: 'x', status: 'accepted', doneAs: 'accepted' };
    a.blueprint.waived = false; startBuilding(a.blueprint, lv.blueprint);
    assert.match(finalText({ lv, verify: v, a }), /planned it in your Blueprint first/);
  });

  test(`${lang}: re-shipping replaces the record — never a duplicate; other entries stay untouched`, async () => {
    const { a, r } = await finished(lang), v = verifyForShip(lv, r), other = lang === 'js' ? 'py' : 'js';
    const legacy = [lang === 'js' ? 'To-Do App' : { title: 'Guess the Number', lang: 'py', score: 90 }, { title: lvOf(other).title, lang: other, curriculum: other + '-2', verified: true }];
    let projects = [...legacy];
    const rec1 = shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, now: 1 });
    projects = upsertProject(projects, rec1); projects = upsertProject(projects, rec1);
    const rec2 = { ...rec1, shippedAt: 2 };
    projects = upsertProject(projects, rec2);
    assert.equal(projects.length, 3); assert.deepEqual(projects.slice(0, 2), legacy); assert.equal(projects[2].shippedAt, 2);
  });

  test(`${lang}: the portfolio shows verified records as verified, and nothing else`, async () => {
    const { a, r } = await finished(lang), v = verifyForShip(lv, r);
    const rec = shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v, now: 1700000000000 });
    const e = portfolioEntry(JSON.parse(JSON.stringify(rec)), LIVE, LEVELS);
    assert.equal(e.verified, true); assert.equal(e.earlier, false); assert.equal(e.reopen, true);
    assert.deepEqual(e.checks, rec.checks); assert.equal(e.code, GOOD[lang]); assert.equal(e.shippedAt, 1700000000000); assert.equal(e.review, null);
    // tampered records are not shown as verified
    for (const bad of [{ ...rec, code: rec.code + '\n// edited' }, { ...rec, checks: { passed: 3, total: 3 } }, { ...rec, verified: 'yes' }, { ...rec, milestones: null }, { ...rec, title: 'Something Else' }]) {
      assert.equal(portfolioEntry(bad, LIVE, LEVELS).verified, false, JSON.stringify(bad).slice(0, 60));
    }
  });

  test(`${lang}: JavaScript and Python records are independent`, async () => {
    const { a, r } = await finished(lang), v = verifyForShip(lv, r), other = lang === 'js' ? 'py' : 'js';
    const rec = shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v });
    const projects = upsertProject([{ title: lvOf(other).title, lang: other, curriculum: other + '-2' }], rec);
    assert.equal(projects.length, 2);
    assert.deepEqual(projects.map(p => p.lang).sort(), ['js', 'py']);
  });
}

for (const lang of ['js', 'py']) {
  test(`${lang}: a shipped record keeps exactly the verified code — over-limit code is refused, never truncated`, async () => {
    const lv = lvOf(lang), { a, r } = await finished(lang), v = verifyForShip(lv, r);
    const atLimit = GOOD[lang] + '#'.repeat(MAX_CODE - GOOD[lang].length); // exactly the limit
    const rec = shipRecord({ lv, lang, curriculum: lang + '-2', a, code: atLimit, run: r, verify: v });
    assert.equal(rec.code, atLimit); assert.equal(rec.code.length, MAX_CODE); assert.equal(rec.fp, fingerprint(atLimit));
    assert.equal(portfolioEntry(rec, LIVE, LEVELS).code, atLimit);
    assert.equal(shipRecord({ lv, lang, curriculum: lang + '-2', a, code: atLimit + '#', run: r, verify: v }), null);
    assert.equal(shipRecord({ lv, lang, curriculum: lang + '-2', a, code: null, run: r, verify: v }), null);
  });

  test(`${lang}: "Planned with a Blueprint" only for a genuinely completed Blueprint`, async () => {
    const lv = lvOf(lang), { a, r } = await finished(lang), v = verifyForShip(lv, r);
    const rec = () => shipRecord({ lv, lang, curriculum: lang + '-2', a, code: GOOD[lang], run: r, verify: v });
    assert.equal(rec().blueprint, false); // waived (shipped before Blueprints)
    a.blueprint.waived = false;
    assert.equal(rec().blueprint, false); // no plan at all
    for (const id of ids(lang).slice(0, 4)) a.blueprint.sections[id] = { ...a.blueprint.sections[id], draft: 'x', accepted: 'x', status: 'accepted', doneAs: 'accepted' };
    assert.equal(startBuilding(a.blueprint, lv.blueprint), false); assert.equal(rec().blueprint, false); // 4 of 5 sections
    const last = ids(lang)[4]; a.blueprint.sections[last] = { ...a.blueprint.sections[last], draft: 'x', accepted: 'x', status: 'kept', doneAs: 'kept' };
    assert.equal(startBuilding(a.blueprint, lv.blueprint), true); assert.equal(rec().blueprint, true);
    assert.equal(portfolioEntry(JSON.parse(JSON.stringify(rec())), LIVE, LEVELS).blueprint, true);
    assert.equal(portfolioEntry({ ...rec(), blueprint: 'yes' }, LIVE, LEVELS).blueprint, false);
  });
}

test('older portfolio entries stay as they are: earlier version, no verification record, no invented score', () => {
  for (const old of ['To-Do App', { title: 'To-Do App', lang: 'js', score: 92 }, { title: 'Guess the Number', lang: 'py', score: 90 }, { title: 'To-Do App', lang: 'js', score: 92, curriculum: 'js-1' }]) {
    const e = portfolioEntry(old, LIVE, LEVELS);
    assert.equal(e.verified, false); assert.equal(e.earlier, true); assert.equal(e.reopen, true);
    assert.equal(e.checks, undefined); assert.equal(e.review, undefined); assert.equal(e.code, undefined);
  }
  assert.equal(portfolioEntry({ title: 'Unknown Thing', lang: 'js' }, LIVE, LEVELS).reopen, false);
  assert.equal(portfolioEntry(null, LIVE, LEVELS).verified, false);
});
