// A vanilla stand-in for an error boundary: if VaultQuest's own code throws, the student sees a small
// banner — their progress is saved, they can reload or go back to the map — instead of a silently broken
// screen. Errors from browser extensions, cross-origin scripts and the sandboxed project frames (separate
// windows, they never reach this page) are not the app's and are ignored.

const IGNORE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection captured/i;
// e: { message, filename, origin } → is this an error from VaultQuest's own code?
export function isAppError({ message = '', filename = '', origin = '' } = {}) {
  if (IGNORE.test(String(message))) return false;
  if (!filename) return true; // unhandled promise rejections have no file
  return String(filename).startsWith(origin);
}

export function mountErrors({ openMap }) {
  let shown = false;
  const show = () => {
    if (shown) return; shown = true;
    const b = document.createElement('div');
    b.className = 'app-error'; b.setAttribute('role', 'alert');
    b.innerHTML = '<b>Something went wrong on this screen.</b><span>Your saved progress is safe.</span><button class="btn ghost" data-a="map">BACK TO THE MAP</button><button class="btn" data-a="reload">RELOAD</button>';
    b.onclick = e => { const a = e.target.closest('button')?.dataset.a; if (a === 'reload') location.reload(); if (a === 'map') { b.remove(); shown = false; openMap(); } };
    document.body.appendChild(b);
  };
  addEventListener('error', e => { if (isAppError({ message: e.message, filename: e.filename, origin: location.origin })) { console.error('[vaultquest]', e.error || e.message); show(); } });
  addEventListener('unhandledrejection', e => { const m = e.reason?.message ?? String(e.reason); if (isAppError({ message: m, origin: location.origin })) { console.error('[vaultquest]', e.reason); show(); } });
}
