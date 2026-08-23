import { classify, type LlmProvider } from './types';

export const openai: LlmProvider = {
  id: 'openai',
  label: 'OpenAI (ChatGPT models)',
  // Deliberately explicit: a ChatGPT Plus subscription grants no API access.
  // Keys and per-token billing live on the platform site, separately.
  keyUrl: 'https://platform.openai.com/api-keys',
  keyPrefixHint: 'sk-…',
  defaultModel: 'gpt-4o-mini',
  models: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'cheapest — plenty for this' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ],

  async complete(apiKey, model, req) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || openai.defaultModel,
        max_tokens: req.maxTokens ?? 700,
        // OpenAI has no separate system field on this endpoint — it's the first
        // message in the array.
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      }),
    });

    const text = await res.text();
    if (!res.ok) throw classify(res.status, text);

    const data = JSON.parse(text);
    return (data.choices?.[0]?.message?.content ?? '').trim();
  },
};
