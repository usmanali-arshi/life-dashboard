import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { PROVIDERS } from '@/lib/llm';
import { LlmError, type LlmProviderId } from '@/lib/llm/types';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Report which provider is configured — WITHOUT the key.
 *
 * The key is write-only by design: once saved it never travels back to the
 * browser, so a compromised session can use it but not exfiltrate it. The UI
 * gets a last-4 hint instead.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = await supabaseServer();
  const { data } = await sb.from('llm_credentials')
    .select('provider,key_hint,model,status,last_error,verified_at').maybeSingle();

  return NextResponse.json({ credential: data ?? null });
}

/** Save a key, verifying it against the provider before storing anything. */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const providerId = body.provider as LlmProviderId;
  const provider = PROVIDERS[providerId];
  const apiKey = String(body.api_key ?? '').trim();
  const model = String(body.model ?? '').trim() || provider?.defaultModel;

  if (!provider) return NextResponse.json({ error: 'unknown provider' }, { status: 400 });
  if (apiKey.length < 20) {
    return NextResponse.json({ error: 'That does not look like an API key.' }, { status: 400 });
  }

  // Verify BEFORE storing. Saving an unverified key means the first real
  // question is where the user discovers it's wrong, which is a worse place to
  // find out than the settings form they're already looking at.
  try {
    await provider.complete(apiKey, model, {
      system: 'Reply with the single word: ok',
      messages: [{ role: 'user', content: 'ok' }],
      maxTokens: 8,
    });
  } catch (e) {
    const message = e instanceof LlmError ? e.message : 'Could not reach the provider.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('llm_credentials').upsert({
    user_id: user.id,
    provider: providerId,
    api_key_enc: encrypt(apiKey),          // AES-256-GCM, same as Google tokens
    key_hint: apiKey.slice(-4),
    model,
    status: 'ok',
    last_error: null,
    verified_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    credential: { provider: providerId, key_hint: apiKey.slice(-4), model, status: 'ok' },
  });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = await supabaseServer();
  const { error } = await sb.from('llm_credentials').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
