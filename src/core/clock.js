// Frame-driven clock: all animation waits resolve on rAF ticks, so demos stay deterministic and recordable.
export const Clock = { t: 0, last: null, waits: [], tickers: [] };
export const wait = ms => new Promise(r => Clock.waits.push({ at: Clock.t + ms, r }));
export const nextFrame = () => wait(1);
export const onTick = fn => Clock.tickers.push(fn);

function loop(ts) {
  if (Clock.last == null) Clock.last = ts;
  const dt = Math.min(50, Math.max(0, ts - Clock.last));
  Clock.last = ts; Clock.t += dt;
  const due = Clock.waits.filter(w => w.at <= Clock.t);
  Clock.waits = Clock.waits.filter(w => w.at > Clock.t);
  due.forEach(w => w.r());
  for (const f of Clock.tickers) f(dt);
  requestAnimationFrame(loop);
}
export const startClock = () => requestAnimationFrame(loop);
