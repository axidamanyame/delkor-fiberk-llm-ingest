import { supabase, fmt } from './supabaseClient.js';
import { pageChrome } from './ultimate-shell.js';
import { loadMyPerms, can } from './perm-guard.js';
import { SPECS } from './module-specs.js';
import { confirmAction, ackResult } from './confirm-action.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (n) => (typeof fmt === 'function' ? fmt(n) : Number(n || 0).toFixed(2));

export async function bootModule(code) {
  const spec = SPECS[code];
  const app = document.getElementById('app');
  if (!spec) {
    app.innerHTML = pageChrome('Module') + `<div class="ult-alert">Unknown module ${esc(code)}</div>`;
    return;
  }
  await loadMyPerms();
  if (!can(spec.view) && !can(spec.add) && !can('*')) {
    app.innerHTML = pageChrome(spec.title) + `<div class="ult-alert">No permission for ${esc(spec.view)}. Ask HQ Admin to grant it on Roles.</div>`;
    return;
  }

  let rows = [];
  let err = '';
  let editing = null;

  async function load() {
    const q = await supabase.from(spec.table).select('*').order('created_at', { ascending: false }).limit(500);
    if (q.error) {
      const q2 = await supabase.from(spec.table).select('*').limit(500);
      err = q2.error?.message || q.error.message;
      rows = q2.data || [];
    } else {
      err = '';
      rows = q.data || [];
    }
    render();
  }

  function fieldHtml(col, row) {
    const v = row?.[col.key] ?? '';
    if (col.type === 'checkbox') {
      return `<label class="ult-field"><span></span><label><input type="checkbox" name="${col.key}" ${v ? 'checked' : ''}/> ${esc(col.label)}</label></label>`;
    }
    const t = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text';
    return `<label class="ult-field"><span>${esc(col.label)}${col.required ? ' *' : ''}</span><input name="${col.key}" type="${t}" value="${esc(v)}" ${col.required ? 'required' : ''}/></label>`;
  }

  function render() {
    const showAdd = can(spec.add);
    app.innerHTML = pageChrome(spec.title, `Permission group · ${spec.view}`) + `
      ${err ? `<div class="ult-alert">${esc(err)} — run sql/99_deepen_modules.sql</div>` : ''}
      <div class="ult-card" style="margin-bottom:12px">
        ${showAdd ? '<button type="button" class="ult-btn ult-btn-primary" id="add">+ Add</button>' : ''}
        <span class="ult-muted">${rows.length} row(s)</span>
      </div>
      ${editing !== null ? `
        <div class="ult-card" style="margin-bottom:12px">
          <h3 style="margin:0 0 12px">${editing.id ? 'Edit' : 'Add'} ${esc(spec.title)}</h3>
          <form id="f">${spec.cols.map((c) => fieldHtml(c, editing)).join('')}<div style="margin-top:12px">
            <button class="ult-btn ult-btn-primary" type="submit">Save</button>
            <button class="ult-btn ult-btn-outline" type="button" id="cancel">Cancel</button>
          </div></form>
        </div>` : ''}
      <div class="ult-card ult-table-wrap"><table class="ult-table">
        <thead><tr>${spec.cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            ${spec.cols.map((c) => `<td>${c.type === 'number' ? money(r[c.key]) : esc(r[c.key])}</td>`).join('')}
            <td>
              ${can(spec.edit) ? `<button class="ult-btn ult-btn-sm" data-ed="${r.id}">Edit</button>` : ''}
              ${can(spec.del) ? `<button class="ult-btn ult-btn-sm ult-btn-danger" data-del="${r.id}">Delete</button>` : ''}
            </td>
          </tr>`).join('') || `<tr><td colspan="${spec.cols.length + 1}" class="ult-muted">None yet</td></tr>`}
        </tbody>
      </table></div>
    `;
    app.querySelector('#add')?.addEventListener('click', () => { editing = {}; render(); });
    app.querySelector('#cancel')?.addEventListener('click', () => { editing = null; render(); });
    app.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => {
      editing = rows.find((x) => x.id === b.dataset.ed) || {};
      render();
    }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmAction('Delete this row?', 'This cannot be undone.'))) return;
      const { error } = await supabase.from(spec.table).delete().eq('id', b.dataset.del);
      if (error) { ackResult(false, error.message); err = error.message; render(); return; }
      ackResult(true, 'Row deleted.');
      await load();
    }));
    app.querySelector('#f')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {};
      for (const c of spec.cols) {
        if (c.type === 'checkbox') payload[c.key] = e.target.querySelector(`[name="${c.key}"]`)?.checked || false;
        else if (c.type === 'number') payload[c.key] = Number(fd.get(c.key) || 0);
        else payload[c.key] = fd.get(c.key) || null;
      }
      let res;
      if (editing?.id) res = await supabase.from(spec.table).update(payload).eq('id', editing.id);
      else res = await supabase.from(spec.table).insert(payload);
      if (res.error) { err = res.error.message; render(); return; }
      editing = null;
      await load();
    });
  }

  await load();
}
