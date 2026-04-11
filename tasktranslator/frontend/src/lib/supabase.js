import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Auth is disabled until env vars are set — app still works without it
const supabase = url && key
  ? createClient(url, key)
  : { auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), signInWithOAuth: async () => ({}), signInWithOtp: async () => ({}), signOut: async () => ({}) } };

export default supabase;
