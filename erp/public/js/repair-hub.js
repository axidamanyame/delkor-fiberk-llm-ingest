/**
 * Repair color-coded module — stays on one page. Job sheets have full CRUD.
 * Header Repair (register) is a different path; this hub never opens the till.
 */
import { supabase, fmt } from './supabaseClient.js';
import { esc, loadRows, actMenu, deleteRow, saveRow, readLs, writeLs, isTombstoned, uid } from './ls-rows.js';
import { isDemoRecord } from './catalog-seed.js';
import { hubTabs, bindHubTabs, goFile, svgIco, maybePaintNest, resolveHubTab, nestsFor, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import { bindTable } from './home-tables.js';
import { confirmAction, ackResult } from './confirm-action.js';

const FILE = '/repair.html';
const JOB_KEY = 'df_repair_jobs';
const INV_KEY = 'df_repair_invoices';
const BRAND_KEY = 'df_repair_brands';
const FLOW = ['pending', 'in_progress', 'completed', 'delivered'];
const TABS = [
  { key: 'dash', label: 'Repair' },
  { key: 'jobs', label: 'Job Sheets' },
  { key: 'add', label: 'Add job sheet' },
  { key: 'inv', label: 'List Invoices' },
  { key: 'addinv', label: 'Add Invoice' },
  { key: 'brands', label: 'Brands' },
];
const BRAND = `${svgIco('spark') || '🔧'} Repair`;

function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'dash';
  return resolveHubTab(t, TABS, 'dash', nestsFor(FILE));
}
function go(t) { goFile(FILE, (!t || t === 'dash') ? '' : t); paint(); }
function nav(on) { return floorNav(BRAND, on, 'dash', FILE); }

function live(row, table, key) {
  if (!row || isDemoRecord(row)) return false;
  if (isTombstoned(table, row) || isTombstoned(key, row)) return false;
  return true;
}

function jobNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return 'JS-' + ymd + '-' + String(Math.floor(Math.random() * 900 + 100));
}
function invNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return 'RI-' + ymd + '-' + String(Math.floor(Math.random() * 900 + 100));
}

let _cache = null;
async function loadState() {
  const [jobsLs, invLs, brandLs] = [
    readLs(JOB_KEY, []),
    readLs(INV_KEY, []),
    readLs(BRAND_KEY, []),
  ];
  let remoteJobs = [], remoteInv = [], remoteBrands = [];
  try {
    const [j, i, b] = await Promise.all([
      supabase.from('repair_jobs').select('*, repair_job_parts(*)').order('created_at', { ascending: false }).limit(400),
      supabase.from('repair_invoices').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('repair_brands').select('*').order('name').limit(400),
    ]);
    remoteJobs = j.data || [];
    remoteInv = i.data || [];
    remoteBrands = b.data || [];
  } catch { /* local only */ }
  const merge = (table, key, a, b) => {
    const map = new Map();
    [...a, ...b].forEach((r) => {
      if (!live(r, table, key)) return;
      const id = String(r.id || r.job_number || r.invoice_no || r.name || '');
      if (!id) return;
      map.set(id, { ...(map.get(id) || {}), ...r });
    });
    return [...map.values()];
  };
  const state = {
    jobs: merge('repair_jobs', JOB_KEY, jobsLs, remoteJobs),
    invoices: merge('repair_invoices', INV_KEY, invLs, remoteInv),
    brands: merge('repair_brands', BRAND_KEY, brandLs, remoteBrands),
  };
  writeLs(JOB_KEY, state.jobs);
  writeLs(INV_KEY, state.invoices);
  writeLs(BRAND_KEY, state.brands);
  _cache = state;
  return state;
}

