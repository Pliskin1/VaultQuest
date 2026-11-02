export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const ctr = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
