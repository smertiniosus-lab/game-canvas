import Phaser from "phaser";

const TILE = 64;
const LEVEL_WIDTH = 80; // tiles
const LEVEL_HEIGHT = 14;

// Level layout: 1 = ground, 2 = floating platform, 0 = empty
// Generate: ground row at bottom with some gaps, plus floating platforms
function buildLevel(): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < LEVEL_HEIGHT; y++) {
    grid.push(new Array(LEVEL_WIDTH).fill(0));
  }
  // Ground
  for (let x = 0; x < LEVEL_WIDTH; x++) {
    // gaps
    if ((x > 12 && x < 15) || (x > 28 && x < 31) || (x > 48 && x < 51)) continue;
    grid[LEVEL_HEIGHT - 1][x] = 1;
    grid[LEVEL_HEIGHT - 2][x] = 1; // 2-tile thick ground for visuals
  }
  // Floating platforms
  const plats: Array<[number, number, number]> = [
    [8, 9, 3],
    [16, 8, 3],
    [22, 7, 4],
    [33, 9, 3],
    [40, 8, 4],
    [54, 9, 3],
    [60, 7, 4],
    [66, 8, 3],
  ];
  for (const [x, y, len] of plats) {
    for (let i = 0; i < len; i++) grid[y][x + i] = 2;
  }
  return grid;
}

interface GameRegistry {
  hp: number;
  maxHp: number;
  score: number;
  bossHp: number;
  bossMaxHp: number;
  bossActive: boolean;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private boss?: Phaser.Physics.Arcade.Sprite;

  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;

  private lastShotAt = 0;
  private jumpsLeft = 2;
  private jumpKeyHeld = false;
  private dashCdUntil = 0;
  private dashingUntil = 0;
  private invulnUntil = 0;
  private facing: 1 | -1 = 1;
  private bossPhase = 0;
  private bossNextAttack = 0;
  private worldWidthPx = LEVEL_WIDTH * TILE;
  private isPaused = false;

  constructor() {
    super("GameScene");
  }

