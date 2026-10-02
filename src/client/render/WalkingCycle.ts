/** Advance the eight walking poses by distance, ignoring settling/jitter and teleports. */
export class WalkingCycle {
  private x = NaN;
  private y = NaN;
  phase = 0;
  update(x: number, y: number, dt: number, allowed: boolean) {
    const distance = Math.hypot(x - this.x, y - this.y);
    this.x = x; this.y = y;
    const walking = allowed && Number.isFinite(distance) && distance > Math.max(.25, dt * 18) && distance < 500 * dt + 16;
    if (!walking) return 0;
    this.phase += distance / 28;
    return 1 + Math.floor(this.phase) % 8;
  }
}
