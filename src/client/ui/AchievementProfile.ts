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
