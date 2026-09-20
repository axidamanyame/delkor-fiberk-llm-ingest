/** AI Assistance tools, local drafts, history. */
import { esc } from "./ls-rows.js";
export { esc };

export const AI_TOOLS = [
  {
    id: "product_description",
    ico: "tag",
    title: "Brand/Product Descriptions",
    blurb: "Generate detailed description",
    example: "Example: Fiberk Duvet 4.5 tog — breathable cotton cover, sold by the piece at Fiberk Shop Accra.",
    fields: [
      { key: "name", label: "Brand/Product Name", req: true },
      { key: "details", label: "Brand/Product Details", type: "textarea", req: true },
      { key: "category", label: "Category" },
    ],
  },
  {
    id: "product_review",
    ico: "star",
    title: "Product Review Generator",
    blurb: "Amazing review for products you like",
    example: "Example: I love the SuperWidget because it is easy to use and lasts a long time.",
    fields: [
      { key: "name", label: "Brand/Product Name", req: true },
      { key: "details", label: "Brand/Product Details", type: "textarea", req: true },
      { key: "like", label: "What do you like about the product?", req: true },
    ],
  },
  {
    id: "review_response",
    ico: "reply",
    title: "Review Response",
    blurb: "Response to review by customer",
    example: "Example: Thank you for the 5-star note about our Fiberk duvet — we are glad it sleeps cool in Accra heat.",
    fields: [
      { key: "customer", label: "Customer name", req: true },
      { key: "stars", label: "Rating (1-5)", req: true },
      { key: "review", label: "Customer review", type: "textarea", req: true },
    ],
  },
  {
    id: "social_post",
    ico: "share",
    title: "Social Media Post",
    blurb: "Engaging social media post",
    example: "Example: Weekend restock at Fiberk Shop — duvets and school uniforms on the floor now.",
    fields: [
      { key: "topic", label: "Product / offer", req: true },
      { key: "platform", label: "Platform" },
      { key: "tone", label: "Tone" },
    ],
  },
  {
    id: "google_ads",
    ico: "g",
    title: "Google Ads",
    blurb: "Ads that converts more customers",
    example: "Example: Headlines for Fiberk bedding sold across Accra, Kumasi and Tema.",
    fields: [
      { key: "name", label: "Product", req: true },
      { key: "audience", label: "Audience" },
      { key: "offer", label: "Offer / CTA" },
    ],
  },
  {
    id: "facebook_ads",
    ico: "f",
    title: "Facebook Ads",
    blurb: "Headline & text for facebook posts",
    example: "Example: Primary text + headline for a Fiberk duvet promo on Facebook.",
    fields: [
      { key: "name", label: "Product", req: true },
      { key: "offer", label: "Offer" },
      { key: "audience", label: "Audience" },
    ],
  },
  {
    id: "email",
    ico: "mail",
    title: "Email",
    blurb: "Write email that impresses & get replies",
    example: "Example: A polite VAT-return reminder to Melcom Ltd from HQ Finance.",
    fields: [
      { key: "purpose", label: "Purpose", req: true },
      { key: "audience", label: "Who it is for" },
      { key: "topic", label: "Product / topic" },
    ],
  },
  {
    id: "proposal",
    ico: "doc",
    title: "Proposal",
    blurb: "Used by a B2B company where a seller aims to persuade a prospective buyer into buying their goods or services",
    example: "Example: School-uniform pack proposal for Kumasi Schools, Q3 pricing in GHS.",
    fields: [
      { key: "buyer", label: "Prospective buyer", req: true },
      { key: "offer", label: "Goods or services", req: true, type: "textarea" },
      { key: "value", label: "Indicative value (GHS)" },
    ],
  },
  {
    id: "kb",
    ico: "book",
    title: "Knowledge base",
    blurb: "A step-by-step guide for doing anything",
    example: "Example: How a call-centre agent logs a customer callback.",
    fields: [
      { key: "topic", label: "Topic", req: true },
      { key: "audience", label: "Who is this for" },
      { key: "notes", label: "Key steps / notes", type: "textarea" },
    ],
  },
  {
    id: "support",
    ico: "chat",
    title: "Customer Support Reply",
    blurb: "Generate a professional and empathetic reply to customer queries/complaints",
    example: "Example: A calm reply when a HiAce delivery to Palace Hypermarket ran late.",
    fields: [
      { key: "customer", label: "Customer", req: true },
      { key: "query", label: "Query / complaint", type: "textarea", req: true },
      { key: "tone", label: "Tone" },
    ],
  },
];

export const LANGS = ["English", "Twi", "Ga", "Ewe", "Hausa", "French"];

const HIST_KEY = "df_ai_history";
const TOK_KEY = "df_ai_tokens";
const FLAG = "df_ai_hub_seed_v2";
const TOK_CAP = 100;

