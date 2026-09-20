/** Retail category tree for cashiers / agents / purchase orders.
 *  Benchmark: Newegg Appliances store departments + Ghana electronics from our live catalogues.
 *  Category = department. Subcategory = the searchable product type.
 *  Empty leaves stay — they tell us how to place the next order.
 */

function slug(s) {
  return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function catId(name) {
  return 'cat-' + slug(name).replace(/\s+/g, '-');
}
function subId(parentCode, child) {
  return 'sub-' + String(parentCode).toLowerCase() + '-' + slug(child).replace(/\s+/g, '-');
}

/** Canonical tree. Parent code is the short department code. */
export const TREE = [
  ['Phones & Tablets', 'PHN', [
    'Mobile Phones', 'Smart Phones', 'Tablets',
  ]],
  ['Computing', 'CMP', ['Laptops', 'Desktops', 'Computers']],
  ['Audio', 'AUD', [
    'Earbuds', 'Open-ear Headphones', 'Over-ear Headphones',
    'Neckband Earphones', 'Wired Earphones',
    'Speakers', 'Bluetooth Speakers', 'Sound Bars', 'Sound Towers', 'Projectors',
  ]],
  ['TV & Visual', 'TVA', ['Televisions', 'Smart TVs', 'LED', 'Mini-LED', 'QLED', 'OLED']],
  ['Power', 'PWR', [
    'Power Banks', 'Wall Chargers', 'Cables', 'Hubs & Adapters', 'Car Chargers',
    'Wall Sockets', 'Generators', 'Power Stations', 'Hybrid Inverters',
    'Home Solar Systems', 'Lead-acid Batteries',
  ]],
  ['Small Kitchen Appliances', 'SKA', [
    'Blenders', 'Food Mixers', 'Food Processors', 'Fryers', 'Air Fryers',
    'Juicers & Extractors', 'Pressure Cookers', 'Rice Cookers',
    'Slow Cookers & Egg Cookers', 'Steamers', 'Toasters', 'Toaster Ovens',
    'Electric Kettles', 'Ice Makers', 'Sandwich Makers', 'Water Dispensers',
    'Electric Skillets & Woks', 'Bread Makers', 'Induction Cookers',
    'Specialty Appliances',
  ]],
  ['Coffee Makers', 'COF', [
    'Automatic Coffee Makers', 'Single-Serve Brewers',
    'Espresso & Cappuccino Machines', 'Coffee Grinders', 'Combination Machines',
  ]],
  ['Cooking Appliances', 'CKG', [
    'Microwaves', 'Cooktops', 'Gas Cookers', 'Built-in Ovens',
    'Free Standing Ovens', 'Range Hoods', '4 Burner', '5 Burner',
  ]],
  ['Major Appliances', 'MAJ', [
    'Refrigerators', 'Freezers', 'Chest Freezers', 'Side by Side',
    'Double Door', 'Single Door', 'Top Freezer', 'Bottom Freezer',
    'French Doors', 'Table Top', 'Display Fridge',
    'Washing Machines', 'Top Load', 'Front Load', 'Dryers',
    'Washer & Dryer Combo', 'Dishwashers', 'Appliance Parts',
  ]],
  ['Vacuums & Floor Care', 'VAC', [
    'Upright Vacuums', 'Broom & Stick Vacuums', 'Robotic Vacuums',
    'Canister Vacuums', 'Hand Held Vacuums', 'Carpet & Steam Cleaners',
    'Vacuum Accessories',
  ]],
  ['Heating, Cooling & Air Quality', 'HVA', [
    'Air Conditioners', 'Split ACs', 'Inverter ACs', 'Cassette ACs', 'Floor ACs',
    'Air Coolers', 'Air Purifiers', 'Dehumidifiers', 'Heaters', 'Humidifiers',
    'Standing Fans', 'Wall Fans', 'Ceiling Fans', 'Industrial Fans', 'Thermostats',
  ]],
  ['Home Appliances', 'HAP', [
    'Irons & Steam Irons', 'Sewing Machines', 'Water Heaters', 'Thermal Bottles',
  ]],
  ['Personal Care', 'PCR', [
    'Clippers & Trimmers', 'Hair Dryers', 'Hair Straighteners',
    'Oral Care', 'Smart Scales', 'Mirrors',
  ]],
  ['Smart & Office', 'SMT', ['Smart Watches', 'Watch Straps', 'WiFi Routers', 'Office']],
  ['Accessories', 'ACC', ['Phone Accessories', 'Car Mounts', 'General Accessories']],
];

/** Supplier collection / old leaf name → [Category, Subcategory] */
const SOURCE = {
  phones: ['Phones & Tablets', 'Mobile Phones'],
  phone: ['Phones & Tablets', 'Mobile Phones'],
  'mobile phones': ['Phones & Tablets', 'Mobile Phones'],
  'smart phones': ['Phones & Tablets', 'Smart Phones'],
  smartphones: ['Phones & Tablets', 'Smart Phones'],
  'galaxy a series': ['Phones & Tablets', 'Smart Phones'],
  'galaxy z series': ['Phones & Tablets', 'Smart Phones'],
  'galaxy s series': ['Phones & Tablets', 'Smart Phones'],
  'galaxy tab': ['Phones & Tablets', 'Tablets'],
  tablets: ['Phones & Tablets', 'Tablets'],
  computers: ['Computing', 'Computers'],
  computer: ['Computing', 'Computers'],
  laptops: ['Computing', 'Laptops'],
  laptop: ['Computing', 'Laptops'],
  desktops: ['Computing', 'Desktops'],
  audio: ['Audio', 'Speakers'],
  earbuds: ['Audio', 'Earbuds'],
  'open ear headphones': ['Audio', 'Open-ear Headphones'],
  'over ear headphones': ['Audio', 'Over-ear Headphones'],
  'neckband earphones': ['Audio', 'Neckband Earphones'],
  'wired earphones': ['Audio', 'Wired Earphones'],
  earphones: ['Audio', 'Neckband Earphones'],
  speakers: ['Audio', 'Speakers'],
  speaker: ['Audio', 'Speakers'],
  'sound bars': ['Audio', 'Sound Bars'],
  'sound bar': ['Audio', 'Sound Bars'],
  'bluetooth speakers': ['Audio', 'Bluetooth Speakers'],
  'sound tower': ['Audio', 'Sound Towers'],
  'audio visual': ['TV & Visual', 'Televisions'],
  'audio and visual': ['TV & Visual', 'Televisions'],
  projector: ['Audio', 'Projectors'],
  projectors: ['Audio', 'Projectors'],
  television: ['TV & Visual', 'Televisions'],
  televisions: ['TV & Visual', 'Televisions'],
  'televisions and monitors': ['TV & Visual', 'Televisions'],
  tv: ['TV & Visual', 'Televisions'],
  'smart tvs': ['TV & Visual', 'Smart TVs'],
  led: ['TV & Visual', 'LED'],
  'mini led': ['TV & Visual', 'Mini-LED'],
  qled: ['TV & Visual', 'QLED'],
  oled: ['TV & Visual', 'OLED'],
  power: ['Power', 'Power Banks'],
  generator: ['Power', 'Generators'],
  generators: ['Power', 'Generators'],
  'power stations': ['Power', 'Power Stations'],
  'power station': ['Power', 'Power Stations'],
  'power banks': ['Power', 'Power Banks'],
  'wall chargers': ['Power', 'Wall Chargers'],
  cables: ['Power', 'Cables'],
  'hubs and adapters': ['Power', 'Hubs & Adapters'],
  'car chargers': ['Power', 'Car Chargers'],
  'wall sockets': ['Power', 'Wall Sockets'],
  'hybrid inverters': ['Power', 'Hybrid Inverters'],
  'home solar systems': ['Power', 'Home Solar Systems'],
  'lead acid batteries': ['Power', 'Lead-acid Batteries'],
  cooling: ['Heating, Cooling & Air Quality', 'Air Conditioners'],
  'air conditioners': ['Heating, Cooling & Air Quality', 'Air Conditioners'],
  'air conditioner': ['Heating, Cooling & Air Quality', 'Air Conditioners'],
  'split acs': ['Heating, Cooling & Air Quality', 'Split ACs'],
  'inverter acs': ['Heating, Cooling & Air Quality', 'Inverter ACs'],
  'cassette acs': ['Heating, Cooling & Air Quality', 'Cassette ACs'],
  'floor acs': ['Heating, Cooling & Air Quality', 'Floor ACs'],
  'air cooler': ['Heating, Cooling & Air Quality', 'Air Coolers'],
  'air coolers': ['Heating, Cooling & Air Quality', 'Air Coolers'],
  'standing fan': ['Heating, Cooling & Air Quality', 'Standing Fans'],
  'standing fans': ['Heating, Cooling & Air Quality', 'Standing Fans'],
  'wall fan': ['Heating, Cooling & Air Quality', 'Wall Fans'],
  'wall fans': ['Heating, Cooling & Air Quality', 'Wall Fans'],
  'ceiling fan': ['Heating, Cooling & Air Quality', 'Ceiling Fans'],
  'ceiling fans': ['Heating, Cooling & Air Quality', 'Ceiling Fans'],
  'industrial fan': ['Heating, Cooling & Air Quality', 'Industrial Fans'],
  'industrial fans': ['Heating, Cooling & Air Quality', 'Industrial Fans'],
  fans: ['Heating, Cooling & Air Quality', 'Standing Fans'],
  'air purifier': ['Heating, Cooling & Air Quality', 'Air Purifiers'],
  'air purifiers': ['Heating, Cooling & Air Quality', 'Air Purifiers'],
  refrigeration: ['Major Appliances', 'Refrigerators'],
  fridge: ['Major Appliances', 'Refrigerators'],
  fridges: ['Major Appliances', 'Refrigerators'],
  refrigerators: ['Major Appliances', 'Refrigerators'],
  refrigerator: ['Major Appliances', 'Refrigerators'],
  freezers: ['Major Appliances', 'Freezers'],
  freezer: ['Major Appliances', 'Freezers'],
  'double door': ['Major Appliances', 'Double Door'],
  'bottom freezer': ['Major Appliances', 'Bottom Freezer'],
  'chest freezer': ['Major Appliances', 'Chest Freezers'],
  'chest freezers': ['Major Appliances', 'Chest Freezers'],
  'display fridge': ['Major Appliances', 'Display Fridge'],
  'single door': ['Major Appliances', 'Single Door'],
  'top freezer': ['Major Appliances', 'Top Freezer'],
  'french doors': ['Major Appliances', 'French Doors'],
  'side by side': ['Major Appliances', 'Side by Side'],
  'table top': ['Major Appliances', 'Table Top'],
  'standing freezer': ['Major Appliances', 'Freezers'],
  'twin cooling': ['Major Appliances', 'Refrigerators'],
  'bespoke panels': ['Major Appliances', 'Refrigerators'],
  laundry: ['Major Appliances', 'Washing Machines'],
  'washing machine': ['Major Appliances', 'Washing Machines'],
  'washing machines': ['Major Appliances', 'Washing Machines'],
  'top load': ['Major Appliances', 'Top Load'],
  'front load': ['Major Appliances', 'Front Load'],
  'twin top': ['Major Appliances', 'Top Load'],
  'washer and dryer combo': ['Major Appliances', 'Washer & Dryer Combo'],
  dryer: ['Major Appliances', 'Dryers'],
  dryers: ['Major Appliances', 'Dryers'],
  'semi automatic': ['Major Appliances', 'Washing Machines'],
  'fully automatic': ['Major Appliances', 'Washing Machines'],
  'add wash': ['Major Appliances', 'Washing Machines'],
  dishwashers: ['Major Appliances', 'Dishwashers'],
  dishwasher: ['Major Appliances', 'Dishwashers'],
  kitchen: ['Small Kitchen Appliances', 'Specialty Appliances'],
  'kitchen appliances': ['Small Kitchen Appliances', 'Specialty Appliances'],
  'small kitchen appliances': ['Small Kitchen Appliances', 'Specialty Appliances'],
  'blenders and mixers': ['Small Kitchen Appliances', 'Blenders'],
  blenders: ['Small Kitchen Appliances', 'Blenders'],
  'food mixers': ['Small Kitchen Appliances', 'Food Mixers'],
  'food processors': ['Small Kitchen Appliances', 'Food Processors'],
  fryers: ['Small Kitchen Appliances', 'Fryers'],
  'air fryer': ['Small Kitchen Appliances', 'Air Fryers'],
  'air fryers': ['Small Kitchen Appliances', 'Air Fryers'],
  juicer: ['Small Kitchen Appliances', 'Juicers & Extractors'],
  juicers: ['Small Kitchen Appliances', 'Juicers & Extractors'],
  'pressure cooker': ['Small Kitchen Appliances', 'Pressure Cookers'],
  'pressure cookers': ['Small Kitchen Appliances', 'Pressure Cookers'],
  'rice cookers': ['Small Kitchen Appliances', 'Rice Cookers'],
  'electric kettles': ['Small Kitchen Appliances', 'Electric Kettles'],
  'ice maker': ['Small Kitchen Appliances', 'Ice Makers'],
  'ice makers': ['Small Kitchen Appliances', 'Ice Makers'],
  'sandwich maker': ['Small Kitchen Appliances', 'Sandwich Makers'],
  toasters: ['Small Kitchen Appliances', 'Toasters'],
  'water dispenser': ['Small Kitchen Appliances', 'Water Dispensers'],
  'water dispensers': ['Small Kitchen Appliances', 'Water Dispensers'],
  'induction cookers': ['Small Kitchen Appliances', 'Induction Cookers'],
  'coffee makers and kettles': ['Coffee Makers', 'Automatic Coffee Makers'],
  'coffee makers': ['Coffee Makers', 'Automatic Coffee Makers'],
  'coffee grinders': ['Coffee Makers', 'Coffee Grinders'],
  'cooking appliances': ['Cooking Appliances', 'Cooktops'],
  microwaves: ['Cooking Appliances', 'Microwaves'],
  ovens: ['Cooking Appliances', 'Built-in Ovens'],
  cooktops: ['Cooking Appliances', 'Cooktops'],
  'gas cooker': ['Cooking Appliances', 'Gas Cookers'],
  'gas cookers': ['Cooking Appliances', 'Gas Cookers'],
  '4 burner': ['Cooking Appliances', '4 Burner'],
  '5 burner': ['Cooking Appliances', '5 Burner'],
  'home appliances': ['Home Appliances', 'Irons & Steam Irons'],
  'small appliances': ['Small Kitchen Appliances', 'Specialty Appliances'],
  iron: ['Home Appliances', 'Irons & Steam Irons'],
  irons: ['Home Appliances', 'Irons & Steam Irons'],
  'irons and steamers': ['Home Appliances', 'Irons & Steam Irons'],
  'irons and steam irons': ['Home Appliances', 'Irons & Steam Irons'],
  'vacuum cleaner': ['Vacuums & Floor Care', 'Upright Vacuums'],
  vacuums: ['Vacuums & Floor Care', 'Upright Vacuums'],
  'upright vacuums': ['Vacuums & Floor Care', 'Upright Vacuums'],
  'broom and stick vacuums': ['Vacuums & Floor Care', 'Broom & Stick Vacuums'],
  'robotic vacuums': ['Vacuums & Floor Care', 'Robotic Vacuums'],
  'water heater': ['Home Appliances', 'Water Heaters'],
  'water heaters': ['Home Appliances', 'Water Heaters'],
  'thermal bottles': ['Home Appliances', 'Thermal Bottles'],
  'personal care': ['Personal Care', 'Clippers & Trimmers'],
  'clippers and trimmers': ['Personal Care', 'Clippers & Trimmers'],
  'oral care': ['Personal Care', 'Oral Care'],
  'hair dryers': ['Personal Care', 'Hair Dryers'],
  'hair straighteners': ['Personal Care', 'Hair Straighteners'],
  'smart scales': ['Personal Care', 'Smart Scales'],
  mirrors: ['Personal Care', 'Mirrors'],
  'smart and office': ['Smart & Office', 'Office'],
  watch: ['Smart & Office', 'Smart Watches'],
  watches: ['Smart & Office', 'Smart Watches'],
  'smart watches': ['Smart & Office', 'Smart Watches'],
  'smart wearables': ['Smart & Office', 'Smart Watches'],
  'watch straps': ['Smart & Office', 'Watch Straps'],
  office: ['Smart & Office', 'Office'],
  'wifi routers': ['Smart & Office', 'WiFi Routers'],
  accessories: ['Accessories', 'General Accessories'],
  'phone accessories': ['Accessories', 'Phone Accessories'],
  'car mounts': ['Accessories', 'Car Mounts'],
  'general accessories': ['Accessories', 'General Accessories'],
  'daily deals': ['Accessories', 'General Accessories'],
  'combo deals': ['Accessories', 'General Accessories'],
  promotions: ['Accessories', 'General Accessories'],
  'home comfort': ['Heating, Cooling & Air Quality', 'Humidifiers'],
  'home and living': ['Home Appliances', 'Thermal Bottles'],
  'kitchen and dining': ['Small Kitchen Appliances', 'Specialty Appliances'],
};

const ORAIMO_LEAVES = [
  [/spacebuds|earbud|true wireless|opensnap/, ['Audio', 'Earbuds']],
  [/openarc|opencirclet|open.?ear|clip.on/, ['Audio', 'Open-ear Headphones']],
  [/boompop|over.?ear|headphone|headset/, ['Audio', 'Over-ear Headphones']],
  [/necklace|neckband/, ['Audio', 'Neckband Earphones']],
  [/spacebox|speaker/, ['Audio', 'Speakers']],
  [/power bank|powerbox|powerjet|powernova|magpower|toast 22/, ['Power', 'Power Banks']],
  [/powercube|powergan|hypergan|wall charger|\bgan\b/, ['Power', 'Wall Chargers']],
  [/type c cable|lightning cable|usb.?c cable|charging cable|\bcable\b/, ['Power', 'Cables']],
  [/\bhub\b|docking/, ['Power', 'Hubs & Adapters']],
  [/watch strap|\bstrap\b/, ['Smart & Office', 'Watch Straps']],
  [/\bwatch\b/, ['Smart & Office', 'Smart Watches']],
  [/lamp|clock|chair|mouse|keyboard|monitor|visionpad|corder|tripod|gimbal/, ['Smart & Office', 'Office']],
  [/clipper|trimmer|shaver|groom/, ['Personal Care', 'Clippers & Trimmers']],
  [/tooth|floss|dent|oral|sonic/, ['Personal Care', 'Oral Care']],
  [/iron|steamer|steamcore/, ['Home Appliances', 'Irons & Steam Irons']],
  [/air fryer|nutrifry/, ['Small Kitchen Appliances', 'Air Fryers']],
  [/blender/, ['Small Kitchen Appliances', 'Blenders']],
  [/kettle/, ['Small Kitchen Appliances', 'Electric Kettles']],
  [/cooker|juicer|stove|hot plate|\bpot\b/, ['Small Kitchen Appliances', 'Specialty Appliances']],
  [/microwave/, ['Cooking Appliances', 'Microwaves']],
  [/vacuum/, ['Vacuums & Floor Care', 'Upright Vacuums']],
  [/\bfan\b/, ['Heating, Cooling & Air Quality', 'Standing Fans']],
  [/humidifier|diffuser|aroma/, ['Heating, Cooling & Air Quality', 'Humidifiers']],
  [/magcase|phone case|selfie/, ['Accessories', 'Phone Accessories']],
];

const COARSE = new Set([
  'audio', 'power', 'personal care', 'smart and office', 'accessories',
  'home appliances', 'daily deals', 'kitchen', 'cooling', 'refrigeration',
  'laundry', 'small kitchen appliances', 'major appliances', 'cooking appliances',
]);

export const TAXONOMY = TREE.map(([name, code, children]) => ({
  id: catId(name),
  name,
  code,
  children: children.map((ch) => ({
    id: subId(code, ch),
    name: ch,
    code: (code + '-' + slug(ch).replace(/\s+/g, '').slice(0, 8)).toUpperCase(),
  })),
}));

const KNOWN_LEAF = new Set(TREE.flatMap(([p, , kids]) => kids.map((k) => p + '\0' + k)));
const KNOWN_PARENT = new Set(TREE.map(([p]) => p));

const BRAND_IN_NAME = /\b(galaxy|samsung|apple|iphone|tecno|infinix|itel|oraimo|hisense|nasco|midea|nokia|lenovo|sony|ninja|cuisinart)\b/i;

export const TAXONOMY_CATEGORIES = TAXONOMY.flatMap((parent) => ([
  {
    id: parent.id,
    name: parent.name,
    short_code: parent.code,
    code: parent.code,
    parent_id: null,
    description: parent.name,
    source: 'taxonomy',
  },
  ...parent.children.map((ch) => ({
    id: ch.id,
    name: ch.name,
    short_code: ch.code,
    code: ch.code,
    parent_id: parent.id,
    parent_name: parent.name,
    description: parent.name + ' / ' + ch.name,
    source: 'taxonomy',
  })),
]));

const PARENT_BY_NAME = Object.fromEntries(TREE.map(([name, code]) => [name, code]));

function pack(parent, child) {
  let p = parent;
  let c = child;
  if (BRAND_IN_NAME.test(c) || BRAND_IN_NAME.test(p)) {
    if (/tab/i.test(c + p)) { p = 'Phones & Tablets'; c = 'Tablets'; }
    else if (/phone|galaxy|iphone|handset/i.test(c + p)) { p = 'Phones & Tablets'; c = 'Smart Phones'; }
    else if (KNOWN_PARENT.has(p)) c = TREE.find(([n]) => n === p)[2][0];
  }
  if (!KNOWN_LEAF.has(p + '\0' + c)) {
    if (KNOWN_PARENT.has(p)) c = TREE.find(([n]) => n === p)[2][0];
    else { p = 'Accessories'; c = 'General Accessories'; }
  }
  return {
    category: p,
    subcategory: c,
    category_id: catId(p),
    subcategory_id: subId(PARENT_BY_NAME[p] || 'x', c),
  };
}

export function classifyProduct(p = {}) {
  const subHit = SOURCE[slug(p.subcategory || p.sub_category || '')];
  if (subHit) return pack(subHit[0], subHit[1]);
  const source = p.source_category || p.category || '';
  const text = [p.name, p.brand, p.sku, source].map((x) => slug(x)).join(' ');
  const oraimo = /oraimo/i.test(`${p.source || ''} ${p.brand || ''} ${p.source_url || ''}`);
  if (oraimo || COARSE.has(slug(source))) {
    for (const [re, pair] of ORAIMO_LEAVES) {
      if (re.test(text)) return pack(pair[0], pair[1]);
    }
  }
  const hit = SOURCE[slug(source)];
  if (hit && !COARSE.has(slug(source))) return pack(hit[0], hit[1]);
  if (hit) return pack(hit[0], hit[1]);
  const rules = [
    [/galaxy tab|tablet/, ['Phones & Tablets', 'Tablets']],
    [/galaxy z|galaxy s|galaxy a|flip|iphone|smartphone|tecno|infinix|itel|nokia|samsung|mobile phone/, ['Phones & Tablets', 'Smart Phones']],
    [/laptop|notebook|lenovo|macbook/, ['Computing', 'Laptops']],
    [/desktop|aio|all in one/, ['Computing', 'Desktops']],
    [/qled/, ['TV & Visual', 'QLED']],
    [/oled/, ['TV & Visual', 'OLED']],
    [/mini.?led/, ['TV & Visual', 'Mini-LED']],
    [/smart tv|television|\btv\b|vidaa|uhd/, ['TV & Visual', 'Televisions']],
    [/sound ?bar/, ['Audio', 'Sound Bars']],
    [/earbud|buds/, ['Audio', 'Earbuds']],
    [/headphone|headset/, ['Audio', 'Over-ear Headphones']],
    [/speaker/, ['Audio', 'Speakers']],
    [/power station|inverter|generator/, ['Power', 'Power Stations']],
    [/power bank/, ['Power', 'Power Banks']],
    [/split ac/, ['Heating, Cooling & Air Quality', 'Split ACs']],
    [/cassette ac/, ['Heating, Cooling & Air Quality', 'Cassette ACs']],
    [/floor ac|inverter ac|air condition/, ['Heating, Cooling & Air Quality', 'Air Conditioners']],
    [/standing fan/, ['Heating, Cooling & Air Quality', 'Standing Fans']],
    [/wall fan/, ['Heating, Cooling & Air Quality', 'Wall Fans']],
    [/ceiling fan/, ['Heating, Cooling & Air Quality', 'Ceiling Fans']],
    [/industrial fan|\bfan\b/, ['Heating, Cooling & Air Quality', 'Standing Fans']],
    [/air purifier/, ['Heating, Cooling & Air Quality', 'Air Purifiers']],
    [/chest freezer/, ['Major Appliances', 'Chest Freezers']],
    [/side by side/, ['Major Appliances', 'Side by Side']],
    [/fridge|refrigerator/, ['Major Appliances', 'Refrigerators']],
    [/freezer/, ['Major Appliances', 'Freezers']],
    [/front load/, ['Major Appliances', 'Front Load']],
    [/top load/, ['Major Appliances', 'Top Load']],
    [/dryer/, ['Major Appliances', 'Dryers']],
    [/wash(ing|er)|laundry/, ['Major Appliances', 'Washing Machines']],
    [/microwave/, ['Cooking Appliances', 'Microwaves']],
    [/air fryer/, ['Small Kitchen Appliances', 'Air Fryers']],
    [/blender/, ['Small Kitchen Appliances', 'Blenders']],
    [/kettle/, ['Small Kitchen Appliances', 'Electric Kettles']],
    [/coffee|espresso/, ['Coffee Makers', 'Automatic Coffee Makers']],
    [/cooker|oven|toaster|dishwasher/, ['Cooking Appliances', 'Cooktops']],
    [/upright vacuum|vacuum/, ['Vacuums & Floor Care', 'Upright Vacuums']],
    [/robotic vacuum|roomba/, ['Vacuums & Floor Care', 'Robotic Vacuums']],
    [/iron|steam/, ['Home Appliances', 'Irons & Steam Irons']],
    [/clipper|shaver|trimmer/, ['Personal Care', 'Clippers & Trimmers']],
    [/hair dryer/, ['Personal Care', 'Hair Dryers']],
    [/smartwatch|\bwatch\b/, ['Smart & Office', 'Smart Watches']],
  ];
  for (const [re, pair] of rules) {
    if (re.test(text)) return pack(pair[0], pair[1]);
  }
  if (source) {
    const mapped = SOURCE[slug(source)];
    if (mapped) return pack(mapped[0], mapped[1]);
  }
  return pack('Accessories', 'General Accessories');
}
