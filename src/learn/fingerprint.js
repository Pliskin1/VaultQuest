// Identity of a submission, independent of insignificant whitespace, so re-running unchanged code
// is recognised as the same attempt. Ported from the Demo (src/lib/fingerprint.js).
export const normaliseCode = code => code
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(line => line.replace(/\s+$/, ''))
  .filter((line, i, lines) => line !== '' || (i > 0 && lines[i - 1] !== ''))
  .join('\n')
  .trim();

// FNV-1a, 32-bit. Not cryptographic — only used for equality.
export function fingerprint(code) {
  const text = normaliseCode(code);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
