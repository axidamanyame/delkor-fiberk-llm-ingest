#!/usr/bin/env node
/**
 * Dead controls — which buttons and screens do nothing?
 *
 * "A lot of functions don't call anything" is the right diagnosis and the
 * wrong unit of work. This turns it into a list you can rank.
 *
 * It reports four things per page:
 *
 *   DEAD ID      an element with an id that no script in the page (or any
 *                module it imports) ever mentions — a control with no wiring
 *   DEAD ACT     a data-act value no script references
 *   HASH LINK    <a href="#"> with no data-act, no class, no handler hook
 *   PLACEHOLDER  literal "coming soon" / "not implemented" / TODO
 *   BLOCKING     a browser alert() — works, but blocks and cannot be styled
 *   EMPTY PAGE   a module script that renders nothing into #app
 *
 * Heuristics, not proof: a control wired by a shared module through a generic
 * selector will show as a false positive. Sort by count, start at the top, and
 * check a few by hand before concluding.
 *
 *   node tools/dead-controls.mjs                 # summary, worst pages first
 *   node tools/dead-controls.mjs --page pos.html # detail for one page
 *   node tools/dead-controls.mjs --csv > dead.csv
 *
 * On Windows/PowerShell: node tools\dead-controls.mjs
 * Needs Node 18.17+.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

const ROOT = 'public';
const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;
const asCsv = args.includes('--csv');

const PLACEHOLDER = /coming soon|not implemented|under construction|todo:|fixme/i;

const modCache = new Map();
async function moduleText(path) {
  if (modCache.has(path)) return modCache.get(path);
  let src = '';
  try { src = await readFile(path, 'utf8'); } catch { /* ignore */ }
  modCache.set(path, src);
  return src;
}

/** Page script plus the text of every module it imports, one level deep, then
    those modules' imports — two levels is enough to catch shared handlers. */
async function scriptUniverse(pagePath, bodies) {
  let text = bodies.join('\n');
  const seen = new Set();
  const queue = [];
  const collect = (src, base) => {
    for (const m of src.matchAll(/from\s*['"](\.\.?\/[^'"]+|\/[^'"]+)['"]/g)) {
      const spec = m[1].split('?')[0];
      const abs = spec.startsWith('/') ? join(ROOT, spec.replace(/^\//, '')) : resolve(base, spec);
      if (!seen.has(abs)) { seen.add(abs); queue.push(abs); }
    }
  };
  collect(text, dirname(pagePath));
  let depth = 0;
  while (queue.length && depth < 2) {
    const batch = queue.splice(0, queue.length);
    for (const p of batch) {
      const src = await moduleText(p);
      text += '\n' + src;
      collect(src, dirname(p));
    }
    depth += 1;
  }
  return text;
}

const files = (await readdir(ROOT, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.html'))
  .filter((f) => !only || f === only);

const rows = [];

for (const rel of files) {
  const path = join(ROOT, rel);
  const html = await readFile(path, 'utf8');
  const bodies = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const universe = await scriptUniverse(path, bodies);
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, '');

  const findings = [];

  /* ids in markup that nothing references */
  for (const m of markup.matchAll(/\bid="([\w-]+)"/g)) {
    const id = m[1];
    if (/^(app|root|main)$/.test(id)) continue;
    const used = new RegExp(`['"\`#]${id}\\b`).test(universe);
    if (!used) findings.push(['DEAD ID', id]);
  }

  /* data-act values nothing references */
  for (const m of markup.matchAll(/data-act="([\w-]+)"/g)) {
    if (!new RegExp(`['"\`]${m[1]}['"\`]`).test(universe)) findings.push(['DEAD ACT', m[1]]);
  }

  /* anchors that go nowhere and carry no hook */
  for (const m of markup.matchAll(/<a\b([^>]*href="#"[^>]*)>/g)) {
    const attrs = m[1];
    if (/data-|class="[^"]*\b(act|tab|pill|btn)/.test(attrs)) continue;
    findings.push(['HASH LINK', attrs.replace(/\s+/g, ' ').trim().slice(0, 60)]);
  }

  /* explicit placeholders */
  for (const body of bodies.concat(markup)) {
    for (const m of body.matchAll(new RegExp(PLACEHOLDER.source, 'gi'))) {
      findings.push(['PLACEHOLDER', m[0]]);
    }
    /* A bare alert() is usually a working validation guard, not a stub. It is
       still worth reporting — a browser alert blocks the thread and cannot be
       styled, which is wrong at a till — but as its own category, not as
       "unimplemented". Calling these placeholders made pos.html and snnit.html
       look broken when every one of them works. */
    for (const m of body.matchAll(/alert\(\s*['"`]([^'"`]{0,50})/g)) {
      findings.push(['BLOCKING ALERT', m[1]]);
    }
  }

  /* a page that never writes to #app */
  if (bodies.length && /id="app"/.test(html) && !/\bapp\.innerHTML|appendChild|insertAdjacentHTML|render\(/.test(universe)) {
    findings.push(['EMPTY PAGE', 'nothing renders into #app']);
  }

  if (findings.length) rows.push({ page: rel, findings });
}

if (asCsv) {
  console.log('page,kind,detail');
  rows.forEach((r) => r.findings.forEach(([k, d]) => console.log(`"${r.page}","${k}","${String(d).replace(/"/g, "'")}"`)));
} else if (only) {
  rows.forEach((r) => {
    console.log(r.page);
    r.findings.forEach(([k, d]) => console.log(`  ${k.padEnd(12)} ${d}`));
  });
  if (!rows.length) console.log(`${only}: nothing flagged.`);
} else {
  rows.sort((a, b) => b.findings.length - a.findings.length);
  console.log(`pages with findings: ${rows.length} of ${files.length}\n`);
  rows.slice(0, 40).forEach((r) => {
    const counts = r.findings.reduce((acc, [k]) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});
    const summary = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`${String(r.findings.length).padStart(3)}  ${r.page.padEnd(34)} ${summary}`);
  });
  if (rows.length > 40) console.log(`\n…and ${rows.length - 40} more. Use --csv for the full list.`);
  console.log('\nDetail for one page:  node tools/dead-controls.mjs --page <file>');
}
