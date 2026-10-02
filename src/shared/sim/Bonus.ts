// «Бонус этажа» (D57): one optional, always-visible skill goal per floor. It never blocks the story,
// changes nothing on failure and pays out once: KPI, a supply for everyone and an achievement.
// Driven only by simulation events, so solo, rooms and checkpoint replay agree.
import type { World } from './World';
import type { Enemy } from './types';
import type { AchievementKey } from '../achievements';

export interface BonusView { id: string; text: string; n: number; goal: number; done: boolean }
type Kind = 'blackout_kills' | 'headshots' | 'explosion_kills' | 'combo' | 'boss_headshots' | 'sleep_kills' | 'tag_kills';
interface Def { kind: Kind; goal: number; text: string; award: AchievementKey; done: string; tag?: string }

export const BONUSES: Record<string, Def> = {
  office: { kind: 'blackout_kills', goal: 25, text: 'Сисадмин дня: петушки во время перезагрузки', award: 'sysadmin_day', done: 'Серверная отстояна. Админы гордятся.' },
  office7: { kind: 'headshots', goal: 20, text: 'Точечный аудит: попадания в голову', award: 'headhunter', done: 'Двадцать точных замечаний по существу.' },
  lab: { kind: 'explosion_kills', goal: 10, text: 'Техника безопасности: петушки взрывами', award: 'demolition', done: 'Лаборатория немного короче, чем была.' },
  factory: { kind: 'combo', goal: 30, text: 'Конвейер: комбо без перерыва', award: 'conveyor', done: 'План перевыполнен. Премии не будет.' },
  // D69: the new floors of chapters 1–2
  office8: { kind: 'sleep_kills', goal: 10, text: 'Тихий час: петушки, убитые во сне', award: 'quiet_hour', done: 'Никто не проснулся. Почти.' },
  office11: { kind: 'tag_kills', tag: 'meeting', goal: 30, text: 'Регламент: петушки за совещание', award: 'reglament', done: 'Совещание закончилось вовремя. Впервые в истории.' },
  street1: { kind: 'tag_kills', tag: 'heli', goal: 35, text: 'Воздушная тревога: петушки у вертолёта', award: 'air_raid', done: 'Капитан Крылов отдаёт честь. Крылом.' },
  street2: { kind: 'tag_kills', tag: 'market', goal: 30, text: 'Санэпидстанция: петушки на рынке', award: 'sanepid', done: 'Рынок закрыт на санобработку.' },
  boss: { kind: 'boss_headshots', goal: 15, text: 'Неудобные вопросы: в голову директору', award: 'board_meeting', done: 'Совет директоров в замешательстве.' },
};

export class Bonus {
  view: BonusView | null;
  private def: Def | null;
  constructor(private w: World) {
    this.def = BONUSES[w.mapId] ?? null;
    this.view = this.def ? { id: w.mapId, text: this.def.text, n: 0, goal: this.def.goal, done: false } : null;
  }

  private add(n = 1) { if (this.view && !this.view.done) this.set(this.view.n + n); }
  private set(n: number) {
    const v = this.view, d = this.def;
    if (!v || !d || v.done || this.w.finished) return;
    v.n = Math.min(d.goal, Math.max(v.n, n));
    if (v.n < d.goal) return;
    v.done = true;
    for (const p of this.w.players) {
      p.score += 300;
      if (p.state === 'alive') { p.supplies.medkit = Math.min(3, p.supplies.medkit + 1); p.supplies.ammo = Math.min(3, p.supplies.ammo + 1); }
    }
    this.w.award(d.award);
    this.w.emit({ e: 'notice', tone: 'reward', text: '★ БОНУС ЭТАЖА ВЫПОЛНЕН', sub: `${d.done} +300 KPI, аптечка и патроны команде.` });
  }

  /** Every enemy death caused by a damage source (players, NPCs, barrels). */
  onKill(e: Enemy, by: string, tag: string | undefined, kind: string, head: boolean, asleep = false) {
    const d = this.def;
    if (!d || !this.w.players.some(p => p.id === by)) return;
    if (d.kind === 'blackout_kills' && tag === 'blackout') this.add();
    if (d.kind === 'headshots' && head) this.add();
    if (d.kind === 'explosion_kills' && kind === 'explosion' && e.type !== 'chick') this.add();
    if (d.kind === 'sleep_kills' && asleep) this.add();
    if (d.kind === 'tag_kills' && tag === d.tag && e.type !== 'chick') this.add();
  }
  onBossHead(by: string) { if (this.def?.kind === 'boss_headshots' && this.w.players.some(p => p.id === by)) this.add(); }
  onCombo(combo: number) { if (this.def?.kind === 'combo') this.set(combo); }
}
