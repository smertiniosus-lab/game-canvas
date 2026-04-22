import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const { width, height } = this.scale;

    // Background
    const bg = this.add.image(width / 2, height / 2, "bg_far");
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);

    // Cartoon trees mid layer
    const mid = this.add.image(width / 2, height - 200, "bg_mid").setOrigin(0.5, 1);
    mid.setScale(Math.min(width / mid.width, 0.6));

    // Title card panel
    const panel = this.add.graphics();
    panel.fillStyle(0xfff3d4, 1);
    panel.lineStyle(6, 0x3a2a1a, 1);
    panel.fillRoundedRect(width / 2 - 320, 80, 640, 220, 24);
    panel.strokeRoundedRect(width / 2 - 320, 80, 640, 220, 24);

    this.add
      .text(width / 2, 130, "FOREST FRENZY", {
        fontFamily: "Georgia, serif",
        fontSize: "56px",
        color: "#c44b3a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 200, "A Run & Gun Adventure", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#3a2a1a",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 250, "Round 1", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#2a8b8b",
      })
      .setOrigin(0.5);

    // Play button
    const playBtn = this.add
      .text(width / 2, height - 220, "▶  PLAY", {
        fontFamily: "Georgia, serif",
        fontSize: "44px",
        color: "#fff3d4",
        backgroundColor: "#c44b3a",
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
        height - 110,
        "← →  move    SPACE / ↑  jump (double)    X  shoot    Z  dash    ESC  pause",
        {
          fontFamily: "Georgia, serif",
          fontSize: "18px",
          color: "#3a2a1a",
          align: "center",
        },
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 70, "Press SPACE or ENTER to start", {
        fontFamily: "Georgia, serif",
        fontSize: "20px",
        color: "#3a2a1a",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());
  }

  private startGame() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }
}
