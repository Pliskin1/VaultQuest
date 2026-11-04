// Demo directors for recording the pitch video: ?demo=1 (free flow) and ?demo=pro (Pro flow).
// Drives the real UI with a fake cursor + captions. Never touches localStorage (see core/state.js).
import { $, $$, ctr } from '../core/dom.js';
import { anim, EASE } from '../core/anim.js';
import { wait, nextFrame } from '../core/clock.js';
import { FX } from '../core/fx.js';
import { setScreen } from '../core/router.js';
import { S } from '../core/state.js';
import { renderMap, setSel } from '../screens/map.js';
import { pjRefresh, previewAct } from '../screens/project.js';
import { preloadPython } from '../run/py-runner.js';

const cur = $('#cursor');
let cx = innerWidth * .62, cy = innerHeight * .72;

async function move(el, dur = 750, dx = 0, dy = 0) {
  const p = el.getBoundingClientRect ? ctr(el) : el, tx = p.x + dx, ty = p.y + dy;
  await anim(cur, [{ transform: `translate(${cx}px,${cy}px)` }, { transform: `translate(${tx}px,${ty}px)` }], { duration: dur, easing: EASE.inout });
  cx = tx; cy = ty; cur.style.transform = `translate(${cx}px,${cy}px)`; cur.getAnimations().forEach(a => a.cancel());
}
async function click(el, dur) {
  await move(el, dur); await wait(140);
  anim(cur.querySelector('svg'), [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 220, fill: 'none' });
  anim(cur.querySelector('.rp'), [{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 500, fill: 'none' });
  await wait(120); el.click(); await wait(200);
}
async function type(el, txt, ms = 75) { el.focus(); for (const ch of txt) { el.value += ch; el.dispatchEvent(new Event('input')); await wait(ms); } }
async function cap(k, t) {
  const c = $('#caption');
  if (c.style.display === 'flex') await anim(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 250 });
  if (!t) { c.style.display = 'none'; return; }
  $('#cap-k').textContent = k; $('#cap-t').textContent = t; c.style.display = 'flex';
  await anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: EASE.out });
}
const waitFor = async f => { while (!f()) await wait(100); };
const visible = el => parseFloat(getComputedStyle(el).opacity) > .95;
const emblem = () => $('.emblem').innerHTML;

async function endcard(html, stagger = 150) {
  const e = $('#endcard'); e.innerHTML = html; e.style.display = 'flex'; cur.style.display = 'none';
  await anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'none' });
  [...e.children].forEach((c, k) => anim(c, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: k * stagger, easing: EASE.out, fill: 'backwards' }));
}

async function freeDemo() {
  cur.style.display = 'block'; cur.style.transform = `translate(${cx}px,${cy}px)`;
  preloadPython();
  await document.fonts.ready; await wait(300);
  anim($('#logo'), [{ opacity: 0, letterSpacing: '.5em', filter: 'blur(10px)' }, { opacity: 1, letterSpacing: '.14em', filter: 'blur(0)' }], { duration: 1400, easing: EASE.out, fill: 'none' });
  await wait(1200); cap('VAULTQUEST', 'Learn to code by cracking vaults'); await wait(2200);
  await click($('#btn-start'), 1100); await wait(900);
  cap('STEP 1', 'Pick a language'); await wait(1500);
  await click($('.lcard[data-lang="py"]'), 900); await wait(1300);
  cap('THE MAP', 'Every level is a locked vault'); await wait(1600);
  await move($('#m-nodes .node[data-i="3"] .nbtn'), 900); await wait(700);
  await click($('#m-nodes .node[data-i="0"] .nbtn'), 900); await wait(900);
  await click($('#m-play'), 800); await wait(2600);
  cap('CHALLENGES', 'Handcrafted tasks: quizzes, fill-ins, fix-the-bug'); await wait(1600);
  await click($$('.opt')[0], 900); await wait(2600);
  await move($('#blank'), 800); await type($('#blank'), '"False"', 150); await wait(400); await click($('#b-check'), 500);
  cap('AI MENTOR', 'Make a mistake? It explains exactly why'); await wait(4200);
  await click($('#m-in'), 900); await type($('#m-in'), 'what\'s the difference between False and "False"?', 45); await wait(300);
  cap('AI MENTOR', 'Ask it anything about the task'); $('#m-form').requestSubmit(); await wait(6200);
  await click($('#blank'), 900); await type($('#blank'), 'False', 150); await wait(300); await click($('#b-check'), 500);
  await waitFor(() => $('#ed')); await wait(1200); // the filled-in code runs for real before the next card
  cap('FIX THE BUG', 'Real code runs — real errors, explained in plain words'); await wait(1000);
  await click($('#b-run'), 900); await waitFor(() => !$('#b-run').disabled); await wait(4000);
  await click($('#btn-hint'), 900); await wait(3600);
  const ta = $('#ed'), idx = ta.value.indexOf('Read a book'), pre = $('#ed-hl').getBoundingClientRect();
  const cw = (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '17px JetBrains Mono'; return c.measureText('M').width; })();
  await move({ x: pre.left + 56 + (idx - ta.value.lastIndexOf('\n', idx) - 1) * cw + cw * .5, y: pre.top + 18 + 28.9 * 1.5 }, 900); await wait(300);
  ta.focus(); ta.selectionStart = ta.selectionEnd = idx; await wait(300);
  ta.value = ta.value.slice(0, idx) + '"' + ta.value.slice(idx); ta.selectionStart = ta.selectionEnd = idx + 1; ta.oninput(); await wait(260); // quote the title
  const end = idx + 1 + 'Read a book'.length;
  ta.value = ta.value.slice(0, end) + '"' + ta.value.slice(end); ta.selectionStart = ta.selectionEnd = end + 1; ta.oninput(); await wait(700);
  cap(''); await click($('#b-run'), 800);
  await waitFor(() => $('#cine').classList.contains('on')); await wait(8000);
  cap('LEVEL COMPLETE', 'Stars, XP, level-ups and achievements'); await waitFor(() => visible($('#c-next'))); await wait(1500);
  cap(''); await click($('#c-next'), 900); await wait(1200);
  cap('PROGRESS', 'Your path unlocks as you learn'); await wait(3200);
  await click($$('#s-map .hud-prof')[0], 900); await wait(1200);
  cap('PROFILE', 'Track progress and collect badges'); await wait(4200); cap('');
  await endcard(`<div class="emblem" style="width:150px;height:150px">${emblem()}</div><div class="logo" style="font-size:80px">VAULT<span>QUEST</span></div><div style="font-size:22px;color:var(--mut)">Learn to code. Crack the vaults.</div><div class="kicker" style="margin-top:18px;color:var(--gold)">AI MENTOR · HANDCRAFTED CHALLENGES · GAME PROGRESSION</div>`);
  await wait(3800); window.__DONE = true;
}

