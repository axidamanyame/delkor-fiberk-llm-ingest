/** Hover/click info — policy stays off the desk. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function infoIcon(_opts = {}) {
  return '';
}

export function noteLink(full, word = '') {
  const text = String(full || '').trim();
  if (!text) return '';
  const raw = String(word || '').trim() || (text.split(/\s+/).find((w) => /[a-zA-Z]/i.test(w)) || 'Note');
  const summary = raw.replace(/[^\w+]/g, '').slice(0, 18) || 'Note';
  return `<button type="button" class="df-note-link" data-note-title="${esc(summary)}" data-note="${esc(text)}">${esc(summary)}</button>`;
}

export function bindInfoTips(root = document) {
  const host = root.body || root;
  if (!host) return;
  host.querySelectorAll('.df-note-link').forEach((btn) => {
    if (btn.__dfNote) return;
    btn.__dfNote = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const title = btn.getAttribute('data-note-title') || 'Note';
      const body = btn.getAttribute('data-note') || '';
      const box = document.createElement('div');
      box.className = 'df-note-card';
      box.innerHTML = `<button type="button" class="df-note-x" aria-label="Close">×</button>
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>`;
      const shade = document.createElement('div');
      shade.className = 'df-note-shade';
      const close = () => { shade.remove(); box.remove(); };
      box.querySelector('.df-note-x').onclick = close;
      shade.onclick = close;
      document.body.appendChild(shade);
      document.body.appendChild(box);
    });
  });
  host.querySelectorAll('.df-info').forEach((btn) => {
    if (btn.__dfInfo) return;
    btn.__dfInfo = true;
    const pop = btn.querySelector('.df-info-pop');
    if (!pop) return;
    const show = () => { pop.hidden = false; };
    const hide = () => { pop.hidden = true; };
    btn.addEventListener('mouseenter', show);
    btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('open')) hide(); });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const on = btn.classList.toggle('open');
      pop.hidden = !on;
    });
  });
}

const POLICY_RE = /migrated|fiberkapp|hard fork|silo|roadmap|module shell|tell us which|not a fiberkapp|live catalogue|handwritten|these rows|until the|this desk|how this|policy|hire-purchase|test posted|supplier is created|not written to|builder|session peek|live book|delkor ii|operations hub →/i;

export function tightenBlurbs(root = document) {
  const host = root.body || root;
  if (!host) return;
  host.querySelectorAll('.manual-ref, .mig-stamp, p.legend, p.sub, p.ult-lead, p.ult-muted, .ult-muted').forEach((el) => {
    if (el.closest('.df-info')) return;
    const text = (el.textContent || '').trim();
    if (!POLICY_RE.test(text)) return;
    if (el.querySelector('table, input, select, button.add, .ult-btn')) return;
    el.remove();
  });
  host.querySelectorAll('table').forEach((table) => {
    const ths = [...table.querySelectorAll('thead th')];
    const noteIdx = ths.map((th, i) => (/note|detail|remark|comment/i.test(th.textContent || '') ? i : -1)).filter((i) => i >= 0);
    if (!noteIdx.length) return;
    table.querySelectorAll('tbody tr').forEach((tr) => {
      noteIdx.forEach((i) => {
        const td = tr.children[i];
        if (!td || td.querySelector('.df-note-link, input, select, button')) return;
        const text = String(td.textContent || '').trim();
        if (!text || text.split(/\s+/).length < 2) return;
        const head = String(ths[i].textContent || '');
        const word = /imei/i.test(text) ? 'IMEI' : /staff/i.test(head) ? 'Staff' : /ship/i.test(head) ? 'Ship' : 'Note';
        td.innerHTML = noteLink(text, word);
      });
    });
  });
  bindInfoTips(host);
}
