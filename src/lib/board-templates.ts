import type { LabelColor } from "@/lib/labels";

// Шаблоны досок: набор колонок + меток.
// почему хардкод-массив, а не БД-таблица: для MVP правок мало,
// а в БД пришлось бы плодить SeededTemplate + миграцию.

export type BoardTemplate = {
  key: string;
  name: string;
  description: string;
  columns: string[];
  labels: { name: string; color: LabelColor }[];
};

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: "blank",
    name: "Пустая доска",
    description: "Без колонок и меток — настрою сам(а).",
    columns: [],
    labels: [],
  },
  {
    key: "default",
    name: "Стандартная",
    description: "Бэклог · В работе · Готово. С базовыми приоритетами.",
    columns: ["Бэклог", "В работе", "Готово"],
    labels: [
      { name: "Срочно", color: "red" },
      { name: "Важное", color: "amber" },
      { name: "Идея", color: "violet" },
    ],
  },
  {
    key: "sprint",
    name: "Sprint",
    description: "Двухнедельный спринт с декомпозицией и проверкой.",
    columns: [
      "Идеи",
      "Спринт",
      "В работе",
      "Ревью",
      "Готово",
    ],
    labels: [
      { name: "Баг", color: "red" },
      { name: "Фича", color: "blue" },
      { name: "Долг", color: "slate" },
      { name: "S", color: "lime" },
      { name: "M", color: "amber" },
      { name: "L", color: "rose" },
    ],
  },
  {
    key: "content",
    name: "Контент-план",
    description: "Идея → черновик → редактура → готово к публикации.",
    columns: [
      "Идеи",
      "Черновик",
      "Редактура",
      "Готово",
      "Опубликовано",
    ],
    labels: [
      { name: "Статья", color: "blue" },
      { name: "Видео", color: "violet" },
      { name: "Соцсети", color: "pink" },
      { name: "Срочно", color: "red" },
    ],
  },
  {
    key: "personal",
    name: "Личные задачи",
    description: "Сегодня · На неделе · Когда-нибудь · Готово.",
    columns: [
      "Сегодня",
      "На неделе",
      "Когда-нибудь",
      "Готово",
    ],
    labels: [
      { name: "Дом", color: "emerald" },
      { name: "Работа", color: "blue" },
      { name: "Здоровье", color: "rose" },
      { name: "Учёба", color: "amber" },
    ],
  },
  {
    key: "okr",
    name: "OKR на квартал",
    description: "Цели, ключевые результаты и инициативы для них.",
    columns: ["Цели (Objectives)", "Результаты (KR)", "Инициативы", "Готово"],
    labels: [
      { name: "Q-target", color: "violet" },
      { name: "blocked", color: "red" },
      { name: "on-track", color: "emerald" },
    ],
  },
  {
    key: "bugs",
    name: "Bug tracker",
    description: "Триаж и исправление багов с приоритетами.",
    columns: ["Triage", "Подтверждено", "В работе", "Тестируется", "Закрыто"],
    labels: [
      { name: "P0 critical", color: "red" },
      { name: "P1 high", color: "orange" },
      { name: "P2 medium", color: "amber" },
      { name: "P3 low", color: "slate" },
      { name: "regression", color: "fuchsia" },
    ],
  },
];
