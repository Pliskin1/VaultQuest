// A small DOM for running the PRO Workspace harness (run/sandbox/harness.js) and its checks in Node, inside
// a vm context — test-only, so the project checks can be tested without a browser or a new dependency. It
// covers what the harness, the checks and typical student solutions use; real browsers are covered by the
// browser verification. Each call to frameContext() is a fresh page, like a fresh sandboxed frame.
import vm from 'node:vm';

const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const encode = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function frameContext({ html = '', onMessage = () => {}, timers = globalThis }) {
  const listeners = new WeakMap();
  class Event {
    constructor(type, o = {}) { this.type = type; this.bubbles = !!o.bubbles; this.defaultPrevented = false; this._stop = false; this.target = null; this.currentTarget = null; }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this._stop = true; }
  }
  class MouseEvent extends Event {}
  class KeyboardEvent extends Event { constructor(t, o = {}) { super(t, o); this.key = o.key; } }
  class EventTarget {
    addEventListener(t, f) { if (!listeners.has(this)) listeners.set(this, {}); const m = listeners.get(this); (m[t] ||= []).push(f); }
    removeEventListener(t, f) { const m = listeners.get(this); if (m?.[t]) m[t] = m[t].filter(x => x !== f); }
    _fire(e) {
      e.currentTarget = this;
      for (const f of [...(listeners.get(this)?.[e.type] ?? [])]) call(f, this, e);
      const h = this['on' + e.type]; if (typeof h === 'function') call(h, this, e);
    }
    dispatchEvent(e) {
      e.target = this;
      let n = this;
      while (n && !e._stop) { n._fire(e); if (!e.bubbles) break; n = n.parentNode ?? (n === doc ? glob : null); }
      return !e.defaultPrevented;
    }
  }
  // An exception in a listener is reported to the window, like a browser does; it never reaches the caller.
  function call(f, self, e) { try { f.call(self, e); } catch (err) { report(err); } }
  class Node extends EventTarget {
    constructor() { super(); this.childNodes = []; this.parentNode = null; }
    get firstChild() { return this.childNodes[0] ?? null; }
    get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null; }
    get parentElement() { return this.parentNode instanceof Element ? this.parentNode : null; }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    set textContent(v) { this.childNodes.forEach(c => { c.parentNode = null; }); this.childNodes = []; if (String(v ?? '') !== '') this.appendChild(new Text(String(v))); }
    appendChild(c) {
      if (c instanceof Fragment) { [...c.childNodes].forEach(x => this.appendChild(x)); return c; }
      c.remove?.(); c.parentNode = this; this.childNodes.push(c);
      if (c.tagName === 'SCRIPT') runScript(c.textContent);
      return c;
    }
    append(...cs) { cs.forEach(c => this.appendChild(typeof c === 'string' ? new Text(c) : c)); }
    prepend(...cs) { cs.reverse().forEach(c => this.insertBefore(typeof c === 'string' ? new Text(c) : c, this.firstChild)); }
    insertBefore(c, ref) { if (!ref) return this.appendChild(c); c.remove?.(); c.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, c); return c; }
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i < 0) throw new Error('NotFoundError'); this.childNodes.splice(i, 1); c.parentNode = null; return c; }
    replaceChildren(...cs) { this.textContent = ''; this.append(...cs); }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    get children() { return this.childNodes.filter(c => c instanceof Element); }
    querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (matches(c, sel, this)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    getElementById(id) { return this.querySelector('#' + id); }
  }
  class Text extends Node { constructor(t) { super(); this.data = t; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
  class Fragment extends Node {}
  class Element extends Node {
    constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.attrs = {}; this.style = {}; this.dataset = {}; this.value = ''; this.checked = false; const self = this;
      this.classList = { add: (...c) => { const s = new Set(self._cls()); c.forEach(x => s.add(x)); self.className = [...s].join(' '); }, remove: (...c) => { self.className = self._cls().filter(x => !c.includes(x)).join(' '); },
        toggle: (c, force) => { const on = force ?? !self._cls().includes(c); on ? self.classList.add(c) : self.classList.remove(c); return on; }, contains: c => self._cls().includes(c) }; }
    _cls() { return (this.attrs.class || '').split(/\s+/).filter(Boolean); }
    get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
    get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = String(v); }
    get type() { return this.attrs.type || ''; } set type(v) { this.attrs.type = String(v); }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); if (k === 'checked') this.checked = true; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    matches(sel) { return matches(this, sel, null); }
    closest(sel) { for (let n = this; n instanceof Element; n = n.parentNode) if (n.matches(sel)) return n; return null; }
    focus() {} blur() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20 }; }
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
    set innerHTML(h) { this.textContent = ''; parseInto(this, String(h)); }
    insertAdjacentHTML(where, h) { const tmp = new HTMLElement('div'); tmp.innerHTML = h; const kids = [...tmp.childNodes]; if (where === 'beforeend') kids.forEach(k => this.appendChild(k)); else if (where === 'afterbegin') kids.reverse().forEach(k => this.insertBefore(k, this.firstChild)); else throw new Error('unsupported in test DOM: ' + where); }
  }
  class HTMLElement extends Element { click() { if (this.tagName === 'INPUT' && this.type === 'checkbox') this.checked = !this.checked; this.dispatchEvent(new MouseEvent('click', { bubbles: true })); } }
  class Document extends Node {
    createElement(t) { return new HTMLElement(t); }
    createTextNode(t) { return new Text(String(t)); }
    createDocumentFragment() { return new Fragment(); }
    get body() { return this.children[0]; }
  }
  function serialize(n) {
    if (n instanceof Text) return encode(n.data);
    const tag = n.tagName.toLowerCase(), a = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`).join('');
    return VOID.has(tag) ? `<${tag}${a}>` : `<${tag}${a}>${n.innerHTML}</${tag}>`;
  }
  function parseInto(root, h) {
    const stack = [root], re = /<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;
    let m;
    while ((m = re.exec(h))) {
      const top = stack[stack.length - 1];
      if (m[4]) top.appendChild(new Text(decode(m[4])));
      else if (m[1]) { const i = stack.map(x => x.tagName).lastIndexOf(m[1].toUpperCase()); if (i > 0) stack.length = i; }
      else {
        const el = new HTMLElement(m[2]);
        for (const a of m[3].matchAll(/([^\s=>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) el.setAttribute(a[1], decode(a[2] ?? a[3] ?? a[4] ?? ''));
        top.appendChild(el);
        if (!VOID.has(m[2].toLowerCase())) stack.push(el);
      }
    }
  }
  // Selectors: compound parts (tag, #id, .class, [attr="v"]) joined by spaces (descendant).
  function compound(el, part) {
    const m = /^([a-zA-Z0-9]*|\*)((?:[#.][\w-]+|\[[^\]]+\])*)$/.exec(part);
    if (!m) throw new Error('selector not supported in test DOM: ' + part);
    if (m[1] && m[1] !== '*' && el.tagName !== m[1].toUpperCase()) return false;
    for (const x of m[2].match(/[#.][\w-]+|\[[^\]]+\]/g) ?? []) {
      if (x[0] === '#' && el.id !== x.slice(1)) return false;
      if (x[0] === '.' && !el._cls().includes(x.slice(1))) return false;
      if (x[0] === '[') { const [, k, v] = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(x); if (v === undefined ? !el.hasAttribute(k) : el.getAttribute(k) !== v) return false; }
    }
    return true;
  }
  function matches(el, sel, scope) {
    return sel.split(',').some(s => {
      const parts = s.trim().split(/\s+/);
      if (!compound(el, parts[parts.length - 1])) return false;
      let n = el.parentNode;
      for (let k = parts.length - 2; k >= 0; k--) { while (n && n !== scope && !(n instanceof Element && compound(n, parts[k]))) n = n.parentNode; if (!n || n === scope) return false; n = n.parentNode; }
      return true;
    });
  }

  const doc = new Document(), body = new HTMLElement('body');
  doc.appendChild(body); body.innerHTML = html;
  const win = new EventTarget();
  function report(err) {
    const e = new Event('error'); e.error = err; e.message = `Uncaught ${err?.name ?? 'Error'}: ${err?.message ?? err}`;
    e.lineno = Number(/app\.js:(\d+)/.exec(String(err?.stack ?? ''))?.[1]) || 0;
    glob._fire(e);
  }
  const ctx = vm.createContext(win);
  // Inside the context `window` is the context's global proxy, not `win` itself: events go to that.
  const glob = vm.runInContext('globalThis', ctx);
  function runScript(code) { try { vm.runInContext(code, ctx, { filename: 'app.js' }); } catch (err) { report(err); } }
  Object.assign(win, {
    window: win, document: doc, Event, MouseEvent, KeyboardEvent, Node, Element, HTMLElement, Document, Text,
    parent: { postMessage: m => onMessage(m) }, console: { log() {}, info() {}, warn() {}, error() {} },
    performance: { now: () => performance.now() },
    setTimeout: (f, ms) => timers.setTimeout(f, ms), clearTimeout: id => timers.clearTimeout(id),
    setInterval: (f, ms) => timers.setInterval(f, ms), clearInterval: id => timers.clearInterval(id),
    requestAnimationFrame: f => timers.setTimeout(f, 16), queueMicrotask: f => queueMicrotask(f)
  });
  Object.defineProperty(doc, 'currentScript', { value: null });
  return { ctx, win, doc, run: code => vm.runInContext(code, ctx, { filename: 'boot.js' }) };
}
