#!/usr/bin/env node
/**
 * Import check — does every named import actually exist?
 *
 * This is the bug class that broke Field Ops: field-ops-hydrate.js imported
 * { hydrateFloor, customersFromOrders, agentsFromOrders } from
 * bnpl-field-orders.js, which exports loadOrders, uniqueCustomers and
 * uniqueAgents. Two names had been renamed and one never existed. A failed
 * static import aborts the whole module graph, so the page dies with
 *
 *   SyntaxError: The requested module './bnpl-field-orders.js' does not
 *   provide an export named 'agentsFromOrders'
 *
 * The reference scan could not catch it — the file existed, the path resolved.
 * Only the export names were wrong.
 *
 *   node tools/import-check.mjs
 *
 * On Windows/PowerShell: node tools\import-check.mjs
 *
 * Exit code 1 if any named import is missing. Needs Node 18.17+.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = 'public';

function exportedNames(src) {
  const out = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s*\*?\s*(\w+)/gm)) out.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:const|let|var|class)\s+(\w+)/gm)) out.add(m[1]);
  /* export { a, b as c } — with or without a from-clause */
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    m[1].split(',').forEach((part) => {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    });
  }
  if (/^export\s+default/m.test(src)) out.add('default');
  /* export * from './x.js' — cannot resolve statically without following it,
     so record it and treat the module as open rather than report false hits. */
  const star = /^export\s*\*\s*from/m.test(src);
  return { out, star };
}

function namedImports(src) {
  const found = [];
  for (const m of src.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2];
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue; /* skip CDN */
    const names = m[1]
      .split(',')
      .map((s) => s.split(/\s+as\s+/)[0].trim())
      .filter((s) => s && s !== 'type');
    found.push({ spec, names, line: src.slice(0, m.index).split('\n').length });
  }
  return found;
}

const files = (await readdir(ROOT, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.html'));

const cache = new Map();
async function exportsFor(path) {
  if (cache.has(path)) return cache.get(path);
  let res = null;
  try { res = exportedNames(await readFile(path, 'utf8')); } catch { res = null; }
  cache.set(path, res);
  return res;
}

const problems = [];
let checked = 0;

for (const rel of files) {
  const path = join(ROOT, rel);
  let src;
  try { src = await readFile(path, 'utf8'); } catch { continue; }
  /* For a page, only look inside its module scripts. */
  const bodies = rel.endsWith('.html')
    ? [...src.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    : [src];

  for (const body of bodies) {
    for (const { spec, names, line } of namedImports(body)) {
      const target = spec.split('?')[0];
      const abs = target.startsWith('/')
        ? join(ROOT, target.replace(/^\//, ''))
        : resolve(dirname(path), target);
      const info = await exportsFor(abs);
      checked += names.length;
      if (!info) {
        problems.push(`${rel}:${line}  ->  ${spec}  (module not found)`);
        continue;
      }
      if (info.star) continue;
      const missing = names.filter((n) => !info.out.has(n));
      if (missing.length) {
        problems.push(`${rel}:${line}  ->  ${spec}  does not export: ${missing.join(', ')}`);
      }
    }
  }
}

console.log(`named imports checked: ${checked}`);
console.log('');
if (problems.length) {
  console.log(`${problems.length} BROKEN IMPORT(S) — each one takes its whole page down:`);
  problems.forEach((p) => console.log('  ' + p));
} else {
  console.log('Every named import resolves to a real export.');
}
process.exit(problems.length ? 1 : 0);
