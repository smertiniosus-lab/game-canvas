

# Минимально рабочее состояние: фикс мгновенного проигрыша

## Корень бага

В `create()` после спавна игрока вызывается `applyPlayerBody(false)`. Внутри:

```ts
const body = this.player.body as Phaser.Physics.Arcade.Body;
const oldBottom = body.y + body.height;  // body ещё не инициализирован!
body.setSize(bw, bh, false);
body.setOffset(...);
const newBottom = body.y + body.height;
this.player.y += oldBottom - newBottom;
```

На первом вызове `body.y` и `body.height` соответствуют исходной текстуре `hero.png` (1024×1024) — `body.height ≈ 1024`. После `setSize(28, 84)` `newBottom` становится разумным числом. Разница `oldBottom - newBottom` — огромная (несколько сотен пикселей), и `player.y` уезжает вниз за пределы экрана → срабатывает `if (this.player.y > this.scale.height + 100) this.bust()` → мгновенный Game Over.

Тот же риск есть при первом switch crouch (если `applyPlayerBody` запускается до того, как физика обновила `body.y`).

## Дополнительные мелочи, которые тоже стоит починить для «минимально рабочего» состояния

1. **`tweens.killTweensOf(this.player)` в `applyPlayerBody`** — на первом вызове `this.player` уже создан, всё ок, но при последующих вызовах из `update` мы убиваем walk-twin и spray-jitter одновременно с фактическим срабатыванием — это норм, оставляем.

2. **`applyPlayerBody` в первый раз вызывается до того, как физика «осела»** — лучше пропустить y-коррекцию на самом первом вызове.

3. **Высокая шапка (160-220px) у некоторых стен** при `groundY = (LEVEL_HEIGHT-2)*TILE = 12*64 = 768` — стена-киоск (h=220) центрируется на `cy = 768 - 110 = 658`, верх стены на `658 - 110 = 548`. Это ок, но `player` спавнится на `y = 768 - 60 = 708`, что **внутри** стены-гаража, если бы там она была — но игрок на x=120, гаражи начинаются с x=400. Безопасно.

4. **Стрелки-маркеры над стенами** добавляются в `container(0, 0, [glow, arrow])` — но `glow` и `arrow` уже размещены в мировых координатах. Контейнер с позицией (0,0) их не двигает, но `setDepth(DEPTH_HUD - 5)` на контейнере не пробрасывается на детей, у которых уже свой depth. Это работает, но костыльно.

## Фикс

### A. Фикс мгновенного проигрыша (главное)

В `applyPlayerBody` ввести флаг `bodyInitialized = false`. На первом вызове **пропускать** y-коррекцию (просто выставить body, без `player.y += ...`). На последующих — корректировать как сейчас.

```ts
private bodyInitialized = false;

private applyPlayerBody(crouching: boolean) {
  if (this.player) this.tweens.killTweensOf(this.player);
  const body = this.player.body as Phaser.Physics.Arcade.Body;
  const bw = PLAYER_BODY_W;
  const bh = crouching ? PLAYER_BODY_H_CROUCH : PLAYER_BODY_H;

  let oldBottom = 0;
  if (this.bodyInitialized) {
    oldBottom = body.y + body.height;
  }
  body.setSize(bw, bh, false);
  const tw = this.player.width;
  const th = this.player.height;
  body.setOffset((tw - bw) / 2, th - bh);

  if (this.bodyInitialized) {
    const newBottom = body.y + body.height;
    this.player.y += oldBottom - newBottom;
  }
  this.bodyInitialized = true;

  this.player.setScale(PLAYER_W / tw, PLAYER_H / th);
  this.baseScaleX = this.player.scaleX;
  this.baseScaleY = this.player.scaleY;
  if (crouching) {
    this.player.setScale(this.baseScaleX, this.baseScaleY * 0.9);
    this.player.setAngle(this.facing > 0 ? 6 : -6);
  } else {
    this.player.setAngle(0);
  }
}
```

И сбрасывать `bodyInitialized = false` в начале `create()`.

### B. Подстраховка от падения за карту

Сейчас `if (this.player.y > this.scale.height + 100) this.bust()` использует `scale.height` (≈720). Это должно сравниваться с границей мира, не вьюпорта. Заменить на `physics.world.bounds.height + 100` — мир уже ограничен `setCollideWorldBounds(true)`, так что игрок физически не вылетит. Это второй слой защиты.

### C. Поднять стартовую позицию игрока

Спавнить игрока чуть выше, чтобы он точно «упал» на платформу, а не оказался **внутри** тайла:
```ts
this.player = this.physics.add.sprite(120, groundTopY - 100, "hero");
```
(было `-60` — при PLAYER_H=100 и origin центра, низ спрайта на `groundTopY`, что точно на верхней границе тайла. Безопаснее `-100`.)

### D. Защита от срабатывания `bust()` пока титульная карточка показана

Добавить `if (this.titleCardObjects.length > 0) return;` в начало `update` после проверок паузы, чтобы геймплейная логика (включая копов и проверку y) не запускалась первые секунды. Альтернативно — игнорировать столкновения с копами первые 1.5 сек через `time.delayedCall(1500, () => { /* enable cop overlap */ })`. Выбираем первый вариант (проще).

## Файлы

| Файл | Изменения |
|---|---|
| `src/game/scenes/GameScene.ts` | (A) поле `bodyInitialized`, фикс `applyPlayerBody` чтобы не корректировать y на первом вызове; сброс флага в `create()`. (B) использовать `physics.world.bounds.height + 100` вместо `scale.height + 100` в проверке падения. (C) поднять стартовый Y игрока на `-100`. (D) early-return в `update` пока показана title card. |

## Что НЕ войдёт

- Перерисовка ассетов, новые механики, звук.

После применения: при старте появляется title card, игрок стоит на земле, не проигрывает мгновенно; крауч работает корректно; падение за карту корректно детектируется.

