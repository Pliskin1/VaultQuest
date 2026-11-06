// Tests for the leaderboard loading skeleton (src/ui/board-skeleton.js) and the CSS it relies on.
// The builders return HTML strings, parsed here into a small tree (no DOM library needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { podiumSkeleton, rowsSkeleton, meSkeleton, SK_ROWS } from '../src/ui/board-skeleton.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Minimal parser for markup we generate ourselves (no '>' inside attribute values). Fails on unclosed tags.
const VOID = new Set(['hr', 'br', 'img', 'input']);
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] }, stack = [root];
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) { top.children.push({ tag: '#text', text: m[4], children: [] }); continue; }
    if (m[1]) { assert.equal(m[2], top.tag, `</${m[2]}> closes <${top.tag}>`); stack.pop(); continue; }
    const attrs = Object.fromEntries([...m[3].matchAll(/([a-z-]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const el = { tag: m[2], attrs, children: [] };
    top.children.push(el);
    if (!VOID.has(m[2])) stack.push(el);
  }
  assert.equal(stack.length, 1, 'every tag is closed');
  return root;
}
const kids = n => n.children.filter(c => c.tag !== '#text');
const classes = n => (n.attrs && n.attrs.class || '').split(/\s+/).filter(Boolean);
const has = (n, c) => classes(n).includes(c);
const all = (n, out = []) => { for (const c of kids(n)) { out.push(c); all(c, out); } return out; };
const text = n => n.tag === '#text' ? n.text : n.children.map(text).join('');
const isHidden = n => n.attrs['aria-hidden'] === 'true';

const podium = () => kids(parse(podiumSkeleton()));
const items = (n = undefined) => kids(parse(rowsSkeleton(n)));
const rows = n => items(n).filter(li => has(li, 'b-row'));

// --- podium -----------------------------------------------------------------------------------------

test('podium: three placeholders shown 2nd · 1st · 3rd, like the real podium', () => {
  const p = podium();
  assert.equal(p.length, 3);
  assert.deepEqual(p.map(d => classes(d).find(c => /^pd\d$/.test(c))), ['pd2', 'pd1', 'pd3']);
  for (const d of p) {
    assert.ok(has(d, 'pd') && has(d, 'sk-pd'), 'real .pd block (same width, pedestal height and colour) plus the skeleton modifier');
    assert.ok(isHidden(d), 'hidden from screen readers');
  }
});

test('podium: each placeholder has the real avatar, name, XP and pedestal boxes; only 1st keeps room for the crown', () => {
  for (const d of podium()) {
    const blocks = kids(d).map(k => classes(k)[0]);
    const first = has(d, 'pd1');
    assert.deepEqual(blocks, [...(first ? ['sk-crown'] : []), 'pd-av', 'pd-nm', 'pd-xp', 'pd-ped']);
    assert.ok(has(kids(d).find(k => has(k, 'pd-av')), 'sk-fill'), 'avatar circle shimmers');
    // The name bar sits in a <span> like the real name, so `.pd-nm span` gives it the name's font size and line height.
    const nm = kids(d).find(k => has(k, 'pd-nm'));
    assert.equal(kids(nm).length, 1);
    assert.equal(kids(nm)[0].tag, 'span');
    assert.ok(has(kids(kids(nm)[0])[0], 'sk-pnm'));
  }
});

test('podium: no names, numbers or other text', () => {
  assert.equal(text(parse(podiumSkeleton())).trim(), '');
});

// --- rankings -----------------------------------------------------------------------------------------

test('rows: 7 placeholder rows by default (ranks 4–10 of the top 10), any count on request', () => {
  assert.equal(SK_ROWS, 7);
  assert.equal(rows().length, 7);
  assert.equal(rows(3).length, 3);
  assert.equal(rows(0).length, 0);
  assert.equal(rows(-2).length, 0, 'a negative count renders no rows instead of throwing');
});

test('rows: same six cells as the rankings header in index.html, so the grid columns line up', () => {
  const header = read('index.html').match(/<div class="b-row b-cols"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(header, 'rankings header found in index.html');
  const headerCells = (header[1].match(/<span\b/g) || []).length;
  assert.equal(headerCells, 6);
  for (const li of rows()) {
    assert.ok(has(li, 'b-row'), 'real .b-row grid');
    const cells = kids(li);
    assert.equal(cells.length, headerCells);
    assert.deepEqual(cells.map(c => classes(c)[0]), ['b-rk', 'b-pl', 'b-c', 'b-c', 'b-c', 'b-xp']);
  }
});

test('rows: player cell has the real avatar circle (the phone layout hides it, like on real rows) and a name bar', () => {
  for (const li of rows()) {
    const pl = kids(li)[1];
    assert.ok(kids(pl).some(k => has(k, 'b-av') && has(k, 'sk-fill')));
    assert.ok(kids(pl).some(k => has(k, 'sk') && has(k, 'sk-nm')));
  }
});

test('rows: name bars vary in width, all between 30% and 80%', () => {
  const widths = rows().map(li => all(li).find(k => has(k, 'sk-nm')).attrs.style.match(/width:(\d+)%/)[1]).map(Number);
  assert.ok(new Set(widths).size > 1, 'not all the same width');
  for (const w of widths) assert.ok(w >= 30 && w <= 80, `${w}%`);
});

test('rows: screen readers get one "Loading rankings…" item; placeholder rows are hidden and have no text', () => {
  const list = items();
  const sr = list.filter(li => has(li, 'sr'));
  assert.equal(sr.length, 1);
  assert.equal(text(sr[0]), 'Loading rankings…');
  assert.ok(!isHidden(sr[0]), 'the loading message itself is readable');
  assert.equal(list[0], sr[0], 'announced first');
  for (const li of rows()) { assert.ok(isHidden(li)); assert.equal(text(li).trim(), ''); }
  assert.equal(items(0).length, 1, 'with no rows the loading message is still there');
});

// --- your position --------------------------------------------------------------------------------------

test('your-position panel: real heading first, every placeholder hidden from screen readers', () => {
  const top = kids(parse(meSkeleton()));
  assert.ok(has(top[0], 'kicker'));
  assert.equal(text(top[0]), 'YOUR POSITION');
  assert.ok(!isHidden(top[0]));
  for (const el of top.slice(1)) assert.ok(isHidden(el), `<${el.tag} class="${el.attrs.class}"> is aria-hidden`);
  assert.equal(top.slice(1).map(text).join('').trim(), '', 'placeholders have no text');
});

test('your-position panel: bars stand in for the rank, score and PLAY button, and nothing is focusable', () => {
  const nodes = all(parse(meSkeleton()));
  for (const c of ['b-big', 'b-sc', 'b-next', 'pbar', 'sk-big', 'sk-sc', 'sk-btn']) assert.ok(nodes.some(n => has(n, c)), c);
  const focusable = nodes.filter(n => ['button', 'a', 'input', 'select', 'textarea'].includes(n.tag) || 'tabindex' in n.attrs);
  assert.deepEqual(focusable, [], 'no placeholder button, so keyboard users cannot tab into it');
});

// --- CSS contract ---------------------------------------------------------------------------------------

test('CSS: every class the skeleton markup uses is styled', () => {
  // The app loads every stylesheet; .pbar (the "next up" bar) comes from profile.css, as on the real panel.
  const css = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter(f => f.endsWith('.css')).map(f => read(`src/styles/${f}`)).join('\n');
  const used = new Set([podiumSkeleton(), rowsSkeleton(), meSkeleton()].flatMap(h => all(parse(h)).flatMap(classes)));
  const missing = [...used].filter(c => !new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`).test(css));
  assert.deepEqual(missing, []);
});

test('CSS: the shimmer stops when the player asks for reduced motion', () => {
  const css = read('src/styles/board.css');
  assert.match(css, /@keyframes sk-shine\{/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.sk,\.sk-fill\{animation:none\}\}/);
});
