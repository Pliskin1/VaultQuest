// World map: 8 nodes (4 free + 4 Pro), gold/violet paths, gate badge, avatar travel.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { FX } from '../core/fx.js';
import { md } from '../core/md.js';
import { go } from '../core/router.js';
import { S } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { LANGS, freeOf } from '../content/languages.js';
import { startLevel } from './level.js';
import { startProject } from './project.js';
import { openPro } from './pro.js';

export const NODES = [[70, 330], [215, 180], [365, 320], [515, 160], [665, 310], [810, 150], [960, 300], [1120, 140]];
export const ICON = {
  check: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#07090F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" stroke="#6B7489" stroke-width="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="#6B7489" stroke-width="2"/></svg>',
  crown: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 18l2-10 5 5 2-7 2 7 5-5 2 10z" stroke="#C9B8FF" stroke-width="2" stroke-linejoin="round"/></svg>'
};
const ARROW = '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 9h10M10 5l4 4-4 4" stroke="#07090F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR = '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"';

const F = () => freeOf(S.lang); // FREE nodes on this language's map
let sel = 0;
export const getSel = () => sel;
export const setSel = i => { sel = i; };
const pct = (x, y) => ({ left: x / 12 + '%', top: y / 4.6 + '%' });
export const segD = i => { const [a, b] = [NODES[i], NODES[i + 1]], dx = (b[0] - a[0]) * .5; return `M${a[0]} ${a[1]} C ${a[0] + dx} ${a[1]}, ${b[0] - dx} ${b[1]}, ${b[0]} ${b[1]}`; };

export function nstate(i) {
  const L = LANGS[S.lang], done = S.done[S.lang];
  if (i < F()) return i < done ? 'done' : i === done ? 'cur' : 'lock';
  if (!S.pro) return 'plock';
  if (S.stars[S.lang + i]) return 'done';
  if (done < F()) return 'lock';
  return L.levels[i] ? 'cur' : 'soon';
}
export const nodeInner = (i, st) => st === 'done' ? ICON.check : st === 'cur' ? `<span class="nnum">${i + 1}</span>` : (st === 'plock' || st === 'soon') ? ICON.crown : ICON.lock;
const nodeKick = i => { const t = LANGS[S.lang].titles[i]; return t.startsWith('Mini Boss') ? 'MINI BOSS' : t.startsWith('Boss') ? 'BOSS' : t.startsWith('Project') ? 'PROJECT' : i >= F() ? 'PRO VAULT' : 'VAULT 0' + (i + 1); };

export function openMap() { go('s-map'); renderMap(); }

