/**
 * Delkor-Fiberk CRM parties
 *
 * CONTACT  — identity. Anyone we keep details for. sales_orders.customer_id → contacts.id
 * CUSTOMER — trade card. Allowed to buy / has bought at a till. customers.contact_id → contacts
 * CLIENT   — relationship account (BNPL, corporate, logistics, repair). clients.contact_id → contacts
 */
import { supabase } from './supabaseClient.js';

export const PARTY = {
  contact: {
    key: 'contact',
    label: 'Contact',
    meaning: 'Anyone we keep details for. No sale required — leads, dispatch, next-of-kin, supplier staff.',
  },
  customer: {
    key: 'customer',
    label: 'Customer',
    meaning: 'Allowed to buy, or has bought, at a till. Retail / cash wholesale. POS searches this list.',
  },
  client: {
    key: 'client',
    label: 'Client',
    meaning: 'Ongoing account we manage: BNPL, corporate, logistics contract, repair retainer. Has an account manager.',
  },
};

export function digitsPhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

export function mapsUrl(c) {
  if (!c) return '';
  const lat = Number(c.lat), lng = Number(c.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  const q = [c.ghana_post_gps, c.address_line, c.suburb, c.city, 'Accra Ghana']
    .filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

const ID_COLS = 'id, name, phone, email, ghana_post_gps, address_line, suburb, city, region, lat, lng, ghana_card, notes, kind, subsidiary_code, source, created_at';
const CUST_COLS = ID_COLS + ', customer_type, credit_limit, preferred_agent, group_name, contact_id, contact_code, pay_term, pay_term_type, opening_balance, loyalty_card, loyalty_points, momo_wallet, tax_number, customer_group_id, is_default, is_active, first_name, last_name, middle_name, business_name, shipping_address, alternate_number';

async function peelInsert(table, payload, extraPeel = []) {
  Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
  delete payload.additional_number;
  const missing = (msg) => {
    const s = String(msg || '');
    const m = s.match(/Could not find the '([^']+)' column/i)
      || s.match(/column "([^"]+)" of relation/i);
    return m?.[1] || null;
  };
  let q = await supabase.from(table).insert(payload).select('*').single();
  for (let i = 0; i < 40 && q.error; i++) {
    const col = missing(q.error.message);
    if (!col || !(col in payload)) break;
    delete payload[col];
    q = await supabase.from(table).insert(payload).select('*').single();
  }
  if (!q.error) return q;
  const peel = ['ghana_post_gps', 'address_line', 'suburb', 'region', 'lat', 'lng', 'ghana_card', 'notes', 'kind', 'source', 'subsidiary_code', 'city', 'contact_id', 'customer_type', 'credit_limit', 'preferred_agent', 'group_name', 'client_type', 'account_no', 'account_manager', 'status', 'contact_code', 'pay_term', 'pay_term_type', 'opening_balance', 'loyalty_card', 'loyalty_points', 'momo_wallet', 'tax_number', 'customer_group_id', 'is_default', 'is_active', 'first_name', 'last_name', 'middle_name', 'business_name', 'shipping_address', 'alternate_number', ...extraPeel];
  for (const k of peel) {
    if (!(k in payload)) continue;
    delete payload[k];
    const r2 = await supabase.from(table).insert(payload).select('*').single();
    if (!r2.error) return r2;
    q = r2;
  }
  return q;
}

export async function upsertContact(row) {
  const phone = (row.phone || '').trim();
  if (phone) {
    const { data: all } = await supabase.from('contacts').select(ID_COLS).limit(400);
    const tail = digitsPhone(phone).slice(-9);
    const hit = (all || []).find((c) => digitsPhone(c.phone).endsWith(tail) && tail.length >= 9);
    if (hit) return { data: hit, error: null };
  }
  return peelInsert('contacts', {
    type: row.type || (row.source === 'supplier' ? 'supplier' : 'customer'),
    name: row.name,
    phone: row.phone || null,
    email: row.email || null,
    ghana_post_gps: row.ghana_post_gps || null,
    address_line: row.address_line || null,
    suburb: row.suburb || null,
    city: row.city || 'Accra',
    region: row.region || 'Greater Accra',
    ghana_card: row.ghana_card || null,
    notes: row.notes || null,
    kind: row.kind || 'person',
    source: row.source || 'crm',
    subsidiary_code: row.subsidiary_code || null,
  });
}

