/* createClient comes from supabaseClient.js so the library is fetched once.
   The ephemeral client below is deliberate — see its comment. */
import { createClient, supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseClient.js';
import { loadAccess, can, getAccess } from './rbac.js';
import { isHqRole } from './access-rules.js';
import { canMutateUser, assignableRoles, deny } from './role-guard.js';

export async function assertCanManageUsers(need = 'user.edit') {
  let ctx = null;
  try {
    ctx = await Promise.race([
      loadAccess(),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
  } catch {
    ctx = null;
  }
  if (ctx && (can('user.add') || can('user.edit') || can(need))) return ctx;
  deny('You do not have permission to manage users.');
  location.href = '/users.html';
  return null;
}

/** Isolated client so signUp does not replace the admin session. */
function ephemeral() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Create Auth user + profile. Email confirmation is not required
 * if Auth → Providers → Email has "Confirm email" turned OFF.
 */
export async function adminCreateUser({ email, password, profile }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !password) return { error: { message: 'Email and password are required' } };
  if (password.length < 6) return { error: { message: 'Password must be at least 6 characters' } };
  const actor = getAccess() || await loadAccess();
  if (!can('user.add')) return { error: { message: 'No permission to add users' } };
  const wantRole = profile.role_name || profile.role || 'Cashier';
  if (actor && !canMutateUser(actor.roleName, wantRole)) {
    return { error: { message: 'You cannot assign the ' + wantRole + ' role' } };
  }

  const isolated = ephemeral();
  const { data, error } = await isolated.auth.signUp({
    email: mail,
    password,
    options: {
      data: {
        full_name: profile.full_name || mail,
        role: profile.role || 'Cashier',
      },
    },
  });
  if (error) return { error };
  const user = data.user;
  if (!user?.id) return { error: { message: 'Auth did not return a user id' } };
  if (data.session === null) {
    // Confirm-email is still ON in the project. User exists but cannot log in until confirmed.
    console.warn('New user created without a session — disable Confirm email in Supabase Auth settings.');
  }

  const row = {
    id: user.id,
    email: mail,
    full_name: profile.full_name || mail,
    first_name: profile.first_name || null,
    last_name: profile.last_name || null,
    prefix: profile.prefix || null,
    username: profile.username || mail.split('@')[0],
    role: profile.role || null,
    role_name: profile.role_name || profile.role || null,
    role_id: profile.role_id || null,
    is_active: profile.is_active !== false,
    allow_login: profile.allow_login !== false,
    subsidiary_code: isHqRole(profile.role) ? 'group' : (profile.subsidiary_code || null),
    home_subsidiary: isHqRole(profile.role) ? 'group' : (profile.home_subsidiary || profile.subsidiary_code || null),
    preferred_subsidiary: profile.preferred_subsidiary || (isHqRole(profile.role) ? 'group' : profile.subsidiary_code) || null,
    location_code: profile.location_code || null,
    all_locations: profile.all_locations !== false,
    pos_pin: '1234',
    till_pin: '1234',
    phone: profile.mobile || profile.phone || null,
  };

  let up = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (up.error) up = await supabase.from('profiles').update(row).eq('id', user.id);
  if (up.error) {
    const slim = { id: user.id, email: mail, full_name: row.full_name, role: row.role, subsidiary_code: row.subsidiary_code };
    up = await supabase.from('profiles').upsert(slim, { onConflict: 'id' });
  }
  if (up.error) return { error: { message: 'Login created, profile failed: ' + up.error.message } };
  return { data: { id: user.id, email: mail, unconfirmed: !data.session } };
}

export async function adminUpdatePassword() {
  return { error: { message: 'Password changes for existing users will use the Admin API in a later pass.' } };
}
