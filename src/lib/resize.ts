// Verkleinern wie Pillow „BILINEAR“ (= Dreiecksfilter, Breite wächst mit dem Verkleinerungsfaktor),
// damit die Ausgangsfarben exakt zu matugen/wintheme passen. Browser-Canvas rechnet anders.
// Erst waagerecht, dann senkrecht; Zwischenergebnis wird wie bei Pillow auf 0–255 gerundet.

function coefficients(inSize: number, outSize: number) {
  const scale = inSize / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 1 * filterscale;                      // Dreiecksfilter: Träger 1
  const out: { start: number; w: Float64Array }[] = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    const n = xmax - xmin;
    const w = new Float64Array(n);
    let sum = 0;
    for (let x = 0; x < n; x++) {
      const v = Math.max(0, 1 - Math.abs((x + xmin - center + 0.5) / filterscale));
      w[x] = v;
      sum += v;
    }
    if (sum) for (let x = 0; x < n; x++) w[x] /= sum;
    out.push({ start: xmin, w });
  }
  return out;
}

const clip = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** RGBA-Pixel (w×h) → RGBA-Pixel (ow×oh). */
export function resizeBilinear(src: Uint8ClampedArray, w: number, h: number, ow: number, oh: number): Uint8ClampedArray {
  // waagerecht: w×h → ow×h
  const hc = coefficients(w, ow);
  const tmp = new Uint8ClampedArray(ow * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ow; x++) {
      const { start, w: k } = hc[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < k.length; i++) {
        const p = (y * w + start + i) * 4;
        r += src[p] * k[i]; g += src[p + 1] * k[i]; b += src[p + 2] * k[i]; a += src[p + 3] * k[i];
      }
      const o = (y * ow + x) * 4;
      tmp[o] = clip(r); tmp[o + 1] = clip(g); tmp[o + 2] = clip(b); tmp[o + 3] = clip(a);
    }
  }
  // senkrecht: ow×h → ow×oh
  const vc = coefficients(h, oh);
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const { start, w: k } = vc[y];
    for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < k.length; i++) {
        const p = ((start + i) * ow + x) * 4;
        r += tmp[p] * k[i]; g += tmp[p + 1] * k[i]; b += tmp[p + 2] * k[i]; a += tmp[p + 3] * k[i];
      }
      const o = (y * ow + x) * 4;
      out[o] = clip(r); out[o + 1] = clip(g); out[o + 2] = clip(b); out[o + 3] = clip(a);
    }
  }
  return out;
}
