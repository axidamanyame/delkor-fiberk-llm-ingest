/** Compatibility shim — public page loads receipt-public.js. */
export { loadReceipt, bindReceiptDock } from './receipt-public.js';
import { loadReceipt } from './receipt-public.js';
if (document.getElementById('box')) loadReceipt();
