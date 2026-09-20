/**
 * SUPERSEDED — duplicate formatters.
 *
 * Use fmt() from supabaseClient.js for currency; it is what every live page
 * uses. getStatusBadge() here returns class names (badge-gray, badge-yellow, …)
 * that no longer exist in the stylesheets — the live badges are
 * .ult-badge-paid / .ult-badge-due and the .pill classes.
 */
export function formatCurrency(amount, currency = "₵") { if (amount === null || amount === undefined) return `${currency}0.00`; return `${currency}${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
export function formatDate(date) { if (!date) return "—"; return new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }); }
export function getStatusBadge(status) { const map = { "draft": "badge-gray", "pending": "badge-yellow", "confirmed": "badge-blue", "completed": "badge-green", "received": "badge-green", "paid": "badge-green", "unpaid": "badge-red", "partial": "badge-yellow", "cancelled": "badge-red", "held": "badge-yellow", "active": "badge-green", "inactive": "badge-gray" }; return map[status?.toLowerCase()] || "badge-gray"; }
export function toNumber(val) { const num = parseFloat(val); return isNaN(num) ? 0 : num; }