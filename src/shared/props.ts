// Gameplay data for props placed via Tiled object layers.
// solid: blocks movement · bullets: blocks bullets · inset: shrink collider (px) · top: draw above characters
/** hp: destructible (bullets/explosions break it, D36); mat: debris look; h: visual height for hit tests; drop: loot table. */
export type PropMat = 'wood' | 'plant' | 'glass' | 'tech' | 'metal';
export interface PropDef { solid: boolean; bullets: boolean; inset?: number; top?: boolean; round?: boolean; light?: number; hp?: number; mat?: PropMat; h?: number; drop?: 'crate' | 'vending' }

const SOLID: PropDef = { solid: true, bullets: false, inset: 4 };
const HARD: PropDef = { solid: true, bullets: true, inset: 3 };
const FLAT: PropDef = { solid: false, bullets: false };

const CRATE: PropDef = { ...HARD, hp: 55, mat: 'wood', h: 56, drop: 'crate' };
export const PROP_DEFS: Record<string, PropDef> = {
  crate: { ...CRATE, hp: 80 }, crate_small: CRATE, crate_rot: { ...CRATE, hp: 80 }, crate_small_rot: CRATE,
  barrel: { ...HARD, round: true }, barrel_grey: { ...HARD, round: true }, barrel_open: { ...HARD, round: true },
  hazard_barrel: { ...HARD, round: true },
  oil: FLAT, note: FLAT, blood_trail: FLAT, feather_pile: FLAT, plates: FLAT, ceiling_light: { ...FLAT, top: true },
  plant: { solid: true, bullets: false, inset: 14, top: true, hp: 18, mat: 'plant', h: 70 }, plant_small: { solid: false, bullets: false, top: true },
  bush: { solid: true, bullets: false, inset: 10, top: true }, tree: { solid: true, bullets: true, inset: 40, top: true },
  chair_0: FLAT, chair_1: FLAT, chair_2: FLAT, chair_3: FLAT, office_chair: FLAT, stool: FLAT,
  armchair_green: SOLID, armchair_orange: SOLID, armchair_orange2: SOLID, armchair_dark: SOLID, armchair_dark2: SOLID, chair_blue: SOLID,
  sofa_green: SOLID, sofa_orange: SOLID, sofa_dark: SOLID,
  coffee_table: SOLID, table_round: { ...SOLID, round: true }, table_small: SOLID, table_long: SOLID, table_wide: SOLID, table_end: SOLID, table_big: SOLID,
  tv: { ...SOLID, hp: 25, mat: 'tech', h: 60 }, lamp: { ...SOLID, hp: 12, mat: 'glass', h: 80 }, bin: { ...SOLID, round: true, hp: 15, mat: 'metal', h: 34 }, speaker: { ...SOLID, hp: 20, mat: 'tech', h: 50 },
  counter_a: HARD, counter_b: HARD, counter_c: HARD, counter_d: HARD, stove: HARD, hob: HARD, sink: HARD, hob_dark: HARD,
  aquarium: HARD, rock_0: HARD, rock_1: HARD, tub: HARD,
  desk: SOLID, desk_b: SOLID, reception: HARD,
  desk_light: SOLID, table_tennis: SOLID,
  server_rack: HARD, water_cooler: { ...HARD, round: true, hp: 25, mat: 'glass', h: 76 }, printer: { ...HARD, hp: 40, mat: 'tech', h: 50 }, cabinet: HARD,
  vending: { ...HARD, hp: 140, mat: 'tech', h: 96, drop: 'vending' },
  whiteboard: FLAT, poster: FLAT, poster_b: FLAT, sign_exit: { ...FLAT, top: true },
  lab_bench: SOLID, egg_pod: { ...HARD, round: true }, egg_pod_broken: { ...HARD, round: true }, lab_console: HARD,
  machine: HARD, generator: HARD, conveyor: SOLID, pallet: SOLID, pipe_h: FLAT, shelf: HARD, forklift: HARD,
  terminal: HARD, elevator: FLAT, emergency_light: { ...FLAT, top: true, light: 0xff2a1a },
  // D69: chapter 1 floors 8/11/12 and the city (footprints in artMeta via `foot`)
  ...Object.fromEntries(['taxi', 'red', 'blue', 'white', 'green', 'grey'].flatMap(c => ['', '_l', '_v'].map(v => [`car_${c}${v}`, { ...HARD, inset: 2 }]))),
  car_burnt: { ...HARD, inset: 2 },
  tree_round: { ...HARD, round: true, inset: 0 }, tree_oak: { ...HARD, round: true, inset: 0 }, tree_pine: { ...HARD, round: true, inset: 0 }, tree_big: { ...HARD, round: true, inset: 0 },
  hedge: { solid: true, bullets: false, inset: 6, hp: 40, mat: 'plant', h: 70 },
  street_lamp: { ...HARD, round: true, inset: 0 }, trash_can: { ...SOLID, round: true, hp: 30, mat: 'metal', h: 50 },
  fountain: { ...HARD, inset: 0 }, shopping_cart: { ...SOLID, hp: 25, mat: 'metal', h: 50 }, fence: { solid: true, bullets: false, inset: 0 },
  flowers_0: FLAT, flowers_1: FLAT, flowers_2: FLAT, bench: { ...SOLID, hp: 45, mat: 'wood', h: 40 },
  cone: { ...SOLID, round: true, inset: 2, hp: 8, mat: 'plant', h: 30 }, hydrant: { ...HARD, round: true, inset: 2 },
  kiosk: { ...HARD, inset: 2 }, stall: { ...SOLID, inset: 2, hp: 90, mat: 'wood', h: 80, drop: 'crate' }, bus_stop: { ...SOLID, inset: 2 }, billboard: { solid: true, bullets: false, inset: 0 },
  heli_wreck: { ...HARD, inset: 4 }, heli_side: FLAT,
  breaker: FLAT, desk_phone: FLAT, bar_stool: FLAT, portrait_ceo: FLAT, painting_wide: FLAT, painting_sea: FLAT, chicken_plate: FLAT, coffee_cup: FLAT,
  pano_0: FLAT, pano_1: FLAT, pano_2: FLAT,
};

export function propDef(name: string): PropDef {
  return PROP_DEFS[name] ?? SOLID;
}
