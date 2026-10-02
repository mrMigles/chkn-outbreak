// Effect textures: muzzle flashes, glows, sparks, blood, feathers, casings, smoke…
// Most are white/neutral so the game can tint them per weapon.
import { art, shade, box, circle, ellipse, poly, line, radial, rng } from './lib.mjs';

function star(g, cx, cy, n, rOut, rIn, rot, fill) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut[i / 2 % rOut.length] : rIn;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = fill; g.fill();
}

export const FX_ART = {
  // --- muzzle flashes (origin = left-middle, pointing +X)
  flash_pistol: () => art(48, 32, (g) => {
    radial(g, 10, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,230,140,0.9)'], [1, 'rgba(255,150,40,0)']]);
    poly(g, [[4, 10], [46, 16], [4, 22]], 'rgba(255,214,90,0.95)', null);
    poly(g, [[6, 13], [36, 16], [6, 19]], '#ffffff', null);
    poly(g, [[8, 16], [18, 2], [14, 16]], 'rgba(255,200,80,0.9)', null);
    poly(g, [[8, 16], [18, 30], [14, 16]], 'rgba(255,200,80,0.9)', null);
  }),
  flash_long: () => art(96, 40, (g) => {
    radial(g, 12, 20, 20, [[0, '#fff'], [0.35, 'rgba(255,236,160,0.95)'], [1, 'rgba(255,140,30,0)']]);
    poly(g, [[4, 13], [94, 20], [4, 27]], 'rgba(255,200,70,0.95)', null);
    poly(g, [[6, 16.5], [74, 20], [6, 23.5]], '#ffffff', null);
    for (const s of [-1, 1]) {
      poly(g, [[14, 20], [30, 20 + s * 17], [22, 20]], 'rgba(255,190,60,0.9)', null);
      poly(g, [[34, 20], [44, 20 + s * 9], [40, 20]], 'rgba(255,220,120,0.9)', null);
    }
  }),
  flash_wide: () => art(80, 64, (g) => {
    radial(g, 12, 32, 30, [[0, '#fff'], [0.35, 'rgba(255,230,140,0.95)'], [1, 'rgba(255,120,20,0)']]);
    poly(g, [[4, 26], [78, 4], [56, 32], [78, 60], [4, 38]], 'rgba(255,190,60,0.92)', null);
    poly(g, [[6, 28], [60, 16], [44, 32], [60, 48], [6, 36]], 'rgba(255,240,180,0.98)', null);
    poly(g, [[6, 30], [40, 32], [6, 34]], '#ffffff', null);
  }),
  flash_star: () => art(64, 64, (g) => {
    radial(g, 32, 32, 30, [[0, '#fff'], [0.3, 'rgba(255,236,170,0.9)'], [1, 'rgba(255,150,40,0)']]);
    star(g, 32, 32, 7, [30, 22, 27, 19, 29, 24, 21], 8, 0.2, 'rgba(255,214,100,0.95)');
    star(g, 32, 32, 7, [16, 12, 15, 11, 16, 13, 12], 5, 0.5, '#ffffff');
  }),
  // flamethrower jet base
  flash_flame: () => art(64, 32, (g) => {
    radial(g, 12, 16, 16, [[0, '#fff'], [0.5, 'rgba(120,200,255,0.9)'], [1, 'rgba(60,120,255,0)']]);
    poly(g, [[6, 12], [60, 16], [6, 20]], 'rgba(255,200,80,0.8)', null);
  }),

  // --- lights & glows (white, tint in-game)
  glow: () => art(128, 128, (g) => radial(g, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]), 1),
  light: () => art(256, 256, (g) => radial(g, 128, 128, 128, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.75)'], [0.8, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]), 1),
  flashlight: () => art(512, 256, (g) => {
    // cone pointing +X from (0,128); radial falloff, soft edges
    const grd = g.createRadialGradient(0, 128, 0, 0, 128, 512);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    for (let i = 0; i < 10; i++) {
      const spread = 0.08 + i * 0.035;
      g.globalAlpha = 0.16;
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, 128);
      g.arc(0, 128, 512, -spread, spread);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  }, 1),

  // --- particles
  dot: () => art(10, 10, (g) => circle(g, 5, 5, 4, '#ffffff', null)),
  soft: () => art(32, 32, (g) => radial(g, 16, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]), 2),
  spark: () => art(24, 6, (g) => {
    const gr = g.createLinearGradient(0, 0, 24, 0);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(0.5, 'rgba(255,230,140,0.9)'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.beginPath(); g.ellipse(12, 3, 12, 2.2, 0, 0, Math.PI * 2); g.fill();
  }),
  tracer: () => art(128, 8, (g) => {
    const gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(64, 4, 64, 2.6, 0, 0, Math.PI * 2); g.fill();
  }),
  smoke: () => art(64, 64, (g) => {
    const r = rng(5);
    for (let i = 0; i < 7; i++) radial(g, 20 + r() * 24, 20 + r() * 24, 14 + r() * 10, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  }),
  fire: () => art(48, 48, (g) => radial(g, 24, 24, 24, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,220,120,0.9)'], [0.65, 'rgba(255,120,30,0.5)'], [1, 'rgba(200,40,0,0)']])),
  ring: () => art(128, 128, (g) => {
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 6;
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 12;
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  }),
  // --- gore & debris (Kenney flat style)
  blood_drop: () => art(10, 10, (g) => circle(g, 5, 5, 4, '#b3161b', '#7c0c10', 1)),
  feather_0: () => art(18, 9, (g) => {
    ellipse(g, 9, 4.5, 8, 3.4, '#ffffff', '#c9c0aa', 1.2);
    line(g, 1, 4.5, 15, 4.5, '#c9c0aa', 0.9);
  }),
  feather_1: () => art(14, 8, (g) => {
    poly(g, [[1, 4], [6, 1], [13, 3], [12, 5], [6, 7]], '#ffffff', '#c9c0aa', 1.1);
  }),
  casing: () => art(8, 4, (g) => box(g, 0.5, 0.5, 7, 3, 1, '#e3b54e', '#8c6a1f', 0.8)),
  shell: () => art(11, 5, (g) => {
    box(g, 0.5, 0.5, 10, 4, 1.2, '#c0392b', '#7d2219', 0.8);
    box(g, 7, 0.5, 3.5, 4, 0.8, '#e3b54e', '#8c6a1f', 0.8);
  }),
  paper: () => art(10, 12, (g) => { box(g, 1, 1, 8, 10, 0.5, '#fbfbfb', '#b8b8b8', 0.8); line(g, 2.5, 4, 7.5, 4, '#9ab', 0.7); line(g, 2.5, 6.5, 6.5, 6.5, '#9ab', 0.7); }),
  shard: () => art(10, 8, (g) => poly(g, [[1, 6], [5, 1], [9, 4], [6, 7]], 'rgba(200,235,255,0.9)', '#7fb3c9', 0.8)),
  chunk: () => art(8, 8, (g) => poly(g, [[1, 5], [3, 1], [7, 2], [6, 7]], '#8a8a8a', '#555', 0.8)),
  gib_leg: () => art(22, 12, (g) => {
    line(g, 4, 6, 14, 6, '#f2b134', 3);
    for (const t of [-0.6, 0, 0.6]) line(g, 14, 6, 14 + Math.cos(t) * 6, 6 + Math.sin(t) * 6, '#b97d17', 1.6);
    ellipse(g, 5, 6, 5, 4, '#f7f3ea', '#b8ae98', 1.2);
  }),
  gib_badge: () => art(12, 14, (g) => {
    box(g, 1, 2, 10, 11, 1.5, '#ffffff', '#9aa7b0', 1.1);
    g.fillStyle = '#2e86c1'; g.fillRect(2, 3, 8, 3);
    g.fillStyle = '#9aa7b0'; g.fillRect(3, 8, 6, 1); g.fillRect(3, 10, 4, 1);
  }),
  // projectiles
  grenade: () => art(14, 14, (g) => { circle(g, 7, 7, 5.5, '#5d6b3a', '#38401f', 1.4); box(g, 4, 5.5, 6, 3, 1, '#e86a17', null); }),
  spit: () => art(18, 18, (g) => {
    radial(g, 9, 9, 9, [[0, 'rgba(220,255,140,1)'], [0.6, 'rgba(140,220,40,0.9)'], [1, 'rgba(90,160,20,0)']]);
    circle(g, 9, 9, 4.5, '#b6f04a', '#5a9a12', 1.2);
  }),
  // decals (drawn into the persistent decal layer)
  splat_0: () => splat(1, 64, '#9b1418'),
  splat_1: () => splat(2, 64, '#9b1418'),
  splat_2: () => splat(3, 48, '#9b1418'),
  splat_3: () => splat(4, 80, '#8d1216'),
  goo_0: () => splat(5, 56, '#7fc31c'),
  scorch: () => art(128, 128, (g) => {
    const r = rng(11);
    radial(g, 64, 64, 60, [[0, 'rgba(20,16,12,0.85)'], [0.6, 'rgba(30,24,18,0.5)'], [1, 'rgba(30,24,18,0)']]);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 30 + r() * 26; radial(g, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 8 + r() * 8, [[0, 'rgba(20,16,12,0.5)'], [1, 'rgba(20,16,12,0)']]); }
  }),
  bullet_hole: () => art(10, 10, (g) => { circle(g, 5, 5, 3, '#222', null); circle(g, 5, 5, 4.2, 'rgba(0,0,0,0.25)', null); }),
  // ui-ish world sprites
  crosshair: () => art(40, 40, (g) => {
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 5;
    g.beginPath(); g.arc(20, 20, 11, 0, Math.PI * 2); g.stroke();
    for (const [a, b, c, d] of [[20, 2, 20, 10], [20, 30, 20, 38], [2, 20, 10, 20], [30, 20, 38, 20]]) line(g, a, b, c, d, 'rgba(0,0,0,0.55)', 5);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(20, 20, 11, 0, Math.PI * 2); g.stroke();
    for (const [a, b, c, d] of [[20, 2, 20, 10], [20, 30, 20, 38], [2, 20, 10, 20], [30, 20, 38, 20]]) line(g, a, b, c, d, '#ffffff', 2.4);
    circle(g, 20, 20, 1.8, '#ff4d4d', null);
  }),
  ring_player: () => art(64, 64, (g) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(32, 32, 27, 0, Math.PI * 2); g.stroke();
  }),
  arrow: () => art(28, 28, (g) => poly(g, [[4, 6], [26, 14], [4, 22], [9, 14]], '#ffffff', 'rgba(0,0,0,0.5)', 2)),
};

function splat(seed, size, col) {
  return art(size, size, (g) => {
    const r = rng(seed * 97);
    const c = size / 2;
    g.fillStyle = col;
    // main blob from overlapping circles
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = r() * size * 0.18;
      g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, size * (0.1 + r() * 0.12), 0, 6.28); g.fill();
    }
    // droplets thrown outward
    for (let i = 0; i < 12; i++) {
      const a = r() * 6.28, d = size * (0.25 + r() * 0.22);
      g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 0.8 + r() * size * 0.035, 0, 6.28); g.fill();
    }
    // darker centre for depth
    g.fillStyle = shade(col, 0.75);
    g.beginPath(); g.arc(c, c, size * 0.1, 0, 6.28); g.fill();
  });
}
