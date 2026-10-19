// Shared by the Vercel function (api/ai.js) and the Vite dev server (vite.config.ts).
// The Groq key stays on the server: set GROQ_API_KEY in Vercel's project settings,
// or in .env.local for `npm run dev`. Never commit it.

export const model = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_CHARS = 24000;

/** Validates the browser's request and calls Groq. Returns [status, body]. */
export async function handleAi(method, body, apiKey) {
  if (method === "GET") {
    return apiKey ? [200, { ok: true, provider: "groq", model: model() }] : [200, { ok: false, error: "GROQ_API_KEY is not set" }];
  }
  if (method !== "POST") return [405, { error: "Use GET or POST" }];
  if (!apiKey) return [503, { error: "AI is not configured on this deployment" }];

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0 || messages.length > 12) return [400, { error: "messages must be a non-empty array" }];
  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant" && m.role !== "system") || typeof m.content !== "string") {
      return [400, { error: "each message needs a role and string content" }];
    }
    total += m.content.length;
  }
  if (total > MAX_CHARS) return [413, { error: "Request too long" }];

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model(),
      messages,
      temperature: body.json ? 0 : 0.3,
      max_tokens: 700,
      ...(body.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    return [r.status === 429 ? 429 : 502, { error: r.status === 429 ? "Rate limited, try again in a minute" : "AI provider error", detail: detail.slice(0, 300) }];
  }
  const data = await r.json();
  return [200, { text: data?.choices?.[0]?.message?.content ?? "", model: model() }];
}
