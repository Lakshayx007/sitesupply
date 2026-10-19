/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAi } from "./api/_groq.js";

/** Serves /api/ai for `npm run dev` and `npm run preview`, the same way the Vercel function does in production. */
function localAiApi(apiKey: string | undefined): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      let body: unknown = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        /* invalid JSON is reported by handleAi */
      }
      const [status, json] = await handleAi(req.method, body, apiKey).catch(() => [500, { error: "Unexpected error" }] as [number, unknown]);
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(json));
    });
  };
  return {
    name: "sitesupply-local-ai",
    configureServer: (server) => void server.middlewares.use("/api/ai", handler),
    configurePreviewServer: (server) => void server.middlewares.use("/api/ai", handler),
  };
}

// base "./" + HashRouter = works on any static host (Vercel, Netlify, GitHub Pages).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.GROQ_MODEL) process.env.GROQ_MODEL = env.GROQ_MODEL;
  return {
    base: "./",
    plugins: [react(), localAiApi(env.GROQ_API_KEY)],
    build: { chunkSizeWarningLimit: 1500 },
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
