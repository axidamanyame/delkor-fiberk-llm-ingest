/** Full-page Add Sale / Draft / Quotation — Delkor-Fiberk ERP layout + subsidiary/location. */
import { supabase, fmt } from './supabaseClient.js';
import { stampScope, subsidiarySelect, locationSelect } from './entity-scope.js';
import { confirmAction } from './confirm-action.js';
import { filterBySidebar } from './scope.js';
import { readLs } from './ls-rows.js';
import { ensureFiberkSales, findFiberkSale, paintSellDetails } from './fiberk-sales.js';
import { findSale } from './sale-lookup.js';

const SPECS = {
  sale: { title: 'Sale', table: 'sales_orders', status: 'final', list: '/sales-orders.html' },
  draft: { title: 'Draft', table: 'sales_orders', status: 'draft', list: '/drafts.html' },
  quotation: { title: 'Quotation', table: 'quotations', status: 'quotation', list: '/quotations.html' },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
}

function lineNet(l) {
  const qty = Number(l.qty || 0);
  const price = Number(l.unit_price || 0);
  const disc = Number(l.discount || 0);
  const dtype = l.discount_type || 'percentage';
  const base = qty * price;
  const after = dtype === 'fixed' ? Math.max(0, base - disc) : base * (1 - disc / 100);
  const tax = after * (Number(l.tax_rate || 0) / 100);
  return { base, after, tax, inc: after + tax };
}

