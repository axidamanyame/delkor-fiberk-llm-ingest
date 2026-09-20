/**
 * Spreadsheet — UPOS folder tree + LuckySheet editor.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { bindOverflowTabs, onHubNavigate, floorNav, tryPaintFloor, bindHubTabs } from './hub-kit.js';
import { ensureHpWorkbooks, cellsForWorkbook, HP_WORKBOOKS } from './hp-workbooks.js';

const KEY = 'df_spreadsheets_v1';
const FLAG = 'df_spreadsheets_seed';
const LUCKY_CSS = [
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/plugins/css/pluginsCss.css',
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/plugins/plugins.css',
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/css/luckysheet.css',
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/assets/iconfont/iconfont.css',
];
const LUCKY_JS = [
  'https://cdn.jsdelivr.net/npm/jquery@2.2.4/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/plugins/js/plugin.js',
  'https://cdn.jsdelivr.net/npm/luckysheet@2.1.12/dist/luckysheet.umd.min.js',
  'https://cdn.jsdelivr.net/npm/luckyexcel@1.0.1/dist/luckyexcel.umd.js',
];

function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readLs(KEY, []).length) { ensureHpWorkbooks(); return; } } catch { /* ignore */ }
  const rows = [
    { id: 'f-hq', kind: 'folder', parent: null, name: 'HQ Finance', updated: '2026-08-28' },
    { id: 's-vat', kind: 'sheet', parent: 'f-hq', name: 'VAT Working Aug 2026', updated: '2026-08-28',
      cells: [['Item', 'GHS', 'Note'], ['Output VAT', '18420', 'Axidigetek'], ['Input VAT', '9600', 'Nasco'], ['Net payable', '8820', 'due 30 Sep']] },
    { id: 's-cash', kind: 'sheet', parent: 'f-hq', name: 'Q3 Cash Plan', updated: '2026-09-01',
      cells: [['Month', 'In', 'Out', 'Net'], ['Jul', '412000', '288000', '124000'], ['Aug', '455000', '301000', '154000'], ['Sep', '390000', '275000', '115000']] },
    { id: 'f-fib', kind: 'folder', parent: null, name: 'Fiberk Shop', updated: '2026-09-03' },
    { id: 's-sales', kind: 'sheet', parent: 'f-fib', name: 'Daily Sales', updated: '2026-09-03',
      cells: [['Date', 'Till', 'GHS'], ['2026-09-01', 'POS-1', '8450'], ['2026-09-02', 'POS-1', '9120'], ['2026-09-03', 'POS-2', '6740']] },
    { id: 'f-axi', kind: 'folder', parent: null, name: 'Axidigetek', updated: '2026-08-21' },
    { id: 's-stock', kind: 'sheet', parent: 'f-axi', name: 'Stock count', updated: '2026-08-21',
      cells: [['SKU', 'Name', 'Qty'], ['AXI-110', 'HP Laptop 14', '22'], ['AXI-204', 'Router AC1200', '48']] },
    { id: 'f-un', kind: 'folder', parent: null, name: 'Untitled', updated: '2026-09-04' },
  ];
  writeLs(KEY, rows);
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  ensureHpWorkbooks();
}

function load() { seed(); return readLs(KEY, []); }
function save(rows) { writeLs(KEY, rows); }

function tab() {
  const q = new URLSearchParams(location.search);
  const t = q.get('tab') || '';
  if (['sheets', 'topics', 'reports', 'setup'].includes(t)) return t;
  if (q.get('sheet') || q.get('new') || q.get('view')) return 'edit';
  return 'tree';
}
function sheetId() { return new URLSearchParams(location.search).get('sheet') || ''; }

function go(query) {
  teardownLucky();
  const path = '/spreadsheet.html' + (query || '');
  history.pushState({ spa: path }, '', path);
  paint();
}

function navHtml(on) {
  return floorNav('Spreadsheet', on, 'tree', '/spreadsheet.html');
}

