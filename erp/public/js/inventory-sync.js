/** Live stock_levels → stockById map + optional tile painter */
export function subscribeStock(supabase, { onChange, channelName = 'stock-live' } = {}) {
  const ch = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels' }, (payload) => {
      onChange?.(payload);
    })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (_) {} };
}

export function sumStock(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    map[r.product_id] = (map[r.product_id] || 0) + Number(r.quantity || 0);
  });
  return map;
}