export function renderMap() {
  const L = LANGS[S.lang], done = S.done[S.lang]; updHud();
  $('#m-kicker').textContent = L.name + ' · World 1 · Free + Pro';
  $('#s-map h2').textContent = L.world;
  // FREE = the regular vaults plus the Mini Boss — counted separately, never as "5 vaults".
  const vaults = L.levels.slice(0, F()).filter(l => !l.boss).length;
  $('#m-count').textContent = S.pro ? 'Pro unlocked · advanced vaults & projects' : done >= F() ? 'World 1 cleared · PRO unlocks the next vaults & projects'
    : done >= vaults ? `${vaults} of ${vaults} vaults cracked · the Mini Boss awaits` : `${done} of ${vaults} free vaults cracked · then the Mini Boss`;
  let svg = '';
  for (let i = 0; i < NODES.length - 1; i++) svg += `<path d="${segD(i)}" fill="none" stroke="${i >= F() - 1 ? '#3A3160' : '#2A3245'}" stroke-width="3" stroke-dasharray="6 10" vector-effect="non-scaling-stroke"/>`;
  for (let i = 0; i < NODES.length - 1; i++) svg += `<path class="gseg" data-i="${i}" d="${segD(i)}" fill="none" stroke="#F2B544" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke" style="opacity:${i < Math.min(done, F() - 1) ? 1 : 0}"/>`;
  for (let i = F() - 1; i < NODES.length - 1; i++) svg += `<path class="pseg" data-i="${i}" d="${segD(i)}" fill="none" stroke="#C9B8FF" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke" style="opacity:${S.pro ? 1 : 0}"/>`;
  $('#m-svg').innerHTML = svg;
  $('#m-nodes').innerHTML = NODES.map(([x, y], i) => {
    const st = nstate(i), st3 = S.stars[S.lang + i] || 0, t = L.titles[i].replace(/^(Mini Boss|Boss|Project): /, ''), p = pct(x, y);
    const stars = st === 'done' ? `<div class="stars">${[1, 2, 3].map(k => `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">${STAR} fill="${k <= st3 ? (i >= F() ? '#C9B8FF' : '#F2B544') : '#2A3245'}"/></svg>`).join('')}</div>` : '';
    return `<div class="node ${st} ${i >= F() ? 'pro' : ''} ${L.levels[i]?.boss ? 'boss' : ''} ${i === sel ? 'sel' : ''}" data-i="${i}" style="left:${p.left};top:${p.top}"><button class="nbtn" aria-label="${nodeKick(i)}: ${t}">${nodeInner(i, st)}</button><div class="nlab"><b>${nodeKick(i)}</b><span>${t}</span>${stars}</div></div>`;
  }).join('') + (S.pro ? '' : '<div class="gate" id="m-gate">' + ICON.crown.replace('width="28" height="28"', 'width="16" height="16"') + 'PRO</div>');
  // The PRO gate sits on the path just past the last FREE vault's label.
  if (!S.pro) { const s3 = $(`#m-svg .gseg[data-i="${F() - 1}"]`), p = s3.getPointAtLength(s3.getTotalLength() * .62), g = $('#m-gate'); Object.assign(g.style, pct(p.x, p.y)); }
  $$('#m-nodes .node').forEach(n => n.querySelector('.nbtn').onclick = () => { sel = +n.dataset.i; $$('#m-nodes .node').forEach(m => m.classList.toggle('sel', m === n)); renderPanel(); });
  placeAvatar(S.pro ? Math.min(done, NODES.length - 1) : Math.min(done, F() - 1));
  renderPanel();
}

export function placeAvatar(i) {
  const [x, y] = NODES[Math.min(i, NODES.length - 1)], a = $('#m-avatar');
  a.getAnimations().forEach(x => x.cancel()); Object.assign(a.style, pct(x, y));
}

export function renderPanel() {
  const L = LANGS[S.lang], i = sel, st = nstate(i), lv = L.levels[i], isP = lv && lv.t === 'project', pro = i >= F();
  const saved = S.attempts?.[`${S.curriculum[S.lang]}:${i}`]; // an unfinished attempt (learn/attempt.js attemptKey)
  const kick = { done: 'CRACKED', cur: pro ? 'PRO · READY' : 'READY', lock: 'LOCKED', plock: 'PRO', soon: 'PRO · COMING SOON' }[st];
  const desc = lv ? (isP ? md(lv.brief) : md(lv.concept).replace(/<[^>]+>/g, '').split('. ')[0] + '.') : 'In development — ships to Pro members soon.';
  const pills = isP ? '<span class="pill">4 milestones</span><span class="pill" style="color:var(--violet)">AI code review</span>' : lv?.boss ? '<span class="pill" style="color:var(--coral)">Explain first · then code</span>' : `<span class="pill">${lv ? lv.ch.length + ' challenges' : '—'}</span>`;
  const xpPill = isP ? 500 : lv?.bonusXp != null ? lv.bonusXp + lv.ch.reduce((n, c) => n + (c.xp ?? 50), 0) : 150 + i * 50;
  const btn = st === 'plock' ? '<button class="btn pro" id="m-pro">UNLOCK WITH PRO ' + ICON.crown.replace('#C9B8FF', '#07090F').replace('width="28" height="28"', 'width="18" height="18"') + '</button>'
    : st === 'lock' ? '<span class="pill" style="border:1px dashed #3A4256;background:transparent">Finish the free vaults first</span>'
    : st === 'soon' ? '<span class="pill" style="color:var(--violet)">Coming soon</span>'
    : `<button class="btn ${pro ? 'pro' : ''}" id="m-play">${isP ? 'START PROJECT' : saved?.session?.locked ? 'SYNTAX RECOVERY' : saved ? 'CONTINUE VAULT' : st === 'done' ? 'REPLAY' : lv?.boss ? 'FACE THE MINI BOSS' : 'ENTER VAULT'} ${ARROW}</button>`;
  $('#m-panel').innerHTML = `<div style="flex:1"><div class="kicker" style="color:${pro ? 'var(--violet)' : st === 'lock' ? 'var(--mut2)' : 'var(--gold)'}">${nodeKick(i)} · ${kick}</div><h3>${L.titles[i]}</h3><p>${desc}</p></div>${pills}<span class="pill" style="color:var(--gold)">+${xpPill} XP</span>${btn}`;
  const p = $('#m-play'); if (p) p.onclick = () => isP ? startProject(i) : startLevel(i);
  const q = $('#m-pro'); if (q) q.onclick = () => openPro();
}

