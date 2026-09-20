/**
 * Point Franko (and other CDN) photos at the files already in
 * Supabase Storage bucket `product-images`.
 *
 * Same rule as artifacts/repoint-franko-storage.sql +
 * artifacts/franko-image-import/import-franko-images.js:
 *   public URL = {SUPABASE}/storage/v1/object/public/product-images/franko/{safeName}
 * Spaces in the Franko filename become underscores.
 */
import { SUPABASE_URL } from './supabaseClient.js';

export const IMAGE_BUCKET = 'product-images';
export const FRANKO_FOLDER = 'franko';

export function isFrankoUrl(url) {
  return /frankotrading\.com/i.test(String(url || ''));
}

export function frankoFilename(url) {
  try {
    const u = decodeURIComponent(String(url || '').split('?')[0]);
    return (u.split('/').pop() || '').trim();
  } catch {
    return String(url || '').split('/').pop() || '';
  }
}

/** Same sanitiser the importer used when it uploaded into the bucket. */
export function safeFrankoName(name) {
  return String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/%20/g, ' ')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || '';
}

export function hostedFrankoUrl(filename) {
  const name = safeFrankoName(filename);
  if (!name) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${FRANKO_FOLDER}/${name}`;
}

/** Never return a testing.frankotrading.com URL. */
let PHOTO_MAP = null;
export async function loadCatalogPhotos() {
  if (PHOTO_MAP) return PHOTO_MAP;
  try {
    const res = await fetch('/js/catalog-photo-map.json', { cache: 'force-cache' });
    PHOTO_MAP = res.ok ? await res.json() : {};
  } catch {
    PHOTO_MAP = {};
  }
  return PHOTO_MAP;
}

export function hostedProductImage(url, extra = {}) {
  if (extra.hosted_url && /supabase\.co\/storage/i.test(extra.hosted_url)) return extra.hosted_url;
  const id = extra && extra.id != null ? String(extra.id) : '';
  if (id && PHOTO_MAP && PHOTO_MAP[id]) return PHOTO_MAP[id];
  const sku = String(extra.sku || extra.view_sku || '').toUpperCase();
  if (sku && PHOTO_MAP && PHOTO_MAP[sku]) return PHOTO_MAP[sku];
  const u = String(url || extra.image_url || extra.catalog_image_url || extra.image || '');
  if (!u) return id && PHOTO_MAP ? (PHOTO_MAP[id] || '') : '';
  if (/supabase\.co\/storage/i.test(u)) return u;
  if (u.startsWith('/uploads/')) return u;
  if (isFrankoUrl(u)) return hostedFrankoUrl(frankoFilename(u));
  if (/fiberkapp\.com\/uploads/i.test(u) && id && PHOTO_MAP && PHOTO_MAP[id]) return PHOTO_MAP[id];
  if (/fiberkapp\.com\/uploads/i.test(u)) return '';
  return u;
}

export function productPhoto(p) {
  if (!p) return '';
  return hostedProductImage(p.image_url || p.catalog_image_url || p.image, p);
}

/** HQ uploads a photo from the desk into bucket product-images. */
export async function uploadProductPhoto(file, product = {}) {
  if (!file) throw new Error('Choose a photo first');
  const { supabase } = await import('./supabaseClient.js');
  const raw = String(product.sku || product.id || 'item').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `catalog/${raw}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
  });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl || '';
  if (!url) throw new Error('Upload finished but no public URL');
  return url;
}
