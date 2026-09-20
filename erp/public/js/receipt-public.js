import { fetchReceipt, receiptUrl } from './bank-book.js';
import { digitalReceiptCardHtml } from './public-receipt-html.js';

function codeFromLocation() {
  const q = new URLSearchParams(location.search).get('code');
  if (q) return q;
  const parts = location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last !== 'r' && last !== 'receipt.html' && last !== 'index.html') return last;
  return '';
}

async function snapCard() {
  const el = document.getElementById('receipt-card');
  if (!el) return null;
  const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')).default;
  const dock = el.querySelector('.rc-dock');
  const sheet = el.querySelector('.rc-sheet');
  if (dock) dock.style.display = 'none';
  if (sheet) sheet.style.display = 'none';
  try {
    return await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
  } finally {
    if (dock) dock.style.display = '';
    if (sheet) sheet.style.display = '';
  }
}

function download(filename, href) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function bindReceiptDock(root, rec = {}) {
  const box = root || document;
  let stars = 0;
  const code = rec.receipt_code || rec.reference || 'receipt';
  const sheet = () => box.querySelector('#rc-sheet');
  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-rc]');
    if (!btn) return;
    const act = btn.dataset.rc;
    if (act === 'print') {
      window.print();
      return;
    }
    if (act === 'pdf') {
      try {
        const canvas = await snapCard();
        const mod = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm');
        const jsPDF = mod.jsPDF || mod.default;
        const mmW = 210;
        const mmH = Math.max(297, mmW * (canvas.height / canvas.width));
        const pdf = new jsPDF({ unit: 'mm', format: [mmW, mmH] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, mmW, mmW * (canvas.height / canvas.width));
        pdf.save(`receipt-${code}.pdf`);
      } catch {
        window.print();
      }
      return;
    }
    if (act === 'image') {
      try {
        const canvas = await snapCard();
        download(`receipt-${code}.png`, canvas.toDataURL('image/png'));
      } catch {
        window.print();
      }
      return;
    }
    if (act === 'share') {
      const url = rec.receipt_url || location.href;
      const title = 'Delkor-Fiberk receipt';
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
          return;
        }
      } catch { /* cancelled */ }
      try {
        await navigator.clipboard.writeText(url);
        btn.classList.add('copied');
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Copied';
        setTimeout(() => { btn.classList.remove('copied'); if (label) label.textContent = 'Share'; }, 1600);
      } catch { /* ignore */ }
      return;
    }
    if (act === 'more') {
      const sh = sheet();
      if (sh) sh.hidden = false;
      return;
    }
    if (act === 'close-sheet') {
      const sh = sheet();
      if (sh) sh.hidden = true;
      return;
    }
    if (act === 'send-review') {
      const note = (box.querySelector('#rc-review')?.value || '').trim();
      const row = {
        receipt_code: code,
        rating: stars,
        comment: note,
        at: new Date().toISOString(),
      };
      try { localStorage.setItem('df_receipt_review_' + code, JSON.stringify(row)); } catch { /* ignore */ }
      try {
        const { supabase } = await import('./supabaseClient.js');
        await supabase.from('customer_receipt_reviews').insert(row);
      } catch { /* table optional */ }
      const ok = box.querySelector('#rc-review-ok');
      if (ok) ok.hidden = false;
      const go = box.querySelector('[data-rc="send-review"]');
      if (go) go.disabled = true;
      return;
    }
  });
  box.querySelectorAll('[data-star]').forEach((el) => {
    el.addEventListener('click', () => {
      stars = Number(el.dataset.star) || 0;
      box.querySelectorAll('[data-star]').forEach((s) => {
        s.classList.toggle('on', Number(s.dataset.star) <= stars);
      });
    });
  });
}

export async function loadReceipt() {
  const code = codeFromLocation();
  const box = document.getElementById('box') || document.body;
  document.body.classList.add('rc-page');
  if (!code) {
    box.innerHTML = '<div class="receipt"><h2>Receipt</h2><p>Missing receipt code.</p></div>';
    return;
  }
  const r = await fetchReceipt(code);
  if (!r) {
    box.innerHTML = `<div class="receipt"><h2>Receipt not found</h2>
      <p>This link may have expired or was opened in a different browser.</p></div>`;
    return;
  }
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    box.innerHTML = `<div class="receipt"><h2>Receipt expired</h2>
      <p>Transaction ${r.receipt_code} expired on ${new Date(r.expires_at).toLocaleDateString('en-GB')}.</p></div>`;
    return;
  }
  const url = r.receipt_url || receiptUrl(r.receipt_code);
  const rec = { ...r, receipt_url: url };
  delete rec.sms_preview;
  delete rec.sms;
  box.innerHTML = digitalReceiptCardHtml(rec, { dock: true });
  bindReceiptDock(box, rec);
}

if (document.getElementById('box')) loadReceipt();
