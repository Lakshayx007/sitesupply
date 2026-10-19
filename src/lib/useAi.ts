import { useEffect, useState } from "react";
import { getAi, type AiProvider } from "./ai";

/** "checking" until the provider is known, then the provider or null (offline). */
export function useAi(): { status: "checking" | "ready" | "off"; ai: AiProvider | null } {
  const [state, setState] = useState<{ status: "checking" | "ready" | "off"; ai: AiProvider | null }>({ status: "checking", ai: null });
  useEffect(() => {
    let alive = true;
    getAi().then((ai) => alive && setState({ status: ai ? "ready" : "off", ai }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
