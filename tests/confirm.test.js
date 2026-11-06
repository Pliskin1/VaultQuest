// Tests for the confirmation dialog that replaces window.confirm() (src/ui/confirm.js + #confirm in index.html)
// and the "Reset progress" summary it shows (src/ui/reset-view.js: what a reset wipes, with real numbers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetLosses, resetBody } from '../src/ui/reset-view.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jsFiles = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? jsFiles(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []);

const PLAYER = { name: 'DA', xp: 3100, done: { py: 5, js: 3 }, ach: Array(9).fill('a'), certs: { py: { name: 'Dana A' } }, projects: [{}, {}], streak: 4, pro: true };

// --- what a reset wipes -----------------------------------------------------------------------------------

test('reset summary: everything a reset wipes, with the player’s real numbers', () => {
  assert.deepEqual(resetLosses(PLAYER, 11).map(l => [l.v, l.label]), [
    [3100, 'XP · LVL 11'], [8, 'vaults cracked'], [9, 'achievements'], [1, 'certificate'], [2, 'shipped projects'], [4, 'day streak'], ['PRO', 'membership']
  ]);
});

test('reset summary: only what there is to lose — singular labels, and a 1-day streak is not a loss', () => {
  assert.deepEqual(resetLosses({ name: 'x', xp: 0, done: { py: 0, js: 0 }, ach: [], certs: {}, projects: [], streak: 1, pro: false }, 1), []);
  const one = resetLosses({ xp: 40, done: { py: 1 }, ach: ['first'], certs: {}, projects: [{}], streak: 2 }, 1).map(l => l.label);
  assert.deepEqual(one, ['XP · LVL 1', 'vault cracked', 'achievement', 'shipped project', 'day streak']);
  assert.equal(resetLosses({ xp: 300 }).at(0).label, 'XP', 'no level given: just XP');
});

test('reset summary: damaged or missing data is "nothing to lose", never a crash', () => {
  for (const st of [null, undefined, 'x', {}, { xp: 'NaN', done: null, ach: null, certs: null, projects: 'x', streak: -3, pro: 'yes' }]) assert.deepEqual(resetLosses(st, 1), [], JSON.stringify(st));
});

test('reset body: names the player (escaped), lists the losses, and says only the handle stays', () => {
  const html = resetBody(PLAYER, 11);
  assert.match(html, /Everything you’ve earned as <b>DA<\/b> on this device is wiped/);
  assert.equal((html.match(/class="cf-l"/g) || []).length, 7);
  assert.match(html, /Only your handle stays · this can’t be undone/);
  const evil = resetBody({ ...PLAYER, name: '<img src=x onerror=alert(1)>' }, 11);
  assert.doesNotMatch(evil, /<img/);
  assert.match(evil, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('reset body: a profile with nothing earned says so instead of showing empty tiles', () => {
  const html = resetBody({ name: 'new', xp: 0, streak: 1 }, 1);
  assert.doesNotMatch(html, /cf-loss/);
  assert.match(html, /nothing to lose/);
});

test('reset body matches resetState(): it keeps only the handle (update the dialog text if that changes)', () => {
  assert.match(read('src/core/state.js'), /export const resetState = \(\) => \{ const n = S\.name; [^\n]*Object\.assign\(S, fresh\(\), \{ name: n, lastDay: day\(\) \}\); save\(\); \};/);
});

// --- the dialog and its wiring ----------------------------------------------------------------------------

test('dialog: every element confirm.js looks up exists in index.html; it is an alert dialog outside #app', () => {
  const html = read('index.html'), js = read('src/ui/confirm.js');
  const ids = [...new Set([...js.matchAll(/\$\('#([\w-]+)/g)].map(m => m[1]))];
  assert.ok(ids.length >= 7);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `#${id} in index.html`);
  assert.match(html, /<div id="confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-body">/);
  const app = html.indexOf('<div id="app">'), appEnd = html.indexOf('\n</div>\n', app);
  assert.ok(html.indexOf('<div id="confirm"') > appEnd, '#confirm is outside #app');
});

test('CSS: every class the dialog and the reset summary use is styled, and the stylesheet is loaded', () => {
  const css = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter(f => f.endsWith('.css')).map(f => read(`src/styles/${f}`)).join('\n');
  const html = read('index.html'), box = html.slice(html.indexOf('<div id="confirm"'), html.indexOf('<div id="procine">'));
  const used = new Set([...box.matchAll(/class="([^"]+)"/g), ...resetBody(PLAYER, 11).matchAll(/class="([^"]+)"/g), ...resetBody({}, 1).matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  const missing = [...used].filter(c => !new RegExp(`\\.${c.replace(/-/g, '\\-')}(?![\\w-])`).test(css));
  assert.deepEqual(missing, []);
  assert.match(read('src/main.js'), /import '\.\/styles\/confirm\.css';/);
  assert.match(read('src/main.js'), /confirmDialog\]\.forEach\(m => m\.mount\(\)\)/);
});

test('no native browser dialogs are left in the app’s own code: alert / confirm / prompt break its look', () => {
  // lesson content and the student-code runners may mention or stub them; the app itself never calls them
  const own = jsFiles('src').filter(f => !/^src\/(content|run)\//.test(f));
  assert.ok(own.length > 30);
  for (const f of own) assert.doesNotMatch(read(f), /(^|[^\w.$])(alert|confirm|prompt)\(/m, f);
  assert.match(read('src/screens/profile.js'), /openConfirm\(\{ kicker: 'Danger zone', title: 'Reset all progress\?', body: resetBody\(S, lvlOf\(S\.xp\)\)/);
});
