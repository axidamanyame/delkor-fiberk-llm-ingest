/** Ultimate-style column hide. Falls back to localStorage if table missing. */
import { supabase } from './supabaseClient.js';

export const HIDABLE = {
  Products: ['Selling Price', 'Brand', 'Tax', 'Category', 'Location'],
  'Product Sell Report': ['Discount', 'Tax', 'Price Inc. Tax'],
  Purchases: ['Status', 'Paid', 'Location'],
};

export async function loadHidden(module) {
  const key = 'df_hide_' + module;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return JSON.parse(localStorage.getItem(key) || '[]');
    const { data, error } = await supabase.from('user_column_prefs')
      .select('column_name').eq('user_id', user.id).eq('module_name', module).eq('hidden', true);
    if (error) throw error;
    return (data || []).map(r => r.column_name);
  } catch {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

export async function setHidden(module, column, hidden) {
  const key = 'df_hide_' + module;
  const cur = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  if (hidden) cur.add(column); else cur.delete(column);
  localStorage.setItem(key, JSON.stringify([...cur]));
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_column_prefs').upsert({
      user_id: user.id, module_name: module, column_name: column, hidden, updated_at: new Date().toISOString()
    });
  } catch { /* offline / table missing */ }
}

export function applyHidden(tableEl, hiddenNames) {
  if (!tableEl) return;
  const ths = [...tableEl.querySelectorAll('thead th')];
  ths.forEach((th, i) => {
    const hide = hiddenNames.includes(th.textContent.trim());
    th.style.display = hide ? 'none' : '';
    tableEl.querySelectorAll('tbody tr').forEach(tr => {
      const td = tr.children[i];
      if (td) td.style.display = hide ? 'none' : '';
    });
  });
}

export function columnMenuHtml(module, hidden) {
  const cols = HIDABLE[module] || [];
  return cols.map(c =>
    `<label style="display:flex;gap:6px;align-items:center;font-size:13px">
      <input type="checkbox" data-col="${c}" ${hidden.includes(c)?'':'checked'} /> ${c}
    </label>`
  ).join('');
}
