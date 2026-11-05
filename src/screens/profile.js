import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { go } from '../core/router.js';
import { S, save, lvlOf, resetState, logout, initials, LIVE } from '../core/state.js';
import { portfolioEntry } from '../learn/ship.js';
import { hl } from '../core/highlight.js';
import { createPreview } from '../run/sandbox/preview.js';
import { guarded, syntaxError, envOf } from '../run/project-js.js';
import { esc } from '../core/md.js';
import { updHud } from '../ui/hud.js';
import { ACH } from '../content/achievements.js';
import { LANGS } from '../content/languages.js';
import { startProject } from './project.js';

// World 1 progress per language: the regular vaults, then the Mini Boss (counted separately).
const pbar = (lang, col) => {
  const L = LANGS[lang], free = L.free, vaults = L.levels.slice(0, free).filter(l => !l.boss).length, d = Math.min(S.done[lang] || 0, free), boss = vaults < free;
  return `<div style="margin-top:16px"><div style="display:flex;justify-content:space-between"><span style="font-family:var(--disp);font-weight:600;font-size:19px">${L.name}</span><span style="font-family:var(--mono);font-size:13px;color:var(--mut)">${Math.min(d, vaults)} / ${vaults} vaults${boss ? ` · Mini Boss ${d >= free ? '✓' : '—'}` : ''}</span></div><div class="pbar"><i style="width:${d / free * 100}%;background:${col}"></i></div></div>`;
};
const weeks = () => Array.from({ length: 12 }, (_, w) => `<div style="display:grid;gap:5px">${Array.from({ length: 7 }, (_, d) => { const lv = (w === 11 && d >= 5) ? 3 : (w > 8 ? ((w * 3 + d) % 4) : 0); return `<span style="aspect-ratio:1;border-radius:4px;background:${['#141925', '#3A3120', '#6B5426', '#A9802F', '#F2B544'][lv]}"></span>`; }).join('')}</div>`).join('');

// Portfolio: one card per shipped project, built only from what was saved when it shipped (learn/ship.js).
// A JavaScript project runs its shipped code live in a sandboxed frame; a Python project shows the output
// its shipped code really printed. Projects from earlier versions keep their card, honestly labelled,
// without invented numbers or screenshots.
let shots = []; // live preview frames on the profile (cleared on every re-render)
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
function portfolio() {
  if (!S.projects || !S.projects.length) return '';
  const levels = { py: LANGS.py.levels, js: LANGS.js.levels };
  return S.projects.map((p, k) => {
    const e = portfolioEntry(p, LIVE, levels), pills = [];
    if (e.earlier) pills.push('<span class="pill" style="color:var(--mut)">Earlier version</span>');
    if (e.verified) {
      pills.push(`<span class="pill" style="color:var(--cyan)">${e.milestones.cleared}/${e.milestones.total} milestones</span>`, `<span class="pill" style="color:var(--cyan)">${e.checks.passed}/${e.checks.total} checks passed</span>`);
      if (e.review !== null) pills.push(`<span class="pill" style="color:var(--violet)">AI review ${e.review}/100</span>`);
      if (e.blueprint) pills.push('<span class="pill" style="color:var(--violet)">Planned with a Blueprint</span>');
    } else pills.push('<span class="pill" style="color:var(--mut)">No verification record</span>');
    const shot = !e.verified ? '<div class="pf-none">No snapshot was saved for this project.</div>'
      : e.lang === 'py' ? `<div class="pv-app term"><span class="dim">$ python game.py</span>\n${esc((e.output || '').replace(/\n$/, '')) || '<span class="dim">(no output)</span>'}</div>`
      : `<div class="pv-app frame pf-live" data-k="${k}"></div>`;
    const sub = `${LANGS[e.lang].name} · Pro project · shipped${e.shippedAt ? ' ' + fmtDate(e.shippedAt) : ''}${e.verified && e.runs !== null ? ` · ${e.runs} run${e.runs === 1 ? '' : 's'}, ${e.hearts}/3 hearts left` : ''}`;
    return `<div class="panel pf"><div class="pf-shot${e.verified && e.lang === 'js' ? ' pf-shot-live' : ''}">${shot}</div><div style="flex:1;min-width:0"><div class="kicker" style="color:var(--violet)">PORTFOLIO</div><div style="font-family:var(--disp);font-weight:700;font-size:30px;margin-top:4px">${esc(e.title)}</div><div style="color:var(--mut);font-size:14px;margin-top:2px">${esc(sub)}</div><div class="pf-pills">${pills.join('')}${S.ach.includes('builder') ? '<span class="pill" style="color:var(--gold)">Pro Builder</span>' : ''}</div>${e.verified ? `<pre class="codeblk pf-code" id="pf-code-${k}" hidden>${hl(e.code, e.lang)}</pre>` : ''}</div><div class="pf-acts">${e.reopen ? `<button class="btn pf-open" data-title="${esc(e.title)}" data-lang="${e.lang}">OPEN PROJECT ↗</button>` : ''}${e.verified ? `<button class="btn ghost pf-view" data-k="${k}">VIEW CODE</button>` : ''}<button class="btn ghost pf-share" data-k="${k}">COPY SUMMARY</button></div></div>`;
  }).join('');
}
// Starts the live apps of the JavaScript cards (sandboxed and loop-guarded, like the workspace preview).
function startShots() {
  shots.forEach(x => x.clear()); shots = [];
  const levels = { py: LANGS.py.levels, js: LANGS.js.levels };
  $$('.pf-live').forEach(box => {
    const e = portfolioEntry(S.projects[+box.dataset.k], LIVE, levels), lv = levels.js.find(l => l.t === 'project' && l.title === e.title);
    const safe = lv && !syntaxError(e.code) && guarded(e.code);
    if (!safe) { box.outerHTML = '<div class="pf-none">This code can\'t be previewed here.</div>'; return; }
    const pv = createPreview(box); pv.show(envOf(lv), safe, lv.preview); shots.push(pv);
  });
}
const summary = e => `${e.title} — a ${LANGS[e.lang].name} project I built on VaultQuest.${e.verified ? ` ${e.checks.passed}/${e.checks.total} automated checks pass, ${e.milestones.cleared}/${e.milestones.total} milestones.` : ''}`;

