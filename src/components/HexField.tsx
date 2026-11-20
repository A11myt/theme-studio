import { useEffect, useId, useState } from 'react';
import { t } from '../lib/i18n';

export function HexField({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(color);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  useEffect(() => { setDraft(color); setInvalid(false); }, [color]);
  const commit = () => {
    const value = draft.trim().replace(/^#/, '');
    if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value)) { setInvalid(true); return; }
    const hex = '#' + (value.length === 3 ? Array.from(value, c => c + c).join('') : value).toLowerCase();
    setInvalid(false); setDraft(hex); if (hex !== color.toLowerCase()) onChange(hex);
  };
  return <div className="hex-field"><label><span>HEX</span><input aria-label={t('Hex-Farbwert')} value={draft} spellCheck={false} autoComplete="off" aria-invalid={invalid} aria-describedby={invalid ? id : undefined} onFocus={e => e.target.select()} onBlur={commit} onChange={e => { setDraft(e.target.value); setInvalid(false); }} onKeyDown={e => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(color); setInvalid(false); }
  }} /></label>{invalid && <small role="status" id={id}>{t('Beispiel: #6750A4')}</small>}</div>;
}
