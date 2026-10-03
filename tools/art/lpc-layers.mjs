// Universal LPC layers used by the runtime character compositor (src/client/render/Looks.ts).
// `dir` is relative to ULPC `spritesheets/`; `variant` selects `<dir>/<anim>/<variant>.png` sheets.
// Every layer ships the `walk` (9×4 frames) and `hurt` (6 frames, south) animations; `thrust` (8×4) is
// used for the armed pose (hands forward) and is optional per layer.
export const ULPC_REVISION = '4963a69795255fb15a934c47f478a8bdcf3668f5';
export const ANIMS = ['walk', 'hurt', 'thrust'];
/** Animations a layer may lack (the compositor falls back to the walk frame). */
export const OPTIONAL_ANIMS = ['thrust'];

export const LAYERS = [
  // bodies / heads
  { id: 'body_m', dir: 'body/bodies/male' },
  { id: 'body_f', dir: 'body/bodies/female' },
  { id: 'body_big', dir: 'body/bodies/muscular' },
  { id: 'head_m', dir: 'head/heads/human/male' },
  { id: 'head_f', dir: 'head/heads/human/female' },
  { id: 'head_plump', dir: 'head/heads/human/male_plump' },
  { id: 'head_old_m', dir: 'head/heads/human/male_elderly' },
  { id: 'head_old_f', dir: 'head/heads/human/female_elderly' },
  // hair
  { id: 'hair_parted', dir: 'hair/parted/adult' },
  { id: 'hair_buzzcut', dir: 'hair/buzzcut/adult' },
  { id: 'hair_spiked', dir: 'hair/spiked/adult' },
  { id: 'hair_messy', dir: 'hair/messy1/adult' },
  { id: 'hair_balding', dir: 'hair/balding/adult' },
  { id: 'hair_curly', dir: 'hair/curly_short/adult' },
  { id: 'hair_afro', dir: 'hair/afro/adult' },
  { id: 'hair_bob', dir: 'hair/bob/adult' },
  { id: 'hair_pixie', dir: 'hair/pixie/adult' },
  { id: 'hair_long', dir: 'hair/long/adult' },
  { id: 'hair_ponytail', dir: 'hair/ponytail/adult/fg' },
  { id: 'hair_ponytail_bg', dir: 'hair/ponytail/adult/bg' },
  { id: 'hair_bangslong', dir: 'hair/bangslong/adult' },
  { id: 'hair_lob', dir: 'hair/lob/adult' },
  { id: 'hair_page', dir: 'hair/page/adult' },
  // tops
  { id: 'top_shirt_m', dir: 'torso/clothes/longsleeve/formal/male' },
  { id: 'top_long_m', dir: 'torso/clothes/longsleeve/longsleeve/male' },
  { id: 'top_long_f', dir: 'torso/clothes/longsleeve/longsleeve/female' },
  { id: 'top_tee_m', dir: 'torso/clothes/shortsleeve/tshirt/male' },
  { id: 'top_tee_f', dir: 'torso/clothes/shortsleeve/tshirt/female' },
  { id: 'top_blouse_f', dir: 'torso/clothes/blouse/female', variant: 'white' },
  { id: 'top_jacket_m', dir: 'torso/jacket/collared/male', variant: 'white' },
  { id: 'top_vest_m', dir: 'torso/clothes/vest/male', variant: 'white' },
  { id: 'top_plate_m', dir: 'torso/armour/plate/male' },
  { id: 'top_leather_m', dir: 'torso/armour/leather/male' },
  { id: 'top_apron_m', dir: 'torso/aprons/apron/male', variant: 'white' },
  // D72: Катя's swimsuit (tank top + short shorts), Толик's shorts
  { id: 'top_tank_f', dir: 'torso/clothes/sleeveless/tanktop/female', variant: 'white' },
  // legs / feet
  { id: 'legs_pants_m', dir: 'legs/pants/male' },
  { id: 'legs_pants_f', dir: 'legs/pants/thin' },
  { id: 'legs_formal_m', dir: 'legs/formal/male' },
  { id: 'legs_formal_f', dir: 'legs/formal/thin' },
  { id: 'legs_skirt_f', dir: 'legs/skirts/plain/thin' },
  { id: 'legs_shorts_f', dir: 'legs/shorts/short_shorts/thin' },
  { id: 'legs_shorts_m', dir: 'legs/shorts/short_shorts/male' },
  { id: 'feet_m', dir: 'feet/shoes/basic/male' },
  { id: 'feet_f', dir: 'feet/shoes/basic/thin' },
  // accessories
  { id: 'acc_glasses', dir: 'facial/glasses/nerd/adult' },
  { id: 'acc_beard', dir: 'beards/beard/basic' },
  { id: 'acc_mustache', dir: 'beards/mustache/basic' },
  // boss
  { id: 'wings', dir: 'body/wings/feathered/adult/fg', variant: 'white' },
  { id: 'wings_bg', dir: 'body/wings/feathered/adult/bg', variant: 'white' },
];

export const layerFile = (l, anim) => `${l.dir}/${anim}${l.variant ? '/' + l.variant : ''}.png`;
