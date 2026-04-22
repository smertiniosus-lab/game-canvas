import Phaser from "phaser";

export class GameOverScene extends Phaser.Scene {
  private victory = false;
  private tags = 0;
  private spotted = false;

  constructor() {
    super("GameOverScene");
  }

  init(data: { victory: boolean; tags: number; spotted: boolean }) {
    this.victory = !!data?.victory;
    this.tags = data?.tags ?? 0;
    this.spotted = !!data?.spotted;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(0, 0, w, h, 0x05060d, 0.92).setOrigin(0, 0);

    const titleText = this.victory ? "РАЙОН РАЗМЕЧЕН" : "ПОПАЛСЯ!";
    const titleColor = this.victory ? "#7ec8ff" : "#ff4040";
    const title = this.add
      .text(w / 2, h / 2 - 140, titleText, {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: this.victory ? "92px" : "110px",
        color: titleColor,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 22, true, true);

    const sub = this.victory
      ? "Улицы запомнят твой тег."
      : "Менты тебя приняли. Беги ещё раз, пацан.";
    this.add
      .text(w / 2, h / 2 - 50, sub, {
        fontFamily: "'Courier New', monospace",
        fontSize: "24px",
        color: "#e6f1ff",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    let bonus = 0;
    if (this.victory && !this.spotted) bonus += 1000;
    const score = this.tags * 500 + bonus;

    this.add
      .text(w / 2, h / 2 + 10, `СТЕН ЗАКРАШЕНО  ${this.tags} / 5`, {
        fontFamily: "'Courier New', monospace",
        fontSize: "26px",
        color: "#ffd400",
      })
      .setOrigin(0.5);

    if (this.victory) {
      this.add
        .text(
          w / 2,
          h / 2 + 50,
          this.spotted ? "Бонус за скрытность: —" : "Бонус за скрытность: +1000",
          {
            fontFamily: "'Courier New', monospace",
            fontSize: "22px",
            color: this.spotted ? "#888" : "#7ec8ff",
          },
        )
        .setOrigin(0.5);
    }

    this.add
      .text(w / 2, h / 2 + 95, `СЧЁТ  ${score.toString().padStart(5, "0")}`, {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "34px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(w / 2, h / 2 + 175, "▶  ЕЩЁ РАЗ", {
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        fontSize: "34px",
        color: "#0a0d1a",
        backgroundColor: "#ffd400",
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retry.on("pointerover", () => retry.setScale(1.06));
    retry.on("pointerout", () => retry.setScale(1));
    retry.on("pointerdown", () => this.restart());

    const menu = this.add
      .text(w / 2, h / 2 + 240, "В главное меню", {
        fontFamily: "'Courier New', monospace",
        fontSize: "20px",
        color: "#e6f1ff",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menu.on("pointerdown", () => this.scene.start("MenuScene"));

    this.input.keyboard?.once("keydown-SPACE", () => this.restart());
    this.input.keyboard?.once("keydown-ENTER", () => this.restart());
  }

  private restart() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }
}
