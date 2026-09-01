import { useCallback, useEffect, useRef, useState } from "react";

const MIN_BACKGROUND_SYNC_MS = 120000;
const MAX_BACKGROUND_SYNC_MS = 210000;

// Reparte los dispositivos en una ventana estable de 90 segundos. Así 300
// navegadores no consultan Apps Script exactamente en el mismo instante.
export function missionSyncDelay(token: string, cycle: number): number {
  const value = `${token}:${cycle}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return MIN_BACKGROUND_SYNC_MS + ((hash >>> 0) % (MAX_BACKGROUND_SYNC_MS - MIN_BACKGROUND_SYNC_MS + 1));
}

// Read only mission assignments; never replace local progress or game scores.
// Each active view owns its request lifecycle, so late responses cannot overwrite
// administrative changes, a new session, or a view that is already closed.
export function useMissionSync<T>({ token, active, view, load, onSync }: {
  token: string; active: boolean; view: string; load: (token: string) => Promise<T>; onSync: (data: T) => void;
}) {
  const callbacks = useRef({ load, onSync });
  callbacks.current = { load, onSync };
  const refreshRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const lastRead = useRef({ token: "", at: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let pending: Promise<void> | null = null;
    let timer: number | undefined;
    let cycle = 0;
    setLoading(false);
    setError("");
    if (!active || !token) { refreshRef.current = async () => {}; return; }
    const refresh = (force = false): Promise<void> => {
      if (pending) return pending;
      if (document.hidden || navigator.onLine === false) {
        if (force) setError("No hay conexión. Las misiones guardadas se conservan; vuelve a intentar al conectarte.");
        return Promise.resolve();
      }
      if (!force && lastRead.current.token === token && Date.now() - lastRead.current.at < 60000) return Promise.resolve();
      setLoading(true);
      pending = callbacks.current.load(token).then((data) => {
        if (!alive) return;
        callbacks.current.onSync(data);
        lastRead.current = { token, at: Date.now() };
        setError("");
      }).catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : "No se pudieron actualizar las misiones. Intenta nuevamente.");
      }).finally(() => { pending = null; if (alive) setLoading(false); });
      return pending;
    };
    refreshRef.current = refresh;
    const onReturn = () => { void refresh(); };
    // El bundle de inicio de sesión ya incluye las asignaciones actuales. Evita
    // duplicar esa lectura y comienza luego una sincronización escalonada.
    if (lastRead.current.token !== token) lastRead.current = { token, at: Date.now() };
    const schedule = () => {
      timer = window.setTimeout(() => {
        void refresh().finally(() => { if (alive) schedule(); });
      }, missionSyncDelay(token, cycle++));
    };
    schedule();
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [active, token, view]);

  const refresh = useCallback(() => refreshRef.current(true), []);
  return { loading, error, refresh };
}
