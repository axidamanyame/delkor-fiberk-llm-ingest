/**
 * HQ Admin (and managers) can View / Edit / Delete any operational row.
 * Delete always drops the local copy and best-effort removes it from Supabase.
 */
import { deleteRow } from './ls-rows.js';
import { confirmAction, ackResult } from './confirm-action.js';

export function crudButtons(id, { view, edit } = {}) {
  const i = encodeURIComponent(String(id || ''));
  const row = [
    view ? `<button type="button" class="pill" data-record-view="${i}">View</button>` : '',
    edit ? `<a href="${edit}">Edit</a>` : '',
  ].filter(Boolean).join(' ');
  return `<span class="act-stack">${row ? `<span class="act-row">${row}</span>` : ''}<button type="button" class="pill del" data-del="${i}">Delete</button></span>`;
}

export function bindDeletes(root, { table, key, label = 'this record', onDone } = {}) {
  if (!root || !table || !key) return;
  root.querySelectorAll('[data-del]').forEach((b) => {
    if (b.dataset.crudBound === '1') return;
    b.dataset.crudBound = '1';
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = decodeURIComponent(b.dataset.del || b.dataset.id || '');
      if (!id) return;
      if (!(await confirmAction('Delete ' + label + '?', 'This cannot be undone. Use this to clear test or leftover rows.'))) return;
      const r = await deleteRow(table, key, id);
      ackResult(true, r?.shared === false ? 'Deleted on this device.' : 'Deleted.');
      if (typeof onDone === 'function') onDone();
    });
  });
}
