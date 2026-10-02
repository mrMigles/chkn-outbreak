// Chicken-people and helper character parts, drawn in the Kenney top-down style:
// flat fills, darker same-hue outline, soft round shadow, facing +X (right).
import { art, PAL, shade, box, circle, ellipse, poly, line, rng } from './lib.mjs';

/**
 * Chicken-person variants.
 *  scale     overall size multiplier
 *  shirt     torso colour
 *  head      head feather colour
 *  comb      comb size (0 = none)
 *  acc       accessory: badge | tie | helmet | hazmat | glasses | crown | hoodie
 */
export const CHICKENS = {
  normal_a: { scale: 1.0, shirt: '#6fa8dc', head: PAL.feather, comb: 1, acc: 'badge' },
  normal_b: { scale: 1.0, shirt: '#e9e4d8', head: PAL.feather, comb: 1, acc: 'tie', tie: '#c0392b' },
  normal_c: { scale: 1.0, shirt: '#e58fa8', head: '#f3e2c4', comb: 1, acc: 'badge' },
  fast: { scale: 0.86, shirt: '#3fae6a', head: '#ffd84a', comb: 0.35, acc: 'hoodie', beakBig: true },
  fat: { scale: 1.3, shirt: '#7a5236', head: PAL.feather, comb: 1.2, acc: 'tie', tie: '#2e86c1', wide: 1.25 },
  spitter: { scale: 1.0, shirt: '#8e5fb3', head: '#d6efb4', comb: 0.8, acc: 'glasses', drool: true },
  armored: { scale: 1.12, shirt: '#3c4a5e', head: PAL.feather, comb: 0, acc: 'helmet', vest: true },
  exploder: { scale: 1.12, shirt: '#f2d03b', head: '#f6c1a8', comb: 1, acc: 'hazmat', tank: true, wide: 1.12 },
  // player chickens: tinted per slot in-game; shirt is a neutral light grey so tint reads well
  player: { scale: 1.12, shirt: '#e6e6e6', head: '#e9b04a', comb: 1.4, acc: 'none', rooster: true, armed: true },
};

function hands(g, s, pose, frame, color, dark) {
  // hand positions relative to centre, facing +x
  let L, R;
  if (pose === 'armed') { L = null; R = null; }
  else if (pose === 'attack') { L = [19, -9]; R = [19, 9]; }
  else if (pose === 'dead') { L = [2, -22]; R = [-4, 21]; }
  else {
    const sw = [0, 4, 0, -4][frame % 4];
    L = [11 + sw, -14]; R = [11 - sw, 14];
  }
  for (const p of [L, R]) {
    if (!p) continue;
    // claw: round hand with 3 little talons
    const [x, y] = [p[0] * s, p[1] * s];
    for (const t of [-0.6, 0, 0.6]) {
      line(g, x, y, x + Math.cos(t) * 6 * s, y + Math.sin(t) * 6 * s, dark, 2.2 * s);
    }
    circle(g, x, y, 4.2 * s, color, dark, 1.6 * s);
  }
}

