// The order of World 1 (learn/unlock.js) for both languages: FREE → Mini Boss → PRO → PRO Vault → Project →
// Final Boss, the reasons shown for locked steps, verified-only access to the Final Boss, and grandfathering of
// projects started or shipped under the earlier order — all derived from existing save fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS } from '../src/content/languages.js';
import { canEnter, isDone, lockReason, nextStep, roles, projectVerified } from '../src/learn/unlock.js';
import { fingerprint } from '../src/learn/fingerprint.js';

const base = lang => ({ lang, done: { py: 0, js: 0 }, stars: {}, pro: false, projects: [], curriculum: { py: 'py-2', js: 'js-2' }, attempts: {} });
// A verified Phase 9 record for this language's project.
const shipped = (lang, extra = {}) => { const lv = LANGS[lang].levels[6], code = 'x'; return { title: lv.title, lang, curriculum: lang + '-2', verified: true, checks: { passed: lv.checks.length, total: lv.checks.length }, milestones: { cleared: 4, total: 4 }, code, fp: fingerprint(code), shippedAt: 1, ...extra }; };

for (const lang of ['js', 'py']) {
  const L = LANGS[lang], R = roles(L), can = (S, i) => canEnter(S, lang, L, i);

  test(`${lang}: roles — PRO Vault 6, Project 7, Final Boss 8 (indexes 5, 6, 7)`, () => {
    assert.deepEqual([R.free, R.proVault, R.project, R.final], [5, 5, 6, 7]);
    assert.equal(L.levels[7].t, 'final'); assert.ok(L.levels[7].checks.length >= 12);
  });

  test(`${lang}: FREE path in order; nothing PRO before World 1 is cleared — even with PRO bought`, () => {
    const S = base(lang);
    assert.equal(can(S, 0), true); assert.equal(can(S, 1), false); assert.match(lockReason(S, lang, L, 1), /Vault 01/);
    S.done[lang] = 4; assert.equal(can(S, 4), true);
    S.pro = true;
    for (const i of [5, 6, 7]) { assert.equal(can(S, i), false, 'node ' + i); assert.match(lockReason(S, lang, L, i), /Mini Boss/); }
  });

  test(`${lang}: after checkout only the PRO Vault opens — never the project directly`, () => {
    const S = { ...base(lang), done: { py: 5, js: 5 } };
    assert.match(lockReason(S, lang, L, 5), /Unlock PRO/);
    S.pro = true;
    assert.equal(can(S, 5), true); assert.equal(can(S, 6), false); assert.equal(can(S, 7), false);
    assert.match(lockReason(S, lang, L, 6), /PRO Vault 06/); assert.match(lockReason(S, lang, L, 7), /PRO Vault 06/);
    assert.equal(nextStep(S, lang, L), 5);
  });

  test(`${lang}: Vault 6 opens the project; only a verified ship opens the Final Boss`, () => {
    const S = { ...base(lang), done: { py: 5, js: 5 }, pro: true, stars: { [lang + '5']: 3 } };
    assert.equal(can(S, 6), true); assert.equal(can(S, 7), false); assert.match(lockReason(S, lang, L, 7), /Ship .* every check/);
    assert.equal(nextStep(S, lang, L), 6);
    // opening the project, finishing the Blueprint, running it and clearing some milestones: still locked
    S.attempts[`${lang}-2:6`] = { workspace: { runs: 7, cleared: [true, true, false, false], shipped: false }, blueprint: { started: true } };
    assert.equal(can(S, 7), false);
    // an unverified / tampered record doesn't count
    S.projects = [{ ...shipped(lang), code: 'edited', fp: 'nope' }];
    assert.equal(can(S, 7), false);
    // a verified ship does
    S.projects = [shipped(lang)];
    assert.equal(can(S, 7), true); assert.equal(isDone(S, lang, L, 6), true); assert.equal(nextStep(S, lang, L), 7);
    // the Final Boss done: replay stays open
    S.stars[lang + '7'] = 2;
    assert.equal(isDone(S, lang, L, 7), true); assert.equal(can(S, 7), true);
  });

  test(`${lang}: a ship from an earlier curriculum doesn't count for this World 1's Final Boss`, () => {
    const S = { ...base(lang), done: { py: 5, js: 5 }, pro: true, stars: { [lang + '5']: 3 }, projects: [shipped(lang, { curriculum: lang + '-1' }), lang === 'js' ? 'To-Do App' : { title: 'Guess the Number', lang: 'py', score: 90 }] };
    assert.equal(projectVerified(S, lang, L), false); assert.equal(can(S, 7), false);
  });

  test(`${lang}: legacy user — shipped the project before Vault 6: keeps it, Final Boss opens as soon as Vault 6 is done`, () => {
    // shipped under the old order (projects opened with PRO), Vault 6 not done yet
    const S = { ...base(lang), done: { py: 5, js: 5 }, pro: true, projects: [shipped(lang)], attempts: { [`${lang}-2:6`]: { workspace: { shipped: true, runs: 4, cleared: [true, true, true, true] }, blueprint: { started: true } } } };
    assert.equal(can(S, 6), true, 'the shipped project stays open');
    assert.equal(isDone(S, lang, L, 6), true);
    assert.equal(can(S, 7), false); assert.match(lockReason(S, lang, L, 7), /PRO Vault 06/);
    assert.equal(nextStep(S, lang, L), 5);
    S.stars[lang + '5'] = 3; // then cracked Vault 6 — nothing replayed or reset
    assert.equal(can(S, 7), true); assert.equal(nextStep(S, lang, L), 7);
  });

  test(`${lang}: a project only started (Blueprint or runs) under the old order stays open, but proves nothing`, () => {
    const S = { ...base(lang), done: { py: 5, js: 5 }, pro: true, attempts: { [`${lang}-2:6`]: { blueprint: { started: true }, workspace: { runs: 0 } } } };
    assert.equal(can(S, 6), true); assert.equal(isDone(S, lang, L, 6), false); assert.equal(can(S, 7), false);
  });

  test(`${lang}: a ship recorded before Phase 9 records counts only with a saved workspace that shows every milestone cleared`, () => {
    const lv = L.levels[6], old = { title: lv.title, lang, curriculum: lang + '-2', score: 92 };
    const S = { ...base(lang), done: { py: 5, js: 5 }, pro: true, stars: { [lang + '5']: 3 }, projects: [old] };
    assert.equal(can(S, 7), false);
    S.attempts[`${lang}-2:6`] = { workspace: { shipped: true, cleared: [true, true, true, false] } };
    assert.equal(can(S, 7), false);
    S.attempts[`${lang}-2:6`] = { workspace: { shipped: true, cleared: [true, true, true, true] } };
    assert.equal(can(S, 7), true);
  });

  test(`${lang}: JavaScript and Python progress are independent`, () => {
    const other = lang === 'js' ? 'py' : 'js';
    const S = { ...base(lang), done: { [lang]: 5, [other]: 5 }, pro: true, stars: { [lang + '5']: 3 }, projects: [shipped(lang)] };
    assert.equal(can(S, 7), true);
    assert.equal(canEnter(S, other, LANGS[other], 6), false); assert.equal(canEnter(S, other, LANGS[other], 7), false);
  });
}
