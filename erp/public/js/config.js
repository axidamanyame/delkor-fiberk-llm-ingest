// js/config.js
//
// This file used to read:
//
//   const SUPABASE_URL = 'https://…supabase.co';
//   const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_…';
//   const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
//
// Two problems. The last line is self-referential, so the module threw the
// moment anything imported it — harmless only because nothing did. And it
// created a SECOND Supabase client alongside the one in supabaseClient.js,
// which means a second auth session and a second set of cached state: the
// same class of bug as the duplicated module graph on the dashboard.
//
// It now forwards to the single shared client, so importing it is safe and
// cannot fork state. Prefer importing from './supabaseClient.js' directly.
export { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseClient.js';
