// Adaptive music: calm exploration, tense skirmish, full wave and boss — crossfaded by combat intensity.
// Tracks: Juhani Junkala, "Chiptune Adventures" (CC0), see docs/ASSETS.md.
import { settings } from '../settings';

export type Mood = 'off' | 'calm' | 'tense' | 'wave' | 'boss';
const TRACKS: Exclude<Mood, 'off'>[] = ['calm', 'tense', 'wave', 'boss'];

class Music {
  private el = new Map<string, HTMLAudioElement>();
  private gain = new Map<string, number>();
  mood: Mood = 'off';
  private hold = 0;
  private unlocked = false;

  init() {
    if (this.el.size) return;
    for (const t of TRACKS) {
      const a = new Audio(`assets/music/${t}.ogg`);
      a.loop = true; a.preload = t === 'calm' ? 'auto' : 'metadata'; a.volume = 0;
      this.el.set(t, a); this.gain.set(t, 0);
    }
    const unlock = () => { this.unlocked = true; this.apply(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    // runs independently of scenes so menus fade too
    setInterval(() => this.update(0.05), 50);
    this.mood = 'calm';
  }

  /** Request a mood. Higher intensity applies at once; calmer moods wait a few seconds (no flip-flopping). */
  want(m: Mood, dt: number) {
    const rank = { off: 0, calm: 1, tense: 2, wave: 3, boss: 4 } as const;
    if (rank[m] >= rank[this.mood] || m === 'off') { this.mood = m; this.hold = m === 'wave' ? 7 : 5; }
    else { this.hold -= dt; if (this.hold <= 0) { this.mood = rank[this.mood] > 2 && m === 'calm' ? 'tense' : m; this.hold = 5; } }
  }

  set(m: Mood) { this.mood = m; this.hold = 4; }

  /** Per-frame crossfade. */
  update(dt: number) {
    if (!this.unlocked) return;
    for (const t of TRACKS) {
      const a = this.el.get(t)!;
      const target = this.mood === t ? 1 : 0;
      let g = this.gain.get(t)!;
      g += Math.sign(target - g) * Math.min(Math.abs(target - g), dt * (target ? 0.7 : 0.45));
      this.gain.set(t, g);
      a.volume = Math.max(0, Math.min(1, g * settings.music * 0.6));
      if (g > 0.001 && a.paused) { if (target) a.currentTime = 0; void a.play().catch(() => {}); }
      if (g <= 0.001 && !a.paused) a.pause();
    }
  }

  private apply() { this.update(0); }
}

export const music = new Music();
