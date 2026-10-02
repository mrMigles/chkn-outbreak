import { WEAPONS, WeaponId } from '../../shared/weapons';
import type { Player, WorldView } from '../../shared/sim/types';
import { PLAYER_COLORS } from '../render/Actors';
import { BUFFS, type BuffKind } from '../../shared/sim/types';
import { ACHIEVEMENTS, type AchievementKey } from '../../shared/achievements';
import { settings } from '../settings';
import { rememberAchievements } from './AchievementProfile';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

// D67: the HUD runs every frame; writing unchanged text/classes/styles still invalidated style and layout
// twice a frame on phones. These only touch the DOM when the value really changes.
const shown = new WeakMap<Element, string>();
function setText(el: Element, v: string) { if (el.textContent !== v) el.textContent = v; }
function setHtml(el: Element, v: string) { if (shown.get(el) !== v) { shown.set(el, v); el.innerHTML = v; } }
function toggle(el: Element, c: string, on: boolean) { if (el.classList.contains(c) !== on) el.classList.toggle(c, on); }
function setStyle(el: HTMLElement, k: string, v: string) { if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); }
function setClass(el: Element, v: string) { if (el.className !== v) el.className = v; }

export class Hud {
  el: HTMLDivElement;
  private found = new Map<string, HTMLElement>();
  private q = <T extends HTMLElement = HTMLDivElement>(s: string) => { let e = this.found.get(s); if (!e) { e = this.el.querySelector(s) as HTMLElement; if (e) this.found.set(s, e); } return e as T; };
  private msgTimer = 0;
  private toastTimer = 0;
  private lastSlots = '';
  private comboShown = 0;
  private noticeQueue: { text: string; sub: string; tone: 'danger' | 'reward' | 'tip' }[] = [];
  private noticeTimer = 0;
  private popupAchievements = new Set<string>();
  private profileKeys = '';
  private watching = '';
  /** D66: whom a dead player is watching (and how to switch). */
  spectate(name: string | null, more = false, touch = false) {
    this.watching = name ? ` · следим за ${name}${more ? (touch ? ' (тап — следующий)' : ' (клик — следующий)') : ''}` : '';
  }
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
    // D64: phones gather every pop-up text (incident, alert, tip, radio) into one small feed in the free
    // corner — bottom-left in portrait, top-right in landscape — instead of the middle of the fight
    if (touch) {
      const feed = document.createElement('div');
      feed.className = 'hud-feed';
      for (const sel of ['.hud-incident', '.hud-notice', '.hud-radio', '.tip-slot']) feed.appendChild(this.q(sel));
      this.el.appendChild(feed);
    }
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
    if (!next) { toggle(el, 'show', false); return; }
    setText(this.q('.hud-notice b'), next.text);
    setText(this.q('.hud-notice span'), next.sub);
    el.dataset.tone = next.tone;
    el.classList.add('show');
    this.noticeTimer = next.tone === 'danger' ? 4 : 3.6;
  }

  message(title: string, sub = '', d = 3) {
    setText(this.q('.msg-title'), title);
    setText(this.q('.msg-sub'), sub);
    const m = this.q('.hud-msg');
    toggle(m, 'show', false); void m.offsetWidth; m.classList.add('show');
    this.msgTimer = d;
  }
  toast(text: string) {
    const t = this.q('.hud-toast');
    setText(t, text);
    toggle(t, 'show', false); void t.offsetWidth; t.classList.add('show');
    this.toastTimer = 1.8;
  }
  /** Direction (screen angle) and distance in metres to the objective; null hides it. */
  guide(angle: number | null, metres = 0) {
    const el = this.el.querySelector<HTMLElement>('.obj-dir')!;
    toggle(el, 'hidden', !!(angle === null));
    if (angle === null) return;
    setStyle(el.querySelector<HTMLElement>('i')!, 'transform', `rotate(${Math.round(angle * 57.3 / 3) * 3}deg)`);
    setText(el.querySelector('b')!, metres + ' м');
  }

  objective(text: string) {
    setText(this.q('.obj-text'), text);
    const o = this.q('.hud-obj');
    toggle(o, 'hidden', !!(!text));
    o.classList.remove('flash');
    if (!settings.reducedFlashes) { void o.offsetWidth; o.classList.add('flash'); }
  }
  private radioTimer = 0;
  radio(who: string, text: string, d = 4) {
    setText(this.q('.hud-radio b'), who);
    setText(this.q('.hud-radio span'), text);
    const r = this.q('.hud-radio');
    toggle(r, 'show', false); void r.offsetWidth; r.classList.add('show');
    this.radioTimer = d;
  }
  hint(text: string | null) {
    const h = this.q('.hud-hint');
    setText(h, text ?? '');
    toggle(h, 'show', !!(!!text));
  }
  damage(amount: number) {
    if (settings.reducedFlashes) return;
    const v = this.q('.hud-vignette');
    setStyle(v, 'opacity', String(Math.min(0.85, 0.3 + amount / 40)));
    v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade');
  }

  update(dt: number, view: WorldView, me: Player | undefined, solo: boolean) {
    toggle(this.el, 'reduced-flashes', !!(settings.reducedFlashes));
    this.noticeTimer -= dt;
    this.advanceNotice();
    this.msgTimer -= dt;
    if (this.msgTimer <= 0) toggle(this.q('.hud-msg'), 'show', false);
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) toggle(this.q('.hud-toast'), 'show', false);
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) toggle(this.q('.hud-radio'), 'show', false);
    if (!me) return;
    const keys = [...new Set(me.achievements ?? [])].sort().join(',');
    if (keys !== this.profileKeys) { this.profileKeys = keys; rememberAchievements(me.achievements ?? []); }
    this.updateIncident(view, me);
    this.updateBonus(dt, view);
    setHtml(this.q('.hud-supplies'), `<span title="Аптечки">✚ ${me.supplies?.medkit ?? 0}</span><span title="Патроны для друзей">▣ ${me.supplies?.ammo ?? 0}</span>`);
    const action = me.support;
    const helping = !!action && !action.cancelled && !action.completed && action.kind !== 'ammo';
    toggle(this.q('.hud-support'), 'show', !!(helping));
    if (helping) {
      const name = view.players.find(p => p.id === action!.target)?.name ?? '';
      setText(this.q('.hud-support span'), (action!.kind === 'revive' ? 'Поднимаем ' : 'Лечим ') + name);
      setStyle(this.q('.hud-support i'), 'width', `${Math.round(action!.progress * 100)}%`);
    }
    // hp
    const hpPct = Math.max(0, me.hp / me.maxHp) * 100;
    setStyle(this.q('.hp-fill'), 'width', hpPct.toFixed(1) + '%');
    toggle(this.q('.hp-fill'), 'low', !!(hpPct < 30));
    toggle(this.q('.hp-fill'), 'chicken', !!(me.state === 'chicken'));
    setStyle(this.q('.hp-armor'), 'width', Math.min(100, me.armor) + '%');
    setText(this.q('.hp-text'), `${Math.ceil(me.hp)}${me.armor > 0 ? '  ◈' + Math.ceil(me.armor) : ''}`);
    // weapon
    const w = me.weapons[me.cur] as WeaponId | undefined;
    if (w) {
      const def = WEAPONS[w];
      const a = me.ammo[w];
      setText(this.q('.w-name'), def.name);
      setText(this.q('.mag'), String(a?.mag ?? 0));
      setText(this.q('.res'), a && a.reserve >= 0 ? ' / ' + a.reserve : ' / ∞');
      toggle(this.q('.mag'), 'empty', !!((a?.mag ?? 0) === 0));
      const ic = this.q('.w-icon');
      if (ic.dataset.w !== w && this.icons['w_' + w]) { ic.dataset.w = w; ic.style.backgroundImage = `url(${this.icons['w_' + w]})`; }
      const rl = this.q('.w-reload');
      toggle(rl, 'show', !!(me.reloadT > 0));
      if (me.reloadT > 0) setStyle(rl.firstElementChild as HTMLElement, 'width', Math.round(100 * (1 - me.reloadT / def.reload)) + '%');
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
        setText(this.q('.combo-n'), 'x' + combo);
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        c.style.setProperty('--heat', String(Math.min(1, combo / 60)));
      }
    } else toggle(c, 'show', false);
    this.comboShown = combo;
    setText(this.q('.hud-score'), `☠ ${me.kills}   ★ ${Math.floor(me.score)}`);
    setHtml(this.q('.hud-buffs'), (Object.entries(me.buffs ?? {}) as [BuffKind, number][]).filter(([, t]) => t > 0).map(([k, t]) => `<span style="--buff:${hex(BUFFS[k].color)}">${BUFFS[k].icon} ${BUFFS[k].label} <b>${Math.ceil(t)}с</b></span>`).join(''));
    const earned = (me.achievements ?? []).filter((key): key is AchievementKey => Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, key));
    const latest = earned.at(-1);
    setText(this.q('.hud-achievements'), latest ? `🏅 ${earned.length} · ${ACHIEVEMENTS[latest].name}` : '');
    // boss
    const boss = view.bossId >= 0 ? view.enemies.find((e) => e.id === view.bossId) : undefined;
    toggle(this.q('.hud-boss'), 'hidden', !!(!boss));
    if (boss) setStyle(this.q('.boss-fill'), 'width', (100 * boss.hp / boss.maxHp).toFixed(1) + '%');
    if (boss) setText(this.q('.boss-name'), view.bossName || 'ГЕНЕРАЛЬНЫЙ ПЕТУХ');
    // team (multiplayer)
    if (!solo) {
      setHtml(this.q('.hud-team'), view.players.filter((p) => p.id !== me.id).map((p) => {
        const st = p.state === 'chicken' ? '🐔' : p.state === 'downed' ? '✚' : p.state === 'dead' ? '…' : '';
        return `<div class="mate" style="--c:${hex(PLAYER_COLORS[p.slot % 4])}"><b>${escapeHtml(p.name)}</b> ${st}<i style="width:${Math.round(Math.max(0, p.hp / p.maxHp * 100))}%"></i></div>`;
      }).join(''));
    }
    const st = this.q('.hud-state');
    if (me.state === 'downed') { setText(st, `ВЫ РАНЕНЫ — ждите помощи (${Math.ceil(me.downT)})`); setClass(st, 'hud-state show downed'); }
    else if (me.state === 'chicken') { setText(st, 'ВЫ — КУРИЦА. Заклюйте бывших коллег!'); setClass(st, 'hud-state show chicken'); }
    else if (me.state === 'dead' && !solo && me.benched) { setText(st, `НАБЛЮДЕНИЕ${this.watching} · вы вернулись к погибшему персонажу — оживёте на следующем этаже`); setClass(st, 'hud-state show watch'); }
    else if (me.state === 'dead' && !solo) { setText(st, `НАБЛЮДЕНИЕ${this.watching} · вернётесь к команде в передышку`); setClass(st, 'hud-state show watch'); }
    else setClass(st, 'hud-state');
  }

  private bonusShownDone = 0;
  private bonusKey = '';
  /** D57 floor bonus: a quiet line under the objective; disappears a few seconds after success. */
  private updateBonus(dt: number, view: WorldView) {
    const b = view.bonus, el = this.q('.hud-bonus');
    if (!b || !settings.bonusGoals) { toggle(el, 'hidden', true); return; }
    if (b.done) this.bonusShownDone += dt; else this.bonusShownDone = 0;
    toggle(el, 'hidden', !!(b.done && this.bonusShownDone > 6));
    toggle(el, 'done', !!(b.done));
    const key = `${b.id}:${b.n}:${b.done}`;
    if (key === this.bonusKey) return;
    if (this.bonusKey && !b.done) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    this.bonusKey = key;
    setText(this.q('.hud-bonus span'), b.done ? 'Бонус этажа выполнен' : b.text);
    setText(this.q('.hud-bonus b'), b.done ? '✓' : `${b.n}/${b.goal}`);
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
    toggle(el, 'hidden', !!(!incident));
    toggle(this.el, 'has-incident', !!(!!incident));
    toggle(this.el, 'incident-urgent', !!(!!urgent));
    if (!incident) return;
    if (el.dataset.kind !== incident.kind) el.dataset.kind = incident.kind;
    if (el.dataset.phase !== incident.phase) el.dataset.phase = incident.phase;
    const seconds = `${Math.ceil(Math.max(0, incident.seconds))}с`;
    const active = incident.phase === 'active', warning = incident.phase === 'warning';
    const title = incident.kind === 'alarm' ? warning ? `🚨 Стая через ${seconds}` : active ? '🚨 Учебная тревога' : '🔕 Сигналка на пути'
      : incident.kind === 'coffee' ? active ? `☕ Кофейный перерыв · ${seconds}` : '☕ Кофе рядом'
      : active ? `📦 Терминал · ${seconds}` : '📦 Тайник переработки';
    const hint = incident.kind === 'alarm' ? warning ? 'E у пульта — отменить вызов' : active ? `Петушков осталось: ${incident.left}` : 'E у пульта — отключить · выстрелы включат тревогу'
      : incident.kind === 'coffee' ? active ? 'Кофе лечит. Передохните перед следующим боем.' : 'E у автомата — +15 здоровья и 10с бодрости'
      : active ? incident.paused ? 'Вернитесь к терминалу — загрузка на паузе' : 'Держитесь рядом: припасы за удержание' : 'E у терминала — 12с обороны за припасы';
    setText(this.q('.hud-incident b'), title);
    setText(this.q('.hud-incident span'), hint);
  }

  destroy() { this.el.remove(); }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
