// D57: arrows at the screen edge toward attacking chickens outside the view — phones see a smaller
// slice of the floor, so threats from behind must still be readable.
import type Phaser from 'phaser';
import type { WorldView } from '../../shared/sim/types';

const MAX = 6, RANGE = 1500;

export class Threats {
  private root = document.createElement('div');
  private arrows: HTMLDivElement[] = [];
  constructor() {
    this.root.className = 'threats';
    for (let i = 0; i < MAX; i++) { const a = document.createElement('div'); a.className = 'threat'; this.root.appendChild(a); this.arrows.push(a); }
    document.getElementById('ui')!.prepend(this.root);
  }
  update(view: WorldView, px: number, py: number, cam: Phaser.Cameras.Scene2D.Camera, dpr: number, enabled: boolean) {
    const wv = cam.worldView, list: { e: { x: number; y: number }; d: number }[] = [];
    if (enabled) for (const e of view.enemies) {
      if (!e.aggro || e.state === 'rise' || e.hp <= 0) continue;
      if (e.x > wv.x && e.x < wv.right && e.y > wv.y && e.y < wv.bottom) continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d < RANGE) list.push({ e, d });
    }
    list.sort((a, b) => a.d - b.d);
    const W = innerWidth, H = innerHeight, m = 22;
    const cx = (px - wv.x) * cam.zoom / dpr, cy = (py - wv.y) * cam.zoom / dpr;
    this.arrows.forEach((el, i) => {
      const t = list[i];
      if (!t) { el.style.display = 'none'; return; }
      const a = Math.atan2(t.e.y - py, t.e.x - px), dx = Math.cos(a), dy = Math.sin(a);
      // ray from the player to the inset screen rectangle
      const kx = dx > 0 ? (W - m - cx) / dx : dx < 0 ? (m - cx) / dx : Infinity;
      const ky = dy > 0 ? (H - m - cy) / dy : dy < 0 ? (m - cy) / dy : Infinity;
      const k = Math.max(0, Math.min(kx, ky));
      el.style.display = 'block';
      el.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px) rotate(${a}rad)`;
      el.style.opacity = String(t.d < 700 ? 0.95 : 0.55);
      el.classList.toggle('near', t.d < 700);
    });
  }
  destroy() { this.root.remove(); }
}
