import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import { errText } from '../lib/platform';
import { tauriBridge, type Bridge, type WinEnv } from '../lib/windows/bridge';
import { BackgroundSettings } from './BackgroundSettings';
import { ServicesPanel } from './ServicesPanel';

export function SystemSettings() {
  const [native, setNative] = useState<{ bridge: Bridge; env: WinEnv }>();
  const [note, setNote] = useState('');
  const [session, setSession] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const bridge = await tauriBridge();
      const env = await bridge.env();
      if (active && env.os === 'windows') setNative({ bridge, env });
    })().catch(error => { if (active) setNote(errText(error)); });
    return () => { active = false; };
  }, []);
  async function undo() {
    if (!native || !session) return;
    setRestoring(true);
    try {
      const steps = await native.bridge.restore(session);
      setSession(undefined);
      setNote(t('Rückgängig gemacht ({n} Änderungen zurückgesetzt).', { n: steps.length }));
      await native.bridge.log([`=== Rückgängig ${session}`, ...steps]);
    } catch (error) { setNote(t('Rückgängig fehlgeschlagen: {e}', { e: errText(error) })); }
    finally { setRestoring(false); }
  }
  return <><BackgroundSettings /><div className="pad form">
    {native && <ServicesPanel bridge={native.bridge} env={native.env} busy={restoring} onSession={setSession} onNote={setNote} />}
    {note && <p className="win-note" role="status">{note}</p>}
    {session && <button type="button" className="ghost" disabled={restoring} onClick={undo}>{t('Rückgängig')}</button>}
  </div></>;
}