export function drawChicken(def, pose = 'walk', frame = 0) {
  const s = def.scale;
  const size = Math.ceil(56 * s / 2) * 2 + 8;
  const W = size, H = size;
  return art(W, H, (g) => {
    const r = rng(77 + frame);
    g.translate(W / 2, H / 2);
    if (pose === 'dead') g.rotate(0.35);
    const wide = def.wide || 1;
    // soft shadow (like Kenney characters)
    g.fillStyle = PAL.shadow;
    g.beginPath(); g.arc(0, 0, 23 * s * Math.max(1, wide * 0.92), 0, Math.PI * 2); g.fill();

    // back tank (exploder) – drawn under the torso
    if (def.tank) {
      box(g, -20 * s, -9 * s, 12 * s, 18 * s, 5 * s, '#5fd35f', '#2f8a2f', 2 * s);
      box(g, -18 * s, -5 * s, 4 * s, 10 * s, 2 * s, '#b8ffb0', null);
    }
    hands(g, s, pose, frame, PAL.claw, PAL.clawDark);

    // torso / shoulders
    const tw = 21 * s, th = 39 * s * wide;
    box(g, -12 * s, -th / 2, tw, th, 10 * s, def.shirt, shade(def.shirt, 0.7), 2 * s);
    // shoulder seams
    g.strokeStyle = shade(def.shirt, 0.82); g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(-6 * s, -th / 2 + 6 * s); g.lineTo(4 * s, -th / 2 + 6 * s); g.stroke();
    g.beginPath(); g.moveTo(-6 * s, th / 2 - 6 * s); g.lineTo(4 * s, th / 2 - 6 * s); g.stroke();

    if (def.acc === 'hoodie') {
      // hood bunched behind the head
      ellipse(g, -9 * s, 0, 8 * s, 12 * s, shade(def.shirt, 0.85), shade(def.shirt, 0.65), 2 * s);
    }
    if (def.vest) {
      box(g, -10 * s, -th / 2 + 3 * s, 17 * s, th - 6 * s, 7 * s, '#2a3442', '#1a2029', 2 * s);
      for (const yy of [-10, 0, 10]) box(g, -6 * s, (yy - 3) * s, 10 * s, 6 * s, 2 * s, '#56657a', '#2a3442', 1.2 * s);
    }
    if (def.acc === 'hazmat') {
      // hazmat stripes
      g.fillStyle = '#2b2b2b';
      for (const yy of [-th / 2 + 5 * s, th / 2 - 8 * s]) g.fillRect(-8 * s, yy, 14 * s, 3 * s);
    }
    if (def.acc === 'tie') {
      poly(g, [[6 * s, -2 * s], [12 * s, 0], [6 * s, 2 * s]], def.tie, shade(def.tie, 0.7), 1.2 * s);
    }
    if (def.acc === 'badge') {
      // corporate badge clipped to the chest
      box(g, 2 * s, 7 * s, 7 * s, 9 * s, 1.5 * s, '#ffffff', '#9aa7b0', 1.2 * s);
      g.fillStyle = '#2e86c1'; g.fillRect(2.8 * s, 8 * s, 5.4 * s, 2.2 * s);
      g.fillStyle = '#9aa7b0'; g.fillRect(3.5 * s, 12 * s, 4 * s, 1 * s); g.fillRect(3.5 * s, 13.8 * s, 3 * s, 1 * s);
    }
    // feather tufts bursting out of shoulders (infection!)
    const tuft = (x, y, a) => {
      for (let i = -1; i <= 1; i++) {
        const aa = a + i * 0.45;
        poly(g, [[x, y], [x + Math.cos(aa - 0.25) * 5.5 * s, y + Math.sin(aa - 0.25) * 5.5 * s], [x + Math.cos(aa) * 7.5 * s, y + Math.sin(aa) * 7.5 * s], [x + Math.cos(aa + 0.25) * 5.5 * s, y + Math.sin(aa + 0.25) * 5.5 * s]],
          def.rooster ? '#f3e6c8' : def.head, PAL.featherOutline, 1.2 * s);
      }
    };
    if (!def.vest && def.acc !== 'hazmat') {
      tuft(-7 * s, -th / 2 + 3 * s, -Math.PI / 2 - 0.5);
      tuft(-7 * s, th / 2 - 3 * s, Math.PI / 2 + 0.5);
    }

    // head
    const hr = (def.rooster ? 12.5 : 11.5) * s;
    const hx = 2 * s;
    // beak (under head edge)
    const bl = (def.beakBig ? 13 : 11) * s;
    const beakOpen = pose === 'attack' || pose === 'dead' || def.drool;
    if (beakOpen) {
      poly(g, [[hx + hr - 3 * s, -5 * s], [hx + hr + bl, -3.5 * s], [hx + hr - 1 * s, -0.5 * s]], PAL.beak, PAL.beakDark, 1.6 * s);
      poly(g, [[hx + hr - 3 * s, 5 * s], [hx + hr + bl, 3.5 * s], [hx + hr - 1 * s, 0.5 * s]], PAL.beak, PAL.beakDark, 1.6 * s);
      if (def.drool) circle(g, hx + hr + bl - 1 * s, 0, 2.6 * s, '#9be22e', '#5a9a12', 1.2 * s);
    } else {
      poly(g, [[hx + hr - 4 * s, -5.5 * s], [hx + hr + bl, 0], [hx + hr - 4 * s, 5.5 * s]], PAL.beak, PAL.beakDark, 1.6 * s);
      line(g, hx + hr - 1 * s, 0, hx + hr + bl * 0.6, 0, PAL.beakDark, 1 * s);
    }
    const headCol = def.head;
    circle(g, hx, 0, hr, headCol, def.rooster ? shade(headCol, 0.7) : PAL.featherOutline, 2 * s);
    // feather texture
    g.strokeStyle = def.rooster ? shade(headCol, 0.82) : PAL.featherShade; g.lineWidth = 1.3 * s;
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2, d = r() * hr * 0.55;
      g.beginPath(); g.arc(hx + Math.cos(a) * d, Math.sin(a) * d, 3 * s, a, a + 1.6); g.stroke();
    }
    if (def.rooster) {
      // rooster neck feathers fan
      for (const yy of [-1, 1]) poly(g, [[hx - 6 * s, yy * 7 * s], [hx - 16 * s, yy * 13 * s], [hx - 4 * s, yy * 11 * s]], '#a8452a', '#6e2a17', 1.4 * s);
    }

    if (def.acc === 'helmet') {
      // riot helmet covering the head, visor at front
      circle(g, hx - 1 * s, 0, hr + 1.5 * s, '#56657a', '#2a3442', 2 * s);
      g.strokeStyle = '#8fa3bd'; g.lineWidth = 2 * s;
      g.beginPath(); g.arc(hx - 1 * s, 0, hr - 2 * s, -0.9, 0.9); g.stroke();
      box(g, hx - 10 * s, -2 * s, 12 * s, 4 * s, 2 * s, '#ffffff', '#9aa7b0', 1 * s); // "ОХРАНА" stripe
    } else if (def.acc === 'hazmat') {
      g.strokeStyle = '#d4b222'; g.lineWidth = 4 * s;
      g.beginPath(); g.arc(hx, 0, hr + 1 * s, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
    }

    // comb ridge along the head's midline
    if (def.comb > 0) {
      const c = def.comb;
      const bumps = def.rooster ? [-9, -4.5, 0, 4.5] : [-6, -2, 2];
      for (const bx of bumps) ellipse(g, hx + bx * s, 0, 3.3 * s * c, 2.2 * s * Math.min(c, 1.2), PAL.comb, PAL.combDark, 1.2 * s);
    }
    // eyes on the sides of the head: infected = red
    const eyeX = hx + hr * 0.45;
    for (const ey of [-1, 1]) {
      if (pose === 'dead') {
        line(g, eyeX - 2 * s, ey * hr * 0.62 - 2 * s, eyeX + 2 * s, ey * hr * 0.62 + 2 * s, '#222', 1.4 * s);
        line(g, eyeX + 2 * s, ey * hr * 0.62 - 2 * s, eyeX - 2 * s, ey * hr * 0.62 + 2 * s, '#222', 1.4 * s);
      } else {
        circle(g, eyeX, ey * hr * 0.62, 2.0 * s, '#ff3b30', '#7a0d08', 0.9 * s);
        circle(g, eyeX + 0.5 * s, ey * hr * 0.62 - 0.5 * s, 0.7 * s, '#ffffff', null);
      }
    }
    if (def.acc === 'glasses') {
      g.strokeStyle = '#222'; g.lineWidth = 1.4 * s;
      for (const ey of [-1, 1]) { g.beginPath(); g.arc(eyeX, ey * hr * 0.62, 3.6 * s, 0, Math.PI * 2); g.stroke(); }
    }
  });
}

