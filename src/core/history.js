// Browser Back inside the app. The app has no URLs per screen, so without this Back would leave VaultQuest
// mid-vault. Instead, Back does what the screen's own back control does (which saves and cleans up), and the
// app keeps one history entry of its own so the next Back is caught too. On the title, login, language and
// map screens Back leaves the app as usual. During celebrations Back does nothing; in the checkout it closes
// the dialog (unless the mock payment is already processing).

// screen: the current screen id · overlays: { cine, ship, pro, checkout, paying } → what Back should do.
export function backAction(screen, o = {}) {
  if (o.cine || o.ship || o.pro || (o.checkout && o.paying)) return { type: 'stay' };
  if (o.checkout) return { type: 'click', sel: '#co-x' };
  const BACK = { 's-level': '#lv-back', 's-project': '#pj-back', 's-blueprint': '#bp-back', 's-recovery': '#rc-back', 's-pro': '#pro-later' };
  if (BACK[screen]) return { type: 'click', sel: BACK[screen] };
  if (screen === 's-profile') return { type: 'map' };
  return { type: 'leave' };
}

// Wires it up (not in demo mode, which must never be steered by the browser).
export function mountHistory({ current, openMap, $ }) {
  const mark = () => { try { history.pushState({ vq: true }, ''); } catch { /* sandboxed or unsupported */ } };
  mark();
  addEventListener('popstate', () => {
    const on = id => $(id)?.classList.contains('on');
    const a = backAction(current(), { cine: on('#cine'), ship: on('#shipcine'), pro: on('#procine'), checkout: on('#checkout'), paying: !!$('#co-pay')?.disabled });
    if (a.type === 'leave') { history.back(); return; }
    mark();
    if (a.type === 'click') $(a.sel)?.click();
    else if (a.type === 'map') openMap();
  });
}
