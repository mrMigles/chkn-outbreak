// Level source format compiled by tools/build-maps.ts into a Tiled map (.tmj).

export type Theme = 'office' | 'lab' | 'industrial' | 'office7';

/** Object placement. `at` is in TILE units (fractions allowed, 0.5 = centre of the first tile). */
export interface ObjSpec {
  type: string;                 // prop | spawn | enemy | npc | pickup | barrel | spawner | trigger | zone | light | label | use | door | chickenspawn
  name?: string;
  at: [number, number];
  size?: [number, number];      // tiles, for rect objects (trigger, zone, door); `at` = top-left for rects
  rot?: number;                 // props: 0 | 90 | 180 | 270
  props?: Record<string, string | number | boolean>;
}

export interface CellSpec {
  floor?: number | number[];    // Kenney tile index (0-based), random pick from array
  wall?: Theme | true;          // wall cell
  decor?: number;               // Kenney tile index on decor layer
  obj?: Omit<ObjSpec, 'at'> & { dx?: number; dy?: number };  // object anchored at the cell centre (+dx,dy tiles)
  door?: { id: string; locked?: string; theme?: Theme };
}

export interface LevelSource {
  id: string;
  theme: Theme;
  mapProps?: Record<string, string | number | boolean>;
  grid: string[];
  legend: Record<string, CellSpec>;
  /** optional second grid of same size: chars → legend objects placed over the base grid */
  overlay?: string[];
  overlayLegend?: Record<string, Omit<CellSpec, 'floor' | 'wall'>>;
  objects?: ObjSpec[];
  /** rugs: [x, y, w, h, color] in tiles → 9-slice Kenney rug on the decor layer */
  rugs?: [number, number, number, number, 'orange' | 'green'][];
}

// ---- Kenney floor tile indices (tilesheet_complete.png, 27 columns, 0-based)
export const F = {
  grass: [0, 1, 2, 3], dirt: [4, 5],
  labTile: [7, 8, 9, 10], labPlain: [9], concreteBlue: [6],
  white: [11], orangeDirt: [12, 13],
  wood: [41], woodV: [42], woodRed: [68], woodRedV: [69], woodLight: [95], woodLightV: [96],
  asphalt: [85], concrete: [6],
  carpetGreen: [400], carpetOrange: [397],
  labBig: [324, 325, 326],
} as const;
