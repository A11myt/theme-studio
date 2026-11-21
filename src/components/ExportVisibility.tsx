import { t } from '../lib/i18n';

export const compactHidden = ['apply', 'templates', 'komorebi', 'pywal', 'xresources', 'fontgen', 'terminal-font'];

export function ExportVisibility({ hidden, change }: { hidden: string[]; change: (ids: string[]) => void }) {
  const groups: [string, [string, string][]][] = [
    [t('Bereiche'), [['apply', t('Anwenden')], ['vscode', 'VS Code'], ['templates', t('Eigene Vorlagen')], ['prompts', t('Prompt')]]],
    [t('Allgemein'), [['theme', t('Theme-Datei')], ['css', t('CSS-Variablen')]]],
    ['Windows', [['terminal', 'Windows Terminal'], ['terminal-font', t('Windows Terminal: Schrift')], ['komorebi', 'komorebi']]],
    ['Linux', [['base16', 'base16 / tinted-theming'], ['pywal', 'pywal'], ['xresources', 'Xresources'], ['fontgen', t('fontgen-Profil')]]],
  ];
  return <div className="visibility-options">
    <p className="hint">{t('Wähle, was im Export-Bereich erscheint. Dein Theme und deine Vorlagen bleiben unverändert.')}</p>
    <div className="visibility-presets"><button className="ghost" type="button" onClick={() => change(compactHidden)}>{t('Kompakte Auswahl')}</button><button className="ghost" type="button" onClick={() => change([])}>{t('Alle anzeigen')}</button></div>
    {groups.map(([name, items]) => <fieldset key={name}><legend>{name}</legend><div>{items.map(([id, label]) => <label key={id}><input type="checkbox" checked={!hidden.includes(id)} onChange={e => change(e.target.checked ? hidden.filter(k => k !== id) : [...hidden, id])}/>{label}</label>)}</div></fieldset>)}
    <p className="hint">{t('System, Schrift und Prompt bestimmen, welche der gewählten Formate verfügbar sind.')}</p>
  </div>;
}