export async function saveCustomer(row) {
  const contactRes = await upsertContact({ ...row, source: row.source || 'customer' });
  if (contactRes.error || !contactRes.data) return contactRes;
  const contact = contactRes.data;
  const payload = {
    name: row.name,
    phone: row.phone || null,
    email: row.email || null,
    ghana_post_gps: row.ghana_post_gps || null,
    address_line: row.address_line || null,
    suburb: row.suburb || null,
    city: row.city || 'Accra',
    region: row.region || 'Greater Accra',
    ghana_card: row.ghana_card || null,
    notes: row.notes || null,
    customer_type: row.customer_type || 'retail',
    group_name: row.group_name || 'Retail',
    credit_limit: row.credit_limit || 0,
    preferred_agent: row.preferred_agent || null,
    subsidiary_code: row.subsidiary_code || null,
    contact_id: contact.id,
    contact_code: row.contact_code || null,
    momo_wallet: row.momo_wallet || null,
    tax_number: row.tax_number || null,
    pay_term: row.pay_term ?? null,
    pay_term_type: row.pay_term_type || 'days',
    opening_balance: row.opening_balance || 0,
    loyalty_card: row.loyalty_card || row.contact_code || null,
    customer_group_id: row.customer_group_id || null,
  };
  if (row.id) {
    const id = row.id;
    const { id: _i, ...upd } = payload;
    let q = await supabase.from('customers').update(upd).eq('id', id).select('id, name, phone, contact_id').single();
    if (q.error) q = await supabase.from('customers').update({ name: payload.name, phone: payload.phone, email: payload.email }).eq('id', id).select('id, name, phone').single();
    return { data: { ...(q.data || {}), contact_id: contact.id }, error: q.error };
  }
  const q = await peelInsert('customers', payload);
  return { data: { ...(q.data || {}), contact_id: contact.id }, error: q.error };
}

export async function saveClient(row) {
  const contactRes = await upsertContact({ ...row, source: 'client' });
  if (contactRes.error || !contactRes.data) return contactRes;
  const contact = contactRes.data;
  return peelInsert('clients', {
    contact_id: contact.id,
    name: row.name,
    phone: row.phone || null,
    client_type: row.client_type || 'bnpl',
    account_no: row.account_no || ('CL-' + Date.now().toString().slice(-6)),
    credit_limit: row.credit_limit || 0,
    subsidiary_code: row.subsidiary_code || null,
    account_manager: row.account_manager || row.preferred_agent || null,
    notes: row.notes || null,
    status: 'active',
  });
}

export async function searchCustomers(q, limit = 12) {
  return searchTable('customers', CUST_COLS, q, limit);
}

export async function searchContacts(q, limit = 12) {
  return searchTable('contacts', ID_COLS, q, limit);
}

async function searchTable(table, cols, q, limit) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const digits = digitsPhone(term);
  let query = supabase.from(table).select(cols).limit(limit);
  if (digits.length >= 9) query = query.or(`phone.ilike.%${digits.slice(-9)}%,phone.ilike.%${term}%`);
  else query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,contact_code.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) {
    const { data: fb } = await supabase.from(table).select('id, name, phone, email').ilike('name', `%${term}%`).limit(limit);
    return fb || [];
  }
  return data || [];
}

export async function matchByPhone(phone) {
  const d = digitsPhone(phone);
  if (d.length < 9) return null;
  const tail = d.slice(-9);
  const { data } = await supabase.from('customers').select(CUST_COLS).limit(80);
  const hit = (data || []).find((c) => digitsPhone(c.phone).endsWith(tail));
  return hit || null;
}

export async function loadCustomer360(id) {
  if (!id) return empty360();
  let customer = (await supabase.from('customers').select(CUST_COLS).eq('id', id).maybeSingle()).data;
  if (!customer) {
    const slim = await supabase.from('customers').select('id, name, phone, email').eq('id', id).maybeSingle();
    customer = slim.data;
  }
  if (!customer) return empty360();
  return attachHistory(customer);
}

export async function loadContact360(contactId) {
  if (!contactId) return empty360();
  const { data: contact } = await supabase.from('contacts').select(ID_COLS).eq('id', contactId).maybeSingle();
  const { data: customer } = await supabase.from('customers').select(CUST_COLS).eq('contact_id', contactId).maybeSingle();
  const { data: client } = await supabase.from('clients').select('*').eq('contact_id', contactId).maybeSingle();
  const base = customer || contact;
  const bundle = await attachHistory(base, contactId);
  bundle.contact = contact;
  bundle.customer = customer;
  bundle.client = client;
  bundle.hats = [
    contact ? 'contact' : null,
    customer ? 'customer' : null,
    client ? 'client' : null,
  ].filter(Boolean);
  return bundle;
}

function empty360() {
  return { customer: null, contact: null, client: null, sales: [], enquiries: [], hats: [] };
}

