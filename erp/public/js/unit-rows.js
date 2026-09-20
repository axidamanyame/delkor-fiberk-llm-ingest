/** Operational stock is one row per unit. Reports may still group by SKU. */
export function unitSku(row, i) {
  const base = String(row.sku || row.catalog_sku || '').trim();
  if (base) return `${base}-${String(i).padStart(3, '0')}`;
  return `UNK-${String(row.id || row.product_id || 'x').slice(-8)}-${String(i).padStart(3, '0')}`;
}

export function expandUnits(rows, { qtyKey } = {}) {
  const out = [];
  for (const r of rows || []) {
    const raw = r[qtyKey] ?? r.qty ?? r.current_stock ?? r.stock ?? r.sold ?? 1;
    const n = Math.max(1, Math.floor(Number(raw) || 1));
    if (n === 1 && r.unit_no) {
      out.push(r);
      continue;
    }
    for (let i = 1; i <= n; i++) {
      out.push({
        ...r,
        id: `${r.id || r.sku || 'u'}-u${i}`,
        parent_id: r.id,
        unit_no: i,
        unit_of: n,
        qty: 1,
        current_stock: 1,
        stock: 1,
        sku_unit: unitSku(r, i),
        unknown_sku: !String(r.sku || '').trim(),
      });
    }
  }
  return out;
}
