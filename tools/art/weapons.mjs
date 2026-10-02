// Weapon sprites (top-down, pointing +X). Each returns {canvas, meta}
// meta: gripX (pivot, px from left), muzzle (px from grip), hands [[x,y],..] relative to grip.
import { art, PAL, shade, box, circle, poly, line } from './lib.mjs';

const D = PAL.gunDark, M = PAL.gunMid, L = PAL.gunLight, O = PAL.gunOutline;
const WOOD = '#9a6236', OLIVE = '#5d6b3a';

function gun(w, h, gripX, muzzle, hands, draw) {
  const canvas = art(w, h, (g) => { g.translate(0, h / 2); draw(g); });
  return { canvas, meta: { gripX, muzzle, hands, w, h } };
}

export const WEAPON_ART = {
  pistol: () => gun(26, 12, 5, 18, [[3, 0], [7, -1]], (g) => {
    box(g, 3, -3.5, 17, 7, 2, D, O, 1.5);
    box(g, 5, -1.5, 13, 3, 1, L, null);
    box(g, 19, -2, 4, 4, 1, M, O, 1.2);
  }),
  smg: () => gun(36, 16, 8, 26, [[0, 2], [14, -1]], (g) => {
    box(g, 1, -2.5, 7, 5, 2, M, O, 1.4);              // folded stock
    box(g, 6, -4.5, 20, 9, 2.5, D, O, 1.6);           // receiver
    box(g, 12, 3, 5, 6, 1, M, O, 1.2);                // magazine stub
    box(g, 25, -2.5, 9, 5, 1.5, '#2c2f33', O, 1.4);   // suppressor
    box(g, 9, -1.5, 13, 3, 1, L, null);
  }),
  rifle: () => gun(48, 16, 14, 32, [[0, 2], [20, -1]], (g) => {
    box(g, 1, -3.5, 12, 7, 2.5, '#6b5a43', '#3b3125', 1.5);   // stock
    box(g, 11, -4.5, 22, 9, 2, D, O, 1.6);                    // receiver
    box(g, 14, -2.5, 12, 5, 2, '#2b2e31', O, 1.2);            // scope body
    circle(g, 25.5, 0, 2.6, '#7ec8ff', O, 1.2);               // scope lens
    box(g, 32, -2, 14, 4, 1, M, O, 1.3);                      // barrel
    box(g, 44, -3, 3, 6, 1, D, O, 1.1);                       // muzzle brake
  }),
  shotgun: () => gun(46, 16, 14, 30, [[0, 2], [17, 0]], (g) => {
    box(g, 1, -4, 14, 8, 3, WOOD, shade(WOOD, 0.62), 1.5);    // stock
    box(g, 13, -4.5, 10, 9, 2, D, O, 1.6);                    // receiver
    box(g, 22, -5, 22, 4.6, 2, M, O, 1.3);                    // barrel 1
    box(g, 22, 0.4, 22, 4.6, 2, M, O, 1.3);                   // barrel 2
    box(g, 27, -6, 9, 12, 3, WOOD, shade(WOOD, 0.62), 1.4);   // pump
    for (const x of [29, 31.5, 34]) line(g, x, -4.5, x, 4.5, shade(WOOD, 0.7), 1);
  }),
  machinegun: () => gun(58, 24, 14, 42, [[0, 2], [22, -3]], (g) => {
    box(g, 1, -4, 11, 8, 3, M, O, 1.5);                       // stock
    box(g, 10, -6, 28, 12, 3, D, O, 1.8);                     // body
    box(g, 16, 5, 12, 8, 1.5, OLIVE, shade(OLIVE, 0.6), 1.5); // ammo box
    for (let i = 0; i < 4; i++) box(g, 27 + i * 2.2, 2.5, 2, 3.5, 0.6, '#d4a542', '#8c6a1f', 0.8); // belt
    box(g, 38, -3.5, 18, 7, 2, M, O, 1.4);                    // heat shield
    for (const x of [41, 45, 49, 53]) circle(g, x, 0, 1.2, '#1f2124', null);
    box(g, 16, -2, 18, 4, 1, L, null);                        // top rail
  }),
  grenade: () => gun(46, 22, 12, 32, [[0, 2], [20, -1]], (g) => {
    box(g, 1, -4, 11, 8, 3, M, O, 1.5);
    box(g, 9, -5, 10, 10, 2, D, O, 1.6);
    circle(g, 21, 0, 9, OLIVE, shade(OLIVE, 0.6), 1.8);       // revolver drum
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; circle(g, 21 + Math.cos(a) * 5, Math.sin(a) * 5, 1.7, '#2c331d', null); }
    box(g, 27, -5.5, 17, 11, 3, D, O, 1.7);                   // tube
    box(g, 40, -6, 4, 12, 1.5, '#e86a17', '#a64a0f', 1.2);    // orange safety ring
  }),
  flamethrower: () => gun(52, 26, 12, 38, [[0, 2], [20, -1]], (g) => {
    box(g, 1, -3.5, 10, 7, 3, M, O, 1.5);
    box(g, 9, -4.5, 22, 9, 2.5, D, O, 1.6);
    box(g, 11, 4, 17, 8.5, 4, '#c0392b', '#7d2219', 1.6);     // fuel tank
    box(g, 13, 5.5, 10, 2.2, 1, '#ef7a6d', null);
    box(g, 30, -2.6, 14, 5.2, 1.5, M, O, 1.3);                // nozzle tube
    poly(g, [[43, -3.5], [50, -5.5], [50, 5.5], [43, 3.5]], L, O, 1.3); // flared tip
    circle(g, 51, 0, 1.6, '#69b7ff', null);                   // pilot light
  }),
};

/** Small pickups icons in matching style. */
export const PICKUP_ART = {
  ammo: () => art(30, 24, (g) => {
    box(g, 2, 3, 26, 18, 3, OLIVE, shade(OLIVE, 0.6), 2);
    box(g, 4, 5, 22, 4, 1.5, shade(OLIVE, 1.25), null);
    for (let i = 0; i < 4; i++) { box(g, 7 + i * 5, 11, 3.5, 8, 1.5, '#d4a542', '#8c6a1f', 1); }
  }),
  health: () => art(28, 24, (g) => {
    box(g, 2, 3, 24, 18, 3, '#f4f4f4', '#b5b5b5', 2);
    box(g, 11, 6, 6, 12, 1, '#e0332f', null);
    box(g, 8, 9, 12, 6, 1, '#e0332f', null);
  }),
  armor: () => art(28, 28, (g) => {
    poly(g, [[6, 4], [11, 2], [14, 6], [17, 2], [22, 4], [24, 25], [4, 25]], '#2e5c8a', '#1b3a59', 2);
    box(g, 9, 11, 10, 9, 2, '#4c86bd', null);
  }),
  keycard: () => art(24, 18, (g) => {
    box(g, 2, 2, 20, 14, 2.5, '#ffd84a', '#b8941c', 1.6);
    box(g, 4, 5, 6, 8, 1, '#ffffff', null);
    box(g, 12, 6, 8, 2, 1, '#8a6d10', null);
    box(g, 12, 10, 6, 2, 1, '#8a6d10', null);
  }),
  antidote: () => art(20, 28, (g) => {
    box(g, 4, 6, 12, 20, 4, '#7ef0ff', '#2c8fa0', 1.8);
    box(g, 6, 2, 8, 5, 1.5, '#d9d9d9', '#888', 1.2);
    box(g, 6, 14, 8, 9, 2, '#b8fbff', null);
  }),
};