export function tokenState() {
  try {
    const t = JSON.parse(localStorage.getItem(TOK_KEY) || "null");
    if (t && Number.isFinite(t.used)) return { used: t.used, cap: t.cap || TOK_CAP };
  } catch { /* ignore */ }
  return { used: 0, cap: TOK_CAP };
}
export function remainingTokens() {
  const t = tokenState();
  return Math.max(0, t.cap - t.used);
}
export function spendToken() {
  const t = tokenState();
  if (t.used >= t.cap) return false;
  t.used += 1;
  try { localStorage.setItem(TOK_KEY, JSON.stringify(t)); } catch { /* quota — still allow the generate */ }
  return true;
}

export function loadHistory() {
  try { seedHistory(); } catch { /* quota must not blank the desk */ }
  try {
    const rows = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    if (!Array.isArray(rows)) return [];
    const slim = rows.slice(0, 30).map((r) => ({
      input: String(r.input || "").slice(0, 280),
      output: String(r.output || "").slice(0, 800),
      tool: r.tool || "",
      added_by: r.added_by || "",
      created_at: r.created_at || "",
    }));
    if (slim.length < rows.length || JSON.stringify(rows).length > 60000) {
      try { localStorage.setItem(HIST_KEY, JSON.stringify(slim)); } catch {
        try { localStorage.removeItem(HIST_KEY); } catch { /* ignore */ }
      }
    }
    return slim;
  } catch { return []; }
}
export function pushHistory(row) {
  let all = [];
  try { all = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch { all = []; }
  if (!Array.isArray(all)) all = [];
  all.unshift({
    input: String(row.input || "").slice(0, 280),
    output: String(row.output || "").slice(0, 800),
    tool: row.tool || "",
    added_by: row.added_by || "",
    created_at: row.created_at || "",
  });
  const slim = all.slice(0, 30);
  const save = (rows) => {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(rows));
      return true;
    } catch { return false; }
  };
  if (save(slim)) return;
  if (save(slim.slice(0, 8))) return;
  try { localStorage.removeItem(HIST_KEY); } catch { /* ignore */ }
  save([{ ...slim[0] }]);
}

function seedHistory() {
  try { if (localStorage.getItem(FLAG) === "1") return; } catch { /* ignore */ }
  const rows = [
    {
      input: "Fiberk Duvet 4.5 tog · cotton cover · Accra heat",
      output: "We bought the Fiberk 4.5 tog duvet for the guest room in East Legon and it sleeps cool. The cotton cover washes well and the shop explained the warranty without rushing us.",
      tool: "Product Review Generator",
      added_by: "Akosua Darko",
      created_at: "2026-09-02 11:18",
    },
    {
      input: "VAT pack reminder · Melcom Ltd",
      output: "Subject: September VAT pack — Melcom Ltd\n\nDear Accounts,\nPlease send the September VAT return pack to HQ Finance by 30 September. Quote invoice MEL-8821 if you need a reprint.\n\nRegards,\nAma Serwaa\nDelkor-Fiberk Finance",
      tool: "Email",
      added_by: "Ama Serwaa",
      created_at: "2026-09-01 09:42",
    },
    {
      input: "School uniform pack · Kumasi Schools · GHS 42,000",
      output: "Proposal: Q3 school-uniform pack for Kumasi Schools. 420 sets (shirt, shorts/skirt, socks) delivered to the campus store. Indicative value GH₵ 42,000 including delivery. Lead time 12 working days from deposit.",
      tool: "Proposal",
      added_by: "Yaw Owusu",
      created_at: "2026-08-28 16:05",
    },
  ];
  try { localStorage.setItem(HIST_KEY, JSON.stringify(rows)); } catch {
    try { localStorage.removeItem(HIST_KEY); } catch { /* ignore */ }
  }
  try { localStorage.setItem(TOK_KEY, JSON.stringify({ used: 3, cap: TOK_CAP })); } catch { /* quota */ }
  try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ }
}