const M1 = 'function render() {\n  list.innerHTML = "";\n  tasks.forEach(task => {\n    const li = document.createElement("li");\n    li.textContent = task.title;\n    list.appendChild(li);\n  });\n}\nrender();\n';
const BUG = '\n$("#add").onclick = () => {\n  list.innerHTML = "<li>" + $("#task").value + "</li>";\n};\n';
const FINAL = '// The HTML is ready: #task, #add, #list, #count\n// loadTasks() gives you the saved tasks: [{ title: "…", done: false }, …]\nconst tasks = loadTasks();\nconst list = $("#list");\n\nfunction render() {\n  list.innerHTML = "";\n  tasks.forEach(task => {\n    const li = document.createElement("li");\n    li.textContent = task.title;\n    if (task.done) li.classList.add("done");\n    li.onclick = () => { task.done = !task.done; render(); };\n    list.appendChild(li);\n  });\n  const left = tasks.filter(t => !t.done).length;\n  $("#count").textContent = left + " left";\n}\n\n$("#add").onclick = () => {\n  tasks.push({ title: $("#task").value, done: false });\n  $("#task").value = "";\n  render();\n};\n\nrender();\n';

async function proDemo() {
  cx = innerWidth * .6; cy = innerHeight * .7;
  const ta = $('#pj-ta'), edw = $('#pj-edw');
  const typeCode = async (txt, cpf = 2) => { for (let i = 0; i < txt.length; i += cpf) { ta.value += txt.slice(i, i + cpf); pjRefresh(); edw.scrollTop = edw.scrollHeight; await nextFrame(); } };
  const morph = async (fin, cpf = 10) => {
    let p = 0; while (p < ta.value.length && ta.value[p] === fin[p]) p++;
    while (ta.value.length > p) { ta.value = ta.value.slice(0, Math.max(p, ta.value.length - cpf * 2)); pjRefresh(); edw.scrollTop = edw.scrollHeight; await nextFrame(); }
    for (let i = p; i < fin.length; i += cpf) { ta.value = fin.slice(0, i + cpf); pjRefresh(); edw.scrollTop = edw.scrollHeight; await nextFrame(); }
  };
  Object.assign(S, { lang: 'js', xp: 1240, done: { py: 5, js: 5 }, stars: { js0: 3, js1: 3, js2: 2, js3: 3, js4: 3, py0: 3, py1: 3, py2: 3, py3: 2, py4: 3 }, ach: ['first', 'curious', 'bounce', 'clean', 'debug', 'combo'], fresh: [], streak: 6, questions: 9, pro: false, projects: [] });
  await document.fonts.ready;
  const card = (sub, k) => `<div class="emblem" style="width:150px;height:150px">${emblem()}</div><div style="display:flex;align-items:center;gap:18px"><div class="logo" style="font-size:78px">VAULT<span>QUEST</span></div><span style="padding:6px 14px;border-radius:10px;background:var(--violet);color:#07090F;font-family:var(--disp);font-weight:700;font-size:34px;letter-spacing:.12em">PRO</span></div><div style="font-size:22px;color:var(--mut)">${sub}</div><div class="kicker" style="margin-top:16px;color:var(--violet)">${k}</div>`;
  const e = $('#endcard');
  e.innerHTML = card('From the basics to building real apps.', 'ADVANCED VAULTS · GUIDED PROJECTS · AI CODE REVIEW'); e.style.display = 'flex';
  [...e.children].forEach((c, k) => anim(c, [{ opacity: 0, transform: 'translateY(24px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 900, delay: k * 180, easing: EASE.out, fill: 'backwards' }));
  await wait(3000);
  $('#s-title').classList.remove('on'); $('#s-map').classList.add('on'); cur.style.display = 'block'; cur.style.transform = `translate(${cx}px,${cy}px)`;
  FX.bgOn = false; setSel(3); renderMap(); setScreen('s-map');
  await anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }); e.style.display = 'none'; e.getAnimations().forEach(a => a.cancel());
  cap('FREE PLAN', 'Every language starts with free basic vaults'); await wait(2600);
  await click($('#m-nodes .node[data-i="6"] .nbtn'), 1100); await wait(500);
  cap('GO FURTHER', 'Advanced vaults and real projects live in Pro'); await wait(2400);
  await click($('#m-pro'), 900); await wait(1300);
  cap('VAULTQUEST PRO', 'Advanced levels, guided projects, AI code review'); await wait(3400);
  await move($$('.plan')[0], 800); await wait(400); await click($$('.plan')[1], 600); await wait(500);
  await click($('#pro-cta'), 800); await wait(1300);
  cap(''); await click($('#co-pay'), 900);
  await waitFor(() => visible($('#p-next')));
  cap('PRO UNLOCKED', 'Every advanced vault opens instantly'); await wait(1800);
  cap(''); await click($('#p-next'), 900);
  await waitFor(() => $('#m-count').textContent.startsWith('Pro unlocked')); await wait(1600);
  cap('PRO PATH', 'New vaults + projects in every language'); await wait(1600);
  await click($('#m-nodes .node[data-i="6"] .nbtn'), 900); await wait(800);
  cap('GUIDED PROJECTS', 'Build real mini apps, milestone by milestone'); await wait(1200);
  await click($('#m-play'), 800); await wait(2800);
  await move(ta, 800, -60, 40); await wait(200); ta.focus(); await typeCode(M1, 2); await wait(300);
  await click($('#pj-run'), 700);
  cap('LIVE PREVIEW', 'Your code runs instantly, tests check each milestone'); await wait(4400);
  await move(ta, 600, -40, 60); ta.focus(); await typeCode(BUG, 2); await wait(300); await click($('#pj-run'), 700);
  cap('AI CODE REVIEW', 'It spots the bug and explains the fix'); await wait(6200);
  cap(''); const tl = $('#pj-tl'); anim(tl, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); await morph(FINAL, 10); await wait(200); anim(tl, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  await click($('#pj-run'), 700); await wait(3600);
  cap('IT REALLY WORKS', 'A real app — built by you');
  // The app runs in a sandboxed frame: the cursor moves to where the frame reports its elements, and the
  // frame itself performs the typing and clicks (run/sandbox/preview.js).
  const inPreview = async (op, sel, extra = {}, dur = 700) => { const r = await previewAct({ op: 'rect', sel, ...extra }); if (r?.rect) await move({ x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 }, dur); await wait(140); return previewAct({ op, sel, ...extra }); };
  await inPreview('rect', '#task', {}, 800); let typed = '';
  for (const ch of 'Ship VaultQuest') { typed += ch; await previewAct({ op: 'type', sel: '#task', text: typed }); await wait(55); } await wait(200);
  await inPreview('click', '#add', {}, 600); await wait(700); await inPreview('click', '#list li', { i: 0 }, 700); await wait(1100);
  cap(''); await click($('#pj-submit'), 900);
  await waitFor(() => visible($('#s-next')));
  cap('SHIPPED', 'Every project lands in your portfolio'); await wait(2200); cap('');
  await click($('#s-next'), 900); await wait(1300);
  cap('PORTFOLIO', 'Show employers what you\'ve actually built'); await wait(3600); cap('');
  await endcard(card('Learn the basics free. Build real apps with Pro.', '€4.99 / MONTH · €39.99 / YEAR · 7-DAY FREE TRIAL'));
  await wait(4200); window.__DONE = true;
}

export function runDemo(mode) {
  document.body.classList.add('demo');
  (mode === 'pro' ? proDemo : freeDemo)();
}
