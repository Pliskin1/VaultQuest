// Pro project mode: brief + milestones, app.js editor, live preview, automated tests, AI code review.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc, md } from '../core/md.js';
import { hl } from '../core/highlight.js';
import { go } from '../core/router.js';
import { S, save } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { award, floatText } from '../ui/toast.js';
import { Mentor } from '../ui/mentor.js';
import { LANGS } from '../content/languages.js';
import { execApp } from '../run/js-runner.js';
import { playShipCinematic } from '../cine/ship.js';
import { openMap } from './map.js';
import { openProfile } from './profile.js';

export const PJ = { i: 0, lv: null, passed: [false, false, false, false] };
const FINAL_FALLBACK = '**Final review: 92/100.** One `render()` owns the list, clear names, events wired cleanly. Next step: save `tasks` to `localStorage` so they survive a refresh.';

export function pjRefresh() {
  const ta = $('#pj-ta');
  $('#pj-hl').innerHTML = hl(ta.value, 'js') + '\n';
  $('#pj-gut').innerHTML = Array.from({ length: ta.value.split('\n').length }, (_, k) => k + 1).join('<br>');
}

function renderMs() {
  const now = PJ.passed.indexOf(false);
  $('#pj-ms').innerHTML = PJ.lv.ms.map((m, k) => `<li class="${PJ.passed[k] ? 'ok' : k === now ? 'now' : ''}"><span class="mn">${PJ.passed[k] ? '✓' : k + 1}</span><div><b>${esc(m.n)}</b><span>${esc(m.d)}</span></div></li>`).join('');
  $('#pj-segs').innerHTML = PJ.passed.map((p, k) => `<i class="${p ? 'on' : k === now ? 'now' : ''}"></i>`).join('');
}

export function startProject(i) {
  const lv = LANGS[S.lang].levels[i];
  Object.assign(PJ, { i, lv, passed: [false, false, false, false] });
  $('#pj-name').textContent = lv.title; $('#pj-brief').innerHTML = md(lv.brief);
  renderMs(); $('#pj-ta').value = lv.starter; pjRefresh();
  $('#pj-submit').style.display = 'none';
  $('#pj-cons').innerHTML = '<span class="dim">$ npm test   — press RUN &amp; TEST to check your milestones</span>';
  execApp(lv.starter, $('#pv-app'));
  $('#pj-msgs').innerHTML = ''; Mentor.use('pj'); updHud();
  go('s-project').then(() => Mentor.say('Project time. The HTML is ready — you write **app.js**. Four milestones on the left; I review your code every time you run it.', { label: 'MENTOR' }));
}