export function draftProductDescription(d) {
  const n = (d.name || "This product").trim();
  return `${n} is stocked by Delkor-Fiberk${d.category ? ` in ${d.category}` : ""}. ${d.details || "Prepared for the Ghana catalogue with location stock, warranty and returns at the selling shop."} Ask the till for the current GH₵ price and whether BNPL applies.`;
}
function draftReview(d) {
  return `I bought ${d.name || "this product"} from Fiberk Shop. ${d.like || "It is easy to use and lasts a long time."} ${d.details || ""} Staff explained the warranty in plain language. Would buy again.`.replace(/\s+/g, " ").trim();
}
function draftReviewReply(d) {
  const low = Number(d.stars || 5) <= 2;
  const who = d.customer || "there";
  if (low) {
    return `Dear ${who},\nThank you for telling us. We are sorry this fell short. Please bring the item and invoice to the selling location so we can log a repair or replacement.\n— Delkor-Fiberk`;
  }
  return `Dear ${who},\nThank you for the ${d.stars || 5}-star review. We are glad the product worked well. Visit us again — ask for your loyalty card at the till.\n— Delkor-Fiberk`;
}
function draftSocial(d) {
  const p = (d.platform || "Facebook").toLowerCase();
  const hash = p.includes("tiktok") ? "#DelkorFiberk #Ghana" : "#DelkorFiberk #ShopLocal";
  return `${d.topic || "This week’s offer"} is in stock now at Fiberk Shop and selected agents.\n${d.tone ? d.tone + " tone. " : ""}Ask in-store for GH₵ pricing.\n${hash}`;
}
function draftGoogle(d) {
  return `Headline 1: ${d.name || "Shop Delkor-Fiberk"}\nHeadline 2: ${d.offer || "In stock today"}\nHeadline 3: Accra · Kumasi · Tema\nDescription 1: ${d.audience || "Retail and field customers"} can buy, return or repair at the selling shop.\nDescription 2: Ask about BNPL in the field and loyalty at the till.`;
}
function draftFacebook(d) {
  return `Primary text: ${d.name || "New stock"} — ${d.offer || "available this week"} for ${d.audience || "our customers"} in Ghana.\nHeadline: Get it at Delkor-Fiberk\nDescription: Multi-subsidiary stock. Bring your invoice for returns.`;
}
function draftEmail(d) {
  return `Subject: ${d.purpose || "A note"} from Delkor-Fiberk\n\nHello,\n\nWe are writing about ${d.topic || "your recent purchase"} for ${d.audience || "our customers"}. If you need a replacement, repair or a field-agent visit, reply with your invoice number and the shop you bought from.\n\nRegards,\nDelkor-Fiberk Group`;
}
function draftProposal(d) {
  return `Proposal for ${d.buyer || "the buyer"}\n\n${d.offer || "Goods and services as discussed."}\n\nIndicative value: GH₵ ${d.value || "0"} (VAT extra where applicable). Delivery from Accra warehouse. Validity 14 days.\n\nPrepared by Delkor-Fiberk sales.`;
}
function draftKb(d) {
  return `${d.topic || "Guide"}\nFor: ${d.audience || "staff"}\n\n1. Open the relevant Delkor-Fiberk screen.\n2. ${d.notes || "Follow the on-screen fields. Save before leaving the page."}\n3. Confirm the location and subsidiary at the top of the sidebar.\n4. File a copy in Communications → Documents if HQ needs it.`;
}
function draftSupport(d) {
  return `Dear ${d.customer || "Customer"},\n\nThank you for writing. We have logged your note: ${d.query || "your query"}.\n\nA coordinator will call from the selling location. Please keep your invoice number nearby. ${d.tone ? "Tone: " + d.tone + "." : ""}\n\nKind regards,\nDelkor-Fiberk Support`;
}

export function runTool(id, data) {
  if (id === "product_description") return draftProductDescription(data);
  if (id === "product_review") return draftReview(data);
  if (id === "review_response") return draftReviewReply(data);
  if (id === "social_post") return draftSocial(data);
  if (id === "google_ads") return draftGoogle(data);
  if (id === "facebook_ads") return draftFacebook(data);
  if (id === "email") return draftEmail(data);
  if (id === "proposal") return draftProposal(data);
  if (id === "kb") return draftKb(data);
  if (id === "support") return draftSupport(data);
  return "";
}

export async function createCopy(tool, data) {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: tool.title, fields: data }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j?.ok && j.text) return { text: j.text, source: "grok" };
    }
  } catch { /* preview without API */ }
  return { text: runTool(tool.id, data), source: "draft" };
}

export function aiButtonHtml(id, label = "Use AI") {
  return `<button type="button" class="ai-btn" id="${id}">✦ ${label}</button>`;
}

/** Parse pasted supplier invoice lines (CSV or SKU-per-line) against catalogue rows. */
export function parsePurchaseInvoice(blob, products = []) {
  const lines = [];
  const missing = [];
  String(blob || "").split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (!t || t.startsWith("#")) return;
    if (/^sku\b/i.test(t) && /qty|quantity|cost/i.test(t)) return;
    const parts = t.split(/[,\t;]/).map((x) => x.trim());
    const sku = parts[0];
    if (!sku) return;
    const qty = Number(parts[1] || 1);
    const cost = Number(parts[2] || 0);
    const hit = (products || []).find((p) =>
      String(p.sku || "").toLowerCase() === sku.toLowerCase()
      || String(p.name || "").toLowerCase() === sku.toLowerCase()
    );
    if (!hit) {
      missing.push({ row: i + 1, sku });
      return;
    }
    lines.push({
      product_id: hit.id,
      sku: hit.sku,
      name: hit.name,
      qty: qty || 1,
      quantity: qty || 1,
      unit_cost: cost || Number(hit.cost_price || hit.purchase_price || 0),
      tax_rate: 0,
      selling_price: Number(hit.selling_price || 0),
      lot: "",
      mfg: "",
      exp: "",
    });
  });
  return { lines, missing };
}
