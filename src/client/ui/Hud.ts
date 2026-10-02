import { WEAPONS, WeaponId } from '../../shared/weapons';
import type { Player, WorldView } from '../../shared/sim/types';
import { PLAYER_COLORS } from '../render/Actors';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export class Hud {
  el: HTMLDivElement;
  private q = <T extends HTMLElement = HTMLDivElement>(s: string) => this.el.querySelector(s) as T;
  private msgTimer = 0;
  private toastTimer = 0;
  private lastSlots = '';
  private comboShown = 0;
  icons: Record<string, string> = {};

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-vignette"></div>
      <div class="hud-tl">
        <div class="hp-wrap"><div class="hp-bar"><div class="hp-fill"></div><div class="hp-armor"></div></div><div class="hp-text"></div></div>
        <div class="hud-team"></div>
      </div>
      <div class="hud-obj"><span class="obj-label">ЗАДАЧА</span><span class="obj-text"></span></div>
      <div class="hud-boss hidden"><div class="boss-name">ГЕНЕРАЛЬНЫЙ ПЕТУХ</div><div class="boss-bar"><div class="boss-fill"></div></div></div>
      <div class="hud-combo"><span class="combo-n"></span><span class="combo-l">КОМБО</span></div>
      <div class="hud-score"></div>
      <div class="hud-weapon">
        <div class="w-icon"></div>
        <div class="w-info"><div class="w-name"></div><div class="w-ammo"><span class="mag"></span><span class="res"></span></div><div class="w-reload"><div></div></div></div>
      </div>
      <div class="hud-slots"></div>
      <div class="hud-msg"><div class="msg-title"></div><div class="msg-sub"></div></div>
      <div class="hud-toast"></div>
      <div class="hud-hint"></div>
      <div class="hud-support"><span></span><div><i></i></div></div>
      <div class="hud-supplies"></div>
      <div class="hud-state"></div>
      <div class="hud-radio"><b></b><span></span></div>`;
    document.getElementById('ui')!.appendChild(this.el);
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
  objective(text: string) {
    this.q('.obj-text').textContent = text;
    const o = this.q('.hud-obj');
    o.classList.toggle('hidden', !text);
    o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
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
    const v = this.q('.hud-vignette');
    v.style.opacity = String(Math.min(0.85, 0.3 + amount / 40));
    v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade');
  }

  update(dt: number, view: WorldView, me: Player | undefined, solo: boolean) {
    this.msgTimer -= dt;
    if (this.msgTimer <= 0) this.q('.hud-msg').classList.remove('show');
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) this.q('.hud-toast').classList.remove('show');
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) this.q('.hud-radio').classList.remove('show');
    if (!me) return;
    this.q('.hud-supplies').textContent = `✚ ${me.supplies?.medkit ?? 0}   ▣ ${me.supplies?.ammo ?? 0}`;
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
    else if (me.state === 'dead' && !solo) { st.textContent = 'НАБЛЮДЕНИЕ · вернётесь к команде в передышку'; st.className = 'hud-state show'; }
    else st.className = 'hud-state';
  }

  destroy() { this.el.remove(); }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