  create() {
    const cam = this.cameras.main;
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    // Reset registry
    const reg: GameRegistry = {
      hp: 3,
      maxHp: 3,
      score: 0,
      bossHp: 30,
      bossMaxHp: 30,
      bossActive: false,
    };
    this.registry.set("game", reg);

    // Parallax backgrounds
    this.bgFar = this.add
      .tileSprite(0, 0, viewW, viewH, "bg_far")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    // Scale far bg to fill height
    const farTex = this.textures.get("bg_far").getSourceImage() as HTMLImageElement;
    this.bgFar.setTileScale(viewH / farTex.height, viewH / farTex.height);

    this.bgMid = this.add
      .tileSprite(0, viewH - 360, viewW, 360, "bg_mid")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.bgMid.setTileScale(0.45, 0.45);

    this.bgNear = this.add
      .tileSprite(0, viewH - 200, viewW, 200, "bg_near")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.bgNear.setTileScale(0.35, 0.35);

    // World
    this.physics.world.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBackgroundColor("#f3d36b");

    // Tiles
    this.platforms = this.physics.add.staticGroup();
    const grid = buildLevel();
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== 0) {
          const px = x * TILE + TILE / 2;
          const py = y * TILE + TILE / 2;
          const tile = this.platforms.create(px, py, "tile") as Phaser.Physics.Arcade.Sprite;
          tile.setDisplaySize(TILE, TILE).refreshBody();
          tile.setVisible(false); // we draw our own visuals below
        }
      }
    }
    // Visual layer: draw a single ground band + platform sprites for performance
    this.drawGroundVisuals(grid);

    // Player
    const spawnY = (LEVEL_HEIGHT - 3) * TILE;
    this.player = this.physics.add.sprite(120, spawnY, "hero");
    this.player.setDisplaySize(72, 88);
    this.player.body!.setSize(this.player.width * 0.45, this.player.height * 0.85);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(360, 900);
    this.physics.add.collider(this.player, this.platforms);

    cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.keyEsc.on("down", () => this.togglePause());

    // Groups
    this.bullets = this.physics.add.group({ allowGravity: false, maxSize: 30 });
    this.enemyBullets = this.physics.add.group({ allowGravity: false });
    this.enemies = this.physics.add.group();
    this.coins = this.physics.add.group({ allowGravity: false });

    // Spawn enemies
    this.spawnEnemy("walker", 700, spawnY);
    this.spawnEnemy("walker", 1500, spawnY);
    this.spawnEnemy("walker", 2400, spawnY);
    this.spawnEnemy("flyer", 1100, viewH - 420);
    this.spawnEnemy("flyer", 2100, viewH - 460);
    this.spawnEnemy("flyer", 3200, viewH - 420);
    this.spawnEnemy("walker", 3600, spawnY);
    this.spawnEnemy("walker", 4200, spawnY);

    // Coins
    const coinPositions: Array<[number, number]> = [
      [400, spawnY - 120],
      [560, spawnY - 120],
      [720, spawnY - 120],
      [1100, 9 * TILE - 40],
      [1280, 8 * TILE - 40],
      [1450, 7 * TILE - 40],
      [2150, 9 * TILE - 40],
      [2600, 8 * TILE - 40],
      [3500, 9 * TILE - 40],
      [3900, 7 * TILE - 40],
      [4400, spawnY - 120],
    ];
    for (const [x, y] of coinPositions) this.spawnCoin(x, y);

    // Boss spawn at end
    this.spawnBoss(this.worldWidthPx - 500, spawnY - 60);

    // Colliders
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) =>
      this.onBulletHitEnemy(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite),
    );
    if (this.boss) {
      this.physics.add.collider(this.boss, this.platforms);
      this.physics.add.overlap(this.bullets, this.boss, (b) =>
        this.onBulletHitBoss(b as Phaser.Physics.Arcade.Sprite),
      );
      this.physics.add.overlap(this.player, this.boss, () => this.takeDamage());
    }
    this.physics.add.overlap(this.player, this.enemies, () => this.takeDamage());
    this.physics.add.overlap(this.player, this.enemyBullets, (_, b) => {
      (b as Phaser.Physics.Arcade.Sprite).destroy();
      this.takeDamage();
    });
    this.physics.add.overlap(this.player, this.coins, (_, c) => {
      const reg = this.registry.get("game") as GameRegistry;
      reg.score += 100;
      this.registry.set("game", reg);
      this.events.emit("hudUpdate");
      (c as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // Title card flash
    this.showTitleCard();
  }

  private drawGroundVisuals(grid: number[][]) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== 0) {
          const px = x * TILE + TILE / 2;
          const py = y * TILE + TILE / 2;
          const img = this.add.image(px, py, "tile");
          img.setDisplaySize(TILE + 2, TILE + 2);
          // Slightly tint deeper rows
          if (y > LEVEL_HEIGHT - 2) img.setTint(0xb88a55);
        }
      }
    }
  }

  private showTitleCard() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    const card = this.add
      .text(w / 2, h / 2, "ROUND 1\nFOREST FRENZY", {
        fontFamily: "Georgia, serif",
        fontSize: "56px",
        color: "#fff3d4",
        align: "center",
        backgroundColor: "#3a2a1a",
        padding: { x: 40, y: 24 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    const fight = this.add
      .text(w / 2, h / 2 + 130, "FIGHT!", {
        fontFamily: "Georgia, serif",
        fontSize: "72px",
        color: "#c44b3a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({
      targets: fight,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 400,
      delay: 700,
      yoyo: true,
      onComplete: () => {
        card.destroy();
        fight.destroy();
      },
    });
    cam.flash(300, 255, 243, 212);
  }

  private spawnEnemy(kind: "walker" | "flyer", x: number, y: number) {
    const e = this.physics.add.sprite(x, y, kind);
    e.setDisplaySize(64, 64);
    e.setData("kind", kind);
    e.setData("hp", kind === "walker" ? 2 : 2);
    if (kind === "walker") {
      e.setVelocityX(-60);
      e.setData("dir", -1);
      e.setBounce(0);
    } else {
      e.body!.gravity.y = -800; // cancel gravity for flyer (Arcade has world gravity)
      e.setData("startY", y);
      e.setData("startX", x);
      e.setData("shootCd", 1500 + Math.random() * 1000);
    }
    this.enemies.add(e);
  }

  private spawnCoin(x: number, y: number) {
    const c = this.physics.add.sprite(x, y, "coin");
    c.setDisplaySize(36, 36);
    c.body!.allowGravity = false;
    this.tweens.add({
      targets: c,
      y: y - 8,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    this.coins.add(c);
  }

  private spawnBoss(x: number, y: number) {
    const b = this.physics.add.sprite(x, y, "boss");
    b.setDisplaySize(180, 180);
    b.body!.setSize(b.width * 0.6, b.height * 0.7);
    b.setCollideWorldBounds(true);
    b.setData("dir", -1);
    this.boss = b;
  }

  private fireBullet() {
    const now = this.time.now;
    if (now - this.lastShotAt < 140) return;
    this.lastShotAt = now;

    const up = this.cursors.up?.isDown || this.keySpace.isDown;
    const down = this.cursors.down?.isDown;
    const left = this.cursors.left?.isDown;
    const right = this.cursors.right?.isDown;

    let vx = this.facing * 700;
    let vy = 0;
    if (up && !left && !right) {
      vx = 0;
      vy = -700;
    } else if (down && !this.player.body!.blocked.down) {
      vx = 0;
      vy = 700;
    } else if (up && (left || right)) {
      vx = (left ? -1 : 1) * 500;
      vy = -500;
    }

    const b = this.bullets.get(this.player.x + this.facing * 30, this.player.y - 10, "bullet") as
      | Phaser.Physics.Arcade.Sprite
      | null;
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.setDisplaySize(28, 28);
    (b.body as Phaser.Physics.Arcade.Body).reset(this.player.x + this.facing * 30, this.player.y - 10);
    b.setVelocity(vx, vy);
    b.setRotation(Math.atan2(vy, vx));
    this.time.delayedCall(900, () => {
      if (b.active) {
        b.setActive(false).setVisible(false);
        (b.body as Phaser.Physics.Arcade.Body).reset(-100, -100);
      }
    });

    // Recoil
    this.player.setVelocityX(this.player.body!.velocity.x - this.facing * 25);
  }

  private onBulletHitEnemy(b: Phaser.Physics.Arcade.Sprite, e: Phaser.Physics.Arcade.Sprite) {
    b.setActive(false).setVisible(false);
    (b.body as Phaser.Physics.Arcade.Body).reset(-100, -100);
    const hp = (e.getData("hp") as number) - 1;
    e.setData("hp", hp);
    e.setTintFill(0xffffff);
    this.time.delayedCall(60, () => e.clearTint());
    if (hp <= 0) {
      const reg = this.registry.get("game") as GameRegistry;
      reg.score += 250;
      this.registry.set("game", reg);
      this.events.emit("hudUpdate");
      // Poof
      this.cameras.main.shake(80, 0.003);
      e.destroy();
    }
  }

  private onBulletHitBoss(b: Phaser.Physics.Arcade.Sprite) {
    b.setActive(false).setVisible(false);
    (b.body as Phaser.Physics.Arcade.Body).reset(-100, -100);
    if (!this.boss) return;
    const reg = this.registry.get("game") as GameRegistry;
    reg.bossHp = Math.max(0, reg.bossHp - 1);
    this.registry.set("game", reg);
    this.events.emit("hudUpdate");
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(60, () => this.boss?.clearTint());
    if (reg.bossHp <= 0) {
      this.cameras.main.shake(400, 0.02);
      this.boss.destroy();
      this.boss = undefined;
      this.time.delayedCall(800, () => {
        this.scene.stop("UIScene");
        this.scene.start("GameOverScene", { victory: true, score: reg.score });
      });
    }
  }

  private takeDamage() {
    const now = this.time.now;
    if (now < this.invulnUntil) return;
    this.invulnUntil = now + 1200;

    const reg = this.registry.get("game") as GameRegistry;
    reg.hp = Math.max(0, reg.hp - 1);
    this.registry.set("game", reg);
    this.events.emit("hudUpdate");

    // Knockback
    this.player.setVelocity(-this.facing * 250, -300);
    this.cameras.main.shake(150, 0.01);

    // Flash
    const flashTween = this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      yoyo: true,
      repeat: 6,
      duration: 80,
      onComplete: () => this.player.setAlpha(1),
    });

    if (reg.hp <= 0) {
      flashTween.stop();
      this.player.setAlpha(0.3);
      this.time.delayedCall(700, () => {
        this.scene.stop("UIScene");
        this.scene.start("GameOverScene", { victory: false, score: reg.score });
      });
    }
  }

  private togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      const w = this.scale.width;
      const h = this.scale.height;
      const t = this.add
        .text(w / 2, h / 2, "PAUSED\n(press ESC to resume)", {
          fontFamily: "Georgia, serif",
          fontSize: "44px",
          color: "#fff3d4",
          align: "center",
          backgroundColor: "#3a2a1ad8",
          padding: { x: 40, y: 24 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200)
        .setName("pauseLabel");
    } else {
      this.physics.world.resume();
      this.children.getByName("pauseLabel")?.destroy();
    }
  }

  update(time: number, delta: number) {
    if (this.isPaused) return;

    // Parallax
    const camX = this.cameras.main.scrollX;
    this.bgFar.tilePositionX = camX * 0.1;
    this.bgMid.tilePositionX = camX * 0.4;
    this.bgNear.tilePositionX = camX * 0.75;

    // Movement
    const left = this.cursors.left?.isDown;
    const right = this.cursors.right?.isDown;
    const dashing = time < this.dashingUntil;

    if (!dashing) {
      if (left) {
        this.player.setVelocityX(-260);
        this.facing = -1;
        this.player.setFlipX(true);
      } else if (right) {
        this.player.setVelocityX(260);
        this.facing = 1;
        this.player.setFlipX(false);
      } else {
        this.player.setVelocityX(this.player.body!.velocity.x * 0.8);
      }
    }

    // Jump
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);
    const onGround = this.player.body!.blocked.down;
    if (onGround) this.jumpsLeft = 2;
    if (jumpPressed && this.jumpsLeft > 0) {
      this.player.setVelocityY(-520);
      this.jumpsLeft--;
    }

    // Shoot
    if (this.keyX.isDown) this.fireBullet();

    // Dash
    if (Phaser.Input.Keyboard.JustDown(this.keyZ) && time > this.dashCdUntil) {
      this.dashingUntil = time + 220;
      this.dashCdUntil = time + 700;
      this.player.setVelocityX(this.facing * 700);
      this.player.setVelocityY(0);
      this.invulnUntil = Math.max(this.invulnUntil, time + 220);
      // Dash trail
      const ghost = this.add
        .image(this.player.x, this.player.y, "hero")
        .setDisplaySize(72, 88)
        .setAlpha(0.5)
        .setFlipX(this.facing < 0)
        .setTint(0x66ccff);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 250,
        onComplete: () => ghost.destroy(),
      });
    }

    // Fell off world
    if (this.player.y > this.scale.height + 100) {
      const reg = this.registry.get("game") as GameRegistry;
      reg.hp = 0;
      this.registry.set("game", reg);
      this.events.emit("hudUpdate");
      this.scene.stop("UIScene");
      this.scene.start("GameOverScene", { victory: false, score: reg.score });
    }

    // Enemy AI
    this.enemies.children.iterate((obj) => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return true;
      const kind = e.getData("kind") as "walker" | "flyer";
      if (kind === "walker") {
        const dir = e.getData("dir") as number;
        if (e.body!.blocked.left) {
          e.setData("dir", 1);
          e.setVelocityX(60);
          e.setFlipX(true);
        } else if (e.body!.blocked.right) {
          e.setData("dir", -1);
          e.setVelocityX(-60);
          e.setFlipX(false);
        } else {
          e.setVelocityX(dir * 60);
        }
      } else {
        // Flyer: bob, follow player loosely, shoot
        const startY = e.getData("startY") as number;
        e.y = startY + Math.sin(time / 400 + e.x * 0.01) * 30;
        const dx = this.player.x - e.x;
        e.setVelocityX(Phaser.Math.Clamp(dx, -80, 80));
        e.setFlipX(dx < 0);
        const cd = e.getData("shootCd") as number;
        const next = (e.getData("nextShot") as number) || 0;
        if (time > next && Math.abs(dx) < 600) {
          e.setData("nextShot", time + cd);
          this.fireEnemyBullet(e.x, e.y, this.player.x, this.player.y);
        }
      }
      return true;
    });

    // Boss AI: activate when player gets close
    if (this.boss) {
      const reg = this.registry.get("game") as GameRegistry;
      const dist = this.player.x - this.boss.x;
      if (!reg.bossActive && Math.abs(dist) < 700) {
        reg.bossActive = true;
        this.registry.set("game", reg);
        this.events.emit("hudUpdate");
        this.bossNextAttack = time + 1500;
        this.cameras.main.flash(200, 196, 75, 58);
      }
      if (reg.bossActive) {
        this.boss.setFlipX(dist > 0);
        // Slow chase
        this.boss.setVelocityX(Phaser.Math.Clamp(dist, -50, 50));
        if (time > this.bossNextAttack) {
          this.bossNextAttack = time + 2200;
          this.bossPhase = (this.bossPhase + 1) % 2;
          if (this.bossPhase === 0) {
            // Jump
            if (this.boss.body!.blocked.down) this.boss.setVelocityY(-650);
          } else {
            // Wave of projectiles
            for (let i = -2; i <= 2; i++) {
              const ang = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x) +
                i * 0.25;
              const sp = 280;
              this.fireEnemyBulletAngle(this.boss.x, this.boss.y - 20, Math.cos(ang) * sp, Math.sin(ang) * sp);
            }
          }
        }
      }
    }
  }

  private fireEnemyBullet(fx: number, fy: number, tx: number, ty: number) {
    const ang = Math.atan2(ty - fy, tx - fx);
    const sp = 260;
    this.fireEnemyBulletAngle(fx, fy, Math.cos(ang) * sp, Math.sin(ang) * sp);
  }

  private fireEnemyBulletAngle(x: number, y: number, vx: number, vy: number) {
    const b = this.physics.add.sprite(x, y, "bullet");
    b.setDisplaySize(28, 28);
    b.setTint(0xffaa44);
    b.body!.allowGravity = false;
    b.setVelocity(vx, vy);
    b.setRotation(Math.atan2(vy, vx));
    this.enemyBullets.add(b);
    this.time.delayedCall(2500, () => b.destroy());
  }
}
