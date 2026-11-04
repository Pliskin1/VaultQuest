// Leaderboard: podium (top 3), rankings 4–10 (your row pinned below if you're further down), your position
// with the gap to the player above, and how to earn XP. ALL TIME / THIS WEEK re-render the same fetched board.
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { esc } from '../core/md.js';
import { go, current } from '../core/router.js';
import { lvlOf } from '../core/state.js';
import { updHud } from '../ui/hud.js';
import { fetchBoard } from '../ui/board.js';
import { openProfile } from './profile.js';
import { openMap } from './map.js';

const CROWN = '<svg class="pd-crown" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const FLAME = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2 2.5 0-3-1-5 1-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

let B = null, scope = 'all';
const num = n => Number(n).toLocaleString('en-US');
const ini = n => String(n).slice(0, 2).toUpperCase();
const you = r => r.me ? '<i class="b-tag you">YOU</i>' : '';

// Displayed 2nd · 1st · 3rd.
const podium = top => [1, 0, 2].filter(i => top[i]).map(i => {
  const r = top[i];
  return `<div class="pd pd${i + 1}${r.me ? ' me' : ''}">${i === 0 ? CROWN : ''}<div class="pd-av">${esc(ini(r.name))}</div><div class="pd-nm"><span>${esc(r.name)}</span>${you(r)}</div><div class="pd-xp">${num(r.score)} XP</div><div class="pd-ped"><span class="sr">Rank </span>${r.rank}</div></div>`;
}).join('');

function row(r) {
  const mv = r.move > 0 ? `<span class="b-mv up"><span aria-hidden="true">▲</span><span class="sr">up </span>${r.move}</span>`
    : r.move < 0 ? `<span class="b-mv dn"><span aria-hidden="true">▼</span><span class="sr">down </span>${-r.move}</span>` : '';
  return `<li class="b-row${r.me ? ' me' : ''}"><span class="b-rk"><b>${r.rank}</b>${mv}</span><span class="b-pl"><span class="b-av${r.pro ? ' pro' : ''}" aria-hidden="true">${esc(ini(r.name))}</span><span class="b-nm">${esc(r.name)}</span>${r.pro ? '<i class="b-tag pro">PRO</i>' : ''}${you(r)}</span><span class="b-c">LVL ${lvlOf(r.xp)}</span><span class="b-c">${r.vaults}<span class="sr"> vaults</span></span><span class="b-c b-st">${FLAME}${r.streak}<span class="sr"> day streak</span></span><span class="b-xp">${num(r.score)}<span class="sr"> XP</span></span></li>`;
}

function rankings(b) {
  let h = b.top.slice(3).map(row).join('');
  if (b.me && b.me.rank > b.top.length) h += `<li class="b-gap" aria-hidden="true">···</li>${row(b.me)}`;
  return h || '<li class="b-empty">No one else on the board yet.</li>';
}

function mePanel(b, week) {
  const head = '<div class="kicker" style="color:var(--gold)">YOUR POSITION</div>';
  const m = b.me; if (!m) return head + '<p class="b-gapx">Crack a vault to get on the board.</p>';
  const a = b.above, pct = a && a.score > 0 ? Math.min(99, Math.floor(m.score / a.score * 100)) : 0;
  const [trend, cls] = week ? ['Weekly board resets Monday', ''] : m.move > 0 ? [`▲ ${m.move} since last week`, 'up'] : m.move < 0 ? [`▼ ${-m.move} since last week`, 'dn'] : ['No change this week', ''];
  const next = a
    ? `<div class="b-next"><span>Next up: <b>${esc(a.name)}</b> (#${a.rank})</span><span>${pct}%</span></div><div class="pbar"><i style="width:${pct}%;background:var(--gold)"></i></div><p class="b-gapx">${num(a.score - m.score + 1)} XP to overtake them.</p>`
    : '<p class="b-gapx">You\'re <b>#1</b>. Everyone else is chasing you.</p>';
  return `${head}<div class="b-big"><strong>#${m.rank}</strong><span>of ${num(B.total)} players</span></div><div class="b-sc"><b>${num(m.score)} ${week ? 'XP this week' : 'XP total'}</b><span class="${cls}">${trend}</span></div><hr>${next}<button class="btn b-play" id="b-play">PLAY NEXT VAULT</button>`;
}

function render(intro) {
  const week = scope === 'week', b = B[week ? 'week' : 'all'];
  $('#b-sub').textContent = week ? 'XP earned since Monday. The weekly board resets every Monday.' : 'Every player, ranked by total XP.';
  $$('#b-tabs button').forEach(t => { const on = t.dataset.scope === scope; t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); });
  $('#b-podium').innerHTML = podium(b.top);
  $('#b-count').textContent = `Top ${b.top.length} of ${num(B.total)} players`;
  $('#b-xph').textContent = week ? 'THIS WEEK' : 'TOTAL XP';
  $('#b-list').innerHTML = rankings(b);
  $('#b-me').innerHTML = mePanel(b, week);
  $('#b-off').hidden = B.live;
  const play = $('#b-play'); if (play) play.onclick = () => openMap();
  animate(intro);
}

// intro: pedestals rise and your spot gets a ring. Tab switches only re-run the light part.
function animate(intro) {
  $$('#b-podium .pd').forEach((p, k) => {
    const d = intro ? [150, 0, 300][k] : 0;
    if (intro) anim(p.querySelector('.pd-ped'), [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 600, delay: d, easing: EASE.out, fill: 'backwards' });
    anim(p.querySelector('.pd-av'), [{ opacity: 0, transform: 'translateY(16px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: intro ? d + 250 : k * 60, easing: EASE.back, fill: 'backwards' });
  });
  $$('#b-list li').forEach((li, k) => anim(li, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: (intro ? 300 : 0) + k * 45, easing: EASE.out, fill: 'backwards' }));
  if (!intro) return;
  wait(1150).then(() => {
    const el = current() === 's-board' && ($('#b-podium .pd.me .pd-av') || $('#b-list .b-row.me'));
    if (!el) return;
    const p = ctr(el); FX.ring(p.x, p.y, 120, '#F2B544', 3); FX.spark(p.x, p.y, 20, '#F2B544', .5);
  });
}

function loading() {
  $('#b-podium').innerHTML = ''; $('#b-me').innerHTML = '<div class="kicker" style="color:var(--gold)">YOUR POSITION</div>';
  $('#b-list').innerHTML = '<li class="b-empty">Loading rankings…</li>'; $('#b-count').textContent = ''; $('#b-off').hidden = true;
}

export async function openLeaderboard() {
  scope = 'all'; updHud(); loading(); $('#s-board .b-body').scrollTop = 0;
  const [board] = await Promise.all([fetchBoard(), go('s-board')]);
  if (current() !== 's-board') return;
  B = board; render(true);
}

export function mount() {
  $('#b-back').onclick = () => openProfile();
  $$('#b-tabs button').forEach(t => t.onclick = () => { if (!B || scope === t.dataset.scope) return; scope = t.dataset.scope; render(false); });
}
