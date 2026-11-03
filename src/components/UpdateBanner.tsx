// Hinweis „Update verfügbar“ – prüft beim Start (installierte App unter Windows).
import { useEffect, useState } from "react";
import { canUpdate, checkUpdate, errText } from "../lib/platform";

export function UpdateBanner() {
  const [upd, setUpd] = useState<Awaited<ReturnType<typeof checkUpdate>>>(null);
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!canUpdate) return;
    checkUpdate().then(setUpd).catch(() => { /* offline o. Ä. – still */ });
  }, []);

  if (!upd || hidden) return null;
  const install = async () => {
    setProgress(0);
    setError("");
    try {
      await upd.install(setProgress);
    } catch (e) {
      setError(errText(e));
      setProgress(undefined);
    }
  };
  return (
    <div className="update-banner" role="status">
      <b>Theme Studio {upd.version} ist da.</b>
      {error ? <span className="error">Update fehlgeschlagen: {error}</span>
        : progress !== undefined ? <span>wird geladen … {Math.round(progress * 100)} %</span>
        : <span className="empty">{upd.notes?.split("\n")[0] ?? ""}</span>}
      <span className="grow" />
      {progress === undefined && <button type="button" className="primary" onClick={install}>Jetzt aktualisieren</button>}
      {progress === undefined && <button type="button" className="ghost" onClick={() => setHidden(true)}>Später</button>}
    </div>
  );
}
