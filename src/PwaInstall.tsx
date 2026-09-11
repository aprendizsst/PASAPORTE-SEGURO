import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const confirmInstall = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", confirmInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", confirmInstall);
    };
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setShowHelp((current) => !current);
  }

  if (installed) return null;

  return <aside className="pwa-install" aria-label="Instalar Pasaporte Seguro">
    <button type="button" className="pwa-install-button" onClick={() => void install()} aria-expanded={showHelp}>
      <span aria-hidden="true">⇩</span>
      Instalar en mi celular
    </button>
    {showHelp && <div className="pwa-install-help" role="status">
      <button type="button" onClick={() => setShowHelp(false)} aria-label="Cerrar instrucciones">×</button>
      <b>Crear acceso directo</b>
      <p>{isIos()
        ? <>En Safari toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.</>
        : <>Abre el menú del navegador <strong>⋮</strong> y selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</>}
      </p>
    </div>}
  </aside>;
}
