/** Public contact enrichment for known electronics suppliers.
 * Only fields found on official or directory pages. Blanks stay blank.
 * Informal Circle/Tip Toe stalls are not invented.
 */
import { readLs, writeLs } from './ls-rows.js';

const FTE = {
  trade: 'Franko Trading Enterprise / Franko Trading Company Limited',
  phones: 'Phones, laptops, TVs, fridges, ACs, appliances, accessories',
  phone: '0302225651 / 0246422338',
  mobile: '0503607980',
  website: 'https://www.frankotrading.com',
  facebook: 'https://www.facebook.com/frankotradingenterprise',
  instagram: 'https://www.instagram.com/frankotrading_fte/',
  pay_term: '',
  tax_number: '',
  source_note: 'Official site + @frankotrading_fte + Facebook Franko Trading Enterprise. WhatsApp 0503607980.',
};

export const SUPPLIER_PUBLIC = {
  's-franko-head-office': {
    ...FTE,
    name: 'FRANKO HEAD-OFFICE',
    address: 'Adabraka, opposite Roxy Cinema / Roxy Bus Stop, Kwame Nkrumah Ave, Accra',
    city: 'Accra',
    email: '',
  },
  's-franko-circle': {
    ...FTE,
    name: 'FRANKO CIRCLE',
    address: 'Near Odo Rice Building, Circle, Accra',
    city: 'Accra',
    email: '',
  },
  's-franko-madina': {
    ...FTE,
    name: 'FRANKO MADINA',
    address: 'Madina Old Road, near Barclays and HFC Building, Madina',
    city: 'Madina',
    phone: '0302225651 / 0246422338',
    email: '',
  },
  's-oraimo-online-wholesale': {
    name: 'ORAIMO ONLINE WHOLESALE',
    trade: 'oraimo Ghana — audio, wearables, chargers, accessories (authorised brand office, not a Circle stall)',
    phones: 'Audio, smart wearables, chargers, power accessories',
    address: 'Akasanoma Road, Circle, Accra (opposite Korle Klottey Municipal Assembly; same building as Tecno office)',
    city: 'Accra',
    phone: '0503619600 / 0599518688 / 0503618990',
    mobile: '0534529584',
    email: 'care.gh@oraimo.com',
    website: 'https://gh.oraimo.com',
    facebook: 'https://www.facebook.com/oraimoghana/',
    instagram: 'https://www.instagram.com/oraimoghana/',
    tax_number: '',
    pay_term: '',
    source_note: 'gh.oraimo.com/pages/contact-us. Delivery issues: deliveryissue.gh@oraimo.com. WhatsApp 0534529584.',
  },
  's-telefonika-east-legon': {
    name: 'TELEFONIKA EAST LEGON',
    trade: 'Telefonika Ghana Limited — phones, laptops, gadgets, accessories',
    phones: 'Phones, laptops, gadgets, accessories',
    address: 'Lagos Avenue, East Legon, Accra (also a second East Legon shop on Boundary Road)',
    city: 'East Legon',
    phone: '0593873333',
    mobile: '0550333393',
    email: 'info@telefonika.com',
    website: 'https://telefonika.com',
    facebook: 'https://www.facebook.com/TelefonikaGhana/',
    instagram: 'https://www.instagram.com/telefonika.gh/',
    tax_number: '',
    pay_term: '',
    source_note: 'telefonika.com store list. HQ listing also 0540104881 / info@telefonika.com. VAT on an older directory listing not confirmed.',
  },
  's-mr-jeremiah-odjeawo': {
    name: 'MR JEREMIAH ODJEAWO',
    trade: 'Pinaro General Ventures — same supplier as Mr Jeremiah Odjeawo',
    phones: 'Phones (Tecno, Infinix, Itel and similar)',
    address: 'P.O. Box 21, Odumase, Madina and Circle',
    city: 'Madina',
    phone: '0203964954',
    mobile: '0545325648',
    email: 'philipodjeawon@gmail.com',
    website: '',
    facebook: '',
    instagram: '',
    tax_number: '',
    pay_term: '',
    source_note: 'Paper invoice 00475 + live supplier pin-sup-pinaro. Not a public web listing.',
  },
};

const NAME_ALIAS = [
  [/franko.*head/i, 's-franko-head-office'],
  [/franko.*circle/i, 's-franko-circle'],
  [/franko.*madina/i, 's-franko-madina'],
  [/oraimo/i, 's-oraimo-online-wholesale'],
  [/telefonika/i, 's-telefonika-east-legon'],
  [/jeremiah|odjeawo|pinaro/i, 's-mr-jeremiah-odjeawo'],
];

export function enrichKey(row) {
  const id = String(row.contact_id || row.id || '').toLowerCase();
  if (SUPPLIER_PUBLIC[id]) return id;
  const name = String(row.name || '');
  const hit = NAME_ALIAS.find(([re]) => re.test(name));
  return hit ? hit[1] : '';
}

export function enrichSupplier(row) {
  const key = enrichKey(row);
  const pub = key ? SUPPLIER_PUBLIC[key] : null;
  if (!pub) {
    return {
      ...row,
      source_note: row.source_note || 'No public electronics-company listing found. Circle / Tip Toe stall names are not filled from the web.',
    };
  }
  const fill = (a, b) => (a && String(a).replace(/[—\-]/g, '').trim() ? a : b);
  return {
    ...row,
    phone: fill(row.phone, pub.phone),
    mobile: fill(row.mobile, pub.mobile),
    email: fill(row.email, pub.email),
    address: fill(row.address, pub.address),
    city: fill(row.city, pub.city),
    website: fill(row.website, pub.website),
    facebook: fill(row.facebook, pub.facebook),
    instagram: fill(row.instagram, pub.instagram),
    tax_number: fill(row.tax_number, pub.tax_number),
    pay_term: fill(row.pay_term, pub.pay_term),
    notes: [row.notes, pub.trade, pub.source_note].filter(Boolean).join(' · '),
    source_note: pub.source_note,
  };
}

export function enrichSupplierList(rows) {
  return (rows || []).map(enrichSupplier);
}

export function persistEnrichedSuppliers(key = 'df_suppliers') {
  const cur = readLs(key, []) || [];
  if (!cur.length) return cur;
  const next = enrichSupplierList(cur);
  writeLs(key, next);
  return next;
}
