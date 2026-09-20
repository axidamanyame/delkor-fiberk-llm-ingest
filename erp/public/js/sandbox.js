const FILTERS = () => ({
  dateFrom: document.getElementById("date-from")?.value || "",
  dateTo: document.getElementById("date-to")?.value || "",
  branch: (typeof railLoc === "string" && railLoc) || document.getElementById("branch")?.value || "All Locations"
});

const SALES = [
  { invoice_no: "A1017564217982586950", cashier: "Nathan Tetteh Buer-Doe", customer: "Prosper Dunyo", mobile: "0559888902", sku: "TEC-POP20", product: "TECNO POP 20 (4G+64G) BLACK, BNP-900001", category: "Phones", brand: "TECNO", qty: 1, total: 1579, cost: 980, payment: "paid", location: "Fiberk Shop", status: "final", shipping: "delivered", created_at: "2026-09-08T09:15:00Z" },
  { invoice_no: "A1017564217982586951", cashier: "Nathan Tetteh Buer-Doe", customer: "Ama Mensah", sku: "ORA-BUDS", product: "Oraimo TWS", category: "Accessories", brand: "Oraimo", total: 820, cost: 440, payment: "Cash", location: "Fiberk Shop", created_at: "2026-09-08T11:30:00Z" },
  { invoice_no: "A1017564217982586952", cashier: "JOHN AGBAH · SA02437", customer: "ABRAHAM TEYE NARH · SA02325", sku: "HDMI-2M", product: "HDMI 2m", category: "Cables", brand: "Generic", total: 430, cost: 132, payment: "Bank", location: "BNPL Market (Field)", created_at: "2026-09-08T14:45:00Z" },
  { invoice_no: "A1017564217982586953", cashier: "Ama Mensah", customer: "Anita Mantibea Asare · SA02576", sku: "CASE-MIX", product: "Phone case", category: "Accessories", brand: "Generic", total: 45, cost: 16, payment: "Cash", location: "BNPL Market (Field)", created_at: "2026-09-12T10:02:00Z" },
  { invoice_no: "A1017564217982586954", cashier: "Jennifer Azure · SA02485", customer: "Ivy Esinam Humaley · SA02417", sku: "USB-C-C", product: "USB-C to C", category: "Cables", brand: "Generic", total: 126, cost: 50, payment: "MoMo", location: "BNPL Market (Field)", created_at: "2026-09-15T13:20:00Z" },
  { invoice_no: "A1017564217982586955", cashier: "John Dugba Osei · SA02911", customer: "Emma", sku: "ORA-20W", product: "Oraimo 20W", category: "Accessories", brand: "Oraimo", total: 70, cost: 45, payment: "Cash", location: "BNPL Market (Field)", created_at: "2026-09-18T16:40:00Z" }
];

const ITEMS = [
  {
    sku: "PIN-00475",
    name: "PINARO 00475",
    brand: "Pinaro",
    unit: "Pc",
    barcode_type: "C128",
    locations: "Fiberk Shop",
    category: "Phones",
    subcategory: "—",
    manage_stock: "Yes",
    alert_qty: "—",
    expires: "Not Applicable",
    tax: "None",
    tax_type: "Exclusive",
    product_type: "Single",
    purchase_ex: 980,
    purchase_inc: 980,
    margin: 60.1,
    sell_ex: 1579,
    sell_inc: 1579,
    group_prices: "WHOLESALE - 1400\nRETAIL - 1579",
    stock: 1,
    stock_value: 980,
    sold: 1,
    transferred: 0,
    adjusted: 0,
    department: "Retail",
    unit_price: 1579,
    image: "/uploads/invoices/pinaro-00475.jpg"
  },
  {
    sku: "OPH-091001",
    name: "INFINIX SMART 20 (128GB)",
    brand: "Infinix",
    unit: "Pc",
    barcode_type: "C128",
    locations: "Operations Hub",
    category: "Phones",
    subcategory: "—",
    manage_stock: "Yes",
    alert_qty: "—",
    expires: "Not Applicable",
    tax: "None",
    tax_type: "Exclusive",
    product_type: "Single",
    purchase_ex: 1581,
    purchase_inc: 1581,
    margin: 0,
    sell_ex: 0,
    sell_inc: 0,
    group_prices: "WHOLESALE - 0\nRETAIL - 0",
    stock: 4,
    stock_value: 6324,
    sold: 0,
    transferred: 0,
    adjusted: 0,
    department: "—",
    unit_price: 0
  },
  {
    sku: "TEC-POP20",
    name: "TECNO POP 20 (4G+64G) BLACK",
    brand: "TECNO",
    unit: "Pc",
    barcode_type: "C128",
    locations: "Fiberk Shop",
    category: "Phones",
    subcategory: "—",
    manage_stock: "Yes",
    alert_qty: "—",
    expires: "Not Applicable",
    tax: "None",
    tax_type: "Exclusive",
    product_type: "Single",
    purchase_ex: 980,
    purchase_inc: 980,
    margin: 60.1,
    sell_ex: 1579,
    sell_inc: 1579,
    group_prices: "WHOLESALE - 1400\nRETAIL - 1579",
    stock: 1,
    stock_value: 980,
    sold: 1,
    transferred: 0,
    adjusted: 0,
    department: "Retail",
    unit_price: 1579
  },
  {
    sku: "ORA-BUDS",
    name: "Oraimo TWS",
    brand: "Oraimo",
    unit: "Pc",
    barcode_type: "C128",
    locations: "Fiberk Shop",
    category: "Accessories",
    subcategory: "Audio",
    manage_stock: "Yes",
    alert_qty: "6",
    expires: "Not Applicable",
    tax: "None",
    tax_type: "Exclusive",
    product_type: "Single",
    purchase_ex: 55,
    purchase_inc: 55,
    margin: 72.7,
    sell_ex: 95,
    sell_inc: 95,
    group_prices: "WHOLESALE - 80\nRETAIL - 95",
    stock: 8,
    stock_value: 440,
    sold: 2,
    transferred: 0,
    adjusted: -2,
    department: "Retail",
    unit_price: 95
  }
];

const STOCK = [
  { sku: "CASE-MIX", product: "Phone case mix", category: "Accessories", brand: "Generic", face: "A01", location: "Fiberk Shop", qty: 8, reorder: 6, cost: 8, price: 20 },
  { sku: "PH-CABLE", product: "Phone charge cable", category: "Accessories", brand: "Generic", face: "A01", location: "Fiberk Shop", qty: 8, reorder: 6, cost: 7, price: 18 },
  { sku: "EAR-BASIC", product: "Basic earbuds", category: "Accessories", brand: "Generic", face: "A01", location: "Fiberk Shop", qty: 6, reorder: 4, cost: 12, price: 25 },
  { sku: "HDMI-2M", product: "HDMI 2m", category: "Cables", brand: "Generic", face: "A02", location: "Fiberk Shop", qty: 6, reorder: 4, cost: 22, price: 45 },
  { sku: "USB-C-C", product: "USB-C to C", category: "Cables", brand: "Generic", face: "A02", location: "Fiberk Shop", qty: 8, reorder: 6, cost: 10, price: 22 },
  { sku: "USB-A-B", product: "Printer USB A-B", category: "Cables", brand: "Generic", face: "A02", location: "Fiberk Shop", qty: 6, reorder: 3, cost: 9, price: 20 },
  { sku: "VGA-CABLE", product: "VGA cable", category: "Cables", brand: "Generic", face: "A02", location: "Fiberk Shop", qty: 4, reorder: 2, cost: 15, price: 30 },
  { sku: "ORA-BUDS", product: "Oraimo TWS", category: "Accessories", brand: "Oraimo", face: "B01", location: "Fiberk Shop", qty: 8, reorder: 6, cost: 55, price: 95 },
  { sku: "ORA-CABLE", product: "Oraimo Type-C", category: "Accessories", brand: "Oraimo", face: "B01", location: "Fiberk Shop", qty: 8, reorder: 6, cost: 18, price: 35 },
  { sku: "ORA-20W", product: "Oraimo 20W brick", category: "Accessories", brand: "Oraimo", face: "B01", location: "Fiberk Shop", qty: 6, reorder: 4, cost: 45, price: 70 },
  { sku: "ORA-FAN", product: "Oraimo mini fan", category: "Accessories", brand: "Oraimo", face: "B01", location: "Fiberk Shop", qty: 4, reorder: 3, cost: 40, price: 65 },
  { sku: "PWR-10K", product: "Power bank 10k", category: "Accessories", brand: "Generic", face: "C01", location: "Fiberk Shop", qty: 10, reorder: 4, cost: 70, price: 120 },
  { sku: "TEC-POP20", product: "TECNO POP 20", category: "Phones", brand: "TECNO", face: "F01", location: "Fiberk Shop", qty: 1, reorder: 0, cost: 980, price: 1479 }
];

const ADJUST = [
  { date: "2026-09-10", sku: "ORA-BUDS", reason: "Count variance", qty: -2, user: "Ama" },
  { date: "2026-09-11", sku: "CASE-MIX", reason: "Count variance", qty: -1, user: "Kojo" },
  { date: "2026-09-12", sku: "USB-C-C", reason: "Damaged pack", qty: -1, user: "Ama" }
];
const XFER = [
  { date: "2026-09-05", sku: "ORA-20W", from: "C01", to: "B01", qty: 6, user: "Nathan" },
  { date: "2026-09-06", sku: "HDMI-2M", from: "RCV", to: "A02", qty: 6, user: "John" }
];
const HISTORY = [
  { date: "2026-09-01", sku: "ORA-BUDS", type: "Opening", qty: 10 },
  { date: "2026-09-08", sku: "ORA-BUDS", type: "Sale", qty: -2 },
  { date: "2026-09-10", sku: "ORA-BUDS", type: "Adjust", qty: -2 },
  { date: "2026-09-01", sku: "TEC-POP20", type: "Opening", qty: 1 },
  { date: "2026-09-08", sku: "TEC-POP20", type: "Sale", qty: -1 }
];
const OPENING = STOCK.map((s) => ({ sku: s.sku, product: s.product, face: s.face, qty: s.qty + 2, date: "2026-09-01" }));
const SHRINK = [
  { when: "2026-09-10 08:12", face: "B01", sku: "ORA-BUDS", var: -2, status: "OPEN" },
  { when: "2026-09-10 08:14", face: "A01", sku: "CASE-MIX", var: -1, status: "OPEN" },
  { when: "2026-09-11 18:02", face: "A02", sku: "USB-C-C", var: -3, status: "CLOSED" },
  { when: "2026-09-12 09:40", face: "B01", sku: "ORA-CABLE", var: -1, status: "OPEN" }
];
const IMEI = [
  { imei: "354396744923644", sku: "TEC-POP20", product: "TECNO POP 20", face: "F01", status: "On-hand" },
  { imei: "352562721396607", sku: "INF-SMT20", product: "Infinix Smart 20", face: "F01", status: "Demo" }
];
const PURCHASES = [
  { po: "PIN-00475", supplier: "Pinaro Trading", sku: "PIN-00475", product: "PINARO 00475", qty: 2, total: 1960, paid: 1960, date: "2026-09-01", location: "Fiberk Shop" },
  { po: "PO-2201", supplier: "Oraimo GH", sku: "ORA-BUDS", product: "Oraimo TWS", qty: 24, total: 1320, paid: 1320, date: "2026-09-02", location: "Fiberk Shop" },
  { po: "PO-2202", supplier: "Cable House", sku: "HDMI-2M", product: "HDMI 2m", qty: 20, total: 440, paid: 200, date: "2026-09-04", location: "Fiberk Shop" },
  { po: "PO-2203", supplier: "Transsion Dist", sku: "TEC-POP20", product: "TECNO POP 20 (4G+64G) BLACK", qty: 2, total: 1960, paid: 1960, date: "2026-09-06", location: "Fiberk Shop" }
];
const CUSTOMERS = [
  { customer: "Prosper Dunyo", group: "Retail", outstanding: 0, sales: 1579 },
  { customer: "Ama Mensah", group: "Retail", outstanding: 120, sales: 820 },
  { customer: "ABRAHAM TEYE NARH · SA02325", group: "Field", outstanding: 400, sales: 430 }
];
const SUPPLIERS = [
  { supplier: "Oraimo GH", outstanding: 0, purchases: 1320 },
  { supplier: "Cable House", outstanding: 240, purchases: 440 },
  { supplier: "Transsion Dist", outstanding: 0, purchases: 1960 }
];
const EXPENSES = [
  { date: "2026-09-03", category: "Rent", payee: "Landlord", amount: 800 },
  { date: "2026-09-07", category: "MoMo charges", payee: "MTN", amount: 18 },
  { date: "2026-09-14", category: "Transport", payee: "Trotro", amount: 40 }
];
const TAX = [
  { date: "2026-09-08", invoice_no: "A1017564217982586950", net: 1373.04, vat: 205.96, levy: 0 },
  { date: "2026-09-08", invoice_no: "A1017564217982586951", net: 713.04, vat: 106.96, levy: 0 },
  { date: "2026-09-08", invoice_no: "A1017564217982586952", net: 373.91, vat: 56.09, levy: 0 }
];
const DRAWER = [
  { session: "REG-08-AM", cashier: "Nathan Tetteh Buer-Doe", opening: 200, cash: 865, momo: 1579, closing: 1065, variance: 0 },
  { session: "REG-08-PM", cashier: "JOHN AGBAH · SA02437", opening: 200, cash: 500, momo: 0, closing: 700, variance: 0 }
];
const BNPL = [
  { contract: "HP-441", customer: "Ama Mensah", sku: "TEC-POP20", principal: 1479, paid: 400, balance: 1079, due: "2026-09-20", status: "Current" },
  { contract: "HP-442", customer: "ABRAHAM TEYE NARH · SA02325", sku: "INF-SMT20", principal: 1299, paid: 200, balance: 1099, due: "2026-09-05", status: "Overdue" }
];
const LOCKS = [
  { imei: "354396744923644", customer: "Ama Mensah", code: "LOCK-991", apply_no: "PA-1002", expires: "2026-10-08", status: "Pre-active" }
];

