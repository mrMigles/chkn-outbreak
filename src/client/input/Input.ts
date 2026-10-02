import Phaser from 'phaser';

export interface InputState {
  mx: number; my: number;          // movement vector (-1..1)
  aimMode: 'mouse' | 'stick' | 'none';
  aimWX: number; aimWY: number;    // mouse world point
  stickA: number; stickMag: number; // right stick
  fire: boolean;
  reload: boolean;                 // edge
  interact: boolean;               // held
  interactEdge: boolean;
  weaponDelta: number;             // edge (+1/-1)
  weaponSlot: number;              // edge, -1 none
  pause: boolean;                  // edge
}

export const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Keyboard + mouse + virtual twin sticks (DOM overlay). */
export class Input {
  state: InputState = { mx: 0, my: 0, aimMode: 'mouse', aimWX: 0, aimWY: 0, stickA: 0, stickMag: 0, fire: false, reload: false, interact: false, interactEdge: false, weaponDelta: 0, weaponSlot: -1, pause: false };
  touch: boolean;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private root: HTMLDivElement | null = null;
  private sticks: { id: number; side: 'L' | 'R'; ox: number; oy: number; x: number; y: number; base: HTMLDivElement; knob: HTMLDivElement }[] = [];
  private btnInteract = false;
  private interactPrev = false;
  interactLabel: HTMLDivElement | null = null;
  private wheelAcc = 0;
  enabled = true;

