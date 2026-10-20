// Shared by the Vercel function (api/ai.js) and the Vite dev server (vite.config.ts).
// The Groq key stays on the server: set GROQ_API_KEY in Vercel's project settings,
// or in .env.local for `npm run dev`. Never commit it.

// llama-3.3-70b-versatile was retired by Groq on 16 Aug 2026. If the chosen model is retired
// or unavailable, the next one in the list is tried. GROQ_MODEL (optional) is tried first.
const DEFAULT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const models = () => [...new Set([process.env.GROQ_MODEL, ...DEFAULT_MODELS].filter(Boolean))];
export const model = () => models()[0];
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

  let last = null;
  for (const m of models()) {
    let res = await callGroq(apiKey, m, messages, !!body.json);
    // Some models reject JSON mode; the browser can still pull the JSON out of plain text.
    if (res.status === 400 && body.json) res = await callGroq(apiKey, m, messages, false);
    if (res.ok) {
      const data = await res.json();
      return [200, { text: data?.choices?.[0]?.message?.content ?? "", model: m }];
    }
    const detail = await res.text().catch(() => "");
    last = { status: res.status, detail };
    if (res.status === 429) return [429, { error: "Rate limited, try again in a minute" }];
    if (res.status === 401 || res.status === 403) {
      return [502, { error: "The Groq key was rejected. Check GROQ_API_KEY in the deployment settings.", detail: groqMessage(detail) }];
    }
    // 404 / 400 "model_decommissioned" / "model_not_found": try the next model.
    if (!(res.status === 404 || /model/i.test(detail))) break;
  }
  return [502, { error: "AI provider error", detail: groqMessage(last?.detail ?? "") }];
}

async function callGroq(apiKey, m, messages, json) {
  const reasoning = m.startsWith("openai/gpt-oss");
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      messages,
      temperature: json ? 0 : 0.3,
      // Reasoning models spend part of the budget thinking, so allow more room.
      max_completion_tokens: reasoning ? 2000 : 700,
      ...(reasoning ? { reasoning_effort: "low", include_reasoning: false } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

function groqMessage(detail) {
  try {
    return String(JSON.parse(detail)?.error?.message ?? "").slice(0, 300);
  } catch {
    return String(detail).slice(0, 300);
  }
}
