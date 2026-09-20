/** Compatibility layer — all checks go through rbac.js / app_roles. */
export { loadAccess as loadMyPerms, can, getAccess, resetAccess, requirePerm, applyDomPermissions } from './rbac.js';

import { can as canOne } from './rbac.js';
export function canAny(keys) {
  return (keys || []).some((k) => canOne(k));
}
