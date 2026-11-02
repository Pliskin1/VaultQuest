import { $, ctr } from '../core/dom.js';
import { wait } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { currentUser } from '../core/state.js';
import { openLogin, enterGame } from './login.js';

export function mount() {
  $('#btn-start').onclick = async () => {
    const p = ctr($('#btn-start'));
    FX.spark(p.x, p.y, 40); FX.ring(p.x, p.y, 220, '#F2B544');
    await wait(250);
    currentUser() ? enterGame() : openLogin();
  };
}
