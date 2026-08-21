import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY COMPLETELY.
 *
 * Only the sync job should use this, because it legitimately writes rows on
 * behalf of users who are not making the request. Every query written against
 * this client must scope user_id by hand — RLS will not save you here.
 *
 * Never import this from a client component or anything under app/ that
 * renders in the browser.
 */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
