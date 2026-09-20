/**
 * Convenience wrapper — nothing needs it today.
 *
 * fiberkCategories() is onlyMigrated(readLs('df_categories', [])), a one-liner
 * at any call site. The live categories page already filters with
 * excludeMigrated() from fiberk-silo.js, and the migrated side is owned by
 * migrated-data.js (previewCategoryRows, looksLikeCategories, the batch
 * pipeline). Wiring this in would duplicate that. Kept for reference; its
 * siblings fiberk-hrm / fiberk-products / fiberk-sales are all in use.
 */
import { readLs } from './ls-rows.js';
import { onlyMigrated } from './fiberk-silo.js';

export function fiberkCategories() {
  return onlyMigrated(readLs('df_categories', []) || []);
}
export function fiberkCategoryMetrics() {
  const rows = fiberkCategories();
  return { n: rows.length };
}
export async function ensureFiberkCategories() {
  return { ok: true, n: fiberkCategories().length };
}
