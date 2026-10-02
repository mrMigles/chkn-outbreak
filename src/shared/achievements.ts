export const ACHIEVEMENTS = {
  root_rooster: { name: 'Рутовый петушок', description: 'Победить менеджера и забрать его трофей.', icon: '🏆' },
  quiet_shift: { name: 'Без лишнего шума', description: 'Обезвредить сигналку до вызова стаи.', icon: '🔕' },
  fire_drill: { name: 'Учебная тревога', description: 'Пережить гиперволну сигнализации.', icon: '🚨' },
  coffee_break: { name: 'Кофе сильнее страха', description: 'Воспользоваться безопасным кофейным перерывом.', icon: '☕' },
  overtime_pay: { name: 'Оплачиваемая переработка', description: 'Удержать терминал и получить припасы.', icon: '📦' },
  barrel_barbeque: { name: 'Корпоративный шашлык', description: 'Уничтожить троих петушков одним взрывом бочки.', icon: '🔥' },
  field_medic: { name: 'Коллега года', description: 'Поднять раненого товарища.', icon: '✚' },
  no_one_left: { name: 'Пятеро без очереди', description: 'Эвакуировать всех пятерых друзей с седьмого этажа.', icon: '🤝' },
} as const;
export type AchievementKey = keyof typeof ACHIEVEMENTS;
