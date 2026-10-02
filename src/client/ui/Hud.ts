import { WEAPONS, WeaponId } from '../../shared/weapons';
import type { Player, WorldView } from '../../shared/sim/types';
import { PLAYER_COLORS } from '../render/Actors';
import { BUFFS, type BuffKind } from '../../shared/sim/types';
import { ACHIEVEMENTS, type AchievementKey } from '../../shared/achievements';
import { settings } from '../settings';
import { rememberAchievements } from './AchievementProfile';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export class Hud {
  el: HTMLDivElement;
  private q = <T extends HTMLElement = HTMLDivElement>(s: string) => this.el.querySelector(s) as T;
  private msgTimer = 0;
  private toastTimer = 0;
  private lastSlots = '';
  private comboShown = 0;
  private noticeQueue: { text: string; sub: string; tone: 'danger' | 'reward' | 'tip' }[] = [];
  private noticeTimer = 0;
  private popupAchievements = new Set<string>();
  private profileKeys = '';
  icons: Record<string, string> = {};

  constructor(touch = false) {
    this.el = document.createElement('div');
    this.el.className = 'hud' + (touch ? ' touch' : '');
    // D55: the top is one grid (corners + centre column), the bottom one stack, so panels can grow
    // without covering each other; phones keep the middle of the screen for the fight.
    this.el.innerHTML = `
      <div class="hud-vignette"></div>
      <div class="hud-top">
        <div class="top-hp">
          <div class="hp-wrap"><div class="hp-bar"><div class="hp-fill"></div><div class="hp-armor"></div></div><div class="hp-text"></div></div>
          <div class="hud-supplies"></div>
        </div>
        <div class="top-score"><div class="hud-score"></div></div>
        <div class="top-mid">
          <div class="hud-obj"><span class="obj-label">ЗАДАЧА</span><span class="obj-text"></span><span class="obj-dir hidden"><i>➤</i><b></b></span></div>
          <div class="hud-bonus hidden"><i>★</i><span></span><b></b></div>
          <div class="hud-boss hidden"><div class="boss-name">ГЕНЕРАЛЬНЫЙ ПЕТУХ</div><div class="boss-bar"><div class="boss-fill"></div></div></div>
          <div class="hud-incident hidden"><b></b><span></span></div>
        </div>
        <div class="top-left">
          <div class="hud-team"></div>
          <div class="hud-effects"><div class="hud-buffs"></div><div class="hud-achievements"></div></div>
          <div class="tip-slot"></div>
        </div>
        <div class="top-right">
          <div class="hud-combo"><span class="combo-n"></span><span class="combo-l">КОМБО</span></div>
          <div class="hud-notice" role="status" aria-live="polite"><b></b><span></span></div>
        </div>
      </div>
      <div class="hud-weapon">
        <div class="w-icon"></div>
        <div class="w-info"><div class="w-name"></div><div class="w-ammo"><span class="mag"></span><span class="res"></span></div><div class="w-reload"><div></div></div></div>
      </div>
      <div class="hud-slots"></div>
      <div class="hud-bottom">
        <div class="hud-radio"><b></b><span></span></div>
        <div class="hud-support"><span></span><div><i></i></div></div>
        <div class="hud-toast"></div>
        <div class="hud-hint"></div>
      </div>
      <div class="hud-msg"><div class="msg-title"></div><div class="msg-sub"></div></div>
      <div class="hud-state"></div>`;
    document.getElementById('ui')!.appendChild(this.el);
  }

  /** One compact alert at a time. Danger interrupts flavor and goes ahead of rewards. */
  notice(text: string, sub = '', tone: 'danger' | 'reward' | 'tip' = 'tip') {
    if (this.noticeQueue.some(n => n.text === text && n.sub === sub)) return;
    const entry = { text, sub, tone };
    if (tone === 'danger') {
      this.noticeQueue.unshift(entry);
      // The wave-start alert replaces the old countdown immediately.
      this.noticeTimer = 0;
    } else this.noticeQueue.push(entry);
    this.noticeQueue = this.noticeQueue.slice(0, 8);
    this.advanceNotice();
  }

  achievement(key: string) {
    if (!Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, key) || this.popupAchievements.has(key)) return;
    this.popupAchievements.add(key);
    if (!settings.achievementPopups) return;
    const a = ACHIEVEMENTS[key as AchievementKey];
    this.notice(`${a.icon} ${a.name}`, `Достижение · ${a.description}`, 'reward');
  }

  private advanceNotice() {
    if (this.noticeTimer > 0) return;
    const el = this.q('.hud-notice'), next = this.noticeQueue.shift();
    if (!next) { el.classList.remove('show'); return; }
    this.q('.hud-notice b').textContent = next.text;
    this.q('.hud-notice span').textContent = next.sub;
    el.dataset.tone = next.tone;
    el.classList.add('show');
    this.noticeTimer = next.tone === 'danger' ? 4 : 3.6;
  }

  message(title: string, sub = '', d = 3) {
    this.q('.msg-title').textContent = title;
    this.q('.msg-sub').textContent = sub;
    const m = this.q('.hud-msg');
    m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
    this.msgTimer = d;
  }
  toast(text: string) {
    const t = this.q('.hud-toast');
    t.textContent = text;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    this.toastTimer = 1.8;
  }
  /** Direction (screen angle) and distance in metres to the objective; null hides it. */
  guide(angle: number | null, metres = 0) {
    const el = this.el.querySelector<HTMLElement>('.obj-dir')!;
    el.classList.toggle('hidden', angle === null);
    if (angle === null) return;
    el.querySelector<HTMLElement>('i')!.style.transform = `rotate(${angle}rad)`;
    el.querySelector('b')!.textContent = metres + ' м';
  }

  objective(text: string) {
    this.q('.obj-text').textContent = text;
    const o = this.q('.hud-obj');
    o.classList.toggle('hidden', !text);
    o.classList.remove('flash');
    if (!settings.reducedFlashes) { void o.offsetWidth; o.classList.add('flash'); }
  }
  private radioTimer = 0;
  radio(who: string, text: string, d = 4) {
    this.q('.hud-radio b').textContent = who;
    this.q('.hud-radio span').textContent = text;
    const r = this.q('.hud-radio');
    r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
    this.radioTimer = d;
  }
  hint(text: string | null) {
    const h = this.q('.hud-hint');
    h.textContent = text ?? '';
    h.classList.toggle('show', !!text);
  }
  damage(amount: number) {
    if (settings.reducedFlashes) return;
    const v = this.q('.hud-vignette');
    v.style.opacity = String(Math.min(0.85, 0.3 + amount / 40));
    v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade');
  }

  update(dt: number, view: WorldView, me: Player | undefined, solo: boolean) {
    this.el.classList.toggle('reduced-flashes', settings.reducedFlashes);
    this.noticeTimer -= dt;
    this.advanceNotice();
    this.msgTimer -= dt;
    if (this.msgTimer <= 0) this.q('.hud-msg').classList.remove('show');
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) this.q('.hud-toast').classList.remove('show');
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) this.q('.hud-radio').classList.remove('show');
    if (!me) return;
    const keys = [...new Set(me.achievements ?? [])].sort().join(',');
    if (keys !== this.profileKeys) { this.profileKeys = keys; rememberAchievements(me.achievements ?? []); }
    this.updateIncident(view, me);
    this.updateBonus(dt, view);
    this.q('.hud-supplies').innerHTML = `<span title="Аптечки">✚ ${me.supplies?.medkit ?? 0}</span><span title="Патроны для друзей">▣ ${me.supplies?.ammo ?? 0}</span>`;
    const action = me.support;
    const helping = !!action && !action.cancelled && !action.completed && action.kind !== 'ammo';
    this.q('.hud-support').classList.toggle('show', helping);
    if (helping) {
      const name = view.players.find(p => p.id === action!.target)?.name ?? '';
      this.q('.hud-support span').textContent = (action!.kind === 'revive' ? 'Поднимаем ' : 'Лечим ') + name;
      this.q('.hud-support i').style.width = `${action!.progress * 100}%`;
    }
    // hp
    const hpPct = Math.max(0, me.hp / me.maxHp) * 100;
    this.q('.hp-fill').style.width = hpPct + '%';
    this.q('.hp-fill').classList.toggle('low', hpPct < 30);
    this.q('.hp-fill').classList.toggle('chicken', me.state === 'chicken');
    this.q('.hp-armor').style.width = Math.min(100, me.armor) + '%';
    this.q('.hp-text').textContent = `${Math.ceil(me.hp)}${me.armor > 0 ? '  ◈' + Math.ceil(me.armor) : ''}`;
    // weapon
    const w = me.weapons[me.cur] as WeaponId | undefined;
    if (w) {
      const def = WEAPONS[w];
      const a = me.ammo[w];
      this.q('.w-name').textContent = def.name;
      this.q('.mag').textContent = String(a?.mag ?? 0);
      this.q('.res').textContent = a && a.reserve >= 0 ? ' / ' + a.reserve : ' / ∞';
      this.q('.mag').classList.toggle('empty', (a?.mag ?? 0) === 0);
      const ic = this.q('.w-icon');
      if (ic.dataset.w !== w && this.icons['w_' + w]) { ic.dataset.w = w; ic.style.backgroundImage = `url(${this.icons['w_' + w]})`; }
      const rl = this.q('.w-reload');
      rl.classList.toggle('show', me.reloadT > 0);
      if (me.reloadT > 0) (rl.firstElementChild as HTMLElement).style.width = (100 * (1 - me.reloadT / def.reload)) + '%';
    }
    const slotsKey = me.weapons.join(',') + ':' + me.cur;
    if (slotsKey !== this.lastSlots) {
      this.lastSlots = slotsKey;
      this.q('.hud-slots').innerHTML = me.weapons.map((wid, i) =>
        `<div class="slot ${i === me.cur ? 'cur' : ''}" data-i="${i}"><span>${i + 1}</span><i style="background-image:url(${this.icons['w_' + wid] ?? ''})"></i></div>`).join('');
    }
    // combo
    const combo = me.combo;
    const c = this.q('.hud-combo');
    if (combo >= 5) {
      c.classList.add('show');
      if (combo !== this.comboShown) {
        this.q('.combo-n').textContent = 'x' + combo;
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        c.style.setProperty('--heat', String(Math.min(1, combo / 60)));
      }
    } else c.classList.remove('show');
    this.comboShown = combo;
    this.q('.hud-score').textContent = `☠ ${me.kills}   ★ ${Math.floor(me.score)}`;
    this.q('.hud-buffs').innerHTML = (Object.entries(me.buffs ?? {}) as [BuffKind, number][]).filter(([, t]) => t > 0).map(([k, t]) => `<span style="--buff:${hex(BUFFS[k].color)}">${BUFFS[k].icon} ${BUFFS[k].label} <b>${Math.ceil(t)}с</b></span>`).join('');
    const earned = (me.achievements ?? []).filter((key): key is AchievementKey => Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, key));
    const latest = earned.at(-1);
    this.q('.hud-achievements').textContent = latest ? `🏅 ${earned.length} · ${ACHIEVEMENTS[latest].name}` : '';
    // boss
    const boss = view.bossId >= 0 ? view.enemies.find((e) => e.id === view.bossId) : undefined;
    this.q('.hud-boss').classList.toggle('hidden', !boss);
    if (boss) this.q('.boss-fill').style.width = (100 * boss.hp / boss.maxHp) + '%';
    // team (multiplayer)
    if (!solo) {
      this.q('.hud-team').innerHTML = view.players.filter((p) => p.id !== me.id).map((p) => {
        const st = p.state === 'chicken' ? '🐔' : p.state === 'downed' ? '✚' : p.state === 'dead' ? '…' : '';
        return `<div class="mate" style="--c:${hex(PLAYER_COLORS[p.slot % 4])}"><b>${escapeHtml(p.name)}</b> ${st}<i style="width:${Math.max(0, p.hp / p.maxHp * 100)}%"></i></div>`;
      }).join('');
    }
    const st = this.q('.hud-state');
    if (me.state === 'downed') { st.textContent = `ВЫ РАНЕНЫ — ждите помощи (${Math.ceil(me.downT)})`; st.className = 'hud-state show downed'; }
    else if (me.state === 'chicken') { st.textContent = 'ВЫ — КУРИЦА. Заклюйте бывших коллег!'; st.className = 'hud-state show chicken'; }
    else if (me.state === 'dead' && !solo && me.benched) { st.textContent = 'НАБЛЮДЕНИЕ · вы вернулись к погибшему персонажу — оживёте на следующем этаже'; st.className = 'hud-state show'; }
    else if (me.state === 'dead' && !solo) { st.textContent = 'НАБЛЮДЕНИЕ · вернётесь к команде в передышку'; st.className = 'hud-state show'; }
    else st.className = 'hud-state';
  }

  private bonusShownDone = 0;
  private bonusKey = '';
  /** D57 floor bonus: a quiet line under the objective; disappears a few seconds after success. */
  private updateBonus(dt: number, view: WorldView) {
    const b = view.bonus, el = this.q('.hud-bonus');
    if (!b || !settings.bonusGoals) { el.classList.add('hidden'); return; }
    if (b.done) this.bonusShownDone += dt; else this.bonusShownDone = 0;
    el.classList.toggle('hidden', b.done && this.bonusShownDone > 6);
    el.classList.toggle('done', b.done);
    const key = `${b.id}:${b.n}:${b.done}`;
    if (key === this.bonusKey) return;
    if (this.bonusKey && !b.done) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    this.bonusKey = key;
    this.q('.hud-bonus span').textContent = b.done ? 'Бонус этажа выполнен' : b.text;
    this.q('.hud-bonus b').textContent = b.done ? '✓' : `${b.n}/${b.goal}`;
  }

  private updateIncident(view: WorldView, me: Player) {
    const incidents = view.incidents ?? [];
    const rank = (phase: string) => phase === 'warning' ? 0 : 1;
    const urgent = incidents.filter(i => (i.phase === 'warning' || i.phase === 'active') &&
      !(i.kind === 'cache' && i.paused && Math.hypot(i.x - me.x, i.y - me.y) > 380))
      .sort((a, b) => rank(a.phase) - rank(b.phase) || a.seconds - b.seconds)[0];
    const nearby = incidents.filter(i => i.phase === 'ready' && Math.hypot(i.x - me.x, i.y - me.y) <= 380)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const incident = urgent ?? nearby;
    const el = this.q('.hud-incident');
    el.classList.toggle('hidden', !incident);
    this.el.classList.toggle('has-incident', !!incident);
    this.el.classList.toggle('incident-urgent', !!urgent);
    if (!incident) return;
    el.dataset.kind = incident.kind;
    el.dataset.phase = incident.phase;
    const seconds = `${Math.ceil(Math.max(0, incident.seconds))}с`;
    const active = incident.phase === 'active', warning = incident.phase === 'warning';
    const title = incident.kind === 'alarm' ? warning ? `🚨 Стая через ${seconds}` : active ? '🚨 Учебная тревога' : '🔕 Сигналка на пути'
      : incident.kind === 'coffee' ? active ? `☕ Кофейный перерыв · ${seconds}` : '☕ Кофе рядом'
      : active ? `📦 Терминал · ${seconds}` : '📦 Тайник переработки';
    const hint = incident.kind === 'alarm' ? warning ? 'E у пульта — отменить вызов' : active ? `Петушков осталось: ${incident.left}` : 'E у пульта — отключить · выстрелы включат тревогу'
      : incident.kind === 'coffee' ? active ? 'Кофе лечит. Передохните перед следующим боем.' : 'E у автомата — +15 здоровья и 10с бодрости'
      : active ? incident.paused ? 'Вернитесь к терминалу — загрузка на паузе' : 'Держитесь рядом: припасы за удержание' : 'E у терминала — 12с обороны за припасы';
    this.q('.hud-incident b').textContent = title;
    this.q('.hud-incident span').textContent = hint;
  }

  destroy() { this.el.remove(); }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
