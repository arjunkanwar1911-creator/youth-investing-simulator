// One Supabase connection for the whole page, made the first time it is asked for.
// Only the PUBLISHABLE key is used here. It is meant to be seen by the browser:
// the database lock (row level security) is what keeps rows private. A secret key
// would never go in this file.
import { createClient } from '@supabase/supabase-js';

let client = null;

/** The connection, or null if the two values are missing from .env.local. */
export function getSupabase() {
  // These two names must be written out in full: Next.js swaps them for the real values when it builds.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { flowType: 'pkce' } });
  return client;
}
