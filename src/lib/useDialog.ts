// Barrierefreie Dialoge: Fokus beim Öffnen hinein, Tab bleibt im Dialog, beim Schließen zurück zum Auslöser.
import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function useDialog(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = document.activeElement as HTMLElement | null;
    const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    // erstes Eingabefeld bevorzugen, sonst erster Knopf
    (el.querySelector<HTMLElement>("[autofocus], input:not([type=checkbox]):not([type=color])") ?? items()[0] ?? el).focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener("keydown", trap);
    return () => {
      el.removeEventListener("keydown", trap);
      before?.focus?.();
    };
  }, [ref]);
}
