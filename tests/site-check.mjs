/**
 * Static behavior checks for the wedding site.
 *
 * No dependencies — runs with plain Node:
 *   node tests/site-check.mjs
 *
 *   1. every inline <script> in index.html must parse as valid JavaScript;
 *   2. every element id the script looks up must exist in the markup;
 *   3. RSVP and shenanigans collection stays closed (the wedding is over);
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

// ── 3. Collection stays closed now that the wedding is over ──────────
const allScript = scripts.join('\n');
if (/apiPost\(/.test(allScript)) {
  failures.push('index.html still posts form data. RSVP and shenanigans collection should stay closed.');
}
if (/localStorage\.setItem/.test(allScript)) {
  failures.push('index.html still calls localStorage.setItem. Saved guest details should be cleared, not written.');
}
if (!/localStorage\.removeItem/.test(allScript)) {
  failures.push('index.html no longer removes saved guest details from localStorage.');
}
if (/id="rsvpForm"|id="rsvpSubmit"|class="shenanigan-form"|role="button"/.test(markup)) {
  failures.push('The RSVP form or a guest-book role=button is back in the page.');
}
if (!/cleared when this page loads/.test(markup)) {
  failures.push('The privacy note no longer says saved details are cleared when the page loads.');
}
if (/2027-02-01/.test(html)) {
  failures.push('index.html still mentions the old 2027-02-01 clear-out date.');
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
console.log(
  `OK: ${scripts.length} inline script(s) parse, ${referencedIds.size} referenced ids resolve, `
    + 'RSVP and shenanigans collection stays closed, saved browser details are cleared, all ids unique.',
);
