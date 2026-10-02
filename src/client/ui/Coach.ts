// D57: small situational nudges on the client. Never changes rules — only words at the right moment:
// danger popups, combo milestones, the hero's and companions' quips, vibration on phones.
import type { Player, SimEvent, WorldView } from '../../shared/sim/types';
import { settings } from '../settings';
import type { Hud } from './Hud';

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

const COMBO: Record<number, [string, string]> = {
  10: ['x10 · КВАРТАЛЬНЫЙ ПЛАН', 'Так держать'],
  25: ['x25 · ГОДОВОЙ ПЛАН', 'Отдел кадров нервничает'],
  40: ['x40 · ПЯТИЛЕТКА ЗА ПЯТНИЦУ', 'Вас повысят. Посмертно — шутка'],
};
const HERO = {
  combo: ['Конвейер работает!', 'Следующий!', 'Кто ещё на совещание?', 'Минус ещё одна планёрка.'],
  low: ['Мне бы отгул…', 'Больничный! Срочно!', 'Так, без паники. Ладно, с паникой.'],
  fat: ['Средний менеджмент уволен.', 'Сокращение штата!'],
  reload: ['Перезаряжаю, прикройте!', 'Минутку, патроны!'],
  surrounded: ['Их слишком много!', 'Окружают, как в пятницу у кофемашины!'],
  boss: ['Это и есть генеральный?', 'Ну что, обсудим KPI.'],
  elite: ['Ну и начальство пошло.', 'Это не повышение. Это мутация.', 'Сейчас обсудим твой KPI.'],
};
const COMPANION = [
  'Я, между прочим, в отпуск собирался.',
  'Кто-нибудь сохранил презентацию?',
  'Если выживем — сделаю ретро. Обязательное.',
  'Слышите? Это квартальный отчёт кудахчет.',
  'Говорил же — не пейте КУКАРЕКС натощак.',
  'Интересно, переработку оплатят?',
  'У меня в календаре на это время — «синк».',
  'Ко… Шучу. Я в порядке. Наверное.',
];

export class Coach {
  private quipT = 6;
  private companionT = 25;
  private quietT = 0;
  private surroundT = 0;
  private lastCombo = 0;
  private told = new Set<string>();
  private buzzT = 0;

  constructor(private hud: Hud, private myId: string, private say: (who: string, text: string, d: number) => void, private touch: boolean) {}

  private quip(kind: keyof typeof HERO, chance = 1) {
    if (!settings.banter || this.quipT > 0 || Math.random() > chance) return;
    this.quipT = 14;
    this.say(this.myId, pick(HERO[kind]), 2.2);
  }
  private once(key: string, text: string, sub: string, tone: 'danger' | 'reward' | 'tip' = 'tip') {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.hud.notice(text, sub, tone);
  }
  vibrate(ms: number) {
    if (!settings.vibration || !this.touch || this.buzzT > 0) return;
    this.buzzT = 0.12;
    try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
  }

  event(ev: SimEvent) {
    if (ev.e === 'pdmg' && ev.id === this.myId) this.vibrate(ev.d > 25 ? 60 : 25);
    if (ev.e === 'down' && ev.id === this.myId) this.vibrate(220);
    if (ev.e === 'kill' && ev.by === this.myId && ev.t === 'fat') this.quip('fat', 0.5);
    if (ev.e === 'kill' && ev.by === this.myId && ev.hs) this.once('headshot', 'В ГОЛОВУ — ×2 УРОНА', 'Целься чуть выше центра — так петушки падают вдвое быстрее.', 'tip');
    if (ev.e === 'reload' && ev.id === this.myId && this.quietT === 0) this.quip('reload', 0.35);
  }

  update(dt: number, view: WorldView, me: Player | undefined) {
    this.quipT -= dt; this.companionT -= dt; this.surroundT -= dt; this.buzzT -= dt;
    if (!me || me.state !== 'alive') return;
    // combo milestones
    for (const n of [10, 25, 40]) if (me.combo >= n && this.lastCombo < n) {
      this.hud.message(COMBO[n][0], COMBO[n][1], 1.6);
      if (n === 10) this.quip('combo', 0.6);
    }
    this.lastCombo = me.combo;
    // surrounded: many chickens close by
    let close = 0, near = 0;
    for (const e of view.enemies) {
      if (!e.aggro || e.state === 'rise' || e.hp <= 0) continue;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < 240) close++;
      if (d < 900) near++;
    }
    if (close >= 6 && this.surroundT <= 0) {
      this.surroundT = 40;
      this.hud.notice('ОКРУЖАЮТ!', 'Не стойте на месте: отходите к двери или коридору, чтобы они шли по одному.', 'danger');
      this.quip('surrounded');
    }
    if (me.hp < me.maxHp * 0.25) {
      this.quip('low', 0.5);
      if (me.supplies.medkit) this.once('medkit-low', 'ЗДОРОВЬЕ НА ИСХОДЕ', this.touch ? 'Удерживайте оранжевую кнопку действия — аптечка +40.' : 'Удерживайте E — аптечка +40.', 'danger');
    }
    const w = me.weapons[me.cur], a = w ? me.ammo[w] : undefined;
    if (a && a.reserve === 0 && a.mag === 0 && w !== 'pistol') this.once('dry-' + w, 'ПАТРОНЫ КОНЧИЛИСЬ', this.touch ? 'Нажмите на панель оружия — табельный пистолет бесконечен.' : 'Q или 1 — табельный пистолет бесконечен.', 'tip');
    if (view.bossId >= 0) this.quip(view.bossName ? 'elite' : 'boss', 0.02);
    // companions talk in quiet moments
    this.quietT = near === 0 ? this.quietT + dt : 0;
    if (settings.banter && this.quietT > 12 && this.companionT <= 0) {
      const mates = view.npcs.filter(n => n.mode === 'follow' && !n.mutation && Math.hypot(n.x - me.x, n.y - me.y) < 400);
      if (mates.length) { this.companionT = 45; this.say(pick(mates).id, pick(COMPANION), 3.2); }
    }
  }
}
