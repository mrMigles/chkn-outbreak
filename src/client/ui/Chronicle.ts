// D72: chapter mini summaries (who killed how many, funny moments and achievements of each player), the whole
// run's personal statistics after the victory, and «Летопись» — every summary this device has seen.
import { ACHIEVEMENTS, type AchievementKey } from '../../shared/achievements';
import type { ChapterSummary, PlayerStats, SummaryPlayer } from '../../shared/sim/types';
import { PLAYER_COLORS } from '../render/Actors';

const KEY = 'chkn-chronicle';
export interface ChronicleEntry { at: number; where: string; summary: ChapterSummary }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const col = (slot: number) => '#' + PLAYER_COLORS[slot % 4].toString(16).padStart(6, '0');
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function loadChronicle(): ChronicleEntry[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e): e is ChronicleEntry => !!e && typeof e === 'object' && !!(e as ChronicleEntry).summary?.players) : [];
  } catch { return []; }
}

/** Keeps the newest 40 summaries; the same summary arriving twice (event + result panel) is stored once. */
export function saveChronicle(summary: ChapterSummary, where: string) {
  const list = loadChronicle();
  const sig = JSON.stringify(summary);
  if (list.some(e => JSON.stringify(e.summary) === sig)) return;
  list.push({ at: Date.now(), where, summary });
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-40))); } catch { /* storage unavailable */ }
}

const achList = (keys: string[]) => keys.filter((k): k is AchievementKey => k in ACHIEVEMENTS)
  .map(k => `<span class="sum-ach" title="${esc(ACHIEVEMENTS[k].description)}">${ACHIEVEMENTS[k].icon} ${esc(ACHIEVEMENTS[k].name)}</span>`).join('');

function playerCard(p: SummaryPlayer, me: boolean) {
  const s = p.stats;
  const nums: [number | string, string][] = [[s.kills, 'петушков'], [s.heads, 'в голову'], [s.downs, 'раз ранен'], [s.revives + s.heals, 'помощи'], [s.maxCombo ? '×' + s.maxCombo : '—', 'комбо']];
  return `<div class="sum-card ${me ? 'me' : ''}" style="--c:${col(p.slot)}">
    <div class="sum-name"><b>${esc(p.name)}${me ? ' (вы)' : ''}</b>${p.titles.map(t => `<i class="sum-title">${esc(t)}</i>`).join('')}</div>
    <div class="sum-nums">${nums.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    ${s.elites.length ? `<div class="sum-line">🏆 Добил(а): ${s.elites.map(esc).join(', ')}</div>` : ''}
    ${s.moments.length ? `<ul class="sum-moments">${s.moments.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${s.ach.length ? `<div class="sum-achs">${achList(s.ach)}</div>` : ''}
  </div>`;
}

/** The chapter's mini summary under the «Глава … пройдена» banner. */
export function summaryMarkup(summary: ChapterSummary, myId: string) {
  const players = [...summary.players].sort((a, b) => Number(b.id === myId) - Number(a.id === myId) || b.stats.kills - a.stats.kills);
  return `<div class="chapter-summary"><div class="menu-label">Итоги главы${summary.chapter ? ' · ' + esc(summary.chapter) : ''}</div>${players.map(p => playerCard(p, p.id === myId)).join('')}</div>`;
}

function bigStats(s: PlayerStats) {
  const acc = s.shots ? Math.min(999, Math.round(s.dmg / s.shots)) : 0;
  const rows: [string, string | number][] = [
    ['Петушков оптимизировано', s.kills], ['Попаданий в голову', s.heads], ['Урона нанесено', Math.round(s.dmg)], ['Выстрелов', s.shots],
    ['Урона на выстрел', acc], ['Урона получено', Math.round(s.taken)], ['Раз ранен', s.downs], ['Поднял(а) коллег', s.revives], ['Подлечил(а) и поделился(лась)', s.heals],
    ['Лучшее комбо', s.maxCombo ? '×' + s.maxCombo : '—'], ['На волоске', s.closeCalls], ['Петушков бочками', s.barrels], ['Этажей пройдено', s.floors], ['Время в бою', mmss(s.time)],
  ];
  return `<div class="final-grid">${rows.map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
}

/** D72: after the victory — the whole run, for me first, then the team in short. */
export function finalStatsMarkup(summary: ChapterSummary, myId: string) {
  const all = summary.final ?? [];
  const me = all.find(p => p.id === myId) ?? all[0];
  if (!me) return '';
  const others = all.filter(p => p !== me);
  return `<div class="final-stats"><div class="menu-label">Личная статистика за всю игру</div>
    <div class="sum-card me" style="--c:${col(me.slot)}"><div class="sum-name"><b>${esc(me.name)}</b>${me.titles.map(t => `<i class="sum-title">${esc(t)}</i>`).join('')}</div>
    ${bigStats(me.stats)}
    ${me.stats.elites.length ? `<div class="sum-line">🏆 Добил(а): ${me.stats.elites.map(esc).join(', ')}</div>` : ''}
    ${me.stats.moments.length ? `<ul class="sum-moments">${me.stats.moments.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}</div>
    ${others.length ? `<div class="menu-label">Команда</div><div class="plist">${others.map(p => `<div class="pl" style="--c:${col(p.slot)}"><b>${esc(p.name)}</b><span class="st">☠ ${p.stats.kills} · 🎯 ${p.stats.heads} · ✚ ${p.stats.revives + p.stats.heals}${p.titles[0] ? ' · ' + esc(p.titles[0]) : ''}</span></div>`).join('')}</div>` : ''}
  </div>`;
}

/** «Летопись» screen: every stored summary, newest first. */
export function chronicleMarkup() {
  const list = loadChronicle().reverse();
  if (!list.length) return '<p class="flavor">Пока пусто. Пройдите главу — здесь появятся её итоги: кто сколько уложил, кто кого спас и что пошло не так.</p>';
  return list.map((e) => {
    const d = new Date(e.at);
    const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const top = [...e.summary.players].sort((a, b) => b.stats.kills - a.stats.kills).map(p => `${esc(p.name)} ☠${p.stats.kills}`).join(' · ');
    return `<details class="chron"><summary><b>${esc(e.summary.title)}</b><span>${date} · ${esc(e.where)} · ${top}</span></summary>
      ${e.summary.players.map(p => playerCard(p, false)).join('')}
      ${e.summary.final ? `<div class="menu-label">Вся игра</div>${e.summary.final.map(p => `<div class="sum-card" style="--c:${col(p.slot)}"><div class="sum-name"><b>${esc(p.name)}</b></div>${bigStats(p.stats)}</div>`).join('')}` : ''}
    </details>`;
  }).join('');
}
