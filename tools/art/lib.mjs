// Shared drawing helpers for generated art.
// Everything is drawn supersampled (SS x) and downscaled, so edges get the same
// soft anti-aliasing as the Kenney Top-down Shooter pack.
import { createCanvas } from '@napi-rs/canvas';

export const SS = 4;

/** Kenney palette (sampled from tilesheet_complete.png). */
export const PAL = {
  wallTop: '#4a4a4a',
  outline: '#2f2f2f',
  gunDark: '#3b3f44',
  gunMid: '#545a61',
  gunLight: '#737b84',
  gunOutline: '#26292c',
  wood: '#c48647', woodDark: '#956536', woodLight: '#d08e4a',
  orange: '#e86a17', orangeDark: '#a64a0f',
  lab: '#a6c9cb', labDark: '#648587', labLight: '#94b4b6',
  feather: '#f7f3ea', featherShade: '#d9d1bf', featherOutline: '#b8ae98',
  comb: '#e0332f', combDark: '#a3201d',
  beak: '#f5a623', beakDark: '#c47f12',
  claw: '#f2b134', clawDark: '#b97d17',
  skin: '#ffcc99', skinDark: '#d9a273',
  shadow: 'rgba(0,0,0,0.13)',
};

export function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/** Darken (f<1) or lighten (f>1) a hex colour. */
export function shade(h, f) {
  const [r, g, b] = hex2rgb(h);
  if (f < 1) return rgb2hex(r * f, g * f, b * f);
  const t = f - 1;
  return rgb2hex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/**
 * Create a supersampled drawing surface of logical size w x h.
 * `draw(g)` receives a context already scaled so that 1 unit = 1 output pixel.
 * Returns the final canvas at 1x.
 */
export function art(w, h, draw, ss = SS) {
  const big = createCanvas(w * ss, h * ss);
  const g = big.getContext('2d');
  g.scale(ss, ss);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  // progressive downscale for good AA
  let cur = big, cw = w * ss, ch = h * ss;
  while (cw > w) {
    const nw = Math.max(w, Math.round(cw / 2)), nh = Math.max(h, Math.round(ch / 2));
    const nc = createCanvas(nw, nh);
    const ng = nc.getContext('2d');
    ng.imageSmoothingEnabled = true;
    ng.imageSmoothingQuality = 'high';
    ng.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    cur = nc; cw = nw; ch = nh;
  }
  return cur;
}

export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Filled + outlined shape in Kenney style (outline = darker shade of the fill). */
export function paint(g, fill, stroke, lw = 2) {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

export function box(g, x, y, w, h, r, fill, stroke, lw = 2) {
  rrect(g, x, y, w, h, r);
  paint(g, fill, stroke === undefined ? shade(fill, 0.72) : stroke, lw);
}

export function circle(g, x, y, r, fill, stroke, lw = 2) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  paint(g, fill, stroke === undefined ? shade(fill, 0.72) : stroke, lw);
}

export function ellipse(g, x, y, rx, ry, fill, stroke, lw = 2, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  paint(g, fill, stroke === undefined ? shade(fill, 0.72) : stroke, lw);
}

export function poly(g, pts, fill, stroke, lw = 2) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  paint(g, fill, stroke === undefined ? shade(fill, 0.72) : stroke, lw);
}

export function line(g, x1, y1, x2, y2, color, lw = 2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.stroke();
}

export function radial(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Deterministic PRNG so generated art is stable between runs. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Simple shelf packer → Phaser JSON-hash atlas.
 * items: [{name, canvas}]  returns {canvas, json}
 */
export function packAtlas(items, imageName, maxW = 2048, pad = 2) {
  const sorted = [...items].sort((a, b) => b.canvas.height - a.canvas.height || b.canvas.width - a.canvas.width);
  let x = pad, y = pad, rowH = 0, W = 0;
  const placed = [];
  for (const it of sorted) {
    const w = it.canvas.width, h = it.canvas.height;
    if (x + w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
    placed.push({ ...it, x, y, w, h });
    x += w + pad;
    rowH = Math.max(rowH, h);
    W = Math.max(W, x);
  }
  const H = y + rowH + pad;
  const pow2 = (v) => { let p = 64; while (p < v) p *= 2; return p; };
  const cw = pow2(W), ch = pow2(H);
  const c = createCanvas(cw, ch);
  const g = c.getContext('2d');
  const frames = {};
  for (const p of placed) {
    g.drawImage(p.canvas, p.x, p.y);
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.w, h: p.h },
      rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
      sourceSize: { w: p.w, h: p.h },
      ...(p.pivot ? { pivot: p.pivot } : {}),
    };
  }
  return { canvas: c, json: { frames, meta: { image: imageName, size: { w: cw, h: ch }, scale: 1 } } };
}
