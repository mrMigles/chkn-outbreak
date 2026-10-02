import { settings, saveSettings } from '../settings';
import { sfx } from '../audio/Sfx';
import { resetTips } from './Tutorial';

type ToggleKey = 'tutorials' | 'banter' | 'combatText' | 'achievementPopups' | 'reducedFlashes' | 'leftHanded' | 'vibration' | 'threatArrows' | 'bonusGoals';
const TOGGLES: ToggleKey[] = ['tutorials', 'banter', 'combatText', 'achievementPopups', 'reducedFlashes', 'leftHanded', 'vibration', 'threatArrows', 'bonusGoals'];

/** Shared by the main menu and pause; preferences never alter simulation rules. */
export function preferencesMarkup() {
  const toggle = (key: ToggleKey, label: string) =>
    `<label class="preference-check"><span>${label}</span><input type="checkbox" data-pref="${key}" ${settings[key] ? 'checked' : ''}></label>`;
  const slider = (key: 'volume' | 'music' | 'shake', label: string, max: number) =>
    `<label class="preference-slider"><span>${label}</span><input type="range" data-pref="${key}" min="0" max="${max}" step="0.05" value="${settings[key]}"></label>`;
  return `<div class="preferences">
    ${slider('volume', 'Звуки', 1)}${slider('music', 'Музыка', 1)}${slider('shake', 'Тряска камеры', 1.5)}
    ${toggle('tutorials', 'Подсказки')}${toggle('banter', 'Шутки над петушками')}
    ${toggle('combatText', 'Цифры урона')}${toggle('achievementPopups', 'Попапы достижений')}
    ${toggle('reducedFlashes', 'Меньше вспышек')}
    <label class="preference-slider"><span>Размер HUD</span><select data-pref="hudScale">${[[0.85, 'Компактный'], [1, 'Обычный'], [1.15, 'Крупный']].map(([v, l]) => `<option value="${v}" ${settings.hudScale === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${toggle('threatArrows', 'Стрелки угроз')}${toggle('bonusGoals', 'Бонус этажа')}
    ${toggle('leftHanded', 'Левша (прицел слева)')}${toggle('vibration', 'Вибрация')}
    <button class="btn ghost reset-tips" type="button">Показать подсказки заново</button>
    <p class="preference-help">Сюжетные реплики и предупреждения об опасности остаются включены.</p>
  </div>`;
}

export function bindPreferences(el: HTMLElement) {
  el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-pref]').forEach(input => {
    input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
      if (input instanceof HTMLSelectElement) { settings.hudScale = Number(input.value); saveSettings(); document.documentElement.style.setProperty('--hud-scale', String(settings.hudScale)); return; }
      const key = input.dataset.pref!;
      if (key === 'volume' || key === 'music' || key === 'shake') {
        settings[key] = Number(input.value);
        if (key === 'volume') sfx.setVolume(settings.volume);
      } else if ((TOGGLES as string[]).includes(key)) {
        settings[key as ToggleKey] = input.checked;
      }
      saveSettings();
    });
  });
  el.querySelector('.reset-tips')?.addEventListener('click', event => {
    resetTips();
    (event.currentTarget as HTMLButtonElement).textContent = 'Подсказки появятся снова ✓';
  });
}
