// Character appearance ("look"): which Universal LPC layers and colours make up a person.
// Encoded as a short string so it travels in snapshots / join options and keys texture caches.
import type { EnemyType } from './enemies';

export type BodyType = 'm' | 'f' | 'big';
export interface Look {
  body: BodyType;
  old: boolean;
  skin: number;          // index into SKIN_TONES
  hair: HairId;
  hairColor: string;     // hex rrggbb
  top: TopId;
  topColor: string;
  legs: LegsId;
  legsColor: string;
  acc: AccId;
}

export const HAIR = {
  parted: 'Пробор', buzzcut: 'Ёжик', spiked: 'Иглы', messy: 'Лохматый', curly: 'Кудри', afro: 'Афро', balding: 'Лысина',
  bob: 'Каре', pixie: 'Пикси', long: 'Длинные', ponytail: 'Хвост', bangslong: 'Чёлка', lob: 'Удлинённое каре', page: 'Паж',
} as const;
export type HairId = keyof typeof HAIR;
export const TOPS = { shirt: 'Рубашка', long: 'Лонгслив', tee: 'Футболка', blouse: 'Блузка', jacket: 'Пиджак', vest: 'Жилет', plate: 'Броня', leather: 'Кожанка', apron: 'Фартук' } as const;
export type TopId = keyof typeof TOPS;
export const LEGS = { pants: 'Брюки', formal: 'Классика', skirt: 'Юбка' } as const;
export type LegsId = keyof typeof LEGS;
export const ACCS = { none: 'Нет', glasses: 'Очки', beard: 'Борода', mustache: 'Усы' } as const;
export type AccId = keyof typeof ACCS;

/** Options offered in the character editor (per body type). */
export const EDITOR = {
  hair: { m: ['parted', 'buzzcut', 'spiked', 'messy', 'curly', 'afro', 'balding', 'ponytail', 'long'], f: ['bob', 'pixie', 'long', 'ponytail', 'bangslong', 'lob', 'page', 'curly', 'afro'] } as Record<'m' | 'f', HairId[]>,
  top: { m: ['shirt', 'long', 'tee', 'jacket', 'vest'], f: ['blouse', 'long', 'tee'] } as Record<'m' | 'f', TopId[]>,
  legs: { m: ['pants', 'formal'], f: ['pants', 'formal', 'skirt'] } as Record<'m' | 'f', LegsId[]>,
  acc: ['none', 'glasses', 'beard', 'mustache'] as AccId[],
};

export const SKIN_TONES = ['f9d5ba', 'e8b48f', 'c68a5e', '8d5a3b'];
export const HAIR_COLORS = ['2a2120', '4a3121', '7b4a2a', 'a0522d', 'd9a441', 'e8d39a', 'c9c9c9', 'c2452d', '3f6fb5', 'd36ba0'];
export const CLOTH_COLORS = ['f2f0ea', '2e3440', '5f86a8', '3b5f8a', 'b04a42', '6d8b4e', 'd9a33a', '8a5fa8', 'cf6f9f', '7b6a58', '4d5a52', 'e0703a'];
export const LEGS_COLORS = ['2b2e36', '485366', '3b4f7a', '6b5845', 'a39a86', '1f1f24', '6d2f35', '50613f'];

export function encodeLook(l: Look): string {
  return [l.body + (l.old ? 'o' : ''), l.skin, l.hair, l.hairColor, l.top, l.topColor, l.legs, l.legsColor, l.acc].join('.');
}