export function openProfile() {
  updHud();
  const tot = S.done.py + S.done.js, L = lvlOf(S.xp);
  $('#p-body').innerHTML = `<div class="panel p-top"><div class="p-av" style="${S.pro ? 'border-color:var(--violet);color:var(--violet)' : ''}">${initials()}<span style="${S.pro ? 'background:var(--violet)' : ''}">${S.pro ? 'PRO · ' : ''}LVL ${L}</span></div><div><div class="kicker" style="color:var(--gold)">${L > 1 ? 'VAULT CRACKER' : 'ROOKIE'}</div><div style="font-family:var(--disp);font-weight:700;font-size:34px">${esc(S.name || 'Your')}${S.name ? '’s' : ''} progress</div><div style="color:var(--mut);font-size:14px">${S.xp} XP total</div></div>
    <div class="p-stats"><div class="p-stat"><strong style="color:var(--gold)">${tot}</strong><span>vaults cracked</span></div><div class="p-stat"><strong style="color:var(--coral)">${S.streak}</strong><span>day streak</span></div><div class="p-stat"><strong style="color:var(--cyan)">${S.ach.length}</strong><span>achievements</span></div><div class="p-stat"><strong style="color:var(--violet)">${S.questions}</strong><span>questions asked</span></div></div></div>${portfolio()}
   <div class="panel"><div class="kicker">PATHS</div>${pbar('py', '#F2B544')}${pbar('js', '#4FD8C4')}<div class="kicker" style="margin-top:26px">ACTIVITY · LAST 12 WEEKS</div><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;margin-top:12px;max-width:300px" aria-hidden="true">${weeks()}</div><div class="p-acts"><button class="reset" id="p-reset">Reset progress</button><button class="reset" id="p-logout">Log out</button></div></div>
   <div class="panel"><div style="display:flex;justify-content:space-between"><div class="kicker">ACHIEVEMENTS</div><span style="font-family:var(--mono);font-size:13px;color:var(--mut)">${S.ach.length} / ${Object.keys(ACH).length}</span></div>
    <div class="ach">${Object.entries(ACH).map(([id, a]) => { const got = S.ach.includes(id), nw = S.fresh.includes(id); return `<div class="badge ${got ? '' : 'off'} ${nw ? 'new' : ''}" title="${a.d}">${nw ? '<span class="nw">NEW</span>' : ''}<svg width="54" height="54" viewBox="0 0 56 56" fill="none" aria-hidden="true"><path d="M28 3l21.7 12.5v25L28 53 6.3 40.5v-25z" fill="${got ? '#151A26' : '#0E121B'}" stroke="${got ? a.col : '#3A4256'}" stroke-width="2"/><path d="${a.ic}" stroke="${got ? a.col : '#3A4256'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${a.n}${got ? '' : ' <span class="sr">(locked)</span>'}</span></div>`; }).join('')}</div></div>`;
  startShots();
  $$('.pf-open').forEach(b => b.onclick = () => { shots.forEach(x => x.clear()); shots = []; S.lang = b.dataset.lang; const i = LANGS[S.lang].levels.findIndex(l => l.title === b.dataset.title); if (i >= 0) startProject(i, { shipped: true }); });
  $$('.pf-view').forEach(b => b.onclick = () => { const c = $('#pf-code-' + b.dataset.k); c.hidden = !c.hidden; b.textContent = c.hidden ? 'VIEW CODE' : 'HIDE CODE'; });
  const levels = { py: LANGS.py.levels, js: LANGS.js.levels };
  $$('.pf-share').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(summary(portfolioEntry(S.projects[+b.dataset.k], LIVE, levels))).catch(() => {}); b.textContent = 'COPIED ✓'; });
  $('#p-logout').onclick = () => { logout(); location.reload(); };
  $('#p-reset').onclick = () => { if (confirm('Reset all progress? This cannot be undone.')) { resetState(); location.reload(); } };
  go('s-profile').then(() => {
    $$('.badge').forEach((b, k) => anim(b, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: b.classList.contains('off') ? .45 : 1, transform: 'none' }], { duration: 500, delay: k * 60, easing: EASE.back, fill: 'none' }));
    $$('.badge.new').forEach((b, k) => wait(700 + k * 200).then(() => { const p = ctr(b); FX.spark(p.x, p.y, 24, null, .6); FX.ring(p.x, p.y, 90, '#F2B544', 3); }));
    S.fresh = []; save();
  });
}
