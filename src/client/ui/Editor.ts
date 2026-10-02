// Character editor: body, skin, hairstyle/colour, top/legs and colours, accessory. Saved in settings.look.
import { settings, saveSettings } from '../settings';
import { ACCS, CLOTH_COLORS, EDITOR, HAIR, HAIR_COLORS, LEGS, LEGS_COLORS, SKIN_TONES, TOPS, decodeLook, encodeLook, randomLook, resolveLook, LOOK_PRESETS, type Look } from '../../shared/look';
import { lookPortrait } from '../render/Looks';

export function currentLook(): Look {
  return (settings.look && decodeLook(settings.look)) || resolveLook(LOOK_PRESETS.p0);
}

/** Opens the editor inside `host`; `done` is called after saving. */
export function openEditor(host: HTMLElement, done: () => void) {
  let look = currentLook();
  let mutantPreview = false;
  const g = () => (look.body === 'f' ? 'f' : 'm') as 'm' | 'f';
  const fit = () => {
    // keep choices valid for the body type
    if (!EDITOR.hair[g()].includes(look.hair)) look.hair = EDITOR.hair[g()][0];
    if (!EDITOR.top[g()].includes(look.top)) look.top = EDITOR.top[g()][0];
    if (!EDITOR.legs[g()].includes(look.legs)) look.legs = EDITOR.legs[g()][0];
  };
  const swatches = (key: 'skin' | 'hairColor' | 'topColor' | 'legsColor', list: string[]) => list.map((c, i) => {
    const on = key === 'skin' ? look.skin === i : look[key] === c;
    return `<button class="sw ${on ? 'on' : ''}" data-k="${key}" data-v="${key === 'skin' ? i : c}" style="background:#${c}" aria-label="#${c}"></button>`;
  }).join('');
  const cycler = (key: 'hair' | 'top' | 'legs' | 'acc', list: readonly string[], names: Record<string, string>) =>
    `<div class="cyc"><button class="btn tiny" data-cyc="${key}" data-d="-1">‹</button><span>${names[look[key]]}</span><button class="btn tiny" data-cyc="${key}" data-d="1">›</button></div>`;
  const render = () => {
    fit();
    host.innerHTML = `
      <div class="panel editor">
        <h2>ВНЕШНОСТЬ</h2>
        <div class="ed-body">
          <div class="ed-preview">
            <img src="${lookPortrait(encodeLook(look), mutantPreview, 4)}" alt="персонаж">
            <button class="btn tiny ghost" data-a="mut">${mutantPreview ? 'Человек' : 'Что будет при заражении?'}</button>
          </div>
          <div class="ed-rows">
            <div class="ed-row"><span>Тип</span><div class="seg">
              <button class="btn tiny ${look.body === 'm' ? 'on' : ''}" data-body="m">Мужчина</button>
              <button class="btn tiny ${look.body === 'f' ? 'on' : ''}" data-body="f">Женщина</button></div></div>
            <div class="ed-row"><span>Кожа</span><div class="sws">${swatches('skin', SKIN_TONES)}</div></div>
            <div class="ed-row"><span>Причёска</span>${cycler('hair', EDITOR.hair[g()], HAIR)}</div>
            <div class="ed-row"><span>Цвет волос</span><div class="sws">${swatches('hairColor', HAIR_COLORS)}</div></div>
            <div class="ed-row"><span>Верх</span>${cycler('top', EDITOR.top[g()], TOPS)}</div>
            <div class="ed-row"><span>Цвет</span><div class="sws">${swatches('topColor', CLOTH_COLORS)}</div></div>
            <div class="ed-row"><span>Низ</span>${cycler('legs', EDITOR.legs[g()], LEGS)}</div>
            <div class="ed-row"><span>Цвет</span><div class="sws">${swatches('legsColor', LEGS_COLORS)}</div></div>
            <div class="ed-row"><span>Аксессуар</span>${cycler('acc', EDITOR.acc, ACCS)}</div>
          </div>
        </div>
        <div class="row">
          <button class="btn" data-a="random">Случайно</button>
          <button class="btn primary" data-a="save">Готово</button>
        </div>
      </div>`;
  };
  host.onclick = (e) => {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const d = t.dataset;
    if (d.body) { look.body = d.body as Look['body']; look.old = false; }
    if (d.k) { if (d.k === 'skin') look.skin = Number(d.v); else (look as any)[d.k] = d.v; }
    if (d.cyc) {
      const key = d.cyc as 'hair' | 'top' | 'legs' | 'acc';
      const list = (key === 'acc' ? EDITOR.acc : EDITOR[key][g()]) as string[];
      const i = (list.indexOf(look[key]) + Number(d.d) + list.length) % list.length;
      (look as any)[key] = list[i];
    }
    if (d.a === 'mut') mutantPreview = !mutantPreview;
    if (d.a === 'random') look = decodeLook(randomLook(Math.floor(Math.random() * 1e6)))!;
    if (d.a === 'save') { settings.look = encodeLook(look); saveSettings(); host.onclick = null; done(); return; }
    render();
  };
  render();
}
