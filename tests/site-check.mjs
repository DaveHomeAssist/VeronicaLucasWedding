/**
 * Static behavior checks for the wedding site.
 *
 * No dependencies — runs with plain Node:
 *   node tests/site-check.mjs
 *
 * Guards the class of failure the 2026-08-24 audit found (a visible core
 * form silently disconnected from its script):
 *   1. every inline <script> in index.html must parse as valid JavaScript;
 *   2. every element id the script looks up must exist in the markup;
 *   3. the RSVP form must stay wired to the worker endpoints, and both
 *      forms confirm only after the worker acknowledged the write;
 *   4. ids must be unique so getElementById stays deterministic.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const failures = [];
const warnings = [];

// ── 1. Inline scripts must parse ─────────────────────────────────────
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
if (scripts.length === 0) {
  failures.push('No inline <script> blocks found in index.html — the page behavior is missing.');
}
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `index.html <script> #${i + 1}` });
  } catch (err) {
    failures.push(`Inline script #${i + 1} has a syntax error: ${err.message}`);
  }
});

// ── 2. Every id the script references must exist in the markup ───────
const markup = html.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');
const definedIds = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const referencedIds = new Set(
  scripts.flatMap((code) => [...code.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])),
);
for (const id of referencedIds) {
  if (!definedIds.has(id)) {
    failures.push(`Script references getElementById('${id}') but no element with id="${id}" exists.`);
  }
}

// ── 3. The RSVP form must stay wired to the worker ───────────────────
const allScript = scripts.join('\n');
if (!/apiPost\(\s*'\/rsvp'/.test(allScript)) {
  failures.push("The RSVP submit handler no longer posts to '/rsvp' — the form is disconnected.");
}
if (!/apiPost\(\s*'\/shenanigans'/.test(allScript)) {
  failures.push("The shenanigans submit handler no longer posts to '/shenanigans'.");
}
const apiBaseMatch = allScript.match(/const API_BASE = '([^']*)'/);
if (!apiBaseMatch) {
  failures.push('API_BASE is no longer defined in index.html.');
} else if (apiBaseMatch[1] === '') {
  warnings.push(
    'API_BASE is empty: RSVP submissions fall back to the email path. '
      + 'Deploy the worker and set API_BASE to go live (see worker/wrangler.toml).',
  );
}

// ── 3b. "Submitted" must mean the worker acknowledged the write ──────
// Guards the false-confirmation class (audit C-1): the browser may only
// record an RSVP or shenanigan as submitted after apiPost() resolved ok.
function handlerBody(endpoint) {
  const call = allScript.indexOf(`apiPost('${endpoint}'`);
  if (call < 0) return null;
  return { start: allScript.lastIndexOf('addEventListener(', call), call };
}
{
  const rsvp = handlerBody('/rsvp');
  if (rsvp) {
    const awaited = /=\s*await\s+apiPost\(\s*'\/rsvp'/.test(allScript);
    const okCheck = allScript.indexOf('if (!result.ok)', rsvp.call);
    const confirm = allScript.indexOf('store.rsvp.submittedAt = new Date', rsvp.start);
    if (!awaited) failures.push("RSVP submit does not await apiPost('/rsvp') — the result is never checked.");
    if (okCheck < 0 || confirm < 0 || confirm < okCheck) {
      failures.push('RSVP marks submittedAt before checking result.ok — a failed send would show a confirmation.');
    }
  }
  const shen = handlerBody('/shenanigans');
  if (shen) {
    const awaited = /=\s*await\s+apiPost\(\s*'\/shenanigans'/.test(allScript);
    const okCheck = allScript.indexOf('if (!result.ok)', shen.call);
    const confirm = allScript.indexOf('submitted: true', shen.start);
    if (!awaited) failures.push("Shenanigans submit does not await apiPost('/shenanigans') — the result is never checked.");
    if (okCheck < 0 || confirm < 0 || confirm < okCheck) {
      failures.push('Shenanigans marks the card submitted before checking result.ok — a failed send would show "Submitted".');
    }
  }
}

// ── 4. Element ids must be unique ────────────────────────────────────
const idCounts = new Map();
for (const [, id] of markup.matchAll(/\bid="([^"]+)"/g)) {
  idCounts.set(id, (idCounts.get(id) || 0) + 1);
}
for (const [id, count] of idCounts) {
  if (count > 1) failures.push(`Duplicate id="${id}" appears ${count} times.`);
}

// ── Report ───────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`WARN: ${w}`);
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
const live = apiBaseMatch && apiBaseMatch[1] !== '';
console.log(
  `OK: ${scripts.length} inline script(s) parse, ${referencedIds.size} referenced ids resolve, `
    + 'RSVP + shenanigans post to the worker and confirm only on a server ack '
    + (live ? `(API_BASE=${apiBaseMatch[1]}), ` : '(API_BASE empty: NOT live, email fallback only), ')
    + 'all ids unique.',
);
