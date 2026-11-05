// Course certificate: when a course counts as complete, the name rules, and the certificate markup.
// Pure (no DOM, no state import), so it can be unit-tested in Node. The overlay lives in ./certificate.js.
// Layout: white A4-landscape paper (1123 × 794 at 96 dpi). Decorations are one SVG in that coordinate
// system; text sizes are in cqw (the paper is a size container), so the same markup works as a full-size
// certificate, a profile thumbnail and a printed A4 page.
import { esc } from '../core/md.js';
import { LANGS, FREE } from '../content/languages.js';
import { CERT_THEMES, CERT_DEFAULT, CERT_SIGNER } from '../content/certificates.js';

export const NAME_MIN = 2, NAME_MAX = 40;
export const NAME_PLACEHOLDER = 'Your Name';
export const themeOf = lang => CERT_THEMES[lang] || CERT_DEFAULT;

// Complete = every playable level of the course is done (free vaults count via `done`, Pro levels via stars).
// The last of them is the "final challenge"; when the Boss level ships it is required automatically.
export function courseComplete(st, lang) {
  const L = LANGS[lang];
  if (!L || !st || !L.levels.length) return false;
  const done = (st.done && st.done[lang]) || 0, stars = st.stars || {};
  return L.levels.every((_, i) => i < FREE ? i < done : !!stars[lang + i]);
}

// Names of the levels the certificate lists (all playable levels of the course, in map order).
export const courseTopics = lang => { const L = LANGS[lang]; return L ? L.levels.map((_, i) => L.titles[i]) : []; };

// Full name as typed → { name, error }. Any alphabet (č, ć, đ, š, ž, ü …), spaces, hyphens, apostrophes, dots.
export function cleanName(raw) {
  const name = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { name, error: 'Enter your full name' };
  if ([...name].length < NAME_MIN) return { name, error: `At least ${NAME_MIN} letters` };
  if ([...name].length > NAME_MAX) return { name, error: `At most ${NAME_MAX} characters` };
  if (!/^\p{L}[\p{L}\p{M} .'’-]*$/u.test(name)) return { name, error: 'Use letters, spaces, hyphens or apostrophes' };
  return { name, error: '' };
}

// Name font size in cqw: as large as the design (7.6) allows, smaller for long names so they stay on one line.
// Rounded down, so the name never ends up wider than the limit.
export const nameSize = name => Math.floor(Math.min(7.6, 80 / (Math.max(1, [...String(name || '')].length) * .52)) * 100) / 100;

// Today as YYYY-MM-DD in the player's own time zone (the day they finished, not the UTC day).
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m && MONTHS[+m[2] - 1] ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : '';
}

const join = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
// "for completing the full Python course “The Foundations”, covering Variables, …, as well as the project Guess the Number."
export function courseLine(lang, topics = []) {
  const L = LANGS[lang] || { name: lang, world: '' };
  const strip = re => topics.filter(t => re.test(t)).map(t => t.replace(re, ''));
  const projects = strip(/^Project:\s*/), bosses = strip(/^Boss:\s*/), concepts = topics.filter(t => !/^(Project|Boss):/.test(t));
  let s = `for completing the full ${L.name} course${L.world ? ` “${L.world}”` : ''}`;
  if (concepts.length) s += `, covering ${join(concepts)}`;
  if (projects.length) s += `${concepts.length ? ', as well as' : ', including'} the project${projects.length > 1 ? 's' : ''} ${join(projects)}`;
  if (bosses.length) s += ` and the boss challenge${bosses.length > 1 ? 's' : ''} ${join(bosses)}`;
  return s + '.';
}

// Vault wheel (ring, hub, six spokes): VaultQuest's stand-in for a course logo. Drawn at radius r.
const wheel = (cx, cy, r, col) =>
  `<g transform="translate(${cx} ${cy}) scale(${r / 40})" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"><circle r="40"/><circle r="12"/><path d="M0 -12V-40M0 12V40M-10.4 -6L-34.6 -20M10.4 6L34.6 20M-10.4 6L-34.6 20M10.4 -6L34.6 -20"/></g>`;

// Corner blobs with thin curves, cut-off rings, scattered wheels and the badge (no ids, so copies can coexist).
// preserveAspectRatio="none": the printed page is 1mm short of A4 (see certificate.css), so stretch, don't letterbox.
const decor = t => `<svg class="cert-bg" viewBox="0 0 1123 794" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<path d="M0 0H392C384 58 342 98 280 118C214 139 170 158 128 200C92 236 52 262 0 276Z" fill="${t.main}"/>
<path d="M0 196C86 150 178 136 262 112C340 90 396 52 438 0" fill="none" stroke="${t.deep}" stroke-width="2.5"/>
<path d="M1123 588C1062 600 1018 640 986 690C956 738 900 772 820 794H1123Z" fill="${t.main}"/>
<path d="M660 794C730 728 836 700 930 716C1010 730 1068 752 1123 744" fill="none" stroke="${t.deep}" stroke-width="2.5"/>
<circle cx="1072" cy="34" r="76" fill="none" stroke="${t.accent}" stroke-width="26"/>
<circle cx="-4" cy="468" r="62" fill="none" stroke="${t.accent}" stroke-width="22"/>
<path d="M948 458A74 74 0 0 1 948 606" fill="none" stroke="${t.accent}" stroke-width="22"/>
${wheel(118, 150, 48, '#FFFFFF')}${wheel(996, 278, 34, t.main)}${wheel(236, 700, 78, t.main)}
<circle cx="561" cy="122" r="46" fill="${t.main}"/><path d="M593.5 89.5A46 46 0 0 1 528.5 154.5Z" fill="${t.deep}"/>${wheel(561, 122, 26, '#FFFFFF')}
</svg>`;

const SIGNATURE = '<svg class="ct-sig" viewBox="0 0 120 40" aria-hidden="true" focusable="false"><path d="M4 30C12 10 20 4 24 10C28 17 18 32 14 34C10 36 16 22 26 18C34 15 30 30 36 30C42 30 44 16 50 16C55 16 52 28 58 28C66 28 70 12 80 14C88 16 84 26 92 24C100 22 106 16 116 12" fill="none" stroke="#2F3542" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// The certificate. An empty name shows the "Your Name" placeholder (live preview while the player types).
export function certificateHTML({ name = '', lang, date = '', topics = [] } = {}) {
  const t = themeOf(lang), course = (LANGS[lang] && LANGS[lang].name) || lang || '', shown = name || NAME_PLACEHOLDER;
  return `<article class="cert" aria-label="Certificate of Completion" style="--c-ink:${t.ink}">${decor(t)}`
    + '<p class="ct-title">Certificate of Completion</p>'
    + `<p class="ct-site">VaultQuest · ${esc(course)}</p>`
    + `<p class="ct-name${name ? '' : ' ph'}" style="font-size:${nameSize(shown)}cqw">${esc(shown)}</p>`
    + `<p class="ct-for">${esc(courseLine(lang, topics))}</p>`
    + `<p class="ct-date">${esc(formatDate(date))}</p>`
    + `<div class="ct-sign"><b>${esc(CERT_SIGNER.name)}</b><span>${esc(CERT_SIGNER.role)}</span>${SIGNATURE}<i></i></div>`
    + '</article>';
}
