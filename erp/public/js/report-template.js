/**
 * Official ERP report template — every Reports page uses this 5-block layout:
 * Header → KPIs → Charts → Table/detail → Audit footer.
 * Listings (List POS Sales, etc.) stay tables and must not import this.
 */
import { esc } from './ls-rows.js';
import { fmt } from './supabaseClient.js';
import { getAccess } from './rbac.js';
import { dateRange, locOptions } from './report-data.js';

export const REPORT_VERSION = 'RPT-1.0';

const TONE = {
  blue: { bg: '#eff6ff', fg: '#1d4ed8', bar: '#2563eb' },
  green: { bg: '#ecfdf5', fg: '#047857', bar: '#16a34a' },
  amber: { bg: '#fff7ed', fg: '#c2410c', bar: '#ea580c' },
  red: { bg: '#fef2f2', fg: '#b91c1c', bar: '#dc2626' },
  slate: { bg: '#f8fafc', fg: '#334155', bar: '#64748b' },
  teal: { bg: '#f0fdfa', fg: '#0f766e', bar: '#0d9488' },
};

export function reportWho() {
  const a = getAccess() || {};
  return a.fullName || a.name || (a.email || '').split('@')[0] || 'Staff';
}

export function reportEmail() {
  return (getAccess() || {}).email || '';
}

export function ghanaNow() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Accra',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function reportBranch(code) {
  const on = code || new URLSearchParams(location.search).get('loc') || '';
  const hit = locOptions().find((l) => l.code === on);
  return hit?.name || (on ? on : 'All locations');
}

