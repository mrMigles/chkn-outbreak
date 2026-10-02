export type WeaponId = 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'machinegun' | 'grenade' | 'flamethrower';

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'rifle', 'machinegun', 'grenade', 'flamethrower'];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: 'hitscan' | 'grenade' | 'flame';
  damage: number;
  rof: number;          // shots per second
  pellets: number;
  spread: number;       // base half-angle (rad)
  bloom: number;        // spread added per shot
  maxBloom: number;
  range: number;
  mag: number;
  reserveMax: number;   // -1 = infinite
  pickupAmmo: number;   // reserve gained from an ammo box
  reload: number;       // seconds
  knockback: number;    // px/s impulse on enemies
  pierce: number;       // extra enemies a bullet passes through
  speedMul: number;     // player move speed multiplier while holding
  // feel (client)
  recoil: number;       // visual kick px
  shake: number;        // camera shake intensity
  flash: 'flash_pistol' | 'flash_long' | 'flash_wide' | 'flash_star' | 'flash_flame';
  flashScale: number;
  tracer: number;       // tint, 0 = none
  tracerWidth: number;
  casing: 'casing' | 'shell' | null;
  light: number;        // radius of muzzle light
  // projectiles
  projSpeed?: number;
  splash?: number;
  fuel?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'Табельный ПМ', kind: 'hitscan', damage: 24, rof: 5.5, pellets: 1, spread: 0.025, bloom: 0.03, maxBloom: 0.08,
    range: 900, mag: 12, reserveMax: -1, pickupAmmo: 0, reload: 1.0, knockback: 120, pierce: 0, speedMul: 1,
    recoil: 4, shake: 0.004, flash: 'flash_pistol', flashScale: 1.1, tracer: 0xffe9a8, tracerWidth: 1, casing: 'casing', light: 170,
  },
  smg: {
    id: 'smg', name: 'Пистолет-пулемёт «Дедлайн»', kind: 'hitscan', damage: 13, rof: 15, pellets: 1, spread: 0.06, bloom: 0.012, maxBloom: 0.14,
    range: 760, mag: 42, reserveMax: 336, pickupAmmo: 126, reload: 1.35, knockback: 70, pierce: 0, speedMul: 1,
    recoil: 3, shake: 0.003, flash: 'flash_pistol', flashScale: 1.0, tracer: 0xffd27a, tracerWidth: 0.9, casing: 'casing', light: 160,
  },
  shotgun: {
    id: 'shotgun', name: 'Дробовик «Тимбилдинг»', kind: 'hitscan', damage: 15, rof: 1.7, pellets: 10, spread: 0.2, bloom: 0, maxBloom: 0,
    range: 560, mag: 8, reserveMax: 64, pickupAmmo: 16, reload: 1.9, knockback: 210, pierce: 0, speedMul: 0.97,
    recoil: 11, shake: 0.014, flash: 'flash_wide', flashScale: 1.3, tracer: 0xffc066, tracerWidth: 0.85, casing: 'shell', light: 260,
  },
  rifle: {
    id: 'rifle', name: 'Автомат «KPI-47»', kind: 'hitscan', damage: 30, rof: 9.5, pellets: 1, spread: 0.022, bloom: 0.01, maxBloom: 0.06,
    range: 1100, mag: 30, reserveMax: 240, pickupAmmo: 90, reload: 1.7, knockback: 150, pierce: 1, speedMul: 0.95,
    recoil: 5, shake: 0.006, flash: 'flash_long', flashScale: 1.0, tracer: 0xfff0b0, tracerWidth: 1.3, casing: 'casing', light: 210,
  },
  machinegun: {
    id: 'machinegun', name: 'Пулемёт «Квартальный отчёт»', kind: 'hitscan', damage: 24, rof: 14, pellets: 1, spread: 0.05, bloom: 0.008, maxBloom: 0.11,
    range: 1100, mag: 150, reserveMax: 450, pickupAmmo: 150, reload: 3.0, knockback: 170, pierce: 2, speedMul: 0.78,
    recoil: 6, shake: 0.008, flash: 'flash_long', flashScale: 1.3, tracer: 0xffb347, tracerWidth: 1.7, casing: 'casing', light: 250,
  },
  grenade: {
    id: 'grenade', name: 'Гранатомёт «Оптимизация»', kind: 'grenade', damage: 160, rof: 1.5, pellets: 1, spread: 0.02, bloom: 0, maxBloom: 0,
    range: 1000, mag: 6, reserveMax: 30, pickupAmmo: 8, reload: 2.3, knockback: 520, pierce: 0, speedMul: 0.92,
    recoil: 13, shake: 0.01, flash: 'flash_star', flashScale: 1.1, tracer: 0, tracerWidth: 0, casing: null, light: 240,
    projSpeed: 820, splash: 150,
  },
  flamethrower: {
    id: 'flamethrower', name: 'Огнемёт «Выгорание»', kind: 'flame', damage: 7, rof: 20, pellets: 1, spread: 0.12, bloom: 0, maxBloom: 0,
    range: 260, mag: 160, reserveMax: 480, pickupAmmo: 160, reload: 2.2, knockback: 40, pierce: 99, speedMul: 0.95,
    recoil: 1.5, shake: 0.0025, flash: 'flash_flame', flashScale: 1, tracer: 0, tracerWidth: 0, casing: null, light: 300,
    projSpeed: 520, fuel: true,
  },
};
