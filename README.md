# Стратегический навигатор — фронтенд

Корпоративный фронт на шаблоне SSS (React 19, TypeScript, Vite, `svs-react-ui`). Переносит текущий UI брифов, агента и источников на React.

Бэкенд остаётся FastAPI. В dev Vite проксирует `/api` на `http://127.0.0.1:8080`.

## Стек

| Инструмент | Версия | Назначение |
|---|---|---|
| React | 19 | UI-фреймворк |
| TypeScript | 5.x | Типизация |
| Vite | 7 | Сборка и dev-сервер |
| react-router-dom | 7 | Маршруты SPA |
| svs-react-ui | 12.x | Корпоративная UI-библиотека |
| Jest + Testing Library | 30 / 16 | Тестирование |
| ESLint | 9 (flat config) | Линтинг |
| Prettier | 3 | Форматирование |
| Sass | 1.x | SCSS-модули |
| Husky + lint-staged | 9 / 16 | Git-хуки |

## Требования

- Node.js ≥ 20
- npm ≥ 10
- доступ к `repo.severstal.severstalgroup.com` (пакет `svs-react-ui`)
- запущенный бэкенд на `:8080` для локальной работы с API

## Быстрый старт

```bash
npm install
# в другом терминале, из корня проекта:
# python3 run_web.py --host 0.0.0.0 --port 8080
npm run dev
```

Откройте http://localhost:5173/

## Экраны

- `/login`, `/register` — вход и регистрация
- `/` — бриф за период (бывший `/weekly`)
- `/agent` — RAG-агент
- `/sources` — свои Telegram-каналы

## Команды

```bash
npm run dev          # Dev-сервер (http://localhost:5173)
npm run build        # Production-сборка (tsc + vite build → dist/)
npm run serve        # Предпросмотр production-сборки
npm test             # Запуск тестов
npm run type-check   # Проверка типов без сборки
npm run lint         # Форматирование + линтинг с автофиксом
npm run lint:fix     # Только ESLint с автофиксом
npm run lint:format  # Только Prettier
```

## Структура проекта

```
src/
├── api/            # HTTP-клиент и типы ответов бэкенда
├── assets/
│   ├── css/        # Глобальные стили
│   └── images/     # Статические изображения
├── components/     # Оболочка, сайдбар, UI
├── context/        # Сессия пользователя
├── lib/            # Даты, markdown, правила брифа
├── pages/          # Экраны приложения
└── main.tsx        # Точка входа
```

## Алиасы путей

В коде доступен алиас `~` для корня `src/`:

```ts
import styles from '~/assets/css/index.css'
```

## Темизация

Приложение использует CSS custom properties из `svs-react-ui` для поддержки светлой и тёмной темы. Для цветов используй токены вида `var(--theme-*)` вместо хардкода:

```css
color: var(--theme-text-body);
background-color: var(--theme-background-primary);
border-color: var(--theme-border-primary);
```

## Тесты

Тесты запускаются через Jest + jsdom. CSS-модули замокированы через `identity-obj-proxy`, SVG — через `jest/mockSvg.tsx`.

> `svs-react-ui` подтягивает `d3` (ESM-only). В `jest.config.ts` настроены `transformIgnorePatterns` для корректной обработки этих пакетов через Babel.

Файлы тестов: `src/**/*.test.{ts,tsx}` или `*.spec.{ts,tsx}`.

## Git-хуки

При коммите автоматически запускается `lint-staged`:
- `*.{ts,tsx,js,jsx}` — ESLint + Prettier
- `*.{scss,css,json,md}` — Prettier

## Деплой

Сборка упаковывается в Docker-образ на базе nginx:

```bash
npm run build
docker build -t app-name .
```

Статика раздаётся из `/usr/share/nginx/html` на порту `8080`.

## Поддержка браузеров

Целевая аудитория — современные браузеры (Vite defaults). Для поддержки устаревших браузеров подключи [`@vitejs/plugin-legacy`](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy).