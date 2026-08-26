import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getWeek } from "../lib/db";
import type { WeekPayload } from "../lib/types";
import { BackRow } from "../components/ui";

function blockFor(score: number): string {
  if (score >= 95) return "█";
  if (score >= 80) return "▓";
  if (score >= 55) return "▒";
  return "░";
}

export default function Share() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getWeek().then(setWeek).catch(() => setWeek(null));
  }, []);

  if (!profile) return null;

  const answered = week?.questions.filter((q) => q.answered) ?? [];
  const bars = answered.length ? answered.map((q) => blockFor(q.score ?? 0)).join("") : "░░░░░";
  const avg = answered.length ? Math.round(answered.reduce((s, q) => s + (q.score ?? 0), 0) / answered.length) : 0;
  const best = answered.length ? Math.max(...answered.map((q) => q.score ?? 0)) : 0;
  const weekNo = week?.iso_week.split("-W")[1] ?? "—";

  const shareText = `Schätzduell · Woche ${weekNo}\n${profile.name} · Serie ${profile.streak}\n${bars}\nSchnitt ${avg} % · Bester Tipp ${best} %`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard permission denied — the text is still visible to copy by hand
    }
  };

  return (
    <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
      <BackRow onClick={() => navigate(-1)} />
      <div style={{ font: "900 25px/1.05 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "18px 0 8px" }}>
        Spoilerfrei teilen
      </div>
      <div style={{ font: "400 13px/1.55 Archivo", color: "rgba(243,234,218,.58)", marginBottom: 24 }}>
        Keine Zahl, keine Lösung — nur wie nah du dran warst.
      </div>
      <div style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.14)", borderRadius: 18, padding: 22 }}>
        <div style={{ font: "900 15px/1 'Archivo Black',Archivo", marginBottom: 4 }}>Schätzduell · Woche {weekNo}</div>
        <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginBottom: 18 }}>
          {profile.name} · Serie {profile.streak}
        </div>
        <div style={{ font: "400 19px/1.9 'DM Mono',monospace", letterSpacing: ".1em", color: "#F0B429" }}>{bars}</div>
        <div style={{ font: "400 11px/1.6 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 16 }}>
          schaetzduell.de/w{weekNo}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 13, padding: 13 }}>
          <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Schnitt</div>
          <div style={{ font: "900 18px/1 'Archivo Black',Archivo", marginTop: 8 }}>{avg} %</div>
        </div>
        <div style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 13, padding: 13 }}>
          <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Bester Tipp</div>
          <div style={{ font: "900 18px/1 'Archivo Black',Archivo", marginTop: 8 }}>{best} %</div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div
        onClick={copy}
        style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: "pointer", marginTop: 22 }}
      >
        {copied ? "In die Zwischenablage kopiert" : "Ergebnis teilen"}
      </div>
    </div>
  );
}
