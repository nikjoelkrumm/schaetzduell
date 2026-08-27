import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getProfileBadges, exportMyData, deleteMyAccount } from "../lib/db";
import { initialsOf } from "../components/ui";
import { AvatarView } from "../components/AvatarView";
import { FlameIcon, CrownIcon, TargetIcon, MedalIcon, DuelIcon, MoonIcon, DiamondIcon, CompassIcon } from "../components/icons";

const BADGE_DEFS = [
  { key: "serie7", title: "Serie 7", Icon: FlameIcon, tint: "#F0B429" },
  { key: "volltreffer", title: "Volltreffer", Icon: TargetIcon, tint: "#5FBF8B" },
  { key: "gold", title: "Gold", Icon: MedalIcon, tint: "#F0B429" },
  { key: "duellsieg", title: "Duellsieg", Icon: DuelIcon, tint: "#E2553C" },
  { key: "nachteule", title: "Nachteule", Icon: MoonIcon, tint: "#4EA8DE" },
  { key: "serie20", title: "Serie 20", Icon: CrownIcon, tint: "#F0B429" },
  { key: "diamant", title: "Diamant", Icon: DiamondIcon, tint: "#C77DFF" },
  { key: "alle_kat", title: "Alle Kat.", Icon: CompassIcon, tint: "#F27B9D" },
];

export default function Profile() {
  const navigate = useNavigate();
  const { profile, session, signOut, updateProfile } = useAuth();
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    getProfileBadges(profile.id).then((keys) => setEarned(new Set(keys)));
  }, [profile]);

  if (!profile || !session) return null;

  const xpFloor = (profile.level - 1) * 300;
  const xpNext = profile.level * 300;
  const xpPct = Math.max(0, Math.min(100, Math.round(((profile.xp - xpFloor) / (xpNext - xpFloor)) * 100)));

  const stats = [
    { k: "XP gesamt", v: profile.xp },
    { k: "Level", v: profile.level },
    { k: "Wochen Serie", v: profile.streak },
    { k: "Abzeichen", v: `${earned.size} / ${BADGE_DEFS.length}` },
  ];

  const exportData = async () => {
    const data = await exportMyData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schaetzduell-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!confirm("Konto wirklich unwiderruflich löschen?")) return;
    setBusy(true);
    try {
      await deleteMyAccount();
      await signOut();
      navigate("/");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 24px" }}>
        <div onClick={() => navigate("/profil/avatar")} style={{ position: "relative", cursor: "pointer" }}>
          <AvatarView config={profile.avatar} initials={initialsOf(profile.name)} size={64} />
          <div
            style={{
              position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: "50%",
              background: "#F0B429", border: "2px solid #0D2B2F", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8L17.3 5.5a2 2 0 0 0-2.8 0L4 16v4Z" stroke="#0D2B2F" strokeWidth={2.2} strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div>
          <div style={{ font: "900 22px/1 'Archivo Black',Archivo", letterSpacing: "-.02em" }}>{profile.name}</div>
          <div style={{ font: "400 11px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 7 }}>
            {profile.is_guest ? "Gast" : session.user.email}
          </div>
        </div>
      </div>

      <div style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 16, padding: 17, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ font: "800 14px/1 Archivo" }}>Level {profile.level}</div>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>{profile.xp} / {xpNext} XP</div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(243,234,218,.14)", marginTop: 12, overflow: "hidden" }}>
          <div className="sd-bar-fill" style={{ height: 8, borderRadius: 4, background: "#F0B429", width: `${xpPct}%` }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {stats.map((s) => (
          <div key={s.k} style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 14, padding: 14 }}>
            <div style={{ font: "900 21px/1 'Archivo Black',Archivo" }}>{s.v}</div>
            <div style={{ font: "400 10px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 7 }}>{s.k}</div>
          </div>
        ))}
      </div>

      <div style={{ font: "800 14px/1 Archivo", marginBottom: 12 }}>Abzeichen</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {BADGE_DEFS.map((b) => {
          const on = earned.has(b.key);
          const { Icon } = b;
          return (
            <div
              key={b.key}
              style={{
                aspectRatio: "1", borderRadius: 14,
                background: on ? `radial-gradient(circle at 30% 25%, ${b.tint}33, ${b.tint}0d 70%)` : "rgba(243,234,218,.04)",
                border: `1px solid ${on ? `${b.tint}66` : "rgba(243,234,218,.1)"}`,
                boxShadow: on ? `0 4px 14px ${b.tint}26` : "none",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 6,
              }}
            >
              <Icon color={on ? b.tint : "rgba(243,234,218,.25)"} size={22} />
              <div style={{ font: "600 8.5px/1.2 Archivo", color: on ? b.tint : "rgba(243,234,218,.3)", textAlign: "center" }}>{b.title}</div>
            </div>
          );
        })}
      </div>

      <div
        onClick={() => navigate("/plus")}
        style={{ background: "linear-gradient(140deg,#F0B429,#D89A12)", color: "#0D2B2F", borderRadius: 16, padding: 17, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: 12 }}
      >
        <div>
          <div style={{ font: "900 15px/1 'Archivo Black',Archivo" }}>Schätzduell Plus</div>
          <div style={{ font: "600 11.5px/1.4 Archivo", opacity: 0.7, marginTop: 6 }}>Unbegrenzte Duelle, Archiv, Statistiken</div>
        </div>
        <div style={{ font: "900 17px/1 'Archivo Black',Archivo" }}>→</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 2px", borderBottom: "1px solid rgba(243,234,218,.1)" }}>
        <div style={{ font: "600 13.5px/1 Archivo" }}>Benachrichtigungen</div>
        <div onClick={() => updateProfile({ push_opt_in: !profile.push_opt_in })} style={{ font: "400 11.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)", cursor: "pointer" }}>
          {profile.push_opt_in ? "An" : "Aus"}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 2px", borderBottom: "1px solid rgba(243,234,218,.1)" }}>
        <div style={{ font: "600 13.5px/1 Archivo" }}>Sprache</div>
        <div style={{ font: "400 11.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>Deutsch</div>
      </div>
      <div onClick={exportData} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 2px", borderBottom: "1px solid rgba(243,234,218,.1)", cursor: "pointer" }}>
        <div style={{ font: "600 13.5px/1 Archivo" }}>Daten exportieren</div>
        <div style={{ font: "400 11.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>JSON</div>
      </div>
      <div onClick={remove} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 2px", borderBottom: "1px solid rgba(243,234,218,.1)", cursor: busy ? "default" : "pointer" }}>
        <div style={{ font: "600 13.5px/1 Archivo", color: "#E2553C" }}>Konto löschen</div>
      </div>
      {msg && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginTop: 10 }}>{msg}</div>}

      <div onClick={() => signOut()} style={{ marginTop: 18, textAlign: "center", font: "600 12.5px/1 Archivo", color: "rgba(243,234,218,.5)", cursor: "pointer" }}>
        Abmelden
      </div>
    </div>
  );
}
