// Persistent per-player preferences (localStorage, always wrapped in try/catch).
export const settings = {
  name: 'Сотрудник',
  volume: 0.8,
  shake: 1,
  server: '',
};

try {
  const raw = localStorage.getItem('chkn-settings');
  if (raw) Object.assign(settings, JSON.parse(raw));
} catch { /* storage unavailable */ }

export function saveSettings() {
  try { localStorage.setItem('chkn-settings', JSON.stringify(settings)); } catch { /* ignore */ }
}

/** Text supersampling: crisp on WebGL; the Canvas renderer draws high-res text at the wrong size. */
export const TEXT_RES = () => ((window as any).__game?.renderer?.type === 2 ? 2 : 1);
