// Certificate overlay. The first time a course is complete it asks for the player's full name (the paper
// updates live while they type), then issues the certificate: name, issue date and the levels passed are saved
// in S.certs[lang], so it reads the same every time it is opened again from the profile. Print / Save PDF prints
// only the paper (A4 landscape, see certificate.css). The full name stays on this device (never sent to /api).
import { $, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { FX } from '../core/fx.js';
import { S, save } from '../core/state.js';
import { LANGS } from '../content/languages.js';
import { certificateHTML, cleanName, courseComplete, courseTopics, formatDate, localDay, nameSize, themeOf, NAME_PLACEHOLDER } from './certificate-view.js';

let lang = 'py', mode = 'name', after = false, busy = false, resolve = null;
const cert = () => (S.certs || {})[lang];
const isOpen = () => $('#cert').classList.contains('on');

function render() {
  const c = cert();
  $('#ce-paper').innerHTML = certificateHTML({ name: mode === 'name' ? cleanName($('#ce-in').value).name : c.name, lang, date: c ? c.at : localDay(), topics: c ? c.topics : courseTopics(lang) });
}

function setMode(m) {
  mode = m;
  const c = cert(), naming = m === 'name', course = LANGS[lang].name;
  $('#ce-form').hidden = !naming; $('#ce-acts').hidden = naming;
  $('#ce-kick').textContent = naming ? `Course complete · ${course}` : `Certificate · ${course} · issued ${formatDate(c.at)}`;
  $('#ce-h').textContent = naming ? (c ? 'Change the name' : 'Claim your certificate') : 'Your certificate';
  $('#ce-go').textContent = c ? 'SAVE NAME' : 'ISSUE CERTIFICATE';
  $('#ce-later').textContent = c ? 'Cancel' : 'Later';
  $('#ce-done').firstChild.textContent = after ? 'CONTINUE ' : 'CLOSE ';
  if (naming) { $('#ce-in').value = (c && c.name) || S.fullName || ''; $('#ce-err').textContent = ''; }
  render();
}

// Live preview of the typed name on the paper.
function preview() {
  const { name } = cleanName($('#ce-in').value), el = $('#ce-paper .ct-name'), shown = name || NAME_PLACEHOLDER;
  el.textContent = shown; el.classList.toggle('ph', !name); el.style.fontSize = nameSize(shown) + 'cqw';
  $('#ce-err').textContent = '';
}

async function issue(e) {
  e.preventDefault();
  if (busy) return;
  const { name, error } = cleanName($('#ce-in').value);
  if (error) {
    $('#ce-err').textContent = error; $('#ce-in').focus();
    anim($('.ce-row'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300, fill: 'none' });
    return;
  }
  const first = !cert();
  // Issue date and level list are fixed when the certificate is issued; changing the name later keeps them.
  S.fullName = name;
  S.certs = { ...(S.certs || {}), [lang]: first ? { name, at: localDay(), topics: courseTopics(lang) } : { ...cert(), name } };
  save();
  setMode('view');
  $('#ce-done').focus();
  const paper = $('#ce-paper .cert'), p = ctr(paper), t = themeOf(lang);
  anim(paper, [{ transform: 'scale(.97)' }, { transform: 'scale(1.02)' }, { transform: 'none' }], { duration: 600, easing: EASE.back, fill: 'none' });
  if (!first) return;
  const r = paper.getBoundingClientRect();
  FX.spark(p.x, p.y, 70, null, 1.1); FX.spark(p.x, p.y, 40, t.main, 1); FX.ring(p.x, p.y, Math.max(r.width, 320) * .7, '#F2B544', 4);
  FX.spark(r.left, r.top, 30, t.accent, .8); FX.spark(r.right, r.bottom, 30, t.accent, .8);
}

function show() {
  const ov = $('#cert'), paper = $('#ce-paper');
  ov.classList.add('on');
  anim(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'none' });
  anim($('.ce'), [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE.out, fill: 'none' });
  if (after) anim(paper, [{ opacity: 0, transform: 'translateY(40px) rotate(-2deg) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: 150, easing: EASE.back, fill: 'backwards' });
  (mode === 'name' ? $('#ce-in') : $('#ce-done')).focus();
}

async function close() {
  if (busy || !isOpen()) return;
  busy = true;
  await anim($('#cert'), [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
  $('#cert').classList.remove('on'); $('#cert').getAnimations().forEach(a => a.cancel());
  busy = false;
  const r = resolve; resolve = null; r?.(!!cert());
}
// "Later" (not issued yet) closes; "Cancel" while changing the name goes back to the certificate.
const back = () => cert() ? setMode('view') : close();

// Opens the certificate for a course: name form if it hasn't been issued yet, else the certificate.
// Resolves when the overlay closes, with whether a certificate exists for that course now.
export function openCertificate(l, opts = {}) {
  if (resolve) resolve(!!cert());
  lang = l; after = !!opts.after;
  setMode(cert() ? 'view' : 'name');
  show();
  return new Promise(r => { resolve = r; });
}

// Called after a level or project is finished: offers the certificate once, when that finish completed the course.
export const maybeCertificate = (l = S.lang) => (S.certs || {})[l] || !courseComplete(S, l) ? Promise.resolve(false) : openCertificate(l, { after: true });

function printCert() {
  const title = document.title, done = () => { document.body.classList.remove('cert-print'); document.title = title; removeEventListener('afterprint', done); };
  document.title = `VaultQuest certificate · ${LANGS[lang].name} · ${cert().name}`; // default PDF file name
  document.body.classList.add('cert-print');
  addEventListener('afterprint', done);
  print();
}

export function mount() {
  $('#ce-form').onsubmit = issue;
  $('#ce-in').oninput = preview;
  $('#ce-later').onclick = back;
  $('#ce-x').onclick = close;
  $('#ce-done').onclick = close;
  $('#ce-edit').onclick = () => { setMode('name'); $('#ce-in').focus(); $('#ce-in').select(); };
  $('#ce-print').onclick = printCert;
  $('#cert').onclick = e => { if (e.target.id === 'cert' && mode !== 'name') close(); }; // a stray click can't skip the name form
  addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) mode === 'name' ? back() : close(); });
}
