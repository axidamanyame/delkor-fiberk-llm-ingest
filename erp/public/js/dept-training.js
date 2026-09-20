/**
 * Department training packs. Accounting is first; add Sales, Purchases, HRM, POS later
 * as extra entries in DEPT_PACKS — Training and HRM induction pick them up automatically.
 */

export const DEPT_PACKS = [
  {
    id: 'accounting',
    title: 'Accounting',
    audience: 'Accounting / Finance',
    href: '/training-accounting.html',
    intro: 'How Delkor-Fiberk books cash, suppliers, and the ledger. Start here before posting live journals.',
    lessons: [
      {
        id: 'acc-supplier-deposit',
        title: 'Supplier deposits (account-opening money)',
        html: `
          <p>A supplier may ask Delkor-Fiberk to deposit money <strong>when they create our account</strong> — for example <strong>GHS 50,000</strong>. That is not a purchase and not an expense. It is a <strong>deposit sitting with the supplier</strong> (prepaid / supplier advance): our money, held by them, until we take goods.</p>
          <h3>The books</h3>
          <div class="ult-table-wrap"><table class="ult-table lesson-tbl">
            <thead><tr><th></th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              <tr><td>Now (we pay the deposit)</td><td>Supplier deposit / Advance — GHS 50,000</td><td>The bank or MoMo that paid — GHS 50,000</td></tr>
              <tr><td>Later (goods received)</td><td>Inventory (and A/P as usual)</td><td>Apply the GHS 50,000 advance against that bill</td></tr>
            </tbody>
          </table></div>
          <h3>Do not</h3>
          <ul>
            <li><strong>Do not</strong> put GHS 50,000 in the supplier’s <em>Opening Balance</em>. That field means <em>we owe them</em>. This is the opposite: <em>they hold our money</em>.</li>
            <li><strong>Do not</strong> book it as an expense or as a purchase until goods are received.</li>
            <li><strong>Do not</strong> use Finance → Deposit as “cash in”. That is money coming into our till, not money we sent out.</li>
          </ul>
          <h3>Record it in this ERP</h3>
          <ol>
            <li>Contacts → Suppliers → open that supplier.</li>
            <li>Finance → Payment accounts → Deposit / withdraw. Type: <strong>Supplier payment</strong>. Amount: <strong>50000</strong>. Method: bank or MoMo. Note: <code>Account-opening deposit — [supplier name]</code>.</li>
            <li>On the supplier, open <strong>Ledger</strong> and record the same GHS 50,000 as a payment / advance with that note. <strong>Advance Balance</strong> on the supplier should then show GHS 50,000.</li>
            <li>Optional GL: Accounting → Journal Entry. Debit a current-asset account (Uncategorised Asset / supplier deposits) GHS 50,000. Credit the same bank or MoMo GHS 50,000.</li>
          </ol>
          <p>When the first purchase from them is received, pay the bill by <strong>applying that advance</strong>, not by sending another GHS 50,000.</p>
          <p>VAT / GRA: a deposit is usually not a taxable supply until goods or services are delivered. Do not treat the GHS 50,000 as input VAT until the supplier invoice says so.</p>`,
      },
      {
        id: 'acc-opening-vs-advance',
        title: 'Opening balance vs Advance balance',
        html: `
          <p>Every supplier and customer card has two money fields. They mean opposite things. Mixing them is the most common books error in this ERP.</p>
          <div class="ult-table-wrap"><table class="ult-table lesson-tbl">
            <thead><tr><th>Field</th><th>On a supplier</th><th>On a customer</th></tr></thead>
            <tbody>
              <tr><td><strong>Opening balance</strong></td><td>We already owe them (accounts payable)</td><td>They already owe us (accounts receivable)</td></tr>
              <tr><td><strong>Advance balance</strong></td><td>We have prepaid them (our asset)</td><td>They have prepaid us (our liability)</td></tr>
            </tbody>
          </table></div>
          <p>Account-opening deposits, retainers, and unused credit notes increase <strong>Advance</strong>. Historic unpaid bills at go-live belong in <strong>Opening balance</strong> (or Purchase payment due / Sales payment due).</p>`,
      },
      {
        id: 'acc-apply-deposit',
        title: 'Applying a supplier deposit to the first bill',
        html: `
          <p>The deposit stays an asset until inventory (or a service) is received.</p>
          <ol>
            <li>Purchases → add the bill / receive the goods as usual (Operations Hub first, then transfer to the selling location).</li>
            <li>On that purchase, Add payment. Allocate the existing <strong>advance</strong> rather than a new bank payment.</li>
            <li>Advance Balance on the supplier falls by the amount applied. If the bill is larger than the deposit, pay only the difference from bank or MoMo.</li>
            <li>If you also posted the optional journal, reverse or clear the supplier-deposit asset for the amount applied so the ledger does not double-count.</li>
          </ol>
          <p>Never create a second GHS 50,000 payment “because the bill is 50,000” if that money is already sitting as an advance.</p>`,
      },
    ],
  },
];

export function packById(id) {
  return DEPT_PACKS.find((p) => p.id === id) || null;
}

export function deptLibraryBody() {
  return `
    <div class="or-card">
      <h2>Department training</h2>
      <p>Each department will get its own pack. Accounting is live. Sales, Purchases, HRM, POS and Field Ops will be added the same way.</p>
    </div>
    <div class="dept-grid">
      ${DEPT_PACKS.map((p) => `
        <a class="dept-card" href="${p.href}">
          <strong>${p.title}</strong>
          <span>${p.audience}</span>
          <em>${p.lessons.length} lesson${p.lessons.length === 1 ? '' : 's'}</em>
        </a>`).join('')}
    </div>`;
}

export function deptPackBody(pack, done = {}) {
  if (!pack) return '<p>Pack not found.</p>';
  return `
    <div class="or-card">
      <h2>${pack.title} training</h2>
      <p>${pack.intro}</p>
      <p class="ult-muted">For ${pack.audience}. Mark each lesson complete when you have read it.</p>
    </div>
    ${pack.lessons.map((m) => `
      <div class="mod ${done[m.id] ? 'open' : ''}" data-mod="${m.id}">
        <button type="button" data-toggle-mod><span>${m.title}</span><span class="done">${done[m.id] ? 'Complete' : 'Open'}</span></button>
        <div class="body">${m.body || m.html}<button type="button" class="go" data-train="${m.id}">${done[m.id] ? 'Completed' : 'Mark complete'}</button></div>
      </div>`).join('')}`;
}
