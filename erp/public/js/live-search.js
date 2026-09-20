/** Typeahead for every search box — matches appear from the first character. */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));
}

function mark(text, q) {
  const src = String(text ?? '');
  if (!q) return esc(src);
  const i = src.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(src);
  return esc(src.slice(0, i)) + '<mark>' + esc(src.slice(i, i + q.length)) + '</mark>' + esc(src.slice(i + q.length));
}

function isSearchInput(el) {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.dataset.liveSearch === 'off') return false;
  if (el.closest('.st-search')) return false;
  if (el.type === 'password' || el.type === 'hidden' || el.type === 'number' || el.type === 'date' || el.type === 'datetime-local' || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'email' || el.type === 'tel' || el.type === 'url' || el.type === 'color' || el.type === 'range') return false;
  if (el.autocomplete === 'current-password' || el.autocomplete === 'new-password') return false;
  if (el.dataset.tblSearch != null) return true;
  if (el.type === 'search') return true;
  const ph = (el.placeholder || '').toLowerCase();
  if (/\b(search|find|filter|look up|lookup)\b/.test(ph)) return true;
  if (/^(scan|q|set_search|hdr-search|pos-search)$/i.test(el.id || '')) return true;
  return false;
}

function collectItems(input) {
  const items = [];
  const seen = new Set();
  const push = (label, sub = '', hay = '') => {
    const name = String(label || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label: name, sub: String(sub || '').trim(), hay: (hay || (name + ' ' + sub)).toLowerCase() });
  };

  const root = input.closest('[data-tbl]') || input.closest('.card') || input.closest('.ult-card') || input.closest('.biz-set') || document.getElementById('app') || document.body;
  const table = root.querySelector?.('table') || input.closest('.bar')?.parentElement?.querySelector('table');
  if (table) {
    const ths = [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/[↕↑↓⇅]/g, '').trim().toLowerCase());
    const headerScore = (t) => {
      if (!t || /action|image|photo|select|checkbox|^$/.test(t)) return -1;
      if (/^(product|name|customer|supplier|contact|item|title|role|username)$/.test(t)) return 5;
      if (/^sku$|^code$|^reference/.test(t)) return 4;
      if (/\bproduct\b/.test(t) && !/image/.test(t)) return 3;
      if (/\b(name|customer|supplier)\b/.test(t)) return 2;
      return 0;
    };
    let nameIdx = 0;
    let best = -1;
    ths.forEach((t, i) => { const s = headerScore(t); if (s > best) { best = s; nameIdx = i; } });
    const skuIdx = ths.findIndex((t) => /^(sku|code|ref|reference)/.test(t));
    const locIdx = ths.findIndex((t) => /location|subsidiary|brand|category|unit/.test(t) && !/purchase|selling/.test(t));
    table.querySelectorAll('tbody tr').forEach((tr) => {
      if (tr.dataset.dummy === '1') return;
      if (tr.querySelector('.tot')) return;
      const cells = [...tr.children].map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      const label = cells[nameIdx] || cells.find((c) => c && !/^(actions?|edit|view|delete|▾)/i.test(c)) || '';
      if (!label || /^actions?/i.test(label) || /^total\b/i.test(label)) return;
      const sub = [skuIdx >= 0 ? cells[skuIdx] : '', locIdx >= 0 ? cells[locIdx] : ''].filter((x) => x && x !== label).join(' · ');
      push(label, sub, cells.join(' '));
    });
  }

  root.querySelectorAll?.('select[data-tbl-filter] option, .bar select option').forEach((opt) => {
    if (opt.value) push(opt.textContent, opt.value);
  });

  document.querySelectorAll('.prod-tile, .pos-prod, [data-sku]').forEach((el) => {
    const name = el.querySelector('b,strong,.name')?.textContent || el.dataset.name || '';
    const sku = el.dataset.sku || el.querySelector('.sku')?.textContent || '';
    push(name, sku);
  });

  root.querySelectorAll?.('.biz-set-nav button, .set-nav button, .ai-tabs a, .tabs a, .tabs button').forEach((el) => {
    push(el.textContent);
  });

  return items;
}

