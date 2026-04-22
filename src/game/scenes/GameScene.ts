import Phaser from "phaser";

const TILE = 64;
const LEVEL_WIDTH = 90; // tiles
const LEVEL_HEIGHT = 14;

interface GameRegistry {
  tags: number;
  totalTags: number;
  heat: number;
  maxHeat: number;
  hidden: boolean;
  spraying: boolean;
  crouching: boolean;
}

interface WallData {
  sprite: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  progress: number;
  done: boolean;
  letters: Phaser.GameObjects.Text;
}

interface CopData {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: "walker" | "light";
  patrolMin: number;
  patrolMax: number;
  dir: 1 | -1;
  state: "patrol" | "alert" | "chase";
  alertTimer: number;
  alertIcon: Phaser.GameObjects.Text;
  cone?: Phaser.GameObjects.Graphics;
  facing: 1 | -1;
}

// Player display sizes
const PLAYER_W = 60;
const PLAYER_H = 96;
const PLAYER_BODY_W = 28;
const PLAYER_BODY_H = 82;
const PLAYER_BODY_H_CROUCH = 46;

const COP_W = 60;
const COP_H = 96;
const COP_BODY_W = 28;
const COP_BODY_H = 82;

function buildLevel(): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < LEVEL_HEIGHT; y++) {
    grid.push(new Array(LEVEL_WIDTH).fill(0));
  }
  for (let x = 0; x < LEVEL_WIDTH; x++) {
    grid[LEVEL_HEIGHT - 1][x] = 1;
    grid[LEVEL_HEIGHT - 2][x] = 1;
  }
  const ledges: Array<[number, number, number]> = [
    [10, 9, 3],
    [22, 8, 4],
    [38, 9, 3],
    [52, 8, 4],
    [68, 9, 3],
    [78, 8, 3],
  ];
  for (const [x, y, len] of ledges) {
    for (let i = 0; i < len; i++) grid[y][x + i] = 2;
  }
  return grid;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private walls: WallData[] = [];
  private hidingSpots: Phaser.GameObjects.Image[] = [];
  private cops: CopData[] = [];
  private escapeMarker?: Phaser.GameObjects.Container;

  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;

  private jumpsLeft = 2;
  private facing: 1 | -1 = 1;
  private worldWidthPx = LEVEL_WIDTH * TILE;
  private isPaused = false;
  private currentWall?: WallData;
  private spotted = false;
  private gameEnded = false;
  private crouching = false;

  constructor() {
    super("GameScene");
  }

  create() {
    this.gameEnded = false;
    this.spotted = false;
    this.walls = [];
    this.hidingSpots = [];
    this.cops = [];
    this.currentWall = undefined;
    this.crouching = false;
    this.escapeMarker = undefined;

    const cam = this.cameras.main;
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    const reg: GameRegistry = {
      tags: 0,
      totalTags: 5,
      heat: 0,
      maxHeat: 100,
      hidden: false,
      spraying: false,
      crouching: false,
    };
    this.registry.set("game", reg);

    // Parallax — provincial Russian night
    this.bgFar = this.add
      .tileSprite(0, 0, viewW, viewH, "bg_far")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    const farTex = this.textures.get("bg_far").getSourceImage() as HTMLImageElement;
    this.bgFar.setTileScale(viewH / farTex.height, viewH / farTex.height);

    this.bgMid = this.add
      .tileSprite(0, viewH - 380, viewW, 380, "bg_mid")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.bgMid.setTileScale(0.5, 0.5);
    this.bgMid.setAlpha(0.9);

    this.bgNear = this.add
      .tileSprite(0, viewH - 200, viewW, 200, "bg_near")
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.bgNear.setTileScale(0.4, 0.4);

    // Night tint
    this.add
      .rectangle(0, 0, viewW, viewH, 0x0a0d1a, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.physics.world.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBackgroundColor("#0a0d1a");

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
          tile.setVisible(false);
        }
      }
    }
    this.drawGroundVisuals(grid);

    // Walls to tag
    const wallPositions = [400, 1200, 2200, 3300, 4400];
    for (const wx of wallPositions) {
      this.spawnWall(wx, (LEVEL_HEIGHT - 2) * TILE);
    }

    // Hiding spots
    const dumpsterPositions = [700, 1500, 2700, 3700, 4100, 5000];
    for (const dx of dumpsterPositions) {
      this.spawnDumpster(dx, (LEVEL_HEIGHT - 2) * TILE - 38);
    }

    // Player
    const groundTopY = (LEVEL_HEIGHT - 2) * TILE;
    this.player = this.physics.add.sprite(120, groundTopY - 60, "hero");
    this.player.setDisplaySize(PLAYER_W, PLAYER_H);
    this.applyPlayerBody(false);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(360, 900);
    this.physics.add.collider(this.player, this.platforms);

    cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on("down", () => this.togglePause());

    // Cops — distributed evenly, walkers far apart
    this.spawnCop("walker", 800, groundTopY, 600, 1100);
    this.spawnCop("light", 1700, groundTopY, 1700, 1700);
    this.spawnCop("walker", 2700, groundTopY, 2400, 3000);
    this.spawnCop("light", 3500, groundTopY, 3500, 3500);
    this.spawnCop("walker", 4300, groundTopY, 4000, 4700);
    this.spawnCop("walker", 5200, groundTopY, 5000, 5500);

    // Cop colliders
    this.cops.forEach((c) => {
      this.physics.add.collider(c.sprite, this.platforms);
      this.physics.add.overlap(this.player, c.sprite, () => this.bust());
    });

    this.showTitleCard();
  }

  private applyPlayerBody(crouching: boolean) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const bw = PLAYER_BODY_W;
    const bh = crouching ? PLAYER_BODY_H_CROUCH : PLAYER_BODY_H;
    body.setSize(bw, bh, false);
    // Center horizontally on the texture, anchor body to bottom of sprite
    const tw = this.player.width;
    const th = this.player.height;
    body.setOffset((tw - bw) / 2, th - bh);
    this.player.setScale(PLAYER_W / tw, (crouching ? PLAYER_H * 0.65 : PLAYER_H) / th);
  }

  private drawGroundVisuals(grid: number[][]) {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== 0) {
          const px = x * TILE + TILE / 2;
          const py = y * TILE + TILE / 2;
          const img = this.add.image(px, py, "tile");
          img.setDisplaySize(TILE + 2, TILE + 2);
          if (grid[y][x] === 2) img.setTint(0x6a6f7d);
          else if (y > LEVEL_HEIGHT - 2) img.setTint(0x4a4f5a);
        }
      }
    }
  }

  private showTitleCard() {
    const w = this.scale.width;
    const h = this.scale.height;
    const card = this.add
      .text(w / 2, h / 2, "ЗАДАНИЕ НА НОЧЬ\nЗАКРАСИТЬ 5 СТЕН", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "54px",
        color: "#7ec8ff",
        align: "center",
        backgroundColor: "#0a0d1ad8",
        padding: { x: 40, y: 24 },
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    const go = this.add
      .text(w / 2, h / 2 + 130, "ПОЕХАЛИ!", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "84px",
        color: "#ffd400",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0);

    this.tweens.add({
      targets: go,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 400,
      delay: 700,
      yoyo: true,
      onComplete: () => {
        card.destroy();
        go.destroy();
      },
    });
    this.cameras.main.flash(300, 126, 200, 255);
  }

  private spawnWall(x: number, groundY: number) {
    const w = 140;
    const h = 200;
    const cy = groundY - h / 2;
    const sprite = this.add.image(x, cy, "wall_blank").setDisplaySize(w, h);
    const frame = this.add.graphics();
    frame.lineStyle(3, 0x7ec8ff, 0.85);
    frame.strokeRoundedRect(x - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 6);
    frame.setDepth(0);

    this.tweens.add({
      targets: frame,
      alpha: { from: 0.85, to: 0.3 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    const letters = this.add
      .text(x, cy, "", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "60px",
        color: "#ffd400",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5);
    letters.setShadow(0, 0, "#7ec8ff", 12, true, true);

    const zone = this.add.zone(x, groundY - 40, w + 80, 120);
    this.physics.add.existing(zone, true);

    this.walls.push({
      sprite,
      zone,
      progress: 0,
      done: false,
      letters,
    });
  }

  private spawnDumpster(x: number, y: number) {
    const d = this.add.image(x, y, "dumpster").setDisplaySize(90, 70);
    d.setDepth(5);
    this.hidingSpots.push(d);
  }

  private spawnCop(
    kind: "walker" | "light",
    x: number,
    groundTopY: number,
    patrolMin: number,
    patrolMax: number,
  ) {
    const sprite = this.physics.add.sprite(x, groundTopY - 60, kind === "walker" ? "cop_walker" : "cop_light");
    sprite.setDisplaySize(COP_W, COP_H);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(COP_BODY_W, COP_BODY_H, false);
    body.setOffset((sprite.width - COP_BODY_W) / 2, sprite.height - COP_BODY_H);
    sprite.setCollideWorldBounds(true);

    const alertIcon = this.add
      .text(x, groundTopY - 130, "", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "32px",
        color: "#ffd400",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(50);

    let cone: Phaser.GameObjects.Graphics | undefined;
    if (kind === "light") {
      cone = this.add.graphics();
      cone.setDepth(2);
    }

    // Determine starting direction (walk toward the larger end of patrol range)
    const center = (patrolMin + patrolMax) / 2;
    const startDir: 1 | -1 = x < center ? 1 : -1;

    if (kind === "walker") {
      sprite.setVelocityX(startDir * 60);
      sprite.setFlipX(startDir < 0);
    }

    this.cops.push({
      sprite,
      kind,
      patrolMin,
      patrolMax,
      dir: startDir,
      facing: startDir,
      state: "patrol",
      alertTimer: 0,
      alertIcon,
      cone,
    });
  }

  private spawnEscapeMarker() {
    if (this.escapeMarker) return;
    const x = this.worldWidthPx - 180;
    const y = (LEVEL_HEIGHT - 3) * TILE;

    const arrow = this.add
      .text(0, -60, "▼ ВЫХОД", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "36px",
        color: "#ffd400",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    arrow.setShadow(0, 0, "#ffa630", 12, true, true);

    const portal = this.add.rectangle(0, 0, 80, 160, 0x000000, 0.8).setStrokeStyle(4, 0xffd400);

    this.escapeMarker = this.add.container(x, y, [portal, arrow]);
    this.escapeMarker.setDepth(20);

    const zone = this.add.zone(x, y, 80, 160);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player, zone, () => this.win());

    this.tweens.add({
      targets: arrow,
      y: { from: -60, to: -80 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
  }

  private togglePause() {
    if (this.gameEnded) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      const w = this.scale.width;
      const h = this.scale.height;
      this.add
        .text(w / 2, h / 2, "ПАУЗА\n(нажми ESC чтобы продолжить)", {
          fontFamily: "'Courier New', monospace",
          fontSize: "40px",
          color: "#7ec8ff",
          align: "center",
          backgroundColor: "#0a0d1ad8",
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

  private bust() {
    if (this.gameEnded) return;
    this.gameEnded = true;
    const reg = this.registry.get("game") as GameRegistry;
    this.cameras.main.shake(300, 0.015);
    this.cameras.main.flash(200, 255, 100, 50);
    this.player.setTint(0xff4040);
    this.physics.world.pause();
    this.time.delayedCall(700, () => {
      this.scene.stop("UIScene");
      this.scene.start("GameOverScene", {
        victory: false,
        tags: reg.tags,
        spotted: this.spotted,
      });
    });
  }

  private win() {
    if (this.gameEnded) return;
    const reg = this.registry.get("game") as GameRegistry;
    if (reg.tags < reg.totalTags) return;
    this.gameEnded = true;
    this.cameras.main.flash(400, 126, 200, 255);
    this.physics.world.pause();
    this.time.delayedCall(500, () => {
      this.scene.stop("UIScene");
      this.scene.start("GameOverScene", {
        victory: true,
        tags: reg.tags,
        spotted: this.spotted,
      });
    });
  }

  private isHiding(): boolean {
    if (!this.keyZ.isDown) return false;
    for (const d of this.hidingSpots) {
      const dx = Math.abs(this.player.x - d.x);
      const dy = Math.abs(this.player.y - d.y);
      if (dx < 60 && dy < 80) return true;
    }
    return false;
  }

  private getNearbyWall(): WallData | undefined {
    for (const w of this.walls) {
      if (w.done) continue;
      const zb = w.zone.body as Phaser.Physics.Arcade.StaticBody;
      if (
        this.player.x > zb.x &&
        this.player.x < zb.x + zb.width &&
        this.player.y > zb.y &&
        this.player.y < zb.y + zb.height
      ) {
        return w;
      }
    }
    return undefined;
  }

  private updateTagging(delta: number, reg: GameRegistry) {
    const wall = this.getNearbyWall();
    if (this.keyX.isDown && wall) {
      this.currentWall = wall;
      reg.spraying = true;
      wall.progress = Math.min(1, wall.progress + delta / 2000);
      const letters = "SNAF";
      const n = Math.floor(wall.progress * letters.length + 0.0001);
      wall.letters.setText(letters.slice(0, n));

      reg.heat = Math.min(reg.maxHeat, reg.heat + delta * 0.012);

      if (Math.random() < 0.3) {
        const fx = this.add
          .image(this.player.x + this.facing * 30, this.player.y - 10, "spray_fx")
          .setDisplaySize(28, 28)
          .setAlpha(0.8);
        this.tweens.add({
          targets: fx,
          alpha: 0,
          scale: 1.6,
          duration: 400,
          onComplete: () => fx.destroy(),
        });
      }

      if (wall.progress >= 1 && !wall.done) {
        wall.done = true;
        wall.sprite.setTexture("wall_tagged");
        wall.letters.setText("");
        reg.tags++;
        reg.heat = Math.min(reg.maxHeat, reg.heat + 18);
        this.cameras.main.flash(120, 255, 212, 0);
        if (reg.tags >= reg.totalTags) {
          this.spawnEscapeMarker();
        }
      }
    } else {
      reg.spraying = false;
      this.currentWall = undefined;
    }
  }

  private updateCops(_time: number, delta: number, reg: GameRegistry) {
    const playerHidden = reg.hidden;
    const sneaking = this.keyShift.isDown || this.crouching;
    const baseSightRange = sneaking ? 220 : 320;
    const chaseRange = sneaking ? 320 : 480;

    for (const cop of this.cops) {
      const s = cop.sprite;
      if (!s.active) continue;

      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sameLevel = Math.abs(dy) < 80;

      // Patrol behavior — walker only
      if (cop.kind === "walker" && cop.state === "patrol") {
        if (s.x <= cop.patrolMin) cop.dir = 1;
        else if (s.x >= cop.patrolMax) cop.dir = -1;
        cop.facing = cop.dir;
        s.setVelocityX(cop.dir * 60);
        s.setFlipX(cop.dir < 0);
      }

      const facingPlayer =
        (cop.facing === 1 && dx > 0) || (cop.facing === -1 && dx < 0);

      // Walker vision: a forward cone-ish range, only if not hidden
      const walkerCanSee =
        !playerHidden && sameLevel && facingPlayer && dist < baseSightRange;

      // Light cop cone
      if (cop.kind === "light" && cop.cone) {
        cop.cone.clear();
        const coneLen = 280;
        const coneHalfAngle = 0.35;
        const baseAngle = cop.facing === 1 ? 0 : Math.PI;
        cop.cone.fillStyle(0xffd400, 0.18);
        cop.cone.beginPath();
        cop.cone.moveTo(s.x, s.y - 20);
        cop.cone.lineTo(
          s.x + Math.cos(baseAngle - coneHalfAngle) * coneLen,
          s.y - 20 + Math.sin(baseAngle - coneHalfAngle) * coneLen,
        );
        cop.cone.lineTo(
          s.x + Math.cos(baseAngle + coneHalfAngle) * coneLen,
          s.y - 20 + Math.sin(baseAngle + coneHalfAngle) * coneLen,
        );
        cop.cone.closePath();
        cop.cone.fillPath();
      }

      let coneSpot = false;
      if (cop.kind === "light" && !playerHidden) {
        const coneLen = 280;
        const coneHalfAngle = 0.35;
        const baseAngle = cop.facing === 1 ? 0 : Math.PI;
        const ang = Math.atan2(dy + 20, dx);
        const angDiff = Phaser.Math.Angle.Wrap(ang - baseAngle);
        coneSpot = dist < coneLen && Math.abs(angDiff) < coneHalfAngle && sameLevel;
      }

      const spotted = cop.kind === "walker" ? walkerCanSee : coneSpot;

      if (spotted) {
        this.spotted = true;
        if (cop.state === "patrol") {
          cop.state = "alert";
          cop.alertTimer = 1200;
        }
        reg.heat = Math.min(reg.maxHeat, reg.heat + delta * 0.04);
      }

      if (cop.state === "alert") {
        cop.alertIcon.setText("?").setColor("#ffd400");
        cop.alertIcon.x = s.x;
        cop.alertIcon.y = s.y - 70;

        // In alert, walker moves SLOWLY toward last known direction
        if (cop.kind === "walker") {
          const dir = (dx > 0 ? 1 : -1) as 1 | -1;
          cop.facing = dir;
          s.setVelocityX(dir * 90);
          s.setFlipX(dir < 0);
        }

        if (spotted) {
          cop.alertTimer -= delta;
          if (cop.alertTimer <= 0) cop.state = "chase";
        } else {
          cop.alertTimer -= delta * 0.5;
          if (cop.alertTimer <= -800) {
            cop.state = "patrol";
            cop.alertIcon.setText("");
          }
        }
      } else if (cop.state === "chase") {
        cop.alertIcon.setText("!").setColor("#ff4040");
        cop.alertIcon.x = s.x;
        cop.alertIcon.y = s.y - 70;

        if (cop.kind === "walker") {
          const speed = 200;
          const dir = (dx > 0 ? 1 : -1) as 1 | -1;
          cop.facing = dir;
          s.setVelocityX(dir * speed);
          s.setFlipX(dir < 0);
        } else {
          cop.facing = (dx > 0 ? 1 : -1) as 1 | -1;
          s.setFlipX(cop.facing < 0);
        }

        if ((playerHidden && dist > 200) || dist > chaseRange + 200) {
          cop.state = "patrol";
          cop.alertIcon.setText("");
        }
      } else {
        cop.alertIcon.setText("");
      }
    }
  }

  update(_time: number, delta: number) {
    if (this.isPaused || this.gameEnded) return;

    const camX = this.cameras.main.scrollX;
    this.bgFar.tilePositionX = camX * 0.1;
    this.bgMid.tilePositionX = camX * 0.4;
    this.bgNear.tilePositionX = camX * 0.75;

    const reg = this.registry.get("game") as GameRegistry;

    // Hiding
    const hiding = this.isHiding();
    reg.hidden = hiding;
    this.player.setAlpha(hiding ? 0.45 : 1);

    // Crouch — DOWN arrow
    const wantCrouch = !!this.cursors.down?.isDown && !hiding;
    if (wantCrouch !== this.crouching) {
      this.crouching = wantCrouch;
      this.applyPlayerBody(this.crouching);
    }
    reg.crouching = this.crouching;

    // Movement
    const left = this.cursors.left?.isDown;
    const right = this.cursors.right?.isDown;
    const sneaking = this.keyShift.isDown;
    let speed = 240;
    if (sneaking) speed = 130;
    if (this.crouching) speed = 90;

    if (!hiding) {
      if (left) {
        this.player.setVelocityX(-speed);
        this.facing = -1;
        this.player.setFlipX(true);
      } else if (right) {
        this.player.setVelocityX(speed);
        this.facing = 1;
        this.player.setFlipX(false);
      } else {
        this.player.setVelocityX(this.player.body!.velocity.x * 0.8);
      }
    } else {
      this.player.setVelocityX(0);
    }

    // Jump (disabled while crouching or hiding)
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);
    const onGround = this.player.body!.blocked.down;
    if (onGround) this.jumpsLeft = 2;
    if (jumpPressed && this.jumpsLeft > 0 && !hiding && !this.crouching) {
      this.player.setVelocityY(-520);
      this.jumpsLeft--;
    }

    this.updateTagging(delta, reg);
    this.updateCops(_time, delta, reg);

    if (!reg.spraying && !this.cops.some((c) => c.state !== "patrol")) {
      reg.heat = Math.max(0, reg.heat - delta * 0.008);
    }

    if (this.player.y > this.scale.height + 100) {
      this.bust();
      return;
    }

    this.registry.set("game", reg);
    this.events.emit("hudUpdate");
  }
}
