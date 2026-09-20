#!/usr/bin/env node
/**
 * Action audit — does each action item go where its label says?
 *
 * Row action menus are built by actMenu(id, [ … ]) in ls-rows.js, where each
 * item is either { href, label } (a link) or { act, label } (a handler). This
 * reads every one of those call sites and reports, per menu:
 *
 *   DEFAULTS TO EDIT   the item's target is the same as another item in the
 *                      same menu — the usual case being View, Duplicate,
 *                      Print and friends all pointing at the edit form
 *   LABEL MISMATCH     a View item whose href has no view=1 and is not a
 *                      -view page, a Print item that goes to a form, etc.
 *   MISSING PAGE       the target page does not exist — the function has not
 *                      been built yet
 *   NO HANDLER         an { act } item whose value appears nowhere else, so
 *                      clicking it does nothing
 *
 * The point is to tell you which actions exist, which collide, and which are
 * simply not built, so you can decide rather than discover it by clicking.
 *
 *   node tools/action-audit.mjs              # everything, grouped by file
 *   node tools/action-audit.mjs --labels     # summary per label across the app
 *   node tools/action-audit.mjs --csv > actions.csv
 *
 * On Windows/PowerShell: node tools\action-audit.mjs
 * Needs Node 18.17+.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'public';
const args = process.argv.slice(2);
const mode = args.includes('--labels') ? 'labels' : args.includes('--csv') ? 'csv' : 'full';

/* pages that exist, so we can spot actions pointing nowhere */
const pages = new Set(
  (await readdir(ROOT, { recursive: true }))
    .map((f) => String(f).split('\\').join('/'))
    .filter((f) => f.endsWith('.html')),
);

/** Expectations for common labels: what the target should look like. */
const LABEL_RULES = [
  /* Only a bare "View" is a read-only record view. "View Payments" and
     "View ledger" are different jobs, not modes — same rule the click router
     uses. */
  { label: /^view( details| record)?$/i, want: /[?&]view=1|-view\.html/, describe: 'read-only view (view=1 or a -view page)' },
  { label: /^(print|receipt)/i, want: /print|receipt|\.pdf/, describe: 'a print view or print=1 mode' },
  { label: /^ledger/i, want: /ledger|cash-flow|transactions|statement/, describe: 'a ledger, statement or cash-flow view' },
  { label: /^(map accounts|map)/i, want: /accounting-map-form|map-transactions/, describe: 'the accounting map form' },
  { label: /^(history|trail|audit)/i, want: /history|trail|audit/, describe: 'a history or audit view' },
];

/** Find the matching close paren for the bracket opened at `from`. */
function balanced(src, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) return i; }
  }
  return -1;
}

/** Comments are not menu items. A note like "was { act: 'view' } …" beside a
    call site was being parsed as a real entry. Block comments go, and line
    comments only when they start a line, so an https:// inside an href survives. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*/gm, '');
}

/** Pull { … } object literals out of an items array. */
function itemsIn(raw) {
  const text = stripComments(raw);
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = balanced(text, i, '{', '}');
    if (end < 0) break;
    const body = text.slice(i + 1, end);
    const href = body.match(/href\s*:\s*[`'"]([^`'"]*)[`'"]/);
    const act = body.match(/act\s*:\s*[`'"]([^`'"]*)[`'"]/);
    const label = body.match(/label\s*:\s*[`'"]([^`'"]*)[`'"]/);
    if (href || act) out.push({ href: href?.[1] || '', act: act?.[1] || '', label: (label?.[1] || '').trim() });
    i = end;
  }
  return out;
}

/** /customer-form.html?id=${c.id} → path + normalised query */
function targetOf(href) {
  const clean = String(href).replace(/\$\{[^}]*\}/g, '*');
  const [path, query = ''] = clean.split('?');
  /* Mask only identifiers. Masking every value made ?tab=orders and
     ?tab=payments look identical, so two different destinations were reported
     as a collision. */
  const masked = query.replace(/\b(id|account|from|to)=[^&]*/g, '$1=*');
  return { path: path.replace(/^\//, ''), query, key: path.replace(/^\//, '') + (masked ? '?' + masked : '') };
}

const files = (await readdir(ROOT, { recursive: true }))
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.html'));

const report = [];
const byLabel = new Map();

for (const rel of files) {
  const src = await readFile(join(ROOT, rel), 'utf8');
  let idx = src.indexOf('actMenu(');
  while (idx > -1) {
    const close = balanced(src, src.indexOf('(', idx));
    if (close < 0) break;
    const items = itemsIn(src.slice(idx, close));
    if (items.length) {
      const line = src.slice(0, idx).split('\n').length;
      const seen = new Map();
      const problems = [];

      for (const it of items) {
        const label = it.label || '(no label)';
        if (!byLabel.has(label)) byLabel.set(label, new Map());

        if (it.act) {
          /* a handler item: does the value appear anywhere else? */
          const uses = (src.match(new RegExp(`['"\`]${it.act.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g')) || []).length;
          byLabel.get(label).set('act:' + it.act, (byLabel.get(label).get('act:' + it.act) || 0) + 1);
          if (uses <= 1) problems.push(`NO HANDLER     ${label} → act "${it.act}" is referenced nowhere else`);
          continue;
        }

        const t = targetOf(it.href);
        byLabel.get(label).set(t.key, (byLabel.get(label).get(t.key) || 0) + 1);

        if (seen.has(t.key)) {
          problems.push(`DEFAULTS TO    ${label} → same target as "${seen.get(t.key)}"  (${t.key})`);
        } else {
          seen.set(t.key, label);
        }

        const scheme = /^(tel|mailto|sms|http|https):/.test(it.href);
        if (t.path === '*' || !t.path) {
          /* href built at runtime — e.g. `${row.form}?id=${id}`. Cannot be
             checked from source; reported so it can be eyeballed, not as a
             fault. */
          problems.push(`DYNAMIC        ${label} → built at runtime (${it.href.slice(0, 90)})`);
        } else if (!scheme && !pages.has(t.path)) {
          problems.push(`MISSING PAGE   ${label} → ${t.path} does not exist`);
        }

        for (const rule of LABEL_RULES) {
          if (rule.label.test(label) && !rule.want.test(it.href)) {
            problems.push(`LABEL MISMATCH ${label} → ${t.key}  (expected ${rule.describe})`);
          }
        }
      }

      if (problems.length) report.push({ file: rel, line, items: items.length, problems });
    }
    idx = src.indexOf('actMenu(', close);
  }
}

if (mode === 'labels') {
  console.log('Where each action label actually points, across the whole app\n');
  [...byLabel.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([label, targets]) => {
      console.log(`${label}`);
      [...targets.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`    ${String(n).padStart(3)} ×  ${t}`));
    });
} else if (mode === 'csv') {
  console.log('file,line,problem');
  report.forEach((r) => r.problems.forEach((p) => console.log(`"${r.file}",${r.line},"${p.replace(/"/g, "'")}"`)));
} else {
  const total = report.reduce((n, r) => n + r.problems.length, 0);
  console.log(`${total} problem(s) in ${report.length} action menu(s)\n`);
  report.forEach((r) => {
    console.log(`${r.file}:${r.line}  (${r.items} items)`);
    r.problems.forEach((p) => console.log('  ' + p));
    console.log('');
  });
  console.log('Summary per label:  node tools/action-audit.mjs --labels');
}
