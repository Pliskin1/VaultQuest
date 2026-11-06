// Screen switching with the prototype's fade/scale transition. Transitions run one after another: a second
// go() while one is still fading (a quick click on Back, a reply finishing) waits for it, so two screens can
// never end up shown at once.
import { $ } from './dom.js';
import { anim, EASE } from './anim.js';
import { FX } from './fx.js';

let cur = 's-title', chain = Promise.resolve();
export const current = () => cur;
export const setScreen = id => { cur = id; };

async function swap(id) {
  const a = $('#' + cur), b = $('#' + id);
  if (a === b) return;
  await anim(a, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.03)' }], { duration: 320, easing: EASE.in });
  a.classList.remove('on'); a.getAnimations().forEach(x => x.cancel());
  cur = id; b.classList.add('on');
  FX.bgOn = id === 's-title' || id === 's-lang' || id === 's-login';
  await anim(b, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE.out });
  b.getAnimations().forEach(x => x.cancel());
}
export function go(id) {
  chain = chain.catch(() => {}).then(() => swap(id));
  return chain;
}
