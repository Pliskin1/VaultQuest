export const EASE = { out: 'cubic-bezier(.2,.8,.2,1)', back: 'cubic-bezier(.2,1.4,.3,1)', inout: 'cubic-bezier(.65,0,.35,1)', in: 'cubic-bezier(.6,0,.9,.4)', door: 'cubic-bezier(.75,0,.2,1)' };
export const anim = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'forwards' }, typeof o === 'number' ? { duration: o } : o)).finished.catch(() => {});
export const cancelAnims = (...els) => els.forEach(e => e && e.getAnimations().forEach(a => a.cancel()));
export const shake = (el, px = 1, ms = 380) => anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${-6 * px}px,${3 * px}px)` }, { transform: `translate(${5 * px}px,${-4 * px}px)` }, { transform: `translate(${-3 * px}px,${2 * px}px)` }, { transform: 'translate(0,0)' }], { duration: ms, fill: 'none' });
