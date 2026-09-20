/** In-page Add/Edit card. Does not leave the list. */
export function openDeskModal({ title = 'Edit', body = '', saveLabel = 'Update', onSave } = {}) {
  document.getElementById('dm-back')?.remove();
  if (!document.getElementById('dm-css')) {
    const s = document.createElement('style');
    s.id = 'dm-css';
    s.textContent = `
      .dm-back{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:14000;display:flex;align-items:flex-start;justify-content:center;padding:48px 16px;overflow:auto}
      .dm-card{width:min(520px,100%);background:#fff;border-radius:8px;box-shadow:0 24px 60px rgba(15,23,42,.28)}
      .dm-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e5e7eb;font-weight:700}
      .dm-x{border:0;background:transparent;font-size:20px;cursor:pointer;color:#64748b}
      .dm-b{padding:16px 18px}
      .dm-b label{display:block;font-size:13px;font-weight:700;margin:10px 0 4px}
      .dm-b input[type=text],.dm-b input:not([type]),.dm-b textarea,.dm-b select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit}
      .dm-b textarea{min-height:72px}
      .dm-hint{font-size:12px;color:#64748b;margin:4px 0 0}
      .dm-check{display:flex;align-items:center;gap:8px;margin:12px 0;font-size:13px}
      .dm-f{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e5e7eb}
      .dm-save{background:#6d28d9;color:#fff;border:0;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer}
      .dm-close{background:#0f172a;color:#fff;border:0;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer}
    `;
    document.head.appendChild(s);
  }
  const back = document.createElement('div');
  back.id = 'dm-back';
  back.className = 'dm-back';
  back.innerHTML = `<article class="dm-card" role="dialog" aria-modal="true">
    <header class="dm-h"><span>${title}</span><button type="button" class="dm-x" data-dm-close>×</button></header>
    <form class="dm-form">
      <div class="dm-b">${body}</div>
      <footer class="dm-f">
        <button type="submit" class="dm-save">${saveLabel}</button>
        <button type="button" class="dm-close" data-dm-close>Close</button>
      </footer>
    </form>
  </article>`;
  const form = back.querySelector('form');
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-dm-close]')) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (typeof onSave === 'function') {
      const ok = await onSave(new FormData(form), form);
      if (ok === false) return;
    }
    close();
  });
  document.body.appendChild(back);
  form.querySelector('input,select,textarea')?.focus();
  return back;
}
