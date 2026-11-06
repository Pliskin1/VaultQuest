// Tests for the course certificate (src/ui/certificate-view.js: completion rule, name rules, wording, markup)
// and its contracts with index.html, the stylesheets and the course colour themes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  courseComplete, courseTopics, courseLine, cleanName, nameSize, formatDate, localDay, certificateHTML, themeOf,
  NAME_MAX, NAME_PLACEHOLDER
} from '../src/ui/certificate-view.js';
import { LANGS } from '../src/content/languages.js';
import { CERT_THEMES, CERT_DEFAULT } from '../src/content/certificates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// State with the first `upTo` levels of a course finished (free vaults via done, Pro levels via stars).
function progress(lang, upTo, skip = []) {
  const st = { done: { py: 0, js: 0 }, stars: {} };
  for (let i = 0; i < upTo; i++) {
    if (skip.includes(i)) continue;
    if (i < LANGS[lang].free) st.done[lang] = i + 1;
    st.stars[lang + i] = 2;
  }
  return st;
}

// Minimal parser for markup we generate ourselves (handles `/>`, no '>' inside attribute values).
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] }, stack = [root];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.children.push({ tag: '#text', text: m[5], children: [] }); continue; }
    if (m[1]) { assert.equal(m[2], top.tag, `</${m[2]}> closes <${top.tag}>`); stack.pop(); continue; }
    const attrs = Object.fromEntries([...m[3].matchAll(/([a-zA-Z-:]+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
    const el = { tag: m[2], attrs, children: [] };
    top.children.push(el);
    if (!m[4]) stack.push(el);
  }
  assert.equal(stack.length, 1, 'every tag is closed');
  return root;
}
const all = (n, out = []) => { for (const c of n.children) { if (c.tag !== '#text') { out.push(c); all(c, out); } } return out; };
const text = n => n.tag === '#text' ? n.text : n.children.map(text).join('');
const byClass = (root, c) => all(root).find(n => (n.attrs.class || '').split(/\s+/).includes(c));
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const SAMPLE = { name: 'Ana-Marija Petrović', lang: 'py', date: '2026-11-05', topics: courseTopics('py') };

// --- when a course is complete ------------------------------------------------------------------------

test('complete: only when every playable level is done, the last one (the final challenge) included', () => {
  for (const lang of Object.keys(LANGS)) {
    const n = LANGS[lang].levels.length, free = LANGS[lang].free;
    assert.ok(n > free, `${lang} has Pro levels`);
    assert.equal(courseComplete(progress(lang, 0), lang), false, 'nothing done');
    assert.equal(courseComplete(progress(lang, free), lang), false, 'free vaults only');
    assert.equal(courseComplete(progress(lang, n - 1), lang), false, 'all but the final challenge');
    assert.equal(courseComplete(progress(lang, n), lang), true, 'everything done');
    assert.equal(courseComplete(progress(lang, n, [free]), lang), false, 'a Pro level skipped');
  }
});

test('complete: Pro levels can be finished in any order; progress in the other course does not count', () => {
  const st = progress('js', LANGS.js.levels.length);
  assert.equal(courseComplete(st, 'js'), true);
  assert.equal(courseComplete(st, 'py'), false);
  // free vaults are counted by `done` (the stars of a replayed vault alone are not enough)
  const noDone = { done: { py: 0 }, stars: Object.fromEntries(LANGS.py.levels.map((_, i) => ['py' + i, 3])) };
  assert.equal(courseComplete(noDone, 'py'), false);
});

test('complete: damaged or missing data is "not complete", never a crash', () => {
  assert.equal(courseComplete(null, 'py'), false);
  assert.equal(courseComplete({}, 'py'), false);
  assert.equal(courseComplete({ done: null, stars: null }, 'py'), false);
  assert.equal(courseComplete(progress('py', 6), 'java'), false, 'unknown course');
});

test('topics: the names of the course levels, in map order', () => {
  assert.deepEqual(courseTopics('py'), ['Variables', 'Data types', 'Conditions', 'Functions', 'Loops & Lists', 'Project: Guess the Number']);
  assert.equal(courseTopics('js').length, LANGS.js.levels.length);
  assert.deepEqual(courseTopics('nope'), []);
});

// --- wording --------------------------------------------------------------------------------------------

test('wording: course, topics and project in one sentence, like the reference certificate', () => {
  assert.equal(courseLine('py', courseTopics('py')),
    'for completing the full Python course “The Foundations”, covering Variables, Data types, Conditions, Functions and Loops & Lists, as well as the project Guess the Number.');
  assert.equal(courseLine('js', courseTopics('js')),
    'for completing the full JavaScript course “Web Basics”, covering Variables, Types, Conditions, Functions and Arrays & Loops, as well as the project To-Do App.');
});

test('wording: more projects and a boss level read naturally (ready for levels 7 and 8)', () => {
  const t = ['Variables', 'Loops', 'Project: To-Do App', 'Project: Pomodoro Timer', 'Boss: Weather App'];
  assert.equal(courseLine('js', t), 'for completing the full JavaScript course “Web Basics”, covering Variables and Loops, as well as the projects To-Do App and Pomodoro Timer and the boss challenge Weather App.');
  assert.equal(courseLine('py', ['Variables']), 'for completing the full Python course “The Foundations”, covering Variables.');
  assert.equal(courseLine('py', ['Project: Guess the Number']), 'for completing the full Python course “The Foundations”, including the project Guess the Number.');
});

// --- full name ------------------------------------------------------------------------------------------

test('name: real names in any alphabet are accepted and tidied', () => {
  for (const n of ['Ana-Marija Petrović', 'Đorđe Šćekić', 'José Álvarez', 'Siobhán O’Neil', "D'Angelo Russo", 'J. R. R. Tolkien', 'Žana Ćirić', 'Zoë Ødegaard', 'Ли Мин', 'Li']) {
    assert.deepEqual(cleanName(n), { name: n, error: '' }, n);
  }
  assert.deepEqual(cleanName('   Marko    Marković  '), { name: 'Marko Marković', error: '' }, 'extra spaces removed');
  assert.equal(cleanName('José').name, 'José', 'normalised (NFC), so the same name is stored the same way');
  assert.deepEqual(cleanName('x'.repeat(NAME_MAX)), { name: 'x'.repeat(NAME_MAX), error: '' });
});

test('name: empty, too short, too long and non-name input get a message', () => {
  for (const n of ['', '   ', null, undefined]) assert.equal(cleanName(n).error, 'Enter your full name');
  assert.match(cleanName('A').error, /at least 2/i);
  assert.match(cleanName('x'.repeat(NAME_MAX + 1)).error, /at most 40/i);
  for (const n of ['R2D2', '<b>Bold</b>', 'Ana 🚀', 'ana@mail.com', '-Ana', 'Ana_Marija']) assert.match(cleanName(n).error, /letters/, n);
});

test('name size: full size for normal names, smaller so a 40-character name still fits on one line', () => {
  assert.equal(nameSize('Avani Kanade'), 7.6);
  assert.equal(nameSize(NAME_PLACEHOLDER), 7.6);
  const long = 'Maximiliana Alessandra Konstantinovićeva'; // 40 characters
  assert.equal([...long].length, NAME_MAX);
  assert.ok(nameSize(long) < nameSize('Ana-Marija Petrović'));
  assert.ok(nameSize(long) * NAME_MAX * .52 <= 80.01, 'about 80% of the paper width at most');
  assert.ok(nameSize(long) >= 3.5, 'still large');
});

// --- date -----------------------------------------------------------------------------------------------

test('date: issue day written out like the reference ("June 3, 2024")', () => {
  assert.equal(formatDate('2026-11-05'), 'November 5, 2026');
  assert.equal(formatDate('2024-06-03'), 'June 3, 2024');
  assert.equal(formatDate('2027-01-31'), 'January 31, 2027');
  for (const bad of ['', undefined, '2026-13-01', '05.11.2026', 'soon']) assert.equal(formatDate(bad), '', String(bad));
});

test('date: the issue day is the player’s local day', () => {
  assert.equal(localDay(new Date(2026, 0, 9, 23, 59)), '2026-01-09');
  assert.equal(localDay(new Date(2026, 10, 5, 0, 1)), '2026-11-05');
  assert.match(localDay(), /^\d{4}-\d{2}-\d{2}$/);
});

// --- markup ---------------------------------------------------------------------------------------------

test('certificate: title, course, full name, wording with every topic, date and signer', () => {
  const root = parse(certificateHTML(SAMPLE)), t = s => unesc(text(byClass(root, s)));
  assert.equal(t('ct-title'), 'Certificate of Completion');
  assert.equal(t('ct-site'), 'VaultQuest · Python');
  assert.equal(t('ct-name'), 'Ana-Marija Petrović');
  assert.equal(t('ct-date'), 'November 5, 2026');
  const line = t('ct-for');
  for (const topic of SAMPLE.topics) assert.ok(line.includes(topic.replace(/^Project: /, '')), topic);
  assert.match(t('ct-sign'), /VAULT AI/);
  assert.equal(byClass(root, 'ct-name').attrs.style, 'font-size:7.6cqw');
});

test('certificate: without a name it shows the placeholder (live preview while typing)', () => {
  const root = parse(certificateHTML({ ...SAMPLE, name: '' })), nm = byClass(root, 'ct-name');
  assert.equal(text(nm), NAME_PLACEHOLDER);
  assert.match(nm.attrs.class, /\bph\b/);
  assert.doesNotMatch(byClass(parse(certificateHTML(SAMPLE)), 'ct-name').attrs.class, /\bph\b/);
});

test('certificate: names and topics are escaped, never parsed as HTML', () => {
  const html = certificateHTML({ ...SAMPLE, name: '<img src=x onerror=alert(1)>', topics: ['<script>x</script>'] });
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('certificate: decorations are hidden from screen readers and there are no ids (profile thumbnails + overlay coexist)', () => {
  const html = certificateHTML(SAMPLE), root = parse(html);
  assert.doesNotMatch(html, /\sid="/);
  const svg = all(root).filter(n => n.tag === 'svg');
  assert.ok(svg.length >= 2);
  for (const s of svg) assert.equal(s.attrs['aria-hidden'], 'true');
  assert.equal(all(root)[0].tag, 'article');
  assert.equal(all(root)[0].attrs['aria-label'], 'Certificate of Completion');
});

// --- colours per course ---------------------------------------------------------------------------------

const lum = hex => { const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrastOnWhite = hex => 1.05 / (lum(hex) + .05);

test('colours: every course has its own theme, and each certificate uses it', () => {
  const langs = Object.keys(LANGS);
  for (const l of langs) assert.ok(CERT_THEMES[l], `${l} has a theme`);
  assert.equal(new Set(langs.map(l => themeOf(l).main)).size, langs.length, 'a different main colour per course');
  assert.deepEqual(themeOf('cobol'), CERT_DEFAULT, 'unknown course falls back to the default theme');
  for (const l of langs) {
    const html = certificateHTML({ ...SAMPLE, lang: l }), t = themeOf(l);
    for (const k of ['main', 'deep', 'accent']) assert.ok(html.includes(`"${t[k]}"`), `${l} ${k} used`);
    assert.ok(html.includes(`--c-ink:${t.ink}`), `${l} ink used`);
    for (const other of langs.filter(o => o !== l)) assert.ok(!html.includes(`"${themeOf(other).main}"`), `${l} does not use ${other}'s colour`);
  }
});

test('colours: coloured text stays readable on the white paper (WCAG AA, 4.5:1)', () => {
  for (const [k, t] of [...Object.entries(CERT_THEMES), ['default', CERT_DEFAULT]]) {
    for (const v of Object.values(t)) assert.match(v, /^#[0-9A-F]{6}$/i, `${k}: ${v}`);
    assert.ok(contrastOnWhite(t.ink) >= 4.5, `${k} ink ${t.ink}: ${contrastOnWhite(t.ink).toFixed(2)}:1`);
  }
});

// --- contracts with index.html, CSS and the rest of the app ----------------------------------------------

test('overlay: every element certificate.js looks up exists in index.html, and #cert sits directly in <body> (print)', () => {
  const html = read('index.html'), js = read('src/ui/certificate.js');
  const ids = [...new Set([...js.matchAll(/\$\('#([\w-]+)/g)].map(m => m[1]))];
  assert.ok(ids.length >= 10);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `#${id} in index.html`);
  const app = html.indexOf('<div id="app">'), appEnd = html.indexOf('\n</div>\n', app), cert = html.indexOf('<div id="cert"');
  assert.ok(cert > appEnd, '#cert is outside #app');
  assert.match(html, /<input id="ce-in" maxlength="40" autocomplete="name"/, 'name field: browser can offer the saved full name; same limit as cleanName');
});

test('CSS: every class the certificate uses is styled, the stylesheet is loaded, and printing keeps only the paper', () => {
  const css = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter(f => f.endsWith('.css')).map(f => read(`src/styles/${f}`)).join('\n');
  const used = new Set(all(parse(certificateHTML(SAMPLE))).flatMap(n => (n.attrs.class || '').split(/\s+/).filter(Boolean)));
  const missing = [...used].filter(c => !new RegExp(`\\.${c.replace(/-/g, '\\-')}(?![\\w-])`).test(css));
  assert.deepEqual(missing, []);
  assert.match(read('src/main.js'), /import '\.\/styles\/certificate\.css';/);
  const cc = read('src/styles/certificate.css');
  assert.match(cc, /@page\{size:A4 landscape;margin:0\}/);
  assert.match(cc, /body\.cert-print>:not\(#cert\)\{display:none!important\}/);
  assert.match(cc, /\.cert\{[^}]*container-type:inline-size/);
});

test('privacy: the full name stays on this device (no module that talks to the server reads it)', () => {
  const files = ['src/ui/board.js', 'src/ui/mentor.js', 'src/ui/review.js', ...fs.readdirSync(path.join(ROOT, 'server')).filter(f => f.endsWith('.js')).map(f => `server/${f}`)];
  for (const f of files) assert.doesNotMatch(read(f), /fullName|certs/, f);
  assert.doesNotMatch(read('src/ui/certificate.js'), /fetch\(/);
});