function barHtml() {
  return `<div class="bar">
    <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
    <div class="grow"></div>
    <button type="button" data-exp="csv">Export CSV</button>
    <button type="button" data-exp="xls">Export Excel</button>
    <button type="button" data-exp="print">Print</button>
    <input data-tbl-search placeholder="Search …" />
  </div>
  <div class="tbl-bulk">
    <span class="tbl-bulk-count" data-bulk-count>0 selected</span>
    <button type="button" data-bulk-all>Select all</button>
    <button type="button" data-bulk-invert>Invert</button>
    <button type="button" class="tbl-bulk-del" data-bulk-del>Delete selected</button>
    <button type="button" data-bulk-clear>Clear</button>
  </div>`;
}

function wrapTable(key, title, addHref, addLabel, thead, body, cols) {
  return `<div class="home-card" data-tbl="${key}">
    <div class="head" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <h2 style="margin:0;font-size:16px">${esc(title)}</h2>
      ${addHref ? `<a class="ult-btn ult-btn-primary" href="${addHref}" data-htab="${addHref.includes('tab=add') ? (addHref.includes('addinv') ? 'addinv' : 'add') : ''}">${esc(addLabel)}</a>` : ''}
    </div>
    ${barHtml()}
    <div class="ult-table-wrap"><table class="ult-table">
      <thead>${thead}</thead>
      <tbody>${body || `<tr data-dummy="1"><td colspan="${cols}">No data available in table</td></tr>`}</tbody>
    </table></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
  </div>`;
}

