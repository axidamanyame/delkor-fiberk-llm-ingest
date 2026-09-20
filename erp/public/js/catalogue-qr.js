/**
 * Catalogue QR — Delkor-Fiberk ERP layout: generate, stock visibility, WhatsApp order fields.
 */
import { getActiveSubsidiary } from './supabaseClient.js';
import { BUSINESS_LOCATIONS } from './scope.js';
import { esc } from './ls-rows.js';
import { onHubNavigate } from './hub-kit.js';

const KEY = 'df_catalogue_qr';
const WA_FIELDS = [
  { id: 'name', label: 'Your Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'phone', label: 'Phone Number' },
];

function defaults() {
  const sub = getActiveSubsidiary();
  return {
    location: '',
    color: '#000000',
    title: sub?.short || 'Delkor-Fiberk',
    subtitle: 'Product Catalogue',
    showLogo: true,
    outOfStock: 'show',
    waEnabled: true,
    waNumber: '0244112233',
    fields: {
      name: 'required',
      email: 'required',
      phone: 'required',
    },
  };
}

export function loadQrSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...defaults(), ...raw, fields: { ...defaults().fields, ...(raw.fields || {}) } };
  } catch { /* ignore */ }
  return defaults();
}

function saveQrSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function locOptions(selected) {
  return BUSINESS_LOCATIONS.map((l) =>
    `<option value="${esc(l.code)}" ${l.code === selected ? 'selected' : ''}>${esc(l.name)}</option>`
  ).join('');
}

function fieldRow(id, label, mode) {
  const cell = (val) =>
    `<td style="text-align:center"><input type="radio" name="f-${id}" value="${val}" ${mode === val ? 'checked' : ''} /></td>`;
  return `<tr><td>${esc(label)}</td>${cell('required')}${cell('optional')}${cell('remove')}</tr>`;
}

function catalogueUrl(loc) {
  const u = new URL('/catalogue-view.html', location.origin);
  u.searchParams.set('loc', loc);
  return u.toString();
}

