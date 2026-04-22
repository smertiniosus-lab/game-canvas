import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const { width, height } = this.scale;

    // Loading bar
    const barW = 360;
    const barH = 24;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    this.add
      .text(width / 2, barY - 50, "LOADING...", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#3a2a1a",
      })
      .setOrigin(0.5);

    const border = this.add.rectangle(barX, barY, barW, barH, 0x000000, 0).setOrigin(0, 0);
    border.setStrokeStyle(3, 0x3a2a1a);
    const fill = this.add.rectangle(barX + 3, barY + 3, 1, barH - 6, 0xc44b3a).setOrigin(0, 0);

    this.load.on("progress", (p: number) => {
      fill.width = (barW - 6) * p;
    });

    // Assets
    this.load.image("hero", "/game/hero.png");
    this.load.image("walker", "/game/enemy_walker.png");
    this.load.image("flyer", "/game/enemy_flyer.png");
    this.load.image("boss", "/game/boss.png");
    this.load.image("tile", "/game/tile_ground.png");
    this.load.image("bg_far", "/game/bg_far.jpg");
    this.load.image("bg_mid", "/game/bg_mid.png");
    this.load.image("bg_near", "/game/bg_near.png");
    this.load.image("coin", "/game/coin.png");
    this.load.image("bullet", "/game/bullet.png");
  }

  create() {
    this.scene.start("MenuScene");
  }
}
