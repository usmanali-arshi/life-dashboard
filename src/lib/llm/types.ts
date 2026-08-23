/**
 * Bring-your-own-LLM abstraction.
 *
 * Same pattern as TaskProvider / CalendarProvider: one interface, N
 * implementations, chosen from a row in the database. Adding Gemini or a local
 * Ollama endpoint later is one new file and a registry entry.
 *
 * The user's key pays for the call, which is what keeps this feature free to
 * operate at any number of users.
 */

export type LlmProviderId = 'anthropic' | 'openai';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly label: string;
  /** Where the user gets a key — shown in the UI, because a ChatGPT or Claude
   *  subscription is NOT API access and people reasonably assume it is. */
  readonly keyUrl: string;
  readonly keyPrefixHint: string;
  readonly defaultModel: string;
  readonly models: { id: string; label: string; note?: string }[];
  complete(apiKey: string, model: string, req: LlmRequest): Promise<string>;
}

export class LlmError extends Error {
  constructor(message: string, readonly kind: 'auth' | 'rate_limit' | 'quota' | 'other' = 'other') {
    super(message);
    this.name = 'LlmError';
  }
}

/** Map provider HTTP failures onto something a user can act on. */
export function classify(status: number, body: string): LlmError {
  if (status === 401 || status === 403) {
    return new LlmError('That API key was rejected. Check it and paste it again.', 'auth');
  }
  if (status === 429) {
    return new LlmError('Rate limited by the provider. Try again shortly.', 'rate_limit');
  }
  if (status === 402 || /quota|billing|credit/i.test(body)) {
    return new LlmError(
      'The provider reports no available credit on this key. Add billing on their dashboard.',
      'quota',
    );
  }
  return new LlmError(`Provider error ${status}: ${body.slice(0, 200)}`);
}
