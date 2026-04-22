import { useEffect } from "react";
import PhaserGame from "@/components/PhaserGame";

const Index = () => {
  useEffect(() => {
    document.title = "Forest Frenzy — Cuphead-style Run & Gun";
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const m = document.createElement("meta");
        m.setAttribute("name", "description");
        document.head.appendChild(m);
        return m;
      })();
    meta.setAttribute(
      "content",
      "Forest Frenzy — a 1930s cartoon-style run & gun platformer demo built with Phaser 3.",
    );
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[hsl(var(--frame-bg))] p-2 sm:p-4">
      <h1 className="sr-only">Forest Frenzy — Cuphead-style Run & Gun Demo</h1>

      <div className="relative mx-auto flex aspect-video w-full max-w-[1400px] items-center justify-center">
        {/* Cartoon film frame */}
        <div className="relative h-full w-full rounded-2xl border-[10px] border-[hsl(var(--frame-border))] bg-[hsl(var(--frame-inner))] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
          {/* Inner playfield */}
          <div className="relative h-full w-full overflow-hidden rounded-lg">
            <PhaserGame />

            {/* Vignette */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                boxShadow: "inset 0 0 180px 30px rgba(0,0,0,0.55)",
              }}
            />
            {/* Film grain */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.12] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
              }}
            />
          </div>
        </div>
      </div>

      <p className="mx-auto mt-3 max-w-[1400px] text-center font-serif text-sm text-[hsl(var(--frame-border))] sm:text-base">
        Click the game once to capture keyboard focus. ← → move · SPACE/↑ jump (double) · X
        shoot · Z dash · ESC pause
      </p>
    </main>
  );
};

export default Index;
