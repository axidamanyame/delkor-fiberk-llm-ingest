/**
 * Shared import flow for the ERP.
 *
 * Every import screen used to hand-roll its own `parseCsv()` that split on
 * newlines — which breaks on any quoted field containing a comma — and accepted
 * .csv only. This module is the one importer: pick or paste a file in any format
 * read-table.js understands (CSV, TSV, Excel, JSON, HTML, PDF, Word, PowerPoint,
 * images via OCR), auto-map the columns, see what will land, fix what won't,
 * then commit.
 *
 * Screens supply a spec, not a parser:
 *
 *   renderImporter(app, {
 *     title, subtitle, backHref, keyField,
 *     fields: [{ key, label, required, type, aliases, sample }],
 *     save: async (rows) => ({ ok, n }),
 *   })
 *
 * type: 'text' | 'number' | 'email' | 'phone' | 'date'
 */
import { esc } from './ls-rows.js';
import { tableFromFile, tableFromText, matrixToCsv } from './read-table.js';
import { confirmAction, ackResult } from './confirm-action.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function guessColumn(field, header) {
  const wanted = [field.key, field.label, ...(field.aliases || [])].map(norm);
  let exact = -1, partial = -1;
  header.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    if (exact < 0 && wanted.includes(n)) exact = i;
    if (partial < 0 && wanted.some((w) => w.length > 3 && (n.includes(w) || w.includes(n)))) partial = i;
  });
  return exact >= 0 ? exact : partial;
}

const RX = {
  email: /^[^@\s]+@[^@\s.]+\.[^@\s]+$/,
  phone: /^[+0-9][0-9\s()-]{5,}$/,
  date: /^\d{4}-\d{2}-\d{2}|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/,
};

function checkValue(field, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return field.required ? `${field.label} is required` : '';
  if (field.type === 'number' && !Number.isFinite(Number(v.replace(/[, ]/g, '')))) return `${field.label} must be a number`;
  if (field.type === 'email' && !RX.email.test(v)) return `${field.label} is not an email`;
  if (field.type === 'phone' && !RX.phone.test(v)) return `${field.label} is not a phone number`;
  if (field.type === 'date' && !RX.date.test(v)) return `${field.label} is not a date`;
  return '';
}

function coerce(field, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  if (field.type === 'number') return Number(v.replace(/[, ]/g, ''));
  if (field.type === 'email') return v.toLowerCase();
  return v;
}

/** A desk can pre-fill a field from the URL: import-contacts.html?type=supplier */
function presetFromUrl(spec) {
  const out = {};
  try {
    const q = new URLSearchParams(location.search);
    (spec.fields || []).forEach((f) => {
      const v = q.get(f.key);
      if (v) out[f.key] = v;
    });
  } catch { /* ignore */ }
  return out;
}