function groupSum(rows, key, field) {
  const map = {};
  rows.forEach((r) => {
    const k = String(r[key] ?? "—");
    map[k] = (map[k] || 0) + Number(field ? r[field] : 1);
  });
  return { labels: Object.keys(map), values: Object.values(map) };
}
function money(n) { return "GH₵ " + Number(n || 0).toFixed(2); }
function hourLabel(iso) { return String(new Date(iso).getHours()).padStart(2, "0") + ":00"; }

function salesInRange(filters) {
  return SALES.filter((r) => {
    const d = r.created_at.slice(0, 10);
    const okD = (!filters.dateFrom || d >= filters.dateFrom) && (!filters.dateTo || d <= filters.dateTo);
    const okB = !filters.branch || filters.branch === "ALL" || filters.branch === "All Locations" || r.location === filters.branch;
    return okD && okB;
  });
}

const MENU = [
  { id: "purchase", module: "Purchase Reports", items: [
    { code: "pur.sale", name: "Purchase & Sale", blurb: "Bought vs sold totals", children: [
      { code: "pur.supplier", name: "Purchases by Supplier", blurb: "Spend by vendor" }
    ]},
    { code: "pur.product", name: "Product Purchase Report", blurb: "Purchase Details document" },
    { code: "pur.payments", name: "Purchase Payment Report", blurb: "Same purchase sheet" },
    { code: "pur.sale_product", name: "Purchase & Sale Product", blurb: "Purchase Details document" }
  ]},
  { id: "inventory", module: "Inventory Reports", items: [
    { code: "inv.stock", name: "Stock Report", blurb: "Product card", children: [
      { code: "inv.by_location", name: "Stock by Location", blurb: "Qty by shop" },
      { code: "inv.low", name: "Low Stock", blurb: "Below reorder" },
      { code: "inv.opening", name: "Opening Stock", blurb: "Period opening" },
      { code: "inv.history", name: "Product Stock History", blurb: "Moves on a SKU" },
      { code: "inv.faces", name: "Fiberk Face Count", blurb: "A01 / A02 / B01 hang qty" },
      { code: "inv.imei", name: "IMEI Register", blurb: "Serial phones" }
    ]},
    { code: "inv.adjust", name: "Stock Adjustment Report", blurb: "Opens List Stock Adjustments", children: [
      { code: "inv.transfer", name: "Stock Transfer", blurb: "Face to face moves" }
    ]},
    { code: "sales.trending", name: "Trending Products", blurb: "Product card" },
    { code: "inv.items", name: "Items Report", blurb: "Product card" }
  ]},
  { id: "sales", module: "Sales Reports", items: [
    { code: "sales.pos_register", name: "POS Register Report", blurb: "Till close sheet", children: [
      { code: "sales.daily", name: "Daily Sales", blurb: "Tickets by day" }
    ]},
    { code: "sales.rep", name: "Sales Representative Report", blurb: "Sell details document", children: [
      { code: "sales.by_cashier", name: "Sales by Cashier", blurb: "Cashier totals" }
    ]},
    { code: "sales.product_sell", name: "Product Sell Report", blurb: "Sell details document", children: [
      { code: "sales.by_product", name: "Sales by Product", blurb: "SKU totals" },
      { code: "sales.by_category", name: "Sales by Category", blurb: "Category totals" },
      { code: "sales.by_brand", name: "Sales by Brand", blurb: "Brand totals" },
      { code: "sales.by_location", name: "Sales by Location", blurb: "Shop totals" }
    ]},
    { code: "sales.grouped", name: "Product Sell (Grouped)", blurb: "Product card" },
    { code: "sales.sell_payment", name: "Sell Payment Report", blurb: "Same sell sheet", children: [
      { code: "sales.by_payment", name: "Sales by Payment", blurb: "Tender mix" }
    ]}
  ]},
  { id: "finance", module: "Finance Reports", items: [
    { code: "fin.pl", name: "Profit / Loss Report", blurb: "P&L for the period", children: [
      { code: "sales.margin", name: "Profit on Sales", blurb: "Gross minus cost" }
    ]},
    { code: "fin.trial", name: "Trial Balance", blurb: "In Accounting" },
    { code: "fin.balance", name: "Balance Sheet", blurb: "In Accounting" },
    { code: "fin.cashflow", name: "Cash Flow", blurb: "In Accounting" },
    { code: "fin.tax", name: "Tax Report", blurb: "GRA VAT summary" },
    { code: "fin.age", name: "Payment by Age", blurb: "Contact sheet" },
    { code: "fin.expense", name: "Expense Report", blurb: "Expense sheet" }
  ]},
  { id: "collections", module: "Collections Reports", items: [
    { code: "col.ageing", name: "Ageing & queues", blurb: "Queue totals", children: [
      { code: "bnpl.due", name: "Collections Due", blurb: "Due book" },
      { code: "bnpl.aging", name: "Overdue Aging", blurb: "Past due only" }
    ]},
    { code: "col.ptp", name: "Promise to pay", blurb: "PTP totals" },
    { code: "col.calls", name: "Call diary", blurb: "Call totals" },
    { code: "col.regular", name: "Regular payers", blurb: "On-schedule totals" },
    { code: "col.exceptions", name: "Exceptions", blurb: "Hold totals", children: [
      { code: "inv.shrink", name: "Shrink Exceptions", blurb: "Face count variance" },
      { code: "bnpl.lock", name: "Pre-Active Lock", blurb: "Locked devices" }
    ]},
    { code: "col.hp", name: "Hire purchase collections", blurb: "Partner transfer totals", children: [
      { code: "bnpl.book", name: "Hire Purchase Book", blurb: "Contract balances" }
    ]}
  ]},
  { id: "system", module: "System Reports", items: [
    { code: "sys.activity", name: "Activity Log", blurb: "Who changed what" },
    { code: "sys.z", name: "Z Report", blurb: "Sales in hand", children: [
      { code: "fin.register", name: "Cash Register", blurb: "Drawer sessions" }
    ]},
    { code: "sys.contacts", name: "Customers & Suppliers", blurb: "Contact sheet", children: [
      { code: "crm.customer_os", name: "Customer Outstanding", blurb: "AR" },
      { code: "crm.supplier_os", name: "Supplier Outstanding", blurb: "AP" }
    ]},
    { code: "sys.groups", name: "Customer Groups Report", blurb: "Contact sheet", children: [
      { code: "crm.groups", name: "Customer Groups", blurb: "Group sales" }
    ]}
  ]}
];

const ALIAS = {
  "pur.sale": "pur.register",
  "pur.product": "pur.register",
  "pur.sale_product": "pur.register",
  "sales.rep": "sales.by_cashier",
  "sales.product_sell": "sales.by_product",
  "sales.grouped": "sales.by_category",
  "sales.sell_payment": "sales.by_payment",
  "fin.age": "crm.customer_os",
  "col.ageing": "bnpl.aging",
  "col.hp": "bnpl.book",
  "col.exceptions": "inv.shrink",
  "sys.z": "fin.register",
  "sys.contacts": "crm.customer_os",
  "sys.groups": "crm.groups"
};

function flattenMenu() {
  const out = [];
  MENU.forEach((m) => {
    m.items.forEach((i) => {
      out.push({ ...i, module: m.module, group: m.id });
      (i.children || []).forEach((c) => out.push({ ...c, module: m.module, group: m.id, parent: i.code }));
    });
  });
  return out;
}
function templateOf(code) {
  return flattenMenu().find((i) => i.code === code) || { code, name: code, module: "Reports", blurb: "" };
}