export function decodeLook(s: string): Look | null {
  const p = s.split('.');
  if (p.length < 9) return null;
  const body = p[0].replace('o', '') as BodyType;
  if (!['m', 'f', 'big'].includes(body) || !(p[2] in HAIR) || !(p[4] in TOPS) || !(p[6] in LEGS)) return null;
  const hex = (v: string, d: string) => /^[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d;
  return {
    body, old: p[0].endsWith('o'), skin: Math.max(0, Math.min(SKIN_TONES.length - 1, Number(p[1]) | 0)),
    hair: p[2] as HairId, hairColor: hex(p[3], HAIR_COLORS[1]), top: p[4] as TopId, topColor: hex(p[5], CLOTH_COLORS[0]),
    legs: p[6] as LegsId, legsColor: hex(p[7], LEGS_COLORS[0]), acc: (p[8] in ACCS ? p[8] : 'none') as AccId,
  };
}

const L = (body: string, skin: number, hair: HairId, hc: string, top: TopId, tc: string, legs: LegsId, lc: string, acc: AccId = 'none') =>
  [body, skin, hair, hc, top, tc, legs, lc, acc].join('.');

/** Named looks: story NPCs, player defaults and legacy Kenney character keys. */
export const LOOK_PRESETS: Record<string, string> = {
  // players (slot defaults)
  p0: L('m', 0, 'messy', '4a3121', 'tee', '5f86a8', 'pants', '2b2e36'),
  p1: L('f', 1, 'ponytail', 'c2452d', 'long', 'b04a42', 'pants', '485366'),
  p2: L('m', 2, 'buzzcut', '2a2120', 'jacket', 'd9a33a', 'formal', '2b2e36'),
  p3: L('f', 0, 'bob', 'e8d39a', 'blouse', '6d8b4e', 'skirt', '3b4f7a'),
  // office
  oleg: L('m', 0, 'balding', '7b4a2a', 'shirt', 'a39a86', 'formal', '485366', 'glasses'),
  sveta: L('f', 0, 'long', 'd9a441', 'blouse', 'cf6f9f', 'skirt', '2b2e36'),
  dima: L('m', 1, 'spiked', '2a2120', 'tee', 'e0703a', 'pants', '3b4f7a'),
  arkady: L('big', 0, 'parted', '4a3121', 'shirt', 'f2f0ea', 'formal', '2b2e36', 'mustache'),
  olga: L('f', 2, 'bangslong', '2a2120', 'long', '8a5fa8', 'formal', '1f1f24'),
  kirill: L('m', 0, 'curly', 'a0522d', 'long', '4d5a52', 'pants', '6b5845', 'beard'),
  galina: L('f', 1, 'page', '7b4a2a', 'blouse', 'b04a42', 'skirt', '1f1f24'),
  petrovich: L('mo', 0, 'buzzcut', 'c9c9c9', 'jacket', '2e3440', 'pants', '1f1f24', 'mustache'),
  semyon: L('mo', 0, 'balding', 'c9c9c9', 'vest', '7b6a58', 'formal', '6b5845', 'glasses'),
  marat: L('m', 2, 'parted', '2a2120', 'tee', '2e3440', 'pants', '3b4f7a', 'glasses'),
  // lab / factory
  andrey: L('m', 0, 'parted', '4a3121', 'shirt', '5f86a8', 'formal', '485366'),
  sergey: L('m', 1, 'messy', '2a2120', 'tee', 'b04a42', 'pants', '2b2e36', 'beard'),
  vlad: L('m', 0, 'buzzcut', '7b4a2a', 'tee', '6d8b4e', 'pants', '3b4f7a'),
  stas: L('m', 2, 'spiked', '2a2120', 'tee', 'e0703a', 'pants', '2b2e36'),
  pasha: L('m', 0, 'curly', 'a0522d', 'tee', '8a5fa8', 'pants', '485366', 'glasses'),
  root_manager: L('big', 0, 'balding', '7b4a2a', 'jacket', '2e3440', 'formal', '1f1f24'),
  omletov: L('mo', 0, 'balding', 'e8d39a', 'shirt', 'f2f0ea', 'formal', 'a39a86', 'glasses'),
  mihalych: L('mo', 1, 'buzzcut', '7b6a58', 'leather', '6b5845', 'pants', '485366', 'beard'),
  scientist: L('m', 0, 'parted', '4a3121', 'shirt', 'f2f0ea', 'formal', 'a39a86', 'glasses'),
  scientist_f: L('f', 0, 'bob', '2a2120', 'long', 'f2f0ea', 'pants', 'a39a86', 'glasses'),
  worker: L('m', 1, 'buzzcut', '4a3121', 'vest', 'e0703a', 'pants', '3b4f7a'),
  guard: L('m', 2, 'buzzcut', '2a2120', 'leather', '2e3440', 'pants', '1f1f24'),
  // D69: floors 8, 11, 12 and the city
  nelya: L('f', 0, 'bob', 'c2452d', 'blouse', 'cf6f9f', 'skirt', '2b2e36', 'glasses'),
  valera: L('m', 0, 'messy', '2a2120', 'long', '1f1f24', 'pants', '2b2e36', 'beard'),
  zhanna: L('f', 1, 'bangslong', '2a2120', 'blouse', 'f2f0ea', 'skirt', '1f1f24'),
  boris: L('big', 0, 'balding', '4a3121', 'jacket', '485366', 'formal', '1f1f24', 'glasses'),
  irina: L('f', 0, 'ponytail', 'e8d39a', 'jacket', 'cf6f9f', 'skirt', '2b2e36'),
  punktovich: L('mo', 0, 'parted', 'c9c9c9', 'jacket', '1f1f24', 'formal', '1f1f24', 'glasses'),
  director: L('big', 0, 'parted', '7b4a2a', 'jacket', '1f1f24', 'formal', '1f1f24', 'mustache'),
  chef: L('big', 1, 'buzzcut', '2a2120', 'shirt', 'f2f0ea', 'pants', 'f2f0ea', 'mustache'),
  ashot: L('m', 1, 'curly', '2a2120', 'vest', 'f2f0ea', 'pants', '2b2e36', 'beard'),
  babushka: L('f', 0, 'page', 'c9c9c9', 'long', '8a5fa8', 'skirt', '6b5845'),
  pilot: L('m', 0, 'buzzcut', '7b4a2a', 'jacket', 'e0703a', 'pants', '50613f'),
  blogger: L('m', 2, 'spiked', 'd9a441', 'tee', 'cf6f9f', 'pants', '3b4f7a', 'glasses'),
  valya: L('f', 1, 'page', '7b4a2a', 'vest', 'b04a42', 'skirt', '485366'),
  courier: L('m', 0, 'messy', '4a3121', 'jacket', 'd9a33a', 'pants', '2b2e36'),
  // legacy Kenney keys
  survivor: L('m', 0, 'messy', '4a3121', 'tee', '5f86a8', 'pants', '2b2e36'),
  soldier: L('m', 1, 'buzzcut', '2a2120', 'jacket', '50613f', 'pants', '50613f'),
  hitman: L('m', 0, 'parted', '2a2120', 'jacket', '2e3440', 'formal', '1f1f24'),
  womanGreen: L('f', 0, 'long', '7b4a2a', 'blouse', '6d8b4e', 'skirt', '2b2e36'),
  manBlue: L('m', 0, 'parted', '4a3121', 'shirt', '5f86a8', 'formal', '485366'),
  manBrown: L('m', 1, 'curly', '2a2120', 'long', '7b6a58', 'pants', '6b5845'),
  manOld: L('mo', 0, 'balding', 'c9c9c9', 'vest', '7b6a58', 'formal', '6b5845', 'glasses'),
  robot: L('m', 3, 'buzzcut', '2a2120', 'plate', 'a39a86', 'pants', '2b2e36'),
  zombie: L('m', 2, 'messy', '2a2120', 'tee', '4d5a52', 'pants', '6b5845'),
};

export function resolveLook(key: string | undefined | null): Look {
  if (key) {
    const direct = key.includes('.') ? decodeLook(key) : null;
    if (direct) return direct;
    const preset = LOOK_PRESETS[key];
    if (preset) return decodeLook(preset)!;
  }
  return decodeLook(LOOK_PRESETS.manBlue)!;
}

/** Small deterministic PRNG for picking random-but-stable looks. */
function hash(n: number) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; }

