// Gameplay data for props placed via Tiled object layers.
// solid: blocks movement · bullets: blocks bullets · inset: shrink collider (px) · top: draw above characters
export interface PropDef { solid: boolean; bullets: boolean; inset?: number; top?: boolean; round?: boolean; light?: number; hp?: number }

const SOLID: PropDef = { solid: true, bullets: false, inset: 4 };
const HARD: PropDef = { solid: true, bullets: true, inset: 3 };
const FLAT: PropDef = { solid: false, bullets: false };

export const PROP_DEFS: Record<string, PropDef> = {
  crate: HARD, crate_small: HARD, crate_rot: HARD, crate_small_rot: HARD,
  barrel: { ...HARD, round: true }, barrel_grey: { ...HARD, round: true }, barrel_open: { ...HARD, round: true },
  hazard_barrel: { ...HARD, round: true },
  oil: FLAT, note: FLAT, blood_trail: FLAT, feather_pile: FLAT, plates: FLAT, ceiling_light: { ...FLAT, top: true },
  plant: { solid: true, bullets: false, inset: 14, top: true }, plant_small: { solid: false, bullets: false, top: true },
  bush: { solid: true, bullets: false, inset: 10, top: true }, tree: { solid: true, bullets: true, inset: 40, top: true },
  chair_0: FLAT, chair_1: FLAT, chair_2: FLAT, chair_3: FLAT, office_chair: FLAT, stool: FLAT,
  armchair_green: SOLID, armchair_orange: SOLID, armchair_orange2: SOLID, armchair_dark: SOLID, armchair_dark2: SOLID, chair_blue: SOLID,
  sofa_green: SOLID, sofa_orange: SOLID, sofa_dark: SOLID,
  coffee_table: SOLID, table_round: { ...SOLID, round: true }, table_small: SOLID, table_long: SOLID, table_wide: SOLID, table_end: SOLID, table_big: SOLID,
  tv: SOLID, lamp: SOLID, bin: { ...SOLID, round: true }, speaker: SOLID,
  counter_a: HARD, counter_b: HARD, counter_c: HARD, counter_d: HARD, stove: HARD, hob: HARD, sink: HARD, hob_dark: HARD,
  aquarium: HARD, rock_0: HARD, rock_1: HARD, tub: HARD,
  desk: SOLID, desk_b: SOLID, reception: HARD,
  server_rack: HARD, water_cooler: { ...HARD, round: true }, printer: HARD, cabinet: HARD, vending: HARD,
  whiteboard: FLAT, poster: FLAT, poster_b: FLAT, sign_exit: { ...FLAT, top: true },
  lab_bench: SOLID, egg_pod: { ...HARD, round: true }, egg_pod_broken: { ...HARD, round: true }, lab_console: HARD,
  machine: HARD, generator: HARD, conveyor: SOLID, pallet: SOLID, pipe_h: FLAT, shelf: HARD, forklift: HARD,
  terminal: HARD, elevator: FLAT, emergency_light: { ...FLAT, top: true, light: 0xff2a1a },
};

export function propDef(name: string): PropDef {
  return PROP_DEFS[name] ?? SOLID;
}
