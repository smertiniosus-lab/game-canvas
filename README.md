# SNAF — Ночь в городе

Стелс-платформер о граффити в декорациях российской провинции. Играешь за подростка с баллончиком: пять стен, патрули ментов с фонарями, баки для укрытия и одна цель — оставить свой тег `SNAF` и не попасться.

Проект построен на **React 18 + Vite + Phaser 3** и развивается в [Lovable](https://lovable.dev). Этот README — точка входа для следующего разработчика (в т.ч. Antigravity-агента), который будет продолжать работу.

---

## 1. Технологический стек

| Слой | Технология |
|---|---|
| UI / страница | React 18 + React Router |
| Сборка | Vite 5 + TypeScript 5 |
| Стили | Tailwind CSS v3 + shadcn/ui (Radix) |
| Игра | Phaser 3 (canvas-рендер, Arcade Physics) |
| Тесты | Vitest |
| Менеджер пакетов | npm / bun (есть оба lock-файла) |

Игра — это один canvas, обёрнутый в React-страницу `/`. Вся механика лежит в `src/game/`. React не вмешивается в игровой цикл — он только монтирует/размонтирует Phaser.

---

## 2. Запуск

```bash
# установка
npm install         # или: bun install

# dev-сервер (Vite, hot reload)
npm run dev

# production-сборка
npm run build
npm run preview

# тесты
npm run test
```

Открыть `http://localhost:8080`. Игра грузится сразу, кликни по канвасу для захвата фокуса клавиатуры.

---

## 3. Структура проекта

```
src/
  pages/
    Index.tsx              — Главная страница, монтирует <PhaserGame />, ставит SEO-теги
    NotFound.tsx           — 404
  components/
    PhaserGame.tsx         — React-обёртка: создаёт Phaser.Game в useEffect, чистит при unmount
    NavLink.tsx
    ui/                    — shadcn-компоненты (не используются игрой, оставлены для UI вне канваса)
  game/
    createGame.ts          — Конфиг Phaser.Game (разрешение, физика, список сцен)
    scenes/
      BootScene.ts         — Прелоадер ассетов (PNG/JPG из public/game/)
      MenuScene.ts         — Главное меню, кнопка "ВЫЙТИ НА УЛИЦУ"
      GameScene.ts         — ОСНОВНАЯ СЦЕНА (~1200 строк): игрок, копы, стены, тэгинг, баки, параллакс
      UIScene.ts           — HUD: счётчик тэгов, шкала шухера, иконки состояний
      GameOverScene.ts     — Финальный экран (победа / поражение), счёт
  hooks/                   — use-toast, use-mobile (React-уровень, для будущего UI вне канваса)
  lib/utils.ts             — cn() для Tailwind
  index.css                — Tailwind директивы + дизайн-токены (HSL)
  main.tsx                 — Точка входа React

public/game/               — Все игровые ассеты (PNG-стены, фоны, спрайты hero/cop/dumpster)
```

---

## 4. Игровые системы (что где в `GameScene.ts`)

### 4.1 Игрок
- Спрайт `hero`, физтело Arcade.
- `applyPlayerBody(crouching)` — пересчитывает размер физтела при приседании. **Важно**: первый вызов в `create()` использует флаг `firstPlayerBodyApply`, чтобы не корректировать `y` до инициализации тела.
- Управление: `← →` идти, `SHIFT` краться (тише, копы хуже видят), `SPACE`/`↑` прыжок (двойной), `↓` присесть, `X` баллончик, `Z` спрятаться в бак, `ESC` пауза.

### 4.2 Стены и тэгинг
- `spawnWall(kind, x, groundY, taggable)` — создаёт стену одного из типов: `garage` / `brick` / `concrete` / `kiosk` / `fence`.
- Каждая стена имеет:
  - спрайт (текстура из `public/game/wall_*.png`),
  - `zone` (расширенная физическая область для триггера тэгинга),
  - `letters` — `Phaser.GameObjects.Text` для надписи `SNAF`,
  - `marker` — жёлтая стрелка ▼ + glow, индикатор «сюда».
- `getNearbyWall()` — возвращает **ближайшую по X** активную стену из тех, в чьей зоне игрок (важно при перекрытии зон).
- `updateTagging(delta, reg)` — пока зажат `X` у стены: растёт `progress`, по очереди появляются буквы S→N→A→F. По завершении (`progress >= 1`):
  - текст фиксируется красным `#e02828` с чёрной обводкой и italic-наклоном `-6°`,
  - под буквами рисуются 4-7 «подтёков» (красные прямоугольники),
  - вокруг разбрасываются 6-10 «брызг» (красные кружки),
  - `wall.done = true`, `marker` скрывается, счётчик `reg.tags` инкрементится.
- При накоплении 5 тэгов вызывается `spawnEscapeMarker()` — флажок «ВЫХОД» в конце уровня.

### 4.3 Копы
- `spawnCop(kind, x)` — `walker` (патрулирует туда-сюда) или `light` (стационарный с конусом фонаря).
- `updateCops()` — состояния `patrol → alert → chase`. Заметили игрока → растёт `reg.heat` (шкала шухера). При `heat >= maxHeat` или прямом контакте — `gameOver(false)`.
- Игрок невидим если: сидит в баке, крадётся достаточно далеко, не находится в конусе фонаря.

### 4.4 Бак (dumpster)
- `spawnDumpster(x)` — два спрайта: `dumpster_back` (за игроком) и `dumpster_front` (перед).
- `enterDumpster()` / `exitDumpster()` по `Z`. В баке игрок неподвижен, копы его не видят, шухер падает.

### 4.5 Параллакс
- 3 слоя `tileSprite`: `bg_far` (далёкий, x0.2), `bg_mid` (x0.5), `bg_near` (x0.8). Скроллятся в `update()` пропорционально `cameras.main.scrollX`.

### 4.6 Состояние и UIScene
- `GameScene` пишет в `this.registry.set('game', { tags, totalTags, heat, maxHeat, spraying, hidden, ... })`.
- `UIScene` подписан на `registry.events.on('changedata-game', ...)` и перерисовывает HUD без прямой связи со сценой игры.

---

## 5. Управление (карта клавиш)

| Клавиша | Действие |
|---|---|
| ← / → | Идти влево / вправо |
| SHIFT (удержание) | Красться (тише, медленнее) |
| SPACE / ↑ | Прыжок (двойной) |
| ↓ | Присесть |
| X (удержание у стены) | Красить баллончиком |
| Z | Спрятаться в бак / вылезти |
| ESC | Пауза |
| SPACE / ENTER (в меню) | Старт |

---

## 6. Где править ключевые константы

| Что | Файл | Переменная |
|---|---|---|
| Гравитация, размер канваса, список сцен | `src/game/createGame.ts` | объект `config` |
| Размер игрока | `src/game/scenes/GameScene.ts` | `PLAYER_W`, `PLAYER_H` |
| Размер уровня | `src/game/scenes/GameScene.ts` | `LEVEL_WIDTH`, `LEVEL_HEIGHT`, `TILE` |
| Целевое число тэгов | `src/game/scenes/GameScene.ts` | `targetTags` (в `create()`) |
| Расстановка стен | `src/game/scenes/GameScene.ts` | массив `wallGroups` в `create()` |
| Расстановка копов | `src/game/scenes/GameScene.ts` | массив `copSpawns` в `create()` |
| Расстановка баков | `src/game/scenes/GameScene.ts` | массив `dumpsterX` в `create()` |
| Стиль тэга SNAF | `src/game/scenes/GameScene.ts` | `spawnWall` (создание `letters`) и `updateTagging` (момент `done`) |
| Z-порядок (depth) | `src/game/scenes/GameScene.ts` | константы `DEPTH_*` сверху файла |

---

## 7. Известные ограничения / TODO

- **Один уровень**, без процедурной генерации и без смены ночь/день.
- **Нет звука** — ни музыки, ни SFX.
- **Нет sprite-sheets** — `hero` и `cop` это статичные PNG, никаких frame-анимаций ходьбы/прыжка. Только tween-эффекты (scale, angle).
- **Нет мобильного управления** — только клавиатура.
- **wall_tagged.png** лежит в `public/game/` но не загружается в `BootScene` (мёртвый ассет, оставлен на случай возврата).
- **Тесты** — только `src/test/example.test.ts`, игровая логика не покрыта.

---

## 8. Как добавить контент

### Новый тип стены
1. Положить PNG в `public/game/wall_<kind>.png`.
2. В `BootScene.preload()` добавить `this.load.image("wall_<kind>", "/game/wall_<kind>.png")`.
3. В `GameScene.ts` расширить тип `WallKind` и объект `dims` в `spawnWall()` (ширина, высота, ключ текстуры).
4. Добавить группу с этим `kind` в `wallGroups` в `create()`.

### Новый тип копа
1. PNG в `public/game/cop_<kind>.png` + загрузка в `BootScene`.
2. В `spawnCop()` добавить ветку (поведение в `updateCops()`).
3. Записать спавн в `copSpawns`.

### Новый ассет
- Любой PNG/JPG → `public/game/` → `this.load.image(key, path)` в `BootScene` → `this.add.image(x, y, key)` в нужной сцене.
- Помни про `setDisplaySize(w, h)`: `setTexture()` сбрасывает размер обратно к нативному размеру файла. Если ассет 1024×1024 — он развернётся на пол-экрана.

---

## 9. Lovable-специфика

- Проект создан и редактируется в [Lovable](https://lovable.dev). Изменения в редакторе автоматически синхронизируются с Git-репозиторием.
- Публикация: кнопка **Publish** в правом верхнем углу редактора. Кастомный домен — Project → Settings → Domains (нужен платный план).
- Lovable Cloud (бэкенд: БД, авторизация, edge functions) **не подключён** — игра полностью клиентская.
- Чтобы продолжить разработку вне Lovable: `git clone` → `npm install` → `npm run dev`. Любая IDE/агент справится.

---

## 10. Архитектурные решения, которые стоит сохранить

- **Phaser изолирован от React** — не дёргать сцены из React-компонентов, не пробрасывать props в игру. Связь — через `registry` или `scene.events`.
- **Один длинный `GameScene`** — намеренно. Расщеплять на классы только если файл переходит за ~1500 строк или появляется явно отдельная подсистема (например, инвентарь).
- **Все размеры стен/игрока — через `setDisplaySize`**, не через `scale`. Так проще читать и не зависеть от размера исходника PNG.
- **HUD — отдельная сцена** (`UIScene`), запускается через `scene.launch`. Никакого DOM-оверлея.
