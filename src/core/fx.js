// Canvas particle system: sparks, embers, rings, shards, glyph streams + floating background glyphs.
import { $ } from './dom.js';
import { onTick } from './clock.js';

const GLYPHS = ['{ }', '=>', 'def', '( )', 'if', '[ ]', '//', '++', '==', 'fn', '</>', 'for', '0', '1', '::', 'let'];
const rnd = Math.random;

export const FX = {
  c: null, b: null, ps: [], glyphs: [], bgOn: true,
  init() {
    this.c = $('#fx'); this.b = $('#bg');
    addEventListener('resize', () => this.resize()); this.resize();
    onTick(dt => { this.update(dt); this.draw(); });
  },
  resize() {
    const d = devicePixelRatio || 1;
    for (const c of [this.c, this.b]) { c.width = innerWidth * d; c.height = innerHeight * d; c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); }
    this.glyphs = Array.from({ length: 46 }, (_, i) => ({ x: (i * 173) % innerWidth, y: (i * 97) % innerHeight, v: 12 + (i * 7) % 22, ch: GLYPHS[i % 16], a: .05 + (i % 5) * .025 }));
  },
  spark(x, y, n, col, spd = 1) { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, v = (140 + rnd() * 420) * spd; this.ps.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: .5 + rnd() * .6, w: 1.5 + rnd() * 2.2, col: col || ['#F2B544', '#FFD27A', '#FFF1CC'][i % 3] }); } },
  ember(x, y, n) { for (let i = 0; i < n; i++) this.ps.push({ k: 'e', x: x + (rnd() - .5) * 500, y: y + (rnd() - .2) * 300, vx: (rnd() - .5) * 40, vy: -40 - rnd() * 90, l: 0, m: 1.5 + rnd() * 1.8, w: 2 + rnd() * 3, col: i % 3 ? '#F2B544' : '#4FD8C4' }); },
  ring(x, y, R, col, w = 3, m = .7) { this.ps.push({ k: 'r', x, y, R, col, w, l: 0, m }); },
  shards(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, v = 120 + rnd() * 260; this.ps.push({ k: 'h', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160, l: 0, m: .9 + rnd() * .5, w: 5 + rnd() * 7, r: rnd() * 6, vr: (rnd() - .5) * 14, col: col || '#8B93A7' }); } },
  stream(tx, ty, n, dur) {
    const chs = '{}()[]<>=+;:01$#&|!?def if for let return'.split('');
    for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.max(innerWidth, innerHeight) * .6 + rnd() * 200; this.ps.push({ k: 'g', sx: tx + Math.cos(a) * d, sy: ty + Math.sin(a) * d, tx, ty, l: -rnd() * dur / 1000 * .8, m: .7 + rnd() * .3, ch: chs[i % chs.length], col: i % 4 ? '#F2B544' : '#4FD8C4', sz: 14 + rnd() * 12 }); }
  },
  update(dt) {
    const s = dt / 1000;
    for (const p of this.ps) {
      p.l += s; if (p.l < 0) continue;
      if (p.k === 's') { p.vx *= Math.pow(.06, s); p.vy = p.vy * Math.pow(.06, s) + 420 * s; p.x += p.vx * s; p.y += p.vy * s; }
      else if (p.k === 'e') { p.x += p.vx * s; p.y += p.vy * s; }
      else if (p.k === 'h') { p.vy += 900 * s; p.x += p.vx * s; p.y += p.vy * s; p.r += p.vr * s; }
    }
    this.ps = this.ps.filter(p => p.l < p.m);
    if (this.bgOn) for (const g of this.glyphs) { g.y -= g.v * s; if (g.y < -30) g.y = innerHeight + 30; }
  },
  draw() {
    const x = this.c.getContext('2d'); x.clearRect(0, 0, innerWidth, innerHeight); x.save(); x.globalCompositeOperation = 'lighter';
    for (const p of this.ps) {
      if (p.l < 0) continue; const q = p.l / p.m, a = 1 - q;
      if (p.k === 's') { x.strokeStyle = p.col; x.globalAlpha = a; x.lineWidth = p.w; x.lineCap = 'round'; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); x.stroke(); }
      else if (p.k === 'e') { x.fillStyle = p.col; x.globalAlpha = Math.sin(q * Math.PI) * .9; x.beginPath(); x.arc(p.x, p.y, p.w, 0, 7); x.fill(); }
      else if (p.k === 'r') { const e = 1 - Math.pow(1 - q, 3); x.strokeStyle = p.col; x.globalAlpha = a; x.lineWidth = p.w * (1 - q * .6); x.beginPath(); x.arc(p.x, p.y, 8 + p.R * e, 0, 7); x.stroke(); }
      else if (p.k === 'g') { const e = Math.pow(q, 2.2); x.fillStyle = p.col; x.globalAlpha = Math.min(1, q * 3) * (1 - Math.max(0, q - .85) / .15); x.font = `500 ${p.sz * (1 - e * .6)}px JetBrains Mono`; x.fillText(p.ch, p.sx + (p.tx - p.sx) * e, p.sy + (p.ty - p.sy) * e); }
    }
    x.restore();
    for (const p of this.ps) {
      if (p.k !== 'h' || p.l < 0) continue;
      x.save(); x.globalAlpha = 1 - p.l / p.m; x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.col;
      x.beginPath(); x.moveTo(-p.w, -p.w * .6); x.lineTo(p.w, -p.w * .2); x.lineTo(p.w * .3, p.w); x.closePath(); x.fill(); x.restore();
    }
    const b = this.b.getContext('2d'); b.clearRect(0, 0, innerWidth, innerHeight);
    if (this.bgOn) { b.font = '500 16px JetBrains Mono'; for (const g of this.glyphs) { b.globalAlpha = g.a; b.fillStyle = '#F2B544'; b.fillText(g.ch, g.x, g.y); } b.globalAlpha = 1; }
  }
};
