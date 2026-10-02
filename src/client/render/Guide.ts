// Objective guide: an arrow at the player's feet pointing along the walkable path to the current objective
// (not through walls), and a bouncing marker over the target when it is on screen.
import Phaser from 'phaser';
import { FlowField, NAV } from '../../shared/nav';
import type { GameMap } from '../../shared/map';
import type { WorldView } from '../../shared/sim/types';

export class Guide {
  private flow: FlowField;
  private g: Phaser.GameObjects.Graphics;
  private key = '';
  private recalcT = 0;
  private target: { x: number; y: number } | null = null;
  private angle = 0;
  private shown = 0;

  constructor(scene: Phaser.Scene, private map: GameMap) {
    this.flow = new FlowField(map);
    this.g = scene.add.graphics().setDepth(38);
  }

  /** Nav cells whose centres lie inside a door. */
  private doorCells(d: { x: number; y: number; w: number; h: number }, fn: (c: number) => void) {
    for (let y = Math.floor(d.y / NAV); y < Math.ceil((d.y + d.h) / NAV); y++) for (let x = Math.floor(d.x / NAV); x < Math.ceil((d.x + d.w) / NAV); x++) {
      if (x >= 0 && y >= 0 && x < this.flow.w && y < this.flow.h) fn(y * this.flow.w + x);
    }
  }

