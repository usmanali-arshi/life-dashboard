import { classify, type LlmProvider } from './types';

export const anthropic: LlmProvider = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  keyUrl: 'https://console.claude.com/settings/keys',
  keyPrefixHint: 'sk-ant-…',
  defaultModel: 'claude-haiku-4-5',
  models: [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'cheapest — plenty for this' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5', note: '2× the cost of Haiku' },
    { id: 'claude-opus-5', label: 'Opus 5', note: '5× the cost of Haiku' },
  ],

  async complete(apiKey, model, req) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || anthropic.defaultModel,
        max_tokens: req.maxTokens ?? 700,
        system: req.system,
        messages: req.messages,
      }),
    });

    const text = await res.text();
    if (!res.ok) throw classify(res.status, text);

    const data = JSON.parse(text);
    return (data.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
  },
};