export function renderImporter(app, spec) {
  const fields = spec.fields || [];
  const preset = presetFromUrl(spec);
  const state = { table: null, map: {}, busy: false };

  const templateCsv = () => matrixToCsv([
    fields.map((f) => f.label),
    fields.map((f) => f.sample ?? ''),
  ]);

  function build() {
    const mapped = fields.map((f) => ({ field: f, col: state.map[f.key] }));
    const header = state.table?.header || [];
    const rows = state.table?.rows || [];

    const seen = new Set();
    const graded = rows.map((r, i) => {
      const out = {};
      const errors = [];
      mapped.forEach(({ field, col }) => {
        let raw = col == null || col < 0 ? '' : r[col];
        if (!String(raw ?? '').trim() && preset[field.key]) raw = preset[field.key];
        const err = checkValue(field, raw);
        if (err) errors.push(err);
        else out[field.key] = coerce(field, raw);
      });
      if (spec.keyField && out[spec.keyField]) {
        const k = norm(out[spec.keyField]);
        if (seen.has(k)) errors.push(`Duplicate ${spec.keyField} in this file`);
        else seen.add(k);
      }
      return { line: i + 2, row: out, errors };
    }).filter((g) => Object.values(g.row).some((v) => v !== '' && v != null) || g.errors.length);

    return { header, graded, ok: graded.filter((g) => !g.errors.length), bad: graded.filter((g) => g.errors.length) };
  }

  function paint() {
    const { header, ok, bad } = state.table ? build() : { header: [], ok: [], bad: [] };
    const colOpts = (key) => {
      const cur = state.map[key];
      return `<option value="-1">— not imported —</option>` + header.map((h, i) =>
        `<option value="${i}" ${String(cur) === String(i) ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('');
    };

    app.innerHTML = `
      <div class="page">
        <h1>${esc(spec.title)}</h1>
        <p class="sub">${esc(spec.subtitle || '')}</p>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="head"><h2>1 · Choose a file</h2>
          <button type="button" class="ult-btn ult-btn-outline" id="imp-template">Download template</button>
        </div>
        <div class="doc-grid">
          <label class="fld">File
            <input type="file" id="imp-file" accept=".csv,.tsv,.txt,.json,.xls,.xlsx,.xlsm,.ods,.html,.htm,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp" />
          </label>
          <label class="fld">…or paste rows
            <textarea id="imp-paste" rows="3" placeholder="Paste from a spreadsheet, including the header row"></textarea>
          </label>
        </div>
        <p class="ult-muted" id="imp-status" style="margin:10px 0 0">
          ${state.table ? `Read ${state.table.count} row${state.table.count === 1 ? '' : 's'} as ${esc(state.table.format)}.` : 'CSV, TSV, Excel, JSON, HTML, PDF, Word, PowerPoint, or a photo of a printed table.'}
        </p>
      </div>

      ${state.table ? `
      <div class="card" style="margin-bottom:14px">
        <div class="head"><h2>2 · Match the columns</h2></div>
        <p class="ult-muted" style="margin:0 0 10px">Matched by heading where possible. Override anything that landed wrong.</p>
        <div class="doc-grid">
          ${fields.map((f) => `<label class="fld">${esc(f.label)}${f.required ? ' <b style="color:#b91c1c">*</b>' : ''}
            <select data-map="${esc(f.key)}">${colOpts(f.key)}</select>
          </label>`).join('')}
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="head"><h2>3 · Check and import</h2>
          <span class="ult-muted">${ok.length} ready · ${bad.length} to fix</span>
        </div>
        ${bad.length ? `<div class="ult-alert" style="padding:10px 12px;border-radius:8px;border:1px solid;margin-bottom:12px">
          <strong>${bad.length} row${bad.length === 1 ? '' : 's'} will be skipped.</strong>
          <ul style="margin:6px 0 0;padding-left:20px">
            ${bad.slice(0, 6).map((g) => `<li>Line ${g.line}: ${esc(g.errors.join('; '))}</li>`).join('')}
          </ul>
          ${bad.length > 6 ? `<p class="ult-muted" style="margin:6px 0 0">…and ${bad.length - 6} more.</p>` : ''}
        </div>` : ''}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Line</th>${fields.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr></thead>
          <tbody>${ok.slice(0, 10).map((g) => `<tr>
            <td>${g.line}</td>${fields.map((f) => `<td>${esc(g.row[f.key] ?? '')}</td>`).join('')}
          </tr>`).join('') || `<tr><td colspan="${fields.length + 1}" class="ult-muted">Nothing ready to import yet.</td></tr>`}</tbody>
        </table></div>
        ${ok.length > 10 ? `<p class="ult-muted" style="margin:8px 0 0">Showing 10 of ${ok.length}.</p>` : ''}
        <p style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0">
          <button type="button" class="ult-btn ult-btn-primary" id="imp-go" ${ok.length && !state.busy ? '' : 'disabled'}>
            Import ${ok.length} row${ok.length === 1 ? '' : 's'}
          </button>
          ${spec.backHref ? `<a class="ult-btn ult-btn-outline" href="${esc(spec.backHref)}">Cancel</a>` : ''}
        </p>
      </div>` : ''}
    `;

    app.querySelector('#imp-template')?.addEventListener('click', () => {
      const blob = new Blob([templateCsv()], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (spec.templateName || 'import-template') + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    app.querySelector('#imp-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const status = app.querySelector('#imp-status');
      if (status) status.textContent = 'Reading ' + file.name + '…';
      try {
        await accept(await tableFromFile(file, (m) => { if (status) status.textContent = String(m || 'Reading…'); }));
      } catch (err) {
        if (status) status.textContent = err.message || 'Could not read that file.';
      }
    });

    app.querySelector('#imp-paste')?.addEventListener('change', async (e) => {
      const text = e.target.value.trim();
      if (!text) return;
      try { await accept(await tableFromText(text)); } catch { /* ignore */ }
    });

    app.querySelectorAll('[data-map]').forEach((sel) => {
      sel.addEventListener('change', () => {
        state.map[sel.dataset.map] = Number(sel.value);
        paint();
      });
    });

    app.querySelector('#imp-go')?.addEventListener('click', async () => {
      const { ok: ready } = build();
      if (!ready.length) return;
      if (!(await confirmAction(`Import ${ready.length} row${ready.length === 1 ? '' : 's'}?`, spec.title))) return;
      state.busy = true;
      paint();
      try {
        const res = await spec.save(ready.map((g) => g.row));
        ackResult(res?.ok !== false, res?.ok === false
          ? (res.message || 'Import failed.')
          : `Imported ${res?.n ?? ready.length} row${(res?.n ?? ready.length) === 1 ? '' : 's'}.`);
        if (res?.ok !== false && spec.backHref) { location.href = spec.backHref; return; }
      } catch (err) {
        ackResult(false, err.message || 'Import failed.');
      }
      state.busy = false;
      paint();
    });
  }

  async function accept(table) {
    state.table = table;
    state.map = {};
    fields.forEach((f) => {
      const i = guessColumn(f, table.header || []);
      if (i >= 0) state.map[f.key] = i;
    });
    paint();
  }

  paint();
}
