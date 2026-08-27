import { useEffect, useState } from "react";
import { useCountUp } from "../lib/useCountUp";

const SIZE = 168;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// The big score reveal — a filling ring (0-100), a count-up number in the
// middle, a soft glow in the band color, and a one-off sparkle burst for a
// Volltreffer (95+). Replaces what used to be a static "+82" text line.
export function ScoreRing({ score, tint, band }: { score: number; tint: string; band: string }) {
  const [filled, setFilled] = useState(false);
  const shown = useCountUp(score, 750);

  useEffect(() => {
    setFilled(false);
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    return () => cancelAnimationFrame(t);
  }, [score]);

  const offset = CIRC * (1 - (filled ? score : 0) / 100);
  const isVolltreffer = score >= 95;

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto" }}>
      {isVolltreffer && (
        <div
          key={score}
          style={{
            position: "absolute", inset: -18, borderRadius: "50%", border: `2px solid ${tint}`,
            opacity: 0, animation: "sd-sonar 0.9s ease-out 0.15s both",
          }}
        />
      )}
      <div
        style={{
          position: "absolute", inset: 14, borderRadius: "50%",
          background: tint, opacity: filled ? 0.22 : 0, filter: "blur(22px)",
          transition: "opacity 0.6s ease",
        }}
      />
      <svg width={SIZE} height={SIZE} style={{ position: "relative", transform: "rotate(-90deg)" }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(243,234,218,.12)" strokeWidth={STROKE} fill="none" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={tint}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ font: "900 46px/1 'Archivo Black',Archivo", letterSpacing: "-.03em", color: tint }}>+{shown}</div>
        <div style={{ font: "900 11px/1 'Archivo Black',Archivo", letterSpacing: ".1em", textTransform: "uppercase", color: tint, marginTop: 6, opacity: 0.85 }}>
          {band}
        </div>
      </div>
    </div>
  );
}
