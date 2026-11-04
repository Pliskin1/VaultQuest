// Loop and runaway guard for student JavaScript, without a parser dependency. A small tokenizer (strings,
// template literals, comments, regex literals) finds loop headers and function bodies, and inserts calls
// to the sandbox's guard (`__vq`, defined by sandbox/harness.js):
//   while (c)            → while (__vq()&&(c))            (also the `while` of do … while)
//   for (a; c; b)        → for (a; __vq()&&(c); b)        · for (;;) → for (; __vq(); )
//   for (x of xs)        → for (x of __vqIt(xs))          (the iterator ticks the guard per item)
//   ) {  /  => {         → ) {__vq();  /  => {__vq();     (function entry: deep or async recursion)
// Inserted text never contains a newline, so error line numbers still match the student's code.
// The guard throws once code has run for too long without yielding (sandbox/harness.js). This is a
// teaching sandbox, not a security boundary: code shaped in ways the tokenizer can't see is caught by
// the frame watchdog instead.

const KEYWORD_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const isIdStart = c => /[A-Za-z_$À-￿]/.test(c);
const isId = c => /[\w$À-￿]/.test(c);

// → tokens [{ t: 'name'|'num'|'str'|'tmpl'|'regex'|'punct', v, s, e }] (whitespace and comments dropped).
// Throws on an unterminated string, template, comment or regex.
export function tokenize(src) {
  const out = [], braces = []; // braces: 'b' for a code block/object, 't' for a template ${ … }
  let i = 0;
  const prevSig = () => out[out.length - 1];
  const regexAllowed = () => {
    const p = prevSig();
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'tmpl' || p.t === 'regex') return false;
    if (p.t === 'name') return KEYWORD_BEFORE_REGEX.has(p.v);
    return !(p.v === ')' || p.v === ']');
  };
  // Scans template text from i (just after ` or }) to the closing ` or the next ${.
  const templ = start => {
    let j = start;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return { end: j + 1, open: false };
      if (c === '$' && src[j + 1] === '{') return { end: j + 2, open: true };
      j++;
    }
    throw new SyntaxError('Unterminated template literal');
  };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ' || c === '﻿' || c === '\u2028' || c === '\u2029') { i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); if (j < 0) throw new SyntaxError('Unterminated comment'); i = j + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; else if (src[j] === '\n') break; j++; }
      if (src[j] !== c) throw new SyntaxError('Unterminated string');
      out.push({ t: 'str', v: src.slice(i, j + 1), s: i, e: j + 1 }); i = j + 1; continue;
    }
    if (c === '`') {
      const r = templ(i + 1);
      out.push({ t: 'tmpl', v: '`', s: i, e: r.end }); i = r.end;
      if (r.open) braces.push('t');
      continue;
    }
    if (c === '}' && braces[braces.length - 1] === 't') {
      braces.pop();
      const r = templ(i + 1);
      out.push({ t: 'tmpl', v: '}', s: i, e: r.end }); i = r.end;
      if (r.open) braces.push('t');
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < src.length) {
        const x = src[j];
        if (x === '\\') { j += 2; continue; }
        if (x === '\n') break;
        if (x === '[') cls = true; else if (x === ']') cls = false; else if (x === '/' && !cls) break;
        j++;
      }
      if (src[j] !== '/') throw new SyntaxError('Unterminated regular expression');
      j++; while (j < src.length && isId(src[j])) j++;
      out.push({ t: 'regex', v: src.slice(i, j), s: i, e: j }); i = j; continue;
    }
    if (isIdStart(c)) {
      let j = i + 1; while (j < src.length && isId(src[j])) j++;
      out.push({ t: 'name', v: src.slice(i, j), s: i, e: j }); i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) {
      let j = i + 1; while (j < src.length && /[\w.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j), s: i, e: j }); i = j; continue;
    }
    const three = src.slice(i, i + 3), two = src.slice(i, i + 2);
    const p = ['...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??='].includes(three) ? three
      : ['=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'].includes(two) ? two : c;
    if (p === '{') braces.push('b');
    else if (p === '}') braces.pop();
    out.push({ t: 'punct', v: p, s: i, e: i + p.length }); i += p.length;
  }
  if (braces.includes('t')) throw new SyntaxError('Unterminated template literal');
  return out;
}

