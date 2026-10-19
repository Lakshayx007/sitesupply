/**
 * Registers the service worker that makes SiteSupply installable and usable offline.
 * Skipped inside the Claude artifact preview (which can't run service workers) and in development.
 */
export function registerPwa() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator) || window.claude) return;
  const ok = location.protocol === "https:" || location.hostname === "localhost";
  if (!ok) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {
      /* not available on this host; the site still works online */
    });
  });
}

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const canInstall = () => deferred !== null;
export function onInstallChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export async function install() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => null);
  deferred = null;
  listeners.forEach((l) => l());
}
