/**
 * Desk user manual — staff-facing how-to, organised by module.
 * Operational screens link here instead of printing builder blurbs inline.
 */
import { esc } from './ls-rows.js';

export const MANUAL = [
  {
    id: 'wms',
    title: 'Warehouse (WMS)',
    desk: '/wms.html',
    intro: 'WMS is the Operations Hub floor. It is the same stock book as the rest of the ERP — not a second warehouse. Fiberk Shop is the only shop that can receive goods directly; every other location is fed by put-away or transfer from the Hub.',
    topics: [
      {
        id: 'wms-recv',
        title: 'Receiving',
        href: '/wms.html?tab=recv',
        body: 'Purchases land at Operations Hub. Walk-in SKU receive is for goods that arrived without a purchase order — still Hub, or Fiberk Shop. Completing receive posts the same path the Hub board uses. Fiberkapp historic receipts sit on the migrated purchases book, not on this floor.',
      },
      {
        id: 'wms-putaway',
        title: 'Put Away',
        href: '/wms.html?tab=putaway',
        body: 'Stock sitting at the Hub is moved to a selling location. Completing put-away writes the same transfer book as Operations Hub → Add Transfer. EasyBuy / BNPL Field is a common destination from this desk.',
      },
      {
        id: 'wms-pick',
        title: 'Picking',
        href: '/wms.html?tab=pick',
        body: 'Open sales waiting to be picked. Completing a pick does not reduce Hub quantity — dispatch is what ships the carton. Same sales book as All Sales.',
      },
      {
        id: 'wms-pack',
        title: 'Packing',
        href: '/wms.html?tab=pack',
        body: 'Pack a completed pick. Packing writes a pending shipment on the same book as Sales → Shipments.',
      },
      {
        id: 'wms-dispatch',
        title: 'Dispatch',
        href: '/wms.html?tab=dispatch',
        body: 'Ship a packed carton. Carrier and tracking go on the same shipments book as Sales → Shipments. This desk does not keep a second dispatch ledger.',
      },
      {
        id: 'wms-stock',
        title: 'Stock',
        href: '/wms.html?tab=stock',
        body: 'Live on-hand units. One row per piece — never a rolled-up SKU count. Unknown SKU still gets a unit id (UNK-…). Product reports may group by SKU; operational stock tables may not.',
      },
      {
        id: 'wms-xfer',
        title: 'Transfers',
        href: '/wms.html?tab=xfer',
        body: 'Same transfer book as Operations Hub. Completing a transfer here moves product location the same way Add Transfer does.',
      },
      {
        id: 'wms-adj',
        title: 'Adjustments',
        href: '/wms.html?tab=adj',
        body: 'Damage, variance, and write-off. Increase or decrease changes on-hand on the same stock-adjustment book as Operations Hub.',
      },
      {
        id: 'wms-count',
        title: 'Count',
        href: '/wms.html?tab=count',
        body: 'Physical audit. The difference posts as a stock adjustment — same as Operations Hub → Stock Count / Audit.',
      },
      {
        id: 'wms-scan',
        title: 'Scan',
        href: '/wms.html?tab=scan',
        body: 'USB or Bluetooth scanners type into the code box (keyboard wedge) and press Enter. Camera uses the device barcode detector. Unknown SKUs must be added to the catalogue first.',
      },
    ],
  },
  {
    id: 'ops',
    title: 'Operations Hub',
    desk: '/virtual-warehouse.html',
    intro: 'The Hub board is the default warehouse. Receive, put-away, transfer and count write the same stock book WMS uses. After the Easybuy merge, hire-purchase put-away and Field Ops sit on this board so stock and collections stay one walk.',
    topics: [
      {
        id: 'ops-board',
        title: 'Hub board',
        href: '/virtual-warehouse.html',
        body: 'Tiles open Receive, Put Away, Transfers, Adjustments, Stock Count, the WMS floor, and Easybuy / BNPL Field desks. Movements below the tiles are the same transfer book as List Transfers.',
      },
      {
        id: 'ops-easybuy',
        title: 'Easybuy from the Hub',
        href: '/wms.html?tab=putaway',
        body: 'Put-away to BNPL Field / EasyBuy is how hire-purchase stock leaves the Hub. Collections works the debt book; Field Ops works the visit. Neither desk keeps a second warehouse.',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM, Collections & Call Centre',
    desk: '/crm.html',
    intro: 'CRM is the customer desk. Collections is Easybuy hire purchase. Call Centre is inbound rings from ads, WhatsApp, and the shop. Follow-ups from all three share today’s list on CRM.',
    topics: [
      {
        id: 'crm-followups',
        title: 'Follow ups',
        href: '/crm.html?tab=followups',
        body: 'Scheduled calls and visits. Today’s list mixes CRM reminders, Easybuy collection calls, and Call Centre callbacks so one person is not chased from three desks.',
      },
      {
        id: 'crm-collections',
        title: 'Collections — Easybuy hire purchase',
        href: '/collections-desk.html',
        body: 'The Easybuy / BNPL debt book: accounts, grades, promises to pay, and the call diary. Open it from CRM when you are working hire-purchase arrears — not from a module Settings page.',
      },
      {
        id: 'crm-calls',
        title: 'Call Centre',
        href: '/call-centre.html',
        body: 'Inbound ads, WhatsApp, and shop rings. Missed and abandoned tickets sit on Missed / callback until they are recovered. Campaigns run on this desk.',
      },
      {
        id: 'crm-cc-agents',
        title: 'Call Centre agents',
        href: '/call-centre.html?pane=agents',
        body: 'Desk staff who take inbound rings. Onboard them on Call Centre → Agents. They are not BNPL field agents (Field Ops / commission agents) and they are not Fiberk shop / till cashiers (Users / HR). A Call Centre agent has a name, extension, shift, and the queues they cover. Logging a call picks from this roster. Field sales and EasyBuy SA codes never belong on this list.',
      },
    ],
  },
  {
    id: 'field',
    title: 'Field Ops',
    desk: '/field-ops.html',
    intro: 'BNPL Field Sales is agent-led hire purchase. Agents on the left, customers on the right. Selecting BNPL (Hire Purchase) and BNPL Field Sales together opens this desk.',
    topics: [
      {
        id: 'field-floor',
        title: 'Floor',
        href: '/field-ops.html',
        body: 'Live field book: orders, visits, and stock sitting with agents. Same customers Collections can send across for a visit.',
      },
      {
        id: 'field-sync',
        title: 'Public Field Ops page',
        href: '/field-ops.html?tab=sync',
        body: 'Field Ops is a signed-in module and a page on the public site. They do not share the whole ERP — only the books ticked in System → Settings → Field Ops. Publishing writes a snapshot the public page reads.',
      },
    ],
  },
  {
    id: 'purchases',
    title: 'Purchases',
    desk: '/purchase-orders.html',
    intro: 'A purchase is one bill from one supplier. Edit opens that bill only — reference, supplier, date, lines, and totals. New stock is received at Operations Hub, then transferred to the selling company. Fiberk Shop may receive directly. Field Stock Hub only takes SKUs that already moved through BNPL Field Sales.',
    topics: [
      {
        id: 'purch-edit',
        title: 'Edit a purchase',
        href: '/purchase-form.html',
        body: 'The form is the selected purchase. Subsidiary and receive-into come from that row. Policy for where stock may land is this topic and WMS-01 — not an essay on the form.',
      },
      {
        id: 'purch-sop',
        title: 'Procurement manager — close every bill',
        href: '/purchase-orders.html',
        body: 'Before you leave a purchase or vendor invoice: (1) Vendor is the real supplier on the paper (Pinaro General Ventures is the same party as Mr Jeremiah Odjeawo — never leave Please Select). (2) Every line has a product name, SKU if known, qty, and unit cost copied from the slip — a total with blank products is not finished. (3) Qty on the bill matches the slip; stock desks later split units. (4) If the supplier was paid, set status Paid and amount paid equal to the slip total the same day — do not leave Due on a paid bill. (5) Attach the paper photo or PDF on that same record. (6) Receive into Operations Hub first, then transfer to the selling location (Fiberk Shop may receive direct). (7) Open View and read the popup: products, payments, and notes must match the paper. If View is empty and the total is not, stop and type the lines before anyone receives stock. (8) Catch-up dues from old Fiberk Home are money-only until you add lines from the original invoice or Fiberkapp View — do not treat them as received stock. (9) EasyBuy / Field Ops Order List stays one customer contract per row; never dump the whole book onto one PO. (10) New work is never typed into Migrated Fiberkapp books.',
      },
    ],
  },
  {
    id: 'accounting',
    title: 'Accounting',
    desk: '/accounting.html',
    intro: 'The ledger for the group. Journals, bank, and reconciliation live here. Chart of accounts and the accounting map are under System → Settings — not on the Accounting tabs.',
    topics: [
      {
        id: 'acc-books',
        title: 'Books vs bank',
        href: '/accounting-reconciliation.html',
        body: 'Reconciliation matches the UBA (or other bank) statement to the ledger. Salary lines are matched to people in HRM. Do not mix SA commission with salary.',
      },
      {
        id: 'acc-training',
        title: 'Classroom (deposits & advances)',
        href: '/training-accounting.html',
        body: 'Supplier account-opening deposits, opening balance vs advance, and how to apply a deposit to the first bill are in Accounting training — not on the journal screen.',
      },
    ],
  },
  {
    id: 'comms',
    title: 'Communications',
    desk: '/communications.html',
    intro: 'Staff talk, assign, and teach here. Not Call Centre, not Collections.',
    topics: [
      { id: 'comms-floor', title: 'Floor', href: '/communications.html', body: 'Tiles open Messages, To Do, Reminders, Announcements, Meetings, Documents, Memos, Knowledge Base, Groups, Calls. Floor is counts, not a record list.' },
      { id: 'comms-msg', title: 'Messages', href: '/communications.html?tab=msg', body: 'Rooms on the left, thread on the right. Send. No edit/delete of bubbles. HQ posts announcements; everyone views.' },
      { id: 'comms-kb', title: 'Knowledge Base', href: '/communications.html?tab=kb', body: 'HQ writes the cards staff should read. Empty until someone adds one.' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    desk: '/reports.html',
    intro: 'View, Print, Export. You do not type. Wrong number: fix the source document.',
    topics: [
      { id: 'rpt-all', title: 'All Reports', href: '/reports.html', body: 'Set location pin and date first. Empty table is usually the filter.' },
      { id: 'rpt-reg', title: 'Register Report', href: '/report-register.html', body: 'Shift check per till: opening, sales, cash, MoMo, closing. Not the till close button.' },
      { id: 'rpt-pl', title: 'Profit / Loss', href: '/report-profit-loss.html', body: 'Costs left, revenue right. Tax on this page is informational; Tax Report is the filing view.' },
    ],
  },
  {
    id: 'dashboards',
    title: 'Custom Dashboards',
    desk: '/custom-dashboards.html',
    intro: 'Boards you assemble from live figures. They do not change the books.',
    topics: [
      { id: 'dash-manage', title: 'Manage', href: '/custom-dashboards.html', body: 'View, Edit, Clone, Delete. Use a template or Create. HQ assigns who lands on which board after login.' },
    ],
  },
  {
    id: 'sheets',
    title: 'Spreadsheets',
    desk: '/spreadsheet.html',
    intro: 'Excel-like workbooks. Not the ledger. Live BNPL sheets are feeds from Field Ops.',
    topics: [
      { id: 'ss-tree', title: 'Folders and sheets', href: '/spreadsheet.html', body: 'Add folder or sheet. View or Edit the grid. Download is CSV. Live HP books cannot be deleted or overwritten.' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales & Purchases',
    desk: '/sales.html',
    intro: 'Retail flow: quotations and drafts, sales, purchases, then stock. Historic Fiberkapp rows sit on Migrated Data until the hard fork — live desks stay empty of those books.',
    topics: [
      {
        id: 'sales-live',
        title: 'Live vs migrated',
        href: '/migrated-silo.html',
        body: 'Each section that has a Fiberkapp table also has a Migrated page. Dashboard totals may still include migrated rows and are stamped as such. Do not key new work into the migrated books.',
      },
      {
        id: 'paper-po',
        title: 'Paper supplier invoice',
        href: '/paper-purchase.html',
        body: 'Handwritten vendor slips (Pinaro General Ventures #00475 — Spark 50, Hot 70, Smart 20, A200) are typed as a live purchase with the paper photo attached, received at Operations Hub on the WMS floor, then transferred to BNPL Field Sales. Do not put this on Fiberkapp migrated purchases.',
      },
    ],
  },
  {
    id: 'hp',
    title: 'Hire purchase partnership',
    desk: '/field-ops.html',
    intro: 'Hire purchase at Delkor-Fiberk is a three-way partnership. EasyBuy Ghana is the loan provider. Delkor-Fiberk procures the devices. BuyNowPaysLater runs field agents. Fiberk runs shop agents. Together they sell phones on credit.',
    topics: [
      {
        id: 'hp-01',
        title: 'Who owns which book',
        href: '/field-ops.html?tab=orders',
        body: 'Purchase-side (supplier bills, Hub receive, cost, Fiberk/BNPL reimbursement) belongs to the two operating subsidiaries: Fiberk (shop) and BuyNowPaysLater (field). Loan recovery belongs to EasyBuy. Shop agents are salaried company staff. Field agents are independent and paid commission. Fiberkapp phone sales and their customers sync into the live sales and contacts books — they are not siloed. Collections in this ERP only tracks the support EasyBuy asks partners to give; it is not EasyBuy’s own collector ledger. Until further notice every HP handset traces Franko Trading → Operations Hub → BNPL Field Sales → Field Stock Hub → customer. Partner price is EasyBuy’s benchmark. Fiberk sell is the reimbursement (our selling price). Franko unit cost is blank until procurement posts it — profit is not guessed. Refs: PO-HP-FRANKO, ST-HP-001, ST-HP-002.',
      },
    ],
  },
  {
    id: 'silo',
    title: 'Migrated data (Fiberkapp)',
    desk: '/migrated-silo.html',
    intro: 'Only Fiberkapp (DELKOR II FIBERK) history is siloed. Source columns are incomplete from old POS data-entry — we do not invent them. Those rows sit on Migrated pages until the hard fork. Dashboard totals still include them until then. Paper invoices, catch-up bills, HQ adds, seed listings, Franko photos already in Storage, and BNPL Field stock are live operations and show on the front desks. Search “migrated” to open the silo.',
    topics: [
      {
        id: 'silo-rule',
        title: 'What is siloed',
        href: '/migrated-silo.html',
        body: 'Siloed: Fiberkapp furniture and other non-phone POS history until the hard fork. Not siloed: hire-purchase phone sales and the purchase-side of those devices (HP-01). Also live: EasyBuy collections support, Franko photos in Storage, Pinaro and other paper invoices, catch-up bills, and anything staff add on the live desks.',
      },
      {
        id: 'silo-search',
        title: 'Find a live desk',
        href: '/manual.html#silo-search',
        body: 'The sidebar search is the whole ERP: pages, this manual, migrated books, SKUs and customers on this device. Enter opens the first result. The assistant (blue chip, bottom right) answers from live books and this manual, and remembers confirmed answers.',
      },
    ],
  },
  {
    id: 'hrm',
    title: 'HRM',
    desk: '/hrm.html',
    intro: 'People, leave, attendance, payroll, and bank salary. Past staff stay on the roster for UBA matching; they are not written back as users.',
    topics: [
      {
        id: 'hrm-people',
        title: 'People',
        href: '/hrm.html?tab=people',
        body: 'Present and past staff. Fiberkapp users were matched into this roster. Emmanuel and Emmanuella are different people — do not merge them.',
      },
      {
        id: 'hrm-induction',
        title: 'Staff induction',
        href: '/hrm.html?tab=induction',
        body: 'Orientation, Welcome Package, and Training. Extra menus appear only after HRM activates the role. The access key is sent to the bell and the registered email.',
      },
    ],
  },
  {
    id: 'chain',
    title: 'Supply chain classification',
    desk: '/products.html',
    intro: 'Operational flow is Operations Hub → Subsidiary → Business Location → Business Department. Operations Hub is the group warehouse. The four subsidiaries are Axidigetek, BuyNowPaysLater, Delkor Logistics, and Fiberk. Marketplaces: Axidigetek eCommerce, BNPL Field, BNPL Online, Delkor Online, Fiberk Shop. Departments (handoff): Axidigetek Stock Centre, BNPL Stock Centre, Delkor Delivery Centre, Fiberk Shop. Fiberk Shop is listed twice because it is the only physical shop and the only shop that may receive purchase orders directly. Delkor-Fiberk is the parent name on clients, partners, investors, and as the parent label in accounting and HR — it does not appear on operational tables.',
    topics: [
      {
        id: 'chain-hub',
        title: 'Operations Hub',
        href: '/virtual-warehouse.html',
        body: 'The company warehouse distribution system. Not a registered company. Stock is received here (except Fiberk Shop) and put away to a marketplace.',
      },
      {
        id: 'chain-subs',
        title: 'Subsidiaries',
        href: '/products.html',
        body: 'Registered entities that use the Hub: Axidigetek, BuyNowPaysLater, Delkor Logistics, Fiberk. Header and operational filters list these four plus Operations Hub. Never Delkor-Fiberk.',
      },
      {
        id: 'chain-loc',
        title: 'Business locations',
        href: '/business-locations.html',
        body: 'Public marketplaces, virtual or physical: Axidigetek eCommerce, BNPL Field, BNPL Online, Delkor Online, Fiberk Shop.',
      },
      {
        id: 'chain-dept',
        title: 'Business departments',
        href: '/products.html',
        body: 'Where the product meets the customer: online, shop, field sales agents, delivery team. Named centres: Axidigetek Stock Centre, BNPL Stock Centre, Delkor Delivery Centre, Fiberk Shop.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Catalog and inventory',
    desk: '/product-catalog.html',
    intro: 'Only Fiberkapp history is siloed. Paper invoices, catch-up bills, HQ adds and seed listings are live operations and show on List Products as soon as you open it. Catalog is a picture view of that same book. Inventory is the ordered / on-hand slice. The till only sells units on hand at that shop.',
    topics: [
      {
        id: 'prod-catalog',
        title: 'Product Catalog',
        href: '/product-catalog.html',
        body: 'Listings, descriptions and pictures of every SKU the group is capable of selling. Zero on-hand does not mean the listing is missing — it has not been ordered yet. Migrated Fiberkapp rows stay on the silo page.',
      },
      {
        id: 'prod-inventory',
        title: 'Product Inventory',
        href: '/products.html?view=inventory',
        body: 'The moment a purchase, paper invoice, sales order or hire-purchase order names a SKU, that SKU is inventory — even if the order is still draft or pending. WMS Stock is the on-hand slice of this book.',
      },
      {
        id: 'prod-till',
        title: 'Till live stock',
        href: '/pos.html',
        body: 'The register never lists the Operations Hub catalog. Cashiers only see inventory that is on hand at the open till location. A manager PIN can widen the filter to the whole inventory book, not to unused listings.',
      },
    ],
  },
  {
    id: 'pos',
    title: 'POS / Register',
    desk: '/pos-open.html',
    intro: 'Shop till. Search starts showing products as you type. Cart and Pay are separate. Ghana tills take cash, MTN / Vodafone / AirtelTigo MoMo, bank transfer, and cheque.',
    topics: [
      {
        id: 'pos-pay',
        title: 'Tender',
        href: '/pos.html',
        body: 'The amount you tender must match the sale. Strict denomination applies when it is switched on for that method. The till shows live on-hand inventory only. Catalog listings stay on Product Catalog. Only a manager PIN can widen the till to the rest of the inventory book.',
      },
    ],
  },
  {
    id: 'media',
    title: 'Supplier photos',
    desk: '/media-sync.html',
    intro: 'Franko Trading photos must live in the Supabase product-images bucket. The test CDN testing.frankotrading.com returns 401 and must not be used on the till.',
    topics: [
      {
        id: 'media-franko',
        title: 'Franko Sync',
        href: '/franko-sync.html',
        body: 'Franko photos are already in the product-images/franko bucket. The till rewrites testing.frankotrading.com URLs to that public Storage path (same rule as the original importer). Import is only for a missing file.',
      },
      {
        id: 'media-missing',
        title: 'Missing images',
        href: '/missing-images.html',
        body: 'Products with no image_url. Add a photo on the product card or import it here.',
      },
    ],
  },
];

const REF_PREFIX = {
  wms: 'WMS', ops: 'OPS', crm: 'CRM', field: 'FLD', accounting: 'ACC',
  sales: 'SAL', silo: 'SIL', hrm: 'HRM', products: 'PRD', pos: 'POS', media: 'MED',
  chain: 'CHN',
};

function stampRefs() {
  MANUAL.forEach((cat) => {
    const pfx = REF_PREFIX[cat.id] || String(cat.id || 'REF').slice(0, 3).toUpperCase();
    cat.ref = pfx + '-01';
    (cat.topics || []).forEach((t, i) => {
      t.ref = pfx + '-' + String(i + 2).padStart(2, '0');
    });
  });
}
stampRefs();

export function refOf(id) {
  const hit = topicById(id);
  return hit?.topic?.ref || hit?.cat?.ref || String(id || 'REF').toUpperCase();
}

/** On-page “i” cookies were unsolicited. Policy lives in Academy / the manual. */
export function deskHowLink(_id) {
  return '';
}

export function deskHow(_id, _label) {
  return '';
}

export const manualRef = deskHow;

export function manualEntries() {
  const out = [];
  MANUAL.forEach((cat) => {
    out.push({
      id: cat.id,
      ref: cat.ref,
      title: cat.title,
      body: cat.intro || '',
      href: '/manual.html#' + cat.id,
      desk: cat.desk || '',
      kind: 'category',
      parent: 'User Manual',
    });
    (cat.topics || []).forEach((t) => {
      out.push({
        id: t.id,
        ref: t.ref,
        title: t.title,
        body: t.body || '',
        href: '/manual.html#' + t.id,
        desk: t.href || cat.desk || '',
        kind: 'topic',
        parent: cat.title,
        parentRef: cat.ref,
      });
    });
  });
  return out;
}

export function manualCorpus() {
  return manualEntries()
    .map((e) => `[${e.ref}] ${e.title}\n${e.body}\nSee ${e.href}`)
    .join('\n\n');
}

function wordsOf(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function searchManual(q, limit = 5) {
  const raw = String(q || '').trim();
  if (!raw) return [];
  const qn = raw.toLowerCase();
  const refHit = raw.toUpperCase().match(/\b([A-Z]{2,4}-\d{2})\b/);
  const words = wordsOf(qn);
  return manualEntries()
    .map((e) => {
      const hay = `${e.ref} ${e.title} ${e.body} ${e.parent || ''}`.toLowerCase();
      let score = 0;
      if (refHit && String(e.ref || '').toUpperCase() === refHit[1]) score += 200;
      if (qn.length > 3 && hay.includes(qn)) score += 80;
      words.forEach((w) => {
        if (hay.includes(w)) score += 12;
        if (String(e.title).toLowerCase().includes(w)) score += 18;
        if (String(e.ref).toLowerCase() === w) score += 80;
      });
      return { ...e, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function answerFromManual(q) {
  const hits = searchManual(q, 3);
  if (!hits.length || hits[0].score < 20) return null;
  const top = hits[0];
  const also = hits.slice(1).filter((h) => h.score >= 20);
  let text = `${top.body}\n\nRef ${top.ref} — [${top.title}](/manual.html#${top.id})`;
  if (top.desk && !String(top.desk).includes('/manual.html')) {
    text += `\nDesk: [${top.title}](${top.desk})`;
  }
  if (also.length) {
    text += '\nAlso: ' + also.map((h) => `[${h.ref} ${h.title}](/manual.html#${h.id})`).join(' · ');
  }
  return text;
}

export function topicById(id) {
  for (const cat of MANUAL) {
    if (cat.id === id) return { cat, topic: null };
    const topic = (cat.topics || []).find((t) => t.id === id);
    if (topic) return { cat, topic };
  }
  return null;
}

export function manualBody() {
  const toc = MANUAL.map((c) => `<a href="#${esc(c.id)}">${esc(c.ref || '')} ${esc(c.title)}</a>`).join('');
  const cats = MANUAL.map((c) => {
    const topics = (c.topics || []).map((t) => `
      <article class="man-topic" id="${esc(t.id)}">
        <h3><span class="man-ref">${esc(t.ref || '')}</span> ${esc(t.title)}</h3>
        <p>${esc(t.body)}</p>
        ${t.href ? `<p class="man-open"><a class="ult-btn ult-btn-outline" href="${esc(t.href)}">Open ${esc(t.title)}</a></p>` : ''}
      </article>`).join('');
    return `
      <section class="man-cat" id="${esc(c.id)}">
        <header class="man-cat-h">
          <h2><span class="man-ref">${esc(c.ref || '')}</span> ${esc(c.title)}</h2>
          ${c.desk ? `<a class="ult-btn ult-btn-outline" href="${esc(c.desk)}">Open desk</a>` : ''}
        </header>
        <p class="man-intro">${esc(c.intro)}</p>
        ${topics}
      </section>`;
  }).join('');
  return `<nav class="man-toc" aria-label="Manual sections">${toc}</nav>${cats}`;
}

function slugLabel(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'desk';
}

const MENU_TO_MANUAL = {
  'operations hub': ['wms', 'chain'],
  'wms': ['wms'],
  'procurement': ['purchases'],
  'records': ['chain'],
  'sales': ['sales', 'hp'],
  'finance': ['accounting'],
  'accounting': ['accounting'],
  'collections': ['crm', 'hp'],
  'crm': ['crm'],
  'field ops': ['field', 'hp'],
  'hrm': ['hrm'],
  'system': ['silo'],
};

function catsForMenuLabel(label) {
  const key = String(label || '').toLowerCase();
  const ids = MENU_TO_MANUAL[key];
  if (ids) return MANUAL.filter((c) => ids.includes(c.id));
  return MANUAL.filter((c) => {
    const t = String(c.title || '').toLowerCase();
    return t === key || t.includes(key) || key.includes(t.split(' ')[0]);
  });
}

export async function manualBodyFromNav() {
  const { MENU } = await import('./ultimate-shell.js');
  const used = new Set();
  const chapters = [];
  for (const mod of (MENU || []).filter((m) => m.label !== 'User Manual')) {
    const cats = catsForMenuLabel(mod.label);
    cats.forEach((c) => used.add(c.id));
    const topics = [];
    cats.forEach((c) => (c.topics || []).forEach((t) => topics.push(t)));
    const intro = cats.map((c) => c.intro).filter(Boolean).join(' ');
    if (!intro && !topics.length) continue;
    chapters.push({
      id: slugLabel(mod.label),
      title: mod.label,
      intro,
      topics,
    });
  }
  MANUAL.filter((c) => !used.has(c.id)).forEach((c) => {
    chapters.push({
      id: c.id,
      title: c.title,
      intro: c.intro || '',
      topics: c.topics || [],
    });
  });
  const toc = chapters.map((c) => `<a href="#${esc(c.id)}">${esc(c.ref || c.title)}</a>`).join('');
  const cats = chapters.map((c) => {
    const topics = (c.topics || []).map((t) => `
      <details class="man-topic" id="${esc(t.id)}">
        <summary><span class="man-ref">${esc(t.ref || refOf(t.id))}</span> ${esc(t.title)}</summary>
        <p>${esc(t.body || '')}</p>
      </details>`).join('');
    return `
      <details class="man-cat" id="${esc(c.id)}" open>
        <summary class="man-cat-h">${esc(c.title)}</summary>
        <p class="man-intro">${esc(c.intro || '')}</p>
        ${topics}
      </details>`;
  }).join('');
  return `<nav class="man-toc" aria-label="Manual sections">${toc}</nav>${cats}`;
}
