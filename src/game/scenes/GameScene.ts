import Phaser from "phaser";

const TILE = 64;
const LEVEL_WIDTH = 90; // tiles
const LEVEL_HEIGHT = 14;

// Depth layers
const DEPTH_BG = 0;
const DEPTH_GROUND = 1;
const DEPTH_WALL = 2;
const DEPTH_DUMPSTER_BACK = 8;
const DEPTH_COP = 12;
const DEPTH_LIGHT_CONE = 13;
const DEPTH_PLAYER = 15;
const DEPTH_DUMPSTER_FRONT = 16;
const DEPTH_HUD = 50;

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
  kind: WallKind;
  width: number;
  height: number;
  x: number;
  cy: number;
  marker?: Phaser.GameObjects.Container;
}

type WallKind = "garage" | "brick" | "concrete" | "kiosk" | "fence";

interface Dumpster {
  x: number;
  y: number;
  back: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  prompt: Phaser.GameObjects.Text;
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
  walkTween?: Phaser.Tweens.Tween;
}

// Player display sizes
const PLAYER_W = 64;
const PLAYER_H = 100;
const PLAYER_BODY_W = 28;
const PLAYER_BODY_H = 84;
const PLAYER_BODY_H_CROUCH = 48;

const COP_W = 64;
const COP_H = 100;
const COP_BODY_W = 28;
const COP_BODY_H = 84;

// IMPORTANT: hero.png is drawn facing RIGHT but appears mirrored in source — adjust this if needed.
// false = sprite faces right naturally (no flip when moving right).
const HERO_FLIP_RIGHT = true; // setFlipX(true) when facing right
const COP_WALKER_FLIP_RIGHT = true;
const COP_LIGHT_FLIP_RIGHT = false;

