import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "@/game/createGame";

const PhaserGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    gameRef.current = createGame(containerRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-lg"
      aria-label="Game canvas"
    />
  );
};

export default PhaserGame;
