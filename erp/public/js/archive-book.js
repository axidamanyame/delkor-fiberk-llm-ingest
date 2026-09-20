/** Fiberkapp clone books. Used only when workspace is archive. */
import { isArchive } from './workspace.js';
import { loadSilo, onlyMigrated } from './fiberk-silo.js';

const KIND = {
  products: 'products',
  sales: 'sales',
  sales_orders: 'sales',
  pos_sales: 'sales',
  purchases: 'purchases',
  purchase_orders: 'purchases',
  transfers: 'transfers',
  stock_transfers: 'transfers',
  customers: 'customers',
  suppliers: 'suppliers',
  people: 'people',
  users: 'people',
  profiles: 'people',
  stock_transfers: 'transfers',
  df_stock_transfers: 'transfers',
  df_sales_orders: 'sales',
  df_purchases: 'purchases',
  df_products: 'products',
  df_customers: 'customers',
  df_suppliers: 'suppliers',
  journals: 'journals',
  categories: 'categories',
};

export async function archiveRows(kind, fallback = []) {
  if (!isArchive()) return fallback;
  const id = KIND[kind] || kind;
  try {
    const pack = await loadSilo(id);
    if (pack?.rows?.length) return pack.rows.slice();
  } catch { /* pack missing */ }
  return onlyMigrated(fallback);
}
