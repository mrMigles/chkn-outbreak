// Procedural sound effects. Every sound is synthesized once into AudioBuffers (several variations)
// with an OfflineAudioContext, then played through a compressor for punch.

type Recipe = (ctx: OfflineAudioContext, v: number) => void;

const SR = 44100;

function noiseBuffer(ctx: BaseAudioContext, dur: number, seed = 1) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < d.length; i++) { s = (s * 9301 + 49297) % 233280; d[i] = (s / 233280) * 2 - 1; }
  return b;
}

function env(g: GainNode, t0: number, a: number, peak: number, decay: number, curve = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(curve, t0 + a + decay);
}

/** Filtered noise burst. */
function noise(ctx: OfflineAudioContext, o: { t?: number; dur: number; type?: BiquadFilterType; f: number; f2?: number; q?: number; gain: number; a?: number; seed?: number; dest?: AudioNode }) {
  const t = o.t ?? 0;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, o.dur + 0.05, o.seed ?? 1);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  env(g, t, o.a ?? 0.001, o.gain, o.dur);
  src.connect(f).connect(g).connect(o.dest ?? ctx.destination);
  src.start(t);
  src.stop(t + o.dur + 0.05);
}

/** Oscillator with pitch sweep. */
function tone(ctx: OfflineAudioContext, o: { t?: number; dur: number; type?: OscillatorType; f: number; f2?: number; gain: number; a?: number; dest?: AudioNode; vib?: number }) {
  const t = o.t ?? 0;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
  if (o.vib) {
    const l = ctx.createOscillator(); l.frequency.value = o.vib;
    const lg = ctx.createGain(); lg.gain.value = o.f * 0.06;
    l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05);
  }
  const g = ctx.createGain();
  env(g, t, o.a ?? 0.002, o.gain, o.dur);
  osc.connect(g).connect(o.dest ?? ctx.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

function drive(ctx: OfflineAudioContext, amount: number) {
  const ws = ctx.createWaveShaper();
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  ws.curve = c;
  ws.connect(ctx.destination);
  return ws;
}

/** Shared gunshot recipe: click + body + thump + tail. */
function gun(ctx: OfflineAudioContext, v: number, p: { body: number; bodyDur: number; thump: number; thumpDur: number; tail: number; tailDur: number; crack: number; drive: number; gain: number }) {
  const d = drive(ctx, p.drive);
  const j = 1 + (v - 1.5) * 0.04;
  noise(ctx, { dur: 0.012, type: 'highpass', f: 3000, gain: 0.9 * p.gain, seed: v + 3, dest: d });
  noise(ctx, { dur: p.bodyDur, type: 'lowpass', f: p.body * j, f2: p.body * 0.25, q: 1.2, gain: 1.0 * p.gain, seed: v + 7, dest: d });
  noise(ctx, { dur: 0.05, type: 'bandpass', f: p.crack * j, q: 0.8, gain: 0.7 * p.gain, seed: v + 11, dest: d });
  tone(ctx, { dur: p.thumpDur, f: p.thump * j, f2: 35, gain: 1.0 * p.gain, dest: d });
  noise(ctx, { t: 0.01, dur: p.tailDur, type: 'lowpass', f: p.tail, f2: 200, gain: 0.32 * p.gain, a: 0.01, seed: v + 13 });
}

const RECIPES: Record<string, { dur: number; vars: number; fn: Recipe }> = {
  pistol: { dur: 0.45, vars: 3, fn: (c, v) => gun(c, v, { body: 4200, bodyDur: 0.09, thump: 160, thumpDur: 0.12, tail: 1800, tailDur: 0.3, crack: 2400, drive: 3, gain: 0.9 }) },
  smg: { dur: 0.32, vars: 4, fn: (c, v) => gun(c, v, { body: 5200, bodyDur: 0.06, thump: 190, thumpDur: 0.07, tail: 2400, tailDur: 0.2, crack: 3000, drive: 3.5, gain: 0.75 }) },
  rifle: { dur: 0.6, vars: 4, fn: (c, v) => gun(c, v, { body: 3600, bodyDur: 0.11, thump: 130, thumpDur: 0.14, tail: 1500, tailDur: 0.45, crack: 1900, drive: 4.5, gain: 1 }) },
  machinegun: { dur: 0.6, vars: 4, fn: (c, v) => gun(c, v, { body: 3000, bodyDur: 0.12, thump: 105, thumpDur: 0.16, tail: 1200, tailDur: 0.45, crack: 1500, drive: 5, gain: 1 }) },
  shotgun: { dur: 0.95, vars: 3, fn: (c, v) => {
    gun(c, v, { body: 2600, bodyDur: 0.2, thump: 95, thumpDur: 0.26, tail: 1100, tailDur: 0.7, crack: 1200, drive: 6, gain: 1.15 });
    noise(c, { t: 0.02, dur: 0.12, type: 'bandpass', f: 700, q: 0.6, gain: 0.6, seed: v + 40 });
  } },
  grenade_launch: { dur: 0.5, vars: 2, fn: (c, v) => {
    const d = drive(c, 3);
    tone(c, { dur: 0.18, f: 220 + v * 10, f2: 60, gain: 1, dest: d });
    noise(c, { dur: 0.15, type: 'lowpass', f: 1400, f2: 200, gain: 0.7, seed: v, dest: d });
    noise(c, { t: 0.02, dur: 0.3, type: 'bandpass', f: 500, q: 1, gain: 0.25, seed: v + 5 });
  } },
  explosion: { dur: 2.2, vars: 3, fn: (c, v) => {
    const d = drive(c, 5);
    tone(c, { dur: 0.7, f: 110 + v * 8, f2: 25, gain: 1.2, dest: d });
    noise(c, { dur: 0.35, type: 'lowpass', f: 5000, f2: 300, gain: 1.1, seed: v + 1, dest: d });
    noise(c, { t: 0.03, dur: 1.9, type: 'lowpass', f: 900, f2: 60, gain: 0.8, a: 0.02, seed: v + 2 });
    for (let i = 0; i < 9; i++) noise(c, { t: 0.08 + i * 0.09 + v * 0.01, dur: 0.05, type: 'highpass', f: 2500, gain: 0.12, seed: v * 10 + i });
  } },
  flame: { dur: 0.5, vars: 2, fn: (c, v) => {
    noise(c, { dur: 0.48, type: 'lowpass', f: 1400, f2: 900, q: 0.5, gain: 0.55, a: 0.04, seed: v + 20 });
    noise(c, { dur: 0.48, type: 'bandpass', f: 300, q: 0.7, gain: 0.5, a: 0.04, seed: v + 21 });
  } },
  reload: { dur: 0.6, vars: 1, fn: (c) => {
    noise(c, { dur: 0.03, type: 'bandpass', f: 2200, q: 3, gain: 0.5, seed: 3 });
    noise(c, { t: 0.18, dur: 0.04, type: 'bandpass', f: 1500, q: 3, gain: 0.6, seed: 4 });
    noise(c, { t: 0.42, dur: 0.05, type: 'bandpass', f: 2800, q: 4, gain: 0.7, seed: 5 });
  } },
  pump: { dur: 0.35, vars: 1, fn: (c) => {
    noise(c, { dur: 0.05, type: 'bandpass', f: 1200, q: 2, gain: 0.7, seed: 6 });
    noise(c, { t: 0.12, dur: 0.06, type: 'bandpass', f: 1800, q: 2, gain: 0.8, seed: 7 });
  } },
  casing: { dur: 0.25, vars: 4, fn: (c, v) => {
    tone(c, { dur: 0.08, f: 4200 + v * 400, gain: 0.18 });
    tone(c, { t: 0.06, dur: 0.06, f: 5200 + v * 300, gain: 0.1 });
    tone(c, { t: 0.11, dur: 0.05, f: 4700 + v * 200, gain: 0.06 });
  } },
  shell: { dur: 0.3, vars: 2, fn: (c, v) => {
    tone(c, { dur: 0.06, f: 1300 + v * 120, gain: 0.2 });
    noise(c, { t: 0.08, dur: 0.05, type: 'bandpass', f: 1600, q: 3, gain: 0.15, seed: v });
  } },
  flesh: { dur: 0.25, vars: 4, fn: (c, v) => {
    noise(c, { dur: 0.08, type: 'bandpass', f: 700 + v * 90, f2: 300, q: 1.5, gain: 0.7, seed: v + 30 });
    tone(c, { dur: 0.07, f: 160, f2: 70, gain: 0.5 });
  } },
  armor: { dur: 0.35, vars: 3, fn: (c, v) => {
    for (const f of [2300, 3170, 4410]) tone(c, { dur: 0.25, f: f * (1 + v * 0.03), gain: 0.12 });
    noise(c, { dur: 0.02, type: 'highpass', f: 4000, gain: 0.4, seed: v });
  } },
  wallhit: { dur: 0.15, vars: 3, fn: (c, v) => {
    noise(c, { dur: 0.05, type: 'bandpass', f: 1800 + v * 300, q: 1.2, gain: 0.35, seed: v + 50 });
  } },
  squawk: { dur: 0.45, vars: 5, fn: (c, v) => {
    const base = 600 + v * 90;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + v * 200; bp.Q.value = 1.4; bp.connect(c.destination);
    tone(c, { dur: 0.08, type: 'sawtooth', f: base, f2: base * 1.6, gain: 0.65, dest: bp });
    tone(c, { t: 0.07, dur: 0.22, type: 'sawtooth', f: base * 1.55, f2: base * 0.85, gain: 0.6, dest: bp, vib: 38 });
    noise(c, { dur: 0.25, type: 'bandpass', f: 2600, q: 2, gain: 0.08, seed: v });
  } },
  cluck: { dur: 0.3, vars: 4, fn: (c, v) => {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300 + v * 150; bp.Q.value = 2; bp.connect(c.destination);
    for (let i = 0; i < 2; i++) tone(c, { t: i * 0.11, dur: 0.06, type: 'square', f: 420 + v * 40, f2: 300, gain: 0.5, dest: bp });
  } },
  death: { dur: 0.7, vars: 5, fn: (c, v) => {
    const base = 900 + v * 80;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.2; bp.connect(c.destination);
    tone(c, { dur: 0.5, type: 'sawtooth', f: base * 1.4, f2: base * 0.35, gain: 0.75, dest: bp, vib: 26 });
    noise(c, { dur: 0.1, type: 'bandpass', f: 600, q: 1, gain: 0.5, seed: v + 60 });
  } },
  swing: { dur: 0.2, vars: 2, fn: (c, v) => noise(c, { dur: 0.15, type: 'bandpass', f: 900, f2: 2500, q: 1.5, gain: 0.3, seed: v + 70 }) },
  spit: { dur: 0.3, vars: 2, fn: (c, v) => {
    noise(c, { dur: 0.1, type: 'bandpass', f: 1200, f2: 400, q: 2, gain: 0.5, seed: v + 80 });
    tone(c, { dur: 0.12, f: 500, f2: 200, gain: 0.25 });
  } },
  splat: { dur: 0.3, vars: 2, fn: (c, v) => noise(c, { dur: 0.18, type: 'lowpass', f: 900, f2: 200, gain: 0.5, seed: v + 90 }) },
  hurt: { dur: 0.35, vars: 2, fn: (c, v) => {
    tone(c, { dur: 0.2, f: 140 + v * 10, f2: 60, gain: 0.7 });
    noise(c, { dur: 0.12, type: 'lowpass', f: 700, gain: 0.5, seed: v + 100 });
  } },
  pickup: { dur: 0.35, vars: 1, fn: (c) => {
    tone(c, { dur: 0.08, type: 'triangle', f: 660, gain: 0.3 });
    tone(c, { t: 0.07, dur: 0.1, type: 'triangle', f: 990, gain: 0.3 });
    tone(c, { t: 0.14, dur: 0.15, type: 'triangle', f: 1320, gain: 0.25 });
  } },
  weapon_pick: { dur: 0.5, vars: 1, fn: (c) => {
    noise(c, { dur: 0.04, type: 'bandpass', f: 2000, q: 3, gain: 0.6, seed: 11 });
    noise(c, { t: 0.12, dur: 0.06, type: 'bandpass', f: 1300, q: 3, gain: 0.7, seed: 12 });
    tone(c, { t: 0.2, dur: 0.2, type: 'triangle', f: 880, gain: 0.25 });
  } },
  switch: { dur: 0.15, vars: 1, fn: (c) => noise(c, { dur: 0.04, type: 'bandpass', f: 2500, q: 3, gain: 0.5, seed: 13 }) },
  empty: { dur: 0.1, vars: 1, fn: (c) => noise(c, { dur: 0.02, type: 'bandpass', f: 3500, q: 4, gain: 0.5, seed: 14 }) },
  door: { dur: 0.6, vars: 1, fn: (c) => noise(c, { dur: 0.45, type: 'bandpass', f: 1200, f2: 500, q: 0.8, gain: 0.28, a: 0.05, seed: 15 }) },
  fuse: { dur: 0.6, vars: 1, fn: (c) => { for (let i = 0; i < 5; i++) tone(c, { t: i * 0.11, dur: 0.05, type: 'square', f: 1400 + i * 120, gain: 0.18 }); } },
  ui: { dur: 0.12, vars: 1, fn: (c) => tone(c, { dur: 0.06, type: 'triangle', f: 1200, gain: 0.25 }) },
  alarm: { dur: 1.0, vars: 1, fn: (c) => { tone(c, { dur: 0.45, type: 'square', f: 700, f2: 500, gain: 0.16 }); tone(c, { t: 0.5, dur: 0.45, type: 'square', f: 700, f2: 500, gain: 0.16 }); } },
  spawn: { dur: 0.5, vars: 2, fn: (c, v) => { noise(c, { dur: 0.35, type: 'bandpass', f: 400, f2: 1200, q: 1, gain: 0.3, seed: v + 120 }); } },
  boss_roar: { dur: 1.6, vars: 1, fn: (c) => {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; bp.connect(c.destination);
    const d = drive(c, 4);
    tone(c, { dur: 1.2, type: 'sawtooth', f: 260, f2: 120, gain: 0.6, dest: bp, vib: 14 });
    tone(c, { dur: 1.3, type: 'sawtooth', f: 130, f2: 70, gain: 0.5, dest: d, vib: 9 });
  } },
};

export class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  private buffers = new Map<string, AudioBuffer[]>();
  private playing = new Map<string, number>();
  volume = 0.8;
  listenerX = 0; listenerY = 0;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  ready = false;

  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(this.ctx.destination);
    await Promise.all(Object.entries(RECIPES).map(async ([name, r]) => {
      const list: AudioBuffer[] = [];
      for (let v = 0; v < r.vars; v++) {
        const off = new OfflineAudioContext(1, Math.ceil(SR * r.dur), SR);
        r.fn(off, v);
        list.push(await off.startRendering());
      }
      this.buffers.set(name, list);
    }));
    this.ready = true;
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }

  /** Play a sound at world position (x,y) — attenuated & panned relative to the listener. */
  play(name: string, o: { x?: number; y?: number; vol?: number; rate?: number; max?: number } = {}) {
    if (!this.ready || !this.ctx) return;
    const list = this.buffers.get(name);
    if (!list) return;
    const max = o.max ?? 6;
    const cur = this.playing.get(name) ?? 0;
    if (cur >= max) return;
    let vol = o.vol ?? 1, pan = 0;
    if (o.x !== undefined && o.y !== undefined) {
      const dx = o.x - this.listenerX, dy = o.y - this.listenerY;
      const d = Math.hypot(dx, dy);
      vol *= 1 / (1 + (d / 650) ** 2);
      pan = Math.max(-0.8, Math.min(0.8, dx / 900));
      if (vol < 0.02) return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = (o.rate ?? 1) * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    src.start();
    this.playing.set(name, cur + 1);
    src.onended = () => this.playing.set(name, (this.playing.get(name) ?? 1) - 1);
  }

  /** Looping sound (flamethrower). */
  loop(key: string, name: string, on: boolean, vol = 0.8) {
    if (!this.ready || !this.ctx) return;
    const l = this.loops.get(key);
    if (on && !l) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.get(name)![0];
      src.loop = true; src.loopStart = 0.05; src.loopEnd = 0.45;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(g).connect(this.master);
      src.start();
      this.loops.set(key, { src, gain: g });
    } else if (!on && l) {
      l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      l.src.stop(this.ctx.currentTime + 0.2);
      this.loops.delete(key);
    }
  }
}

export const sfx = new Sfx();
