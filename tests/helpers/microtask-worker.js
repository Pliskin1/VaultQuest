// Runs one project check in its own thread: a microtask storm stopped by the guard ends in rejected promises
// that a browser frame reports to its own `unhandledrejection` listener — here they stay in this thread.
import { parentPort, workerData } from 'node:worker_threads';
import { LANGS } from '../../src/content/languages.js';
import { runJsProject } from '../../src/run/project-js.js';
import { vmFrame } from './frame.js';

process.on('unhandledRejection', () => {});
const lv = LANGS.js.levels[6], small = { ...lv, checks: lv.checks.slice(0, 2) };
runJsProject(workerData.code, small, { seed: 1, runFrame: vmFrame }).then(r => parentPort.postMessage({ timeout: r.timeout, failing: r.checks.filter(c => !c.pass).length }));
