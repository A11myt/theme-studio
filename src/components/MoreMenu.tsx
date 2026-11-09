// ⋯-Menü in der Kopfzeile: seltene Aktionen (Zufall, Import, Link teilen) aus dem Weg, aber per Tastatur voll bedienbar.
import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";

export interface MenuItem { label: string; hint?: string; onSelect: () => void }

export function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    refs.current[0]?.focus();
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const close = () => { setOpen(false); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    const i = refs.current.findIndex((r) => r === document.activeElement);
    const n = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (n !== undefined) { e.preventDefault(); refs.current[(n + items.length) % items.length]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="more" ref={wrap}>
      <button ref={btn} type="button" className="ghost icon" aria-haspopup="menu" aria-expanded={open}
        aria-label={t("Weitere Aktionen")} title={t("Weitere Aktionen")} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className="more-menu" role="menu" onKeyDown={onKey}>
          {items.map((it, i) => (
            <button key={it.label} ref={(el) => { refs.current[i] = el; }} type="button" role="menuitem" tabIndex={-1}
              onClick={() => { setOpen(false); it.onSelect(); }}>
              <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
