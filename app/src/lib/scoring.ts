// Ported 1:1 from the existing schaetzduell-verbessert.html build.
// The server (score_guess() in supabase/migrations/0005_functions.sql) is
// the source of truth for any score that counts — this copy exists only for
// instant optimistic UI feedback (the slider readout, an offline-queued
// guess's placeholder score) before the server response lands.

export function parseGuess(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s/g, "");
  if (!s) return NaN;

  let sign = 1;
  if (s[0] === "-") {
    sign = -1;
    s = s.slice(1);
  } else if (s[0] === "+") {
    s = s.slice(1);
  }

  if (s.indexOf(",") >= 0) {
    // Comma is the decimal separator; any dots before it are thousands grouping.
    const parts = s.replace(/\./g, "").split(",");
    s = parts.shift() + "." + parts.join("");
  } else if (s.indexOf(".") >= 0) {
    const parts = s.split(".");
    let grouping = parts[0].length > 0 && parts[0].length <= 3;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].length !== 3) grouping = false;
    }
    if (grouping) {
      s = parts.join("");
    } else {
      const head = parts.shift()!;
      s = head + "." + parts.join("");
    }
  }

  if (s === "" || s === "." || !/^[0-9]*\.?[0-9]*$/.test(s)) return NaN;
  const v = parseFloat(s);
  return isFinite(v) ? sign * v : NaN;
}

export function score(guess: number, answer: number): number {
  if (!isFinite(guess) || !isFinite(answer)) return 0;
  let p: number;
  if (answer > 0 && guess > 0) {
    const r = Math.max(guess / answer, answer / guess);
    p = 100 * (1 - Math.log10(r) / 1.3);
  } else {
    p = 100 * (1 - Math.abs(guess - answer) / Math.max(Math.abs(answer), 1));
  }
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function band(points: number): { label: string; tint: string } {
  if (points >= 95) return { label: "Volltreffer", tint: "#F0B429" };
  if (points >= 80) return { label: "Sehr nah", tint: "#F0B429" };
  if (points >= 55) return { label: "Nah dran", tint: "#F3EADA" };
  if (points >= 30) return { label: "Daneben", tint: "rgba(243,234,218,.6)" };
  return { label: "Weit weg", tint: "rgba(243,234,218,.6)" };
}

export function nf(v: number): string {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

// Logarithmic slider: 0..1000 maps to 1..1,000,000 so one drag can reach
// from single digits to millions, per the design's "grob mit der Skala"
// input model.
export function sliderToVal(t: number): number {
  const v = Math.pow(10, (t / 1000) * 6);
  return v < 10 ? Math.round(v * 10) / 10 : v < 1000 ? Math.round(v) : Math.round(v / 10) * 10;
}

export function valToSlider(v: number): number {
  return isFinite(v) && v > 0 ? Math.round((Math.log10(v) / 6) * 1000) : 0;
}

// Position (0-100%) along the reveal screen's number line — log scale so 1
// and 1,000,000 both fit on the same line legibly.
export function scalePosPct(v: number): number {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(v, 1)) / 6));
  return 8 + t * 84;
}
