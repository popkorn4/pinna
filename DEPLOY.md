# Деплой Pinna на Vercel + Neon

## Краткая инструкция

1. **Neon** → создать проект → скопировать Pooled connection string
2. **GitHub** → создать репо `pinna` → запушить локальный код
3. **Vercel** → New Project → импортировать репо → вставить ENV → Deploy
4. Проверить что миграции применились (Vercel build лог)
5. Подключить домен `pinna.pro` в Vercel и в reg.ru

## Подробно

### Neon (Postgres)
1. neon.tech → войти через GitHub
2. Create Project: name `pinna`, Postgres 16, Region EU Central (Frankfurt)
3. На главной проекта → блок Connection Details → выбрать **Pooled connection** → скопировать строку (вида `postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`)

### GitHub
```sh
# В корне kanban-app
gh repo create pinna --private --source=. --remote=origin --push
# или вручную через сайт github.com → New Repository → следовать инструкциям
```

### Vercel
1. vercel.com → войти через GitHub
2. **Add New → Project** → выбрать репо pinna
3. Framework: Next.js (определит сам). Root Directory: `.`
4. **Environment Variables** — нажми "Add" для каждой переменной из `.env.production.example`
   - `DATABASE_URL` — строка из Neon (Pooled)
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32` (новый, не из dev!)
   - `NEXTAUTH_URL` — `https://pinna.pro`
   - Остальные — по желанию (AI, Realtime)
5. **Deploy** — первая сборка ~3-5 минут. Применит миграции через `prisma migrate deploy` (это в build-команде package.json).
6. После деплоя: открыть `https://pinna-xxx.vercel.app/api/health` — должно вернуть `{"status":"ok","db":true}`

### Подключение домена
1. В Vercel → Project → Settings → Domains → Add → ввести `pinna.pro` → Vercel выдаст DNS-запись (A или CNAME)
2. На **reg.ru** → твой домен → Управление зоной DNS → добавить запись из Vercel
3. Подождать 5-30 минут, пока DNS пропагнётся
4. SSL Vercel выпустит автоматически за ~1 минуту после DNS

## Обновления

После любого `git push` в `main` Vercel автоматически собирает и деплоит. Превью каждой ветки/PR — на отдельных URL.

## Проверка после деплоя

Чек-лист на проде:
- [ ] `https://pinna.pro/` — лендинг
- [ ] `https://pinna.pro/api/health` — `{"status":"ok"}`
- [ ] Регистрация нового пользователя
- [ ] Создание доски, перенос карточек (drag&drop)
- [ ] AI-агент (если ключ задан)
- [ ] Realtime между двумя браузерами

## Откат

Vercel хранит все деплои. Вкладка Deployments → у нужного → меню «...» → **Promote to Production** — мгновенный откат на любую предыдущую версию.

## Стоимость на старте

- Neon Free: 0.5 ГБ + ~190 compute hours / мес
- Vercel Hobby: 100 ГБ трафика, неограниченные сборки
- **Итого: 0 ₽/мес** до первых тысяч пользователей или гигабайт данных
