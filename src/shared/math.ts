export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by));

/** Shortest signed difference b - a in (-PI, PI]. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}
export function lerpAngle(a: number, b: number, t: number) {
  return a + angleDiff(a, b) * t;
}

/** Small fast seeded PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed = 1234567) { this.s = seed >>> 0; }
  get state() { return this.s >>> 0; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p: number) { return this.next() < p; }
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
