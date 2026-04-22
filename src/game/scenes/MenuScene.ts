import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const { width, height } = this.scale;

    // Night sky background
    const bg = this.add.image(width / 2, height / 2, "bg_far");
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);

    // City silhouette mid layer
    const mid = this.add.image(width / 2, height - 40, "bg_mid").setOrigin(0.5, 1);
    mid.setScale(Math.min(width / mid.width, 0.7));
    mid.setAlpha(0.85);

    // Title card panel — dark with neon outline
    const panelW = 720;
    const panelH = 240;
    const panelX = width / 2 - panelW / 2;
    const panelY = 70;
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0d1a, 0.9);
    panel.lineStyle(5, 0x00e5ff, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);

    // Big SNAF graffiti title
    const title = this.add
      .text(width / 2, panelY + 90, "SNAF", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "120px",
        color: "#00e5ff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    // Magenta glow shadow
    title.setShadow(0, 0, "#ff2bd6", 18, true, true);

    this.add
      .text(width / 2, panelY + 175, "A NIGHT IN THE CITY", {
        fontFamily: "'Courier New', monospace",
        fontSize: "26px",
        color: "#ffd400",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, panelY + 215, "Tag 5 walls. Don't get busted.", {
        fontFamily: "'Courier New', monospace",
        fontSize: "18px",
        color: "#e6f1ff",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    // Play button
    const playBtn = this.add
      .text(width / 2, height - 240, "▶  HIT THE STREETS", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "44px",
        color: "#0a0d1a",
        backgroundColor: "#ffd400",
        padding: { x: 36, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playBtn.on("pointerover", () => playBtn.setScale(1.08));
    playBtn.on("pointerout", () => playBtn.setScale(1));
    playBtn.on("pointerdown", () => this.startGame());

    // Controls hint
    this.add
      .text(
        width / 2,
        height - 130,
        "← →  walk    SHIFT  sneak    SPACE / ↑  jump (double)\nX  spray (hold near wall)    Z  hide    ESC  pause",
        {
          fontFamily: "'Courier New', monospace",
          fontSize: "18px",
          color: "#e6f1ff",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 50, "Press SPACE or ENTER to start", {
        fontFamily: "'Courier New', monospace",
        fontSize: "20px",
        color: "#ff2bd6",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());

    // Subtle neon flicker on title
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.85 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
  }

  private startGame() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }
}
