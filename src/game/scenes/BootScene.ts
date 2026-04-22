import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const { width, height } = this.scale;

    const barW = 360;
    const barH = 24;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    this.add
      .text(width / 2, barY - 50, "LOADING...", {
        fontFamily: "'Courier New', monospace",
        fontSize: "28px",
        color: "#00e5ff",
      })
      .setOrigin(0.5);

    const border = this.add.rectangle(barX, barY, barW, barH, 0x000000, 0).setOrigin(0, 0);
    border.setStrokeStyle(3, 0x00e5ff);
    const fill = this.add.rectangle(barX + 3, barY + 3, 1, barH - 6, 0xff2bd6).setOrigin(0, 0);

    this.load.on("progress", (p: number) => {
      fill.width = (barW - 6) * p;
    });

    // SNAF assets
    this.load.image("hero", "/game/hero.png");
    this.load.image("cop_walker", "/game/cop_walker.png");
    this.load.image("cop_light", "/game/cop_light.png");
    this.load.image("wall_blank", "/game/wall_blank.png");
    this.load.image("wall_tagged", "/game/wall_tagged.png");
    this.load.image("wall_brick", "/game/wall_brick.png");
    this.load.image("wall_concrete", "/game/wall_concrete.png");
    this.load.image("wall_kiosk", "/game/wall_kiosk.png");
    this.load.image("wall_fence", "/game/wall_fence.png");
    this.load.image("tile", "/game/tile_ground.png");
    this.load.image("bg_far", "/game/bg_far.jpg");
    this.load.image("bg_mid", "/game/bg_mid.png");
    this.load.image("bg_near", "/game/bg_near.png");
    this.load.image("dumpster", "/game/dumpster.png");
    this.load.image("spray_fx", "/game/spray_fx.png");
  }

  create() {
    this.scene.start("MenuScene");
  }
}
