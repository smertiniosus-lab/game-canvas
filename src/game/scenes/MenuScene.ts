import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const { width, height } = this.scale;

    const bg = this.add.image(width / 2, height / 2, "bg_far");
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);

    const mid = this.add.image(width / 2, height - 40, "bg_mid").setOrigin(0.5, 1);
    mid.setScale(Math.min(width / mid.width, 0.7));
    mid.setAlpha(0.85);

    const panelW = 760;
    const panelH = 260;
    const panelX = width / 2 - panelW / 2;
    const panelY = 70;
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0d1a, 0.92);
    panel.lineStyle(5, 0x7ec8ff, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);

    const title = this.add
      .text(width / 2, panelY + 90, "SNAF", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "120px",
        color: "#ffd400",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, "#7ec8ff", 18, true, true);

    this.add
      .text(width / 2, panelY + 180, "НОЧЬ В ГОРОДЕ", {
        fontFamily: "'Courier New', monospace",
        fontSize: "28px",
        color: "#ffa630",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, panelY + 222, "Закрась 5 стен. Не попадись ментам.", {
        fontFamily: "'Courier New', monospace",
        fontSize: "18px",
        color: "#e6f1ff",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    // Mini SNAF tag preview in the threatening red style
    const miniTag = this.add
      .text(width / 2, panelY + 268, "SNAF", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "36px",
        color: "#e02828",
        stroke: "#000000",
        strokeThickness: 6,
        fontStyle: "italic bold",
      })
      .setOrigin(0.5)
      .setAngle(-6);
    miniTag.setShadow(0, 0, "#ff2020", 12, true, true);

    const playBtn = this.add
      .text(width / 2, height - 240, "▶  ВЫЙТИ НА УЛИЦУ", {
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

    this.add
      .text(
        width / 2,
        height - 130,
        "← →  идти    SHIFT  красться    SPACE / ↑  прыжок (двойной)\n↓  присесть    X  баллончик (у стены)    Z  спрятаться    ESC  пауза",
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
      .text(width / 2, height - 50, "Нажми SPACE или ENTER чтобы начать", {
        fontFamily: "'Courier New', monospace",
        fontSize: "20px",
        color: "#ffa630",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());

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
