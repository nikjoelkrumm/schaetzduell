import { useEffect, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { getMyLeague, listFriends, redeemInvite, type LeagueInfo, type FriendItem } from "../lib/db";
import { Avatar, initialsOf } from "../components/ui";

const TIER_LABEL: Record<string, string> = {
  bronze: "Bronze-Liga",
  silver: "Silber-Liga",
  gold: "Gold-Liga",
  diamond: "Diamant-Liga",
  platin: "Platin-Liga",
};

export default function Friends() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"league" | "friends">("league");
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [inviting, setInviting] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([getMyLeague(profile.id), listFriends(profile.id)])
      .then(([l, f]) => {
        setLeague(l);
        setFriends(f.sort((a, b) => b.xp - a.xp));
      })
      .finally(() => setLoading(false));
  }, [profile]);

  const redeem = async () => {
    setMsg(null);
    try {
      const res = await redeemInvite(code);
      setMsg(`${res.friend_name} ist jetzt dein Freund.`);
      setCode("");
      if (profile) setFriends(await listFriends(profile.id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Code ungültig.");
    }
  };

  if (!profile || loading) {
    return <div style={{ padding: 20, font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>lädt…</div>;
  }

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "6px 0 18px" }}>Freunde</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <div
          onClick={() => setTab("league")}
          style={{ flex: 1, textAlign: "center", padding: 11, borderRadius: 11, background: tab === "league" ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)", font: "700 12.5px/1 Archivo", cursor: "pointer" }}
        >
          Liga
        </div>
        <div
          onClick={() => setTab("friends")}
          style={{ flex: 1, textAlign: "center", padding: 11, borderRadius: 11, background: tab === "friends" ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)", font: "700 12.5px/1 Archivo", cursor: "pointer" }}
        >
          Freunde
        </div>
      </div>

      {tab === "league" && league && (
        <>
          <div style={{ background: "linear-gradient(150deg,#1B4C52,#12393E)", border: "1px solid rgba(240,180,41,.22)", borderRadius: 18, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ font: "900 17px/1 'Archivo Black',Archivo", color: "#F0B429" }}>{TIER_LABEL[league.tier]}</div>
                <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.55)", marginTop: 6 }}>
                  Endet {new Date(league.endsAt).toLocaleDateString("de-DE")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ font: "900 22px/1 'Archivo Black',Archivo" }}>#{league.myRank}</div>
                <div style={{ font: "400 10px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
                  von {league.groupSize}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", font: "400 9.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 15 }}>
              <span>Aufstieg Top 5</span>
              <span>Abstieg ab {Math.max(1, league.groupSize - 4)}</span>
            </div>
          </div>
          {league.standings.map((s, i) => (
            <div
              key={s.profile_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 13, background: s.profile_id === profile.id ? "rgba(240,180,41,.12)" : "rgba(243,234,218,.05)", marginBottom: 7 }}
            >
              <div style={{ font: "500 12px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)", width: 20 }}>{i + 1}</div>
              <Avatar initials={initialsOf(s.name)} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13px/1.2 Archivo" }}>{s.profile_id === profile.id ? `${s.name} — du` : s.name}</div>
                <div style={{ font: "400 10px/1.3 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 4 }}>
                  {s.streak} Wochen Serie
                </div>
              </div>
              <div style={{ font: "900 16px/1 'Archivo Black',Archivo", color: s.profile_id === profile.id ? "#F0B429" : "#F3EADA" }}>{s.points}</div>
            </div>
          ))}
        </>
      )}

      {tab === "friends" && (
        <>
          {friends.length === 0 && (
            <div style={{ font: "400 13px/1.6 Archivo", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
              Noch keine Freunde — lade jemanden mit deinem Code ein.
            </div>
          )}
          {friends.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 13, background: "rgba(243,234,218,.05)", marginBottom: 7 }}>
              <Avatar initials={initialsOf(f.name)} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 13px/1.2 Archivo" }}>{f.name}</div>
                <div style={{ font: "400 10px/1.3 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 4 }}>{f.streak} Wochen Serie</div>
              </div>
              <div style={{ font: "900 16px/1 'Archivo Black',Archivo" }}>{f.xp} XP</div>
            </div>
          ))}
        </>
      )}

      <div
        onClick={() => setInviting((v) => !v)}
        style={{ marginTop: 14, border: "1px dashed rgba(243,234,218,.22)", borderRadius: 14, padding: 15, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div>
          <div style={{ font: "800 13px/1 Archivo" }}>Freund einladen</div>
          <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
            Dein Code: SD-{profile.invite_code}
          </div>
        </div>
        <div style={{ font: "600 15px/1 Archivo", color: "#F0B429" }}>↗</div>
      </div>

      {inviting && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SD-XXXXX"
            style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.16)", borderRadius: 12, padding: 12, font: "400 13px/1 'DM Mono',monospace", color: "#F3EADA" }}
          />
          <div onClick={redeem} style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 12, padding: "0 18px", display: "flex", alignItems: "center", font: "800 13px/1 Archivo", cursor: "pointer" }}>
            Einlösen
          </div>
        </div>
      )}
      {msg && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
