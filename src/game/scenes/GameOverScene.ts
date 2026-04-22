import Phaser from "phaser";

export class GameOverScene extends Phaser.Scene {
  private victory = false;
  private score = 0;

  constructor() {
    super("GameOverScene");
  }

  init(data: { victory: boolean; score: number }) {
    this.victory = !!data?.victory;
    this.score = data?.score ?? 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(0, 0, w, h, 0x3a2a1a, 0.85).setOrigin(0, 0);

    this.add
      .text(w / 2, h / 2 - 120, this.victory ? "A KNOCKOUT!" : "GAME OVER", {
        fontFamily: "Georgia, serif",
        fontSize: "84px",
        color: this.victory ? "#f3d36b" : "#c44b3a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h / 2 - 30, this.victory ? "You beat Old Man Oak!" : "Better luck next time...", {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#fff3d4",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h / 2 + 30, `FINAL SCORE  ${this.score.toString().padStart(5, "0")}`, {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#fff3d4",
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(w / 2, h / 2 + 130, "▶  PLAY AGAIN", {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#fff3d4",
        backgroundColor: "#c44b3a",
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retry.on("pointerover", () => retry.setScale(1.06));
    retry.on("pointerout", () => retry.setScale(1));
    retry.on("pointerdown", () => this.restart());

    const menu = this.add
      .text(w / 2, h / 2 + 200, "Main Menu", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#fff3d4",
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
