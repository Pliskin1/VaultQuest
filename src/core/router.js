// Screen switching with the prototype's fade/scale transition.
import { $ } from './dom.js';
import { anim, EASE } from './anim.js';
import { FX } from './fx.js';

let cur = 's-title';
export const current = () => cur;
export const setScreen = id => { cur = id; };

export async function go(id) {
  const a = $('#' + cur), b = $('#' + id);
  if (a === b) return;
  await anim(a, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.03)' }], { duration: 320, easing: EASE.in });
  a.classList.remove('on'); a.getAnimations().forEach(x => x.cancel());
  cur = id; b.classList.add('on');
  FX.bgOn = id === 's-title' || id === 's-lang' || id === 's-login';
  await anim(b, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE.out });
  b.getAnimations().forEach(x => x.cancel());
}
