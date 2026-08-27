import { useMemo } from "react";

const COLORS = ["#F0B429", "#5FBF8B", "#4EA8DE", "#C77DFF", "#F27B9D", "#E2553C"];

interface Piece {
  left: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  size: number;
}

// Lightweight CSS-only confetti burst — no external library. Mount it once
// on a win/celebration screen; it plays through and just sits there
// (pointer-events none, absolutely positioned) rather than looping forever.
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.4,
        duration: 2.2 + Math.random() * 1.4,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 120,
        size: 6 + Math.random() * 6,
      })),
    [count],
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 50 }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 1,
            opacity: 0,
            // @ts-expect-error -- custom properties read by the keyframes below
            "--drift": `${p.drift}px`,
            "--rotate": `${p.rotate}deg`,
            animation: `sd-confetti ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
