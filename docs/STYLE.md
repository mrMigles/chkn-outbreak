# Style guide — CHKN OUTBREAK

## Direction for the next iteration (agreed 2026-10-02)

Use [PLAN-2.5D.md](PLAN-2.5D.md) and [ASSETS.md](ASSETS.md) for new 2.5D work. The target is detailed LPC-based pixel art in three-quarter view, source grid 32 px, logical world tile 64 units, directed character animation, visible faces and feet, furniture facades, floor-based depth sorting and a shared Liberated Palette. Free third-party packs are allowed after consistent adaptation and per-file license recording. Image generation is a last resort for a documented gap.

The [user reference](references/chkn-2.5d-reference.png) establishes the framing, light and atmosphere. The following rules describe the existing top-down executable and are preserved as historical context; strict 90° view, exclusive Kenney art and supersampled smooth outlines do not apply to the new iteration.

Implemented office prototype: native 64×64 LPC character frames, four directions with nine walking frames, integer ×2 scale, feet at y=62, weapons aimed independently 40 world units above the floor. Public furniture is anchored to its lower edge; walls fade when covering the local player. `pixelArt: true`, nearest filtering. The scene keeps logical orthogonal coordinates and unchanged movement/weapon data. `tools/art/lpc.mjs` is the adaptation source; `npm run check:art` checks completeness. Clothing variants currently share one body/hair family; final distinct employees, all weapons, doors, footprints and the remaining levels are still pending. Do not copy the current mixed legacy/new art as a final style standard.

## Original top-down style

Base: **Kenney Top-down Shooter** (CC0). Every new sprite must look like it belongs to that pack.

## Rules
- Camera: strict top-down (90°). Characters face **+X** in source art.
- Tile = **64 px**. Characters ≈ 33–45 px wide (Kenney humans), chickens 56–80 px, boss ≈ 180 px.
- Flat fills, no textures/noise. Outline = same hue darkened to ~70% (`shade(c, 0.72)`), 1.5–2 px.
- Rounded corners everywhere (r 2–10). Soft round shadow `rgba(0,0,0,0.13)` under characters.
- Highlights = lighter flat stripe/ellipse, never gradients (gradients only for light/FX textures).
- Draw supersampled ×4 and downscale (tools/art/lib.mjs `art()`), so edges match Kenney AA.

## Palette
| Use | Colours |
|---|---|
| Wall top | `#4a4a4a` |
| Office (wood) rim / dark / bevel | `#c48647` `#956536` `#d08e4a` |
| Lab rim / dark / bevel | `#a6c9cb` `#648587` `#94b4b6` |
| Industrial rim / dark / bevel | `#e86a17` `#a64a0f` `#565656` |
| Guns | `#3b3f44` `#545a61` `#737b84`, outline `#26292c` |
| Chicken feathers | `#f7f3ea`, outline `#b8ae98`; comb `#e0332f`; beak/claws `#f5a623`/`#f2b134` |
| Infection tells | red eyes `#ff3b30`, feather tufts bursting from shoulders |
| Blood | `#9b1418` / `#b3161b` ; acid `#9be22e` |

## Readability (combat)
- Players: coloured ring under feet + name; human silhouettes, dark gloves.
- Enemies: white/yellow heads with red comb + red eyes, bright shirts.
- FX are additive and short-lived; persistent mess (blood, feathers, casings, scorch) goes to a
  dimmed decal layer **under** characters, so the screen fills up without hiding anybody.

## Zones
- Office: wood floors (Kenney 41–46/68–73), carpets (rugs 342–428), kitchen tiles (11), wood-rim walls.
- Lab: blue-grey tiles (7–10, 270–411), lab-rim walls, mostly dark — lights carry the mood.
- Industrial: asphalt with markings (27–94), concrete, orange-rim walls, hazard stripes.
