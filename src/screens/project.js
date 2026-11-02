// Pro project mode: brief + milestones, editor, live preview, automated tests, AI code review.
// JS projects run against a real DOM (execApp); Python projects run in Pyodide with a test harness.
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
import { runPython, preloadPython } from '../run/py-runner.js';
import { playShipCinematic } from '../cine/ship.js';
import { openMap } from './map.js';
import { openProfile } from './profile.js';

export const PJ = { i: 0, lv: null, passed: [false, false, false, false], gained: 0 };
const isPy = () => PJ.lv?.kind === 'py';
const FALLBACK_FINAL = '**Final review: 90/100.** All milestones pass and the code is easy to follow. Next step: add one feature of your own.';

export function pjRefresh() {
  const ta = $('#pj-ta');
  $('#pj-hl').innerHTML = hl(ta.value, isPy() ? 'py' : 'js') + '\n';
  $('#pj-gut').innerHTML = Array.from({ length: ta.value.split('\n').length }, (_, k) => k + 1).join('<br>');
}

function renderMs() {
  const now = PJ.passed.indexOf(false);
  $('#pj-ms').innerHTML = PJ.lv.ms.map((m, k) => `<li class="${PJ.passed[k] ? 'ok' : k === now ? 'now' : ''}"><span class="mn">${PJ.passed[k] ? '✓' : k + 1}</span><div><b>${esc(m.n)}</b><span>${esc(m.d)}</span></div></li>`).join('');
  $('#pj-segs').innerHTML = PJ.passed.map((p, k) => `<i class="${p ? 'on' : k === now ? 'now' : ''}"></i>`).join('');
}

const term = html => { const a = $('#pv-app'); a.classList.add('term'); a.innerHTML = html; };

export function startProject(i) {
  const lv = LANGS[S.lang].levels[i];
  Object.assign(PJ, { i, lv, passed: [false, false, false, false], gained: 0 });
  const py = isPy();
  $('#pj-kick').textContent = `PRO PROJECT · ${LANGS[S.lang].name.toUpperCase()}`;
  $('#pj-file').textContent = py ? 'game.py' : 'app.js';
  $$('.pj-xtab').forEach(t => t.style.display = py ? 'none' : '');
  $('#pv-url').textContent = py ? 'python game.py — terminal' : 'localhost:3000 — my-todo-app';
  $('#pj-name').textContent = lv.title; $('#pj-brief').innerHTML = md(lv.brief);
  renderMs(); $('#pj-ta').value = lv.starter; pjRefresh();
  $('#pj-submit').style.display = 'none';
  $('#pj-cons').innerHTML = `<span class="dim">$ ${py ? 'pytest game.py' : 'npm test'}   — press RUN &amp; TEST to check your milestones</span>`;
  if (py) { term('<span class="dim">$ python game.py\nPress RUN &amp; TEST to play your game.</span>'); preloadPython(); }
  else { $('#pv-app').classList.remove('term'); execApp(lv.starter, $('#pv-app')); }
  $('#pj-msgs').innerHTML = ''; Mentor.use('pj'); updHud();
  go('s-project').then(() => Mentor.say(`Project time. You write **${py ? 'game.py' : 'app.js'}**. Four milestones on the left; I review your code every time you run it.`, { label: 'MENTOR' }));
}

// Python: user code, then a demo run for the preview, then the tests as one JSON line.
const PV = '__VQ_PREVIEW__', TS = '__VQ_TESTS__';
function pyHarness(code, lv) {
  const tests = JSON.stringify(lv.pyTests);
  return `${code}

import json as __vq_json
print(${JSON.stringify(PV)})
try:
${lv.demo.split('\n').map(l => '    ' + l).join('\n')}
except Exception as __e:
    print(f"{type(__e).__name__}: {__e}")
__vq_out = []
for __src, __exp in __vq_json.loads(${JSON.stringify(tests)}):
    try:
        __v = eval(__src)
        __vq_out.append(None if __v == __exp else f"{__src} should return {__exp!r}, got {__v!r}")
    except Exception as __e:
        __vq_out.append(f"{__src} raised {type(__e).__name__}: {__e}")
print(${JSON.stringify(TS)} + __vq_json.dumps(__vq_out))`;
}

// → { res: [null|failMessage ×4], err: Error|null }
async function runTests(code, lv) {
  if (!isPy()) {
    const err = execApp(code, $('#pv-app'));
    return { res: lv.tests.map(t => t(code, $('#pj-sandbox'), execApp)), err };
  }
  const r = await runPython(pyHarness(code, lv));
  if (!r) { term('<span class="err">Python runtime unavailable — check your internet connection and run again.</span>'); return { res: lv.ms.map(() => 'Python runtime unavailable'), err: new Error('Python runtime unavailable') }; }
  const lines = r.stdout.split('\n'), pi = lines.indexOf(PV), tl = lines.find(l => l.startsWith(TS));
  const own = pi >= 0 ? lines.slice(0, pi) : lines, demo = pi >= 0 ? lines.slice(pi + 1).filter(l => !l.startsWith(TS)) : [];
  const err = r.stderr ? new Error(r.stderr.split('\n').filter(Boolean).pop()) : null;
  term(`<span class="dim">$ python game.py</span>\n${esc([...own, ...demo].join('\n'))}${r.stderr ? `\n<span class="err">${esc(r.stderr)}</span>` : ''}`);
  const res = tl ? JSON.parse(tl.slice(TS.length)) : lv.ms.map(() => err ? err.message : 'tests did not run');
  return { res, err };
}