function buildLevel(): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < LEVEL_HEIGHT; y++) {
    grid.push(Array.from({ length: LEVEL_WIDTH }, () => 0));
  }
  // Solid ground
  for (let x = 0; x < LEVEL_WIDTH; x++) {
    grid[LEVEL_HEIGHT - 1][x] = 1;
    grid[LEVEL_HEIGHT - 2][x] = 1;
  }
  // Long, connected ledges (balconies / canopies) — placed in GAPS BETWEEN wall groups
  // Wall groups (px): G1≈400-640, G2≈1300-1780, G3≈2500-2740, G4≈3500-3980, G5≈4700
  // Tiles 64px wide; place ledges between groups so pillars don't overlap walls.
  // Tile X-ranges to AVOID (in tile units): G1: 5-11, G2: 19-29, G3: 38-44, G4: 53-63, G5: 72-76
  const ledges: Array<[number, number, number]> = [
    [13, 8, 4],   // gap between G1 and G2
    [32, 8, 4],   // gap between G2 and G3
    [47, 7, 4],   // gap between G3 and G4
    [66, 8, 4],   // gap between G4 and G5
    [80, 7, 4],   // after G5
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
  private dumpsters: Dumpster[] = [];
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

  // Hide / dumpster
  private hidingInDumpster = false;
  private nearDumpster?: Dumpster;
  private dumpsterCooldown = 0;

  // Animation state
  private playerWalkTween?: Phaser.Tweens.Tween;
  private wasOnGround = true;
  private sprayShakeTween?: Phaser.Tweens.Tween;

  private titleCardObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("GameScene");
  }

  create() {
    this.gameEnded = false;
    this.spotted = false;
    this.walls = [];
    this.dumpsters = [];
    this.cops = [];
    this.currentWall = undefined;
    this.crouching = false;
    this.hidingInDumpster = false;
    this.escapeMarker = undefined;
    this.titleCardObjects = [];

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

    // ============ Parallax — fixed scaling ============
    this.bgFar = this.add
      .tileSprite(0, 0, viewW, viewH, "bg_far")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_BG);
    const farTex = this.textures.get("bg_far").getSourceImage() as HTMLImageElement;
    const farScale = viewH / farTex.height;
    this.bgFar.setTileScale(farScale, farScale);

    this.bgMid = this.add
      .tileSprite(0, viewH - 380, viewW, 380, "bg_mid")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_BG);
    const midTex = this.textures.get("bg_mid").getSourceImage() as HTMLImageElement;
    const midScale = 380 / midTex.height;
    this.bgMid.setTileScale(midScale, midScale);
    this.bgMid.setAlpha(0.92);

    this.bgNear = this.add
      .tileSprite(0, viewH - 220, viewW, 220, "bg_near")
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_BG);
    const nearTex = this.textures.get("bg_near").getSourceImage() as HTMLImageElement;
    const nearScale = 220 / nearTex.height;
    this.bgNear.setTileScale(nearScale, nearScale);

    // Night tint
    this.add
      .rectangle(0, 0, viewW, viewH, 0x0a0d1a, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH_BG);

    this.physics.world.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBounds(0, 0, this.worldWidthPx, viewH);
    cam.setBackgroundColor("#0a0d1a");

    // ============ Tiles (physics, invisible) ============
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

    // ============ Walls (garage doors), grouped as cooperatives ============
    // Groups of 2-3 doors with small gaps, then a longer gap before next group.
    const wallGroups = [
      [400, 580], // 2 doors
      [1300, 1480, 1660], // 3 doors
      [2500, 2680], // 2 doors
      [3500, 3680, 3860], // 3 doors
      [4700], // 1 door
    ];
    let pickedCount = 0;
    const targetTags = 5;
    // Spawn ALL doors visually but only mark some as "taggable" — actually mark first 5 across groups
    for (const group of wallGroups) {
      for (const wx of group) {
        const taggable = pickedCount < targetTags;
        this.spawnWall(wx, (LEVEL_HEIGHT - 2) * TILE, taggable);
        if (taggable) pickedCount++;
      }
    }

    // ============ Dumpsters ============
    const dumpsterPositions = [800, 1900, 2900, 3300, 4100, 5000];
    for (const dx of dumpsterPositions) {
      this.spawnDumpster(dx, (LEVEL_HEIGHT - 2) * TILE);
    }

    // ============ Player ============
    const groundTopY = (LEVEL_HEIGHT - 2) * TILE;
    this.player = this.physics.add.sprite(120, groundTopY - 60, "hero");
    this.player.setDisplaySize(PLAYER_W, PLAYER_H);
    this.player.setDepth(DEPTH_PLAYER);
    this.player.setOrigin(0.5, 0.5);
    this.applyPlayerBody(false);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(360, 900);
    this.physics.add.collider(this.player, this.platforms);
    // Default facing: right
    this.player.setFlipX(HERO_FLIP_RIGHT);

    cam.startFollow(this.player, true, 0.12, 0.12, 0, 60);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on("down", () => this.togglePause());
    this.keyZ.on("down", () => this.toggleHide());

    // ============ Cops ============
    this.spawnCop("walker", 800, groundTopY, 600, 1100);
    this.spawnCop("light", 1700, groundTopY, 1700, 1700);
    this.spawnCop("walker", 2700, groundTopY, 2400, 3000);
    this.spawnCop("light", 3500, groundTopY, 3500, 3500);
    this.spawnCop("walker", 4300, groundTopY, 4000, 4700);
    this.spawnCop("walker", 5200, groundTopY, 5000, 5500);

    this.cops.forEach((c) => {
      this.physics.add.collider(c.sprite, this.platforms);
      this.physics.add.overlap(this.player, c.sprite, () => {
        if (!this.hidingInDumpster) this.bust();
      });
    });

    this.showTitleCard();
  }

  // ============ Player body / scale ============
  private applyPlayerBody(crouching: boolean) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const bw = PLAYER_BODY_W;
    const bh = crouching ? PLAYER_BODY_H_CROUCH : PLAYER_BODY_H;
    body.setSize(bw, bh, false);
    const tw = this.player.width;
    const th = this.player.height;
    body.setOffset((tw - bw) / 2, th - bh);
    const visualH = crouching ? PLAYER_H * 0.7 : PLAYER_H;
    this.player.setScale(PLAYER_W / tw, visualH / th);
  }

  // ============ Ground visuals — single tiled strip ============
  private drawGroundVisuals(_grid: number[][]) {
    const groundTopY = (LEVEL_HEIGHT - 2) * TILE;
    const groundH = 2 * TILE;
    // Continuous ground strip (asphalt)
    const ground = this.add
      .tileSprite(0, groundTopY, this.worldWidthPx, groundH, "tile")
      .setOrigin(0, 0)
      .setDepth(DEPTH_GROUND);
    ground.setTileScale(64 / 1024, 64 / 1024); // scale source down to 64px tiles
    ground.setTint(0x6e7282);

    // Curb line
    this.add
      .rectangle(0, groundTopY, this.worldWidthPx, 4, 0x2a2d36)
      .setOrigin(0, 0)
      .setDepth(DEPTH_GROUND + 1);

    // Decorative puddles
    for (let i = 0; i < 12; i++) {
      const x = 200 + i * 480 + Phaser.Math.Between(-40, 40);
      const puddle = this.add.ellipse(x, groundTopY + 12, 90, 16, 0x1a2030, 0.6);
      puddle.setDepth(DEPTH_GROUND + 1);
    }

    // Ledges — render as connected balconies with vertical supports to the ground
    const grid = _grid;
    const ledgeRuns: Array<{ x: number; y: number; len: number }> = [];
    for (let y = 0; y < grid.length; y++) {
      let runStart = -1;
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === 2) {
          if (runStart === -1) runStart = x;
        } else if (runStart !== -1) {
          ledgeRuns.push({ x: runStart, y, len: x - runStart });
          runStart = -1;
        }
      }
      if (runStart !== -1)
        ledgeRuns.push({ x: runStart, y, len: grid[y].length - runStart });
    }
    for (const run of ledgeRuns) {
      const px = run.x * TILE;
      const py = run.y * TILE;
      const w = run.len * TILE;
      // Support pillar to ground
      const pillarH = groundTopY - (py + TILE);
      if (pillarH > 0) {
        this.add
          .rectangle(px + w / 2, py + TILE + pillarH / 2, w * 0.85, pillarH, 0x2b2f3a, 0.85)
          .setDepth(DEPTH_GROUND);
        // Window strip on pillar (warm light)
        for (let i = 0; i < Math.floor(pillarH / 50); i++) {
          this.add
            .rectangle(px + w / 2, py + TILE + 30 + i * 50, w * 0.4, 14, 0xffd070, 0.55)
            .setDepth(DEPTH_GROUND);
        }
      }
      // Balcony deck
      this.add
        .rectangle(px + w / 2, py + TILE / 2, w, TILE, 0x4a4e58)
        .setStrokeStyle(2, 0x1a1d24)
        .setDepth(DEPTH_GROUND + 2);
      // Railing
      this.add
        .rectangle(px + w / 2, py + 4, w, 6, 0x9aa1ad)
        .setDepth(DEPTH_GROUND + 3);
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

    this.titleCardObjects = [card, go];

    // click to dismiss
    const dismiss = () => {
      this.titleCardObjects.forEach((o) => o.destroy());
      this.titleCardObjects = [];
    };
    this.input.once("pointerdown", dismiss);

    this.tweens.add({
      targets: go,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 350,
      delay: 400,
      yoyo: true,
      onComplete: () => {
        if (this.titleCardObjects.length) dismiss();
      },
    });
    this.cameras.main.flash(300, 126, 200, 255);
  }

  // ============ Garage door (wall) ============
  private spawnWall(x: number, groundY: number, taggable: boolean) {
    const w = 160;
    const h = 180;
    const cy = groundY - h / 2;
    const sprite = this.add
      .image(x, cy, "wall_blank")
      .setDisplaySize(w, h)
      .setDepth(DEPTH_WALL);

    if (!taggable) {
      // Pre-tagged or just decorative: skip zone, no indicator
      sprite.setTint(0xb8b8c0);
      return;
    }

    const frame = this.add.graphics();
    frame.lineStyle(3, 0x7ec8ff, 0.85);
    frame.strokeRoundedRect(x - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 6);
    frame.setDepth(DEPTH_WALL + 1);

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
      .setOrigin(0.5)
      .setDepth(DEPTH_WALL + 2);
    letters.setShadow(0, 0, "#7ec8ff", 12, true, true);

    const zone = this.add.zone(x, groundY - 40, w + 60, 120);
    this.physics.add.existing(zone, true);

    this.walls.push({
      sprite,
      zone,
      progress: 0,
      done: false,
      letters,
    });
  }

  // ============ Dumpster (back + front layered for hide-inside effect) ============
  private spawnDumpster(x: number, groundY: number) {
    const W = 130;
    const H = 100;
    const cy = groundY - H / 2;

    // Back layer (drawn behind player): top rim + lid
    const back = this.add
      .image(x, cy, "dumpster")
      .setDisplaySize(W, H)
      .setDepth(DEPTH_DUMPSTER_BACK);
    // Use crop to show only top portion (lid + rear rim)
    const tex = this.textures.get("dumpster").getSourceImage() as HTMLImageElement;
    back.setCrop(0, 0, tex.width, tex.height * 0.45);

    // Front layer (drawn over player) — full sprite
    const front = this.add
      .image(x, cy, "dumpster")
      .setDisplaySize(W, H)
      .setDepth(DEPTH_DUMPSTER_FRONT);
    front.setCrop(0, tex.height * 0.35, tex.width, tex.height * 0.65);
    // Adjust front position so the cropped region renders in correct screen Y
    front.y = cy + (H * 0.35) / 2;

    // Reset back's screen Y to upper half center
    back.y = cy - (H * 0.275);

    // Hide prompt
    const prompt = this.add
      .text(x, groundY - H - 24, "Z — СПРЯТАТЬСЯ", {
        fontFamily: "'Courier New', monospace",
        fontSize: "16px",
        color: "#ffd400",
        backgroundColor: "#0a0d1ad0",
        padding: { x: 8, y: 4 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_HUD)
      .setVisible(false);

    this.dumpsters.push({ x, y: cy, back, front, prompt });
  }

  // ============ Cop ============
  private spawnCop(
    kind: "walker" | "light",
    x: number,
    groundTopY: number,
    patrolMin: number,
    patrolMax: number,
  ) {
    const sprite = this.physics.add.sprite(
      x,
      groundTopY - COP_H / 2 - 4,
      kind === "walker" ? "cop_walker" : "cop_light",
    );
    sprite.setDisplaySize(COP_W, COP_H);
    sprite.setDepth(DEPTH_COP);
    sprite.setOrigin(0.5, 0.5);
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
      .setDepth(DEPTH_HUD);

    let cone: Phaser.GameObjects.Graphics | undefined;
    if (kind === "light") {
      cone = this.add.graphics();
      cone.setDepth(DEPTH_LIGHT_CONE);
    }

    const center = (patrolMin + patrolMax) / 2;
    const startDir: 1 | -1 = x < center ? 1 : -1;

    if (kind === "walker") {
      sprite.setVelocityX(startDir * 60);
    }

    // Cops face same way as hero relative to flip
    sprite.setFlipX(this.copFlipFor(startDir));

    // Idle/walk bobbing tween (always running, subtle)
    const walkTween = this.tweens.add({
      targets: sprite,
      scaleY: { from: sprite.scaleY, to: sprite.scaleY * 0.97 },
      duration: 240,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      paused: kind !== "walker",
    });

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
      walkTween,
    });
  }

  private heroFlipFor(dir: 1 | -1): boolean {
    // dir = 1 means facing right
    return dir === 1 ? HERO_FLIP_RIGHT : !HERO_FLIP_RIGHT;
  }

  private copFlipFor(dir: 1 | -1): boolean {
    // Cops use same convention as hero
    return dir === 1 ? HERO_FLIP_RIGHT : !HERO_FLIP_RIGHT;
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

    const portal = this.add
      .rectangle(0, 0, 80, 160, 0x000000, 0.8)
      .setStrokeStyle(4, 0xffd400);

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

  private findNearestDumpster(): Dumpster | undefined {
    let best: Dumpster | undefined;
    let bestDist = 70;
    for (const d of this.dumpsters) {
      const dx = Math.abs(this.player.x - d.x);
      const dy = Math.abs(this.player.y - d.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dx < 70 && dy < 90 && dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }

  private toggleHide() {
    if (this.gameEnded || this.dumpsterCooldown > 0) return;
    if (this.hidingInDumpster) {
      this.exitDumpster();
    } else if (this.nearDumpster) {
      this.enterDumpster(this.nearDumpster);
    }
  }

  private enterDumpster(d: Dumpster) {
    this.hidingInDumpster = true;
    this.dumpsterCooldown = 200;
    // snap player into dumpster
    this.player.setVelocity(0, 0);
    this.player.x = d.x;
    this.player.y = d.y - 8;
    this.player.setAlpha(0.55);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    d.prompt.setText("Z — ВЫЛЕЗТИ");
  }

  private exitDumpster() {
    this.hidingInDumpster = false;
    this.dumpsterCooldown = 200;
    this.player.setAlpha(1);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    if (this.nearDumpster) this.nearDumpster.prompt.setText("Z — СПРЯТАТЬСЯ");
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
    const spraying = this.keyX.isDown && wall && !this.hidingInDumpster;
    if (spraying) {
      this.currentWall = wall;
      reg.spraying = true;
      wall.progress = Math.min(1, wall.progress + delta / 2000);
      const letters = "SNAF";
      const n = Math.floor(wall.progress * letters.length + 0.0001);
      wall.letters.setText(letters.slice(0, n));

      reg.heat = Math.min(reg.maxHeat, reg.heat + delta * 0.012);

      // Spray hand jitter
      if (!this.sprayShakeTween || !this.sprayShakeTween.isPlaying()) {
        this.sprayShakeTween = this.tweens.add({
          targets: this.player,
          angle: { from: -2, to: 2 },
          duration: 90,
          yoyo: true,
          repeat: -1,
        });
      }

      if (Math.random() < 0.5) {
        const fx = this.add
          .image(
            this.player.x + this.facing * 30 + Phaser.Math.Between(-6, 6),
            this.player.y - 10 + Phaser.Math.Between(-6, 6),
            "spray_fx",
          )
          .setDisplaySize(28, 28)
          .setAlpha(0.85)
          .setDepth(DEPTH_PLAYER + 1);
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
      if (this.sprayShakeTween) {
        this.sprayShakeTween.stop();
        this.sprayShakeTween = undefined;
        this.player.setAngle(0);
      }
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

      // Patrol — walker only
      if (cop.kind === "walker" && cop.state === "patrol") {
        if (s.x <= cop.patrolMin) cop.dir = 1;
        else if (s.x >= cop.patrolMax) cop.dir = -1;
        cop.facing = cop.dir;
        s.setVelocityX(cop.dir * 60);
        s.setFlipX(this.copFlipFor(cop.dir));
        // ensure walk tween playing
        if (cop.walkTween && !cop.walkTween.isPlaying()) cop.walkTween.resume();
      }

      const facingPlayer =
        (cop.facing === 1 && dx > 0) || (cop.facing === -1 && dx < 0);

      const walkerCanSee =
        !playerHidden && sameLevel && facingPlayer && dist < baseSightRange;

      if (cop.kind === "light" && cop.cone) {
        cop.cone.clear();
        const coneLen = 280;
        const coneHalfAngle = 0.35;
        // Cone slowly sways
        const sway = Math.sin(_time / 600) * 0.08;
        const baseAngle = (cop.facing === 1 ? 0 : Math.PI) + sway;
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
        coneSpot =
          dist < coneLen && Math.abs(angDiff) < coneHalfAngle && sameLevel;
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

        if (cop.kind === "walker") {
          const dir = (dx > 0 ? 1 : -1) as 1 | -1;
          cop.facing = dir;
          s.setVelocityX(dir * 90);
          s.setFlipX(this.copFlipFor(dir));
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
          s.setFlipX(this.copFlipFor(dir));
        } else {
          cop.facing = (dx > 0 ? 1 : -1) as 1 | -1;
          s.setFlipX(this.copFlipFor(cop.facing));
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

  // ============ Player walk tween mgmt ============
  private startWalkTween() {
    if (this.playerWalkTween && this.playerWalkTween.isPlaying()) return;
    const baseY = this.player.scaleY;
    this.playerWalkTween = this.tweens.add({
      targets: this.player,
      scaleY: { from: baseY, to: baseY * 0.96 },
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
  }

  private stopWalkTween() {
    if (this.playerWalkTween) {
      this.playerWalkTween.stop();
      this.playerWalkTween = undefined;
    }
  }

  private squashLand() {
    const sx = this.player.scaleX;
    const sy = this.player.scaleY;
    this.tweens.add({
      targets: this.player,
      scaleY: { from: sy * 0.85, to: sy },
      scaleX: { from: sx * 1.08, to: sx },
      duration: 120,
      ease: "back.out",
    });
  }

  update(_time: number, delta: number) {
    if (this.isPaused || this.gameEnded) return;

    this.dumpsterCooldown = Math.max(0, this.dumpsterCooldown - delta);

    const camX = this.cameras.main.scrollX;
    this.bgFar.tilePositionX = camX * 0.1;
    this.bgMid.tilePositionX = camX * 0.4;
    this.bgNear.tilePositionX = camX * 0.75;

    const reg = this.registry.get("game") as GameRegistry;

    // Find nearest dumpster — show prompt
    const nd = this.findNearestDumpster();
    if (this.nearDumpster && this.nearDumpster !== nd) {
      this.nearDumpster.prompt.setVisible(false);
    }
    this.nearDumpster = nd;
    if (nd) {
      nd.prompt.setVisible(true);
      nd.prompt.setText(this.hidingInDumpster ? "Z — ВЫЛЕЗТИ" : "Z — СПРЯТАТЬСЯ");
    }

    reg.hidden = this.hidingInDumpster;

    if (this.hidingInDumpster) {
      // Locked in dumpster — auto-exit on movement
      const moved =
        this.cursors.left?.isDown ||
        this.cursors.right?.isDown ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.keySpace);
      if (moved) this.exitDumpster();
      else this.player.setVelocity(0, 0);
      reg.crouching = false;
      reg.spraying = false;
      this.registry.set("game", reg);
      this.events.emit("hudUpdate");
      return;
    }

    // Crouch — DOWN arrow
    const wantCrouch = !!this.cursors.down?.isDown;
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

    let moving = false;
    if (left) {
      this.player.setVelocityX(-speed);
      this.facing = -1;
      this.player.setFlipX(this.heroFlipFor(-1));
      moving = true;
    } else if (right) {
      this.player.setVelocityX(speed);
      this.facing = 1;
      this.player.setFlipX(this.heroFlipFor(1));
      moving = true;
    } else {
      this.player.setVelocityX(this.player.body!.velocity.x * 0.8);
    }

    // Jump
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);
    const onGround = this.player.body!.blocked.down;
    if (onGround) this.jumpsLeft = 2;
    if (jumpPressed && this.jumpsLeft > 0 && !this.crouching) {
      this.player.setVelocityY(-520);
      this.jumpsLeft--;
      // Stretch on takeoff
      const sx = this.player.scaleX;
      const sy = this.player.scaleY;
      this.tweens.add({
        targets: this.player,
        scaleY: { from: sy, to: sy * 1.08 },
        scaleX: { from: sx, to: sx * 0.92 },
        duration: 120,
        yoyo: true,
        ease: "sine.out",
      });
    }
    // Landing squash
    if (onGround && !this.wasOnGround) {
      this.squashLand();
    }
    this.wasOnGround = onGround;

    // Walk tween only when grounded + moving + not crouching
    if (moving && onGround && !this.crouching) this.startWalkTween();
    else this.stopWalkTween();

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
