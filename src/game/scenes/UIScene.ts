import Phaser from "phaser";

interface GameRegistry {
  hp: number;
  maxHp: number;
  score: number;
  bossHp: number;
  bossMaxHp: number;
  bossActive: boolean;
}

export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private bossBarBg?: Phaser.GameObjects.Rectangle;
  private bossBarFill?: Phaser.GameObjects.Rectangle;
  private bossLabel?: Phaser.GameObjects.Text;

  constructor() {
    super("UIScene");
  }

  create() {
    const w = this.scale.width;

    // Top panel
    const panel = this.add.graphics();
    panel.fillStyle(0x3a2a1a, 0.85);
    panel.fillRoundedRect(20, 20, 320, 56, 14);
    panel.lineStyle(3, 0xfff3d4, 1);
    panel.strokeRoundedRect(20, 20, 320, 56, 14);

    for (let i = 0; i < 3; i++) {
      const h = this.add.text(40 + i * 38, 30, "♥", {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#e74c3c",
      });
      this.hearts.push(h);
    }

    this.scoreText = this.add.text(170, 36, "SCORE  0", {
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      color: "#fff3d4",
      fontStyle: "bold",
    });

    // Listen for updates
    const gameScene = this.scene.get("GameScene");
    gameScene.events.on("hudUpdate", () => this.refresh());
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameScene.events.off("hudUpdate");
    });

    this.refresh();
  }

  private refresh() {
    const reg = this.registry.get("game") as GameRegistry | undefined;
    if (!reg) return;

    this.hearts.forEach((h, i) => {
      h.setText(i < reg.hp ? "♥" : "♡");
      h.setColor(i < reg.hp ? "#e74c3c" : "#7a5a3a");
    });

    this.scoreText.setText(`SCORE  ${reg.score.toString().padStart(5, "0")}`);

    if (reg.bossActive) {
      const w = this.scale.width;
      const barW = 600;
      if (!this.bossBarBg) {
        this.bossBarBg = this.add
          .rectangle(w / 2, 50, barW + 8, 28, 0x3a2a1a)
          .setStrokeStyle(3, 0xfff3d4);
        this.bossBarFill = this.add
          .rectangle(w / 2 - barW / 2, 50, barW, 22, 0xc44b3a)
          .setOrigin(0, 0.5);
        this.bossLabel = this.add
          .text(w / 2, 22, "OLD MAN OAK", {
            fontFamily: "Georgia, serif",
            fontSize: "18px",
            color: "#fff3d4",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
      }
      const pct = reg.bossHp / reg.bossMaxHp;
      this.bossBarFill!.width = barW * pct;
    }
  }
}
