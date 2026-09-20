import { supabase, getAuthSession } from './supabaseClient.js';

/**
 * Returns { user, fullName, role, session } or null (redirects to login).
 */
export async function getCurrentUserWithRole() {
  try {
    const session = await getAuthSession();
    if (!session) {
      if (!/\/login\.html/i.test(location.pathname || '')) window.location.href = '/login.html';
      return null;
    }

    const user = session.user;
    let fullName = user.email?.split('@')[0] || 'User';
    let role = 'Agent';

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, role_name, role_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      fullName = profile.full_name || fullName;
      role = profile.role_name || profile.role || role;
    }

    return { user, fullName, role, session };
  } catch (e) {
    console.error('getCurrentUserWithRole', e);
    return null;
  }
}
