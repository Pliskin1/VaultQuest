// Runs INSIDE a sandboxed frame (sandbox="allow-scripts", opaque origin, CSP default-src 'none') —
// installed as source text by sandbox/frame.js, so `harness` must stay self-contained: no imports, no
// outside variables. One frame = one fresh page = one run (a check, or the live preview).
//
// cfg: { mode: 'check'|'preview', nonce, code, data, check, budget, timerMax }
// checks: { id: async (t) => ({ pass, msg, expected, actual, tags }) } — only cfg.check runs.
// helpers: (t) => extra helpers for the checks (the project's own: add a task, read #count, …).
// prelude: (window, data) => globals the student's code may use (the project's `$`, `loadTasks`, …).
//
// Guard: instrumented student code calls __vq() in every loop condition and function entry. Once code has
// run for `budget` ms without the page getting a chance to breathe, every further __vq() throws until the
// event loop turns again, so `while (true) {}`, `for (;;);`, runaway recursion or a microtask chain stop
// with a clear error instead of freezing the app.
export function harness(cfg, checks, helpers, prelude) {
  var W = window, D = document, P = W.parent;
  var me = D.currentScript; if (me) me.remove(); // the student can't read the nonce from the page
  var nativeTimeout = W.setTimeout.bind(W), nativeInterval = W.setInterval.bind(W), nativeClear = W.clearInterval.bind(W);
  var now = W.performance.now.bind(W.performance), stringify = JSON.stringify, then = Promise.prototype.then;
  var qs = Document.prototype.querySelector, qsa = Document.prototype.querySelectorAll, click = HTMLElement.prototype.click;
  var post = function (m) { m.nonce = cfg.nonce; try { P.postMessage(m, '*'); } catch (e) { /* parent gone */ } };
  var LOOP = 'Your code kept running without stopping — is there a loop or a function call that never ends?';

  // ── guard ──
  var budget = cfg.budget || 400, armed = false, t0 = 0, hit = false, calls = 0, looped = false, phase = 'setup', loopPhase = null;
  var settle = function () { armed = false; hit = false; };
  var trip = function () { hit = true; looped = true; loopPhase = loopPhase || phase; var e = new Error(LOOP); e.name = 'TimeoutError'; throw e; };
  W.__vq = function () {
    if (hit) trip();
    if (!armed) { armed = true; t0 = now(); calls = 0; nativeTimeout(settle, 0); }
    if ((++calls & 15) === 0 && now() - t0 > budget) trip();
    return true;
  };
  W.__vqIt = function* (xs) { for (var v of xs) { W.__vq(); yield v; } };
  // Callbacks the code schedules count too: a callback storm stops instead of starving the page.
  var timers = 0, timerMax = cfg.timerMax || 2000, stormed = false, intervals = [];
  var wrap = function (f) {
    if (typeof f !== 'function') return f;
    return function () {
      if (++timers > timerMax) {
        if (!stormed) { stormed = true; intervals.forEach(nativeClear); fail({ name: 'TimeoutError', message: 'Your code scheduled thousands of timer callbacks, so they were stopped. Is a timer starting itself again and again?' }); }
        return;
      }
      W.__vq(); return f.apply(this, arguments);
    };
  };
  if (cfg.mode === 'preview') nativeInterval(function () { timers = Math.max(0, timers - 200); }, 1000);
  W.setTimeout = function (f, ms) { return nativeTimeout(wrap(f), ms); };
  W.setInterval = function (f, ms) { var id = nativeInterval(wrap(f), Math.max(4, ms | 0)); intervals.push(id); return id; };
  W.requestAnimationFrame = (function (raf) { return function (f) { return raf(wrap(f)); }; })(W.requestAnimationFrame.bind(W));
  W.queueMicrotask = (function (q) { return function (f) { return q(wrap(f)); }; })(W.queueMicrotask.bind(W));
  Promise.prototype.then = function (a, b) {
    return then.call(this, typeof a === 'function' ? function (v) { W.__vq(); return a(v); } : a, typeof b === 'function' ? function (x) { W.__vq(); return b(x); } : b);
  };

  // ── console + errors ──
  var logs = [], errors = [];
  var show = function (v) { if (typeof v === 'string') return v; try { return stringify(v); } catch (e) { return String(v); } };
  ['log', 'info', 'warn', 'error'].forEach(function (k) {
    W.console[k] = function () {
      var line = Array.prototype.map.call(arguments, show).join(' ').slice(0, 300);
      if (logs.length < 60) logs.push(line);
      if (cfg.mode === 'preview' && logs.length <= 60) post({ vq: 'log', line: line, level: k });
    };
  });
  var info = function (e, line) {
    if (!e || typeof e !== 'object') return { name: 'Error', message: String(e), line: line || null };
    var m = /<anonymous>:(\d+)|:(\d+):\d+\)?\s*$/m.exec(String(e.stack || ''));
    return { name: String(e.name || 'Error'), message: String(e.message || e).slice(0, 300), line: line || (m ? +(m[1] || m[2]) : null) };
  };
  function fail(err) {
    if (err.name === 'TimeoutError') looped = true;
    if (errors.length < 5) errors.push(err);
    if (cfg.mode === 'preview') post({ vq: 'error', error: err, loop: looped });
  }
  W.addEventListener('error', function (ev) {
    ev.preventDefault();
    var e = info(ev.error || ev.message, ev.lineno);
    if (ev.error && ev.error.name === 'TimeoutError') looped = true;
    if (/SyntaxError/.test(e.name) || /^(Uncaught )?SyntaxError/.test(String(ev.message))) { e.name = 'SyntaxError'; e.syntax = true; e.message = String(ev.message).replace(/^(Uncaught )?SyntaxError: /, ''); }
    fail(e);
  });
  W.addEventListener('unhandledrejection', function (ev) { ev.preventDefault(); fail(info(ev.reason)); });

  // ── run the student's code as a real script (line numbers match the editor) ──
  if (prelude) prelude(W, cfg.data);
  var started = false;
  var exec = function () {
    var s = D.createElement('script');
    s.textContent = cfg.code;
    started = true; D.body.appendChild(s); s.remove();
  };
  var tick = function (ms) { return new Promise(function (r) { nativeTimeout(r, ms || 0); }); };

  if (cfg.mode === 'preview') {
    // The parent can drive the preview (used by the ?demo=pro recording) and ask where things are.
    W.addEventListener('message', function (ev) {
      var d = ev.data;
      if (ev.source !== P || !d || d.vq !== 'act' || d.nonce !== cfg.nonce) return;
      var els = qsa.call(D, d.sel), el = els[d.i || 0], r = el ? el.getBoundingClientRect() : null;
      if (el && d.op === 'type') { el.focus(); el.value = d.text; el.dispatchEvent(new Event('input', { bubbles: true })); }
      if (el && d.op === 'click') click.call(el);
      post({ vq: 'acted', id: d.id, found: !!el, rect: r && { x: r.left, y: r.top, w: r.width, h: r.height } });
    });
    exec();
    tick(30).then(function () { post({ vq: 'status', errors: errors, loop: looped, logs: logs.length }); });
    return;
  }

  // ── one check ──
  var t = {
    data: cfg.data,
    qs: function (s) { return qs.call(D, s); },
    qsa: function (s) { return Array.prototype.slice.call(qsa.call(D, s)); },
    click: function (el) { click.call(el); },
    tick: tick,
    pass: function () { return { pass: true }; },
    fail: function (msg, o) { o = o || {}; return { pass: false, msg: msg, expected: o.expected, actual: o.actual, tags: o.tags || [] }; },
    missing: function (what) { var e = new Error('Could not find ' + what + ' on the page'); e.vqMissing = true; return e; }
  };
  var extra = helpers ? helpers(t) : {};
  for (var k in extra) t[k] = extra[k];
  (async function () {
    var out;
    try {
      phase = 'code'; exec();
      await tick(0);
      phase = 'check';
      if (errors.length || looped) out = { pass: false, msg: looped ? 'the code never stopped running' : 'your code stopped with an error' };
      else {
        var before = errors.length;
        out = await checks[cfg.check](t);
        await tick(0);
        if (!out || typeof out.pass !== 'boolean') out = { pass: false, msg: 'the check could not read a result' };
        if (errors.length > before && out.pass) out = { pass: false, msg: 'your code threw an error while the check used the page' };
      }
    } catch (e) {
      if (e && e.name === 'TimeoutError') looped = true;
      out = e && e.vqMissing ? { pass: false, msg: e.message, tags: ['null-element'] } : { pass: false, msg: looped ? 'the code never stopped running' : 'your code threw an error while the check used the page' };
      if (!(e && e.vqMissing) && !looped) fail(info(e));
    }
    out.vq = 'result'; out.check = cfg.check; out.errors = errors; out.loop = looped; out.loopPhase = loopPhase; out.logs = logs; out.started = started;
    post(out);
  })();
}