/** Giant boss: "Генеральный Петух" – the CEO turned into a colossal rooster. */
export function drawBoss(pose = 'walk', frame = 0) {
  const def = { scale: 3.1, shirt: '#1f2a3a', head: '#d0532b', comb: 1.4, acc: 'tie', tie: '#d4af37', rooster: true, wide: 1.15 };
  const base = drawChicken(def, pose === 'armed' ? 'armed' : pose, frame);
  return base;
}

/** Hand/glove sprite used together with weapon sprites. */
export function drawHand(kind) {
  const cols = {
    glove: ['#3a3d40', '#1f2124'],
    skin: [PAL.skin, PAL.skinDark],
    skin2: ['#e0a56f', '#a8743f'],
    skin3: ['#8d5a3b', '#5e3a24'],
    claw: [PAL.claw, PAL.clawDark],
  }[kind];
  return art(12, 12, (g) => {
    if (kind === 'claw') {
      for (const t of [-0.6, 0, 0.6]) line(g, 6, 6, 6 + Math.cos(t) * 5.5, 6 + Math.sin(t) * 5.5, cols[1], 2);
    }
    circle(g, 6, 6, 4.2, cols[0], cols[1], 1.6);
  });
}

/** Generic flat egg used for hatching pods, spitter/boss projectiles. */
export function drawEgg(w = 14, h = 18, col = '#fbf6e9') {
  return art(w + 4, h + 4, (g) => {
    ellipse(g, (w + 4) / 2, (h + 4) / 2, w / 2, h / 2, col, shade(col, 0.75), 1.5);
    ellipse(g, (w + 4) / 2 - w * 0.15, (h + 4) / 2 - h * 0.18, w * 0.15, h * 0.15, '#ffffff', null);
  });
}
