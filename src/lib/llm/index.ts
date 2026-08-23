import { decrypt } from '../crypto';
import { supabaseServer } from '../supabase/server';
import { anthropic } from './anthropic';
import { openai } from './openai';
import type { LlmProvider, LlmProviderId } from './types';

export const PROVIDERS: Record<LlmProviderId, LlmProvider> = { anthropic, openai };
export const PROVIDER_LIST = [anthropic, openai];

export interface LoadedLlm {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

/**
 * Load the caller's configured provider and decrypt their key.
 *
 * Returns null when no key is configured — that is a normal state, not an
 * error: the assistant falls back to its deterministic answer so the feature
 * works for everyone and only gets conversational when a key is present.
 *
 * Reads through the RLS-scoped client, so this can only ever return the
 * caller's own credential.
 */
export async function loadLlm(): Promise<LoadedLlm | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from('llm_credentials')
    .select('provider,api_key_enc,model').maybeSingle();
  if (!data) return null;

  const provider = PROVIDERS[data.provider as LlmProviderId];
  if (!provider) return null;

  try {
    return {
      provider,
      apiKey: decrypt(data.api_key_enc),
      model: data.model || provider.defaultModel,
    };
  } catch {
    // Key encrypted under a rotated TOKEN_ENC_KEY — unrecoverable, so behave as
    // if unconfigured rather than throwing on every request.
    return null;
  }
}
