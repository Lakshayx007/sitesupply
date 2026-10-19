// Vercel serverless function: POST /api/ai → Groq chat completion. GET /api/ai → health check.
import { handleAi } from "./_groq.js";

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
    const [status, json] = await handleAi(req.method, body, process.env.GROQ_API_KEY);
    res.status(status).setHeader("Cache-Control", "no-store").json(json);
  } catch {
    res.status(500).json({ error: "Unexpected error" });
  }
}
