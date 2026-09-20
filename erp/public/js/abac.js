/**
 * Axidigetek ERP — Attribute-Based Access Control (ABAC)
 * Composes with RBAC: role permissions are required first, then attribute policies.
 *
 * Subject attributes  → who is acting (role, subsidiary, warehouse, region)
 * Resource attributes → what is accessed (order.subsidiary_id, product.brand, amount)
 * Environment         → when/where (hour, channel: pos|web)
 * Action              → view | create | edit | delete | approve
 */
import { getAuthSession, supabase } from './supabaseClient.js';

/* Was a second library copy from jsdelivr plus its own client on the same URL
   and key. Re-exported so existing importers of abac.js keep working. */
export { supabase };

/** @type {object|null} */
let _subject = null;

/**
 * Build subject attributes from auth + profiles (+ optional staff row).
 */
export async function loadSubject() {
  if (_subject) return _subject;

  const session = await getAuthSession();
  if (!session) {
    if (!/\/login\.html/i.test(location.pathname || '')) location.href = '/login.html';
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  // Optional: app_roles permissions
  let roleName = profile?.role || profile?.role_name || 'Cashier';
  let permissions = {};
  if (profile?.role_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(profile.role_id))) {
    const { data: r } = await supabase.from('app_roles').select('name, permissions').eq('id', profile.role_id).maybeSingle();
    if (r) {
      roleName = r.name || roleName;
      permissions = r.permissions || {};
    }
  } else if (roleName) {
    const { data: r } = await supabase.from('app_roles').select('name, permissions').ilike('name', roleName).maybeSingle();
    if (r) {
      roleName = r.name;
      permissions = r.permissions || {};
    }
  }

  const isAdmin = ['admin', 'super admin', 'owner'].includes(String(roleName).toLowerCase());

  _subject = {
    userId: session.user.id,
    email: session.user.email,
    fullName: profile?.full_name || session.user.email?.split('@')[0],
    role: roleName,
    permissions: normalizePerms(permissions),
    isAdmin,
    // Attributes used by ABAC policies
    attrs: {
      subsidiary_id: profile?.subsidiary_id || profile?.subsidiary || null,
      subsidiary_code: profile?.subsidiary_code || null, // bnpl | fiberk | delkor | hq
      warehouse_id: profile?.warehouse_id || null,
      region: profile?.region || profile?.territory || null,
      max_discount_pct: Number(profile?.max_discount_pct ?? 5),
      max_sale_amount: Number(profile?.max_sale_amount ?? 50000),
      can_see_all_subsidiaries: isAdmin || profile?.can_see_all_subsidiaries === true,
    },
  };
  return _subject;
}

export function getSubject() {
  return _subject;
}

function normalizePerms(p) {
  if (!p) return {};
  if (Array.isArray(p)) return Object.fromEntries(p.map(k => [k, true]));
  if (typeof p === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(p)) o[k] = !!v;
    return o;
  }
  return {};
}

/** RBAC gate (permission id from roles matrix). Admin always true. */
export function hasPermission(permId) {
  if (!_subject) return false;
  if (_subject.isAdmin) return true;
  if (_subject.permissions['*']) return true;
  if (!permId) return true;
  if (permId.includes('|')) return permId.split('|').some(p => hasPermission(p.trim()));
  return _subject.permissions[permId] === true;
}

/**
 * Environment attributes (request context).
 */