/** Random coworker look; `seed` keeps it stable across clients. */
export function randomLook(seed: number, body?: BodyType): string {
  let s = hash(seed + 1013);
  const r = (n: number) => { s = hash(s); return s % n; };
  const b: BodyType = body ?? (r(2) ? 'f' : 'm');
  const e = b === 'big' ? 'm' : b;
  const pick = <T>(a: readonly T[]) => a[r(a.length)];
  return encodeLook({
    body: b, old: r(9) === 0, skin: r(SKIN_TONES.length), hair: pick(EDITOR.hair[e]), hairColor: pick(HAIR_COLORS.slice(0, 7)),
    top: pick(EDITOR.top[e]), topColor: pick(CLOTH_COLORS), legs: pick(EDITOR.legs[e]), legsColor: pick(LEGS_COLORS),
    acc: r(4) === 0 ? pick(EDITOR.acc) : 'none',
  });
}

/** Look of a mutant that was never a named NPC: silhouette and outfit follow the enemy type. */
export function enemyLook(type: EnemyType, seed: number): string {
  const base = decodeLook(randomLook(seed))!;
  switch (type) {
    case 'fat': return encodeLook({ ...base, body: 'big', old: false, top: 'shirt', legs: 'formal', acc: hash(seed) % 3 ? 'none' : 'mustache' });
    case 'fast': return encodeLook({ ...base, old: false, top: 'tee', topColor: ['e0703a', 'd9a33a', 'cf6f9f'][seed % 3] });
    case 'spitter': return encodeLook({ ...base, acc: 'glasses', topColor: '6d8b4e', top: base.body === 'f' ? 'blouse' : 'shirt' });
    case 'armored': return encodeLook({ ...base, body: 'm', old: false, top: 'plate', topColor: 'a39a86', legs: 'pants', legsColor: '1f1f24', acc: 'none' });
    case 'exploder': return encodeLook({ ...base, body: 'm', top: 'apron', topColor: '9be22e', legs: 'pants', acc: 'glasses' });
    case 'jumper': return encodeLook({ ...base, body: 'm', old: false, top: 'tee', topColor: ['d9a33a', '3c7f9a', 'b04a42'][seed % 3], legs: 'pants', legsColor: '2b2e36', acc: 'none' });
    case 'boss': return L('big', 0, 'balding', 'c2452d', 'jacket', '1f2a3a', 'formal', '1f1f24');
    default: return encodeLook(base);
  }
}