function countBy(jobs, key) {
  const m = new Map();
  jobs.forEach((j) => {
    const k = String(j[key] || '').trim();
    if (!k) return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function staffCounts(jobs) {
  const m = new Map();
  jobs.forEach((j) => {
    const k = String(j.assigned_to || j.service_staff || '').trim() || 'Unassigned';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function trendChart(id, title, series) {
  const max = Math.max(1, ...series.map(([, n]) => n));
  const w = 720, h = 200, padL = 42, padB = 36, padT = 16, padR = 16;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(series.length, 1);
  const gap = 12;
  const barW = Math.max(18, Math.min(48, (innerW - gap * (n + 1)) / n));
  const bars = series.map(([label, val], i) => {
    const bh = (val / max) * innerH;
    const x = padL + gap + i * (barW + gap);
    const y = padT + innerH - bh;
    return `<rect class="rep-bar" data-l="${esc(label)}" data-v="${val}" x="${x}" y="${y}" width="${barW}" height="${Math.max(bh, 0)}" fill="#7dd3fc" rx="2"/>
      <text x="${x + barW / 2}" y="${h - 12}" text-anchor="middle" font-size="10" fill="#64748b">${esc(String(label).slice(0, 14))}</text>`;
  }).join('');
  return `<div class="rep-card" data-chart="${esc(id)}">
    <h3>${esc(title)}</h3>
    <div class="rep-chart">
      <div class="rep-chart-legend">
        <i></i> Total unit repaired
        <button type="button" class="rep-hc-btn" data-hc aria-label="Chart menu">☰</button>
        <div class="rep-hc-menu">
          <button type="button" data-hc-act="full">View in full screen</button>
          <button type="button" data-hc-act="print">Print chart</button>
          <hr />
          <button type="button" data-hc-act="png">Download PNG image</button>
          <button type="button" data-hc-act="jpg">Download JPEG image</button>
          <button type="button" data-hc-act="pdf">Download PDF document</button>
          <button type="button" data-hc-act="svg">Download SVG vector image</button>
        </div>
      </div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(title)}">
        <text transform="translate(14 ${h / 2}) rotate(-90)" text-anchor="middle" font-size="11" fill="#94a3b8">Total unit repaired</text>
        <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#e2e8f0"/>
        ${bars}
      </svg>
    </div>
  </div>`;
}

function bindChartMenus(app) {
  app.querySelectorAll('[data-hc]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      app.querySelectorAll('.rep-hc-menu.open').forEach((m) => { if (m !== menu) m.classList.remove('open'); });
      menu?.classList.toggle('open');
    };
  });
  app.querySelectorAll('[data-hc-act]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const card = b.closest('[data-chart]');
      const svg = card?.querySelector('svg');
      const act = b.dataset.hcAct;
      b.closest('.rep-hc-menu')?.classList.remove('open');
      if (!svg) return;
      if (act === 'full') {
        if (card.requestFullscreen) card.requestFullscreen();
        else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
        return;
      }
      if (act === 'print') {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>Chart</title></head><body>${svg.outerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
        return;
      }
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      if (act === 'svg') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (card.dataset.chart || 'chart') + '.svg';
        a.click();
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1440;
        canvas.height = 440;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (act === 'pdf') {
          const win = window.open('', '_blank');
          if (!win) return;
          win.document.write(`<html><body style="margin:0"><img src="${canvas.toDataURL('image/png')}" style="width:100%"></body></html>`);
          win.document.close();
          win.focus();
          win.print();
          return;
        }
        const a = document.createElement('a');
        a.href = canvas.toDataURL(act === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        a.download = (card.dataset.chart || 'chart') + (act === 'jpg' ? '.jpg' : '.png');
        a.click();
      };
      img.src = URL.createObjectURL(blob);
    };
  });
  document.addEventListener('click', () => {
    app.querySelectorAll('.rep-hc-menu.open').forEach((m) => m.classList.remove('open'));
  }, { once: true });
}

function paintDash(app, s) {
  const jobs = s.jobs || [];
  const staff = staffCounts(jobs);
  const staffBody = staff.map(([name, n], i) =>
    `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${n}</td></tr>`).join('');
  app.innerHTML = `
    ${nav('dash')}
    <h1 class="hub-h1">Repair <span>Dashboard</span></h1>
    <div class="rep-card">
      <h3>Job sheets by status</h3>
      ${jobs.length ? `<div class="stat-grid">
        <div class="stat">Pending<b>${jobs.filter((r) => (r.status || 'pending') === 'pending').length}</b></div>
        <div class="stat">In progress<b>${jobs.filter((r) => r.status === 'in_progress').length}</b></div>
        <div class="stat">Completed<b>${jobs.filter((r) => r.status === 'completed').length}</b></div>
        <div class="stat">Delivered<b>${jobs.filter((r) => r.status === 'delivered').length}</b></div>
      </div>` : '<div class="rep-empty">No data found, please add repair!</div>'}
    </div>
    <div class="rep-card">
      <h3>Job sheets by assigned staff</h3>
      <div class="ult-table-wrap"><table class="rep-staff">
        <thead><tr><th>#</th><th>Assigned staff</th><th>Total job sheets</th></tr></thead>
        <tbody>${staffBody || ''}</tbody>
      </table></div>
    </div>
    ${trendChart('brands', 'Top Trending Brands', countBy(jobs, 'brand'))}
    ${trendChart('devices', 'Top Trending Devices', countBy(jobs, 'device'))}
    ${trendChart('models', 'Top Trending Device Models', countBy(jobs, 'device_model'))}`;
  bindChartMenus(app);
}

function paintJobs(app, s) {
  const rows = s.jobs.map((r) => {
    const parts = (r.repair_job_parts || []).reduce((n, p) => n + Number(p.quantity || 0), 0);
    return `<tr data-id="${esc(r.id)}">
      <td>${actMenu(r.id, [
        { href: `${FILE}?tab=add&id=${encodeURIComponent(r.id)}&view=1`, label: 'View' },
        { href: `${FILE}?tab=add&id=${encodeURIComponent(r.id)}`, label: 'Edit' },
        { act: 'next', label: 'Next status' },
        { act: 'del', label: 'Delete' },
      ])}</td>
      <td>${esc(r.job_number || r.job_no || '')}</td>
      <td>${esc(String(r.created_at || r.job_date || '').slice(0, 16).replace('T', ' '))}</td>
      <td>${esc(r.customer_name || 'Walk-In Customer')}</td>
      <td>${esc([r.brand, r.device, r.device_model].filter(Boolean).join(' · '))}</td>
      <td>${esc(r.serial_number || '')}</td>
      <td>${parts}</td>
      <td>${esc(r.status || 'pending')}</td>
    </tr>`;
  }).join('');
  app.innerHTML = `
    ${nav('jobs')}
    ${wrapTable('rep-jobs', 'Job Sheets', `${FILE}?tab=add`, '+ Add job sheet',
      '<tr><th data-nosort="1">Action</th><th>Job</th><th>When</th><th>Customer</th><th>Device</th><th>Serial</th><th>Parts</th><th>Status</th></tr>',
      rows, 8)}`;
}

function jobForm(row, viewOnly) {
  const r = row || {};
  const ro = viewOnly ? 'readonly' : '';
  const dis = viewOnly ? 'disabled' : '';
  return `<form id="rep-form" class="doc" style="max-width:720px">
    <div class="doc-grid">
      <label>Customer<input name="customer_name" ${ro} value="${esc(r.customer_name || '')}" required /></label>
      <label>Phone<input name="phone" ${ro} value="${esc(r.phone || '')}" /></label>
      <label>Brand<input name="brand" ${ro} value="${esc(r.brand || '')}" /></label>
      <label>Device<input name="device" ${ro} value="${esc(r.device || '')}" required /></label>
      <label>Model<input name="device_model" ${ro} value="${esc(r.device_model || '')}" /></label>
      <label>Serial<input name="serial_number" ${ro} value="${esc(r.serial_number || '')}" /></label>
      <label>Status<select name="status" ${dis}>
        ${FLOW.map((st) => `<option value="${st}" ${((r.status || 'pending') === st) ? 'selected' : ''}>${st.replace('_', ' ')}</option>`).join('')}
      </select></label>
      <label>Assigned to<input name="assigned_to" ${ro} value="${esc(r.assigned_to || '')}" /></label>
    </div>
    <label>Problem<textarea name="problem" ${ro} rows="3">${esc(r.problem || '')}</textarea></label>
    ${viewOnly ? `<p><a class="ult-btn ult-btn-outline" href="${FILE}?tab=jobs">Back</a>
      <a class="ult-btn ult-btn-primary" href="${FILE}?tab=add&id=${esc(r.id)}">Edit</a></p>`
      : `<p><button class="ult-btn ult-btn-primary" type="submit">${r.id ? 'Save job sheet' : 'Create job sheet'}</button>
         <a class="ult-btn ult-btn-outline" href="${FILE}?tab=jobs">Cancel</a></p>`}
  </form>`;
}

function paintAdd(app, s) {
  const q = new URLSearchParams(location.search);
  const id = q.get('id');
  const viewOnly = q.get('view') === '1';
  const row = id ? s.jobs.find((j) => String(j.id) === String(id)) : null;
  app.innerHTML = `
    ${nav('add')}
    <div class="ult-card">${jobForm(row, viewOnly)}</div>`;
  const form = document.getElementById('rep-form');
  if (!form || viewOnly) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      id: row?.id || uid(),
      job_number: row?.job_number || jobNo(),
      customer_name: fd.get('customer_name'),
      phone: fd.get('phone'),
      brand: fd.get('brand'),
      device: fd.get('device'),
      device_model: fd.get('device_model'),
      serial_number: fd.get('serial_number'),
      status: fd.get('status') || 'pending',
      assigned_to: fd.get('assigned_to'),
      problem: fd.get('problem'),
      origin: 'repair_module',
    };
    const r = await saveRow('repair_jobs', JOB_KEY, payload);
    if (r?.error) { ackResult(false, r.error.message || 'Could not save.'); return; }
    ackResult(true, payload.job_number + ' saved.');
    _cache = null;
    goFile(FILE, 'jobs');
    await loadState();
    paint();
  };
}

function paintInv(app, s) {
  const rows = s.invoices.map((r) => `<tr data-id="${esc(r.id)}">
    <td>${actMenu(r.id, [
      { href: `${FILE}?tab=addinv&id=${encodeURIComponent(r.id)}&view=1`, label: 'View' },
      { href: `${FILE}?tab=addinv&id=${encodeURIComponent(r.id)}`, label: 'Edit' },
      { act: 'del', label: 'Delete' },
    ])}</td>
    <td>${esc(r.invoice_no || r.invoice_number || '')}</td>
    <td>${esc(r.job_number || '')}</td>
    <td>${esc(r.customer_name || '')}</td>
    <td>${esc(r.device || '')}</td>
    <td>${esc(r.status || '')}</td>
    <td>${fmt(r.total || r.total_amount || 0)}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('inv')}
    ${wrapTable('rep-inv', 'Repair invoices', `${FILE}?tab=addinv`, '+ Add invoice',
      '<tr><th data-nosort="1">Action</th><th>Invoice</th><th>Job</th><th>Customer</th><th>Device</th><th>Status</th><th>Total</th></tr>',
      rows, 7)}`;
}

function paintAddInv(app, s) {
  const q = new URLSearchParams(location.search);
  const id = q.get('id');
  const viewOnly = q.get('view') === '1';
  const row = id ? s.invoices.find((j) => String(j.id) === String(id)) : null;
  const jobs = s.jobs.filter((j) => j.status === 'completed' || j.status === 'delivered' || (row && row.job_id === j.id));
  app.innerHTML = `
    ${nav('addinv')}
    <div class="ult-card">
      <form id="inv-form" class="doc" style="max-width:720px">
        <label>Job sheet
          <select name="job_id" ${viewOnly ? 'disabled' : ''} required>
            <option value="">Select a job</option>
            ${jobs.map((j) => `<option value="${esc(j.id)}" ${String(row?.job_id) === String(j.id) ? 'selected' : ''}>${esc(j.job_number || j.id)} · ${esc(j.customer_name || '')}</option>`).join('')}
          </select>
        </label>
        <label>Total (GH¢)<input name="total" type="number" step="0.01" ${viewOnly ? 'readonly' : ''} value="${esc(row?.total || row?.total_amount || '')}" /></label>
        <label>Status<select name="status" ${viewOnly ? 'disabled' : ''}>
          ${['draft', 'unpaid', 'paid'].map((st) => `<option ${((row?.status || 'unpaid') === st) ? 'selected' : ''}>${st}</option>`).join('')}
        </select></label>
        <label>Note<textarea name="note" ${viewOnly ? 'readonly' : ''} rows="2">${esc(row?.note || '')}</textarea></label>
        ${viewOnly ? `<p><a class="ult-btn ult-btn-outline" href="${FILE}?tab=inv">Back</a></p>`
          : `<p><button class="ult-btn ult-btn-primary" type="submit">${row ? 'Save invoice' : 'Create invoice'}</button>
             <a class="ult-btn ult-btn-outline" href="${FILE}?tab=inv">Cancel</a></p>`}
      </form>
    </div>`;
  const form = document.getElementById('inv-form');
  if (!form || viewOnly) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const job = s.jobs.find((j) => String(j.id) === String(fd.get('job_id')));
    const payload = {
      id: row?.id || uid(),
      invoice_no: row?.invoice_no || invNo(),
      job_id: job?.id || '',
      job_number: job?.job_number || '',
      customer_name: job?.customer_name || '',
      device: [job?.brand, job?.device, job?.device_model].filter(Boolean).join(' · '),
      total: Number(fd.get('total') || 0),
      status: fd.get('status') || 'unpaid',
      note: fd.get('note') || '',
    };
    const r = await saveRow('repair_invoices', INV_KEY, payload);
    if (r?.error) { ackResult(false, r.error.message || 'Could not save.'); return; }
    ackResult(true, payload.invoice_no + ' saved.');
    _cache = null;
    goFile(FILE, 'inv');
    await loadState();
    paint();
  };
}

function paintBrands(app, s) {
  const rows = s.brands.map((b) => `<tr data-id="${esc(b.id)}">
    <td>${actMenu(b.id, [
      { act: 'del', label: 'Delete' },
    ])}</td>
    <td>${esc(b.name)}</td>
  </tr>`).join('');
  app.innerHTML = `
    ${nav('brands')}
    ${wrapTable('rep-brands', 'Brands', '', '',
      '<tr><th data-nosort="1">Action</th><th>Brand</th></tr>',
      rows, 2)}
    <div class="ult-card" style="margin-top:12px">
      <form id="brand-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label>New brand<input name="name" required placeholder="Brand name" /></label>
        <button class="ult-btn ult-btn-primary" type="submit">Save brand</button>
        <a class="ult-btn ult-btn-outline" href="/repair-catalog.html">Full catalog</a>
      </form>
    </div>`;
  document.getElementById('brand-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    await saveRow('repair_brands', BRAND_KEY, { id: uid(), name });
    ackResult(true, 'Brand saved.');
    _cache = null;
    await loadState();
    paint();
  });
}

