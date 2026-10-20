/**
 * The AI layer. Two providers, picked at run time:
 *  - "groq": the deployed site calls /api/ai (a Vercel function holding GROQ_API_KEY).
 *  - "claude": when the site runs as a Claude artifact preview, the viewer's own Claude answers.
 * If neither is available the assistant still runs its preset questions offline (SQL only, no prose).
 */

import { PromptError, buildPrompt, type AiTask } from "../../api/_prompts.js";

export type { AiTask };
type Opts = { onText?: (text: string) => void; signal?: AbortSignal };

export interface AiProvider {
  kind: "groq" | "claude";
  /** Shown in the UI so it is always clear which model answered. */
  label: string;
  /** Runs one task. The prompt is built from the inputs: on the server for Groq, here for Claude. */
  text(task: AiTask, input: Record<string, unknown>, opts?: Opts): Promise<string>;
  json<T>(task: AiTask, input: Record<string, unknown>, opts?: Opts): Promise<T>;
}

const apiUrl = () => new URL("api/ai", document.baseURI).toString();

async function groq(): Promise<AiProvider | null> {
  try {
    const r = await fetch(apiUrl(), { method: "GET" });
    if (!r.ok) return null;
    const info = (await r.json()) as { ok?: boolean; model?: string };
    if (!info.ok) return null;
    const call = async (task: AiTask, input: Record<string, unknown>, signal?: AbortSignal) => {
      const res = await fetch(apiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, input }),
        signal,
      });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string; detail?: string };
      if (!res.ok) {
        if (body.detail) console.warn("[SiteSupply AI]", body.detail);
        throw new AiError(body.error ?? "The AI service is unavailable.");
      }
      return body.text ?? "";
    };
    return {
      kind: "groq",
      label: `Groq · ${(info.model ?? "gpt-oss").replace(/^openai\//, "")}`,
      async text(task, input, opts) {
        const t = await call(task, input, opts?.signal);
        opts?.onText?.(t);
        return t;
      },
      async json<T>(task: AiTask, input: Record<string, unknown>, opts?: Opts) {
        return parseJson<T>(await call(task, input, opts?.signal));
      },
    };
  } catch {
    return null;
  }
}

async function claude(): Promise<AiProvider | null> {
  if (!window.claude?.use) return null;
  try {
    const sample = await window.claude.use("sample");
    if (!sample) return null;
    const prompt = (task: AiTask, input: Record<string, unknown>) => {
      const p = buildPrompt(task, input);
      return { p, text: `${p.system}\n\n${p.user}` };
    };
    return {
      kind: "claude",
      label: "Claude",
      async text(task, input, opts) {
        try {
          const { p, text: input2 } = prompt(task, input);
          const { text } = await sample(input2, {
            onText: opts?.onText ? ({ text }) => opts.onText!(text) : undefined,
            signal: opts?.signal,
            modelTier: p.quick ? "quick" : "default",
            cache: true,
          });
          return text;
        } catch (e) {
          throw toAiError(e);
        }
      },
      async json<T>(task: AiTask, input: Record<string, unknown>, opts?: Opts) {
        try {
          return await sample.json<T>(prompt(task, input).text, { modelTier: "quick", signal: opts?.signal });
        } catch (e) {
          throw toAiError(e);
        }
      },
    };
  } catch {
    return null;
  }
}

export class AiError extends Error {
  constructor(
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

function toAiError(e: unknown): AiError {
  if (e instanceof PromptError) return new AiError(`That question could not be sent: ${e.message}.`);
  const code = (e as { code?: string })?.code ?? "error";
  const copy: Record<string, string> = {
    not_granted: "Claude access was not allowed for this page.",
    rate_limited: "Too many questions at once. Try again in a minute.",
    cancelled: "Stopped.",
    refused: "The model declined that question. Try asking it another way.",
    sampling_disabled: "AI is not available on this account.",
  };
  return new AiError(copy[code] ?? "The AI could not answer. Try again.", code);
}

function parseJson<T>(t: string): T {
  try {
    return JSON.parse(t) as T;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new AiError("The AI reply was not in the expected format. Try again.");
  }
}

let cached: Promise<AiProvider | null> | null = null;

/** Detects the provider once per page load. */
export function getAi(): Promise<AiProvider | null> {
  if (!cached) cached = (async () => (await claude()) ?? (await groq()))();
  return cached;
}