  constructor(private scene: Phaser.Scene) {
    this.touch = isTouch();
    const kb = scene.input.keyboard!;
    for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'R', 'E', 'F', 'Q', 'ESC', 'SPACE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN']) {
      this.keys[k] = kb.addKey(k, true, false);
    }
    kb.on('keydown-R', () => { this.state.reload = true; });
    kb.on('keydown-Q', () => { this.state.weaponDelta = -1; });
    kb.on('keydown-ESC', () => { this.state.pause = true; });
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'].forEach((k, i) => kb.on('keydown-' + k, () => { this.state.weaponSlot = i; }));
    scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.wheelAcc += dy;
      if (Math.abs(this.wheelAcc) > 40) { this.state.weaponDelta = Math.sign(this.wheelAcc); this.wheelAcc = 0; }
    });
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointermove', () => { if (!this.touch) this.state.aimMode = 'mouse'; });
    if (this.touch) this.buildTouch();
  }

  private buildTouch() {
    const root = document.createElement('div');
    root.className = 'touch-root';
    root.innerHTML = `
      <div class="touch-zone left"></div><div class="touch-zone right"></div>
      <div class="tbtn t-interact hidden" data-b="interact">E</div>
      <div class="tbtn t-reload" data-b="reload">⟳</div>
      <div class="tbtn t-pause" data-b="pause">❚❚</div>`;
    document.getElementById('ui')!.appendChild(root);
    this.root = root;
    this.interactLabel = root.querySelector('.t-interact');
    const mkStick = () => {
      const base = document.createElement('div'); base.className = 'stick-base';
      const knob = document.createElement('div'); knob.className = 'stick-knob';
      base.appendChild(knob); root.appendChild(base);
      return { base, knob };
    };
    const onStart = (side: 'L' | 'R') => (ev: TouchEvent) => {
      ev.preventDefault();
      for (const t of Array.from(ev.changedTouches)) {
        if (this.sticks.some((s) => s.side === side)) continue;
        const { base, knob } = mkStick();
        const s = { id: t.identifier, side, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, base, knob };
        base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px';
        base.classList.add(side === 'L' ? 'move' : 'aim');
        this.sticks.push(s);
      }
    };
    root.querySelector('.left')!.addEventListener('touchstart', onStart('L') as EventListener, { passive: false });
    root.querySelector('.right')!.addEventListener('touchstart', onStart('R') as EventListener, { passive: false });
    const onMove = (ev: TouchEvent) => {
      for (const t of Array.from(ev.changedTouches)) {
        const s = this.sticks.find((q) => q.id === t.identifier);
        if (!s) continue;
        ev.preventDefault();
        s.x = t.clientX; s.y = t.clientY;
        const R = 56;
        let dx = s.x - s.ox, dy = s.y - s.oy;
        const d = Math.hypot(dx, dy);
        if (d > R * 1.6) { s.ox += dx * (1 - (R * 1.6) / d); s.oy += dy * (1 - (R * 1.6) / d); s.base.style.left = s.ox + 'px'; s.base.style.top = s.oy + 'px'; dx = s.x - s.ox; dy = s.y - s.oy; }
        const k = Math.min(1, R / Math.max(1, Math.hypot(dx, dy)));
        s.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      }
    };
    const onEnd = (ev: TouchEvent) => {
      for (const t of Array.from(ev.changedTouches)) {
        const s = this.sticks.find((q) => q.id === t.identifier);
        if (!s) continue;
        s.base.remove();
        this.sticks = this.sticks.filter((q) => q !== s);
      }
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    this.cleanup = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
    root.querySelectorAll<HTMLDivElement>('.tbtn').forEach((b) => {
      const kind = b.dataset.b!;
      b.addEventListener('touchstart', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        b.classList.add('down');
        if (kind === 'interact') this.btnInteract = true;
        if (kind === 'reload') this.state.reload = true;
        if (kind === 'switch') this.state.weaponDelta = 1;
        if (kind === 'pause') this.state.pause = true;
      }, { passive: false });
      b.addEventListener('touchend', (ev) => { ev.preventDefault(); b.classList.remove('down'); if (kind === 'interact') this.btnInteract = false; });
    });
  }

  showInteract(text: string | null) {
    if (!this.interactLabel) return;
    this.interactLabel.classList.toggle('hidden', !text);
    if (text) this.interactLabel.textContent = text;
  }

  /** Call once per frame before reading state. */
  poll() {
    const s = this.state;
    const k = this.keys;
    if (!this.enabled) { s.mx = s.my = 0; s.fire = false; s.interact = false; return s; }
    let mx = 0, my = 0;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    const ptr = this.scene.input.activePointer;
    s.fire = !this.touch && ptr.leftButtonDown();
    s.interact = k.E.isDown || k.F.isDown || this.btnInteract;
    s.interactEdge = s.interact && !this.interactPrev;
    this.interactPrev = s.interact;
    if (!this.touch) {
      const wp = ptr.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      s.aimWX = wp.x; s.aimWY = wp.y;
      s.aimMode = 'mouse';
    }
    const L = this.sticks.find((q) => q.side === 'L');
    const R = this.sticks.find((q) => q.side === 'R');
    if (L) {
      const dx = L.x - L.ox, dy = L.y - L.oy, d = Math.hypot(dx, dy);
      if (d > 8) { const m = Math.min(1, d / 56); mx = (dx / d) * m; my = (dy / d) * m; }
    }
    if (R) {
      const dx = R.x - R.ox, dy = R.y - R.oy, d = Math.hypot(dx, dy);
      s.stickMag = Math.min(1, d / 56);
      if (d > 10) s.stickA = Math.atan2(dy, dx);
      s.aimMode = 'stick';
    } else if (this.touch) { s.stickMag = 0; s.aimMode = 'none'; }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    s.mx = mx; s.my = my;
    // debug / automated testing hook: window.__input = { fire, mx, my, aimX, aimY }
    const dbg = (window as any).__input;
    if (dbg) {
      if (dbg.fire !== undefined) s.fire = dbg.fire;
      if (dbg.mx !== undefined) { s.mx = dbg.mx; s.my = dbg.my; }
      if (dbg.slot !== undefined) { s.weaponSlot = dbg.slot; }
      if (dbg.interact !== undefined) { s.interact = dbg.interact; }
      if (dbg.aimX !== undefined) { s.aimWX = dbg.aimX; s.aimWY = dbg.aimY; s.aimMode = 'mouse'; }
    }
    return s;
  }

  /** Clear edge-triggered inputs after they were consumed. */
  consume() {
    const s = this.state;
    s.reload = false; s.weaponDelta = 0; s.weaponSlot = -1; s.pause = false; s.interactEdge = false;
  }

  private cleanup: () => void = () => {};
  destroy() { this.cleanup(); this.root?.remove(); for (const s of this.sticks) s.base.remove(); }
}
