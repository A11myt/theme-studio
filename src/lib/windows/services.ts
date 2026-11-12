// Hintergrund-Programme unter Windows einzeln abschalten: komorebi, whkd, das alte wintheme, Win-Tastenkombinationen.
// Jede Aktion sichert vorher (eigene Sicherung → „Rückgängig“). Das Zurücksetzen (reset.ts) nutzt dieselben Bausteine.
import { t as tr } from "../i18n";
import { komorebiDir } from "./apply";
import { join, type Bridge, type RegSet, type WinEnv } from "./bridge";

const ADV = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
export const WIN_KEYS = "1234567QCFDOW";   // wie install.ps1 in dotfiles-windows

export const startupDir = (e: WinEnv) => join(e.appdata, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");

export interface ServiceStatus {
  komorebi: { installed: boolean; running: boolean; autostart: boolean };
  whkd: { installed: boolean; running: boolean; autostart: boolean };
  wintheme: { present: boolean; running: boolean };
  hotkeys: { taken: boolean };     // Win-Tasten an whkd abgegeben
}

const count = (b: Bridge, n: Parameters<Bridge["processCount"]>[0]) => b.processCount(n).catch(() => 0);

/** Liest nur: was läuft, was startet mit Windows? */
export async function serviceStatus(b: Bridge, e: WinEnv): Promise<ServiceStatus> {
  const st = startupDir(e);
  const [komoLnk, whkdLnk, wtLnk, wtDir, komo, whkd, py, keys] = await Promise.all([
    b.exists(join(st, "komorebi.lnk")), b.exists(join(st, "whkd.lnk")), b.exists(join(st, "wintheme-watch.lnk")), b.exists(join(e.localappdata, "wintheme")),
    count(b, "komorebi.exe"), count(b, "whkd.exe"), count(b, "pythonw.exe"), b.regGet(ADV, "DisabledHotkeys").catch(() => null),
  ]);
  const keyText = keys?.kind === "String" ? keys.value : "";
  return {
    komorebi: { installed: !!e.tools.komorebic, running: komo > 0, autostart: komoLnk },
    whkd: { installed: !!e.tools.whkd || whkd > 0, running: whkd > 0, autostart: whkdLnk || (komoLnk && !!e.tools.whkd) },
    wintheme: { present: wtLnk || wtDir, running: py > 0 },
    hotkeys: { taken: WIN_KEYS.split("").every((k) => keyText.includes(k)) },
  };
}

/** komorebi starten (+ whkd/bar falls eine Autostart-Verknüpfung vorhanden ist). */
export async function startKomorebi(b: Bridge, e: WinEnv, details: string[]): Promise<void> {
  const bar = await b.exists(join(komorebiDir(e), "komorebi.bar.json"));
  const whkd = await b.exists(join(startupDir(e), "whkd.lnk")) || !!e.tools.whkd;
  const args = whkd && bar ? ["start", "--whkd", "--bar"] : whkd ? ["start", "--whkd"] : ["start"];
  const r = await b.runTool("komorebic", args);
  details.push(`komorebic ${args.join(" ")} → ${r.code}${r.output ? `: ${r.output.slice(0, 160)}` : ""}`);
  if (r.code !== 0) throw new Error(r.output.split("\n")[0] || `Code ${r.code}`);
}

/** komorebi beenden (mit Leiste und whkd). Ältere Versionen kennen --bar nicht → schrittweise. */
export async function stopKomorebi(b: Bridge, details: string[]): Promise<void> {
  let r = await b.runTool("komorebic", ["stop", "--whkd", "--bar"]).catch((err) => ({ code: -1, output: String(err) }));
  if (r.code !== 0) r = await b.runTool("komorebic", ["stop"]).catch((err) => ({ code: -1, output: String(err) }));
  details.push(`komorebic stop → ${r.code}${r.output ? `: ${r.output.slice(0, 160)}` : ""}`);
  for (const n of ["komorebi-bar.exe", "whkd.exe", "komorebi.exe"] as const) {
    const k = await b.stopProcess(n).catch(() => 0);
    if (k) details.push(`${n} beendet (${k})`);
  }
}

/** komorebi nicht mehr mit Windows starten (Verknüpfung entfernen – gesichert). */
export async function komorebiAutostartOff(b: Bridge, e: WinEnv, session: string, details: string[]): Promise<boolean> {
  const lnk = join(startupDir(e), "komorebi.lnk");
  const done = await b.remove(session, lnk);
  if (done) details.push(`Autostart entfernt: ${lnk}`);
  return done;
}

/** komorebi startet weiter, nur ohne whkd (Verknüpfung neu anlegen lassen). Plus eigene whkd.lnk entfernen.
 *  → Fehlertext, wenn komorebic die Verknüpfung nicht neu anlegen konnte. */
export async function whkdAutostartOff(b: Bridge, e: WinEnv, session: string, details: string[]): Promise<string | undefined> {
  const st = startupDir(e);
  if (await b.remove(session, join(st, "whkd.lnk"))) details.push("Autostart entfernt: whkd.lnk");
  const komoLnk = join(st, "komorebi.lnk");
  if (e.tools.komorebic && (await b.exists(komoLnk))) {
    await b.backupFile(session, komoLnk);
    const bar = await b.exists(join(komorebiDir(e), "komorebi.bar.json"));
    const r = await b.runTool("komorebic", bar ? ["enable-autostart", "--bar"] : ["enable-autostart"]).catch((err) => ({ code: -1, output: String(err) }));
    details.push(`komorebi-Autostart ohne whkd: ${r.code === 0 ? "ok" : `Code ${r.code} ${r.output.slice(0, 120)}`}`);
    if (r.code !== 0) return tr("komorebic enable-autostart ist fehlgeschlagen: {msg}", { msg: r.output.split("\n")[0] || `Code ${r.code}` });
  }
  return undefined;
}

export async function stopWhkd(b: Bridge, details: string[]): Promise<void> {
  const n = await b.stopProcess("whkd.exe").catch(() => 0);
  if (n) details.push(`whkd beendet (${n})`);
}

/** Altes wintheme (Farb-Automatik per Python): aus dem Autostart und beenden. */
export async function winthemeOff(b: Bridge, e: WinEnv, session: string, details: string[]): Promise<void> {
  if (await b.remove(session, join(startupDir(e), "wintheme-watch.lnk"))) details.push("Autostart entfernt: wintheme-watch.lnk");
  const n = await b.stopProcess("pythonw.exe").catch(() => 0);
  if (n) details.push(`Farb-Automatik beendet (${n})`);
}

/** Win-Tastenkombinationen zurück an Windows: wie vor install.ps1 (Sicherung), sonst unsere Buchstaben raus + Andocken an.
 *  → false, wenn nichts zu tun war. */
export async function restoreWinKeys(b: Bridge, e: WinEnv, session: string, details: string[]): Promise<boolean> {
  const keysBak = join(e.appdata, "wintheme", "winkeys-backup.json");
  const bak = await b.read(keysBak).then((t) => (t ? (JSON.parse(t.replace(/^﻿/, "")) as { DisabledHotkeys?: string | null; WindowArrangementActive?: string | null }) : null)).catch(() => null);
  const cur = await b.regGet(ADV, "DisabledHotkeys").catch(() => null);
  const curText = cur?.kind === "String" ? cur.value : "";
  let values: RegSet[];
  if (bak) {
    values = [
      { key: ADV, name: "DisabledHotkeys", value: bak.DisabledHotkeys ? { kind: "String", value: bak.DisabledHotkeys } : { kind: "Delete" } },
      { key: "Control Panel\\Desktop", name: "WindowArrangementActive", value: bak.WindowArrangementActive ? { kind: "String", value: bak.WindowArrangementActive } : { kind: "String", value: "1" } },
    ];
    details.push(`aus Sicherung: ${keysBak}`);
  } else if (WIN_KEYS.split("").every((k) => curText.includes(k))) {
    const rest = curText.split("").filter((k) => !WIN_KEYS.includes(k)).join("");
    values = [
      { key: ADV, name: "DisabledHotkeys", value: rest ? { kind: "String", value: rest } : { kind: "Delete" } },
      { key: "Control Panel\\Desktop", name: "WindowArrangementActive", value: { kind: "String", value: "1" } },
    ];
    details.push("keine Sicherung – Win+1–7, Q, C, F, D, O, W wieder an Windows, Andocken an");
  } else return false;
  const same = values[0].value.kind === "Delete" ? !cur : cur?.kind === "String" && values[0].value.kind === "String" && cur.value === values[0].value.value;
  await b.regApply(session, values);
  if (!same) { await b.restartExplorer().catch((err) => details.push(`Explorer-Neustart: ${String(err)}`)); details.push("Explorer neu gestartet"); }
  return true;
}
