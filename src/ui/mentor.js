// VAULT AI mentor panel. The only place that talks to /api/*. Every call falls back to content text,
// so the UI never knows whether an answer came from the model or the handcrafted fallback.
import { $ } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { esc, md } from '../core/md.js';
import { DEMO } from '../core/state.js';

const LABELS = { fix: 'WHAT WENT WRONG', hint: 'HINT', good: 'NICE' };
const TIMEOUT = 6000;

async function post(url, body) {
  if (DEMO) throw new Error('demo uses fallback'); // recordings must be deterministic
  if (typeof body.code === 'string') body.code = body.code.slice(0, 4000);
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

export const Mentor = {
  q: Promise.resolve(),
  use(k) { const p = k === 'pj'; this.box = $(p ? '#pj-msgs' : '#msgs'); this.root = $(p ? '#pj-mentor' : '#mentor'); this.st = $(p ? '#pj-stat' : '#m-stat'); },
  // text may be a string or a Promise of a string — or of { text, label, kind } when the label depends on the
  // reply (e.g. whether it came from the AI or the scripted fallback). Typing dots show while it resolves.
  gen: 0,
  say(text, o = {}) { const g = this.gen; this.q = this.q.then(() => g === this.gen && this._say(text, o, g)).catch(() => {}); return this.q; },
  // Drops replies still queued or typing (the player left or restarted the vault).
  cancel() { this.gen++; this.root?.classList.remove('thinking'); if (this.st) this.st.textContent = 'Your mentor · online'; },
  async _say(text, { kind = '', label, fast } = {}, g = this.gen) {
    const { box, root: m, st } = this, d = document.createElement('div');
    d.className = 'msg ' + kind; d.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    box.appendChild(d); box.scrollTop = 1e6; m.classList.add('thinking'); st.textContent = 'thinking…';
    anim(d, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE.out, fill: 'none' });
    let [t] = await Promise.all([Promise.resolve(text), wait(fast ? 350 : 800)]);
    if (g !== this.gen) return d.remove();
    if (t && typeof t === 'object') { label = t.label ?? label; if (t.kind) { kind = t.kind; d.className = 'msg ' + kind; } t = t.text; }
    const lab = label || LABELS[kind] || '', head = lab ? `<span class="lab">${lab}</span>` : '';
    const tok = t.split(/(`[^`]+`|\*\*[^*]+\*\*)/), raw = x => x.startsWith('`') ? x.slice(1, -1) : x.startsWith('**') ? x.slice(2, -2) : x;
    const full = tok.map(raw).join('');
    for (let n = 0; n <= full.length; n += 4) {
      let left = n, h = '';
      for (const x of tok) {
        const part = raw(x).slice(0, Math.max(0, left)); left -= raw(x).length; if (!part) continue;
        h += x.startsWith('`') ? `<span class="code">${esc(part)}</span>` : x.startsWith('**') ? `<b>${esc(part)}</b>` : esc(part);
      }
      d.innerHTML = head + h; box.scrollTop = 1e6; await wait(28);
      if (g !== this.gen) return d.remove();
    }
    d.innerHTML = head + md(t); m.classList.remove('thinking'); st.textContent = 'Your mentor · online';
  },
  // Shows saved messages at once (returning to a PRO project): [{ w: 'm'|'u', text, label, kind }].
  restore(list) {
    for (const e of list) {
      const d = document.createElement('div');
      if (e.w === 'u') { d.className = 'msg me'; d.textContent = e.text; }
      else { const lab = e.label || LABELS[e.kind] || ''; d.className = 'msg ' + (e.kind || ''); d.innerHTML = (lab ? `<span class="lab">${esc(lab)}</span>` : '') + md(e.text); }
      this.box.appendChild(d);
    }
    this.box.scrollTop = 1e6;
  },
  user(text) {
    const d = document.createElement('div'); d.className = 'msg me'; d.textContent = text;
    this.box.appendChild(d); this.box.scrollTop = 1e6;
    anim(d, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, fill: 'none' });
  },
  // mode: wrong|hint|explain|ask. payload per docs/AI.md. Resolves to text (AI or fallback).
  fetchText(mode, payload, fallback) {
    return post('/api/mentor', { mode, ...payload, fallback }).then(r => r.text || fallback).catch(() => fallback);
  },
  // Same, plus whether the text came from the AI (false: the scripted fallback).
  fetchReply(mode, payload, fallback) {
    return post('/api/mentor', { mode, ...payload, fallback }).then(r => ({ text: r.text || fallback, ai: r.source === 'ai' && !!r.text })).catch(() => ({ text: fallback, ai: false }));
  },
  ask(mode, payload, fallback, o) { return this.say(this.fetchText(mode, payload, fallback), o); },
  // Project code review → { text, score, ai }.
  review(payload, fallback, fallbackScore = null) {
    return post('/api/review', { ...payload, fallback, fallbackScore })
      .then(r => ({ text: r.text || fallback, score: r.score ?? fallbackScore, ai: r.source === 'ai' && !!r.text }))
      .catch(() => ({ text: fallback, score: fallbackScore, ai: false }));
  }
};
