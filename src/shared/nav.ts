// Flow field navigation on a half-tile grid. One Dijkstra from all targets, every enemy just
// walks downhill — cheap enough for hundreds of chickens.
import { GameMap, TILE } from './map';

export const NAV = TILE / 2;

export class FlowField {
  w: number; h: number;
  blocked: Uint8Array;
  dist: Float32Array;
  private heap: Int32Array;
  private heapV: Float32Array;
  private map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
    this.w = map.w * 2; this.h = map.h * 2;
    this.blocked = new Uint8Array(this.w * this.h);
    this.dist = new Float32Array(this.w * this.h).fill(Infinity);
    // each cell can be pushed once per neighbour (8) — size the heap accordingly
    this.heap = new Int32Array(this.w * this.h * 9 + 16);
    this.heapV = new Float32Array(this.w * this.h * 9 + 16);
    this.rebuildBlocked();
  }

  rebuildBlocked() {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const px = (x + 0.5) * NAV, py = (y + 0.5) * NAV;
      this.blocked[y * this.w + x] = this.map.blockedAt(px, py, 6, true) ? 1 : 0;
    }
  }

  cellOf(px: number, py: number) {
    const x = Math.floor(px / NAV), y = Math.floor(py / NAV);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  /** Dijkstra from target points, limited to maxDist (px). */
  compute(targets: { x: number; y: number }[], maxDist = 9000) {
    const { w, h, dist, blocked } = this;
    dist.fill(Infinity);
    const heapIdx = this.heap;
    const heapVal = this.heapV;
    let n = 0;
    const push = (i: number, d: number) => {
      let k = n++;
      heapIdx[k] = i; heapVal[k] = d;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapVal[p] <= heapVal[k]) break;
        [heapIdx[p], heapIdx[k]] = [heapIdx[k], heapIdx[p]];
        [heapVal[p], heapVal[k]] = [heapVal[k], heapVal[p]];
        k = p;
      }
    };
    const pop = () => {
      const i = heapIdx[0], d = heapVal[0];
      n--;
      heapIdx[0] = heapIdx[n]; heapVal[0] = heapVal[n];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < n && heapVal[l] < heapVal[m]) m = l;
        if (r < n && heapVal[r] < heapVal[m]) m = r;
        if (m === k) break;
        [heapIdx[m], heapIdx[k]] = [heapIdx[k], heapIdx[m]];
        [heapVal[m], heapVal[k]] = [heapVal[k], heapVal[m]];
        k = m;
      }
      return [i, d];
    };
    for (const t of targets) {
      const c = this.cellOf(t.x, t.y);
      if (c >= 0) { dist[c] = 0; push(c, 0); }
    }
    const maxCells = maxDist / NAV;
    while (n > 0) {
      const [i, d] = pop();
      if (d > dist[i] || d > maxCells) continue;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (blocked[ni]) continue;
        if (dx && dy && (blocked[y * w + nx] || blocked[ny * w + x])) continue; // no corner cutting
        const nd = d + (dx && dy ? 1.4142 : 1);
        if (nd < dist[ni]) { dist[ni] = nd; push(ni, nd); }
      }
    }
  }

  /** Direction (unit) downhill from a world position, or null if unreachable. */
  dirAt(px: number, py: number): [number, number] | null {
    const c = this.cellOf(px, py);
    if (c < 0) return null;
    const x = c % this.w, y = (c / this.w) | 0;
    let best = this.dist[c], bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
      if (dx && dy && (this.blocked[y * this.w + nx] || this.blocked[ny * this.w + x])) continue;
      const d = this.dist[ny * this.w + nx];
      if (d < best) { best = d; bx = dx; by = dy; }
    }
    if (best === Infinity) return null;
    if (!bx && !by) return null;
    // steer towards the centre of the chosen cell (smooths movement around corners)
    const tx = (x + bx + 0.5) * NAV - px, ty = (y + by + 0.5) * NAV - py;
    const l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  }

  distAt(px: number, py: number) {
    const c = this.cellOf(px, py);
    return c < 0 ? Infinity : this.dist[c] * NAV;
  }
}
