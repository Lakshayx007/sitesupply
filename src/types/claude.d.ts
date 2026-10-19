/** Minimal types for the Claude artifact runtime, used only when the site runs as a Claude artifact preview. */
interface ClaudeSampleFn {
  (input: string | { role: "user" | "assistant"; content: string }[], options?: {
    onText?: (u: { text: string; delta: string }) => void;
    signal?: AbortSignal;
    modelTier?: "quick" | "default" | "complex";
    cache?: boolean;
  }): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, options?: { modelTier?: "quick" | "default" | "complex"; signal?: AbortSignal }): Promise<T>;
}

interface Window {
  claude?: { use(name: "sample"): Promise<ClaudeSampleFn | null> };
}
