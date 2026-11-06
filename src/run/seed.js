// Deterministic randomness for project checks: the same code always gets the same test data (so running it
// again gives the same result), while different code gets different data (so hardcoded answers fail).
import { fingerprint } from '../learn/fingerprint.js';

export const seedOf = code => parseInt(fingerprint(String(code ?? '')).slice(-8), 16) >>> 0;

// mulberry32 → () => float in [0, 1)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