async function attachHistory(person, contactId) {
  const name = person?.name || '';
  const cid = contactId || person?.contact_id || null;
  const id = person?.id;
  let salesFilter = [];
  if (cid) salesFilter.push(`customer_id.eq.${cid}`);
  if (id) salesFilter.push(`customer_id.eq.${id}`);
  if (name) salesFilter.push(`customer_name.eq.${name}`);
  const [so, eq] = await Promise.all([
    salesFilter.length
      ? supabase.from('sales_orders').select('id, reference, status, total_amount, created_at, notes, payment_method, subsidiary_code, location_name, customer_name')
        .or(salesFilter.join(',')).order('created_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
    supabase.from('crm_enquiries').select('*')
      .or([id ? `customer_id.eq.${id}` : '', cid ? `contact_id.eq.${cid}` : ''].filter(Boolean).join(',') || 'customer_id.eq.00000000-0000-0000-0000-000000000000')
      .order('enquiry_date', { ascending: false }).limit(40),
  ]);
  let sales = so.data || [];
  if (so.error && name) {
    const r2 = await supabase.from('sales_orders').select('id, reference, status, total_amount, created_at, notes, customer_name')
      .eq('customer_name', name).order('created_at', { ascending: false }).limit(40);
    sales = r2.data || [];
  }
  return { customer: person, contact: null, client: null, sales, enquiries: eq.data || [], hats: ['customer'] };
}

export async function addEnquiry(row) {
  const { data, error } = await supabase.from('crm_enquiries').insert(row).select('id').single();
  return { data, error };
}

export async function listParties() {
  const [c, u, l] = await Promise.all([
    supabase.from('contacts').select('*').order('name').limit(400),
    supabase.from('customers').select('*').order('name').limit(400),
    supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(400),
  ]);
  return {
    contacts: c.data || [],
    customers: u.data || [],
    clients: l.data || [],
    errors: [c.error, u.error, l.error].filter(Boolean).map((e) => e.message),
  };
}

/** Salesforce/Odoo-style lead funnel. Won = converted Customer (POS can sell). */
export const LEAD_STAGES = [
  { id: 'new', label: 'New', hint: 'Captured, not worked' },
  { id: 'contacted', label: 'Contacted', hint: 'First call / WhatsApp' },
  { id: 'qualified', label: 'Qualified', hint: 'Need + budget + location' },
  { id: 'quoted', label: 'Quoted', hint: 'Price / quotation sent' },
  { id: 'negotiation', label: 'Negotiation', hint: 'Terms, BNPL, trade-in' },
  { id: 'won', label: 'Won', hint: 'Converted to customer' },
  { id: 'lost', label: 'Lost', hint: 'Closed, not buying' },
];

export async function loadLeads() {
  const { data, error } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false }).limit(400);
  return { rows: data || [], error };
}

export async function saveLead(row) {
  const payload = { ...row };
  Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
  if (payload.id) {
    const id = payload.id; delete payload.id;
    payload.updated_at = new Date().toISOString();
    let q = await supabase.from('crm_leads').update(payload).eq('id', id).select('*').single();
    if (q.error) {
      const slim = { status: payload.status, name: payload.name, phone: payload.phone, email: payload.email, company: payload.company, value_estimate: payload.value_estimate };
      q = await supabase.from('crm_leads').update(slim).eq('id', id).select('*').single();
    }
    return q;
  }
  if (!payload.status) payload.status = 'new';
  return peelInsert('crm_leads', payload, ['source', 'product_interest', 'ghana_post_gps', 'suburb', 'owner_email', 'score', 'lost_reason', 'next_action', 'next_action_at', 'converted_customer_id']);
}

export async function logLeadActivity(row) {
  return peelInsert('crm_activities', {
    lead_id: row.lead_id,
    kind: row.kind || 'note',
    body: row.body,
    agent_email: row.agent_email,
  }, ['kind', 'agent_email']);
}

export async function loadLeadActivities(leadId) {
  const { data } = await supabase.from('crm_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}

export async function convertLead(lead, { asClient = false, clientType = 'bnpl', agent } = {}) {
  const cust = await saveCustomer({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    ghana_post_gps: lead.ghana_post_gps,
    suburb: lead.suburb,
    city: lead.city || 'Accra',
    region: 'Greater Accra',
    notes: 'Converted from CRM lead',
    customer_type: asClient ? clientType : 'retail',
    group_name: asClient ? (clientType === 'bnpl' ? 'BNPL' : 'Wholesale') : 'Retail',
    preferred_agent: agent || lead.owner_email,
    subsidiary_code: lead.subsidiary_code,
    source: 'crm-convert',
  });
  if (cust.error) return cust;
  if (asClient) {
    await saveClient({
      name: lead.name,
      phone: lead.phone,
      client_type: clientType,
      account_manager: agent || lead.owner_email,
      subsidiary_code: lead.subsidiary_code,
      notes: 'Converted from won lead',
    });
  }
  await saveLead({
    id: lead.id,
    status: 'won',
    converted_customer_id: cust.data?.id || null,
  });
  await logLeadActivity({
    lead_id: lead.id,
    kind: 'convert',
    body: 'Converted to customer' + (asClient ? ' + client account' : ''),
    agent_email: agent,
  });
  return { data: { customer: cust.data }, error: null };
}
