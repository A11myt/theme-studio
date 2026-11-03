// Zeigt einen Prompt (aus previewPrompt) wie im Terminal: links die Zeilen, rechts die Infos in Zeile 1.
import type { CSSProperties } from "react";
import type { Palette } from "../lib/color";
import { previewPrompt, type Piece, type PromptOptions } from "../lib/prompt";

const span = (p: Piece, i: number) => (
  <span key={i} style={{ color: p.fg, background: p.bg, fontWeight: p.bold ? 600 : undefined } as CSSProperties}>{p.text}</span>
);

export function PromptView({ o, c, failed = false, command }: { o: PromptOptions; c: Palette; failed?: boolean; command?: string }) {
  const p = previewPrompt(o, c, failed);
  return (
    <div className="prompt-view">
      {p.left.map((line, i) => (
        <div key={i} className="pv-line">
          <span>{line.map(span)}{i === p.left.length - 1 && command ? <span style={{ color: c.on_surface }}>{command}</span> : null}</span>
          {i === 0 && <span className="pv-right">{p.right.map(span)}</span>}
        </div>
      ))}
    </div>
  );
}

/** Früherer Prompt, zusammengefaltet (Transient). */
export function TransientLine({ o, c, command }: { o: PromptOptions; c: Palette; command: string }) {
  const p = previewPrompt(o, c);
  if (!o.transient) return <PromptView o={o} c={c} command={command} />;
  return <div className="pv-line"><span>{p.transient.map(span)}<span style={{ color: c.on_surface }}>{command}</span></span></div>;
}