export async function mountSellDoc(kind) {
  const spec = SPECS[kind] || SPECS.sale;
  const app = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');
  const readOnly = new URLSearchParams(location.search).get('view') === '1';
  const wantPrint = new URLSearchParams(location.search).get('print') === '1';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let row = {
    status: spec.status,
    payment_status: 'due',
    order_date: stamp,
    lines: [],
    discount_type: 'percentage',
    discount_amount: 0,
    tax_rate: 0,
    shipping_charges: 0,
    pay_amount: 0,
    pay_method: 'cash',
    extra_exp: [{ name: '', amount: 0 }, { name: '', amount: 0 }],
  };
  try {
    if (id && /so-upos-|fiberkapp/i.test(String(id))) await ensureFiberkSales();
  } catch { /* local book */ }
  if (id) {
    const live = await findSale(id);
    const local = live
      || findFiberkSale(id)
      || (readLs('df_sales_orders', []) || []).find((r) => String(r.id) === String(id) || String(r.reference) === String(id));
    if (local) row = { ...row, ...local, lines: local.lines || local.items || [] };
    if (!row.id || String(row.id) !== String(id)) {
      const { data } = await supabase.from(spec.table).select('*').eq('id', id).maybeSingle();
      if (data) row = { ...row, ...data, lines: data.lines || data.items || [] };
    }
  }
  if (id && (readOnly || wantPrint)) {
    paintSellDetails(app, row);
    if (wantPrint) setTimeout(() => window.print(), 250);
    return;
  }
  const [{ data: customers }, { data: products }, { data: users }] = await Promise.all([
    supabase.from('customers').select('id,name,phone,address,city,subsidiary_code,location_code').order('name').limit(800),
    supabase.from('products').select('id,name,sku,selling_price,tax_name,unit,subsidiary_code,location_code').order('name').limit(2000),
    supabase.from('profiles').select('id,full_name,email').limit(80),
  ]);
  const custs = filterBySidebar(customers || []);
  const cats = filterBySidebar(products || []);
  const staff = users || [];
  let showExp = false;

  function totals() {
    const items = row.lines.reduce((s, l) => s + Number(l.qty || 0), 0);
    const sub = row.lines.reduce((s, l) => s + lineNet(l).after, 0);
    const disc = row.discount_type === 'fixed'
      ? Number(row.discount_amount || 0)
      : sub * (Number(row.discount_amount || 0) / 100);
    const taxed = Math.max(0, sub - disc);
    const tax = taxed * (Number(row.tax_rate || 0) / 100);
    const ship = Number(row.shipping_charges || 0);
    const extra = (row.extra_exp || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const payable = taxed + tax + ship + extra;
    const paid = Number(row.pay_amount || 0);
    return { items, sub, disc, tax, ship, extra, payable, paid, change: Math.max(0, paid - payable), due: Math.max(0, payable - paid) };
  }

  function paint() {
    const t = totals();
    const cust = custs.find((c) => String(c.id) === String(row.customer_id));
    const isFinal = row.status === 'final';
    app.innerHTML = `
      <h1 style="margin:0 0 14px;font-size:22px;color:#111">${readOnly ? 'View' : (id ? 'Edit' : 'Add')} ${esc(spec.title)}</h1>
      <form id="f" ${readOnly ? 'data-view="1"' : ''}>
        <div class="sell-card">
          <div class="sell-grid">
            ${subsidiarySelect(row.subsidiary_code || '')}
            ${locationSelect(row.subsidiary_code || '', row.location_code || '')}
            <label class="fld">Customer:*
              <span style="display:flex;gap:6px">
                <select name="customer_id" required style="flex:1">
                  <option value="">Enter Customer name / phone</option>
                  ${custs.map((c) => `<option value="${c.id}" ${c.id===row.customer_id?'selected':''}>${esc(c.name)}${c.phone?(' / '+c.phone):''}</option>`).join('')}
                </select>
                <a class="ult-btn ult-btn-outline" href="/customer-form.html" title="Add customer">+</a>
              </span>
              <small style="font-weight:400;color:#111">Billing: ${esc(cust ? [cust.name, cust.address, cust.city].filter(Boolean).join(', ') : 'Walk-In Customer')}</small>
            </label>
            <label class="fld">Pay term:
              <span style="display:flex;gap:6px">
                <input name="pay_term_number" type="number" value="${esc(row.pay_term_number||'')}" placeholder="Pay term" style="width:40%" />
                <select name="pay_term_type" style="width:60%">
                  <option value="">Please Select</option>
                  <option value="days" ${row.pay_term_type==='days'?'selected':''}>Days</option>
                  <option value="months" ${row.pay_term_type==='months'?'selected':''}>Months</option>
                </select>
              </span>
            </label>
            <label class="fld">Sale Date:*
              <input name="order_date" type="datetime-local" required value="${esc(String(row.order_date||stamp).slice(0,16))}" />
            </label>
            <label class="fld">Status:*
              <select name="status" required>
                <option value="final" ${row.status==='final'?'selected':''}>Final</option>
                <option value="draft" ${row.status==='draft'?'selected':''}>Draft</option>
                <option value="quotation" ${row.status==='quotation'?'selected':''}>Quotation</option>
                <option value="proforma" ${row.status==='proforma'?'selected':''}>Proforma</option>
              </select>
            </label>
            <label class="fld">Invoice scheme:
              <select name="invoice_scheme"><option value="default">Default</option></select>
            </label>
            <label class="fld">Invoice No.:
              <input name="reference" value="${esc(row.reference||row.invoice_no||'')}" placeholder="Keep blank to auto generate" />
            </label>
            <label class="fld">Attach Document:
              <input name="sell_document" type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" />
              <small style="font-weight:400">Max 5MB · pdf csv zip doc jpg png</small>
            </label>
          </div>
        </div>

        <div class="sell-card">
          <div class="ult-table-wrap">
            <table class="ult-table dest-table">
              <thead><tr>
                <th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th>
                <th>Discount</th><th>Tax</th><th>Price inc. tax</th><th>Subtotal</th><th></th>
              </tr></thead>
              <tbody>${row.lines.map((l,i) => {
                const n = lineNet(l);
                return `<tr>
                  <td>${i+1}</td>
                  <td>${esc(l.name)}<br><small>${esc(l.sku||'')}</small></td>
                  <td><input data-k="qty" data-i="${i}" type="number" min="0" step="0.01" value="${l.qty||1}" /></td>
                  <td><input data-k="unit_price" data-i="${i}" type="number" min="0" step="0.01" value="${l.unit_price||0}" /></td>
                  <td><input data-k="discount" data-i="${i}" type="number" min="0" step="0.01" value="${l.discount||0}" /></td>
                  <td><input data-k="tax_rate" data-i="${i}" type="number" min="0" step="0.01" value="${l.tax_rate||0}" /></td>
                  <td>${fmt(n.inc)}</td>
                  <td>${fmt(n.after)}</td>
                  <td><button type="button" data-rm="${i}">×</button></td>
                </tr>`;
              }).join('') || '<tr><td colspan="9" style="text-align:center">No products added</td></tr>'}</tbody>
            </table>
          </div>
          <p style="text-align:right;font-weight:700">Items: ${t.items} &nbsp; Total: ${fmt(t.sub)}</p>
          <label class="fld" style="max-width:720px;margin:0 auto">Enter Product name / SKU / Scan bar code
            <input id="q" placeholder="Enter Product name / SKU / Scan bar code" autocomplete="off" />
          </label>
          <div id="hits"></div>
        </div>

        <div class="sell-card">
          <div class="sell-grid">
            <label class="fld">Discount Type:*
              <select name="discount_type">
                <option value="percentage" ${row.discount_type!=='fixed'?'selected':''}>Percentage</option>
                <option value="fixed" ${row.discount_type==='fixed'?'selected':''}>Fixed</option>
              </select>
            </label>
            <label class="fld">Discount Amount:*
              <input name="discount_amount" type="number" step="0.01" value="${row.discount_amount||0}" />
            </label>
            <p><b>Discount Amount:</b> (−) ${fmt(t.disc)}</p>
            <label class="fld">Order Tax:*
              <select name="tax_rate">
                <option value="0">None</option>
                <option value="10" ${Number(row.tax_rate)===10?'selected':''}>VAT@10%</option>
                <option value="18" ${Number(row.tax_rate)===18?'selected':''}>GST@18%</option>
              </select>
            </label>
            <p><b>Order Tax:</b> (+) ${fmt(t.tax)}</p>
            <label class="fld" style="grid-column:1/-1">Sell note
              <textarea name="sale_note" rows="3">${esc(row.notes||row.sale_note||'')}</textarea>
            </label>
          </div>
        </div>

        <div class="sell-card">
          <div class="sell-grid">
            <label class="fld">Shipping Details<textarea name="shipping_details" rows="3">${esc(row.shipping_details||'')}</textarea></label>
            <label class="fld">Shipping Address<textarea name="shipping_address" rows="3">${esc(row.shipping_address||'')}</textarea></label>
            <label class="fld">Shipping Charges<input name="shipping_charges" type="number" step="0.01" value="${row.shipping_charges||0}" /></label>
            <label class="fld">Shipping Status
              <select name="shipping_status">
                <option value="">Please Select</option>
                ${['ordered','packed','shipped','delivered','cancelled'].map((s)=>`<option value="${s}" ${row.shipping_status===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label class="fld">Delivered To:<input name="delivered_to" value="${esc(row.delivered_to||'')}" /></label>
            <label class="fld">Delivery Person:
              <select name="delivery_person">
                <option value="">Please Select</option>
                ${staff.map((u)=>`<option value="${u.id}" ${row.delivery_person===u.id?'selected':''}>${esc(u.full_name||u.email)}</option>`).join('')}
              </select>
            </label>
          </div>
          <p style="text-align:center;margin:12px 0">
            <button type="button" id="tog-exp" class="ult-btn ult-btn-primary">+ Add additional expenses</button>
          </p>
          <div id="exp" ${showExp?'':'hidden'}>
            <table class="ult-table"><thead><tr><th>Additional expense name</th><th>Amount</th></tr></thead>
            <tbody>${row.extra_exp.map((e,i)=>`<tr>
              <td><input data-en="${i}" value="${esc(e.name||'')}" /></td>
              <td><input data-ea="${i}" type="number" step="0.01" value="${e.amount||0}" /></td>
            </tr>`).join('')}</tbody></table>
          </div>
          <p style="text-align:right;font-size:16px"><b>Total Payable:</b> ${fmt(t.payable)}</p>
        </div>

        <div class="sell-card" id="pay-box" ${isFinal?'':'hidden'}>
          <h3 style="margin:0 0 12px">Add payment</h3>
          <div class="sell-grid">
            <label class="fld">Amount:*<input name="pay_amount" type="number" step="0.01" value="${row.pay_amount||t.payable}" /></label>
            <label class="fld">Paid on:*<input name="paid_on" type="datetime-local" value="${esc(String(row.paid_on||stamp).slice(0,16))}" /></label>
            <label class="fld">Payment Method:*
              <select name="pay_method">
                ${['cash','card','momo','cheque','bank_transfer','bnpl','other'].map((m)=>`<option value="${m}" ${row.pay_method===m?'selected':''}>${m.replace('_',' ')}</option>`).join('')}
              </select>
            </label>
            <label class="fld" style="grid-column:1/-1">Payment note:<textarea name="pay_note" rows="2">${esc(row.pay_note||'')}</textarea></label>
          </div>
          <p><b>Change Return:</b> ${fmt(t.change)}</p>
          <p style="text-align:right"><b>Balance:</b> ${fmt(t.due)}</p>
        </div>

        <p style="text-align:center;margin:20px 0">
          ${readOnly
            ? `<a class="ult-btn ult-btn-primary" href="/sales-form.html?id=${esc(id)}" style="padding:12px 28px;font-size:16px">Edit</a>
               <a class="ult-btn" href="${esc(spec.list)}" style="padding:12px 28px;font-size:16px">Back</a>`
            : `<button type="submit" class="ult-btn ult-btn-primary" style="padding:12px 28px;font-size:16px">Save</button>
          <button type="button" id="save-print" class="ult-btn" style="background:#16a34a;color:#fff;padding:12px 28px;font-size:16px;border:0;border-radius:8px">Save and print</button>`}
        </p>
        <p id="err" style="color:#b91c1c;text-align:center"></p>
      </form>`;

    bind(t);
  }

  function grabForm() {
    const f = document.getElementById('f');
    if (!f) return;
    const fd = new FormData(f);
    row.customer_id = fd.get('customer_id');
    row.pay_term_number = fd.get('pay_term_number');
    row.pay_term_type = fd.get('pay_term_type');
    row.order_date = fd.get('order_date');
    row.status = fd.get('status') || row.status;
    row.reference = fd.get('reference');
    row.discount_type = fd.get('discount_type');
    row.discount_amount = Number(fd.get('discount_amount') || 0);
    row.tax_rate = Number(fd.get('tax_rate') || 0);
    row.notes = fd.get('sale_note');
    row.shipping_details = fd.get('shipping_details');
    row.shipping_address = fd.get('shipping_address');
    row.shipping_charges = Number(fd.get('shipping_charges') || 0);
    row.shipping_status = fd.get('shipping_status');
    row.delivered_to = fd.get('delivered_to');
    row.delivery_person = fd.get('delivery_person');
    row.pay_amount = Number(fd.get('pay_amount') || 0);
    row.pay_method = fd.get('pay_method');
    row.pay_note = fd.get('pay_note');
    row.paid_on = fd.get('paid_on');
  }

  function bind(t) {
    const f = document.getElementById('f');
    if (readOnly) {
      f.querySelectorAll('input, select, textarea, button').forEach((el) => {
        if (el.closest('a')) return;
        el.disabled = true;
      });
      return;
    }
    f.querySelector('[name="status"]').onchange = () => { grabForm(); paint(); };
    ['discount_type','discount_amount','tax_rate','shipping_charges','pay_amount'].forEach((n) => {
      f.querySelector(`[name="${n}"]`)?.addEventListener('change', () => { grabForm(); paint(); });
    });
    f.querySelector('[name="customer_id"]').onchange = () => { grabForm(); paint(); };
    document.getElementById('tog-exp').onclick = () => { grabForm(); showExp = !showExp; paint(); };
    app.querySelectorAll('[data-k]').forEach((inp) => {
      inp.onchange = () => { row.lines[+inp.dataset.i][inp.dataset.k] = Number(inp.value || 0); paint(); };
    });
    app.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => { row.lines.splice(+b.dataset.rm, 1); paint(); };
    });
    app.querySelectorAll('[data-en]').forEach((inp) => {
      inp.onchange = () => { row.extra_exp[+inp.dataset.en].name = inp.value; };
    });
    app.querySelectorAll('[data-ea]').forEach((inp) => {
      inp.onchange = () => { row.extra_exp[+inp.dataset.ea].amount = Number(inp.value || 0); paint(); };
    });
    const q = document.getElementById('q');
    const hits = document.getElementById('hits');
    q.oninput = () => {
      const term = q.value.trim().toLowerCase();
      if (term.length < 1) { hits.innerHTML = ''; return; }
      hits.innerHTML = cats.filter((p) => (p.name + ' ' + (p.sku || '')).toLowerCase().includes(term)).slice(0, 10)
        .map((p) => `<button type="button" class="ult-btn ult-btn-outline" data-add="${p.id}" style="margin:4px">${esc(p.name)} · ${esc(p.sku||'')} · ${fmt(p.selling_price)}</button>`).join('');
    };
    hits.onclick = (e) => {
      const pid = e.target.dataset.add;
      if (!pid) return;
      const p = cats.find((x) => String(x.id) === String(pid));
      if (!p) return;
      row.lines.push({ product_id: p.id, name: p.name, sku: p.sku, qty: 1, unit_price: Number(p.selling_price || 0), discount: 0, tax_rate: Number(p.tax_rate || 0) });
      paint();
    };
    f.onsubmit = (e) => save(e, false);
    document.getElementById('save-print').onclick = () => save({ preventDefault() {}, target: f }, true);
  }

  async function save(e, printAfter) {
    e.preventDefault();
    grabForm();
    const err = document.getElementById('err');
    err.textContent = '';
    if (!(await confirmAction('Save this ' + spec.title.toLowerCase() + '?', 'Stamped to the selected subsidiary.'))) return;
    const t = totals();
    const body = {
      customer_id: row.customer_id || null,
      customer_name: custs.find((c) => String(c.id) === String(row.customer_id))?.name || null,
      reference: row.reference || ('INV-' + Date.now().toString().slice(-8)),
      order_date: String(row.order_date || '').slice(0, 10),
      status: row.status,
      payment_status: t.due <= 0.001 ? 'paid' : (t.paid > 0 ? 'partial' : 'due'),
      total_amount: t.payable,
      amount_paid: t.paid,
      notes: row.notes || null,
      pay_term: [row.pay_term_number, row.pay_term_type].filter(Boolean).join(' ') || null,
      shipping_details: row.shipping_details || null,
      shipping_address: row.shipping_address || null,
      shipping_charges: t.ship,
      shipping_status: row.shipping_status || null,
      delivered_to: row.delivered_to || null,
      lines: row.lines,
    };
    try { stampScope(body, document.getElementById('f')); } catch (ex) { err.textContent = ex.message; return; }
    delete body.agent_id;
    let q;
    if (id) q = await supabase.from(spec.table).update(body).eq('id', id);
    else q = await supabase.from(spec.table).insert(body);
    if (q.error) {
      const slim = { ...body };
      delete slim.lines; delete slim.pay_term; delete slim.shipping_details; delete slim.shipping_address;
      delete slim.shipping_charges; delete slim.shipping_status; delete slim.delivered_to;
      q = id ? await supabase.from(spec.table).update(slim).eq('id', id) : await supabase.from(spec.table).insert(slim);
    }
    if (q.error) { err.textContent = q.error.message; return; }
    if (printAfter) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<pre style="font:14px/1.4 Inter,sans-serif">SALE ${body.reference}\n${body.customer_name||''}\nTotal ${fmt(t.payable)}\nPaid ${fmt(t.paid)}</pre>`);
        w.document.close(); w.print();
      }
    }
    location.assign(spec.list);
  }

  paint();
}
