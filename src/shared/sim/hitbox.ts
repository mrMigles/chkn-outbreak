// 2.5D hit boxes. Bodies stand up from their feet; a shot is a ray at hand height (HAND_H above the floor).
// Drawn on screen, a bullet at hand height crosses the sprite of everything whose visible body it passes over,
// so the test is done in "screen space": the ray starts at the shooter's feet (same direction as on screen)
// and every body is a vertical box shifted down by HAND_H. The head is the top part of that box.
import type { EnemyType } from '../enemies';
import { ENEMIES } from '../enemies';

/** Height of the gun above the feet (world units). Mirrors the client's hand placement. */
export const HAND_H = 36;
/** Display scale per enemy type (LPC 64-px frames). */
export const ENEMY_SCALE: Record<EnemyType, number> = { normal: 2, fast: 1.85, fat: 2.35, spitter: 2, armored: 2.15, exploder: 2, chick: 1.6, boss: 3.4 };

export interface BodyBox { hw: number; h: number; head: number }

/** Humans (players, NPCs): LPC body ×2, head top ≈ 100 above the feet. */
export const HUMAN_BOX: BodyBox = { hw: 17, h: 100, head: 30 };

export function enemyBox(t: EnemyType): BodyBox {
  if (t === 'chick') return { hw: 15, h: 30, head: 0 };
  const s = ENEMY_SCALE[t];
  const h = 51 * s; // feet (row 62) to the comb (row ~11)
  return { hw: Math.max(ENEMIES[t].radius + 3, s * 10), h, head: h * 0.3 };
}

/** Slab test: entry distance of the ray into [x0,x1]×[y0,y1] within maxT, or -1. */
function slab(x: number, y: number, dx: number, dy: number, x0: number, x1: number, y0: number, y1: number, maxT: number) {
  let t0 = 0, t1 = maxT;
  if (Math.abs(dx) < 1e-9) { if (x < x0 || x > x1) return -1; }
  else {
    let a = (x0 - x) / dx, b = (x1 - x) / dx;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (Math.abs(dy) < 1e-9) { if (y < y0 || y > y1) return -1; }
  else {
    let a = (y0 - y) / dy, b = (y1 - y) / dy;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t0 <= t1 ? t0 : -1;
}

/** Ray from the shooter's feet (x,y) along (dx,dy) vs. a body standing at (bx,by). */
export function rayBody(x: number, y: number, dx: number, dy: number, bx: number, by: number, box: BodyBox, maxT: number): { t: number; head: boolean } | null {
  // bodies behind the shooter never catch the shot (the hand may overlap a sprite standing right behind)
  if ((bx - x) * dx + (by - y) * dy < -box.hw) return null;
  const top = by - box.h + HAND_H, bottom = by + HAND_H;
  const t = slab(x, y, dx, dy, bx - box.hw, bx + box.hw, top, bottom, maxT);
  if (t < 0) return null;
  const head = box.head > 0 && slab(x, y, dx, dy, bx - box.hw * 0.75, bx + box.hw * 0.75, top, top + box.head, maxT) >= 0;
  return { t, head };
}