  /** The player's own cell may count as blocked (hugging a wall): use the best free neighbour. */
  private startCell(px: number, py: number) {
    const c0 = this.flow.cellOf(px, py);
    if (c0 < 0) return null;
    let best = -1, bd = Infinity;
    const x0 = c0 % this.flow.w, y0 = Math.floor(c0 / this.flow.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= this.flow.w || y >= this.flow.h) continue;
      const d = this.flow.dist[y * this.flow.w + x] + (dx || dy ? 0.5 : 0);
      if (d < bd) { bd = d; best = y * this.flow.w + x; }
    }
    return Number.isFinite(bd) ? { x: (best % this.flow.w + 0.5) * NAV, y: (Math.floor(best / this.flow.w) + 0.5) * NAV, own: best === c0 } : null;
  }

  /** Resolves objective target names to the nearest live position (NPCs move, map objects don't). */
  private resolve(v: WorldView, px: number, py: number) {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const t of v.objectiveTarget) {
      let p: { x: number; y: number } | null = null;
      if (t.startsWith('@')) { const [x, y] = t.slice(1).split(',').map(Number); p = { x, y }; }
      else {
        const n = v.npcs.find((q) => q.id === t && q.mode !== 'dead' && q.mode !== 'gone');
        if (n) p = { x: n.x, y: n.y };
        else {
          // a name may be shared (the elevator door and the elevator trigger): the actionable object wins
          const o = ['use', 'trigger', 'npc', 'door'].map((type) => this.map.objects.find((q) => q.name === t && q.type === type)).find(Boolean);
          if (o) p = { x: o.cx, y: o.cy };
        }
      }
      if (!p) continue;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Last arrow direction/distance for the HUD (null = no target). */
  hud: { angle: number; metres: number } | null = null;

  update(dt: number, v: WorldView, px: number, py: number, time: number, cam: Phaser.Cameras.Scene2D.Camera) {
    const g = this.g.clear();
    this.recalcT -= dt;
    const target = this.resolve(v, px, py);
    const doorsKey = v.doors.map((d) => (d.open ? 'o' : d.locked ? 'l' : 'c')).join('');
    const key = (target ? `${Math.round(target.x / NAV)},${Math.round(target.y / NAV)}` : '') + doorsKey;
    if (target && (key !== this.key || this.recalcT <= 0)) {
      this.key = key; this.recalcT = 1.5;
      this.flow.rebuildBlocked();
      // locked doors block the guide; closed unlocked ones are passable
      for (const d of v.doors) {
        if (d.locked && !d.open) this.doorCells(d, (c) => { this.flow.blocked[c] = 1; });
      }
      // the target itself may stand inside a prop (terminal, NPC behind a desk): seed from free cells around it
      const seeds: { x: number; y: number }[] = [];
      for (let r = 0; r <= 3 && !seeds.length; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = target.x + dx * NAV, y = target.y + dy * NAV, c = this.flow.cellOf(x, y);
        if (c >= 0 && !this.flow.blocked[c]) seeds.push({ x, y });
      }
      this.flow.compute(seeds.length ? seeds : [target], 20000);
      // behind a locked door: lead to that door (the player learns what is needed there)
      if (!this.startCell(px, py)) {
        for (const d of v.doors) if (d.locked && !d.open) this.doorCells(d, (c) => { if (!this.map.isWallAt((c % this.flow.w + 0.5) * NAV, (Math.floor(c / this.flow.w) + 0.5) * NAV)) this.flow.blocked[c] = 0; });
        this.flow.compute(seeds.length ? seeds : [target], 20000);
      }
    }
    this.target = target;
    if (!target) this.hud = null;
    if (!target) { this.shown = Math.max(0, this.shown - dt * 4); if (!this.shown) return; }
    else this.shown = Math.min(1, this.shown + dt * 3);
    if (!this.target) return;
    const t = this.target;
    const far = Math.hypot(t.x - px, t.y - py);
    // look-ahead along the path: walk downhill a few cells
    // string pulling: the farthest point of the path (up to 12 cells) reachable in a straight line with the
    // body's width, so the arrow never points into a wall corner
    let lx = px, ly = py;
    const start = this.startCell(px, py);
    if (start) {
      const path: { x: number; y: number }[] = start.own ? [] : [{ x: start.x, y: start.y }];
      let cx = start.x, cy = start.y;
      for (let i = 0; i < 12; i++) {
        const d = this.flow.dirAt(cx, cy); if (!d) break;
        const c = this.flow.cellOf(cx + d[0] * NAV, cy + d[1] * NAV);
        cx = (c % this.flow.w + 0.5) * NAV; cy = (Math.floor(c / this.flow.w) + 0.5) * NAV;
        path.push({ x: cx, y: cy });
      }
      const clear = (x: number, y: number) => {
        const a = Math.atan2(y - py, x - px), ox = -Math.sin(a) * 15, oy = Math.cos(a) * 15;
        return this.map.lineOfSight(px, py, x, y, false) && this.map.lineOfSight(px + ox, py + oy, x + ox, y + oy, false) && this.map.lineOfSight(px - ox, py - oy, x - ox, y - oy, false);
      };
      for (let i = path.length - 1; i >= 0; i--) if (i === 0 || clear(path[i].x, path[i].y)) { lx = path[i].x; ly = path[i].y; break; }
    }
    const want = lx === px && ly === py ? Math.atan2(t.y - py, t.x - px) : Math.atan2(ly - py, lx - px);
    this.angle = Phaser.Math.Angle.RotateTo(this.angle, want, dt * 8);
    const view = cam.worldView;
    const onScreen = t.x > view.x + 20 && t.x < view.right - 20 && t.y - 60 > view.y + 20 && t.y < view.bottom - 20;
    this.hud = { angle: this.angle, metres: Math.max(1, Math.round(far / 32)) };
    const a = this.shown * (far < 90 ? Math.max(0, (far - 50) / 40) : 1);
    if (a <= 0.01) return;
    // arrow on the floor around the player
    const pulse = 0.75 + Math.sin(time * 5) * 0.25;
    // around the body (centre at chest height), in screen space
    const r = 66, ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const ax = px + ca * r, ay = py - 40 + sa * r;
    const tip = 24, wing = 15;
    const pts = [
      { x: ax + ca * tip, y: ay + sa * tip },
      { x: ax - sa * wing - ca * 6, y: ay + ca * wing - sa * 6 },
      { x: ax - ca * 1, y: ay - sa * 1 },
      { x: ax + sa * wing - ca * 6, y: ay - ca * wing - sa * 6 },
    ];
    g.fillStyle(0x000000, 0.35 * a).fillPoints(pts.map((p) => ({ x: p.x + 2, y: p.y + 2 })), true);
    g.fillStyle(0xffd23a, a * pulse).fillPoints(pts, true);
    g.lineStyle(2, 0x5a3a00, a).strokePoints(pts, true);
    // marker over the target when visible
    if (onScreen && far > 90) {
      const by = t.y - 92 + Math.sin(time * 4) * 6;
      g.fillStyle(0xffd23a, a).fillTriangle(t.x - 10, by - 12, t.x + 10, by - 12, t.x, by + 4);
      g.lineStyle(2, 0x5a3a00, a).strokeTriangle(t.x - 10, by - 12, t.x + 10, by - 12, t.x, by + 4);
    }
  }

  destroy() { this.g.destroy(); }
}
