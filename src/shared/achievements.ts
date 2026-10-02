export const ACHIEVEMENTS = {
  root_rooster: { name: 'Рутовый петушок', description: 'Победить менеджера и забрать его трофей.', icon: '🏆' },
  quiet_shift: { name: 'Без лишнего шума', description: 'Обезвредить сигналку до вызова стаи.', icon: '🔕' },
  fire_drill: { name: 'Учебная тревога', description: 'Пережить гиперволну сигнализации.', icon: '🚨' },
  coffee_break: { name: 'Кофе сильнее страха', description: 'Воспользоваться безопасным кофейным перерывом.', icon: '☕' },
  overtime_pay: { name: 'Оплачиваемая переработка', description: 'Удержать терминал и получить припасы.', icon: '📦' },
  barrel_barbeque: { name: 'Корпоративный шашлык', description: 'Уничтожить троих петушков одним взрывом бочки.', icon: '🔥' },
  field_medic: { name: 'Коллега года', description: 'Поднять раненого товарища.', icon: '✚' },
  no_one_left: { name: 'Пятеро без очереди', description: 'Эвакуировать всех пятерых друзей с седьмого этажа.', icon: '🤝' },
  // D57: floor bonuses and two skill moments
  sysadmin_day: { name: 'Сисадмин дня', description: 'Этаж 6: уложить 25 петушков, пока перезагружается сервер.', icon: '🖥️' },
  headhunter: { name: 'Точечный аудит', description: 'Этаж 7: 20 попаданий в голову.', icon: '🎯' },
  demolition: { name: 'Техника безопасности', description: 'Лаборатория: 10 петушков взрывами.', icon: '💥' },
  conveyor: { name: 'Конвейер', description: 'Завод: комбо x30.', icon: '⚙️' },
  board_meeting: { name: 'Неудобные вопросы', description: 'Ангар: 15 попаданий в голову генеральному.', icon: '👔' },
  combo_master: { name: 'Эффективный менеджер', description: 'Комбо x50 где угодно.', icon: '📈' },
  close_call: { name: 'На волоске', description: 'Пережить удар, оставшись с 10 здоровья или меньше.', icon: '🩹' },
} as const;
export type AchievementKey = keyof typeof ACHIEVEMENTS;
