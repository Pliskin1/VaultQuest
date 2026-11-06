// Line numbers in the vault challenge editor (src/screens/level.js). They used to be a separate column drawn once
// from the starter code: lines added with Enter got no number, and on narrow screens, where long lines wrap, the
// numbers drifted away from their lines. Now every line of the highlight layer numbers itself (a CSS counter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeLines, hl } from '../src/core/highlight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter(f => f.endsWith('.css')).map(f => read(`src/styles/${f}`)).join('\n');
// the line blocks of codeLines() output, each block's inner (highlighted) html
const blocks = html => html.split('<span class="ln">').slice(1).map(b => b.replace(/<\/span>$/, ''));

test('one line block per line, including the empty line the caret sits on after Enter', () => {
  assert.equal(blocks(codeLines('const task = {\n  done: false\n};', 'js')).length, 3);
  const enter = blocks(codeLines('const task = {\n  done: false\n};\n', 'js'));
  assert.equal(enter.length, 4, 'Enter at the end adds a numbered line');
  assert.equal(enter[3], '');
  assert.equal(blocks(codeLines('a\n\n\n', 'py')).length, 4);
  assert.deepEqual(blocks(codeLines('', 'py')), [''], 'an empty editor still shows line 1');
  assert.deepEqual(blocks(codeLines(undefined, 'py')), ['']);
});

test('each line keeps its highlighting, and code is escaped, never parsed as HTML', () => {
  const src = 'def check(n):\n    if n < 10:  # small\n        print("<b>small</b>")';
  assert.deepEqual(blocks(codeLines(src, 'py')), src.split('\n').map(l => hl(l, 'py')));
  assert.doesNotMatch(codeLines(src, 'py'), /<b>|< 10/);
});

test('CSS: every line numbers itself and an empty line keeps one line of height', () => {
  assert.match(css, /\.ed pre\{[^}]*counter-reset:ln/);
  assert.match(css, /\.ed \.ln\{display:block;position:relative;min-height:1\.7em\}/);
  assert.match(css, /\.ed pre,\.ed textarea\{[^}]*line-height:1\.7;/, 'min-height 1.7em = one line of the editor');
  assert.match(css, /\.ed \.ln::before\{counter-increment:ln;content:counter\(ln\);position:absolute;top:0;right:100%/);
  assert.match(css, /\.ed \.gut\{[^}]*border-right:1px solid #161B27\}/, 'the gutter column keeps its border');
});

test('narrow screens: the highlight layer and the textarea wrap the same way, so numbers follow wrapped lines', () => {
  assert.match(read('src/styles/mobile.css'), /\.ed pre,\.ed textarea\{white-space:pre-wrap;overflow-wrap:anywhere\}/);
});

test('the editor draws its numbered lines from the code it shows and redraws them on every input (Enter, Tab, Reset)', () => {
  const level = read('src/screens/level.js');
  assert.match(level, /<div class="gut" aria-hidden="true"><\/div><pre id="ed-hl" aria-hidden="true">\$\{codeLines\(code, S\.lang\)\}<\/pre>/);
  assert.match(level, /ta\.oninput = \(\) => \{ \$\('#ed-hl'\)\.innerHTML = codeLines\(ta\.value, S\.lang\);/);
  assert.match(level, /ta\.selectionStart = ta\.selectionEnd = s \+ 4; ta\.oninput\(\);/, 'Tab goes through the same redraw');
  assert.match(level, /ta\.value = c\.code; ta\.oninput\(\);/, 'Reset goes through the same redraw');
});

test('the PRO workspace editor never wraps, so its separate number column stays aligned', () => {
  assert.match(css, /\.pj-in pre,\.pj-in textarea\{[^}]*white-space:pre;/);
  assert.doesNotMatch(css, /\.pj-in[^{}]*\{[^}]*white-space:pre-wrap/);
  assert.match(read('src/screens/project.js'), /\$\('#pj-gut'\)\.innerHTML = Array\.from\(\{ length: ta\.value\.split\('\\n'\)\.length \}/, 'redrawn on every input (pjRefresh)');
});