const OPEN = { '(': ')', '[': ']', '{': '}' };
// Index of the token closing the bracket opened at `k` (template ${ … } pieces count as brackets too).
function closing(toks, k) {
  let depth = 0;
  for (let j = k; j < toks.length; j++) {
    const x = toks[j];
    if (x.t === 'punct' && OPEN[x.v]) depth++;
    else if (x.t === 'punct' && (x.v === ')' || x.v === ']' || x.v === '}')) { depth--; if (depth === 0) return j; }
  }
  return -1;
}
const isMember = (toks, k) => k > 0 && toks[k - 1].t === 'punct' && (toks[k - 1].v === '.' || toks[k - 1].v === '?.');

// → { code } instrumented, or { error } when the source can't be tokenized (the caller reports the
// student's syntax error instead). bodies: false skips function-entry guards (fallback mode).
export function instrument(src, { bodies = true } = {}) {
  let toks;
  try { toks = tokenize(src); } catch (e) { return { error: e.message }; }
  const ins = []; // [position, text]
  const at = (pos, text) => ins.push([pos, text]);
  for (let k = 0; k < toks.length; k++) {
    const x = toks[k];
    if (x.t === 'name' && x.v === 'while' && !isMember(toks, k) && toks[k + 1]?.v === '(') {
      const close = closing(toks, k + 1);
      if (close < 0) continue;
      at(toks[k + 1].e, '__vq()&&('); at(toks[close].s, ')');
    } else if (x.t === 'name' && x.v === 'for' && !isMember(toks, k)) {
      let o = k + 1, isAwait = false;
      if (toks[o]?.t === 'name' && toks[o].v === 'await') { o++; isAwait = true; }
      if (toks[o]?.v !== '(') continue;
      const close = closing(toks, o);
      if (close < 0) continue;
      const semis = [], ofs = [];
      let depth = 0;
      for (let j = o + 1; j < close; j++) {
        const y = toks[j];
        if (y.t === 'punct' && OPEN[y.v]) depth++;
        else if (y.t === 'punct' && (y.v === ')' || y.v === ']' || y.v === '}')) depth--;
        else if (depth === 0 && y.t === 'punct' && y.v === ';') semis.push(j);
        else if (depth === 0 && y.t === 'name' && y.v === 'of' && j > o + 1) ofs.push(j);
      }
      if (semis.length === 2) {
        const [a, b] = semis;
        if (b === a + 1) at(toks[a].e, ' __vq()');
        else { at(toks[a].e, '__vq()&&('); at(toks[b].s, ')'); }
      } else if (!semis.length && ofs.length && !isAwait) {
        // `for (const of of xs)`: the keyword is the last top-level `of` before an expression
        const of = ofs[ofs.length - 1];
        if (of + 1 < close) { at(toks[of].e, ' __vqIt('); at(toks[close].s, ')'); }
      }
    } else if (bodies && x.t === 'punct' && x.v === '{' && k > 0) {
      const p = toks[k - 1];
      if (p.t === 'punct' && p.v === '=>') { at(x.e, '__vq();'); continue; }
      if (p.t === 'punct' && p.v === ')') {
        // find the ( … ) group and what owns it: `switch (x) {` must stay a switch body
        let depth = 0, open = -1;
        for (let j = k - 1; j >= 0; j--) {
          const y = toks[j];
          if (y.t === 'punct' && (y.v === ')' || y.v === ']' || y.v === '}')) depth++;
          else if (y.t === 'punct' && OPEN[y.v]) { depth--; if (depth === 0) { open = j; break; } }
        }
        const owner = open > 0 ? toks[open - 1] : null;
        if (owner && owner.t === 'name' && (owner.v === 'switch' || owner.v === 'extends')) continue;
        if (owner && owner.t === 'name' && owner.v === 'class') continue;
        at(x.e, '__vq();');
      }
    }
  }
  ins.sort((a, b) => b[0] - a[0]);
  let code = src;
  for (const [pos, text] of ins) code = code.slice(0, pos) + text + code.slice(pos);
  return { code };
}
