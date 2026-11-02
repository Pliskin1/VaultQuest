import { esc } from './md.js';
const KW = { py: 'def return if else elif for while in and or not import from as class True False None print len type int str float range', js: 'let const var function return if else for while true false null undefined typeof new class console log' };
const BI = new Set(['print', 'len', 'type', 'int', 'str', 'float', 'range', 'console', 'log']);
const SETS = { py: new Set(KW.py.split(' ')), js: new Set(KW.js.split(' ')) };

export function hl(code, lang) {
  const kw = SETS[lang];
  return code.replace(/(#.*$|\/\/.*$)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b|([<>&])/gm, (m, c, s, n, w, sym) => {
    if (c) return `<span class="c">${esc(c)}</span>`;
    if (s) return `<span class="s">${esc(s)}</span>`;
    if (n) return `<span class="n">${n}</span>`;
    if (w) return BI.has(w) ? `<span class="f">${w}</span>` : kw.has(w) ? `<span class="k">${w}</span>` : w;
    return esc(sym);
  });
}