function pack(code, filters) {
  const sales = salesInRange(filters);
  const sum = sales.reduce((s, r) => s + r.total, 0);
  const cost = sales.reduce((s, r) => s + r.cost, 0);
  const T = templateOf(code);

  const packs = {
    "sales.pos_register": {
      kpis: [
        { label: "Total Sales", value: money(sum), color: "primary" },
        { label: "Invoices", value: String(sales.length), color: "success" },
        { label: "Avg Invoice", value: money(sales.length ? sum / sales.length : 0), color: "primary" }
      ],
      charts: [{ type: "bar", title: "Sales by Hour", data: groupSum(sales.map((r) => ({ ...r, hour: hourLabel(r.created_at) })), "hour", "total") }],
      columns: [
        { key: "invoice_no", label: "Invoice No." }, { key: "cashier", label: "Cashier" },
        { key: "customer", label: "Customer" }, { key: "total", label: "Total" }, { key: "created_at", label: "Time" }
      ],
      rows: sales
    },
    "sales.daily": {
      kpis: [
        { label: "Days", value: String(new Set(sales.map((r) => r.created_at.slice(0, 10))).size), color: "primary" },
        { label: "Gross", value: money(sum), color: "success" }
      ],
      charts: [{ type: "line", title: "Sales by Day", data: groupSum(sales.map((r) => ({ ...r, day: r.created_at.slice(0, 10) })), "day", "total") }],
      columns: [{ key: "day", label: "Day" }, { key: "tickets", label: "Tickets" }, { key: "total", label: "Gross" }],
      rows: Object.values(sales.reduce((m, r) => {
        const d = r.created_at.slice(0, 10);
        m[d] = m[d] || { day: d, tickets: 0, total: 0 };
        m[d].tickets += 1; m[d].total += r.total; return m;
      }, {}))
    },
    "sales.by_product": {
      kpis: [{ label: "SKUs sold", value: String(new Set(sales.map((r) => r.sku)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Product", data: groupSum(sales, "product", "total") }],
      columns: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "total", label: "Sales" }],
      rows: sales
    },
    "sales.by_category": {
      kpis: [{ label: "Categories", value: String(new Set(sales.map((r) => r.category)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Category", data: groupSum(sales, "category", "total") }],
      columns: [{ key: "category", label: "Category" }, { key: "product", label: "Product" }, { key: "total", label: "Sales" }],
      rows: sales
    },
    "sales.by_brand": {
      kpis: [{ label: "Brands", value: String(new Set(sales.map((r) => r.brand)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Brand", data: groupSum(sales, "brand", "total") }],
      columns: [{ key: "brand", label: "Brand" }, { key: "product", label: "Product" }, { key: "total", label: "Sales" }],
      rows: sales
    },
    "sales.by_cashier": {
      kpis: [{ label: "Cashiers", value: String(new Set(sales.map((r) => r.cashier)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Cashier", data: groupSum(sales, "cashier", "total") }],
      columns: [{ key: "cashier", label: "Cashier" }, { key: "invoice_no", label: "Invoice" }, { key: "total", label: "Total" }],
      rows: sales
    },
    "sales.by_payment": {
      kpis: [{ label: "Methods", value: String(new Set(sales.map((r) => r.payment)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Payment", data: groupSum(sales, "payment", "total") }],
      columns: [{ key: "payment", label: "Method" }, { key: "invoice_no", label: "Invoice" }, { key: "total", label: "Total" }],
      rows: sales
    },
    "sales.by_location": {
      kpis: [{ label: "Locations", value: String(new Set(sales.map((r) => r.location)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Sales by Location", data: groupSum(sales, "location", "total") }],
      columns: [{ key: "location", label: "Location" }, { key: "invoice_no", label: "Invoice" }, { key: "total", label: "Total" }],
      rows: sales
    },
    "sales.margin": {
      kpis: [
        { label: "Gross", value: money(sum), color: "primary" },
        { label: "Cost", value: money(cost), color: "danger" },
        { label: "Profit", value: money(sum - cost), color: "success" }
      ],
      charts: [{ type: "bar", title: "Profit by Product", data: groupSum(sales.map((r) => ({ ...r, profit: r.total - r.cost })), "product", "profit") }],
      columns: [{ key: "product", label: "Product" }, { key: "total", label: "Sales" }, { key: "cost", label: "Cost" }],
      rows: sales
    },
    "sales.trending": {
      kpis: [{ label: "Lines", value: String(sales.length), color: "primary" }, { label: "Top ticket", value: money(Math.max(0, ...sales.map((r) => r.total))), color: "success" }],
      charts: [{ type: "bar", title: "Units / value by SKU", data: groupSum(sales, "sku", "total") }],
      columns: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "total", label: "Sales" }],
      rows: [...sales].sort((a, b) => b.total - a.total)
    },
    "inv.items": {
      kpis: [
        { label: "Products", value: String(ITEMS.length), color: "primary" },
        { label: "On-hand units", value: String(ITEMS.reduce((s, r) => s + r.stock, 0)), color: "success" },
        { label: "Stock value", value: money(ITEMS.reduce((s, r) => s + r.stock_value, 0)), color: "primary" }
      ],
      charts: [],
      columns: [],
      rows: ITEMS,
      layout: "items-card"
    },
    "inv.stock": {
      kpis: [
        { label: "SKUs", value: String(STOCK.length), color: "primary" },
        { label: "Units", value: String(STOCK.reduce((s, r) => s + r.qty, 0)), color: "success" },
        { label: "Stock value", value: money(STOCK.reduce((s, r) => s + r.qty * r.cost, 0)), color: "primary" }
      ],
      charts: [{ type: "bar", title: "Units by Face", data: groupSum(STOCK, "face", "qty") }],
      columns: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "face", label: "Face" }, { key: "qty", label: "Qty" }, { key: "cost", label: "Cost" }],
      rows: STOCK
    },
    "inv.by_location": {
      kpis: [{ label: "Locations", value: "1", color: "primary" }, { label: "Units", value: String(STOCK.reduce((s, r) => s + r.qty, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Qty by Location", data: groupSum(STOCK, "location", "qty") }],
      columns: [{ key: "location", label: "Location" }, { key: "sku", label: "SKU" }, { key: "qty", label: "Qty" }],
      rows: STOCK
    },
    "inv.low": {
      kpis: [{ label: "Below reorder", value: String(STOCK.filter((s) => s.qty <= s.reorder).length), color: "danger" }],
      charts: [{ type: "bar", title: "Qty vs reorder", data: { labels: STOCK.map((s) => s.sku), values: STOCK.map((s) => s.qty) } }],
      columns: [{ key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "qty", label: "Qty" }, { key: "reorder", label: "Reorder" }],
      rows: STOCK.filter((s) => s.qty <= s.reorder)
    },
    "inv.adjust": {
      kpis: [{ label: "Adjustments", value: String(ADJUST.length), color: "danger" }, { label: "Net units", value: String(ADJUST.reduce((s, r) => s + r.qty, 0)), color: "danger" }],
      charts: [{ type: "bar", title: "Adjust qty", data: groupSum(ADJUST, "sku", "qty") }],
      columns: [{ key: "date", label: "Date" }, { key: "sku", label: "SKU" }, { key: "reason", label: "Reason" }, { key: "qty", label: "Qty" }, { key: "user", label: "User" }],
      rows: ADJUST
    },
    "inv.transfer": {
      kpis: [{ label: "Transfers", value: String(XFER.length), color: "primary" }, { label: "Units moved", value: String(XFER.reduce((s, r) => s + r.qty, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Moved units", data: groupSum(XFER, "sku", "qty") }],
      columns: [{ key: "date", label: "Date" }, { key: "sku", label: "SKU" }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "qty", label: "Qty" }, { key: "user", label: "User" }],
      rows: XFER
    },
    "inv.history": {
      kpis: [{ label: "Moves", value: String(HISTORY.length), color: "primary" }],
      charts: [{ type: "bar", title: "History by type", data: groupSum(HISTORY, "type", "qty") }],
      columns: [{ key: "date", label: "Date" }, { key: "sku", label: "SKU" }, { key: "type", label: "Type" }, { key: "qty", label: "Qty" }],
      rows: HISTORY
    },
    "inv.opening": {
      kpis: [{ label: "Opening lines", value: String(OPENING.length), color: "primary" }, { label: "Units", value: String(OPENING.reduce((s, r) => s + r.qty, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Opening by face", data: groupSum(OPENING, "face", "qty") }],
      columns: [{ key: "date", label: "Date" }, { key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "face", label: "Face" }, { key: "qty", label: "Qty" }],
      rows: OPENING
    },
    "inv.faces": {
      kpis: [
        { label: "A01", value: String(STOCK.filter((s) => s.face === "A01").reduce((n, s) => n + s.qty, 0)), color: "primary" },
        { label: "A02", value: String(STOCK.filter((s) => s.face === "A02").reduce((n, s) => n + s.qty, 0)), color: "primary" },
        { label: "B01", value: String(STOCK.filter((s) => s.face === "B01").reduce((n, s) => n + s.qty, 0)), color: "success" }
      ],
      charts: [{ type: "bar", title: "Hang qty by face", data: groupSum(STOCK, "face", "qty") }],
      columns: [{ key: "face", label: "Face" }, { key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "qty", label: "Qty" }],
      rows: STOCK
    },
    "inv.shrink": {
      kpis: [
        { label: "Open", value: String(SHRINK.filter((s) => s.status === "OPEN").length), color: "danger" },
        { label: "Missing units", value: String(SHRINK.reduce((n, s) => n + Math.abs(s.var), 0)), color: "danger" }
      ],
      charts: [{ type: "bar", title: "Abs variance by face", data: groupSum(SHRINK.map((s) => ({ ...s, abs: Math.abs(s.var) })), "face", "abs") }],
      columns: [{ key: "when", label: "When" }, { key: "face", label: "Face" }, { key: "sku", label: "SKU" }, { key: "var", label: "Var" }, { key: "status", label: "Status" }],
      rows: SHRINK
    },
    "inv.imei": {
      kpis: [{ label: "IMEIs", value: String(IMEI.length), color: "primary" }, { label: "On-hand", value: String(IMEI.filter((s) => s.status === "On-hand").length), color: "success" }],
      charts: [{ type: "bar", title: "IMEI status", data: groupSum(IMEI, "status") }],
      columns: [{ key: "imei", label: "IMEI" }, { key: "sku", label: "SKU" }, { key: "product", label: "Product" }, { key: "face", label: "Face" }, { key: "status", label: "Status" }],
      rows: IMEI
    },
    "pur.register": {
      kpis: [{ label: "POs", value: String(PURCHASES.length), color: "primary" }, { label: "Spend", value: money(PURCHASES.reduce((s, r) => s + r.total, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Purchases by supplier", data: groupSum(PURCHASES, "supplier", "total") }],
      columns: [{ key: "po", label: "PO" }, { key: "date", label: "Date" }, { key: "supplier", label: "Supplier" }, { key: "sku", label: "SKU" }, { key: "qty", label: "Qty" }, { key: "total", label: "Total" }],
      rows: PURCHASES
    },
    "pur.supplier": {
      kpis: [{ label: "Suppliers", value: String(new Set(PURCHASES.map((r) => r.supplier)).size), color: "primary" }, { label: "Spend", value: money(PURCHASES.reduce((s, r) => s + r.total, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Spend by supplier", data: groupSum(PURCHASES, "supplier", "total") }],
      columns: [{ key: "supplier", label: "Supplier" }, { key: "po", label: "PO" }, { key: "total", label: "Total" }],
      rows: PURCHASES
    },
    "pur.payments": {
      kpis: [
        { label: "Paid", value: money(PURCHASES.reduce((s, r) => s + r.paid, 0)), color: "success" },
        { label: "Outstanding", value: money(PURCHASES.reduce((s, r) => s + (r.total - r.paid), 0)), color: "danger" }
      ],
      charts: [{ type: "bar", title: "Paid by supplier", data: groupSum(PURCHASES, "supplier", "paid") }],
      columns: [{ key: "po", label: "PO" }, { key: "supplier", label: "Supplier" }, { key: "total", label: "Total" }, { key: "paid", label: "Paid" }],
      rows: PURCHASES
    },
    "crm.customer_os": {
      kpis: [{ label: "Customers", value: String(CUSTOMERS.length), color: "primary" }, { label: "Outstanding", value: money(CUSTOMERS.reduce((s, r) => s + r.outstanding, 0)), color: "danger" }],
      charts: [{ type: "bar", title: "Outstanding", data: groupSum(CUSTOMERS, "customer", "outstanding") }],
      columns: [{ key: "customer", label: "Customer" }, { key: "group", label: "Group" }, { key: "sales", label: "Sales" }, { key: "outstanding", label: "Outstanding" }],
      rows: CUSTOMERS
    },
    "crm.supplier_os": {
      kpis: [{ label: "Suppliers", value: String(SUPPLIERS.length), color: "primary" }, { label: "Outstanding", value: money(SUPPLIERS.reduce((s, r) => s + r.outstanding, 0)), color: "danger" }],
      charts: [{ type: "bar", title: "Supplier outstanding", data: groupSum(SUPPLIERS, "supplier", "outstanding") }],
      columns: [{ key: "supplier", label: "Supplier" }, { key: "purchases", label: "Purchases" }, { key: "outstanding", label: "Outstanding" }],
      rows: SUPPLIERS
    },
    "crm.groups": {
      kpis: [{ label: "Groups", value: String(new Set(CUSTOMERS.map((r) => r.group)).size), color: "primary" }],
      charts: [{ type: "bar", title: "Sales by group", data: groupSum(CUSTOMERS, "group", "sales") }],
      columns: [{ key: "group", label: "Group" }, { key: "customer", label: "Customer" }, { key: "sales", label: "Sales" }],
      rows: CUSTOMERS
    },
    "fin.pl": {
      kpis: [
        { label: "Sales", value: money(sum), color: "success" },
        { label: "COGS", value: money(cost), color: "danger" },
        { label: "Expenses", value: money(EXPENSES.reduce((s, r) => s + r.amount, 0)), color: "danger" },
        { label: "Net", value: money(sum - cost - EXPENSES.reduce((s, r) => s + r.amount, 0)), color: "primary" }
      ],
      charts: [{ type: "bar", title: "P&L buckets", data: { labels: ["Sales", "COGS", "Expenses"], values: [sum, cost, EXPENSES.reduce((s, r) => s + r.amount, 0)] } }],
      columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount" }],
      rows: [
        { line: "Sales", amount: sum }, { line: "COGS", amount: cost },
        { line: "Expenses", amount: EXPENSES.reduce((s, r) => s + r.amount, 0) }
      ]
    },
    "fin.expense": {
      kpis: [{ label: "Expenses", value: money(EXPENSES.reduce((s, r) => s + r.amount, 0)), color: "danger" }],
      charts: [{ type: "bar", title: "By category", data: groupSum(EXPENSES, "category", "amount") }],
      columns: [{ key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "payee", label: "Payee" }, { key: "amount", label: "Amount" }],
      rows: EXPENSES
    },
    "fin.tax": {
      kpis: [
        { label: "Net", value: money(TAX.reduce((s, r) => s + r.net, 0)), color: "primary" },
        { label: "VAT", value: money(TAX.reduce((s, r) => s + r.vat, 0)), color: "danger" }
      ],
      charts: [{ type: "bar", title: "VAT by invoice", data: groupSum(TAX, "invoice_no", "vat") }],
      columns: [{ key: "date", label: "Date" }, { key: "invoice_no", label: "Invoice" }, { key: "net", label: "Net" }, { key: "vat", label: "VAT" }, { key: "levy", label: "Levy" }],
      rows: TAX
    },
    "fin.register": {
      kpis: [{ label: "Sessions", value: String(DRAWER.length), color: "primary" }, { label: "Variance", value: money(DRAWER.reduce((s, r) => s + r.variance, 0)), color: "success" }],
      charts: [{ type: "bar", title: "Cash vs MoMo", data: { labels: DRAWER.map((r) => r.session), values: DRAWER.map((r) => r.cash + r.momo) } }],
      columns: [{ key: "session", label: "Session" }, { key: "cashier", label: "Cashier" }, { key: "opening", label: "Opening" }, { key: "cash", label: "Cash" }, { key: "momo", label: "MoMo" }, { key: "closing", label: "Closing" }, { key: "variance", label: "Var" }],
      rows: DRAWER
    },
    "fin.payments": {
      kpis: [{ label: "Methods", value: String(new Set(sales.map((r) => r.payment)).size), color: "primary" }, { label: "Gross", value: money(sum), color: "success" }],
      charts: [{ type: "bar", title: "Tender mix", data: groupSum(sales, "payment", "total") }],
      columns: [{ key: "payment", label: "Method" }, { key: "invoice_no", label: "Invoice" }, { key: "total", label: "Total" }],
      rows: sales
    },
    "bnpl.book": {
      kpis: [
        { label: "Contracts", value: String(BNPL.length), color: "primary" },
        { label: "Balance", value: money(BNPL.reduce((s, r) => s + r.balance, 0)), color: "danger" }
      ],
      charts: [{ type: "bar", title: "Balance by customer", data: groupSum(BNPL, "customer", "balance") }],
      columns: [{ key: "contract", label: "Contract" }, { key: "customer", label: "Customer" }, { key: "sku", label: "SKU" }, { key: "principal", label: "Principal" }, { key: "paid", label: "Paid" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }],
      rows: BNPL
    },
    "bnpl.due": {
      kpis: [{ label: "Due lines", value: String(BNPL.length), color: "primary" }, { label: "Due value", value: money(BNPL.reduce((s, r) => s + r.balance, 0)), color: "danger" }],
      charts: [{ type: "bar", title: "Due by status", data: groupSum(BNPL, "status", "balance") }],
      columns: [{ key: "contract", label: "Contract" }, { key: "customer", label: "Customer" }, { key: "due", label: "Due" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }],
      rows: BNPL
    },
    "bnpl.aging": {
      kpis: [{ label: "Overdue", value: String(BNPL.filter((r) => r.status === "Overdue").length), color: "danger" }],
      charts: [{ type: "bar", title: "Aging", data: groupSum(BNPL, "status", "balance") }],
      columns: [{ key: "contract", label: "Contract" }, { key: "customer", label: "Customer" }, { key: "due", label: "Due" }, { key: "balance", label: "Balance" }, { key: "status", label: "Status" }],
      rows: BNPL.filter((r) => r.status === "Overdue")
    },
    "bnpl.lock": {
      kpis: [{ label: "Locked devices", value: String(LOCKS.length), color: "primary" }],
      charts: [{ type: "bar", title: "Lock status", data: groupSum(LOCKS, "status") }],
      columns: [{ key: "imei", label: "IMEI" }, { key: "customer", label: "Customer" }, { key: "code", label: "Lock code" }, { key: "apply_no", label: "Pre Apply No." }, { key: "expires", label: "Expires" }, { key: "status", label: "Status" }],
      rows: LOCKS
    }
  };

  const resolved = ALIAS[code] || code;
  const body = packs[resolved] || packs[code] || {
    kpis: [{ label: "Rows", value: "0", color: "primary" }],
    charts: [],
    columns: [{ key: "note", label: "Note" }],
    rows: [{ note: T.blurb || "Sandbox stub — same card chrome as the live report." }]
  };
  if (code === "fin.trial") {
    body.columns = [{ key: "account", label: "Account" }, { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }];
    body.rows = [
      { account: "Cash on hand", debit: 1065, credit: 0 },
      { account: "Inventory", debit: 6324, credit: 0 },
      { account: "Sales", debit: 0, credit: 3070 }
    ];
    body.kpis = [{ label: "Debits", value: money(7389), color: "primary" }, { label: "Credits", value: money(3070), color: "success" }];
  }
  if (code === "fin.balance") {
    body.columns = [{ key: "line", label: "Line" }, { key: "amount", label: "Amount" }];
    body.rows = [{ line: "Assets", amount: 7389 }, { line: "Liabilities", amount: 240 }, { line: "Equity", amount: 7149 }];
  }
  if (code === "fin.cashflow") {
    body.columns = [{ key: "bucket", label: "Bucket" }, { key: "amount", label: "Amount" }];
    body.rows = [{ bucket: "Operating", amount: 3070 }, { bucket: "Investing", amount: -440 }, { bucket: "Financing", amount: 0 }];
  }
  if (code === "col.ptp") {
    body.columns = [{ key: "customer", label: "Customer" }, { key: "promise", label: "Promise date" }, { key: "amount", label: "Amount" }];
    body.rows = [{ customer: "ABRAHAM TEYE NARH · SA02325", promise: "2026-09-22", amount: 200 }];
  }
  if (code === "col.calls") {
    body.columns = [{ key: "when", label: "When" }, { key: "customer", label: "Customer" }, { key: "result", label: "Result" }];
    body.rows = [{ when: "2026-09-16 09:10", customer: "ABRAHAM TEYE NARH · SA02325", result: "No answer" }];
  }
  if (code === "col.regular") {
    body.columns = [{ key: "customer", label: "Customer" }, { key: "streak", label: "On-time months" }];
    body.rows = [{ customer: "Prosper Dunyo", streak: 3 }];
  }
  if (code === "sys.activity") {
    body.columns = [{ key: "when", label: "When" }, { key: "who", label: "Who" }, { key: "action", label: "Action" }, { key: "note", label: "Note" }];
    body.rows = [{ when: "2026-09-08", who: "Nathan Tetteh Buer-Doe", action: "Added", note: "Invoice A1017564217982586950" }];
  }
  return { template: T, filters, ...body };
}

const MOD_ICON = {
  Sales: ["🛒", "mod-sales"],
  Inventory: ["📦", "mod-inventory"],
  Purchases: ["🧾", "mod-purchases"],
  Contacts: ["👤", "mod-contacts"],
  Finance: ["💹", "mod-finance"],
  "BNPL / Collections": ["🔒", "mod-bnpl"]
};
const KPI_ICON = { primary: "💰", success: "✅", danger: "⚠", neutral: "●" };

const SELECTED = {};
const BLURB = {
  "Purchase Reports": "Read-only documents. Working lists live under Purchases.",
  "Inventory Reports": "Read-only documents. Working lists live under Records → List Products.",
  "Sales Reports": "Read-only documents. Working lists live under Sales.",
  "Finance Reports": "Read-only documents. Working lists live under Finance.",
  "Collections Reports": "Read-only documents. Working lists live under Collections.",
  "System Reports": "Read-only documents. Working lists live under System."
};
const WORK = {
  "Purchase Reports": "Purchases",
  "Inventory Reports": "List Products",
  "Sales Reports": "Sales",
  "Finance Reports": "Finance",
  "Collections Reports": "Collections",
  "System Reports": "System"
};

function rowId(row) {
  return String(row.sku || row.invoice_no || row.po || row.contract || row.imei || row.session || row.customer || row.supplier || row.day || JSON.stringify(row).slice(0, 24));
}
function rowLabel(row) {
  const id = row.sku || row.invoice_no || row.po || row.contract || row.imei || row.session || "";
  const name = row.name || row.product || row.customer || row.supplier || row.cashier || row.title || "";
  return [id, name].filter(Boolean).join(" · ") || rowId(row);
}

function generateReport(code) {
  if (code === "all") {
    active = "all";
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = "Reports · All Reports";
    renderLanding();
    paintMenu();
    return;
  }
  const filters = FILTERS();
  const report = pack(code, filters);
  const crumb = document.getElementById("crumb");
  if (crumb) crumb.textContent = report.template.module + " · " + report.template.name;
  renderReport(report);
  paintMenu();
}

function scopeToolsHTML() {
  const showAgent = railSub === "BNPL (Hire Purchase)" && railLoc === "BNPL Market (Field)";
  return `
    <div class="items-tools">
      <select id="std-sub" class="scope-sub">${SUBS.map((s) => `<option ${s === railSub ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="std-loc" class="scope-loc">${LOCS.map((s) => `<option ${s === railLoc ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="std-agent" class="scope-agent ${showAgent ? "" : "hide"}">${agentOptions()}</select>
      <button type="button" class="btn-lilac" id="std-date">📅 Filter by date</button>
    </div>`;
}
function bindScopeTools(root) {
  const sub = root.querySelector("#std-sub");
  const loc = root.querySelector("#std-loc");
  const agent = root.querySelector("#std-agent");
  if (sub) sub.onchange = () => {
    railSub = sub.value;
    paintMenu();
    if (appActive) renderModuleStub(appActive);
    else if (active === "all" || active === "module") renderLanding();
    else generateReport(active);
  };
  if (loc) loc.onchange = () => {
    railLoc = loc.value;
    paintMenu();
    if (appActive) renderModuleStub(appActive);
    else if (active === "all" || active === "module") renderLanding();
    else generateReport(active);
  };
  if (agent) agent.onchange = () => { railAgent = agent.value; };
  root.querySelector("#std-date")?.addEventListener("click", () => document.getElementById("date-from").focus());
}

function renderLanding() {
  const box = document.getElementById("report");
  if (!box) return;
  const tab = landingTab;
  box.innerHTML = `
    <div class="items-page landing">
      <div class="items-toolbar">
        <div>
          <h2>Reports <span class="subhead">Read-only documents. Working lists live under Purchases, Sales, Operations and Records.</span></h2>
          ${scopeToolsHTML()}
        </div>
      </div>
      <nav class="rep-tabs">
        <button type="button" data-tab="all" class="${tab === "all" ? "on" : ""}">All Reports</button>
        ${MENU.map((m) => `<button type="button" data-tab="${m.id}" class="${tab === m.id ? "on" : ""}">${m.module}</button>`).join("")}
      </nav>
      <div class="landing-grid ${tab === "all" ? "two" : "one"}">
      ${(tab === "all" ? MENU : MENU.filter((m) => m.id === tab)).map((m) => `
        <section class="rep-block">
          <h3 class="rep-sec">${esc(m.module)}</h3>
          <div class="rep-list">${m.items.map((i) => `
            <button type="button" class="rep-row" data-open="${i.code}">
              <b>${esc(i.name)}</b>
              <span>${esc(i.blurb || "")}</span>
            </button>
          `).join("")}</div>
        </section>
      `).join("")}
      </div>
    </div>`;
  bindScopeTools(box);
  box.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => { landingTab = b.dataset.tab; renderLanding(); };
  });
  box.querySelectorAll("[data-open]").forEach((b) => {
    b.onclick = () => { active = b.dataset.open; openGroup = MENU.find((m) => m.items.some((i) => i.code === active || (i.children || []).some((c) => c.code === active)))?.id; generateReport(active); };
  });
}

function renderReport(report) {
  const box = document.getElementById("report");
  if (!box) return;
  box.innerHTML = "";
  box.appendChild(renderStandard(report));
}

function sheetKind(code) {
  if (code === "inv.items" || code === "sales.grouped" || code === "sales.trending" || code === "inv.stock") return "item";
  if (String(code).startsWith("pur.")) return "purchase";
  if (code === "sales.product_sell" || code === "sales.rep" || code === "sales.sell_payment" || code === "sales.pos_register" || String(code).startsWith("sales.")) return "sell";
  return "card";
}

function renderStandard(report) {
  const rows = report.rows || [];
  const code = report.template.code;
  const kind = sheetKind(code);
  const key = SELECTED[code] && SELECTED[code] !== "*" ? SELECTED[code] : (rows[0] ? rowId(rows[0]) : "");
  const rec = rows.find((r) => rowId(r) === key) || rows[0] || {};
  const wrap = document.createElement("div");
  wrap.className = "items-page";
  const body = kind === "item" ? itemsHead(rec) + itemsPriceTable(rec) + "<h4>Product Stock Details</h4>" + itemsStockTable(rec)
    : kind === "purchase" ? purchaseCard(rec)
    : kind === "sell" ? sellCard(rec)
    : genericHead(report, rec) + kpiTable(report.kpis) + "<h4>" + esc(detailTitle(report)) + "</h4>" + blueTable(report.columns, [rec], code);
  wrap.innerHTML = `
    <div class="items-toolbar">
      <div>
        <h2>${esc(report.template.name)}</h2>
        <p>${esc(BLURB[report.template.module] || "Read-only report card.")}</p>
        ${scopeToolsHTML()}
        <p class="work-link">Working list: <a href="#">${esc(WORK[report.template.module] || "Records")}</a></p>
        <label class="this-rec">This record
          <span class="this-row">
            <select id="std-pick">
              ${rows.map((r) => `<option value="${esc(rowId(r))}" ${rowId(r) === key ? "selected" : ""}>${esc(rowLabel(r))}</option>`).join("")}
            </select>
            <button type="button" class="btn-blue" data-print>Print</button>
          </span>
        </label>
      </div>
      <button type="button" class="btn-lilac top-print" data-print>Print</button>
    </div>
    <section class="items-card">
      ${body}
      <div class="items-print-row"><button type="button" class="btn-lilac" data-print>Print</button></div>
    </section>
  `;
  bindScopeTools(wrap);
  const pick = wrap.querySelector("#std-pick");
  if (pick) pick.onchange = (e) => {
    SELECTED[code] = e.target.value;
    generateReport(code);
  };
  wrap.querySelectorAll("[data-print]").forEach((b) => { b.onclick = () => window.print(); });
  wrap.querySelectorAll("[data-row]").forEach((tr) => {
    tr.onclick = () => openDetail(rec);
  });
  return wrap;
}

function itemsHead(rec) {
  return `
    <h3>${esc(rec.name || rec.product || "Product")}</h3>
    <div class="items-meta">
      <div>
        <p><b>SKU:</b> ${esc(rec.sku)}</p>
        <p><b>Brand:</b> ${esc(rec.brand)}</p>
        <p><b>Unit:</b> ${esc(rec.unit)}</p>
        <p><b>Barcode Type:</b> ${esc(rec.barcode_type)}</p>
        <p><b>Available in locations:</b> ${esc(rec.locations)}</p>
      </div>
      <div>
        <p><b>Category:</b> ${esc(rec.category)}</p>
        <p><b>Sub category:</b> ${esc(rec.subcategory)}</p>
        <p><b>Manage Stock?:</b> ${esc(rec.manage_stock)}</p>
        <p><b>Alert quantity:</b> ${esc(rec.alert_qty)}</p>
      </div>
      <div>
        <p><b>Expires in:</b> ${esc(rec.expires)}</p>
        <p><b>Applicable Tax:</b> ${esc(rec.tax)}</p>
        <p><b>Selling Price Tax Type:</b> ${esc(rec.tax_type)}</p>
        <p><b>Product Type:</b> ${esc(rec.product_type)}</p>
      </div>
      <div class="img-ph">${rec.image ? `<img src="${esc(rec.image)}" alt="" style="max-width:100%;max-height:110px;object-fit:contain">` : "Product image"}</div>
    </div>`;
}

function genericHead(report, rec) {
  const pairs = Object.entries(rec).filter(([k, v]) =>
    v != null && v !== "" && !["cost", "stock_value", "group_prices"].includes(k)
  ).slice(0, 12);
  const cols = [[], [], []];
  pairs.forEach((p, i) => cols[i % 3].push(p));
  const label = (k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `
    <h3>${esc(rowLabel(rec) || report.template.name)}</h3>
    <div class="items-meta">
      ${cols.map((col) => `<div>${col.map(([k, v]) => `<p><b>${esc(label(k))}:</b> ${esc(v)}</p>`).join("")}</div>`).join("")}
      <div class="img-ph">${esc(report.template.module)} visual</div>
    </div>`;
}

function purchaseCard(rec) {
  const ref = rec.po || rec.reference || "—";
  const qty = rec.qty || 1;
  const total = Number(rec.total || 0);
  const unit = qty ? total / qty : total;
  const paid = Number(rec.paid || 0);
  return `
    <h3>Purchase Details (Reference No: #${esc(ref)})</h3>
    <div class="items-meta">
      <div>
        <p><b>Supplier:</b> ${esc(rec.supplier || "—")}</p>
        <p>Mobile: —</p>
      </div>
      <div>
        <p><b>Business:</b> ${esc(rec.location || rec.locations || railLoc)}</p>
      </div>
      <div>
        <p><b>Date:</b> ${esc(rec.date || "")}</p>
        <p><b>Reference No:</b> #${esc(ref)}</p>
        <p><b>Purchase Status:</b> Received</p>
        <p><b>Payment Status:</b> ${paid >= total && total > 0 ? "Paid" : "Due"}</p>
      </div>
      <div class="img-ph">${ref === "PIN-00475" ? `<img src="/uploads/invoices/pinaro-00475.jpg" alt="" style="max-width:100%;max-height:110px;object-fit:contain">` : "Purchase visual"}</div>
    </div>
    <table class="blue-tbl">
      <thead><tr>
        <th>#</th><th>Product Name</th><th>SKU</th><th>Purchase Quantity</th>
        <th>Unit Cost (Before Discount)</th><th>Discount Percent</th>
        <th>Unit Cost (Before Tax)</th><th>Subtotal (Before Tax)</th><th>Tax</th>
        <th>Unit Cost Price (After Tax)</th><th>Subtotal</th>
      </tr></thead>
      <tbody><tr class="clickable" data-row="0">
        <td>1</td><td>${esc(rec.product || rec.sku)}</td><td>${esc(rec.sku)}</td><td>${qty}</td>
        <td>₵ ${unit.toFixed(2)}</td><td>0.00 %</td><td>₵ ${unit.toFixed(2)}</td>
        <td>₵ ${total.toFixed(2)}</td><td>₵ 0.00</td><td>₵ ${unit.toFixed(2)}</td><td>₵ ${total.toFixed(2)}</td>
      </tr></tbody>
    </table>
    <div class="sell-grid" style="margin-top:12px">
      <div>
        <p><b>Payment info:</b></p>
        <table class="blue-tbl">
          <thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
          <tbody><tr><td>1</td><td>${esc(rec.date || "")}</td><td>—</td><td>₵ ${paid.toFixed(2)}</td><td>Bank</td><td>—</td></tr></tbody>
        </table>
      </div>
      <div class="totals">
        <div><span>Net Total Amount:</span><b>₵ ${total.toFixed(2)}</b></div>
        <div><span>Discount:</span><span>₵ 0.00</span></div>
        <div><span>Purchase Tax:</span><span>₵ 0.00</span></div>
        <div><span>Purchase Total:</span><b>₵ ${total.toFixed(2)}</b></div>
      </div>
    </div>`;
}

function sellCard(rec) {
  const qty = rec.qty || 1;
  const unit = rec.total || rec.amount || rec.principal || rec.price || 0;
  return `
    <h3>Sell Details ( Invoice No. : ${esc(rec.invoice_no || rec.session || rec.sku || "—")} )</h3>
    <div class="items-meta">
      <div>
        <p><b>Invoice No.:</b> ${esc(rec.invoice_no || rec.session || "—")}</p>
        <p><b>Status:</b> ${esc(rec.status || rec.payment || "final")}</p>
        <p><b>Payment Status:</b> ${esc(rec.payment || "paid")}</p>
      </div>
      <div>
        <p><b>Customer name:</b> ${esc(rec.customer || "—")}</p>
        <p>Mobile: ${esc(rec.mobile || "—")}</p>
      </div>
      <div>
        <p><b>Cashier staff:</b> ${esc(rec.cashier || rec.user || "—")}</p>
        <p><b>Shipping:</b> ${esc(rec.shipping || rec.location || "—")}</p>
        <p><b>Date:</b> ${esc(String(rec.created_at || rec.date || "").slice(0, 10) || "—")}</p>
      </div>
      <div class="img-ph">Sale visual</div>
    </div>
    <table class="blue-tbl">
      <thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Price inc. tax</th><th>Subtotal</th></tr></thead>
      <tbody><tr class="clickable" data-row="0">
        <td>1</td><td>${esc(rec.product || rec.sku || rec.category || rowLabel(rec))}</td><td>${qty}</td>
        <td>₵ ${Number(unit).toFixed(2)}</td><td>₵ 0.00</td><td>₵ 0.00</td>
        <td>₵ ${Number(unit).toFixed(2)}</td><td>₵ ${Number(unit).toFixed(2)}</td>
      </tr></tbody>
    </table>
    <div class="sell-grid" style="margin-top:12px">
      <div>
        <p><b>Payment info:</b></p>
        <table class="blue-tbl">
          <thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
          <tbody><tr><td>1</td><td>${esc(String(rec.created_at || rec.date || "").slice(0, 10))}</td><td>—</td><td>₵ ${Number(unit).toFixed(2)}</td><td>${esc(rec.payment || "paid")}</td><td>—</td></tr></tbody>
        </table>
      </div>
      <div class="totals">
        <div><span>Total:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
        <div><span>Discount:</span><span>0.00 %</span></div>
        <div><span>Total Payable:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
        <div><span>Total paid:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
        <div><span>Total remaining:</span><b>₵ 0.00</b></div>
      </div>
    </div>`;
}

function itemsPriceTable(rec) {
  return `<table class="blue-tbl">
    <thead><tr>
      <th>Default Purchase Price (Exc. tax)</th>
      <th>Default Purchase Price (Inc. tax)</th>
      <th>x Margin(%)</th>
      <th>Default Selling Price (Exc. tax)</th>
      <th>Default Selling Price (Inc. tax)</th>
      <th>Group Prices</th>
      <th>Variation Images</th>
    </tr></thead>
    <tbody><tr>
      <td>₵ ${Number(rec.purchase_ex || 0).toFixed(2)}</td>
      <td>₵ ${Number(rec.purchase_inc || 0).toFixed(2)}</td>
      <td>${Number(rec.margin || 0).toFixed(2)}</td>
      <td>₵ ${Number(rec.sell_ex || 0).toFixed(2)}</td>
      <td>₵ ${Number(rec.sell_inc || 0).toFixed(2)}</td>
      <td>${esc(rec.group_prices || "").replace("\n", "<br>")}</td>
      <td></td>
    </tr></tbody>
  </table>`;
}

function itemsStockTable(rec) {
  return `<table class="blue-tbl">
    <thead><tr>
      <th>SKU</th><th>Product</th><th>Business Location</th><th>Department</th>
      <th>Unit Price</th><th>Current stock</th><th>Current Stock Value</th>
      <th>Total unit sold</th><th>Total Unit Transfered</th><th>Total Unit Adjusted</th>
    </tr></thead>
    <tbody><tr class="clickable" data-row="0">
      <td>${esc(rec.sku)}</td><td>${esc(rec.name)}</td><td>${esc(rec.locations)}</td><td>${esc(rec.department)}</td>
      <td>₵ ${Number(rec.unit_price || 0).toFixed(2)}</td>
      <td>${Number(rec.stock || 0).toFixed(2)}${esc(rec.unit || "Pc")}</td>
      <td>₵ ${Number(rec.stock_value || 0).toFixed(2)}</td>
      <td>${Number(rec.sold || 0).toFixed(2)}${esc(rec.unit || "Pc")}</td>
      <td>${Number(rec.transferred || 0).toFixed(2)}${esc(rec.unit || "Pc")}</td>
      <td>${Number(rec.adjusted || 0).toFixed(2)}${esc(rec.unit || "Pc")}</td>
    </tr></tbody>
  </table>`;
}

function kpiTable(kpis) {
  const list = kpis || [];
  if (!list.length) return "";
  return `<table class="blue-tbl">
    <thead><tr>${list.map((k) => `<th>${esc(k.label)}</th>`).join("")}</tr></thead>
    <tbody><tr>${list.map((k) => `<td>${esc(k.value)}</td>`).join("")}</tr></tbody>
  </table>`;
}

function chartSlot(report) {
  if (!report.charts || !report.charts.length) return "";
  return `<div class="std-chart" data-charts="1"></div>`;
}

function detailTitle(report) {
  if (report.template.code === "inv.items") return "Product Stock Details";
  if (report.template.module === "Sales") return "Sales Details";
  if (report.template.module === "Inventory") return "Stock Details";
  if (report.template.module === "Purchases") return "Purchase Details";
  if (report.template.module === "Finance") return "Finance Details";
  if (report.template.module === "Contacts") return "Ledger Details";
  return "Report Details";
}

function blueTable(columns, rows, code) {
  const cols = columns || [];
  const list = rows || [];
  return `<div class="table-wrap"><table class="blue-tbl">
    <thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${list.map((r, i) => `<tr class="clickable" data-row="${i}">${cols.map((c) => `<td>${cellHtml(c, r)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function renderHeader(report) {
  const [ico, cls] = MOD_ICON[report.template.module] || ["📄", "mod-sales"];
  const div = document.createElement("div");
  div.className = "report-header";
  div.innerHTML = `
    <div class="mod-badge ${cls}">${ico}</div>
    <div>
      <h2>${esc(report.template.name)}</h2>
      <p>${esc(report.template.module)} · ${esc(report.filters.branch === "ALL" ? "All Fiberk" : "Fiberk Shop")}</p>
      <p>${esc(report.filters.dateFrom)} → ${esc(report.filters.dateTo)}</p>
    </div>
    <div class="meta-pills">
      <span class="chip">Generated by Delase Kormla</span>
      <span class="chip">${new Date().toISOString().slice(0, 16).replace("T", " ")}</span>
    </div>
  `;
  return div;
}
function renderSummary(kpis) {
  const wrap = document.createElement("div");
  wrap.className = "report-kpis";
  (kpis || []).forEach((kpi) => {
    const color = kpi.color || "primary";
    const el = document.createElement("div");
    el.className = "report-kpi report-kpi--" + color;
    el.innerHTML = `
      <div class="report-kpi-ico">${KPI_ICON[color] || "●"}</div>
      <div class="report-kpi-label">${esc(kpi.label)}</div>
      <div class="report-kpi-value">${esc(kpi.value)}</div>
    `;
    wrap.appendChild(el);
  });
  return wrap;
}
function renderCharts(charts) {
  const wrap = document.createElement("div");
  wrap.className = "chart-grid";
  (charts || []).forEach((chart) => {
    if (!chart || !chart.data) return;
    const cell = document.createElement("div");
    cell.className = "chart-cell";
    const h = document.createElement("h3");
    h.textContent = chart.title;
    const canvas = document.createElement("canvas");
    cell.appendChild(h);
    cell.appendChild(canvas);
    wrap.appendChild(cell);
    const colors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0f766e", "#be123c"];
    if (window.Chart) {
      new Chart(canvas, {
        type: chart.type === "line" ? "line" : "bar",
        data: {
          labels: chart.data.labels,
          datasets: [{
            label: chart.title,
            data: chart.data.values,
            backgroundColor: chart.data.labels.map((_, i) => colors[i % colors.length]),
            borderColor: "#1d4ed8",
            borderWidth: chart.type === "line" ? 2 : 0,
            borderRadius: 6
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  });
  return wrap;
}
function cellHtml(col, row) {
  const v = row[col.key];
  if (col.key === "face") return `<span class="face face-${esc(v)}">${esc(v)}</span>`;
  if (col.key === "status") {
    const bad = /open|overdue|void/i.test(String(v));
    return `<span class="${bad ? "pill-bad" : "pill-ok"}">${esc(v)}</span>`;
  }
  return esc(v);
}
function renderTable(columns, rows, code) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const cols = columns || [];
  const list = rows || [];
  wrap.innerHTML = `
    <table class="report-table">
      <thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>${list.map((r, i) => `<tr class="clickable" data-row="${i}">${cols.map((c) => `<td>${cellHtml(c, r)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
  wrap.querySelectorAll("[data-row]").forEach((tr) => {
    tr.onclick = () => openDetail(list[+tr.dataset.row]);
  });
  return wrap;
}
function renderFooter() {
  const div = document.createElement("div");
  div.className = "report-footer";
  div.innerHTML = `<p>Sandbox mock · click a POS Register row to open Sell Details.</p>`;
  return div;
}

function openSell(row) { openDetail(row); }
function detailTitleFor(row) {
  if (row.invoice_no) return "Sell Details ( Invoice No. : " + row.invoice_no + " )";
  if (row.po) return "Purchase Details ( " + row.po + " )";
  if (row.contract) return "BNPL Details ( " + row.contract + " )";
  if (row.session) return "Register Details ( " + row.session + " )";
  if (row.sku && row.product) return "Item Details ( " + row.sku + " )";
  if (row.imei) return "Lock Details ( " + row.imei + " )";
  return "Record Details";
}
function openDetail(row) {
  if (!row) return;
  document.querySelector(".mask")?.remove();
  const qty = row.qty || 1;
  const unit = row.total || row.amount || row.principal || row.price || 0;
  const mask = document.createElement("div");
  mask.className = "mask";
  mask.innerHTML = `
    <article class="sell">
      <div class="sell-h">
        <div>${esc(detailTitleFor(row))}</div>
        <button type="button" data-x>×</button>
      </div>
      <div class="sell-b">
        <div class="sell-meta">
          <div>
            <p><b>${row.invoice_no ? "Invoice No.:" : "Record:"}</b> ${esc(row.invoice_no || row.po || row.sku || row.contract || row.session || "—")}</p>
            <p><b>Status:</b> ${esc(row.status || row.payment || "—")}</p>
            <p><b>Payment Status:</b> ${esc(row.payment || "—")}</p>
          </div>
          <div>
            <h4>Customer name:</h4>
            <p>${esc(row.customer || row.supplier || row.payee || "—")}</p>
            <h4>Address:</h4>
            <p>${esc(row.customer || row.location || "—")}</p>
            <p>Mobile: ${esc(row.mobile || "—")}</p>
          </div>
          <div>
            <h4>Cashier staff:</h4>
            <p>${esc(row.cashier || row.user || "—")}</p>
            <h4>Shipping:</h4>
            <p><span class="tag">${esc(row.shipping || row.location || "—")}</span></p>
          </div>
          <div><p>Date: ${esc(String(row.created_at || row.date || row.due || "").slice(0, 10) || "—")}</p></div>
        </div>
        <p><b>Products:</b></p>
        <table>
          <thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Price inc. tax</th><th>Subtotal</th></tr></thead>
          <tbody><tr>
            <td>1</td><td>${esc(row.product || row.sku || row.category || rowLabel(row))}</td><td>${qty}</td>
            <td>₵ ${Number(unit || row.amount || row.principal || row.price || 0).toFixed(2)}</td><td>₵ 0.00</td><td>₵ 0.00</td>
            <td>₵ ${Number(unit || row.amount || row.principal || row.price || 0).toFixed(2)}</td><td>₵ ${Number(unit || row.amount || row.principal || row.price || 0).toFixed(2)}</td>
          </tr></tbody>
        </table>
        <div class="sell-grid">
          <div>
            <p><b>Payment info:</b></p>
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
              <tbody><tr><td>1</td><td>${esc(String(row.created_at).slice(0,10))}</td><td>—</td><td>₵ ${Number(unit).toFixed(2)}</td><td>${esc(row.payment || "paid")}</td><td>—</td></tr></tbody>
            </table>
          </div>
          <div class="totals">
            <div><span>Total:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
            <div><span>Discount:</span><span>0.00 %</span></div>
            <div><span>Packing Charge:</span><span>₵ 0.00</span></div>
            <div><span>Order Tax:</span><span>₵ 0.00</span></div>
            <div><span>Shipping:</span><span>₵ 0.00</span></div>
            <div><span>Round Off:</span><span>₵ 0.00</span></div>
            <div><span>Total Payable:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
            <div><span>Total paid:</span><b>₵ ${Number(unit).toFixed(2)}</b></div>
            <div><span>Total remaining:</span><b>₵ 0.00</b></div>
          </div>
        </div>
        <div class="sell-foot">
          <button class="b-green" type="button">Packing Slip</button>
          <button class="b-purple" type="button">Print Invoice</button>
          <button class="b-dark" type="button" data-x>Close</button>
        </div>
      </div>
    </article>`;
  mask.addEventListener("click", (e) => {
    if (e.target === mask || e.target.closest("[data-x]")) mask.remove();
  });
  document.body.appendChild(mask);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CORE = [
  { id: "home", name: "Home", icon: "⌂" },
  { id: "records", name: "Records", icon: "▦" },
  { id: "operations", name: "Operations", icon: "☰" },
  { id: "purchases", name: "Purchases", icon: "🛒" },
  { id: "sales", name: "Sales", icon: "🏷" },
  { id: "finance", name: "Finance", icon: "🏦" },
  { id: "collections", name: "Collections", icon: "☎" },
  { id: "reports", name: "Reports", icon: "📊" },
  { id: "system", name: "System", icon: "⚙" }
];
const APPS = [
  { name: "Academy", color: "#7B3FE4" },
  { name: "Accounting", color: "#E7A8D4" },
  { name: "AI Assistance", color: "#6F8F7A" },
  { name: "Asset Management", color: "#3BA8B8" },
  { name: "Call Centre", color: "#9B2040" },
  { name: "Catalogue QR", color: "#F5A024" },
  { name: "Communications", color: "#0D1B2A" },
  { name: "Connector", color: "#2ED573" },
  { name: "CRM", color: "#9AABB8" },
  { name: "Custom Dashboards", color: "#6C3CE0" },
  { name: "Field Ops", color: "#C85A22" },
  { name: "HRM", color: "#6A4A9A" },
  { name: "Manufacturing", color: "#F0A020" },
  { name: "Project", color: "#E91E8A" },
  { name: "Repair", color: "#B39A8A" },
  { name: "Spreadsheet", color: "#2B7DE9" },
  { name: "WMS", color: "#1B7A62" },
  { name: "WooCommerce", color: "#7A3AA8" }
];
const SUBS = ["All Subsidiaries", "Operations Hub", "Axidigetek (E-comm HQ)", "BNPL (Hire Purchase)", "Delkor Logistics", "Fiberk (Electronics)"];
const LOCS = ["All Locations", "Axidigetek Online Store", "BNPL Market (Field)", "BNPL Online Shop", "Delkor Online", "Delkor Furniture Market", "Fiberk Shop", "Field Stock Hub"];
const AGENTS = [
  "All Agents",
  "Abel",
  "Abel Sromani · SA02413",
  "ABRAHAM",
  "ABRAHAM TEYE NARH · SA02325",
  "Agnes",
  "Ama Mensah",
  "Ama Serwaa",
  "Anita",
  "Anita Mantibea Asare · SA02576",
  "ANNABEL KOKOR OWORHU · SA00863",
  "Azubila",
  "Barikisu",
  "Barikisu Ayuba · SA02488",
  "Bency",
  "Bright Kaizer · SA02583",
  "Christiana Amerema Azure · SA02570",
  "Cythia",
  "Diana Brenya",
  "Diana Brenya · SA02875",
  "Efua Darko",
  "Elizerbeth",
  "Emma",
  "EMMANUEL AKINOLA · SA01435",
  "Emmanuel Vincent Baaba · SA02983",
  "Ernestina Ofori",
  "Ernestina Ofori · SA02890",
  "Gifty Amedor",
  "Gifty Nayekie Amedor · SA02489",
  "Isaac Azubila · SA02567",
  "Ishmael",
  "Ishmael Anawusu · SA02572",
  "Ivy",
  "Ivy Esinam Humaley · SA02417",
  "Jennifer",
  "Jennifer Azure · SA02485",
  "John",
  "JOHN AGBAH · SA02437",
  "John Dugba Osei · SA02911",
  "Joseph Aboagye",
  "Joseph Kwadwo Aboagye · SA02869"
];
function agentOptions() {
  return AGENTS.map((a) => `<option ${a === railAgent ? "selected" : ""}>${esc(a)}</option>`).join("");
}

let active = "all";
let openGroup = null;
let landingTab = "all";
let coreOpen = "reports";
let appActive = "";
let moduleTab = "";

const MODULE_TABS = {
  Accounting: ["Summary", "Chart of accounts", "Books", "Planning", "Reports", "Setup"],
  Communications: ["Summary", "Talk", "Groups", "Work", "Reports", "Setup"]
};
function moduleTabs(name) {
  return MODULE_TABS[name] || ["Summary", "Topics", "Reports", "Setup"];
}

const CHEVRON_STYLES = [
  { id: "thin", name: "Minimal thin", note: "Light line, sharp corners" },
  { id: "bold", name: "Bold", note: "Filled, slightly tapered" },
  { id: "rounded", name: "Rounded", note: "Soft caps, the current look" },
  { id: "square", name: "Square", note: "Solid triangle caret" },
  { id: "feather", name: "Ultra-thin", note: "Hairline, airy" },
  { id: "heavy", name: "Heavy", note: "Chunky filled arrow" },
  { id: "double", name: "Double", note: "Two chevrons, expand/collapse" }
];
const CHEVRON_SIZES = [14, 20, 30, 40, 60, 80, 100, 120];
const CHROME = {
  14: { font: 13, leaf: 12.5, icon: 16, pill: 13, padY: 6, padX: 8, gap: 8, sidebar: 248 },
  20: { font: 15, leaf: 14, icon: 18, pill: 14, padY: 7, padX: 9, gap: 8, sidebar: 270 },
  30: { font: 17, leaf: 15.5, icon: 21, pill: 16, padY: 8, padX: 10, gap: 9, sidebar: 300 },
  40: { font: 20, leaf: 17, icon: 24, pill: 18, padY: 10, padX: 12, gap: 10, sidebar: 340 },
  60: { font: 26, leaf: 22, icon: 32, pill: 22, padY: 12, padX: 14, gap: 12, sidebar: 400 },
  80: { font: 34, leaf: 28, icon: 42, pill: 28, padY: 14, padX: 16, gap: 14, sidebar: 480 },
  100: { font: 42, leaf: 34, icon: 52, pill: 34, padY: 16, padX: 18, gap: 16, sidebar: 540 },
  120: { font: 50, leaf: 40, icon: 62, pill: 40, padY: 18, padX: 20, gap: 18, sidebar: 600 }
};
const CHEV_PATH = {
  thin: { right: "M9 6l6 6-6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", up: "M6 15l6-6 6 6" },
  bold: {
    right: "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z",
    down: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z",
    left: "M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z",
    up: "M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"
  },
  rounded: { right: "M10 6l6 6-6 6", down: "M6 10l6 6 6-6", left: "M14 6l-6 6 6 6", up: "M6 14l6-6 6 6" },
  square: { right: "M8 4l8 8-8 8z", down: "M4 8l8 8 8-8z", left: "M16 4l-8 8 8 8z", up: "M4 16l8-8 8 8z" },
  feather: { right: "M9 6l6 6-6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", up: "M6 15l6-6 6 6" },
  heavy: { right: "M7 4l10 8-10 8z", down: "M4 7l8 10 8-10z", left: "M17 4l-10 8 10 8z", up: "M4 17l8-10 8 10z" },
  double: {
    right: "M7 6l5 6-5 6M12 6l5 6-5 6",
    down: "M6 8l6 6 6-6M6 12l6 6 6-6",
    left: "M17 6l-5 6 5 6M12 6l-5 6 5 6",
    up: "M6 16l6-6 6 6M6 12l6-6 6 6"
  }
};
const CHEV_DIRS = ["right", "down", "left", "up"];
let chevronStyle = localStorage.getItem("sandbox-chevron-style") || "rounded";
let chevronSize = Number(localStorage.getItem("sandbox-chevron-size") || 14);
let chevronPlace = localStorage.getItem("sandbox-chevron-place") || "start";
let chevronClosed = localStorage.getItem("sandbox-chevron-closed") || "right";
let chevronOpen = localStorage.getItem("sandbox-chevron-open") || "down";
function chevronMark(open) {
  const dir = open ? chevronOpen : chevronClosed;
  const id = CHEV_PATH[chevronStyle] ? chevronStyle : "rounded";
  const d = CHEV_PATH[id][dir] || CHEV_PATH[id].right;
  const fill = id === "bold" || id === "square" || id === "heavy";
  const sw = id === "feather" ? 1.5 : 2;
  if (fill) {
    return `<span class="chev"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg></span>`;
  }
  return `<span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></span>`;
}
function applyChrome() {
  const c = CHROME[chevronSize] || CHROME[14];
  const root = document.documentElement.style;
  root.setProperty("--rail-w", c.sidebar + "px");
  root.setProperty("--rail-font", c.font + "px");
  root.setProperty("--rail-leaf", c.leaf + "px");
  root.setProperty("--rail-pill", c.pill + "px");
  root.setProperty("--rail-gap", c.gap + "px");
  root.setProperty("--rail-pady", c.padY + "px");
  root.setProperty("--rail-padx", c.padX + "px");
  root.setProperty("--chev-size", chevronSize + "px");
  const phone = document.documentElement.classList.contains("ult-phone") || (window.innerWidth && window.innerWidth <= 820);
  if (!phone) root.setProperty("--ult-rail", c.sidebar + "px");
  document.getElementById("menu")?.classList.toggle("rail-place-end", chevronPlace === "end");
  document.getElementById("menu")?.classList.toggle("rail-place-start", chevronPlace !== "end");
  const side = document.getElementById("ult-side");
  if (side) {
    side.classList.toggle("rail-place-end", chevronPlace === "end");
    side.classList.toggle("rail-place-start", chevronPlace !== "end");
    if (!phone) side.style.width = c.sidebar + "px";
  }
  try { window.dispatchEvent(new CustomEvent("df-chevron")); } catch (e) { /* ignore */ }
}
function setChevron(style, size) {
  if (style) { chevronStyle = style; localStorage.setItem("sandbox-chevron-style", style); }
  if (size) { chevronSize = Number(size); localStorage.setItem("sandbox-chevron-size", String(chevronSize)); }
  applyChrome();
  paintMenu();
}
function chevronGlyph(dir, px) {
  const id = CHEV_PATH[chevronStyle] ? chevronStyle : "rounded";
  const d = CHEV_PATH[id][dir] || CHEV_PATH[id].right;
  const fill = id === "bold" || id === "square" || id === "heavy";
  const sw = id === "feather" ? 1.5 : Math.max(2, Math.round((px || 40) / 20));
  const size = px || 72;
  if (fill) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
function renderChevronSettings() {
  const chrome = CHROME[chevronSize] || CHROME[14];
  document.getElementById("crumb").textContent = "Settings · icons";
  document.getElementById("report").innerHTML = `
    <div class="items-page landing chev-page">
      <section class="items-card chev-hero">
        <p class="kicker">SETTINGS · ICONS</p>
        <h2>Chevron styles</h2>
        <p class="subhead">Tap a size to put it on the left menu. Labels, icons, and arrows all scale together. Tap a family to change the shape.</p>
      </section>
      <section class="items-card">
        <p class="kicker">BIG ROUNDED · iOS</p>
        <h3>${chevronSize === 14 ? "Compact · 13px type" : chevronSize + "px arrow · " + chrome.font + "px type"}</h3>
        <p class="subhead">These draw at the real pixel size. Selecting one updates the sidebar — type included.</p>
        <div class="size-row">
          ${CHEVRON_SIZES.map((n) => `<button type="button" class="${chevronSize === n ? "on dark" : ""}" data-csize="${n}">${n === 14 ? "Compact · 13" : n + " · " + CHROME[n].font}</button>`).join("")}
        </div>
        <div class="chev-preview">
          <div class="chev-tile light"><div>${chevronGlyph(chevronClosed, 72)}</div><span>${chevronClosed.toUpperCase()}</span></div>
          <div class="chev-tile light"><div>${chevronGlyph(chevronOpen, 72)}</div><span>${chevronOpen.toUpperCase()}</span></div>
          <div class="chev-tile navy"><div>${chevronGlyph(chevronClosed, 72)}</div><span>ON NAVY</span></div>
          <div class="chev-tile navy"><div>${chevronGlyph(chevronOpen, 72)}</div><span>ON NAVY</span></div>
        </div>
        <div class="chev-sizes">
          ${[20,30,40,60,80,100,120].map((n) => `
            <button type="button" class="chev-size-card ${chevronSize === n ? "on" : ""}" data-csize="${n}">
              <b>${n}px · ${CHROME[n].font} type</b>
              <span>stroke ${({20:2,30:2,40:3,60:4,80:5,100:6,120:7})[n]}</span>
              <div class="pair">${chevronGlyph("right", 32)} ${chevronGlyph("down", 32)}</div>
            </button>`).join("")}
        </div>
      </section>
      <section class="items-card">
        <h3>Placement</h3>
        <div class="size-row">
          <button type="button" class="${chevronPlace === "end" ? "on" : ""}" data-cplace="end">Option 1 · far right</button>
          <button type="button" class="${chevronPlace === "start" ? "on" : ""}" data-cplace="start">Option 2 · beside label</button>
        </div>
        <h3>Points when closed</h3>
        <div class="size-row">${CHEV_DIRS.map((d) => `<button type="button" class="${chevronClosed === d ? "on" : ""}" data-cclosed="${d}">${d}</button>`).join("")}</div>
        <h3>Points when open</h3>
        <div class="size-row">${CHEV_DIRS.map((d) => `<button type="button" class="${chevronOpen === d ? "on" : ""}" data-copen="${d}">${d}</button>`).join("")}</div>
      </section>
      <section class="items-card">
        <h3>Family</h3>
        <div class="fam-row">
          ${CHEVRON_STYLES.map((s) => `<button type="button" class="${chevronStyle === s.id ? "on" : ""}" data-cstyle="${s.id}">${esc(s.name)}<br><span class="subhead">${esc(s.note)}</span></button>`).join("")}
        </div>
      </section>
    </div>`;
  document.querySelectorAll("[data-csize]").forEach((b) => {
    b.onclick = () => { setChevron(null, b.dataset.csize); renderChevronSettings(); };
  });
  document.querySelectorAll("[data-cstyle]").forEach((b) => {
    b.onclick = () => { setChevron(b.dataset.cstyle, null); renderChevronSettings(); };
  });
  document.querySelectorAll("[data-cplace]").forEach((b) => {
    b.onclick = () => {
      chevronPlace = b.dataset.cplace;
      localStorage.setItem("sandbox-chevron-place", chevronPlace);
      applyChrome(); paintMenu(); renderChevronSettings();
    };
  });
  document.querySelectorAll("[data-cclosed]").forEach((b) => {
    b.onclick = () => {
      chevronClosed = b.dataset.cclosed;
      localStorage.setItem("sandbox-chevron-closed", chevronClosed);
      paintMenu(); renderChevronSettings();
    };
  });
  document.querySelectorAll("[data-copen]").forEach((b) => {
    b.onclick = () => {
      chevronOpen = b.dataset.copen;
      localStorage.setItem("sandbox-chevron-open", chevronOpen);
      paintMenu(); renderChevronSettings();
    };
  });
}
let railSub = "All Subsidiaries";
let railLoc = "All Locations";
let railAgent = "All Agents";

function paintMenu() {
  const aside = document.getElementById("menu");
  if (!aside) return;
  const reportOn = coreOpen === "reports";
  aside.innerHTML = `
    <select id="rail-sub" class="rail-sel cyan">${SUBS.map((s) => `<option ${s === railSub ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
    <select id="rail-loc" class="rail-sel">${LOCS.map((s) => `<option ${s === railLoc ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
    <select id="rail-agent" class="rail-sel yellow ${railSub === "BNPL (Hire Purchase)" && railLoc === "BNPL Market (Field)" ? "" : "hide"}">${agentOptions()}</select>
    <input class="rail-search" placeholder="Search the ERP..." />
    <nav class="core">
      ${CORE.map((c) => `
        <button type="button" class="core-i ${coreOpen === c.id ? "on" : ""}" data-core="${c.id}">
          <span class="core-lab"><span>${c.icon}</span><span>${c.name}</span></span>${c.id === "home" ? "" : chevronMark(coreOpen === c.id)}
        </button>
        ${c.id === "system" && coreOpen === "system" ? `<div class="rep-kids">
          <button type="button" class="acc-i ${active === "chevrons" ? "on" : ""}" data-setting="chevrons">Chevron styles</button>
        </div>` : ""}
        ${c.id === "reports" && reportOn ? `<div class="rep-kids">
          <button type="button" class="acc-all ${active === "all" ? "on" : ""}" data-code="all">All Reports</button>
          ${MENU.map((mod) => {
            const open = openGroup === mod.id || mod.items.some((i) => i.code === active || (i.children || []).some((x) => x.code === active));
            return `<div class="acc ${open ? "open" : ""}">
              <button type="button" class="acc-h" data-group="${mod.id}"><span class="core-lab">${esc(mod.module)}</span>${chevronMark(open)}</button>
              <div class="acc-b">${mod.items.map((i) => `
                <button type="button" class="acc-i ${i.code === active ? "on" : ""}" data-code="${i.code}">${esc(i.name)}</button>
                ${(i.children || []).map((x) => `<button type="button" class="acc-c ${x.code === active ? "on" : ""}" data-code="${x.code}">${esc(x.name)}</button>`).join("")}
              `).join("")}</div>
            </div>`;
          }).join("")}
        </div>` : ""}
      `).join("")}
    </nav>
    <div class="apps">${APPS.map((a) =>
      `<button type="button" class="app-pill ${appActive === a.name ? "on" : ""}" data-app="${esc(a.name)}" style="background:${a.color}">${esc(a.name)}</button>`
    ).join("")}</div>
  `;
  aside.querySelectorAll("[data-core]").forEach((b) => {
    b.onclick = () => {
      coreOpen = b.dataset.core;
      appActive = "";
      if (coreOpen === "reports") generateReport("all");
      else if (coreOpen === "system") { active = "chevrons"; appActive = ""; paintMenu(); renderChevronSettings(); }
      else { active = "module"; paintMenu(); renderModuleStub(CORE.find((c) => c.id === coreOpen).name); }
    };
  });
  aside.querySelectorAll("[data-group]").forEach((b) => {
    b.onclick = () => { openGroup = openGroup === b.dataset.group ? null : b.dataset.group; paintMenu(); };
  });
  aside.querySelectorAll("[data-code]").forEach((b) => {
    b.onclick = () => {
      active = b.dataset.code;
      appActive = "";
      coreOpen = "reports";
      if (active !== "all") openGroup = flattenMenu().find((x) => x.code === active)?.group || openGroup;
      generateReport(active);
    };
  });
  aside.querySelectorAll("[data-setting]").forEach((b) => {
    b.onclick = () => { active = b.dataset.setting; appActive = ""; coreOpen = "system"; paintMenu(); renderChevronSettings(); };
  });
  aside.querySelectorAll("[data-app]").forEach((b) => {
    b.onclick = () => {
      appActive = b.dataset.app;
      coreOpen = "";
      active = "app";
      moduleTab = "";
      paintMenu();
      renderModuleStub(appActive);
    };
  });
  const subEl = aside.querySelector("#rail-sub");
  const locEl = aside.querySelector("#rail-loc");
  const agentEl = aside.querySelector("#rail-agent");
  function syncAgentBox() {
    const show = railSub === "BNPL (Hire Purchase)" && railLoc === "BNPL Market (Field)";
    agentEl.classList.toggle("hide", !show);
  }
  subEl.onchange = () => { railSub = subEl.value; syncAgentBox(); };
  locEl.onchange = () => { railLoc = locEl.value; syncAgentBox(); };
  agentEl.onchange = () => { railAgent = agentEl.value; };
  syncAgentBox();
}

function renderModuleStub(name) {
  const tabs = moduleTabs(name);
  if (!moduleTab || !tabs.includes(moduleTab)) moduleTab = tabs[0];
  const app = APPS.find((a) => a.name === name);
  const color = app ? app.color : "#2563eb";
  const scope = `${railSub} · ${railLoc}${railSub === "BNPL (Hire Purchase)" && railLoc === "BNPL Market (Field)" ? " · " + railAgent : ""}`;
  document.getElementById("crumb").textContent = name + " · " + moduleTab;
  const box = document.getElementById("report");
  box.innerHTML = `
    <div class="items-page landing mod-floor">
      <nav class="mod-tabs">${tabs.map((t) =>
        `<button type="button" class="${t === moduleTab ? "on" : ""}" data-mtab="${esc(t)}">${esc(t)}</button>`
      ).join("")}</nav>
      <div class="mod-head">
        <div>
          <h2>${esc(moduleTab === "Summary" ? name : moduleTab)}</h2>
          <p class="subhead">${esc(moduleBlurb(name, moduleTab))}</p>
          <p class="scope-line">Activity · ${esc(scope)}</p>
        </div>
        <span class="mod-chip" style="background:${color}">${esc(name)}</span>
      </div>
      ${scopeToolsHTML()}
      ${moduleBody(name, moduleTab, tabs)}
    </div>`;
  bindScopeTools(box);
  box.querySelectorAll("[data-mtab]").forEach((b) => {
    b.onclick = () => { moduleTab = b.dataset.mtab; renderModuleStub(name); };
  });
  box.querySelectorAll("[data-mrep]").forEach((b) => {
    b.onclick = () => { moduleTab = "Reports"; renderModuleStub(name); };
  });
}

function moduleBlurb(name, tab) {
  if (tab === "Reports") return "Module reports only. These do not appear under ERP Reports.";
  if (tab === "Setup") return "Module setup only. This is not System settings.";
  if (tab === "Topics") return "Other headings, topics, and tasks for this module. Real child names go here when you send them.";
  if (name === "Accounting" && tab === "Summary") return "Stand-alone books. Chart of accounts, books, planning, then module reports and setup.";
  if (name === "Communications" && tab === "Summary") return "Talk, assign, and keep the desk in one place — messages, meetings, to-dos, files, and reminders.";
  if (tab === "Summary") return "Summary of what this module contains.";
  return name + " · " + tab;
}

function moduleBody(name, tab, tabs) {
  if (tab === "Reports") return moduleReports(name);
  if (tab === "Setup") return moduleSetup(name);
  if (name === "Accounting" && (tab === "Summary" || tab === "Chart of accounts")) return accountingFloor();
  if (name === "Communications" && tab === "Summary") return commsFloor();
  const others = tabs.filter((t) => t !== "Summary" && t !== "Reports" && t !== "Setup");
  return `
    <div class="landing-grid two">
      <section class="rep-block">
        <h3 class="rep-sec">On this floor</h3>
        <div class="kpi-grid">${others.concat(["Reports", "Setup"]).map((t) =>
          `<button type="button" class="kpi-card" data-mtab="${esc(t)}"><b>${esc(t)}</b><span>${t === "Setup" ? "Module setup" : t === "Reports" ? "Module reports" : "Child page"}</span><strong>Open</strong></button>`
        ).join("")}</div>
      </section>
      <section class="rep-block">
        <h3 class="rep-sec">Summary</h3>
        <div class="items-card">
          <p><b>Module:</b> ${esc(name)}</p>
          <p><b>Structure:</b> Floor → Topics → Reports → Setup</p>
          <p><b>Scope:</b> ${esc(railSub)} · ${esc(railLoc)}</p>
        </div>
      </section>
    </div>`;
}

function accountingFloor() {
  const rows = [
    ["Asset", "GH₵ 906,157.00"],
    ["Expenses", "GH₵ 0.00"],
    ["Income", "GH₵ 906,157.00"],
    ["Equity", "GH₵ 0.00"],
    ["Liability", "GH₵ 0.00"]
  ];
  return `
    <section class="items-card">
      <h3>Chart of accounts overview</h3>
      <div class="coa-grid">
        <table class="blue-tbl">
          <thead><tr><th>Account Type</th><th>Current Balance</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</tbody>
        </table>
        <div class="img-ph">Asset / Income split</div>
      </div>
    </section>
    <div class="landing-grid two">
      <section class="items-card"><h3>Asset</h3><p class="subhead">Cash and cash equivalents · GH₵ 906,157.00</p><div class="img-ph">Asset</div></section>
      <section class="items-card"><h3>Expenses</h3><p class="subhead">GH₵ 0.00</p><div class="img-ph">Expenses</div></section>
    </div>`;
}

function commsFloor() {
  const kpis = [
    ["Messages", "unread", "10"],
    ["To Do", "open", "0"],
    ["Reminders", "upcoming", "0"],
    ["Announcements", "posted", "0"],
    ["Meetings", "started", "0"],
    ["Documents", "on file", "0"],
    ["Memos", "filed", "0"],
    ["Knowledge Base", "articles", "8"],
    ["Groups", "rooms", "5"],
    ["Calls", "logged", "0"]
  ];
  return `
    <div class="kpi-grid">${kpis.map((k) =>
      `<div class="kpi-card"><b>${k[0]}</b><span>${k[1]}</span><strong>${k[2]}</strong></div>`
    ).join("")}</div>
    <div class="landing-grid two" style="grid-template-columns:1fr 1fr 1fr">
      <section class="items-card"><h3>Latest announcements</h3><p class="subhead">No announcements yet.</p></section>
      <section class="items-card"><h3>Today’s reminders</h3><p class="subhead">Nothing on the calendar today.</p></section>
      <section class="items-card"><h3>Open to-dos</h3><p class="subhead">No open tasks.</p></section>
    </div>`;
}

function moduleReports(name) {
  const list = [
    { name: name + " activity", blurb: "What moved in this module" },
    { name: name + " summary", blurb: "Totals for the selected scope" }
  ];
  return `
    <h3 class="rep-sec">${esc(name)} Reports</h3>
    <div class="rep-list">${list.map((i) => `
      <div class="rep-row">
        <b>${esc(i.name)}</b>
        <span>${esc(i.blurb)}</span>
      </div>`).join("")}</div>
    <section class="items-card" style="margin-top:16px">
      <h3>${esc(name)} summary</h3>
      <table class="blue-tbl">
        <thead><tr><th>Scope</th><th>Rows</th></tr></thead>
        <tbody><tr><td>${esc(railSub)} · ${esc(railLoc)}</td><td>0</td></tr></tbody>
      </table>
    </section>`;
}

function moduleSetup(name) {
  return `
    <section class="items-card">
      <h3>${esc(name)} setup</h3>
      <p class="subhead">Only this module. Company users, tax, and devices stay under System.</p>
      <div class="setup-grid">
        <label>Module name<input value="${esc(name)}" readonly /></label>
        <label>Default subsidiary
          <select>${SUBS.map((s) => `<option ${s === railSub ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
        </label>
        <label>Default location
          <select>${LOCS.map((s) => `<option ${s === railLoc ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
        </label>
        <label>Module code<input value="${esc(name.slice(0, 3).toUpperCase())}" /></label>
      </div>
    </section>`;
}
window.generateReport = generateReport;
function readyReports(code) {
  const run = document.getElementById("run-btn");
  if (run) run.onclick = () => generateReport(active);
  const pr = document.getElementById("print-btn");
  if (pr) pr.onclick = () => window.print();
  applyChrome();
  paintMenu();
  generateReport(code || window.__DF_REPORT_CODE || "all");
  document.getElementById("hdr-settings")?.addEventListener("click", () => {
    coreOpen = "system";
    active = "chevrons";
    appActive = "";
    paintMenu();
    renderChevronSettings();
  });
}
window.readyReports = readyReports;
if (!window.__DF_SANDBOX_DEFER && document.getElementById("report")) readyReports();
