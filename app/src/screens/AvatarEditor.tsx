import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { updateProfileFields } from "../lib/db";
import { BackRow, initialsOf } from "../components/ui";
import { AvatarView } from "../components/AvatarView";
import { BG_SWATCHES, SKIN_SWATCHES, HAIR_SWATCHES, withDefaults, type AvatarConfig } from "../lib/avatar";

const HAIRSTYLES: { key: AvatarConfig["hairStyle"]; label: string }[] = [
  { key: "short", label: "Kurz" },
  { key: "long", label: "Lang" },
  { key: "bald", label: "Keine" },
];

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {colors.map((c) => (
        <div
          key={c}
          onClick={() => onPick(c)}
          style={{
            width: 34, height: 34, borderRadius: "50%", background: c, cursor: "pointer",
            border: c === value ? "3px solid #F0B429" : "1px solid rgba(243,234,218,.2)",
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}

export default function AvatarEditor() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [config, setConfig] = useState<AvatarConfig>(withDefaults(profile?.avatar));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const set = (patch: Partial<AvatarConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfileFields(profile.id, { avatar: config });
      await refreshProfile();
      navigate("/profil");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <BackRow onClick={() => navigate("/profil")} />
      <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "18px 0 20px" }}>
        Avatar
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <AvatarView config={config} initials={initialsOf(profile.name)} size={110} />
      </div>

      <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
        Frisur
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {HAIRSTYLES.map((h) => (
          <div
            key={h.key}
            onClick={() => set({ hairStyle: h.key })}
            style={{
              flex: 1, textAlign: "center", padding: 11, borderRadius: 11, cursor: "pointer",
              background: config.hairStyle === h.key ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)",
              color: config.hairStyle === h.key ? "#F0B429" : "#F3EADA",
              font: "700 12.5px/1 Archivo",
            }}
          >
            {h.label}
          </div>
        ))}
      </div>

      <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
        Haarfarbe
      </div>
      <div style={{ marginBottom: 22 }}>
        <Swatches colors={HAIR_SWATCHES} value={config.hair ?? HAIR_SWATCHES[0]} onPick={(hair) => set({ hair })} />
      </div>

      <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
        Hautfarbe
      </div>
      <div style={{ marginBottom: 22 }}>
        <Swatches colors={SKIN_SWATCHES} value={config.skin ?? SKIN_SWATCHES[0]} onPick={(skin) => set({ skin })} />
      </div>

      <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
        Hintergrund
      </div>
      <div style={{ marginBottom: 28 }}>
        <Swatches colors={BG_SWATCHES} value={config.bg ?? BG_SWATCHES[0]} onPick={(bg) => set({ bg })} />
      </div>

      {error && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginBottom: 12 }}>{error}</div>}
      <div
        onClick={save}
        style={{
          background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 54, display: "flex",
          alignItems: "center", justifyContent: "center", font: "800 15px/1 Archivo",
          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Speichert…" : "Speichern"}
      </div>
    </div>
  );
}
