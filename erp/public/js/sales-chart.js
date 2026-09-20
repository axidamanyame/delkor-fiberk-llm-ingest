import { chartLocationName } from './legacy-scope-map.js';

/** Full-width sales line chart with a readable calendar axis. */

const COLORS = ['#38bdf8', '#004EEB', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0d9488', '#db2777'];

function fmtNum(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
  return String(Math.round(v * 100) / 100);
}

function svgToBlob(svg) {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function rasterize(svg, type, cb) {
  const img = new Image();
  const url = URL.createObjectURL(svgToBlob(svg));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width || 1100;
    c.height = img.height || 360;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    c.toBlob((b) => cb(b), type, 0.92);
  };
  img.src = url;
}

function shortLabel(raw, kind) {
  const s = String(raw || '').trim();
  if (kind === 'month') {
    const m = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
    return m ? m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase() : s.replace(/[-–]?\d{4}/g, '').trim();
  }
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (dmy) return dmy[1] + ' ' + dmy[2];
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(iso[3]) + ' ' + months[Number(iso[2]) - 1];
  }
  return s;
}

function tickIndexes(n, innerW) {
  if (n <= 1) return [0];
  const minPx = 72;
  const maxLabels = Math.max(4, Math.floor(innerW / minPx));
  const step = Math.max(1, Math.ceil((n - 1) / Math.max(1, maxLabels - 1)));
  const out = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

function buildSvg({ title, yLabel, labels, series, w = 1100, h = 380, xKind = 'day', markIndex = -1 }) {
  const padL = 72, padR = 24, padT = 18, padB = 52;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const n = Math.max(1, labels.length - 1);
  const innerW = Math.max(120, w - padL - padR);
  const innerH = h - padT - padB;
  const xAt = (i) => padL + (i / n) * innerW;
  const yAt = (v) => padT + innerH - (v / max) * innerH;
  const axisY = padT + innerH;
  const mark = Number.isInteger(markIndex) && markIndex >= 0 && markIndex < labels.length
    ? markIndex
    : -1;
  const slot = labels.length > 1 ? innerW / Math.max(1, labels.length - 1) : innerW;
  const markBand = mark < 0 ? '' : `<rect x="${xAt(mark) - slot / 2}" y="${padT}" width="${Math.max(8, slot)}" height="${innerH}" fill="#dbeafe" opacity=".55"/>`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = yAt(max * t);
    return `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="${t === 0 ? '#94a3b8' : '#e5e7eb'}" stroke-width="${t === 0 ? 1.4 : 1}"/>
      <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="12" font-weight="600" fill="#334155">${fmtNum(max * t)}</text>`;
  }).join('');
  const yLab = `<text transform="translate(18 ${padT + innerH / 2}) rotate(-90)" text-anchor="middle" font-size="12" font-weight="600" fill="#475569">${yLabel}</text>`;
  const ticks = tickIndexes(labels.length, innerW);
  const tickSet = new Set(ticks);
  const xTicks = labels.map((_, i) => {
    const x = xAt(i);
    if (!tickSet.has(i)) return `<line x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY + 4}" stroke="#cbd5e1"/>`;
    return `<line x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY + 8}" stroke="#64748b"/>`;
  }).join('');
  const xLabs = ticks.map((i) => {
    const x = xAt(i);
    const label = shortLabel(labels[i], xKind);
    return `<text x="${x}" y="${axisY + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${label}</text>`;
  }).join('');
  const paths = series.map((s, si) => {
    const color = s.color || COLORS[si % COLORS.length];
    const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${xAt(i)} ${yAt(v)}`).join(' ');
    const dots = s.data.map((v, i) =>
      `<circle class="pt" data-s="${si}" data-i="${i}" cx="${xAt(i)}" cy="${yAt(v)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`
    ).join('');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const legend = series.map((s, si) => {
    const color = s.color || COLORS[si % COLORS.length];
    return `<span class="lg"><i style="background:${color}"></i>${s.name}</span>`;
  }).join('');
  return {
    legend,
    markup: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;background:#fff;font-family:Inter,Arial,sans-serif">
      <rect width="${w}" height="${h}" fill="#fff"/>
      ${markBand}${grid}${yLab}${paths}${xTicks}${xLabs}
    </svg>`,
  };
}

export function bindSalesChart(host, opts) {
  if (!host) return;
  const title = opts.title || 'Sales Last 30 Days';
  const file = (opts.file || title).replace(/\s+/g, '-').toLowerCase();
  host.classList.add('hc-chart');

  let lastW = 0;
  const paint = () => {
    const w = Math.max(640, Math.floor(host.getBoundingClientRect().width || host.clientWidth || 1100));
    const h = host.classList.contains('hc-fs')
      ? Math.max(360, Math.floor((host.clientHeight || 480) - 56))
      : 380;
    if (Math.abs(w - lastW) < 6 && host.querySelector('svg') && !host.classList.contains('hc-fs')) return;
    lastW = w;
    const built = buildSvg({ ...opts, w, h, xKind: opts.xKind || 'day' });
    const open = host.classList.contains('hc-fs');
    host.innerHTML = `
      <div class="hc-head">
        <h3>🛒 ${title}</h3>
        <div class="hc-tools">
          <div class="hc-legend">${built.legend}</div>
          <button type="button" class="hc-burger" title="Chart options">☰</button>
        </div>
      </div>
      <div class="hc-body">${built.markup}</div>
      <div class="hc-tip" hidden></div>`;
    if (open) host.classList.add('hc-fs');
    bindPoints(host, opts);
    bindMenu(host, opts, title, file, paint);
  };

  paint();
  if (typeof ResizeObserver !== 'undefined') {
    let t;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(paint, 80);
    });
    ro.observe(host);
  }
}

function bindPoints(host, opts) {
  const tip = host.querySelector('.hc-tip');
  host.querySelectorAll('.pt').forEach((pt) => {
    pt.addEventListener('mouseenter', (e) => {
      const si = Number(pt.dataset.s), i = Number(pt.dataset.i);
      const s = opts.series[si];
      tip.hidden = false;
      tip.innerHTML = `<b>${opts.labels[i]}</b><br><span style="color:${s.color || COLORS[si]}">●</span> ${s.name}: <b>GHS ${Number(s.data[i] || 0).toLocaleString()}</b>`;
      const r = host.getBoundingClientRect();
      tip.style.left = Math.min(r.width - 180, e.clientX - r.left + 8) + 'px';
      tip.style.top = Math.max(8, e.clientY - r.top - 48) + 'px';
    });
    pt.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

function bindMenu(host, opts, title, file, paint) {
  const burger = host.querySelector('.hc-burger');
  burger.onclick = (e) => {
    e.stopPropagation();
    host.querySelector('.hc-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'hc-menu';
    menu.innerHTML = `
      <button type="button" data-act="fs">View in full screen</button>
      <button type="button" data-act="print">Print chart</button>
      <hr/>
      <button type="button" data-act="png">Download PNG image</button>
      <button type="button" data-act="jpeg">Download JPEG image</button>
      <button type="button" data-act="pdf">Download PDF document</button>
      <button type="button" data-act="svg">Download SVG vector image</button>`;
    host.appendChild(menu);
    const close = () => menu.remove();
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    menu.onclick = (ev) => {
      ev.stopPropagation();
      const act = ev.target.dataset?.act;
      if (!act) return;
      const svgEl = host.querySelector('svg');
      const xml = new XMLSerializer().serializeToString(svgEl);
      if (act === 'fs') {
        host.classList.toggle('hc-fs');
        burger.title = host.classList.contains('hc-fs') ? 'Exit full screen' : 'Chart options';
        paint();
      } else if (act === 'print') {
        const w = window.open('', '_blank', 'width=1100,height=700');
        if (!w) return;
        w.document.write(`<!doctype html><title>${title}</title><body style="margin:24px;font-family:Inter,Arial">${xml}</body>`);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      } else if (act === 'svg') {
        download(file + '.svg', svgToBlob(xml));
      } else if (act === 'png' || act === 'jpeg') {
        rasterize(xml, 'image/' + act, (b) => download(file + '.' + (act === 'jpeg' ? 'jpg' : 'png'), b));
      } else if (act === 'pdf') {
        const w = window.open('', '_blank', 'width=1100,height=700');
        if (!w) return;
        w.document.write(`<!doctype html><title>${title}</title>
          <style>@page{size:A4 landscape;margin:12mm}body{margin:0;font-family:Inter,Arial}</style>
          <h2 style="padding:12px 24px 0">${title}</h2>${xml}
          <script>onload=()=>setTimeout(()=>print(),200)<` + `/script>`);
        w.document.close();
      }
      close();
    };
  };
}

export function seriesByLocation(rows, days, liveSale, dateOf) {
  const mapped = rows.map((r) => ({ ...r, _loc: chartLocationName(r) }));
  const names = [...new Set(mapped.filter(liveSale).map((r) => r._loc))].sort();
  const keys = names.length ? names : ['All locations'];
  return keys.map((name, i) => ({
    name,
    color: COLORS[i % COLORS.length],
    data: days.map((k) => mapped.filter(liveSale)
      .filter((s) => dateOf(s) === k)
      .filter((s) => name === 'All locations' || s._loc === name)
      .reduce((a, s) => a + Number(s.total_amount || s.final_total || s.grand_total || s.total || 0), 0)),
  }));
}

const SUB_LINE = [
  { code: 'axidigetek', name: 'Axidigetek', color: '#004EEB' },
  { code: 'bnpl', name: 'BuyNowPaysLater', color: '#16a34a' },
  { code: 'delkor', name: 'Delkor Logistics', color: '#0d9488' },
  { code: 'fiberk', name: 'Fiberk', color: '#38bdf8' },
];

function aliasSub(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'buynowpayslater' || c === 'buy-now-pays-later') return 'bnpl';
  if (c === 'delkor-logistics') return 'delkor';
  if (c === 'axidigetek' || c === 'fiberk' || c === 'bnpl' || c === 'delkor' || c === 'ops') return c;
  return c;
}

/** One line per live subsidiary. Used when the master is All Subsidiaries. */
export function seriesBySubsidiary(rows, keys, liveSale, keyOf) {
  return SUB_LINE.map((s) => ({
    name: s.name,
    color: s.color,
    data: keys.map((k) => rows.filter(liveSale)
      .filter((r) => keyOf(r) === k)
      .filter((r) => aliasSub(r.subsidiary_code || r._sub) === s.code)
      .reduce((a, r) => a + Number(r.total_amount || r.final_total || r.grand_total || r.total || 0), 0)),
  }));
}

export { COLORS, SUB_LINE };

