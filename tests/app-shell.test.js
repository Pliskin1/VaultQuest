// Phase 10 app shell: browser Back inside the app (core/history.js) and the error banner's filter
// (core/errors.js). The browser behaviour itself is covered by the browser verification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../src/core/history.js';
import { isAppError } from '../src/core/errors.js';

test('Back on a task screen does what its own back control does (which saves and cleans up)', () => {
  assert.deepEqual(backAction('s-level'), { type: 'click', sel: '#lv-back' });
  assert.deepEqual(backAction('s-project'), { type: 'click', sel: '#pj-back' });
  assert.deepEqual(backAction('s-blueprint'), { type: 'click', sel: '#bp-back' });
  assert.deepEqual(backAction('s-recovery'), { type: 'click', sel: '#rc-back' });
  assert.deepEqual(backAction('s-pro'), { type: 'click', sel: '#pro-later' });
  assert.deepEqual(backAction('s-profile'), { type: 'map' });
});

test('Back leaves the app only from the top-level screens', () => {
  for (const s of ['s-title', 's-login', 's-lang', 's-map']) assert.deepEqual(backAction(s), { type: 'leave' });
});

test('Back never interrupts a celebration or a payment in progress; it closes the checkout otherwise', () => {
  for (const o of [{ cine: true }, { ship: true }, { pro: true }, { checkout: true, paying: true }]) assert.deepEqual(backAction('s-level', o), { type: 'stay' }, JSON.stringify(o));
  assert.deepEqual(backAction('s-pro', { checkout: true }), { type: 'click', sel: '#co-x' });
});

test('the error banner reacts only to VaultQuest\'s own errors', () => {
  const origin = 'http://localhost:5173';
  assert.equal(isAppError({ message: 'TypeError: x is undefined', filename: origin + '/src/screens/map.js', origin }), true);
  assert.equal(isAppError({ message: 'boom', filename: '', origin }), true); // unhandled rejection
  assert.equal(isAppError({ message: 'boom', filename: 'chrome-extension://abc/content.js', origin }), false);
  assert.equal(isAppError({ message: 'boom', filename: 'https://cdn.example.com/x.js', origin }), false);
  assert.equal(isAppError({ message: 'Script error.', filename: '', origin }), false);
  assert.equal(isAppError({ message: 'ResizeObserver loop completed with undelivered notifications.', filename: origin + '/x.js', origin }), false);
});