function settle(el, last) { el.style.left = last.left; el.style.top = last.top; el.getAnimations().forEach(a => a.cancel()); }
const samplePath = seg => { const len = seg.getTotalLength(), pts = []; for (let k = 0; k <= 40; k++) { const p = seg.getPointAtLength(len * k / 40); pts.push(pct(p.x, p.y)); } return { len, pts }; };

export async function moveAlong(seg, D = 1300) {
  const { pts } = samplePath(seg);
  await anim($('#m-avatar'), pts, { duration: D, easing: EASE.inout }); settle($('#m-avatar'), pts[40]);
}

// After a free level: gold segment draws while the avatar follows it, then the next lock shatters.
export async function travel(from) {
  const seg = $(`#m-svg .gseg[data-i="${from}"]`); if (!seg) return;
  const { len, pts } = samplePath(seg);
  seg.style.opacity = 1; seg.style.strokeDasharray = len; seg.style.strokeDashoffset = len;
  const D = 1500;
  anim(seg, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: D, easing: EASE.inout });
  await anim($('#m-avatar'), pts, { duration: D, easing: EASE.inout }); settle($('#m-avatar'), pts[pts.length - 1]);
  const n = $(`#m-nodes .node[data-i="${from + 1}"]`); if (!n) return;
  const c = ctr(n.querySelector('.nbtn'));
  FX.shards(c.x, c.y, 26, '#8B93A7'); FX.spark(c.x, c.y, 50); FX.ring(c.x, c.y, 160, '#F2B544', 4); FX.ring(c.x, c.y, 260, '#4FD8C4', 2, .9);
  n.className = `node ${nstate(from + 1)} ${LANGS[S.lang].levels[from + 1]?.boss ? 'boss' : ''}`; n.querySelector('.nbtn').innerHTML = nodeInner(from + 1, nstate(from + 1));
  anim(n.querySelector('.nbtn'), [{ transform: 'scale(.4)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 700, easing: EASE.back, fill: 'none' });
  $$('#m-nodes .node').forEach(m => m.classList.toggle('sel', m === n)); sel = from + 1; renderPanel();
}

// Rewind the map to the pre-level state so travel() can replay the unlock.
export function rewindForTravel(from) {
  placeAvatar(from);
  const seg = $(`#m-svg .gseg[data-i="${from}"]`); if (seg) seg.style.opacity = 0;
  const n = $(`#m-nodes .node[data-i="${from + 1}"]`);
  if (n) { n.className = 'node lock'; n.querySelector('.nbtn').innerHTML = ICON.lock; }
  return !!n;
}