function bindNav(app) {
  bindHubTabs(app, (k) => {
    if (k === 'sheets') go('?tab=sheets');
    else if (k === 's-hp-orders') go('?sheet=s-hp-orders');
    else go(k && k !== 'tree' ? `?tab=${encodeURIComponent(k)}` : '');
  });
}

function loadCss(href) {
  if (document.querySelector(`link[data-lucky="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  l.dataset.lucky = href;
  document.head.appendChild(l);
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-lucky="${src}"]`);
    if (existing) {
      if (existing.dataset.ready === '1') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.dataset.lucky = src;
    s.onload = () => { s.dataset.ready = '1'; resolve(); };
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

let luckyReady = null;
async function loadLucky() {
  if (window.luckysheet) return window.luckysheet;
  if (luckyReady) return luckyReady;
  LUCKY_CSS.forEach(loadCss);
  luckyReady = (async () => {
    for (const src of LUCKY_JS) await loadScript(src);
    return window.luckysheet;
  })();
  return luckyReady;
}

function teardownLucky() {
  try { window.luckysheet?.destroy?.(); } catch { /* ignore */ }
  document.querySelectorAll(
    '.luckysheet-modal-dialog, #luckysheet-icon-morebtn-div, .luckysheet-cols-menu, #luckysheet-input-box, .luckysheet-wa-editor, #luckysheet-scrollbar-x, #luckysheet-scrollbar-y'
  ).forEach((el) => el.remove());
}

function cellsToLucky(name, cells) {
  const has = (cells || []).some((r) => (r || []).some((c) => c !== '' && c != null));
  if (!has) {
    return [0, 1, 2].map((i) => ({
      name: 'Sheet' + (i + 1),
      color: '',
      status: i === 0 ? 1 : 0,
      order: i,
      index: String(i),
      celldata: [],
      row: 84,
      column: 26,
      config: {},
    }));
  }
  const celldata = [];
  (cells || []).forEach((row, r) => {
    (row || []).forEach((val, c) => {
      if (val === '' || val == null) return;
      celldata.push({ r, c, v: { v: val, m: String(val), ct: { fa: 'General', t: 'g' } } });
    });
  });
  return [{
    name: name || 'Sheet1',
    color: '',
    status: 1,
    order: 0,
    index: '0',
    celldata,
    row: Math.max(84, (cells || []).length + 40),
    column: 26,
    config: {},
  }];
}

function luckyToCells(sheets) {
  const first = (sheets || [])[0];
  if (!first) return [['']];
  const out = [];
  const push = (r, c, val) => {
    while (out.length <= r) out.push([]);
    while (out[r].length <= c) out[r].push('');
    out[r][c] = val;
  };
  if (Array.isArray(first.celldata)) {
    first.celldata.forEach((cell) => {
      const v = cell?.v;
      const val = (v && typeof v === 'object') ? (v.m ?? v.v ?? '') : (v ?? '');
      push(cell.r, cell.c, val);
    });
  } else if (Array.isArray(first.data)) {
    first.data.forEach((row, r) => {
      (row || []).forEach((cell, c) => {
        if (!cell) return;
        push(r, c, cell.m ?? cell.v ?? '');
      });
    });
  }
  return out.length ? out : [['']];
}

function currentUserLabel() {
  const n = document.querySelector('#hdr-user')?.textContent?.replace(/^[^\w]+/, '').trim();
  if (n) return n;
  return (window.__dfUserLabel || 'Staff').trim();
}

function stamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(+d)) return String(iso || '');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function persistCurrent(sheet) {
  try {
    const api = window.luckysheet;
    if (api) {
      const sheets = api.getAllSheets?.() || api.getluckysheetfile?.() || null;
      if (Array.isArray(sheets) && sheets.length) {
        sheet.lucky = sheets;
        sheet.cells = luckyToCells(sheets);
      }
      const title = api.toJson?.()?.title || api.getWorkbookName?.() || sheet.name;
      if (title) sheet.name = title;
    }
  } catch (e) {
    console.warn('spreadsheet save', e);
  }
  sheet.updated = new Date().toISOString();
  sheet.owner = sheet.owner || currentUserLabel();
  const all = load();
  const i = all.findIndex((r) => r.id === sheet.id);
  if (i >= 0) all[i] = { ...all[i], ...sheet };
  else all.push(sheet);
  save(all);
  return sheet;
}

function downloadWorkbook(sheet) {
  const sheets = window.luckysheet?.getAllSheets?.() || sheet.lucky || [];
  const first = sheets[0];
  const rows = luckyToCells(sheets);
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(sheet.name || first?.name || 'spreadsheet').replace(/[^\w.-]+/g, '_')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function paintTree(app) {
  const rows = load();
  const folders = rows.filter((r) => r.kind === 'folder');
  const q = (app.querySelector('#ss-q')?.value || '').toLowerCase();

  function folderBlock(f) {
    const kids = rows.filter((r) => r.kind === 'sheet' && r.parent === f.id)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
    if (q && !kids.length && !f.name.toLowerCase().includes(q)) return '';
    const folders = rows.filter((r) => r.kind === 'folder');
    return `<li class="ss-folder" data-id="${esc(f.id)}">
      <div class="ss-row">
        <button type="button" class="ss-twirl" data-twirl="${esc(f.id)}" aria-label="Toggle">▾</button>
        <span class="ss-ico ss-folder-ico" aria-hidden="true">📁</span>
        <span class="ss-name">${esc(f.name)}</span>
        <button type="button" class="ss-plus" data-add="${esc(f.id)}" title="Add sheet">+</button>
      </div>
      <ul class="ss-kids">${kids.map((s) => {
        const live = !!(s.integrated || s.source);
        const moveOpts = folders.map((x) =>
          `<button type="button" data-move-to="${esc(x.id)}" data-sheet="${esc(s.id)}" ${x.id === f.id ? 'disabled' : ''}>${esc(x.name)}</button>`
        ).join('');
        return `<li class="ss-sheet" data-id="${esc(s.id)}">
          <span class="ss-sheet-ico" aria-hidden="true">▦</span>
          <a href="/spreadsheet.html?sheet=${esc(s.id)}" data-open="${esc(s.id)}">${esc(s.name)}</a>
          ${live ? ' <span class="hp-hit">Live</span>' : ''}
          <span class="ss-acts">
            <button type="button" class="ss-act view" data-view="${esc(s.id)}" title="View">👁</button>
            ${live ? '' : `<button type="button" class="ss-act del" data-del="${esc(s.id)}" title="Delete">🗑</button>`}
            <button type="button" class="ss-act share" data-share="${esc(s.id)}" title="Share">↗</button>
            <details class="ss-act-drop">
              <summary class="ss-act move" title="Move to folder">↪</summary>
              <menu>${moveOpts || '<span class="ult-muted">No folders</span>'}</menu>
            </details>
          </span>
          <div class="ss-meta">${esc(stamp(s.updated))} · ${esc(s.owner || currentUserLabel())}</div>
        </li>`;
      }).join('')}</ul>
    </li>`;
  }

  app.innerHTML = `
    ${navHtml('tree')}
    <h1>Spreadsheet</h1>
    <div class="ult-card">
      <div class="ss-head">
        <strong>My Spreadsheets</strong>
        <button type="button" class="ult-btn ult-btn-primary" id="ss-folder">+ Add Folder</button>
      </div>
      <div class="ss-tools">
        <div class="ss-search"><input id="ss-q" value="${esc(q)}" placeholder="" /><span>⌕</span></div>
        <button type="button" class="ult-btn ult-btn-primary ult-btn-sm" id="ss-exp">Expand all</button>
        <button type="button" class="ult-btn ult-btn-primary ult-btn-sm" id="ss-col">Collapse all</button>
      </div>
      <ul class="ss-tree" id="ss-tree">${folders.map(folderBlock).join('') || '<li class="ult-muted">No folders yet</li>'}</ul>
    </div>
    <div class="pay-modal-bg" id="ss-fold-modal" hidden>
      <div class="pay-modal" role="dialog">
        <header><strong>Add Folder</strong><button type="button" data-close>×</button></header>
        <div class="pay-modal-body">
          <label class="ult-field"><span>Folder name</span><input id="ss-fold-name" /></label>
        </div>
        <footer>
          <button type="button" class="ult-btn ult-btn-outline" data-close>Close</button>
          <button type="button" class="ult-btn ult-btn-primary" id="ss-fold-save">Save</button>
        </footer>
      </div>
    </div>`;
  bindNav(app);
  const tree = app.querySelector('#ss-tree');
  app.querySelector('#ss-q').oninput = () => paint();
  app.querySelector('#ss-exp').onclick = () => tree.querySelectorAll('.ss-folder').forEach((li) => li.classList.remove('closed'));
  app.querySelector('#ss-col').onclick = () => tree.querySelectorAll('.ss-folder').forEach((li) => li.classList.add('closed'));
  tree.querySelectorAll('[data-twirl]').forEach((b) => {
    b.onclick = () => b.closest('.ss-folder')?.classList.toggle('closed');
  });
  tree.querySelectorAll('[data-add]').forEach((b) => {
    b.onclick = () => {
      const all = load();
      const id = uid();
      all.push({
        id, kind: 'sheet', parent: b.dataset.add, name: 'My Spreadsheet',
        updated: new Date().toISOString().slice(0, 10), cells: [['']],
      });
      save(all);
      go('?sheet=' + id);
    };
  });
  tree.querySelectorAll('[data-open]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); go('?sheet=' + a.dataset.open); };
  });
  tree.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => go('?sheet=' + b.dataset.view + '&view=1');
  });
  tree.querySelectorAll('[data-share]').forEach((b) => {
    b.onclick = async () => {
      const url = location.origin + '/spreadsheet.html?sheet=' + encodeURIComponent(b.dataset.share);
      try {
        await navigator.clipboard.writeText(url);
        alert('Link copied');
      } catch {
        prompt('Copy link', url);
      }
    };
  });
  tree.querySelectorAll('[data-move-to]').forEach((b) => {
    b.onclick = () => {
      const all = load();
      const s = all.find((r) => r.id === b.dataset.sheet);
      if (!s) return;
      s.parent = b.dataset.moveTo;
      save(all);
      paint();
    };
  });
  tree.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      if (!confirm('Delete this spreadsheet?')) return;
      save(load().filter((r) => r.id !== b.dataset.del));
      paint();
    };
  });
  const modal = app.querySelector('#ss-fold-modal');
  app.querySelector('#ss-folder').onclick = () => {
    modal.hidden = false;
    app.querySelector('#ss-fold-name').value = '';
    app.querySelector('#ss-fold-name').focus();
  };
  modal.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { modal.hidden = true; }; });
  app.querySelector('#ss-fold-save').onclick = () => {
    const name = app.querySelector('#ss-fold-name').value.trim() || 'Untitled';
    const all = load();
    all.push({ id: uid(), kind: 'folder', parent: null, name, updated: new Date().toISOString().slice(0, 10) });
    save(all);
    modal.hidden = true;
    paint();
  };
}

