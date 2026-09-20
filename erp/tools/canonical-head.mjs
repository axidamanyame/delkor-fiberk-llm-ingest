#!/usr/bin/env node
/**
 * Delkor-Fiberk ERP — head canonicaliser  (audit finding 08)
 *
 * The shell repairs meta[name=viewport] at runtime, so pages that ship
 * without it lay out at desktop width for the first paint and then snap.
 * This writes the one canonical tag into every page head instead, and
 * normalises the three spellings currently in circulation.
 *
 *   node tools/canonical-head.mjs --dry     # report only, writes nothing
 *   node tools/canonical-head.mjs           # apply
 *
 * On Windows/PowerShell: node tools\canonical-head.mjs --dry
 *
 * Run it from the repo root. Idempotent — safe to run twice. Needs Node 18.17+
 * for readdir({ recursive: true }); check with node --version.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'public';
const DRY = process.argv.includes('--dry');

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />';
const ICONS = [
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<link rel="shortcut icon" href="/favicon.ico" />',
  '<link rel="apple-touch-icon" href="/__grok/icon-180.png" />',
];

const files = (await readdir(DIR, { recursive: true })).filter((f) => f.endsWith('.html'));
let changed = 0;
const noHead = [];
const inlineWhites = [];

for (const rel of files) {
  const path = join(DIR, rel);
  const src = await readFile(path, 'utf8');
  let out = src;

  // one canonical viewport tag
  const existing = out.match(/<meta\s+name=["']viewport["'][^>]*>/i);
  if (existing) {
    if (existing[0] !== VIEWPORT) out = out.replace(existing[0], VIEWPORT);
  } else if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  ${VIEWPORT}`);
  } else {
    noHead.push(rel);
  }

  // favicons, so the shell no longer has to inject them
  for (const link of ICONS) {
    const rel2 = link.match(/rel="([^"]+)"/)[1];
    if (!new RegExp(`rel=["']${rel2}["']`, 'i').test(out) && /<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `  ${link}\n</head>`);
    }
  }

  // module cache-busters fork the module graph (finding 01)
  out = out.replace(/(\.js)\?v=[0-9a-z.-]+/gi, '$1');

  // report, don't rewrite: inline white surfaces still relying on the dark shim
  const whites = (out.match(/style="[^"]*background(?:-color)?:\s*(?:#fff|#ffffff|white)/gi) || []).length;
  if (whites) inlineWhites.push(`${rel} (${whites})`);

  if (out !== src) {
    changed++;
    if (!DRY) await writeFile(path, out, 'utf8');
    console.log(`${DRY ? 'would fix' : 'fixed'}  ${rel}`);
  }
}

console.log(`\n${changed} of ${files.length} pages ${DRY ? 'need changes' : 'updated'}.`);
if (noHead.length) console.log(`no <head> found in: ${noHead.join(', ')}`);
if (inlineWhites.length) {
  console.log(`\nStill writing literal white surfaces inline — these keep the`);
  console.log(`dark-mode shim alive, clean them when you next touch the page:`);
  console.log(inlineWhites.join('\n'));
}
