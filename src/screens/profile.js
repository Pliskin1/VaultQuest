import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { go } from '../core/router.js';
import { S, save, lvlOf, resetState, logout, initials } from '../core/state.js';
import { esc } from '../core/md.js';
import { updHud } from '../ui/hud.js';
import { ACH } from '../content/achievements.js';
import { LANGS } from '../content/languages.js';
import { startProject } from './project.js';

const pbar = (name, d, n, col) => `<div style="margin-top:16px"><div style="display:flex;justify-content:space-between"><span style="font-family:var(--disp);font-weight:600;font-size:19px">${name}</span><span style="font-family:var(--mono);font-size:13px;color:var(--mut)">${d} / ${n} vaults</span></div><div class="pbar"><i style="width:${d / n * 100}%;background:${col}"></i></div></div>`;
const weeks = () => Array.from({ length: 12 }, (_, w) => `<div style="display:grid;gap:5px">${Array.from({ length: 7 }, (_, d) => { const lv = (w === 11 && d >= 5) ? 3 : (w > 8 ? ((w * 3 + d) % 4) : 0); return `<span style="aspect-ratio:1;border-radius:4px;background:${['#141925', '#3A3120', '#6B5426', '#A9802F', '#F2B544'][lv]}"></span>`; }).join('')}</div>`).join('');

const JS_SHOT = '<div class="pv-app"><div class="pv-todo"><h3>My tasks</h3><ul style="margin-top:4px"><li class="done">Learn JavaScript</li><li>Crack a vault</li><li>Ship VaultQuest</li></ul><p>2 left</p></div></div>';
const PY_SHOT = '<div class="pv-app term"><span class="dim">$ python game.py</span>\n&gt; guess 50   Too high\n&gt; guess 25   Too low\n&gt; guess 37   Too low\n&gt; guess 42   Correct!\n<span class="ok">Solved in 4 tries</span></div>';

function portfolio() {
  if (!S.projects || !S.projects.length) return '';
  return S.projects.map(p => {
    const pr = typeof p === 'string' ? { title: p, lang: 'js', score: 92 } : p;
    return `<div class="panel pf"><div class="pf-shot" aria-hidden="true">${pr.lang === 'py' ? PY_SHOT : JS_SHOT}</div><div style="flex:1"><div class="kicker" style="color:var(--violet)">PORTFOLIO · NEW</div><div style="font-family:var(--disp);font-weight:700;font-size:30px;margin-top:4px">${esc(pr.title)}</div><div style="color:var(--mut);font-size:14px;margin-top:2px">${LANGS[pr.lang].name} · Pro project · shipped</div><div style="display:flex;gap:8px;margin-top:12px"><span class="pill" style="color:var(--cyan)">4/4 milestones</span><span class="pill" style="color:var(--violet)">AI review ${pr.score}/100</span><span class="pill" style="color:var(--gold)">Certificate</span></div></div><div style="display:flex;flex-direction:column;gap:10px"><button class="btn pf-open" data-title="${pr.title}" data-lang="${pr.lang}">VIEW LIVE APP ↗</button><button class="btn ghost pf-share">SHARE ON LINKEDIN</button></div></div>`;
  }).join('');
}

export function openProfile() {
  updHud();
  const tot = S.done.py + S.done.js, L = lvlOf(S.xp);
  $('#p-body').innerHTML = `<div class="panel p-top"><div class="p-av" style="${S.pro ? 'border-color:var(--violet);color:var(--violet)' : ''}">${initials()}<span style="${S.pro ? 'background:var(--violet)' : ''}">${S.pro ? 'PRO · ' : ''}LVL ${L}</span></div><div><div class="kicker" style="color:var(--gold)">${L > 1 ? 'VAULT CRACKER' : 'ROOKIE'}</div><div style="font-family:var(--disp);font-weight:700;font-size:34px">${esc(S.name || 'Your')}${S.name ? '’s' : ''} progress</div><div style="color:var(--mut);font-size:14px">${S.xp} XP total</div></div>
    <div class="p-stats"><div class="p-stat"><strong style="color:var(--gold)">${tot}</strong><span>vaults cracked</span></div><div class="p-stat"><strong style="color:var(--coral)">${S.streak}</strong><span>day streak</span></div><div class="p-stat"><strong style="color:var(--cyan)">${S.ach.length}</strong><span>achievements</span></div><div class="p-stat"><strong style="color:var(--violet)">${S.questions}</strong><span>questions asked</span></div></div></div>${portfolio()}
   <div class="panel"><div class="kicker">PATHS</div>${pbar('Python', S.done.py, 8, '#F2B544')}${pbar('JavaScript', S.done.js, 8, '#4FD8C4')}<div class="kicker" style="margin-top:26px">ACTIVITY · LAST 12 WEEKS</div><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;margin-top:12px;max-width:300px" aria-hidden="true">${weeks()}</div><div class="p-acts"><button class="reset" id="p-reset">Reset progress</button><button class="reset" id="p-logout">Log out</button></div></div>
   <div class="panel"><div style="display:flex;justify-content:space-between"><div class="kicker">ACHIEVEMENTS</div><span style="font-family:var(--mono);font-size:13px;color:var(--mut)">${S.ach.length} / ${Object.keys(ACH).length}</span></div>
    <div class="ach">${Object.entries(ACH).map(([id, a]) => { const got = S.ach.includes(id), nw = S.fresh.includes(id); return `<div class="badge ${got ? '' : 'off'} ${nw ? 'new' : ''}" title="${a.d}">${nw ? '<span class="nw">NEW</span>' : ''}<svg width="54" height="54" viewBox="0 0 56 56" fill="none" aria-hidden="true"><path d="M28 3l21.7 12.5v25L28 53 6.3 40.5v-25z" fill="${got ? '#151A26' : '#0E121B'}" stroke="${got ? a.col : '#3A4256'}" stroke-width="2"/><path d="${a.ic}" stroke="${got ? a.col : '#3A4256'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${a.n}${got ? '' : ' <span class="sr">(locked)</span>'}</span></div>`; }).join('')}</div></div>`;
  $$('.pf-open').forEach(b => b.onclick = () => { S.lang = b.dataset.lang; const i = LANGS[S.lang].levels.findIndex(l => l.title === b.dataset.title); if (i >= 0) startProject(i); });
  $$('.pf-share').forEach(b => b.onclick = () => { navigator.clipboard?.writeText('I just shipped a To-Do App on VaultQuest — learn to code, crack the vaults.').catch(() => {}); b.textContent = 'COPIED ✓'; });
  $('#p-logout').onclick = () => { logout(); location.reload(); };
  $('#p-reset').onclick = () => { if (confirm('Reset all progress? This cannot be undone.')) { resetState(); location.reload(); } };
  go('s-profile').then(() => {
    $$('.badge').forEach((b, k) => anim(b, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: b.classList.contains('off') ? .45 : 1, transform: 'none' }], { duration: 500, delay: k * 60, easing: EASE.back, fill: 'none' }));
    $$('.badge.new').forEach((b, k) => wait(700 + k * 200).then(() => { const p = ctr(b); FX.spark(p.x, p.y, 24, null, .6); FX.ring(p.x, p.y, 90, '#F2B544', 3); }));
    S.fresh = []; save();
  });
}
