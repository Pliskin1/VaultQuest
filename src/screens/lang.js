import { $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { S, save } from '../core/state.js';
import { openMap } from './map.js';

export function mount() {
  $$('.lcard[data-lang]').forEach(c => c.onclick = async () => {
    S.lang = c.dataset.lang; save();
    $$('.lcard').forEach(x => x.classList.toggle('picked', x === c));
    const p = ctr(c); FX.spark(p.x, p.y, 50); FX.ring(p.x, p.y, 260, '#F2B544');
    await anim(c, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 450, easing: EASE.out, fill: 'none' });
    await wait(250); openMap();
  });
}