function paintSettings(app) {
  app.innerHTML = `
    ${nav('settings')}
    <div class="ult-card">
      <h3>Statuses</h3>
      <p>Used on job sheets and the dashboard counts.</p>
      <ol><li>pending</li><li>in progress</li><li>completed</li><li>delivered</li></ol>
      <p class="sub">Header Repair (top right) always goes through the cash register. This left-menu Repair never does.</p>
    </div>`;
}

const STORE = {
  'rep-jobs': { table: 'repair_jobs', key: JOB_KEY },
  'rep-inv': { table: 'repair_invoices', key: INV_KEY },
  'rep-brands': { table: 'repair_brands', key: BRAND_KEY },
};

async function reload() {
  _cache = null;
  await loadState();
  await paint();
}

function bindCrud(app, s) {
  app.querySelectorAll('[data-tbl]').forEach((el) => {
    const spec = STORE[el.dataset.tbl] || {};
    bindTable(el, {
      title: el.dataset.tbl,
      storageKey: el.dataset.tbl,
      table: spec.table,
      key: spec.key,
      onDone: reload,
    });
  });
  app.querySelectorAll('[data-act="del"]').forEach((b) => {
    b.onclick = async (e) => {
      e.preventDefault();
      const id = b.dataset.id;
      const spec = STORE[b.closest('[data-tbl]')?.dataset.tbl] || {};
      if (!id) return;
      if (!(await confirmAction('Delete this record?', 'This cannot be undone.'))) return;
      const r = await deleteRow(spec.table, spec.key, id);
      if (r?.cancelled) return;
      ackResult(true, 'Deleted.');
      reload();
    };
  });
  app.querySelectorAll('[data-act="next"]').forEach((b) => {
    b.onclick = async (e) => {
      e.preventDefault();
      const row = s.jobs.find((j) => String(j.id) === String(b.dataset.id));
      if (!row) return;
      const i = Math.max(0, FLOW.indexOf(row.status || 'pending'));
      const next = FLOW[Math.min(FLOW.length - 1, i + 1)];
      await saveRow('repair_jobs', JOB_KEY, { ...row, status: next, completed_on: next === 'completed' ? new Date().toISOString().slice(0, 10) : row.completed_on });
      ackResult(true, 'Status → ' + next.replace('_', ' '));
      reload();
    };
  });
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  const s = _cache || await loadState();
  const on = tab();
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'dash', file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (on === 'jobs') paintJobs(app, s);
  else if (on === 'add') paintAdd(app, s);
  else if (on === 'inv') paintInv(app, s);
  else if (on === 'addinv') paintAddInv(app, s);
  else if (on === 'brands') paintBrands(app, s);
  else if (on === 'settings' || on === 'setting') bounceModuleSettings();
  else paintDash(app, s);
  bindHubTabs(app, (k) => { _cache = s; go(k); });
  bindCrud(app, s);
}

export async function bootRepairHub() {
  onHubNavigate(paint);
  const hash = (location.hash || '').replace('#', '');
  if (hash && TABS.some((t) => t.key === hash)) {
    history.replaceState({ spa: FILE + (hash === 'dash' ? '' : '?tab=' + hash) }, '', FILE + (hash === 'dash' ? '' : '?tab=' + hash));
  }
  await loadState();
  await paint();
  window.addEventListener('popstate', () => paint());
}
