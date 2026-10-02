// Runtime character textures: composes LPC layers (lpc atlas) into one Phaser texture per look.
// Texture key `look:<code>` (human) / `mut:<code>` (chicken-person). Frames: `<dir>_<0..8>` walk, `hurt_<0..5>`, humans also `a<dir>_<0..8>` (armed walk).
import Phaser from 'phaser';
import { composeLook, DIRS, SHEET_W, SHEET_H, type ComposeEnv } from './compose';
import { resolveLook, encodeLook } from '../../shared/look';

let atlasImage: HTMLImageElement | null = null;
let atlasFrames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
const strips = new Map<string, HTMLCanvasElement>();

/** Loads the layer atlas outside Phaser (it is only a compositing source, never a GPU texture). */
export function loadLayerAtlas(): Promise<void> {
  return Promise.all([
    fetch('assets/gen/lpc.json').then((r) => r.json()),
    new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = 'assets/gen/lpc.png'; }),
  ]).then(([json, image]) => { atlasFrames = json.frames; atlasImage = image; });
}

const env: ComposeEnv = {
  layer(id) {
    let c = strips.get(id);
    if (c) return c;
    const f = atlasFrames[id]?.frame;
    if (!f || !atlasImage) return null;
    c = document.createElement('canvas');
    c.width = SHEET_W; c.height = SHEET_H;
    c.getContext('2d')!.drawImage(atlasImage, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    strips.set(id, c);
    return c;
  },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c as any; },
};

/** Normalised look code (presets/legacy kinds resolve to a full code). */
export const lookCode = (key: string | null | undefined) => encodeLook(resolveLook(key));

/** Returns the texture key for a look, composing it on first use. */
export function lookTexture(scene: Phaser.Scene, key: string | null | undefined, mutant = false): string {
  const code = lookCode(key);
  const tex = (mutant ? 'mut:' : 'look:') + code;
  if (scene.textures.exists(tex)) return tex;
  const canvas = composeLook(env, resolveLook(code), mutant) as unknown as HTMLCanvasElement;
  const t = scene.textures.addCanvas(tex, canvas)!;
  DIRS.forEach((d, row) => { for (let f = 0; f < 9; f++) t.add(`${d}_${f}`, 0, f * 64, row * 64, 64, 64); });
  for (let f = 0; f < 6; f++) t.add(`hurt_${f}`, 0, f * 64, 256, 64, 64);
  if (!mutant) DIRS.forEach((d, row) => { for (let f = 0; f < 9; f++) t.add(`a${d}_${f}`, 0, f * 64, SHEET_H + row * 64, 64, 64); });
  return tex;
}

/** Data URL portrait (south-facing idle frame) for HTML UI such as the character editor. */
export function lookPortrait(key: string, mutant = false, scale = 3): string {
  const canvas = composeLook(env, resolveLook(key), mutant) as unknown as HTMLCanvasElement;
  const out = document.createElement('canvas');
  out.width = 40 * scale; out.height = 52 * scale;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(canvas, 12, 128 + 10, 40, 52, 0, 0, out.width, out.height);
  return out.toDataURL();
}

export const layersReady = () => !!atlasImage;
