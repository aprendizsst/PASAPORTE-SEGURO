import { useCallback, useEffect, useRef, useState } from "react";

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
    setLoading(false);
    setError("");
    if (!active || !token) { refreshRef.current = async () => {}; return; }
    const refresh = (force = false): Promise<void> => {
      if (pending) return pending;
      if (document.hidden || navigator.onLine === false) {
        if (force) setError("No hay conexión. Las misiones guardadas se conservan; vuelve a intentar al conectarte.");
        return Promise.resolve();
      }
      if (!force && lastRead.current.token === token && Date.now() - lastRead.current.at < 30000) return Promise.resolve();
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
    void refresh();
    const timer = window.setInterval(onReturn, 60000);
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [active, token, view]);

  const refresh = useCallback(() => refreshRef.current(true), []);
  return { loading, error, refresh };
}
