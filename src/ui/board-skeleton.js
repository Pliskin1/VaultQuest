// Leaderboard loading skeleton: placeholder markup shown while fetchBoard() is in flight.
// It reuses the real podium / row / panel classes (.pd, .pd-av, .pd-ped, .b-row, .b-av, .b-big …), so every
// placeholder has the same size as the thing it stands in for and nothing jumps when the board arrives.
// Pure string builders (no DOM access), so they can be unit-tested in Node.

export const SK_ROWS = 7; // ranks 4–10 of the default top-10 board (ranks 1–3 are on the podium)
const NAME_W = [62, 48, 70, 55, 40, 66, 52]; // % widths, so the rows don't look stamped out

const bar = (cls, w) => `<i class="sk ${cls}"${w ? ` style="width:${w}"` : ''}></i>`;

// Displayed 2nd · 1st · 3rd, like the real podium. The 1st place keeps room for the crown.
// Bars sit inside the same <span> / text boxes as the real name and XP, so they get the real line height
// (also where mobile.css shrinks the names).
export const podiumSkeleton = () => [2, 1, 3].map(n =>
  `<div class="pd pd${n} sk-pd" aria-hidden="true">${n === 1 ? '<span class="sk-crown"></span>' : ''}<div class="pd-av sk-fill"></div><div class="pd-nm"><span>${bar('sk-pnm')}</span></div><div class="pd-xp">${bar('sk-pxp')}</div><div class="pd-ped"></div></div>`
).join('');

// Same six cells as a real row (rank · player · level · vaults · streak · XP), so the grid columns line up
// and the phone layout hides the same cells. Screen readers get one "Loading rankings…" item instead.
export function rowsSkeleton(n = SK_ROWS) {
  const rows = Array.from({ length: Math.max(0, n) }, (_, i) =>
    `<li class="b-row" aria-hidden="true"><span class="b-rk">${bar('sk-rk')}</span><span class="b-pl"><span class="b-av sk-fill"></span>${bar('sk-nm', NAME_W[i % NAME_W.length] + '%')}</span><span class="b-c">${bar('sk-c')}</span><span class="b-c">${bar('sk-c')}</span><span class="b-c">${bar('sk-c')}</span><span class="b-xp">${bar('sk-xp')}</span></li>`
  ).join('');
  return `<li class="sr">Loading rankings…</li>${rows}`;
}

// "Your position" panel: real heading, then bars where the rank, score, next-up line and button go.
// No real button, so keyboard users can't tab into a placeholder.
export const meSkeleton = () =>
  '<div class="kicker" style="color:var(--gold)">YOUR POSITION</div>' +
  `<div class="b-big" aria-hidden="true">${bar('sk-big')}${bar('sk-ln', '90px')}</div>` +
  `<div class="b-sc" aria-hidden="true">${bar('sk-sc')}${bar('sk-ln', '120px')}</div>` +
  '<hr aria-hidden="true">' +
  `<div class="b-next" aria-hidden="true"><span style="flex:1">${bar('sk-ln', '60%')}</span><span>${bar('sk-ln', '32px')}</span></div>` +
  '<div class="pbar" aria-hidden="true"></div>' +
  `<p class="b-gapx" aria-hidden="true">${bar('sk-ln', '70%')}</p>` +
  '<div class="sk-fill sk-btn" aria-hidden="true"></div>';
