#!/usr/bin/env node
/**
 * Table check — the six operational desks.
 *
 * Products, customers, suppliers, purchases, sales and stock transfers are the
 * tables the business runs on. This checks the things that actually go wrong in
 * them, per table:
 *
 *   COLUMN COUNT   the row template emits a different number of <td> than the
 *                  header has <th> — every cell after the mismatch sits under
 *                  the wrong heading, which is the "shifted one column left"
 *                  symptom
 *   UNCOUNTABLE    the row is built in code, so the cells cannot be counted
 *                  from source. Check that one in the browser:
 *                    const t = document.querySelector('.ult-table');
 *                    [t.tHead.rows[0].cells.length, t.tBodies[0].rows[0].cells.length]
 *   EMPTY COLSPAN  the no-rows message spans the wrong number of columns
 *   NO ACTIONS     no action menu on a record table
 *   NO IMAGE COL   a product table with no image column
 *   NO SCOPE       the list is not filtered by the sidebar company/location
 *   NO EMPTY STATE nothing rendered when the list is empty, so the table just
 *                  looks broken
 *   HARD LIMIT     a .slice() cap with no pager, so rows silently disappear
 *
 * Counting is done on the source template, so a row built by a helper function
 * or a conditional cell can read as a mismatch. Treat hits as "look at this",
 * not "this is broken" — the line number is given so it is quick to check.
 *
 *   node tools/table-check.mjs
 *   node tools/table-check.mjs --page products.html
 *   node tools/table-check.mjs --all        # every page, not just the six
 *
 * On Windows/PowerShell: node tools\table-check.mjs
 * Needs Node 18.17+.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'public';
const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;
const all = args.includes('--all');

/* The operational core. Order matters: it is the order they get used in a day. */
const CORE = [
  'products.html', 'customers.html', 'suppliers.html',
  'purchases.html', 'sales-orders.html', 'stock-transfers.html',
  'stock.html', 'stock-adjustments.html',
];

/* Catalogue-style tables, where a thumbnail helps identify the row. Transfers
   and adjustments are movement logs — a photo on each line would be noise, so
   they are deliberately excluded. */
const PRODUCT_TABLE = /^(products|product-catalog|stock|opening-stock|print-labels|update-price)\.html$/i;

const countTags = (s, tag) => (s.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;

/** Rough but useful: the first thead block and the first tbody row template. */
function tableShapes(src) {
  const out = [];
  const headRx = /<thead>([\s\S]*?)<\/thead>/gi;
  let m;
  while ((m = headRx.exec(src)) !== null) {
    const head = m[1];
    const ths = countTags(head, 'th');
    /* the row template that follows this head */
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 4000);
    const rowMatch = after.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i);
    const tds = rowMatch ? countTags(rowMatch[1], 'td') : null;
    const colspan = after.match(/colspan="?(\d+)"?/i);
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      ths,
      tds,
      colspan: colspan ? Number(colspan[1]) : null,
      headText: head.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90),
    });
  }
  return out;
}

const files = (await readdir(ROOT, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.html'))
  .filter((f) => (only ? f === only : (all || CORE.includes(f))));

/* keep the core order when not scanning everything */
if (!all && !only) files.sort((a, b) => CORE.indexOf(a) - CORE.indexOf(b));

const rows = [];

for (const rel of files) {
  const src = await readFile(join(ROOT, rel), 'utf8');
  const findings = [];

  for (const t of tableShapes(src)) {
    if (t.tds === 0 || t.tds === null) {
      /* The row is built by a helper or assembled in pieces, so the cells are
         not countable from source. Saying "0 cells" implied a broken table. */
      findings.push(['UNCOUNTABLE', t.line, `${t.ths} headings; row built in code, count it in the browser`]);
    } else if (t.ths && t.tds !== t.ths) {
      findings.push(['COLUMN COUNT', t.line, `${t.ths} headings, ${t.tds} cells — ${t.headText}`]);
    }
    if (t.colspan !== null && t.ths && t.colspan !== t.ths) {
      findings.push(['EMPTY COLSPAN', t.line, `spans ${t.colspan}, table has ${t.ths}`]);
    }
  }

  const hasTable = /<table|ult-table/.test(src);
  if (hasTable) {
    /* Three ways a desk renders actions, all legitimate: the shared actMenu(),
       the standard set, or a hand-rolled <details class="act"> disclosure.
       Only checking for actMenu reported sales-orders as having none. */
    const hasActions = /actMenu\(|standardActions\(|data-act=|details class="act"|<summary>\s*Actions/i.test(src)
      || /<th[^>]*>\s*Action/i.test(src);
    if (!hasActions) findings.push(['NO ACTIONS', 0, 'no action menu on a record table']);
    /* An existing thumbnail column counts however it is built — products.html
       renders <img class="thumb"> under a "Product image" heading, which the
       first version of this check did not recognise. */
    const hasImageCol = /addProductImageColumn|productPhoto\(|class="thumb"|<th[^>]*>\s*(product\s+)?image/i.test(src);
    if (PRODUCT_TABLE.test(rel) && !hasImageCol) {
      findings.push(['NO IMAGE COL', 0, 'catalogue table with no thumbnail column']);
    }
    if (!/filterBySidebar|applyDataScope|getActiveLocation|subsidiary_code/.test(src)) {
      findings.push(['NO SCOPE', 0, 'list is not filtered by the sidebar company/location']);
    }
    if (!/emptyRow\(|tableStateHtml\(|No .* found|colspan/i.test(src)) {
      findings.push(['NO EMPTY STATE', 0, 'nothing shown when the list is empty']);
    }
    const cap = src.match(/\.slice\(\s*0\s*,\s*(\d{2,})\s*\)/);
    if (cap && !/pager|tableBar\(|page\s*\+\+|data-page/.test(src)) {
      findings.push(['HARD LIMIT', src.slice(0, cap.index).split('\n').length, `capped at ${cap[1]} rows with no pager`]);
    }
  }

  rows.push({ page: rel, findings, hasTable });
}

const withFindings = rows.filter((r) => r.findings.length);

if (only) {
  rows.forEach((r) => {
    console.log(r.page + (r.hasTable ? '' : '  (no table found)'));
    if (!r.findings.length) console.log('  nothing flagged.');
    r.findings.forEach(([k, l, d]) => console.log(`  ${k.padEnd(15)}${l ? 'line ' + l : '       '}  ${d}`));
  });
} else {
  const total = withFindings.reduce((n, r) => n + r.findings.length, 0);
  console.log(`${total} finding(s) across ${withFindings.length} of ${rows.length} table(s)\n`);
  rows.forEach((r) => {
    if (!r.findings.length) { console.log(`  ok    ${r.page}`); return; }
    console.log(`\n${r.page}`);
    r.findings.forEach(([k, l, d]) => console.log(`  ${k.padEnd(15)}${l ? 'line ' + String(l).padEnd(6) : '            '}${d}`));
  });
  console.log('\nDetail:  node tools/table-check.mjs --page <file>');
  console.log('Every page:  node tools/table-check.mjs --all');
}
