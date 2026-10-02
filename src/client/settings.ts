// Persistent per-player preferences (localStorage, always wrapped in try/catch).
export const settings = {
  name: 'Сотрудник',
  volume: 0.8,
  shake: 1,
  server: '',
  look: '',          // encoded appearance (shared/look.ts); '' = slot default
  music: 0.55,
  tutorials: true,
  banter: true,
  combatText: true,
  achievementPopups: true,
  reducedFlashes: false,
  // D57
  hudScale: 1,            // 0.85 compact · 1 normal · 1.15 large
  leftHanded: false,      // touch: aim on the left half, run on the right
  vibration: true,        // navigator.vibrate on hurt / heavy hits (Android)
  threatArrows: true,     // arrows at the screen edge for chickens out of view
  bonusGoals: true,       // show the floor bonus line
  ghostSticks: 0,         // how many levels showed the touch stick hints
  seenTips: [] as string[],
  // developer mode (?dev=1 or five taps on the logo): level select, god mode, full arsenal, hotkeys
  dev: false,
  devLevel: 'office',
  devGod: false,
  devArsenal: false,
};

try {
  const raw = localStorage.getItem('chkn-settings');
  if (raw) Object.assign(settings, JSON.parse(raw));
} catch { /* storage unavailable */ }

try {
  const dev = new URLSearchParams(location.search).get('dev');
  if (dev !== null) { settings.dev = dev !== '0'; localStorage.setItem('chkn-settings', JSON.stringify(settings)); }
} catch { /* ignore */ }

export function saveSettings() {
  try { localStorage.setItem('chkn-settings', JSON.stringify(settings)); } catch { /* ignore */ }
}

/** Text supersampling: crisp on WebGL; the Canvas renderer draws high-res text at the wrong size. */
export const TEXT_RES = () => ((window as any).__game?.renderer?.type === 2 ? 2 : 1);
