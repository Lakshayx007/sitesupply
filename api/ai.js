// Vercel serverless function: POST /api/ai runs one AI task (see api/_prompts.js). GET /api/ai is a health check.
import { handleAi, requestContext } from "./_groq.js";

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  try {
    const [status, json, headers] = await handleAi(req.method, body, process.env.GROQ_API_KEY, requestContext(req.headers));
    res.setHeader("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v);
    res.status(status).json(json);
  } catch {
    res.status(500).json({ error: "Unexpected error" });
  }
}