function rank(items, q) {
  const needle = q.toLowerCase().trim();
  if (!needle) return [];
  const scored = [];
  for (const it of items) {
    const hay = it.hay || it.label.toLowerCase();
    const lab = it.label.toLowerCase();
    let score = 0;
    if (lab === needle) score = 400;
    else if (lab.startsWith(needle)) score = 300;
    else if (lab.split(/[\s/|()_-]+/).some((w) => w.startsWith(needle))) score = 200;
    else if (lab.includes(needle)) score = 120;
    else if (hay.includes(needle)) score = 60;
    else continue;
    scored.push({ ...it, score });
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return scored.slice(0, 10);
}

let openMenu = null;
let openInput = null;

function closeMenu() {
  openMenu?.remove();
  openMenu = null;
  openInput = null;
}

function place(menu, input) {
  const r = input.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 280), Math.max(200, window.innerWidth - 16));
  let left = r.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  let top = r.bottom + 4;
  const est = Math.min(280, menu.scrollHeight || 200);
  if (top + est > window.innerHeight - 8 && r.top > est + 8) top = r.top - est - 4;
  menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${width}px;z-index:500;`;
}

function paintMenu(input, q) {
  const hits = rank(collectItems(input), q);
  closeMenu();
  if (!hits.length) return;
  const menu = document.createElement('div');
  menu.className = 'df-live';
  menu.setAttribute('role', 'listbox');
  menu.innerHTML = hits.map((h, i) =>
    `<button type="button" role="option" class="${i === 0 ? 'on' : ''}" data-i="${i}">
      <span class="df-live-lab">${mark(h.label, q)}</span>
      ${h.sub ? `<span class="df-live-sub">${esc(h.sub)}</span>` : ''}
    </button>`
  ).join('') + `<div class="df-live-foot">${hits.length} match${hits.length === 1 ? '' : 'es'}</div>`;
  document.body.appendChild(menu);
  place(menu, input);
  openMenu = menu;
  openInput = input;
  let idx = 0;
  const buttons = () => [...menu.querySelectorAll('button[data-i]')];
  const hi = () => buttons().forEach((b, i) => b.classList.toggle('on', i === idx));
  const pick = (item) => {
    input.value = item.label;
    closeMenu();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input._tblPaint?.();
  };
  menu.addEventListener('mousedown', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    e.preventDefault();
    pick(hits[Number(b.dataset.i)]);
  });
  input._liveKey = (e) => {
    if (!openMenu) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(hits.length - 1, idx + 1); hi(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); hi(); }
    else if (e.key === 'Enter' && hits[idx]) { e.preventDefault(); pick(hits[idx]); }
    else if (e.key === 'Escape') { closeMenu(); }
  };
}

export function wireLiveSearch(input) {
  if (!input || input.dataset.liveOn === '1') return;
  if (!isSearchInput(input)) return;
  input.dataset.liveOn = '1';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  const show = () => {
    const q = input.value.trim();
    if (q.length < 1) { closeMenu(); return; }
    paintMenu(input, q);
  };
  input.addEventListener('input', show);
  input.addEventListener('focus', show);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (openMenu === document.querySelector('.df-live') && input._liveKey) input._liveKey(e);
      else {
        closeMenu();
        input._tblPaint?.();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    input._liveKey?.(e);
  });
  input.addEventListener('blur', () => setTimeout(() => { if (openInput === input) closeMenu(); }, 150));
}

export function enhanceAllSearch(root = document) {
  root.querySelectorAll?.('input').forEach(wireLiveSearch);
}

let observing = false;
export function observeLiveSearch() {
  enhanceAllSearch(document);
  if (observing) return;
  observing = true;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('input')) wireLiveSearch(n);
        n.querySelectorAll?.('input').forEach(wireLiveSearch);
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('scroll', () => { if (openMenu && openInput) place(openMenu, openInput); }, true);
  window.addEventListener('resize', () => { if (openMenu && openInput) place(openMenu, openInput); });
}
