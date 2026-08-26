import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackRow } from "../components/ui";
import { CATEGORY_COUNTS } from "../data/questions";

export default function Practice() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number[]>([0, 1, 2, 3, 4]);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <BackRow onClick={() => navigate("/home")} />
      <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "18px 0 8px" }}>
        Übungsmodus
      </div>
      <div style={{ font: "400 13px/1.55 Archivo", color: "rgba(243,234,218,.58)", marginBottom: 24 }}>
        Kategorien wählen, so lange schätzen wie du willst. Zählt nicht für Liga oder Serie.
      </div>
      {CATEGORY_COUNTS.map((c) => {
        const on = selected.includes(c.id);
        return (
          <div
            key={c.id}
            onClick={() => toggle(c.id)}
            style={{
              background: on ? `${c.color}1a` : "#12393E",
              border: `1px solid ${on ? `${c.color}73` : "rgba(243,234,218,.12)"}`,
              borderRadius: 16,
              padding: 16,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: on ? c.color : "rgba(243,234,218,.25)", flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 14px/1 Archivo" }}>{c.name}</div>
              <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 6 }}>
                {c.description}
              </div>
            </div>
            <div style={{ font: "500 12px/1 'DM Mono',monospace", color: on ? c.color : "rgba(243,234,218,.45)" }}>{c.count} Fragen</div>
          </div>
        );
      })}
      <div
        onClick={() => selected.length && navigate("/uebung/spielen", { state: { catIds: selected } })}
        style={{
          background: selected.length ? "#F0B429" : "rgba(240,180,41,.35)",
          color: "#0D2B2F",
          borderRadius: 14,
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "800 15px/1 Archivo",
          cursor: selected.length ? "pointer" : "default",
          marginTop: 16,
        }}
      >
        {selected.length ? `Übung starten · ${selected.length} Kategorien` : "Mindestens eine Kategorie"}
      </div>
    </div>
  );
}
