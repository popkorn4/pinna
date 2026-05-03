# Kanban-планировщик — контекст проекта

## Описание
Production-ready аналог Trello с AI-агентом. Доски, колонки, карточки, drag & drop, совместная работа, чат с агентом, который управляет доской через tool use.

## Стек
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- Auth.js v5 (Credentials + Google)
- @dnd-kit для drag & drop
- Zod + React Hook Form
- @anthropic-ai/sdk для AI-агента
- Vitest + Playwright для тестов

## Соглашения
- Никакого `any`, никакого отключения ESLint без обоснования в комментарии
- Серверная валидация ВСЕХ входных данных через Zod
- Авторизация на каждом эндпоинте — проверка прав на ресурс
- Server Actions предпочтительнее API routes, кроме случаев с webhooks/streaming
- Бизнес-логика — в `lib/`, не в компонентах
- Имена файлов: kebab-case для роутов, PascalCase для компонентов
- Комментарии на русском там, где логика неочевидна
- Все деструктивные действия — с подтверждением в UI
- Никогда не пиши секреты в код. Только process.env

## Структура папок
```
src/
  app/             # роуты Next.js
  components/      # переиспользуемые компоненты
    ui/            # shadcn компоненты
  lib/             # бизнес-логика, утилиты, prisma client
    auth/
    db/
    ai/
  server/          # server actions
  types/           # глобальные типы
prisma/
  schema.prisma
  migrations/
```

## Текущая фаза
Фаза 8 завершена (требует Pusher ENV для активации, без них всё работает локально). Следующая — фаза 9 (деплой). Лента активности из фазы 5 ещё отложена.

## Технические заметки окружения
- Postgres локально через **Postgres.app** (не Docker). Пользователь — `petrun`, без пароля. База — `kanban_dev` на порту `5432`.
- DATABASE_URL: `postgresql://petrun@localhost:5432/kanban_dev` (хранится в `.env` для Prisma CLI и в `.env.local` для Next.js)
- Node v22.22.2, npm 10.9.7
- Next.js v16.2.4, React 19, Tailwind v4
- Prisma v6.19.3 (отказались от v7 — там ломающие изменения с datasource в schema)
- shadcn/ui — пресет `nova` с `--base radix` (классические Radix-компоненты, поддерживают `asChild`)
- На порту 3000 что-то уже есть — dev-сервер автоматически идёт на 3001

## Что НЕ делать
- Не добавлять зависимости без согласования
- Не менять схему БД без миграции
- Не коммитить .env
- Не использовать localStorage для данных, которые должны быть на сервере
- Не делать оптимистичные UI-обновления без отката при ошибке

## История фаз
- **Фаза 0** (создание контекста): создан CLAUDE.md, инициализирован git-репозиторий.
- **Фаза 1** (скелет): Next.js 16 + Tailwind v4 + shadcn (radix/nova), Prisma 6 + Postgres.app, схема БД (15 моделей, миграция `init`), синглтон `lib/db/prisma.ts`, `next-themes` + переключатель тем, шрифты Geist + Fraunces, минималистичный лендинг.
- **Фаза 2** (аутентификация): Auth.js v5 (Credentials, JWT-стратегия — Google OAuth решили отложить); хелперы `hashPassword`/`verifyPassword` (bcrypt cost 12); `getCurrentUser`/`requireUser` через React `cache`; middleware защищает `/boards` и `/api/boards`; страницы `/login` и `/register` с RHF + Zod, дефолтная доска «Мои задачи» с тремя колонками создаётся при регистрации; UserMenu с logout. Email enumeration защищён только на /login (на регистрации показываем «email занят» осознанно, ради UX).
- **Фаза 3** (доски и колонки): permissions с иерархией ролей (OWNER/MEMBER/VIEWER) + 3 юнит-теста; Server Actions для досок (CRUD + archive) и колонок (create/update/delete/reorder); страница /boards в виде «оглавления журнала» (список с цветной полоской, мета по колонкам/карточкам/времени); страница доски с инлайн-редактированием названия, горизонтальным скроллом колонок, добавлением колонки через inline composer. Константы position вынесены в `lib/position.ts` — в server-actions файлах разрешены только async-экспорты.
- **Фаза 4** (карточки и DnD): card-actions (CRUD + archive + moveCard с midpoint-стратегией и автоматическим ребалансом при коллизиях, +reorderCardsInColumn); position-strategy с 8 юнит-тестами; DnD на @dnd-kit с кастомной collision detection (приоритет cards над columns) + DragOverlay для карточек И колонок; стратегия sortable сделана noop — соседи не расступаются во время drag (это давало "прыжки"); cross-column move — оптимистично + сервер; модалка карточки с inline-редактированием title/description (Markdown), datepicker дедлайна, archive/delete; URL-роутинг открытой карточки через `?card=ID`. BoardDnd рендерится только после mount (dnd-kit генерирует aria-describedby с глобальным счётчиком, расходящимся между сервером и клиентом).
- **Фаза 5 (1+2)** (метки, чек-листы, комментарии): label-actions (CRUD + add/removeFromCard); палитра 18 цветов с разными оттенками для светлой/тёмной темы; popover управления метками доски в шапке; popover назначения меток на карточку в модалке; checklist-actions (CRUD + items + toggle); comment-actions (CRUD; править — только автор, удалять — автор или OWNER); прогресс-бары чек-листов; модалка карточки догружает детали через getCardDetails при открытии (не тащим всё в getBoard); Markdown в комментариях (react-markdown+remark-gfm).
- **Фаза 6** (совместная работа): member-actions (invite/revoke/accept/changeRole/remove/leave/listMembers); приглашения через токен (7 дней TTL); Resend-обёртка с graceful skip если RESEND_API_KEY не задан (вернёт ссылку для ручного шаринга); страница /invite/[token] с обработкой not-found/expired/accepted/wrong-email; ShareDialog в шапке доски с инвайтами и управлением ролями; assignCard action + CardAssigneeButton в модалке (popover со списком участников доски); аватар назначенного на превью карточки; защиты от удаления последнего OWNER. Email enumeration на инвайтах: явно говорим "уже участник" (UX > безопасность для приватной доски).
- **Фаза 7** (AI-агент): 14 tool-функций (list/get + create/update/move/add_label/create_label/add_checklist + delete_card/delete_column через PendingAiAction); адаптивное мышление, дефолт `claude-opus-4-7` (env `ANTHROPIC_MODEL`); SSE-стрим в `/api/ai/chat` через async generator; rate-limit на Postgres (30/час user, 100/день board, тип Activity AI_RATE_HIT); системный промпт с снапшотом колонок и меток; AiPanel (Sheet справа) с подсветкой tool-калов в свёрнутые «карточки активности», подтверждением деструктивных действий, suggestions при первом открытии. Markdown в ответах. История разговоров в AiConversation/AiMessage (последние 40 сообщений в контексте). Также добавлен бренд-rebrand на **Plume** с тёплой охрой как акцентом.
- **Фаза 8** (realtime): pusher-server (singleton, graceful skip без ENV) + pusher-js client; helper `revalidateAndNotifyBoard(boardId)` — делает `revalidatePath` + `notifyBoard` за один вызов; bulk-replace во всех server-actions (board/card/column/checklist/comment/label/member/ai); `BoardRealtime` подписан на `private-board-{id}` и при `board:changed` делает дебаунсенный `router.refresh()`; `/api/pusher/auth` валидирует board-доступ; `/api/realtime/status` сообщает клиенту нужно ли вообще подписываться. **Не настроено по умолчанию** — без Pusher ключей realtime молча отключён.
