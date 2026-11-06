// Small helpers for writing behaviour checks in curriculum content (content/js-world1.js, py-world1.js).
export const check = (id, name, test) => ({ id, name, test });
export const result = (pass, expected, actual) => ({ pass: !!pass, expected, actual });
export const binding = (obs, name) => obs.globals?.[name];
export const call = (obs, id) => obs.calls?.find(c => c.id === id) ?? {};
// A function's list after the call: the list it returned, or the argument it changed.
export const listAfter = (obs, id) => { const c = call(obs, id); return Array.isArray(c.value) ? c.value : c.args?.[0]; };

// How a value reads in each language, for "expected … got …" lines.
export function jsShow(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jsShow).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${jsShow(x)}`).join(', ')} }`;
  return String(v);
}
export function pyShow(v) {
  if (v === undefined) return 'not defined';
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(pyShow).join(', ')}]`;
  if (typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyShow(x)}`).join(', ')}}`;
  return String(v);
}