export function envAttrs(extra = {}) {
  const h = new Date().getHours();
  return {
    hour: h,
    is_business_hours: h >= 7 && h < 21,
    channel: extra.channel || 'web',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Policy engine — ordered rules; first decisive deny/allow wins if mode='first'
// Default: all matching must allow (deny overrides).
// ---------------------------------------------------------------------------

/**
 * @typedef {object} PolicyContext
 * @property {object} subject
 * @property {string} action   view|create|update|delete|approve|receive
 * @property {object} resource attributes of the row / entity
 * @property {object} env
 */

/**
 * Built-in policies for Axidigetek (Ghana multi-brand).
 * Each returns { allow: boolean, reason: string } | null (not applicable).
 */
export const POLICIES = [
  // 1) Admin bypass
  {
    id: 'admin-bypass',
    evaluate({ subject }) {
      if (subject.isAdmin) return { allow: true, reason: 'Admin role' };
      return null;
    },
  },

  // 2) Subsidiary isolation — sales/purchases/stock belong to a subsidiary
  {
    id: 'subsidiary-scope',
    evaluate({ subject, resource, action }) {
      if (!resource || resource.subsidiary_id == null && resource.subsidiary_code == null) return null;
      if (subject.attrs.can_see_all_subsidiaries) return { allow: true, reason: 'Cross-subsidiary flag' };
      const sub = subject.attrs.subsidiary_id || subject.attrs.subsidiary_code;
      if (!sub) return { allow: false, reason: 'User has no subsidiary attribute' };
      const resSub = resource.subsidiary_id || resource.subsidiary_code;
      if (String(sub) !== String(resSub)) {
        return { allow: false, reason: `Subsidiary mismatch (user=${sub}, resource=${resSub})` };
      }
      return { allow: true, reason: 'Same subsidiary' };
    },
  },

  // 3) Warehouse scope for stock moves
  {
    id: 'warehouse-scope',
    evaluate({ subject, resource, action }) {
      if (!resource?.warehouse_id) return null;
      if (subject.isAdmin || subject.attrs.can_see_all_subsidiaries) return null;
      if (!subject.attrs.warehouse_id) return null; // no restriction configured
      if (String(subject.attrs.warehouse_id) !== String(resource.warehouse_id)
        && String(subject.attrs.warehouse_id) !== String(resource.to_warehouse_id)
        && String(subject.attrs.warehouse_id) !== String(resource.from_warehouse_id)) {
        return { allow: false, reason: 'Warehouse not assigned to user' };
      }
      return { allow: true, reason: 'Warehouse allowed' };
    },
  },

  // 4) Sale amount ceiling (Cashier cannot finalize huge tickets alone)
  {
    id: 'sale-amount-limit',
    evaluate({ subject, resource, action }) {
      if (action !== 'create' && action !== 'approve') return null;
      if (!resource || resource.total_amount == null) return null;
      const max = subject.attrs.max_sale_amount;
      if (Number(resource.total_amount) > max) {
        return {
          allow: false,
          reason: `Amount GH₵ ${resource.total_amount} exceeds your limit GH₵ ${max}`,
        };
      }
      return { allow: true, reason: 'Within amount limit' };
    },
  },

  // 5) Discount ceiling
  {
    id: 'discount-limit',
    evaluate({ subject, resource, action }) {
      if (resource?.discount_percent == null) return null;
      const max = subject.attrs.max_discount_pct;
      if (Number(resource.discount_percent) > max) {
        return {
          allow: false,
          reason: `Discount ${resource.discount_percent}% > allowed ${max}%`,
        };
      }
      return { allow: true, reason: 'Discount OK' };
    },
  },

  // 6) Purchase price visibility (attribute: action view_cost on product)
  {
    id: 'view-purchase-price',
    evaluate({ subject, action }) {
      if (action !== 'view_cost' && action !== 'view_purchase_price') return null;
      if (hasPermission('product.view_purchase_price')) {
        return { allow: true, reason: 'RBAC product.view_purchase_price' };
      }
      return { allow: false, reason: 'No permission to view purchase price' };
    },
  },

  // 7) Business hours for POS finalize (optional soft policy)
  {
    id: 'pos-business-hours',
    evaluate({ action, env }) {
      if (action !== 'pos_finalize') return null;
      if (env?.enforce_business_hours && !env.is_business_hours) {
        return { allow: false, reason: 'POS finalize only during business hours (07:00–21:00)' };
      }
      return null;
    },
  },

  // 8) BNPL vs cash brand — only BNPL staff create hire-purchase sales
  {
    id: 'bnpl-sale-type',
    evaluate({ subject, resource, action }) {
      if (!resource?.sale_type && !resource?.payment_terms) return null;
      const isBnpl = ['bnpl', 'hire_purchase', 'hire-purchase'].includes(
        String(resource.sale_type || resource.payment_terms || '').toLowerCase()
      );
      if (!isBnpl) return null;
      const code = String(subject.attrs.subsidiary_code || '').toLowerCase();
      if (subject.isAdmin || code === 'bnpl' || code === 'hq') {
        return { allow: true, reason: 'BNPL subsidiary or HQ' };
      }
      return { allow: false, reason: 'Only BNPL / HQ staff may book hire-purchase sales' };
    },
  },
];

/**
 * Decide access.
 * @param {object} opts
 * @param {string} opts.action
 * @param {object} [opts.resource]
 * @param {object} [opts.env]
 * @param {string} [opts.permission] optional RBAC permission required first
 * @returns {{ allow: boolean, reason: string, decisions: array }}
 */
export function decide(opts = {}) {
  const subject = _subject;
  if (!subject) {
    return { allow: false, reason: 'No subject loaded', decisions: [] };
  }

  // Optional RBAC pre-check
  if (opts.permission && !hasPermission(opts.permission)) {
    return {
      allow: false,
      reason: `Missing RBAC permission: ${opts.permission}`,
      decisions: [{ id: 'rbac', allow: false, reason: opts.permission }],
    };
  }

  const ctx = {
    subject,
    action: opts.action || 'view',
    resource: opts.resource || {},
    env: envAttrs(opts.env || {}),
  };

  const decisions = [];
  for (const policy of POLICIES) {
    try {
      const result = policy.evaluate(ctx);
      if (result) decisions.push({ id: policy.id, ...result });
    } catch (e) {
      decisions.push({ id: policy.id, allow: false, reason: 'Policy error: ' + e.message });
    }
  }

  // Deny overrides: any explicit allow:false → deny
  const denied = decisions.find(d => d.allow === false);
  if (denied) {
    return { allow: false, reason: denied.reason, decisions };
  }

  // If we only had allows / no opinions, allow
  return {
    allow: true,
    reason: decisions.length ? decisions.map(d => d.reason).join('; ') : 'No restricting policy matched',
    decisions,
  };
}

/** Convenience helpers for pages */
export function canViewCost() {
  return decide({ action: 'view_purchase_price' }).allow;
}

export function canFinalizeSale(resource) {
  return decide({
    action: 'create',
    permission: 'sell.add',
    resource,
    env: { channel: 'pos' },
  });
}

export function canAccessSubsidiaryRecord(resource) {
  return decide({ action: 'view', resource });
}

export function explain(opts) {
  const d = decide(opts);
  console.table(d.decisions);
  return d;
}
