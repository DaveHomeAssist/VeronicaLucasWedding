/**
 * Static checks for the accessibility and privacy fixes.
 *
 * No dependencies — runs with plain Node:
 *   node tests/audit-check.mjs
 *
 * Prints every tracked contrast ratio. Exits 1 if HTML structure, labels,
 * or contrast fall short of the WCAG 2.2 AA thresholds used here
 * (4.5:1 for text, 3:1 for large text and for the focus ring).
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const config = readFileSync(join(root, '_config.yml'), 'utf8');
const failures = [];

function lin(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function lum(rgb) {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function contrast(fg, bg) {
  const L1 = lum(fg);
  const L2 = lum(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function parseColor(input) {
  const value = input.trim();
  if (value.startsWith('#')) {
    let h = value.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) throw new Error(`Unparsed color ${input}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}
function over(fg, bg) {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

const rootBlock = html.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootBlock) failures.push('Missing :root color tokens.');
const vars = {};
for (const match of rootBlock[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
  vars[match[1]] = match[2].trim();
}
function token(name) {
  const raw = vars[name];
  if (!raw) throw new Error(`Missing --${name}`);
  return parseColor(raw);
}

const paper = token('paper');
const warm = token('paper-warm');
const ink = token('ink');
const inkSoft = token('ink-soft');
const gold = token('gold');
const goldLight = token('gold-light');
const goldInk = token('gold-ink');
const sageInk = token('sage-ink');
const dark = parseColor('#1A1917');
const charcoal = token('charcoal-warm');
const cream = token('cream');
const creamMuted = over(parseColor(vars['cream-muted']), dark);
const heroCream = over(parseColor('rgba(245,240,232,0.8)'), dark);
const shenText = over(parseColor('rgba(245,240,232,0.7)'), charcoal);
const focusRing = token('focus-ring');
const focusContrast = token('focus-contrast');

// WCAG large text is 24px, or 18.67px at weight 700 or more.
function need(px, weight) {
  const large = px >= 24 || (weight >= 700 && px >= 18.67);
  return large ? 3 : 4.5;
}

const styles = [
  ['Section label on dark', goldLight, dark, 12, 500],
  ['Section label on charcoal', goldLight, charcoal, 12, 500],
  ['Section label on paper', sageInk, paper, 12, 500],
  ['Detail meta on warm paper', sageInk, warm, 12, 500],
  ['Hero date on paper', goldInk, paper, 17.6, 300],
  ['Ampersand on paper, mobile size', goldInk, paper, 16, 400],
  ['Add to calendar on warm paper', goldInk, warm, 12, 500],
  ['Venue and registry links on warm paper', goldInk, warm, 16, 400],
  ['See Travel link on paper', goldInk, paper, 16.8, 400],
  ['Hero thank-you button, ink on gold', ink, gold, 12, 500],
  ['Hero button hover, ink on gold-light', ink, token('gold-light'), 12, 500],
  ['Hero secondary button on dark', heroCream, dark, 12, 500],
  ['Footer contact on dark', goldLight, dark, 12, 400],
  ['Footer line, gold on dark', gold, dark, 17.6, 400],
  ['Story paragraph, muted cream on dark', creamMuted, dark, 18.4, 300],
  ['Shenanigans paragraph on charcoal', shenText, charcoal, 18.4, 300],
  ['Privacy note, muted cream on dark', creamMuted, dark, 16, 300],
  ['Hero location on paper', inkSoft, paper, 12, 400],
  ['Countdown line, gold-light on dark', goldLight, dark, 21.6, 400],
  ['Schedule time, gold-light on charcoal', goldLight, charcoal, 21.6, 300],
  ['Focus ring, cream against dark', focusRing, dark, 0, 400],
  ['Focus ring, bronze against paper', focusContrast, paper, 0, 400],
  ['404 link, bronze on cream', goldInk, parseColor('#F5F0E8'), 16, 400],
];

console.log('Contrast ratios (WCAG 2.2 AA: 4.5:1 text, 3:1 large text and non-text focus ring)');
console.log('style | ratio | need | result');
for (const [name, fg, bg, px, weight] of styles) {
  const ratio = contrast(fg, bg);
  const minimum = px === 0 ? 3 : need(px, weight);
  const pass = ratio + 1e-9 >= minimum;
  console.log(`${name} | ${ratio.toFixed(2)}:1 | ${minimum}:1 | ${pass ? 'pass' : 'FAIL'}`);
  if (!pass) failures.push(`${name} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`);
}

function mustInclude(haystack, needle, message) {
  if (!haystack.includes(needle)) failures.push(message || `Missing ${needle}`);
}

mustInclude(html, '.section-label {\n    font-family: var(--font-body);\n    font-size: 0.75rem;', 'Section labels are still under 12px.');
mustInclude(html, 'color: var(--gold-light);', 'A light-gold text color is missing.');
mustInclude(html, '.section--paper .section-label { color: var(--sage-ink); }', 'Paper section labels do not use the darker sage.');
mustInclude(html, 'color: var(--gold-ink);', 'Bronze text color for cream backgrounds is missing.');
mustInclude(html, '.hero-cta-primary {\n    background: var(--gold);\n    color: var(--ink);', 'Hero button text is not ink on gold.');
mustInclude(html, 'scroll-behavior: auto', 'Reduced motion does not turn off smooth scrolling.');
mustInclude(html, 'prefers-reduced-motion: reduce', 'Missing reduced-motion rule.');
mustInclude(html, 'behavior: motionQuery.matches ? \'auto\' : \'smooth\'', 'Scripted scroll does not honor reduced motion.');
mustInclude(html, 'outline: 3px solid var(--focus-ring);', 'Form and control focus ring is missing.');
mustInclude(html, 'box-shadow: 0 0 0 3px var(--focus-contrast);', 'Focus ring has no contrasting second edge.');
mustInclude(html, 'visibility: hidden;', 'Closed photo viewer is not visibility:hidden.');
mustInclude(html, 'id="lightbox"', 'Photo viewer is missing.');
mustInclude(html, 'inert', 'Closed photo viewer is missing inert.');
mustInclude(html, 'class="skip-link" href="#main"', 'Skip link is missing.');
mustInclude(html, '<main id="main"', 'Main landmark is missing.');
mustInclude(html, 'cleared when this page loads', 'Privacy note does not match the on-load clear.');
mustInclude(html, 'localStorage.removeItem', 'Saved guest details are not cleared.');
mustInclude(html, 'min-height: 44px', 'No 44px target sizing remains.');
mustInclude(html, 'width: 44px; height: 44px', 'Menu button is under 44px.');

if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) {
  failures.push('index.html still references a third-party font host.');
}
if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html)) {
  failures.push('index.html still contains a plain-text email address.');
}
if (html.includes('thefrancos2026') || html.includes('gmail.com')) {
  failures.push('The contact address is still spelled out in index.html.');
}
if (/localStorage\.setItem/.test(html)) {
  failures.push('index.html still writes localStorage.');
}
if (/<(input|select|textarea)\b/i.test(html.replace(/<style[\s\S]*?<\/style>/gi, ''))) {
  failures.push('A form control is present after the forms were closed.');
}
if (/role="button"/.test(html)) {
  failures.push('A role=button element is still in the page.');
}
if (/2027-02-01/.test(html)) {
  failures.push('The old February 2027 clear-out date is still in index.html.');
}
if (/style\s*=/.test(html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, ''))) {
  failures.push('index.html still has an inline style attribute.');
}
if (/unsafe-inline/.test(html)) {
  failures.push("index.html CSP still allows 'unsafe-inline'.");
}

function cspHash(source) {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;
}
function inlineBlocks(source, tag) {
  return [...source.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((match) => match[1]);
}
function expectPolicy(file, source, checks) {
  const meta = source.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  if (!meta) {
    failures.push(`${file} is missing a Content-Security-Policy meta tag.`);
    return;
  }
  const policy = meta[1];
  const head = source.slice(0, source.indexOf('</head>'));
  const policyAt = head.indexOf('Content-Security-Policy');
  const styleAt = head.indexOf('<style');
  const scriptAt = head.indexOf('<script');
  if (styleAt !== -1 && policyAt > styleAt) failures.push(`${file} CSP meta is after a style element.`);
  if (scriptAt !== -1 && policyAt > scriptAt) failures.push(`${file} CSP meta is after a script element.`);
  for (const tag of ['style', 'script']) {
    for (const block of inlineBlocks(source, tag)) {
      const token = cspHash(block);
      if (!policy.includes(token)) failures.push(`${file} CSP is missing ${tag} hash ${token}.`);
    }
  }
  for (const piece of checks) {
    if (!policy.includes(piece)) failures.push(`${file} CSP is missing ${piece}.`);
  }
}
expectPolicy('index.html', html, ["default-src 'none'", "font-src 'self'", "img-src 'self' data:", "connect-src 'none'", "form-action 'none'", 'upgrade-insecure-requests']);
const page404 = readFileSync(join(root, '404.html'), 'utf8');
expectPolicy('404.html', page404, ["default-src 'none'", "img-src 'self' data:", "form-action 'none'"]);
if (/unsafe-inline/.test(page404)) failures.push("404.html CSP still allows 'unsafe-inline'.");
for (const redirect of ['rsvp.html', 'registry.html', 'travel.html']) {
  const redirectHtml = readFileSync(join(root, redirect), 'utf8');
  if (/Content-Security-Policy/.test(redirectHtml)) {
    failures.push(`${redirect} has a CSP meta tag; these redirects do not need one.`);
  }
}

const markup = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '');

const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) failures.push(`Duplicate ids: ${[...new Set(dupes)].join(', ')}`);
if (!ids.includes('main')) failures.push('main id is missing from markup.');

const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const stack = [];
const tagRe = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
let tagMatch;
while ((tagMatch = tagRe.exec(markup))) {
  if (tagMatch[0].startsWith('<!--')) continue;
  const name = tagMatch[1].toLowerCase();
  const closing = tagMatch[0].startsWith('</');
  const selfClosing = /\/>\s*$/.test(tagMatch[0]) || voidTags.has(name);
  if (closing) {
    if (stack.at(-1) !== name) {
      failures.push(`HTML tag mismatch: expected </${stack.at(-1) || '?'}> before </${name}>.`);
      break;
    }
    stack.pop();
  } else if (!selfClosing) {
    stack.push(name);
  }
}
if (stack.length) failures.push(`Unclosed HTML tags: ${stack.join(', ')}`);

const controls = [...markup.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)];
for (const control of controls) {
  const attrs = control[2];
  const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
  const labelled = /\baria-label=|\baria-labelledby=/.test(attrs)
    || (id && markup.includes(`for="${id}"`));
  if (!labelled) failures.push(`Unlabelled ${control[1]}${id ? `#${id}` : ''}.`);
}
console.log(`Form controls in index.html: ${controls.length} (each must have a label).`);

const excluded = [...config.matchAll(/^\s*-\s+"?([^"\n]+)"?\s*$/gm)].map((m) => m[1].trim());
const mustExclude = [
  'AGENTS.md',
  'Context-Wedding-Site.md',
  'README.md',
  'wedding_brand_reference_html.html',
  'index-v1-backup.html',
  'index-v2.html',
  'index copy.html',
  'docs',
  'worker',
  'tests',
  'older',
];
for (const item of mustExclude) {
  if (!excluded.includes(item)) failures.push(`_config.yml does not exclude ${item} from the Pages build.`);
}
for (const file of ['index-v1-backup.html', 'index-v2.html', 'index copy.html', 'older/2index.html']) {
  const snapshot = readFileSync(join(root, file), 'utf8');
  if (!snapshot.includes('Retired page')) {
    failures.push(`${file} does not clear saved guest details.`);
  }
  if (!snapshot.includes("k.indexOf('vl_') === 0")) {
    failures.push(`${file} can still write vl_ localStorage keys.`);
  }
}

if (page404.includes('#B8956A')) failures.push('404.html still uses the low-contrast gold link color.');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('OK: landmarks, labels, closed forms, Pages exclude list, and contrast ratios above.');