function paintSheets(app) {
  const rows = load().filter((r) => r.kind === 'sheet');
  const folders = Object.fromEntries(load().filter((r) => r.kind === 'folder').map((f) => [f.id, f.name]));
  app.innerHTML = `
    ${navHtml('sheets')}
    <h1>Sheets</h1>
    <div class="ult-card">
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Name</th><th>Folder</th><th>Updated</th><th></th></tr></thead>
        <tbody>${rows.map((s) => `<tr>
          <td><a href="/spreadsheet.html?sheet=${esc(s.id)}" data-open="${esc(s.id)}">${esc(s.name)}${s.integrated || s.source ? ' <span class="hp-hit">Live</span>' : ''}</a></td>
          <td>${esc(folders[s.parent] || '—')}</td>
          <td>${esc(s.updated || '—')}</td>
          <td><button type="button" class="ult-btn ult-btn-outline ult-btn-sm" data-del="${esc(s.id)}">Delete</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="ult-muted">No sheets</td></tr>'}</tbody>
      </table></div>
    </div>`;
  bindNav(app);
  app.querySelectorAll('[data-open]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); go('?sheet=' + a.dataset.open); };
  });
  app.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      if (!confirm('Are you sure?')) return;
      save(load().filter((r) => r.id !== b.dataset.del));
      paint();
    };
  });
}

function paintEdit(app) {
  const all = load();
  const viewOnly = new URLSearchParams(location.search).get('view') === '1';
  let sheet = all.find((r) => r.id === sheetId());
  if (!sheet) {
    const parent = all.find((r) => r.kind === 'folder' && r.name === 'Untitled')?.id
      || all.find((r) => r.kind === 'folder')?.id || null;
    sheet = {
      id: uid(), kind: 'sheet', parent, name: 'My Spreadsheet',
      updated: new Date().toISOString(), owner: currentUserLabel(), cells: [['']],
    };
    all.push(sheet);
    save(all);
    history.replaceState({ spa: '/spreadsheet.html?sheet=' + sheet.id }, '', '/spreadsheet.html?sheet=' + sheet.id);
  }

  const live = HP_WORKBOOKS.find((w) => w.id === sheet.id || w.source === sheet.source);
  const createTitle = (sheet.lucky || (sheet.cells || []).some((r) => (r || []).some(Boolean)))
    ? sheet.name
    : 'Create spreadsheet';

  app.innerHTML = `
    <h1 class="ss-create-title">${esc(viewOnly ? sheet.name : createTitle)}</h1>
    ${live ? `<p class="ops-sub" style="margin:0 16px 10px">Live workbook from Field Ops · feeds ${esc(live.feeds.join(', '))}.
      <a href="${live.href}">Open live table</a></p>` : ''}
    <div class="ss-create-bar">
      <button type="button" class="ss-back" id="ss-back">‹ Go Back</button>
      ${viewOnly || live ? '' : `<label class="ss-file">Choose File <input type="file" id="ss-import" accept=".xlsx,.xls,.csv" /></label>
      <span class="ss-file-name" id="ss-file-name">No file chosen</span>`}
      <div class="ss-create-actions">
        <button type="button" class="ult-btn ult-btn-primary" id="ss-dl">⬇ Download</button>
        ${viewOnly || live ? '' : `<button type="button" class="ult-btn ult-btn-primary" id="ss-save">💾 Save</button>`}
      </div>
    </div>
    <div class="ss-lucky" id="ss-lucky-wrap">
      <div id="my_spreadsheet"></div>
    </div>
    <p class="ss-save-msg" id="ss-msg" hidden>Saved to My Spreadsheets.</p>`;

  document.body.classList.add('ss-editing');

  app.querySelector('#ss-back').onclick = () => { persistCurrent(sheet); go(''); };
  app.querySelector('#ss-save')?.addEventListener('click', () => {
    persistCurrent(sheet);
    go('');
  });
  app.querySelector('#ss-dl').onclick = () => {
    persistCurrent(sheet);
    downloadWorkbook(sheet);
  };
  const fileInp = app.querySelector('#ss-import');
  if (fileInp) fileInp.onchange = async (ev) => {
    const file = ev.target.files?.[0];
    const nameEl = app.querySelector('#ss-file-name');
    if (nameEl) nameEl.textContent = file ? file.name : 'No file chosen';
    if (!file) return;
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      const cells = text.split(/\r?\n/).map((line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
      sheet.cells = cells;
      sheet.name = file.name.replace(/\.csv$/i, '') || sheet.name;
      teardownLucky();
      mountLucky(sheet, { viewOnly: false });
      return;
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      alert('Import .xlsx or .csv');
      return;
    }
    if (!window.LuckyExcel) {
      alert('Excel importer is still loading — try again in a moment.');
      return;
    }
    window.LuckyExcel.transformExcelToLucky(file, (exportJson) => {
      if (!exportJson.sheets?.length) {
        alert('Could not read that file.');
        return;
      }
      sheet.name = exportJson.info?.name || file.name.replace(/\.xlsx?$/i, '');
      sheet.lucky = exportJson.sheets;
      teardownLucky();
      mountLucky(sheet, { viewOnly: false, data: exportJson.sheets });
    });
  };

  loadLucky().then(() => mountLucky(sheet, { viewOnly: viewOnly || !!sheet.source }))
    .catch((err) => {
      console.warn(err);
      app.querySelector('#ss-lucky-wrap').innerHTML =
        `<div class="ult-alert">Spreadsheet engine could not load. Check your connection and try again.<br>${esc(err.message || err)}</div>`;
    });
}

async function mountLucky(sheet, { viewOnly = false, data } = {}) {
  teardownLucky();
  const host = document.getElementById('my_spreadsheet');
  if (!host || !window.luckysheet) return;
  let payload = data;
  if (!payload) {
    if (sheet.source) {
      try {
        const cells = await cellsForWorkbook(sheet.source);
        payload = cellsToLucky(sheet.name, cells);
      } catch (e) {
        console.warn('live workbook', e);
        payload = cellsToLucky(sheet.name, sheet.cells);
      }
    } else if (Array.isArray(sheet.lucky) && sheet.lucky.length) {
      payload = sheet.lucky;
    } else {
      payload = cellsToLucky(sheet.name, sheet.cells);
    }
  }
  window.luckysheet.create({
    container: 'my_spreadsheet',
    showinfobar: true,
    title: sheet.name || 'My Spreadsheet',
    lang: 'en',
    allowEdit: !viewOnly,
    forceCalculation: false,
    showtoolbar: true,
    showsheetbar: true,
    showstatisticBar: true,
    enableAddRow: true,
    enableAddCol: true,
    data: payload,
    hook: {
      workbookCreateAfter: () => {
        try { window.luckysheet.resize(); } catch { /* ignore */ }
      },
    },
  });
  const bump = () => { try { window.luckysheet.resize(); } catch { /* ignore */ } };
  requestAnimationFrame(bump);
  setTimeout(bump, 120);
  setTimeout(bump, 500);
  setTimeout(bump, 1200);
}

export function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!document.getElementById('hp-hit-css')) {
    const s = document.createElement('style');
    s.id = 'hp-hit-css';
    s.textContent = '.hp-hit{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#ecfdf5;color:#047857;margin-left:4px}';
    document.head.appendChild(s);
  }
  seed();
  const t = tab();
  if (t !== 'edit') document.body.classList.remove('ss-editing');
  if (tryPaintFloor(app, t, {
    brand: 'Spreadsheet',
    file: '/spreadsheet.html',
    go: (k) => go(k && k !== 'tree' ? `?tab=${encodeURIComponent(k)}` : ''),
  })) return;
  if (t === 'sheets') return paintSheets(app);
  if (t === 'edit') return paintEdit(app);
  return paintTree(app);
}

export async function bootSpreadsheet() {
  onHubNavigate(paint);
  paint();
  if (!window.__dfSsPop) {
    window.__dfSsPop = true;
    window.addEventListener('popstate', () => paint());
  }
}
