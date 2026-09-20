/** Shared Orientation / Welcome Package / Training bodies (HRM right pane + staff pages). */
import { deptLibraryBody } from './dept-training.js';

export const INDUCTION_PANES = [
  { key: 'orient', label: 'Orientation' },
  { key: 'welcome', label: 'Welcome Package' },
  { key: 'train', label: 'Training' },
];

export const TRAIN_MODULES = [
  { id: 'erp', title: 'How the ERP is laid out', body: '<p>Home is your floor. My Profile is yours. Orientation and the Welcome Package explain the group. Training is the classroom. Extra menus appear only after HRM activates your role.</p>' },
  { id: 'pos', title: 'POS / Register', body: '<p>Open POS from the header. Search starts showing products as you type. Cart and Pay are separate: Pay shows the checkout summary. Print offers paper, WhatsApp, or email. Only a manager PIN can override the till catalogue filter.</p>' },
  { id: 'cat', title: 'Catalogue and SKUs', body: '<p>Each subsidiary uses its own SKU prefix (FIB, AXI, DEL, BNP). The Virtual Warehouse coordinates stock between locations. Do not create duplicate names — search first.</p>' },
  { id: 'pay', title: 'Cash, MoMo, and bank', body: '<p>Ghana tills take cash, MTN / Vodafone / AirtelTigo MoMo, bank transfer, and cheque. The amount you tender must match the sale. Strict denomination applies when it is switched on for that method.</p>' },
  { id: 'field', title: 'Field Ops', body: '<p>BNPL Field Sales is agent-led hire purchase. Selecting BNPL (Hire Purchase) and BNPL Field Sales together opens Field Ops. Agents on the left, customers on the right.</p>' },
  { id: 'key', title: 'Access key and notifications', body: '<p>When an administrator assigns your role they send a key to the bell and to your registered email. Head office: <strong>HO-XXXX-XXXX</strong> (group dashboard). Operations: <strong>OP-XXXX-XXXX</strong> (till or field). Enter it on Orientation. Never forward the key to a colleague.</p>' },
  { id: 'comms', title: 'Communications', body: '<p>Teal Communications module: Floor tiles, Announcements (HQ publish), Messages, Calls / Meetings if your role may call, To Do, Documents / Memos, Reminders, Knowledge Base (staff manuals 01–06). View is seeing. Send / Publish writes. Call Centre and Collections are other desks.</p>' },
  { id: 'reports', title: 'Reports', body: '<p>Left menu Reports. You View, Print, and Export — you do not type. Set location and date first. Register Report is the shift check. P&L is not the Tax Report. Collections reports are summaries; work accounts on the Collections desk.</p>' },
  { id: 'dash', title: 'Custom Dashboards', body: '<p>Colour module. Manage = list. Create = builder. Actions: View, Edit, Clone, Delete. A board shows live figures; it does not change the books. HQ assigns who lands on which board after login.</p>' },
  { id: 'sheets', title: 'Spreadsheets', body: '<p>Folder tree + Sheets tab. Add folder / sheet, View or Edit a grid, Download CSV. BNPL Field Ops sheets are Live — typing does not stick; open the Field Ops table instead. This is not the ledger.</p>' },
];

export const WELCOME_CHECKS = [
  { id: 'read-orient', label: 'Read Orientation (companies, Field Ops, Virtual Warehouse)' },
  { id: 'profile', label: 'Complete My Profile — More Informations and Bank Details' },
  { id: 'key', label: 'Enter your access key when the administrator issues it' },
  { id: 'train', label: 'Finish the Training modules (POS, catalogue, MoMo, field)' },
  { id: 'support', label: 'Save support contacts: support@delkorfiberk.com · 054 644 3323' },
];

export function companiesGrid() {
  return `<div class="or-grid">
    <div class="or-co"><strong>Operations Hub</strong><span>Default warehouse. Goods sit here until a store or agent receives them.</span></div>
    <div class="or-co"><strong>FIBERK</strong><span>Electronics — Fiberk Shop.</span></div>
    <div class="or-co"><strong>AXIDIGETEK</strong><span>eCommerce — Online Store.</span></div>
    <div class="or-co"><strong>DELKOR LOGISTICS</strong><span>Furniture Market.</span></div>
    <div class="or-co"><strong>BUYNOWPAYSLATER</strong><span>Hire purchase — Market (Field) and Online Shop.</span></div>
    <div class="or-co"><strong>Operations Hub</strong><span>Physical stock for every company until it is transferred out.</span></div>
  </div>`;
}

export function orientationBody() {
  return `
    <div class="or-card"><h2>Welcome to Delkor-Fiberk</h2>
      <p>DELKOR-FIBERK is the growing company behind Ghana's retail, logistics, and hire purchase business. Staff work either in the Operations Hub (group specialists) or in an operating company.</p></div>
    <div class="or-card"><h2>The companies</h2>${companiesGrid()}</div>
    <div class="or-card"><h2>Field Ops</h2>
      <p>Agents on the left, customers on the right. Field work is strongest at BNPL Field Sales.</p></div>
    <div class="or-card"><h2>What staff do next</h2>
      <ol>
        <li>Complete My Profile (More Informations and Bank Details).</li>
        <li>Work through the Welcome Package checklist.</li>
        <li>Finish Training. HRM then activates extra role menus.</li>
      </ol>
      <p>Support: support@delkorfiberk.com · 054 644 3323</p></div>`;
}

export function welcomeBody(name, email, done) {
  return `
    <div class="or-card"><h2>Welcome${name ? ', ' + name : ''}</h2>
      <p>Until extra role access is switched on, Home, My Profile, Orientation, Welcome Package, and Training are the working menus. Registered email: <strong>${email || '—'}</strong></p></div>
    <div class="or-card"><h2>First-week checklist</h2>
      ${WELCOME_CHECKS.map((it) => `<label class="learn-check"><input type="checkbox" data-welcome="${it.id}" ${done?.[it.id] ? 'checked' : ''}/><span>${it.label}</span></label>`).join('')}</div>
    <div class="or-card"><h2>How the group is organised</h2>${companiesGrid()}</div>
    <div class="or-card"><h2>Conduct</h2>
      <ul>
        <li>Cash, MoMo, and bank must match the till you are signed into.</li>
        <li>Do not share your access key, POS PIN, or login.</li>
        <li>Field agents: customers on the right, agents on the left.</li>
      </ul></div>`;
}

export function trainingBody(done) {
  return `${TRAIN_MODULES.map((m) => `
    <div class="mod ${done?.[m.id] ? 'open' : ''}" data-mod="${m.id}">
      <button type="button" data-toggle-mod><span>${m.title}</span><span class="done">${done?.[m.id] ? 'Complete' : 'Open'}</span></button>
      <div class="body">${m.body}<button type="button" class="go" data-train="${m.id}">${done?.[m.id] ? 'Completed' : 'Mark complete'}</button></div>
    </div>`).join('')}
    ${deptLibraryBody()}`;
}
