import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { go } from '../core/router.js';

export function mount() {
  $('#btn-start').onclick = async () => {
    const p = ctr($('#btn-start'));
    FX.spark(p.x, p.y, 40); FX.ring(p.x, p.y, 220, '#F2B544');
    await wait(250); await go('s-lang');
    $$('.lcard').forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(40px) rotateX(-20deg)' }, { opacity: c.classList.contains('locked') ? .55 : 1, transform: 'none' }], { duration: 700, delay: i * 90, easing: EASE.out, fill: 'none' }));
  };
}
