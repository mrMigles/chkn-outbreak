import type { World } from './World';
import type { IncidentView, Player } from './types';
import { dist } from '../math';

interface Incident extends IncidentView { group: string; hintShown: boolean; batches: number; nextBatch: number }
const POOL = ['fast', 'normal', 'fast', 'spitter', 'armored', 'exploder'] as const;

/** Optional, map-authored choices. Never replaces a level's story objective or alarm. */
export class Incidents {
  readonly views: Incident[];
  constructor(private w: World) {
    this.views = w.map.objects.filter(o => o.type === 'use' && ['alarm', 'coffee', 'cache'].includes(o.props.incident)).map(o => ({
      id: o.name, kind: o.props.incident, x: o.cx, y: o.cy, phase: 'ready', seconds: 0, left: 0,
      group: o.props.group || 'escort', hintShown: false, batches: 0, nextBatch: 0,
    }));
  }
  private notice(tone: 'danger' | 'reward' | 'tip', text: string, sub: string) { this.w.emit({ e: 'notice', tone, text, sub }); }
  private tag(i: Incident) { return 'incident:' + i.id; }
  damage(propId: number, by: string) {
    if (!this.w.players.some(p => p.id === by) && !this.w.npcs.some(n => n.id === by && n.weapon)) return;
    const o = this.w.map.objects.find(o => o.id === propId && o.props.incident === 'alarm');
    const i = this.views.find(i => i.id === o?.props.incidentId);
    if (!i || i.phase !== 'ready' || this.w.finished) return;
    i.phase = 'warning'; i.seconds = 3;
    this.notice('danger', 'СИГНАЛКА ЗАДЕТА', '3 секунды до вызова стаи! E у пульта — обесточить.');
    this.w.say('pa', 'Внимание! Незарегистрированная пятница. Всем петушкам прибыть на внеплановый дейли!', 4);
  }
  use(id: string, by: Player) {
    const i = this.views.find(i => i.id === id);
    if (!i) return false;
    if (this.w.finished) return true;
    const prop = this.w.map.objects.find(o => o.type === 'prop' && o.props.incidentId === i.id);
    if (i.kind === 'coffee' && prop && this.w.broken.includes(prop.id)) i.phase = 'disabled';
    if (i.kind === 'alarm') {
      if (i.phase === 'ready' || i.phase === 'warning') {
        i.phase = 'disabled'; i.seconds = 0;
        this.w.award('quiet_shift');
        this.notice('reward', 'СИГНАЛКА ОБЕСТОЧЕНА', 'Сегодня без внепланового дейли. +100 очков команде.');
        for (const p of this.w.players) p.score += 100;
      } else if (i.phase === 'active') this.notice('tip', 'ВЫЗОВ УЖЕ УШЁЛ', 'Подкрепления конечные. Разберитесь со стаей — получите припасы.');
      return true;
    }
    if (i.phase !== 'ready') return true;
    if (i.kind === 'coffee') {
      i.phase = 'done';
      for (const p of this.w.humanPlayers.filter(p => p.connected)) {
        p.hp = Math.min(p.maxHp, p.hp + 15); (p.buffs ??= {}).sprint = 10;
      }
      this.w.award('coffee_break');
      this.notice('reward', 'КОФЕЙНЫЙ ПЕРЕРЫВ', 'Команде +15 здоровья и 10 секунд бодрости. Термос пуст.');
      this.w.say(by.id, 'Без КУКАРЕКСА. Обычная тревожность — наша, родная.', 3);
    } else {
      i.phase = 'active'; i.seconds = 12; i.batches = 2; i.nextBatch = this.w.time;
      this.notice('tip', 'ПРИПАСЫ ПО ЗАЯВКЕ', 'Побудьте рядом с терминалом 12 секунд. Можно стрелять; уйдёте — загрузка подождёт.');
      this.w.say('pa', 'Ваш запрос важен для нас. Ожидайте под музыку из клювов.', 3.5);
    }
    return true;
  }
  update(dt: number) {
    if (this.w.finished) return;
    for (const i of this.views) {
      const prop = this.w.map.objects.find(o => o.type === 'prop' && o.props.incidentId === i.id);
      if (i.kind === 'coffee' && i.phase === 'ready' && prop && this.w.broken.includes(prop.id)) i.phase = 'disabled';
      const nearby = this.w.humanPlayers.some(p => p.connected && dist(p.x, p.y, i.x, i.y) < 230 && this.w.map.lineOfSight(p.x, p.y, i.x, i.y, false));
      if (i.phase === 'ready' && nearby && !i.hintShown) {
        i.hintShown = true;
        if (i.kind === 'alarm') this.notice('tip', 'ОСТОРОЖНО: СИГНАЛКА', 'Выстрел в красный пульт вызовет стаю. E рядом — обезвредить заранее.');
        if (i.kind === 'coffee') this.notice('tip', 'КОФЕ БЕЗ ПОБОЧЕК', 'E у автомата: +15 здоровья и ускорение команде. Один термос на этаж.');
        if (i.kind === 'cache') this.notice('tip', 'НЕОБЯЗАТЕЛЬНО: ПРИПАСЫ', 'E у терминала: короткая оборона за броню и патроны.');
      }
      if (i.phase === 'warning') {
        i.seconds = Math.max(0, i.seconds - dt);
        if (i.seconds <= 0) {
          i.phase = 'active'; i.batches = 3; i.nextBatch = this.w.time;
          this.notice('danger', 'ГИПЕРВОЛНА · 24 ПЕТУШКА', 'Три группы из коридоров. Уходите с линии огня и используйте бочки.');
        }
      }
      if (i.phase !== 'active') continue;
      if (i.batches > 0 && this.w.time >= i.nextBatch && this.w.enemies.length < 85) {
        this.w.spawnWave(i.group, [...POOL], i.kind === 'alarm' ? 8 : 6, .28, true, this.tag(i), true);
        i.batches--; i.nextBatch = this.w.time + (i.kind === 'alarm' ? 4 : 6);
      }
      i.left = this.w.countTag(this.tag(i)) + i.batches * (i.kind === 'alarm' ? 8 : 6);
      if (i.kind === 'cache') {
        i.paused = !this.w.humanPlayers.some(p => p.connected && dist(p.x, p.y, i.x, i.y) < 180 && this.w.map.lineOfSight(p.x, p.y, i.x, i.y, false));
        if (!i.paused) i.seconds = Math.max(0, i.seconds - dt);
        if (i.seconds > 0) continue;
        // A busy floor may suppress the second group. The promised timer still pays out.
        i.batches = 0;
      } else if (i.left > 0) continue;
      i.phase = 'done'; i.seconds = 0;
      const p = this.w.humanPlayers.find(p => p.connected && dist(p.x, p.y, i.x, i.y) < 250) ?? this.w.anyPlayer;
      if (p) {
        this.w.addPickup('ammo', p.x - 20, p.y);
        this.w.addPickup(i.kind === 'alarm' ? 'health' : 'infinite', p.x + 20, p.y, { ttl: 30 });
      }
      for (const p of this.w.players) { p.score += 250; p.armor = Math.min(100, p.armor + 20); }
      this.w.award(i.kind === 'alarm' ? 'fire_drill' : 'overtime_pay');
      this.notice('reward', i.kind === 'alarm' ? 'ТРЕВОГА ЗАКОНЧИЛАСЬ' : 'ПЕРЕРАБОТКА ОПЛАЧЕНА', 'Припасы рядом · +20 брони и +250 очков команде.');
    }
  }
}
