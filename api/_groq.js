// Shared by the Vercel function (api/ai.js) and the Vite dev/preview server (vite.config.ts).
// The Groq key stays on the server: set GROQ_API_KEY in Vercel's project settings,
// or in .env.local for `npm run dev`. Never commit it.
//
// Protection for the key:
//  1. The browser sends a task name and its inputs; the prompt is built here (api/_prompts.js),
//     so the endpoint cannot be used as a general-purpose chatbot.
//  2. POSTs must come from a page on this site (Origin must match the host, or ALLOWED_ORIGINS).
//  3. A per-IP rate limit. It is in memory, so it is per server instance: a speed bump, not a wall.
//     For a hard cap, set a spending limit on the Groq key as well.

import { PromptError, buildPrompt } from "./_prompts.js";

// llama-3.3-70b-versatile was retired by Groq on 16 Aug 2026. If a model is retired or
// unavailable, the next one in the list is tried. GROQ_MODEL (optional) is tried first.
const DEFAULT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const models = () => [...new Set([process.env.GROQ_MODEL, ...DEFAULT_MODELS].filter(Boolean))];
export const model = () => models()[0];

export const RATE = { max: 20, windowMs: 10 * 60 * 1000 };
const hits = new Map();

/** Sliding-window limit per client IP. Returns seconds to wait, or 0 if allowed. */
export function rateLimit(ip, now = Date.now()) {
  const key = ip || "unknown";
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) {
    hits.set(key, recent);
    return Math.ceil((RATE.windowMs - (now - recent[0])) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > RATE.windowMs) hits.delete(k);
  return 0;
}

export function resetRateLimit() {
  hits.clear();
}

/** True when the request comes from a page on this site. */
export function originAllowed(origin, host) {
  if (!origin) return false;
  let o;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (extra.includes(o.origin)) return true;
  return !!host && o.host === host;
}

/**
 * Validates the browser's request and calls Groq. Returns [status, body, headers?].
 * ctx: { origin, host, ip } taken from the request headers by the caller.
 */
export async function handleAi(method, body, apiKey, ctx = {}) {
  if (method === "GET") {
    return apiKey ? [200, { ok: true, provider: "groq", model: model() }] : [200, { ok: false, error: "GROQ_API_KEY is not set" }];
  }
  if (method !== "POST") return [405, { error: "Use GET or POST" }];
  if (!originAllowed(ctx.origin, ctx.host)) return [403, { error: "This endpoint only answers requests from the SiteSupply site." }];
  if (!apiKey) return [503, { error: "AI is not configured on this deployment" }];

  let prompt;
  try {
    prompt = buildPrompt(body?.task, body?.input);
  } catch (e) {
    if (e instanceof PromptError) return [400, { error: e.message }];
    throw e;
  }

  const wait = rateLimit(ctx.ip);
  if (wait) return [429, { error: "Too many questions. Try again in a few minutes." }, { "Retry-After": String(wait) }];

  const messages = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
  let last = null;
  for (const m of models()) {
    let res = await callGroq(apiKey, m, messages, prompt.json);
    // Some models reject JSON mode; the browser can still pull the JSON out of plain text.
    if (res.status === 400 && prompt.json) res = await callGroq(apiKey, m, messages, false);
    if (res.ok) {
      const data = await res.json();
      return [200, { text: data?.choices?.[0]?.message?.content ?? "", model: m }];
    }
    const detail = await res.text().catch(() => "");
    last = { status: res.status, detail };
    if (res.status === 429) return [429, { error: "The AI service is busy. Try again in a minute." }];
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

/** Reads origin, host and client IP from Node-style request headers. */
export function requestContext(headers) {
  const h = (k) => {
    const v = headers?.[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    origin: h("origin"),
    host: (h("x-forwarded-host") ?? h("host") ?? "").split(",")[0].trim(),
    ip: (h("x-real-ip") ?? h("x-forwarded-for") ?? "").split(",")[0].trim(),
  };
}
