/** 7-layer merchandising: Division → Department → Category → Subcategory → Class → Attributes → SKU.
 *  Categories/subcategories come from the cashier tree. Class is the operational template.
 *  Specs are pulled from the product name / model / description — never invented.
 */
import { TREE, classifyProduct } from './catalog-taxonomy.js';

export const DIVISIONS = [
  { id: 'div-elm', code: 'ELM', name: 'Electronics & Mobile' },
  { id: 'div-hap', code: 'HAP', name: 'Home & Appliances' },
];

export const DEPARTMENTS = [
  { id: 'dep-mob', code: 'MOB', name: 'Mobile & Wireless', division_id: 'div-elm' },
  { id: 'dep-cmp', code: 'CMP', name: 'Computing & Gaming', division_id: 'div-elm' },
  { id: 'dep-avs', code: 'AVS', name: 'Audio & Visual', division_id: 'div-elm' },
  { id: 'dep-pwr', code: 'PWR', name: 'Power & Energy', division_id: 'div-elm' },
  { id: 'dep-kit', code: 'KIT', name: 'Kitchen Appliances', division_id: 'div-hap' },
  { id: 'dep-maj', code: 'MAJ', name: 'Major Appliances', division_id: 'div-hap' },
  { id: 'dep-hcm', code: 'HCM', name: 'Home Comfort', division_id: 'div-hap' },
  { id: 'dep-pcw', code: 'PCW', name: 'Personal Care & Wearables', division_id: 'div-hap' },
  { id: 'dep-acc', code: 'ACC', name: 'Accessories', division_id: 'div-hap' },
];

const CAT_DEPT = {
  'Phones & Tablets': 'dep-mob',
  Computing: 'dep-cmp',
  Audio: 'dep-avs',
  'TV & Visual': 'dep-avs',
  Power: 'dep-pwr',
  'Small Kitchen Appliances': 'dep-kit',
  'Coffee Makers': 'dep-kit',
  'Cooking Appliances': 'dep-kit',
  'Major Appliances': 'dep-maj',
  'Vacuums & Floor Care': 'dep-hcm',
  'Heating, Cooling & Air Quality': 'dep-hcm',
  'Home Appliances': 'dep-hcm',
  'Personal Care': 'dep-pcw',
  'Smart & Office': 'dep-pcw',
  Accessories: 'dep-acc',
};

const TAX_CODE = {
  'Phones & Tablets': 'TAX-ELEC-MOBILE',
  Computing: 'TAX-ELEC-IT',
  Audio: 'TAX-ELEC-AV',
  'TV & Visual': 'TAX-ELEC-AV',
  Power: 'TAX-ELEC-POWER',
  'Small Kitchen Appliances': 'TAX-APPLIANCE',
  'Coffee Makers': 'TAX-APPLIANCE',
  'Cooking Appliances': 'TAX-APPLIANCE',
  'Major Appliances': 'TAX-APPLIANCE',
  'Vacuums & Floor Care': 'TAX-APPLIANCE',
  'Heating, Cooling & Air Quality': 'TAX-APPLIANCE',
  'Home Appliances': 'TAX-APPLIANCE',
  'Personal Care': 'TAX-GEN',
  'Smart & Office': 'TAX-ELEC-IT',
  Accessories: 'TAX-GEN',
};

const A = (name, type, required = false) => ({ name, type, required });

const ATTRS = {
  'Phones & Tablets': [
    A('Storage Capacity', 'string', true), A('RAM Size', 'string'), A('Display Size', 'string'),
    A('Network', 'string'), A('Color', 'string'), A('Waterproof Rating', 'string'),
  ],
  Computing: [
    A('GPU Model', 'string'), A('RAM Size', 'string', true), A('Storage Capacity', 'string', true),
    A('Screen Size', 'string'), A('Screen Refresh Rate', 'number'),
  ],
  Audio: [A('Driver Size', 'string'), A('Wireless', 'boolean'), A('Battery Hours', 'number'), A('Color', 'string')],
  'TV & Visual': [
    A('Screen Size', 'string', true), A('Panel Type', 'string'), A('Resolution', 'string'), A('Smart OS', 'string'),
  ],
  Power: [A('Capacity mAh', 'number'), A('Power Watts', 'number'), A('Fast Charge', 'boolean')],
  'Small Kitchen Appliances': [A('Power Watts', 'number'), A('Capacity Litres', 'number'), A('Material', 'string')],
  'Coffee Makers': [A('Power Watts', 'number'), A('Capacity Litres', 'number'), A('Pump Pressure Bar', 'number')],
  'Cooking Appliances': [A('Power Watts', 'number'), A('Burners', 'number'), A('Fuel Type', 'string')],
  'Major Appliances': [
    A('Capacity Litres', 'number'), A('Load kg', 'number'), A('Door Style', 'string'),
    A('Energy Rating', 'string'), A('Frost Free', 'boolean'), A('Inverter', 'boolean'),
  ],
  'Vacuums & Floor Care': [A('Power Watts', 'number'), A('Bagless', 'boolean'), A('Type', 'string')],
  'Heating, Cooling & Air Quality': [
    A('Cooling Capacity HP', 'number'), A('BTU', 'number'), A('Inverter', 'boolean'), A('Energy Rating', 'string'),
  ],
  'Home Appliances': [A('Power Watts', 'number'), A('Material', 'string'), A('Color', 'string')],
  'Personal Care': [A('Power Watts', 'number'), A('Waterproof Rating', 'string'), A('Color', 'string')],
  'Smart & Office': [A('Display Type', 'string'), A('Water Resistance', 'string'), A('Battery Days', 'number')],
  Accessories: [A('Material', 'string'), A('Color', 'string'), A('Compatibility', 'string')],
};

