

# Фиксы: дрожь героя и сплющивание при приседании

## Причины

### 1. Сплющивание при `↓` до пола
В `applyPlayerBody(true)`:
- `body.setSize(28, 48)` + `setOffset(..., th - 48)` сдвигает физтело в **нижние 48px** спрайта.
- `setScale(..., 0.7 * PLAYER_H / th)` уменьшает **визуальный размер** на 30%.
- Origin = `0.5, 0.5` → центр спрайта остаётся на той же Y. Но физтело теперь привязано к нижней части маленького спрайта, поэтому гравитация подтягивает спрайт вниз → визуально герой «проседает в пол» и выглядит сплющенным (только голова торчит).

### 2. Постоянная дрожь
- `squashLand` и jump-tween используют `sx = this.player.scaleX` как **baseline для возврата**. Но если landing случается в момент, когда scale ещё не вернулся от предыдущего tween (а `killTweensOf` обрывает его), baseline сохраняется кривым → накопление искажений.
- `wasOnGround` иногда флипается между кадрами при касании пола (физика подбрасывает на 1 пиксель), что вызывает повторные `squashLand` подряд → постоянная мелкая дрожь.

## Фикс

### A. Хранить базовый scale явно
Ввести поля `baseScaleX`, `baseScaleY`. В `applyPlayerBody` после `setScale(...)` сохранять их. Все tweens (`squashLand`, jump-stretch) делать **от/к этим baseline-значениям**, а не от `this.player.scaleX`. Тогда никакого накопления искажений нет.

```ts
// в applyPlayerBody после setScale:
this.baseScaleX = this.player.scaleX;
this.baseScaleY = this.player.scaleY;

// squashLand:
this.tweens.add({
  targets: this.player,
  scaleY: { from: this.baseScaleY * 0.88, to: this.baseScaleY },
  scaleX: { from: this.baseScaleX * 1.06, to: this.baseScaleX },
  ...
});
```

### B. Не убивать ВСЕ tweens — только scale/angle
`this.tweens.killTweensOf(this.player)` убивает и позиционные tweens (если будут). Заменить на безопасное:
```ts
this.tweens.killTweensOf(this.player, ['scaleX', 'scaleY', 'angle']);
```
И **не вызывать** kill в `applyPlayerBody`, если crouching-состояние не изменилось (а оно уже проверяется в `update`, там и так срабатывает только при изменении).

### C. Дебаунс `squashLand`
Ввести cooldown (`landCooldown = 0`), не запускать squash чаще 1 раза в 250 мс. Это устранит дрожь от микро-касаний пола.

### D. Фикс приседания (не сплющивать в пол)
Убрать визуальное уменьшение спрайта при crouching — оставить **только уменьшение body** для геймплея (низкий профиль для конуса света/обзора копа). Спрайт остаётся в полную высоту, но **слегка наклоняется вперёд** (`angle = ±5`) для визуальной обратной связи. Альтернативно: визуально приседаем через смещение origin Y, не через scale — но это ломает позицию относительно земли.

**Выбираем**: при `crouching = true` оставляем `visualH = PLAYER_H` (никакого уменьшения), но body становится 48px и расположено в нижней части. Спрайт получает `setAngle(facing > 0 ? 8 : -8)` — лёгкий наклон вперёд как индикация. Голова чуть-чуть «сжимается» через `scaleY = baseScaleY * 0.9` — без проседания в пол.

Дополнительно: при выходе из приседа — явный `setAngle(0)` и `setScale(baseScaleX, baseScaleY)` через мгновенный tween (50 мс).

### E. Корректное позиционирование при смене body
При изменении высоты body герой должен оставаться **стоящим на земле**. После `body.setSize/setOffset` принудительно сместить `player.y` так, чтобы низ body совпал с предыдущим низом body:
```ts
const oldBottom = body.y + body.height; // до изменения
body.setSize(bw, bh, false);
body.setOffset(...);
const newBottom = body.y + body.height;
this.player.y += (oldBottom - newBottom);
```

## Файлы

| Файл | Изменения |
|---|---|
| `src/game/scenes/GameScene.ts` | Поля `baseScaleX/Y`, `landCooldown`; `applyPlayerBody`: сохранение baseline, корректировка `player.y` для сохранения позиции ног, убрать визуальное уменьшение при crouch (заменить на лёгкий наклон); `squashLand`/jump-tween: от baseline вместо текущего scale, debounce; `killTweensOf(player, ['scaleX','scaleY','angle'])` вместо общего kill |

## Что НЕ войдёт
- Перерисовка ассетов, спрайт-листы, новые механики.

После применения: при `↓` герой остаётся стоять на земле, чуть пригнувшись (без проседания); вне приседа — никакой постоянной дрожи, scale возвращается к стабильному baseline.

