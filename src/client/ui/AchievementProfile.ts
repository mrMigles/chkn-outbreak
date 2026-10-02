import { ACHIEVEMENTS, type AchievementKey } from '../../shared/achievements';

const STORAGE_KEY = 'chkn-achievements';
const known = (key: string): key is AchievementKey => Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, key);

/** Personal history only: callers pass achievements from their own authoritative player snapshot. */
export function earnedAchievements(): AchievementKey[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? [...new Set(value.filter((key): key is AchievementKey => typeof key === 'string' && known(key)))] : [];
  } catch { return []; }
}

export function rememberAchievements(keys: readonly string[]) {
  const earned = [...new Set([...earnedAchievements(), ...keys.filter(known)])];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(earned)); } catch { /* storage unavailable */ }
  return earned;
}

/** List of all achievements, earned ones marked (main menu, lobby, pause — D58). */
export function achievementsMarkup() {
  const earned = new Set(earnedAchievements());
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const entries = (Object.entries(ACHIEVEMENTS) as [AchievementKey, typeof ACHIEVEMENTS[AchievementKey]][]).map(([key, a]) =>
    `<li class="achievement-entry ${earned.has(key) ? 'earned' : 'locked'}"><span class="achievement-icon" aria-hidden="true">${a.icon}</span><div><b>${esc(a.name)}${earned.has(key) ? ' ✓' : ''}${'rare' in a ? ' <i class="rare">редкое</i>' : ''}</b><p>${esc(a.description)}</p></div></li>`).join('');
  return `<p class="flavor">${earned.size}/${Object.keys(ACHIEVEMENTS).length} · личная трудовая книжка на этом устройстве</p><ul class="achievement-list">${entries}</ul>`;
}
