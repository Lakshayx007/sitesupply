import { Download } from "lucide-react";
import { useSyncExternalStore } from "react";
import { canInstall, install, onInstallChange } from "../pwa";

/** Shows "Install app" only when the browser offers it (Chrome on Android and desktop). */
export function InstallButton({ className = "" }: { className?: string }) {
  const available = useSyncExternalStore(onInstallChange, canInstall, () => false);
  if (!available) return null;
  return (
    <button type="button" onClick={install} className={`btn-secondary min-h-[34px] px-3 ${className}`}>
      <Download aria-hidden="true" className="h-4 w-4" />
      Install app
    </button>
  );
}
