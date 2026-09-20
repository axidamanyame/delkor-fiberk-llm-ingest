/**
 * Thin CRUD host used by catalog submenus (brands, units, warranties, …).
 * Looks like the rest of the ERP (pageChrome + ult-table). Does not restyle the shell.
 */
import { supabase } from './supabaseClient.js';
import { mountUltimateShell, pageChrome } from './ultimate-shell.js';
import { confirmAction, ackResult } from './confirm-action.js';

export async function runCrud({
  title, blurb, table, fields, order = 'name',
  seed = null, extraActions = '',
}) {
  await mountUltimateShell();
  const app = document.getElementById('app');
  let rows = [];
  let err = null;
  let modal = null;

  async function load() {
    const q = await supabase.from(table).select('*').order(order).limit(400);
    err = q.error?.message || null;
    rows = q.data || [];
    if ((!rows.length || err) && typeof seed === 'function') {
      try {
        const extra = await seed(supabase);
        if (extra?.length && !rows.length) rows = extra;
      } catch (e) { console.warn(e); }
    }
    render();
  }

  function val(r, k) {
    const v = r[k];
    if (v == null || v === '') return '—';
    return String(v);
  }

  function render() {
    app.innerHTML = pageChrome(title, blurb) + `
      <div class="ult-card">
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
          ${extraActions}
          <button type="button" class="ult-btn ult-btn-primary" id="c-add">+ Add</button>
        </div>
        ${err ? `<div class="ult-alert">${err} — run sql/83_integrate.sql if this table is missing.</div>` : ''}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr>${fields.map((f) => `<th>${f.l}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>
              ${fields.map((f) => `<td>${val(r, f.k)}</td>`).join('')}
              <td>
                <button type="button" class="ult-btn ult-btn-outline ult-btn-sm c-ed" data-id="${r.id}">Edit</button>
                <button type="button" class="ult-btn ult-btn-danger ult-btn-sm c-del" data-id="${r.id}">Delete</button>
              </td>
            </tr>`).join('') || `<tr><td colspan="${fields.length + 1}" class="ult-muted">None yet — click Add.</td></tr>`}
          </tbody>
        </table></div>
      </div>
      ${modal ? formHtml() : ''}`;

    document.getElementById('c-add').onclick = () => { modal = {}; render(); };
    app.querySelectorAll('.c-ed').forEach((b) => {
      b.onclick = () => { modal = rows.find((r) => String(r.id) === b.dataset.id) || {}; render(); };
    });
    app.querySelectorAll('.c-del').forEach((b) => {
      b.onclick = async () => {
        if (!(await confirmAction('Delete this row?', 'This cannot be undone.'))) return;
        const { error } = await supabase.from(table).delete().eq('id', b.dataset.id);
        if (error) { ackResult(false, error.message); return; }
        ackResult(true, 'Row deleted.');
        load();
      };
    });
    bindForm();
  }

  function formHtml() {
    const r = modal || {};
    return `<div class="overlay" id="c-ov" style="position:fixed;inset:0;background:#0006;z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:24px">
      <div class="sheet" style="background:#fff;border-radius:10px;padding:20px;width:min(520px,96vw)">
        <h3 style="margin:0 0 12px">${r.id ? 'Edit' : 'Add'} ${title}</h3>
        <form id="c-f" class="ult-form-grid">
          ${fields.map((f) => `<div class="ult-field"><label>${f.l}</label>
            <input name="${f.k}" ${f.type === 'number' ? 'type="number" step="any"' : ''} value="${r[f.k] ?? f.def ?? ''}" />
          </div>`).join('')}
        </form>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button type="button" class="ult-btn ult-btn-outline" id="c-x">Cancel</button>
          <button type="button" class="ult-btn ult-btn-primary" id="c-sv">Save</button>
        </div>
      </div>
    </div>`;
  }

  function bindForm() {
    if (!modal) return;
    document.getElementById('c-x').onclick = () => { modal = null; render(); };
    document.getElementById('c-ov').onclick = (e) => { if (e.target.id === 'c-ov') { modal = null; render(); } };
    document.getElementById('c-sv').onclick = async () => {
      const rec = Object.fromEntries(new FormData(document.getElementById('c-f')).entries());
      fields.filter((f) => f.type === 'number').forEach((f) => { rec[f.k] = rec[f.k] === '' ? null : Number(rec[f.k]); });
      if (!(await confirmAction(modal.id ? 'Update this row?' : 'Save this row?'))) return;
      let error;
      if (modal.id) ({ error } = await supabase.from(table).update(rec).eq('id', modal.id));
      else ({ error } = await supabase.from(table).insert(rec));
      if (error) { ackResult(false, error.message); return; }
      ackResult(true, modal.id ? 'Row updated.' : 'Row saved.');
      modal = null;
      load();
    };
  }

  load();
}
