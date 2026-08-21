import { decrypt } from '../crypto';
import type { LinkedAccount } from '../providers/types';
import { supabaseServer } from '../supabase/server';
import { accessTokenFrom } from './oauth';

/**
 * Load one of the caller's linked accounts and derive a fresh access token.
 *
 * Reads through the RLS-scoped client on purpose: the `user_id = auth.uid()`
 * policy is what guarantees you can't hand this an id belonging to someone else
 * and get a working token for their mailbox. Never swap this for the
 * service-role client.
 */
export async function accountWithToken(accountId: string): Promise<{
  account: LinkedAccount; accessToken: string;
}> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from('linked_accounts')
    .select('*').eq('id', accountId).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Account not found');
  if (data.status !== 'active') throw new Error('Account needs reconnecting');

  const accessToken = await accessTokenFrom(decrypt(data.refresh_token_enc));
  return { account: data as LinkedAccount, accessToken };
}
