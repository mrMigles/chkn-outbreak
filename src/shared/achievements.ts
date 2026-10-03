export const ACHIEVEMENTS = {
  root_rooster: { name: 'Рутовый петушок', description: 'Победить менеджера и забрать его трофей.', icon: '🏆' },
  quiet_shift: { name: 'Без лишнего шума', description: 'Обезвредить сигналку до вызова стаи.', icon: '🔕', rare: true },
  fire_drill: { name: 'Учебная тревога', description: 'Пережить гиперволну сигнализации.', icon: '🚨' },
  coffee_break: { name: 'Кофе сильнее страха', description: 'Воспользоваться безопасным кофейным перерывом.', icon: '☕' },
  overtime_pay: { name: 'Оплачиваемая переработка', description: 'Удержать терминал и получить припасы.', icon: '📦' },
  barrel_barbeque: { name: 'Корпоративный шашлык', description: 'Уничтожить троих петушков одним взрывом бочки.', icon: '🔥', rare: true },
  field_medic: { name: 'Коллега года', description: 'Поднять раненого товарища.', icon: '✚' },
  no_one_left: { name: 'Пятеро без очереди', description: 'Эвакуировать всех пятерых друзей с седьмого этажа.', icon: '🤝', rare: true },
  // D57: floor bonuses and two skill moments
  sysadmin_day: { name: 'Сисадмин дня', description: 'Этаж 6: уложить 25 петушков, пока перезагружается сервер.', icon: '🖥️', rare: true },
  headhunter: { name: 'Точечный аудит', description: 'Этаж 7: 20 попаданий в голову.', icon: '🎯', rare: true },
  demolition: { name: 'Техника безопасности', description: 'Лаборатория: 10 петушков взрывами.', icon: '💥', rare: true },
  conveyor: { name: 'Конвейер', description: 'Завод: комбо x30.', icon: '⚙️', rare: true },
  board_meeting: { name: 'Неудобные вопросы', description: 'Ангар: 15 попаданий в голову генеральному.', icon: '👔', rare: true },
  combo_master: { name: 'Эффективный менеджер', description: 'Комбо x50 где угодно.', icon: '📈', rare: true },
  close_call: { name: 'На волоске', description: 'Пережить удар, оставшись с 10 здоровья или меньше.', icon: '🩹' },
  // D69: chapter 1 (floors 8, 11, 12) and chapter 2 (the city)
  quiet_hour: { name: 'Тихий час', description: 'Этаж 8: 10 петушков, убитых во сне.', icon: '😴', rare: true },
  light_theme: { name: 'Светлая тема', description: 'Этаж 8: победить Петуха Тёмной Темы.', icon: '💡' },
  who_is_there: { name: 'Кто здесь?!', description: 'Этаж 8: пережить все четыре пугалки.', icon: '👻' },
  two_keys: { name: 'Два ключа, как в кино', description: 'Этаж 8: открыть дверь двумя размыкателями одновременно.', icon: '🗝️' },
  bureaucrat: { name: 'Бюрократ', description: 'Этаж 11: собрать три визы для приёма у директора.', icon: '📑' },
  reglament: { name: 'Регламент', description: 'Этаж 11: 30 петушков за одно совещание.', icon: '⏱️', rare: true },
  exec_order: { name: 'Исполнительный лист', description: 'Этаж 11: уволить Петуха-директора.', icon: '🗂️' },
  business_lunch: { name: 'Бизнес-ланч', description: 'Этаж 12: съесть курочку. Не спрашивайте, из какого отдела.', icon: '🍗' },
  chapter_office: { name: 'Офисный выживальщик', description: 'Пройти главу 1 «Офис».', icon: '🏢', rare: true },
  air_raid: { name: 'Воздушная тревога', description: 'Улица: 35 петушков у вертолёта.', icon: '🚁', rare: true },
  shawarma: { name: 'Шаурма не из курицы', description: 'Улица: отбить ларёк Ашота.', icon: '🌯' },
  grandma: { name: 'Цыпа-цыпа', description: 'Улица: получить пирожок у бабушки.', icon: '🥟' },
  sanepid: { name: 'Санэпидстанция', description: 'Рынок: 30 петушков.', icon: '🧴', rare: true },
  subscribed: { name: 'Подписка оформлена', description: 'Довести блогера Стёпу до проходной «Провансаля» человеком.', icon: '📱', rare: true },
  chapter_city: { name: 'Городская легенда', description: 'Пройти главу 2 «Город».', icon: '🌆', rare: true },
  // D72
  debug_mode: { name: 'Режим отладки', description: 'Этаж 7: успокоить Катю из переговорки «Уединение».', icon: '🐞' },
  harvest: { name: 'Урожай', description: 'Этаж 8: собрать урожай в комнате 87 и уволить Вершкова.', icon: '🥔' },
  gone_in_60: { name: 'Угнать за 60 секунд', description: 'Улица: проводить Литовца через ограду парковки.', icon: '🏎️' },
  sober_look: { name: 'Трезвый взгляд', description: 'Рынок: победить сменщика Толика.', icon: '🍺' },
  no_gmo: { name: 'Без ГМО', description: 'Лаборатория: уложить пять ГМО-петухов.', icon: '🧬', rare: true },
  diet: { name: 'Разгрузочный день', description: 'Ангар: уволить разжиревшего Генерального Петуха.', icon: '🥗' },
} as const;
/** D62: rare achievements can be shared into the room's Telegram chat after the floor. */
export const isRare = (key: string) => !!(ACHIEVEMENTS as Record<string, { rare?: boolean }>)[key]?.rare;
export type AchievementKey = keyof typeof ACHIEVEMENTS;
