import { supabase } from './supabaseClient.js';

const FN = '/functions/v1/sync-supplier-media';

export async function callSync(payload) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  const res = await fetch(FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabase.supabaseKey || '',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false, error: res.statusText }));
}

export async function listMissing() {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, image_url')
    .or('image_url.is.null,image_url.eq.')
    .order('sku')
    .limit(400);
  if (error) throw error;
  return data || [];
}

export async function listBrokenFranko() {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, image_url')
    .ilike('image_url', '%frankotrading%')
    .limit(400);
  if (error) throw error;
  return data || [];
}

export async function listLogs() {
  const { data, error } = await supabase
    .from('supplier_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function counts() {
  const [all, missing, franko, logs] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).or('image_url.is.null,image_url.eq.'),
    supabase.from('products').select('id', { count: 'exact', head: true }).ilike('image_url', '%frankotrading%'),
    supabase.from('supplier_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);
  return {
    products: all.count || 0,
    missing: missing.count || 0,
    frankoLocked: franko.count || 0,
    failed: logs.count || 0,
  };
}

export { frankoFilename, productPhoto } from './product-images.js';

export async function linkIfHosted(row) {
  return { ok: true, row };
}
export async function importFiles() {
  return { ok: true, n: 0 };
}