export function reportRangeText() {
  const { from, to } = dateRange();
  const fmtD = (s) => {
    if (!s) return '';
    const d = new Date(s + 'T12:00:00');
    if (Number.isNaN(+d)) return s;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return `${fmtD(from)} – ${fmtD(to)}`;
}

function stripCell(c) {
  return String(c ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function numCell(c) {
  const t = stripCell(c).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function money(n) {
  try { return fmt(n || 0); } catch { return 'GH₵ ' + Number(n || 0).toFixed(2); }
}

export function csvFromTable(cols, rows) {
  const line = (arr) => arr.map((c) => {
    const s = stripCell(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
  return [line(cols), ...rows.map((r) => line(r))].join('\n');
}

export function downloadCsv(filename, cols, rows) {
  const blob = new Blob([csvFromTable(cols, rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'report.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function barChart(items = [], { title = '', h = 220 } = {}) {
  const data = (items || []).slice(0, 10).map((it) => ({
    label: String(it.label || '—'),
    value: Math.max(0, Number(it.value) || 0),
    color: TONE[it.tone || 'blue'].bar,
  }));
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return `<div class="df-rpt-chart"><h3>${esc(title || 'Chart')}</h3>
      <p class="df-rpt-chart-empty">Nothing to chart — values in this range are zero.</p></div>`;
  }
  const w = Math.max(360, data.length * 72);
  const bars = data.map((d, i) => {
    const bh = Math.max(4, (d.value / max) * (h - 64));
    const x = 36 + i * 72;
    const y = h - 36 - bh;
    const tag = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : String(Math.round(d.value));
    return `<rect x="${x}" y="${y}" width="44" height="${bh}" rx="6" fill="${d.color}"/>
      <text x="${x + 22}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">${esc(tag)}</text>
      <text x="${x + 22}" y="${h - 12}" text-anchor="middle" font-size="10" fill="#64748b">${esc(d.label.slice(0, 10))}</text>`;
  }).join('');
  return `<div class="df-rpt-chart">
    ${title ? `<h3>${esc(title)}</h3>` : ''}
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title || 'Bar chart')}">${bars}</svg>
  </div>`;
}

export function donutChart(items = [], { title = '', size = 180 } = {}) {
  const data = (items || []).map((it) => ({
    label: String(it.label || '—'),
    value: Math.max(0, Number(it.value) || 0),
    color: TONE[it.tone || 'blue'].bar,
  })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) {
    return `<div class="df-rpt-chart"><h3>${esc(title || 'Share')}</h3>
      <p class="df-rpt-chart-empty">No share to show — totals are zero in this range.</p></div>`;
  }
  const r = 64;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const rings = data.map((d) => {
    const dash = (d.value / total) * c;
    const el = `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${d.color}" stroke-width="22"
      stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"/>`;
    offset += dash;
    return el;
  }).join('');
  const legend = data.map((d) =>
    `<li><i style="background:${d.color}"></i>${esc(d.label)} <b>${esc(money(d.value))}</b></li>`).join('');
  return `<div class="df-rpt-chart df-rpt-donut">
    ${title ? `<h3>${esc(title)}</h3>` : ''}
    <div class="df-rpt-donut-row">
      <svg width="${size}" height="${size}" viewBox="0 0 180 180">${rings}
        <text x="90" y="86" text-anchor="middle" font-size="11" fill="#64748b">Total</text>
        <text x="90" y="106" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a">${esc(money(total))}</text>
      </svg>
      <ul>${legend}</ul>
    </div>
  </div>`;
}

export function lineChart(items = [], { title = '', h = 200 } = {}) {
  const data = (items || []).map((it) => ({
    label: String(it.label || ''),
    value: Number(it.value) || 0,
  }));
  if (data.length < 2) return barChart(items, { title, h });
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 560;
  const pts = data.map((d, i) => {
    const x = 24 + (i / (data.length - 1)) * (w - 48);
    const y = h - 28 - (d.value / max) * (h - 56);
    return `${x},${y}`;
  }).join(' ');
  return `<div class="df-rpt-chart">
    ${title ? `<h3>${esc(title)}</h3>` : ''}
    <svg viewBox="0 0 ${w} ${h}" role="img">
      <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pts}"/>
      ${data.map((d, i) => {
        const x = 24 + (i / (data.length - 1)) * (w - 48);
        const y = h - 28 - (d.value / max) * (h - 56);
        return `<circle cx="${x}" cy="${y}" r="4" fill="#1d4ed8"/>`;
      }).join('')}
    </svg>
  </div>`;
}

function chartHtml(ch) {
  if (!ch) return '';
  if (ch.type === 'donut' || ch.type === 'pie') return donutChart(ch.items, { title: ch.title });
  if (ch.type === 'line' || ch.type === 'trend') return lineChart(ch.items, { title: ch.title });
  return barChart(ch.items, { title: ch.title });
}

export function inferSeries(cols, rows, { labelIndex = 0 } = {}) {
  let numIdx = -1;
  for (let i = (cols || []).length - 1; i >= 0; i--) {
    if (rows.some((r) => numCell(r[i]) != null)) { numIdx = i; break; }
  }
  if (numIdx < 0) return { total: 0, count: rows.length, items: [] };
  const items = rows.map((r) => ({
    label: stripCell(r[labelIndex]),
    value: numCell(r[numIdx]) || 0,
  })).sort((a, b) => b.value - a.value);
  const total = items.reduce((s, it) => s + it.value, 0);
  return { total, count: rows.length, items, col: cols[numIdx] };
}

export function officialReportHtml(spec = {}) {
  const {
    title = 'Report',
    category = 'Reports',
    status = '',
    statusTone = 'blue',
    filtersHtml = '',
    kpis = [],
    extraHtml = '',
    notes = '',
    generatedBy = reportWho(),
    generatedOn = ghanaNow(),
    branch = reportBranch(),
    range = reportRangeText(),
  } = spec;
  const st = TONE[statusTone] || TONE.blue;
  const kpiCards = (kpis || []).map((k) => {
    const t = TONE[k.tone || 'blue'] || TONE.blue;
    return `<div class="df-rpt-kpi" style="background:${t.bg};color:${t.fg}">
      <span>${esc(k.label)}</span><b>${esc(String(k.value ?? '—'))}</b>
    </div>`;
  }).join('');
  return `
  <article class="df-rpt">
    <header class="df-rpt-id">
      <div class="df-rpt-id-bar"></div>
      <div class="df-rpt-id-main">
        <p class="df-rpt-cat">${esc(category)}</p>
        <h1>${esc(title)}</h1>
        <p class="df-rpt-meta">
          <span><b>Date range</b> ${esc(range)}</span>
          <span><b>Branch</b> ${esc(branch)}</span>
          <span><b>Generated by</b> ${esc(generatedBy)}</span>
          <span><b>Generated on</b> ${esc(generatedOn)}</span>
        </p>
      </div>
      ${status ? `<em class="df-rpt-status" style="background:${st.bg};color:${st.fg}">${esc(status)}</em>` : ''}
    </header>
    ${filtersHtml ? `<div class="df-rpt-filters">${filtersHtml}</div>` : ''}
    ${kpiCards ? `<section class="df-rpt-kpis">${kpiCards}</section>` : ''}
    ${extraHtml || ''}
    ${notes ? `<p class="df-rpt-notes">${notes}</p>` : ''}
    <footer class="df-rpt-foot">
      <span>Generated ${esc(generatedOn)}</span>
      <span>${esc(generatedBy)}${reportEmail() ? ' · ' + esc(reportEmail()) : ''}</span>
      <span>${esc(branch)}</span>
      <span>${REPORT_VERSION}</span>
    </footer>
  </article>`;
}

export function bindOfficialReport(root, { cols, rows, filename, onPrint } = {}) {
  const csv = root.querySelector('#df-rpt-csv');
  if (csv) csv.onclick = () => downloadCsv(filename || 'delkor-report.csv', cols || [], rows || []);
  const pdf = root.querySelector('#df-rpt-pdf');
  if (pdf) pdf.onclick = () => window.print();
  const pr = root.querySelector('#df-rpt-print');
  if (pr) pr.onclick = () => (onPrint ? onPrint() : window.print());
}
