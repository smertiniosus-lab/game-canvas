import Phaser from "phaser";

interface GameRegistry {
  tags: number;
  totalTags: number;
  heat: number;
  maxHeat: number;
  hidden: boolean;
  spraying: boolean;
  crouching: boolean;
}

export class UIScene extends Phaser.Scene {
  private tagsText!: Phaser.GameObjects.Text;
  private heatBarBg!: Phaser.GameObjects.Rectangle;
  private heatBarFill!: Phaser.GameObjects.Rectangle;
  private heatLabel!: Phaser.GameObjects.Text;
  private hiddenIcon!: Phaser.GameObjects.Text;
  private sprayIcon!: Phaser.GameObjects.Text;
  private crouchIcon!: Phaser.GameObjects.Text;

  constructor() {
    super("UIScene");
  }

  create() {
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0d1a, 0.85);
    panel.lineStyle(3, 0x7ec8ff, 1);
    panel.fillRoundedRect(20, 20, 220, 60, 12);
    panel.strokeRoundedRect(20, 20, 220, 60, 12);

    this.add.text(38, 30, "ТЭГИ", {
      fontFamily: "'Courier New', monospace",
      fontSize: "18px",
      color: "#7ec8ff",
      fontStyle: "bold",
    });

    this.tagsText = this.add.text(38, 48, "0 / 5", {
      fontFamily: "'Impact', 'Arial Black', sans-serif",
      fontSize: "26px",
      color: "#ffd400",
      fontStyle: "bold",
    });

    const w = this.scale.width;
    const heatPanelW = 280;
    const heatX = w - heatPanelW - 20;
    const heatPanel = this.add.graphics();
    heatPanel.fillStyle(0x0a0d1a, 0.85);
    heatPanel.lineStyle(3, 0xffa630, 1);
    heatPanel.fillRoundedRect(heatX, 20, heatPanelW, 60, 12);
    heatPanel.strokeRoundedRect(heatX, 20, heatPanelW, 60, 12);

    this.heatLabel = this.add.text(heatX + 16, 28, "ШУХЕР", {
      fontFamily: "'Courier New', monospace",
      fontSize: "18px",
      color: "#ffa630",
      fontStyle: "bold",
    });

    const barW = heatPanelW - 32;
    this.heatBarBg = this.add
      .rectangle(heatX + 16, 54, barW, 16, 0x222633)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffa630);
    this.heatBarFill = this.add
      .rectangle(heatX + 16, 54, 1, 16, 0xffa630)
      .setOrigin(0, 0);

    this.hiddenIcon = this.add
      .text(40, this.scale.height - 50, "● В БАКЕ", {
        fontFamily: "'Courier New', monospace",
        fontSize: "20px",
        color: "#7ec8ff",
        backgroundColor: "#0a0d1ad8",
        padding: { x: 12, y: 5 },
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.sprayIcon = this.add
      .text(w / 2, this.scale.height - 50, "✦ КРАСИТ ✦", {
        fontFamily: "'Courier New', monospace",
        fontSize: "22px",
        color: "#ffd400",
        backgroundColor: "#0a0d1ad8",
        padding: { x: 14, y: 6 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.crouchIcon = this.add
      .text(w - 40, this.scale.height - 50, "▼ ПРИСЕЛ", {
        fontFamily: "'Courier New', monospace",
        fontSize: "20px",
        color: "#ffa630",
        backgroundColor: "#0a0d1ad8",
        padding: { x: 12, y: 5 },
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5)
      .setVisible(false);

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

    this.tagsText.setText(`${reg.tags} / ${reg.totalTags}`);

    const pct = Phaser.Math.Clamp(reg.heat / reg.maxHeat, 0, 1);
    const fullW = this.heatBarBg.width as number;
    this.heatBarFill.width = Math.max(1, fullW * pct);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffa630),
      Phaser.Display.Color.ValueToColor(0xff3030),
      100,
      Math.floor(pct * 100),
    );
    this.heatBarFill.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);

    this.hiddenIcon.setVisible(reg.hidden);
    this.sprayIcon.setVisible(reg.spraying);
    this.crouchIcon.setVisible(reg.crouching);
  }
}
