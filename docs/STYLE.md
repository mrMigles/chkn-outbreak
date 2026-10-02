# Style guide — CHKN OUTBREAK

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
