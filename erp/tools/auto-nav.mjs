#!/usr/bin/env node
/**
 * Unrequested navigation and state changes.
 *
 * The complaint that matters: "windows opening by themselves". An ERP should
 * move you only when you ask it to. This finds every place the code navigates,
 * reloads, opens a window or rewrites history without a click behind it.
 *
 * It flags, with file and line:
 *
 *   ON LOAD       location.replace/assign/href assignment at module top level
 *                 (not inside a function) — fires the moment the page loads
 *   TIMER NAV     navigation inside setTimeout/setInterval
 *   META REFRESH  <meta http-equiv="refresh">
 *   AUTO RELOAD   location.reload() not inside an obvious handler
 *   POPUP         window.open(
 *   HISTORY       history.pushState/replaceState outside a handler
 *   AUTO SUBMIT   form.submit() or .click() called from script
 *   FOCUS STEAL   .focus() at top level
 *
 * Each hit needs judgement: a login redirect on an unauthenticated page is
 * correct; replacing the dashboard because a dropdown changed is not.
 *
 *   node tools/auto-nav.mjs
 *   node tools/auto-nav.mjs --page dashboard.html
 *
 * On Windows/PowerShell: node tools\auto-nav.mjs
 * Needs Node 18.17+.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'public';
const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;

/** Rough nesting depth: 0 means module top level, i.e. runs on load. */
function depthAt(src, index) {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth;
}

const RULES = [
  { kind: 'ON LOAD', rx: /location\s*\.\s*(?:replace|assign)\s*\(|location\s*\.\s*href\s*=/g, topOnly: true },
  { kind: 'TIMER NAV', rx: /set(?:Timeout|Interval)\s*\([^)]{0,200}?location\s*\./gs },
  { kind: 'AUTO RELOAD', rx: /location\s*\.\s*reload\s*\(/g },
  { kind: 'POPUP', rx: /window\s*\.\s*open\s*\(/g },
  { kind: 'HISTORY', rx: /history\s*\.\s*(?:pushState|replaceState)\s*\(/g, topOnly: true },
  { kind: 'AUTO SUBMIT', rx: /\.\s*(?:submit|click)\s*\(\s*\)/g },
  { kind: 'FOCUS STEAL', rx: /\.\s*focus\s*\(\s*\)/g, topOnly: true },
];

const files = (await readdir(ROOT, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.html'))
  .filter((f) => !only || f === only);

const rows = [];

for (const rel of files) {
  const src = await readFile(join(ROOT, rel), 'utf8');
  const findings = [];

  if (/<meta[^>]+http-equiv=["']refresh/i.test(src)) {
    const line = src.slice(0, src.search(/<meta[^>]+http-equiv=["']refresh/i)).split('\n').length;
    findings.push(['META REFRESH', line, 'page redirects itself']);
  }

  /* Only look inside scripts for a page; the whole file for a module. */
  const blocks = rel.endsWith('.html')
    ? [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => ({ text: m[1], offset: m.index }))
    : [{ text: src, offset: 0 }];

  for (const { text, offset } of blocks) {
    for (const { kind, rx, topOnly } of RULES) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(text)) !== null) {
        if (topOnly && depthAt(text, m.index) > 0) continue;
        const line = src.slice(0, offset + m.index).split('\n').length;
        findings.push([kind, line, m[0].replace(/\s+/g, ' ').slice(0, 48)]);
      }
    }
  }

  if (findings.length) rows.push({ page: rel, findings });
}

if (only) {
  rows.forEach((r) => {
    console.log(r.page);
    r.findings.sort((a, b) => a[1] - b[1]).forEach(([k, l, d]) => console.log(`  ${String(l).padStart(5)}  ${k.padEnd(13)} ${d}`));
  });
  if (!rows.length) console.log(`${only}: nothing flagged.`);
} else {
  rows.sort((a, b) => b.findings.length - a.findings.length);
  const total = rows.reduce((n, r) => n + r.findings.length, 0);
  console.log(`${total} unrequested-action site(s) across ${rows.length} file(s)\n`);
  rows.slice(0, 30).forEach((r) => {
    const counts = r.findings.reduce((a, [k]) => ({ ...a, [k]: (a[k] || 0) + 1 }), {});
    console.log(`${String(r.findings.length).padStart(3)}  ${r.page.padEnd(32)} ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  });
  if (rows.length > 30) console.log(`\n…and ${rows.length - 30} more files.`);
  console.log('\nDetail:  node tools/auto-nav.mjs --page <file>');
  console.log('Judge each one: a login redirect is correct, a dropdown that');
  console.log('replaces the page you are on is not.');
}
