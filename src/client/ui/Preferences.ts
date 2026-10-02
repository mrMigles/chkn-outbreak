import { settings, saveSettings } from '../settings';
import { sfx } from '../audio/Sfx';
import { resetTips } from './Tutorial';

/** Shared by the main menu and pause; preferences never alter simulation rules. */
export function preferencesMarkup() {
  const toggle = (key: 'tutorials' | 'banter' | 'combatText' | 'achievementPopups' | 'reducedFlashes', label: string) =>
    `<label class="preference-check"><span>${label}</span><input type="checkbox" data-pref="${key}" ${settings[key] ? 'checked' : ''}></label>`;
  const slider = (key: 'volume' | 'music' | 'shake', label: string, max: number) =>
    `<label class="preference-slider"><span>${label}</span><input type="range" data-pref="${key}" min="0" max="${max}" step="0.05" value="${settings[key]}"></label>`;
  return `<div class="preferences">
    ${slider('volume', 'Звуки', 1)}${slider('music', 'Музыка', 1)}${slider('shake', 'Тряска камеры', 1.5)}
    ${toggle('tutorials', 'Подсказки')}${toggle('banter', 'Шутки над петушками')}
    ${toggle('combatText', 'Цифры урона')}${toggle('achievementPopups', 'Попапы достижений')}
    ${toggle('reducedFlashes', 'Меньше вспышек')}
    <button class="btn ghost reset-tips" type="button">Показать подсказки заново</button>
    <p class="preference-help">Сюжетные реплики и предупреждения об опасности остаются включены.</p>
  </div>`;
}

export function bindPreferences(el: HTMLElement) {
  el.querySelectorAll<HTMLInputElement>('[data-pref]').forEach(input => {
    input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
      const key = input.dataset.pref!;
      if (key === 'volume' || key === 'music' || key === 'shake') {
        settings[key] = Number(input.value);
        if (key === 'volume') sfx.setVolume(settings.volume);
      } else if (key === 'tutorials' || key === 'banter' || key === 'combatText' || key === 'achievementPopups' || key === 'reducedFlashes') {
        settings[key] = input.checked;
      }
      saveSettings();
    });
  });
  el.querySelector('.reset-tips')?.addEventListener('click', event => {
    resetTips();
    (event.currentTarget as HTMLButtonElement).textContent = 'Подсказки появятся снова ✓';
  });
}
