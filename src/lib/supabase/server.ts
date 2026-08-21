import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '../env';

/**
 * Request-scoped client carrying the logged-in user's JWT.
 * Every query through this client is filtered by RLS. Use this everywhere
 * except the cron job.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead. Safe to swallow.
        }
      },
    },
  });
}

export async function requireUser() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
