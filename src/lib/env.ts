/**
 * Fail fast and loudly on missing config. A dashboard that boots with a
 * missing TOKEN_ENC_KEY and only explodes at token-decrypt time three hours
 * later is worse than one that refuses to start.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  googleClientId: () => required('GOOGLE_CLIENT_ID'),
  googleClientSecret: () => required('GOOGLE_CLIENT_SECRET'),
  appUrl: () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  tokenEncKey: () => required('TOKEN_ENC_KEY'),
  cronSecret: () => required('CRON_SECRET'),
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: () => required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  supabaseSecretKey: () => required('SUPABASE_SECRET_KEY'),
};

/**
 * Master switch for the restricted Gmail scope. When false the app never
 * requests it, never syncs it, and hides the Inbox tab — which is what a
 * public deployment runs to avoid the CASA assessment entirely.
 * See architecture.md section 7.
 */
export const ENABLE_GMAIL = process.env.ENABLE_GMAIL !== 'false';

export const redirectUri = () => `${env.appUrl()}/api/auth/google/callback`;
