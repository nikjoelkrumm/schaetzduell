import { useState } from "react";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  { k: "Unbegrenzte Duelle", d: "Gratis: drei gleichzeitig. Mit Plus: so viele du willst." },
  { k: "Wochen-Archiv", d: "Alle vergangenen Challenges nachspielen, ohne Wertung." },
  { k: "Tiefe Statistiken", d: "Trefferquote pro Kategorie, Über- und Unterschätzung im Verlauf." },
  { k: "Eigene Duell-Regeln", d: "Rundenzahl, Kategorien und Zeitfenster selbst setzen." },
  { k: "Kein Banner", d: "Die Gratisversion zeigt eine Anzeige nach der Auflösung." },
];

export default function Paywall() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<"month" | "year">("year");
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
      <div onClick={() => navigate(-1)} style={{ font: "600 15px/1 Archivo", color: "rgba(243,234,218,.55)", padding: "8px 0", cursor: "pointer" }}>
        ✕
      </div>
      <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".18em", textTransform: "uppercase", color: "#F0B429", margin: "22px 0 12px" }}>
        Schätzduell Plus
      </div>
      <div style={{ font: "900 33px/1.02 'Archivo Black',Archivo", letterSpacing: "-.03em", marginBottom: 26 }}>
        Schätzen ohne
        <br />
        Limit.
      </div>
      {FEATURES.map((f) => (
        <div key={f.k} style={{ display: "flex", gap: 13, padding: "13px 0", borderBottom: "1px solid rgba(243,234,218,.1)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0B429", marginTop: 6, flex: "none" }} />
          <div>
            <div style={{ font: "700 13.5px/1.3 Archivo" }}>{f.k}</div>
            <div style={{ font: "400 11.5px/1.5 Archivo", color: "rgba(243,234,218,.55)", marginTop: 4 }}>{f.d}</div>
          </div>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 10, margin: "24px 0 12px" }}>
        <div
          onClick={() => setPlan("month")}
          style={{ flex: 1, border: `1px solid ${plan === "month" ? "#F0B429" : "rgba(243,234,218,.2)"}`, background: plan === "month" ? "rgba(240,180,41,.14)" : "transparent", borderRadius: 15, padding: 15, cursor: "pointer" }}
        >
          <div style={{ font: "700 12px/1 Archivo", color: "rgba(243,234,218,.7)" }}>Monat</div>
          <div style={{ font: "900 20px/1 'Archivo Black',Archivo", marginTop: 9 }}>2,99 €</div>
        </div>
        <div
          onClick={() => setPlan("year")}
          style={{ flex: 1, border: `1px solid ${plan === "year" ? "#F0B429" : "rgba(243,234,218,.2)"}`, background: plan === "year" ? "rgba(240,180,41,.14)" : "transparent", borderRadius: 15, padding: 15, position: "relative", cursor: "pointer" }}
        >
          <div style={{ font: "700 12px/1 Archivo", color: "rgba(243,234,218,.7)" }}>Jahr</div>
          <div style={{ font: "900 20px/1 'Archivo Black',Archivo", marginTop: 9 }}>19,99 €</div>
          <div style={{ position: "absolute", top: -9, right: 12, background: "#F0B429", color: "#0D2B2F", font: "800 9px/1 Archivo", padding: "4px 7px", borderRadius: 5 }}>
            −44 %
          </div>
        </div>
      </div>
      <div
        onClick={() =>
          setNote(
            "In-App-Käufe kommen mit dem nativen Build über App Store / Play Billing (siehe claude-code-start.md, Phase 5) — hier bewusst noch nicht vorgezogen.",
          )
        }
        style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: "pointer" }}
      >
        {plan === "year" ? "19,99 € pro Jahr" : "2,99 € pro Monat"}
      </div>
      {note && <div style={{ font: "400 10.5px/1.5 'DM Mono',monospace", color: "rgba(243,234,218,.5)", textAlign: "center", marginTop: 12 }}>{note}</div>}
    </div>
  );
}
