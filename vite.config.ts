/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAi, requestContext } from "./api/_groq.js";

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
      const [status, json, headers] = await handleAi(req.method, body, apiKey, requestContext(req.headers)).catch(
        () => [500, { error: "Unexpected error" }] as [number, unknown],
      );
      res.statusCode = status;
      for (const [k, v] of Object.entries(headers ?? {})) res.setHeader(k, v);
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
    plugins: [
      react(),
      localAiApi(env.GROQ_API_KEY),
      // Installable app: manifest + service worker. Android Chrome offers "Install app"; it opens on the console and works offline.
      VitePWA({
        injectRegister: null, // registered in src/pwa.ts, only where service workers can run
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
        manifest: {
          name: "SiteSupply",
          short_name: "SiteSupply",
          description: "Know about a late construction delivery before your crew does.",
          start_url: "./#/console",
          scope: "./",
          display: "standalone",
          orientation: "any",
          background_color: "#07090D",
          theme_color: "#07090D",
          categories: ["business", "productivity"],
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            { name: "Live board", url: "./#/console", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
            { name: "Alerts", url: "./#/console/alerts", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
            { name: "Ask SiteSupply", url: "./#/console/ask", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,wasm,sqlite}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "fonts" },
            },
          ],
        },
      }),
    ],
    build: { chunkSizeWarningLimit: 1500 },
    // ASCII-only output: escapes characters like U+FFFD that some hosts reject in JS files.
    esbuild: { charset: "ascii" },
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
