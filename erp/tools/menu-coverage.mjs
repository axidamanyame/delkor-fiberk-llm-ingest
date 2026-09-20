#!/usr/bin/env node
/**
 * Menu coverage — is every page reachable, and does every menu item exist?
 *
 * The class of bug this exists to prevent: Import Contacts, Import Products,
 * Import Opening Stock, Import Expenses and Opening Stock were all real,
 * working pages that no menu item pointed at. A reference scan cannot catch
 * that — a missing menu entry is an absence, not a broken link. This makes the
 * absence visible.
 *
 * It reads the MENU array in public/js/ultimate-shell.js (the live sidebar,
 * the only authoritative one) and compares it against the pages on disk.
 *
 *   node tools/menu-coverage.mjs
 *   node tools/menu-coverage.mjs --ignore-file tools/menu-coverage.ignore
 *
 * On Windows/PowerShell: node tools\menu-coverage.mjs
 *
 * Exit code 1 if anything is unreachable or points nowhere, so it can gate a
 * deploy later if you want. Needs Node 18.17+.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SHELL = 'public/js/ultimate-shell.js';
const PAGES = 'public';

/* Pages that are legitimately not in the sidebar: entry points, print views,
   things opened from inside another screen, role landing pages. Extend the
   ignore file rather than this list. */
const DEFAULT_ALLOW = [
  'index.html', 'login.html', 'go-home.html', 'stub.html', 'resume.html',
  'receipt.html', 'customer-display.html', 'till-login.html', 'pos-open.html',
  'crm-contact-login.html', 'onboard-run.html', 'orientation.html',
  'agent-home.html', 'cashier-home.html', 'customer-home.html', 'supplier-home.html',
  // forms and detail views are reached from their list page, not the menu
  /-form\.html$/, /-edit\.html$/, /-view\.html$/,
];

const args = process.argv.slice(2);
const ignoreArg = args.indexOf('--ignore-file');
const ignorePath = ignoreArg >= 0 ? args[ignoreArg + 1] : 'tools/menu-coverage.ignore';

let extraAllow = [];
if (existsSync(ignorePath)) {
  extraAllow = (await readFile(ignorePath, 'utf8'))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const allowed = (name) =>
  DEFAULT_ALLOW.some((p) => (p instanceof RegExp ? p.test(name) : p === name))
  || extraAllow.includes(name);

/* --- what the menu points at --- */
const shell = await readFile(SHELL, 'utf8');
const menuStart = shell.search(/\bconst MENU\s*=|\bexport const MENU\s*=/);
if (menuStart < 0) {
  console.error(`Could not find the MENU array in ${SHELL}.`);
  process.exit(2);
}
/* Take hrefs from the MENU declaration onward. Entries are plain object
   literals — { href: '/x.html', label: 'X' } — so a regex is enough and avoids
   evaluating the module. */
const menuText = shell.slice(menuStart);
const menuHrefs = new Set();
for (const m of menuText.matchAll(/href:\s*['"`]([^'"`]+)['"`]/g)) {
  const path = m[1].split('#')[0].split('?')[0];
  if (path.endsWith('.html')) menuHrefs.add(path.replace(/^\//, ''));
}

/* --- what exists --- */
const files = (await readdir(PAGES, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.html'));
const onDisk = new Set(files);

/* --- compare --- */
const unreachable = [...onDisk].filter((f) => !menuHrefs.has(f) && !allowed(f)).sort();
const dangling = [...menuHrefs].filter((h) => !onDisk.has(h)).sort();

console.log(`menu items pointing at a page: ${menuHrefs.size}`);
console.log(`pages on disk:                 ${onDisk.size}`);
console.log('');

if (dangling.length) {
  console.log(`MENU POINTS AT ${dangling.length} PAGE(S) THAT DO NOT EXIST — these 404 from the sidebar:`);
  dangling.forEach((d) => console.log('  ' + d));
  console.log('');
}

if (unreachable.length) {
  console.log(`${unreachable.length} PAGE(S) NOT REACHABLE FROM THE MENU:`);
  unreachable.forEach((u) => console.log('  ' + u));
  console.log('');
  console.log('Each is either something to add to MENU in ultimate-shell.js, or');
  console.log(`something legitimately reached another way — add those to ${ignorePath}.`);
  console.log('');
}

if (!dangling.length && !unreachable.length) {
  console.log('Every page is reachable and every menu item resolves.');
}

process.exit(dangling.length || unreachable.length ? 1 : 0);