async function run() {
  const b = $('#pj-run'); if (b.disabled) return;
  b.disabled = true;
  const code = $('#pj-ta').value, cons = $('#pj-cons'), lv = PJ.lv, cmd = isPy() ? 'pytest game.py' : 'npm test';
  cons.innerHTML = `<span class="dim">$ ${cmd}</span>\n<span class="dim">running 4 checks…</span>`;
  anim($('.pv'), [{ boxShadow: '0 0 0 0 rgba(79,216,196,0)' }, { boxShadow: '0 0 0 3px rgba(79,216,196,.75), 0 0 40px rgba(79,216,196,.35)' }, { boxShadow: '0 0 0 0 rgba(79,216,196,0)' }], { duration: 900, fill: 'none' });
  const [{ res, err }] = await Promise.all([runTests(code, lv), wait(550)]);
  const before = PJ.passed.slice(); PJ.passed = res.map(r => r === null);
  cons.innerHTML = `<span class="dim">$ ${cmd}</span>\n` + res.map((r, k) => r === null ? `<span class="okl">✓ ${esc(lv.ms[k].n)}</span>` : `<span class="err">✗ ${esc(lv.ms[k].n)} — ${esc(r)}</span>`).join('\n');
  renderMs();
  const shipped = !!S.stars[S.lang + PJ.i]; // replaying a shipped project gives no XP
  let gained = false;
  PJ.passed.forEach((p, k) => {
    if (!p || before[k]) return;
    const li = $$('#pj-ms li')[k], c = ctr(li.querySelector('.mn'));
    FX.spark(c.x, c.y, 34, null, .6); FX.ring(c.x, c.y, 90, '#4FD8C4', 3);
    anim(li, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 450, fill: 'none' });
    if (!shipped) { S.xp += 50; PJ.gained += 50; gained = true; floatText('+50 XP', c.x + 90, c.y); }
  });
  if (gained) { updHud(); save(); }
  b.disabled = false;
  const ff = res.findIndex(r => r !== null);
  const failing = res.map((r, k) => r && { milestone: k + 1, message: r }).filter(Boolean);
  const payload = { lang: S.lang, project: lv.title, milestones: lv.ms.map(m => m.n), code, failing, final: false };
  if (err && ff !== -1) return Mentor.say(Mentor.review(payload, `Your code threw an error: \`${err.message}\`. Check that line.`).then(r => r.text), { kind: 'fix', label: 'CODE REVIEW' });
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
  const lv = PJ.lv, code = $('#pj-ta').value, fb = lv.final || FALLBACK_FINAL, fbScore = +(fb.match(/(\d+)\/100/) || [0, 90])[1];
  const r = Mentor.review({ lang: S.lang, project: lv.title, milestones: lv.ms.map(m => m.n), code, failing: [], final: true }, fb, fbScore);
  await Mentor.say(r.then(x => x.text), { kind: 'good', label: 'FINAL REVIEW' });
  const score = (await r).score || fbScore;
  await wait(1100);
  S.projects = (S.projects || []).filter(p => (p.title || p) !== lv.title);
  S.projects.push({ title: lv.title, lang: S.lang, score });
  if (!S.stars[S.lang + PJ.i]) { S.xp += 300; PJ.gained += 300; }
  S.stars[S.lang + PJ.i] = 3; save();
  s.disabled = false;
  await playShipCinematic({ score, xp: PJ.gained, title: lv.title, lang: LANGS[S.lang].name });
  updHud(); Mentor.use('lv'); openProfile();
}

function localAnswer(v) {
  const s = v.toLowerCase();
  if (isPy()) return /return|none/.test(s) ? 'A function without `return` gives back `None`. Every branch of `check` needs its own `return`.'
    : /loop|for|count/.test(s) ? 'Walk the list with `for g in guesses:` and keep a counter. Which line should stop the loop early?'
    : /if|elif|compare/.test(s) ? '`if` / `elif` / `else` let one function answer three different ways. Compare `guess` with `secret` using `<` and `>`.'
    : 'Look at the first red milestone in the console — what does the test expect, and what did your function return?';
  return /innerhtml/.test(s) ? '`innerHTML = …` replaces all children. To add one item, create an element and `appendChild` it — or update your data and re-render.'
    : /append|createelement/.test(s) ? '`document.createElement("li")` makes a new element; `list.appendChild(li)` puts it on the page.'
    : /click|onclick|event/.test(s) ? 'Assign a function: `button.onclick = () => { … }`. It runs every time the button is clicked.'
    : /done|class|toggle/.test(s) ? '`el.classList.toggle("done")` adds the class if missing and removes it if present.'
    : 'Break it into the milestone in front of you: what should the page look like after this step? Write the smallest code that gets there, then run the checks.';
}

export function mount() {
  const ta = $('#pj-ta');
  ta.oninput = pjRefresh;
  ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const n = isPy() ? 4 : 2, st = ta.selectionStart; ta.value = ta.value.slice(0, st) + ' '.repeat(n) + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = st + n; pjRefresh(); } };
  $('#pj-back').onclick = () => { Mentor.use('lv'); openMap(); };
  $('#pj-run').onclick = run;
  $('#pj-submit').onclick = submit;
  $('#pj-form').onsubmit = e => {
    e.preventDefault(); const i = $('#pj-in'), v = i.value.trim(); if (!v) return;
    i.value = ''; Mentor.user(v); S.questions++; award('curious'); save();
    Mentor.ask('ask', { lang: S.lang, challenge: { type: 'project', q: PJ.lv.brief, code: ta.value.slice(0, 4000) }, question: v }, localAnswer(v), { label: 'MENTOR' });
  };
  $('#s-share').onclick = () => { navigator.clipboard?.writeText(location.origin + '/#shipped').catch(() => {}); $('#s-share').textContent = 'LINK COPIED ✓'; };
}
