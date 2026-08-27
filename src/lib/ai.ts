/**
 * Server-side Claude access (Batch D). Every AI feature checks hasAi() and
 * degrades gracefully when ANTHROPIC_API_KEY is absent — classic search, no
 * drawer, no summaries; never a broken widget.
 */

export const hasAi = (): boolean => Boolean(import.meta.env.ANTHROPIC_API_KEY);

export async function askClaude(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<string | null> {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? "claude-haiku-4-5-20251001",
        max_tokens: opts.maxTokens ?? 700,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: opts.prompt }],
      }),
    });
    if (!res.ok) {
      console.error("askClaude HTTP", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data: any = await res.json();
    return data?.content?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error("askClaude failed", err);
    return null;
  }
}

/** Ask for strict JSON; returns parsed object or null. */
export async function askClaudeJson<T>(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<T | null> {
  const text = await askClaude({
    ...opts,
    system: `${opts.system ?? ""}\nRespond with ONLY a valid JSON object — no markdown fences, no prose.`.trim(),
  });
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

/** Stable content hash for AI-summary caching. */
export function hashInput(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