async function composeQr({ text, color, title, subtitle, logo }) {
  const hex = String(color || '#000000').replace('#', '').replace(/[^0-9a-f]/gi, '').padEnd(6, '0');
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=${hex}&bgcolor=ffffff&data=${encodeURIComponent(text)}`;
  const qr = new Image();
  qr.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { qr.onload = res; qr.onerror = rej; qr.src = src; });
  const header = (title ? 34 : 0) + (subtitle ? 20 : 0) + 18;
  const out = document.createElement('canvas');
  out.width = 280;
  out.height = 240 + header + 20 + (logo ? 28 : 0);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.textAlign = 'center';
  let y = 26;
  if (title) {
    ctx.fillStyle = '#004284';
    ctx.font = 'bold 18px Inter, Arial';
    ctx.fillText(title, out.width / 2, y);
    y += 22;
  }
  if (subtitle) {
    ctx.fillStyle = '#4F4F4F';
    ctx.font = '14px Inter, Arial';
    ctx.fillText(subtitle, out.width / 2, y);
  }
  ctx.drawImage(qr, (out.width - 240) / 2, header, 240, 240);
  if (logo) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = logo; });
      ctx.drawImage(img, (out.width - 72) / 2, header + 240 + 4, 72, 22);
    } catch { /* logo optional */ }
  }
  return out;
}

export async function bootCatalogueQr() {
  const app = document.getElementById('app');
  if (!app) return;
  let s = loadQrSettings();
  let canvas = null;

  function readForm() {
    s = {
      ...s,
      location: app.querySelector('#qr-loc').value,
      color: app.querySelector('#qr-color').value.trim() || '#000000',
      title: app.querySelector('#qr-title').value,
      subtitle: app.querySelector('#qr-sub').value,
      showLogo: app.querySelector('#qr-logo').checked,
      outOfStock: app.querySelector('input[name=oos]:checked')?.value || 'show',
      waEnabled: app.querySelector('#wa-on').checked,
      waNumber: app.querySelector('#wa-no').value.trim(),
      fields: Object.fromEntries(WA_FIELDS.map((f) => [f.id, app.querySelector(`input[name=f-${f.id}]:checked`)?.value || 'required'])),
    };
    saveQrSettings(s);
    return s;
  }

  function previewHtml() {
    if (!canvas) {
      return `<div class="qr-preview-empty"></div>`;
    }
    const link = catalogueUrl(s.location);
    return `<div class="qr-preview-card">
      <img id="qr-img" alt="Catalogue QR" />
      <p><a id="qr-link" href="${esc(link)}" target="_blank" rel="noopener">Link</a></p>
      <button type="button" class="ult-btn ult-btn-success" id="qr-dl">Download Image</button>
    </div>`;
  }

  function paint() {
    app.innerHTML = `
      <h1>Catalogue QR</h1>
      <div class="qr-top">
        <div class="ult-card">
          <div class="ult-field"><label>Business Location:</label>
            <select id="qr-loc"><option value="">Please Select</option>${locOptions(s.location)}</select>
          </div>
          <div class="ult-field"><label>Qr code color:</label>
            <input id="qr-color" value="${esc(s.color)}" /></div>
          <div class="ult-field"><label>Title:</label>
            <input id="qr-title" value="${esc(s.title)}" /></div>
          <div class="ult-field"><label>Subtitle:</label>
            <input id="qr-sub" value="${esc(s.subtitle)}" /></div>
          <label class="qr-check"><input type="checkbox" id="qr-logo" ${s.showLogo ? 'checked' : ''} /> Show business logo on qrcode</label>
          <div class="qr-gen-row">
            <button type="button" class="ult-btn ult-btn-primary" id="qr-gen">Generate QR</button>
            <div class="qr-help">
              <strong>Instruction:</strong>
              <ol>
                <li>Select business location and QR code color</li>
                <li>Choose title, subtitle and to show logo or not</li>
                <li>Click on generate QR code</li>
              </ol>
            </div>
          </div>
        </div>
        <div class="ult-card qr-right" id="qr-box">${previewHtml()}</div>
      </div>
      <div class="ult-card" style="max-width:560px">
        <h2 style="margin:0 0 10px;font-size:16px">Settings:</h2>
        <p style="margin:0 0 8px;font-weight:600">Out of stock products:</p>
        <label class="qr-check"><input type="radio" name="oos" value="show" ${s.outOfStock === 'show' ? 'checked' : ''} /> Show</label>
        <label class="qr-check"><input type="radio" name="oos" value="hide" ${s.outOfStock === 'hide' ? 'checked' : ''} /> Hide</label>
        <div style="margin-top:12px"><button type="button" class="ult-btn ult-btn-primary" id="oos-save">Save</button></div>
      </div>
      <div class="ult-card">
        <div class="qr-wa">
          <div>
            <h2 style="margin:0 0 10px;font-size:16px">WhatsApp Order Settings:</h2>
            <label class="qr-check"><input type="checkbox" id="wa-on" ${s.waEnabled ? 'checked' : ''} /> Enable WhatsApp ordering</label>
            <div class="ult-field" style="margin-top:10px"><label>Order Receiving Whatsapp Number:</label>
              <input id="wa-no" value="${esc(s.waNumber)}" /></div>
            <p style="font-weight:600;margin:12px 0 6px">Customer Details Fields:</p>
            <p class="ult-muted" style="margin:0 0 8px">Configure which customer details to ask in the order form, and whether they are required or optional.</p>
            <div class="ult-table-wrap"><table class="ult-table">
              <thead><tr><th>Field</th><th>Required</th><th>Optional</th><th>Remove</th></tr></thead>
              <tbody>${WA_FIELDS.map((f) => fieldRow(f.id, f.label, s.fields[f.id])).join('')}</tbody>
            </table></div>
            <div style="margin-top:12px"><button type="button" class="ult-btn ult-btn-primary" id="wa-save">Save</button></div>
          </div>
          <div class="qr-help">
            <strong>Instruction:</strong>
            <ol>
              <li>On enabling WhatsApp ordering, customers will be able to order from the URL that is sent to them.</li>
              <li>Order details will be sent to the order-receiving WhatsApp number.</li>
              <li>Orders will have Order ID, products, quantity, customer name/contact number & address, as well as transaction details.</li>
            </ol>
          </div>
        </div>
      </div>`;

    const attachPreview = () => {
      const img = app.querySelector('#qr-img');
      if (img && canvas) img.src = canvas.toDataURL('image/png');
      app.querySelector('#qr-dl')?.addEventListener('click', () => {
        if (!canvas) return;
        const a = document.createElement('a');
        a.download = 'qrcode.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
      });
    };
    attachPreview();

    app.querySelector('#qr-loc').addEventListener('change', () => {
      const loc = BUSINESS_LOCATIONS.find((l) => l.code === app.querySelector('#qr-loc').value);
      if (loc) app.querySelector('#qr-title').value = loc.name;
    });
    app.querySelector('#qr-gen').onclick = async () => {
      readForm();
      if (!s.location) return alert('Select Business Location');
      try {
        canvas = await composeQr({
          text: catalogueUrl(s.location),
          color: s.color,
          title: s.title,
          subtitle: s.subtitle,
          logo: s.showLogo ? '/brand/delkor-fiberk-letterhead.png' : '',
        });
        app.querySelector('#qr-box').innerHTML = previewHtml();
        attachPreview();
      } catch (err) {
        alert(err?.message || 'Could not generate QR');
      }
    };
    app.querySelector('#oos-save').onclick = () => { readForm(); alert('Settings saved'); };
    app.querySelector('#wa-save').onclick = () => { readForm(); alert('WhatsApp settings saved'); };
  }

  onHubNavigate(paint);
  paint();
}