function slug(s) {
  return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
const DIV_BY_ID = Object.fromEntries(DIVISIONS.map((d) => [d.id, d]));

function classCode(parentCode, child) {
  return ('CLASS-' + parentCode + '-' + slug(child).replace(/-/g, '').slice(0, 12)).toUpperCase();
}

export const CLASSES = TREE.flatMap(([catName, catCode, children]) => {
  const dep = DEPT_BY_ID[CAT_DEPT[catName]] || DEPARTMENTS[DEPARTMENTS.length - 1];
  const div = DIV_BY_ID[dep.division_id];
  const attrs = ATTRS[catName] || ATTRS.Accessories;
  return children.map((child) => ({
    id: 'cls-' + catCode.toLowerCase() + '-' + slug(child),
    code: classCode(catCode, child),
    name: child,
    category: catName,
    category_code: catCode,
    subcategory: child,
    department: dep.name,
    department_id: dep.id,
    department_code: dep.code,
    division: div.name,
    division_id: div.id,
    division_code: div.code,
    tax_category_code: TAX_CODE[catName] || 'TAX-GEN',
    attributes: attrs,
  }));
});

const CLASS_BY_LEAF = Object.fromEntries(CLASSES.map((c) => [c.category + '\0' + c.subcategory, c]));

export function placeOf(category, subcategory) {
  const hit = CLASS_BY_LEAF[String(category || '') + '\0' + String(subcategory || '')]
    || CLASSES.find((c) => c.category === category)
    || CLASSES[CLASSES.length - 1];
  return hit;
}

export const MERCH_TABLE_ROWS = CLASSES.map((c) => ({
  id: c.id,
  division: c.division,
  department: c.department,
  category: c.category,
  subcategory: c.subcategory,
  class_name: c.name,
  code: c.code,
  tax_category_code: c.tax_category_code,
  level: 5,
  source: 'merch',
  description: [c.division, c.department, c.category, c.subcategory, c.name].join(' / '),
}));

export function extractSpecs(p = {}) {
  const text = [p.name, p.description, p.model, p.model_number, p.vendor_sku, p.sku, p.brand, p.category, p.subcategory]
    .filter(Boolean).join(' ');
  const out = {};
  const model = p.model_number || p.model || extractModel(p.name || '', text);
  if (model) out.model_number = model;

  const storage = text.match(/\b(\d{2,4})\s*(GB|TB)\b/i);
  if (storage) out['Storage Capacity'] = storage[1] + storage[2].toUpperCase();
  const ram = text.match(/\b(\d{1,2})\s*GB\s*RAM\b/i) || text.match(/\bRAM\s*(\d{1,2})\s*GB\b/i);
  if (ram) out['RAM Size'] = ram[1] + 'GB';
  const screen = text.match(/\b(\d{2}(?:\.\d)?)\s*(?:["”]|''|inch|\bin\b)\b/i);
  if (screen) out['Screen Size'] = screen[1] + '"';
  const display = text.match(/\b(\d(?:\.\d)?)\s*(?:["”]|inch)\s*(?:display|screen)?/i);
  if (display && !out['Display Size'] && Number(display[1]) < 20) out['Display Size'] = display[1] + '"';
  const hp = text.match(/\b(\d(?:\.\d)?)\s*H\.?P\.?\b/i);
  if (hp) out['Cooling Capacity HP'] = Number(hp[1]);
  const btu = text.match(/\b(\d{4,6})\s*BTU\b/i);
  if (btu) out['BTU'] = Number(btu[1]);
  const litres = text.match(/\b(\d{2,4})\s*L(?:itres?)?\b/i);
  if (litres) out['Capacity Litres'] = Number(litres[1]);
  const kg = text.match(/\b(\d(?:\.\d)?)\s*kg\b/i);
  if (kg) out['Load kg'] = Number(kg[1]);
  const mah = text.match(/\b(\d{3,6})\s*mAh\b/i);
  if (mah) out['Capacity mAh'] = Number(mah[1]);
  const watts = text.match(/\b(\d{2,5})\s*(?:W|Watts)\b/i);
  if (watts) out['Power Watts'] = Number(watts[1]);
  const hz = text.match(/\b(\d{2,3})\s*Hz\b/i);
  if (hz) out['Screen Refresh Rate'] = Number(hz[1]);
  const bar = text.match(/\b(\d{1,2})\s*bar\b/i);
  if (bar) out['Pump Pressure Bar'] = Number(bar[1]);
  const burn = text.match(/\b(\d)\s*burner/i);
  if (burn) out['Burners'] = Number(burn[1]);
  const days = text.match(/\b(\d{1,3})\s*days?\s*(?:battery|standby)/i);
  if (days) out['Battery Days'] = Number(days[1]);
  const hours = text.match(/\b(\d{1,3})\s*(?:hrs?|hours)\b/i);
  if (hours) out['Battery Hours'] = Number(hours[1]);

  if (/\binverter\b/i.test(text)) out.Inverter = true;
  if (/\bfrost\s*free\b/i.test(text)) out['Frost Free'] = true;
  if (/\bbagless\b/i.test(text)) out.Bagless = true;
  if (/\bwireless|bluetooth|tws\b/i.test(text)) out.Wireless = true;
  if (/\bfast\s*charg/i.test(text)) out['Fast Charge'] = true;
  if (/\b5g\b/i.test(text)) out.Network = '5G';
  else if (/\b4g|lte\b/i.test(text)) out.Network = '4G';
  if (/\bqled\b/i.test(text)) out['Panel Type'] = 'QLED';
  else if (/\boled\b/i.test(text)) out['Panel Type'] = 'OLED';
  else if (/\bmini.?led\b/i.test(text)) out['Panel Type'] = 'Mini-LED';
  else if (/\bled\b/i.test(text)) out['Panel Type'] = 'LED';
  if (/\b4k|uhd|2160p\b/i.test(text)) out.Resolution = '4K UHD';
  else if (/\bfhd|1080p\b/i.test(text)) out.Resolution = 'Full HD';
  if (/\bgas\b/i.test(text)) out['Fuel Type'] = 'Gas';
  else if (/\binduction\b/i.test(text)) out['Fuel Type'] = 'Induction';
  else if (/\belectric\b/i.test(text) && /cook|oven|stove/i.test(text)) out['Fuel Type'] = 'Electric';
  if (/\btop\s*load/i.test(text)) out.Type = 'Top Load';
  else if (/\bfront\s*load/i.test(text)) out.Type = 'Front Load';
  if (/\bfrench\s*door/i.test(text)) out['Door Style'] = 'French Door';
  else if (/\bside\s*by\s*side/i.test(text)) out['Door Style'] = 'Side by Side';
  else if (/\bdouble\s*door/i.test(text)) out['Door Style'] = 'Double Door';
  else if (/\bsingle\s*door/i.test(text)) out['Door Style'] = 'Single Door';
  const ip = text.match(/\b(IPX?\d{1,2})\b/i);
  if (ip) out['Waterproof Rating'] = ip[1].toUpperCase();
  const color = text.match(/\b(black|white|silver|gold|blue|red|grey|gray|green|purple|titanium|beige|inox|navy)\b/i);
  if (color) out.Color = color[1].charAt(0).toUpperCase() + color[1].slice(1).toLowerCase();
  return out;
}

function extractModel(name, text) {
  const n = String(name || '');
  const galaxy = n.match(/\b(Galaxy\s+[A-Z]?\d{1,2}\w*(?:\s*(?:Plus|Ultra|FE))?)/i);
  if (galaxy) return galaxy[1];
  const fromName = n.match(/\b([A-Z]{2,6}[- ]?\d{2,5}[A-Z0-9-]{0,10})\b/);
  if (fromName) return fromName[1].replace(/\s+/g, '-');
  const fromText = String(text || '').match(/\b(SM-[A-Z0-9]+|OTW-?\d+|OBS-?\d+|RF\d{2}[A-Z0-9]+|WA\d{2}[A-Z0-9]+)\b/i);
  return fromText ? fromText[1] : '';
}

const STORE_BRANDS = [
  'Infinix', 'Tecno', 'Itel', 'Samsung', 'Apple', 'iPhone', 'Oraimo', 'Hisense',
  'Nokia', 'Xiaomi', 'Redmi', 'POCO', 'Huawei', 'Honor', 'Vivo', 'Oppo', 'Realme',
  'Motorola', 'Google', 'OnePlus', 'LG', 'Sony', 'TCL', 'Skyworth', 'Nasco',
  'Midea', 'Binatone', 'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Toshiba',
  'Canon', 'Epson', 'JBL', 'Anker', 'Baseus', 'Franko',
];

/** Fill brand / model / size / color so Filters, tables, and Woo line up. */
export function alignStoreFields(p = {}) {
  const name = String(p.name || '');
  const specs = extractSpecs(p);
  let brand = String(p.brand || '').trim();
  if (!brand) {
    const hit = STORE_BRANDS.find((b) => new RegExp('\\b' + b.replace(/\s+/g, '\\s+') + '\\b', 'i').test(name));
    if (hit) brand = hit === 'iPhone' ? 'Apple' : hit;
  }
  let model = String(p.model || p.model_number || p.device_model || specs.model_number || '').trim();
  if (!model && brand) {
    model = name
      .replace(new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '')
      .replace(/\b(black|white|silver|gold|blue|red|grey|gray|green|purple|pink|titanium|beige|navy)\b/ig, '')
      .replace(/\b\d{2,4}\s*(GB|TB)\b/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  const color = String(p.color || p.colour || specs.Color || '').trim();
  const size = String(p.size || specs['Storage Capacity'] || specs['Screen Size'] || specs['Capacity Litres'] || specs['Display Size'] || '').trim();
  return {
    ...p,
    brand: brand || p.brand || '',
    model: model || p.model || '',
    model_number: p.model_number || model || '',
    color,
    colour: color,
    size,
  };
}

export function specsCaption(attrs = {}) {
  return Object.entries(attrs || {})
    .filter(([, v]) => v !== '' && v != null && v !== false)
    .map(([k, v]) => (v === true ? k : String(v)))
    .slice(0, 4)
    .join(' · ');
}

export function stampMerch(p = {}) {
  const tax = classifyProduct({
    ...p,
    category: p.source_category || p.category,
    source_category: p.source_category || p.category,
  });
  const place = placeOf(tax.category, tax.subcategory);
  const specs = extractSpecs({ ...p, category: tax.category, subcategory: tax.subcategory });
  const model = specs.model_number || p.model_number || p.model || '';
  const attrs = { ...(typeof p.attributes === 'object' && p.attributes ? p.attributes : {}) };
  Object.entries(specs).forEach(([k, v]) => {
    if (k === 'model_number') return;
    if (attrs[k] == null || attrs[k] === '') attrs[k] = v;
  });
  return {
    ...p,
    source_category: p.source_category || p.category || '',
    category: tax.category,
    subcategory: tax.subcategory,
    category_id: tax.category_id,
    subcategory_id: tax.subcategory_id,
    division: place.division,
    division_id: place.division_id,
    department: place.department,
    department_id: place.department_id,
    class_name: place.name,
    class_id: place.id,
    class_code: place.code,
    model: model || p.model || '',
    model_number: model,
    color: p.color || p.colour || specs.Color || '',
    colour: p.color || p.colour || specs.Color || '',
    size: p.size || specs['Storage Capacity'] || specs['Screen Size'] || specs['Capacity Litres'] || '',
    title: p.title || p.name,
    lifecycle_status: p.lifecycle_status || (p.is_active === false ? 'phase_out' : 'active'),
    tax_category_code: p.tax_category_code || place.tax_category_code,
    attributes: attrs,
    sku_code: p.sku_code || p.sku || '',
    upc_barcode: p.upc_barcode || p.barcode || '',
    safety_stock_level: p.safety_stock_level ?? p.alert_quantity ?? 5,
    is_active: p.is_active !== false,
  };
}

export function merchTreePayload() {
  return {
    divisions: DIVISIONS,
    departments: DEPARTMENTS,
    classes: CLASSES.map(({ attributes, ...c }) => ({ ...c, attribute_names: attributes.map((a) => a.name) })),
    class_attribute_definitions: CLASSES.flatMap((c) => c.attributes.map((a, i) => ({
      id: c.id + '-a' + i,
      class_id: c.id,
      attribute_name: a.name,
      data_type: a.type,
      is_required: a.required,
    }))),
  };
}