async function run() {
  const b = $('#pj-run'); if (b.disabled) return;
  b.disabled = true;
  const code = $('#pj-ta').value, cons = $('#pj-cons'), lv = PJ.lv;
  cons.innerHTML = '<span class="dim">$ npm test</span>\n<span class="dim">running 4 checks…</span>';
  anim($('.pv'), [{ boxShadow: '0 0 0 0 rgba(79,216,196,0)' }, { boxShadow: '0 0 0 3px rgba(79,216,196,.75), 0 0 40px rgba(79,216,196,.35)' }, { boxShadow: '0 0 0 0 rgba(79,216,196,0)' }], { duration: 900, fill: 'none' });
  await wait(550);
  const err = execApp(code, $('#pv-app'));
  const res = lv.tests.map(t => t(code, $('#pj-sandbox'), execApp));
  const before = PJ.passed.slice(); PJ.passed = res.map(r => r === null);
  cons.innerHTML = '<span class="dim">$ npm test</span>\n' + res.map((r, k) => r === null ? `<span class="okl">✓ ${esc(lv.ms[k].n)}</span>` : `<span class="err">✗ ${esc(lv.ms[k].n)} — ${esc(r)}</span>`).join('\n');
  renderMs();
  let gained = false;
  PJ.passed.forEach((p, k) => {
    if (!p || before[k]) return;
    const li = $$('#pj-ms li')[k], c = ctr(li.querySelector('.mn'));
    FX.spark(c.x, c.y, 34, null, .6); FX.ring(c.x, c.y, 90, '#4FD8C4', 3);
    anim(li, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 450, fill: 'none' });
    S.xp += 50; gained = true; floatText('+50 XP', c.x + 90, c.y);
  });
  if (gained) { updHud(); save(); }
  b.disabled = false;
  const ff = res.findIndex(r => r !== null);
  const failing = res.map((r, k) => r && { milestone: k + 1, message: r }).filter(Boolean);
  const payload = { lang: 'js', project: lv.title, milestones: lv.ms.map(m => m.n), code, failing, final: false };
  if (err) return Mentor.say(Mentor.review(payload, `Your code threw an error: \`${err.message}\`. Check that line.`).then(r => r.text), { kind: 'fix', label: 'CODE REVIEW' });
  if (ff === -1) {
    const s = $('#pj-submit'); s.style.display = 'inline-flex';
    anim(s, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: EASE.back, fill: 'none' });
    const c = ctr(s); FX.spark(c.x, c.y, 30, '#C9B8FF', .6);
    return Mentor.say('All 4 milestones pass. Try your app in the preview — then submit it for the full code review.', { kind: 'good', label: 'CODE REVIEW' });
  }
  const newly = PJ.passed.some((p, k) => p && !before[k]) && !(ff === 1 && /innerHTML\s*=\s*["'`]<li>/.test(code));
  const fallback = newly ? `Milestone ${ff} ✓${/appendChild/.test(code) ? ' — clean loop with `appendChild`' : ''}. Next: **${lv.ms[ff].n}**. ${lv.review(code, ff)}` : lv.review(code, ff);
  return Mentor.say(Mentor.review(payload, fallback).then(r => r.text), { kind: newly ? 'good' : 'fix', label: 'CODE REVIEW' });
}

async function submit() {
  const s = $('#pj-submit'); if (s.disabled) return;
  s.disabled = true;
  const lv = PJ.lv, code = $('#pj-ta').value;
  const r = Mentor.review({ lang: 'js', project: lv.title, milestones: lv.ms.map(m => m.n), code, failing: [], final: true }, FINAL_FALLBACK, 92);
  await Mentor.say(r.then(x => x.text), { kind: 'good', label: 'FINAL REVIEW' });
  const { score } = await r;
  await wait(1100);
  S.projects = (S.projects || []).filter(p => (p.title || p) !== lv.title);
  S.projects.push({ title: lv.title, lang: S.lang, score: score || 92 });
  const first = !S.stars[S.lang + PJ.i];
  S.stars[S.lang + PJ.i] = 3; if (first) S.xp += 300; save();
  s.disabled = false;
  await playShipCinematic({ score: score || 92, xp: 500 });
  updHud(); Mentor.use('lv'); openProfile();
}

function localAnswer(v) {
  const s = v.toLowerCase();
  return /innerhtml/.test(s) ? '`innerHTML = …` replaces all children. To add one item, create an element and `appendChild` it — or update your data and re-render.'
    : /append|createelement/.test(s) ? '`document.createElement("li")` makes a new element; `list.appendChild(li)` puts it on the page.'
    : /click|onclick|event/.test(s) ? 'Assign a function: `button.onclick = () => { … }`. It runs every time the button is clicked.'
    : /done|class|toggle/.test(s) ? '`el.classList.toggle("done")` adds the class if missing and removes it if present.'
    : 'Break it into the milestone in front of you: what should the page look like after this step? Write the smallest code that gets there, then run the checks.';
}

export function mount() {
  const ta = $('#pj-ta');
  ta.oninput = pjRefresh;
  ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const st = ta.selectionStart; ta.value = ta.value.slice(0, st) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = st + 2; pjRefresh(); } };
  $('#pj-back').onclick = () => { Mentor.use('lv'); openMap(); };
  $('#pj-run').onclick = run;
  $('#pj-submit').onclick = submit;
  $('#pj-form').onsubmit = e => {
    e.preventDefault(); const i = $('#pj-in'), v = i.value.trim(); if (!v) return;
    i.value = ''; Mentor.user(v); S.questions++; award('curious'); save();
    Mentor.ask('ask', { lang: 'js', challenge: { type: 'project', q: PJ.lv.brief, code: ta.value.slice(0, 4000) }, question: v }, localAnswer(v), { label: 'MENTOR' });
  };
  $('#s-share').onclick = () => { navigator.clipboard?.writeText(location.origin + '/#shipped').catch(() => {}); $('#s-share').textContent = 'LINK COPIED ✓'; };
}
