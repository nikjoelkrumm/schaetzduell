import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { listDuels, listFriends, createDuel, type DuelListItem, type FriendItem } from "../lib/db";
import { Avatar, initialsOf } from "../components/ui";

export default function Duels() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [duels, setDuels] = useState<DuelListItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    listDuels(profile.id)
      .then(setDuels)
      .catch((e) => setError(e instanceof Error ? e.message : "Konnte Duelle nicht laden."))
      .finally(() => setLoading(false));
  }, [profile]);

  const startPicking = async () => {
    if (!profile) return;
    setPicking(true);
    setError(null);
    try {
      setFriends(await listFriends(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte Freunde nicht laden.");
    }
  };

  const challenge = async (friendId: string) => {
    setBusy(true);
    setError(null);
    try {
      const id = await createDuel(friendId, 6);
      navigate(`/duelle/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duell konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "6px 0 6px" }}>Duelle</div>
      <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginBottom: 20 }}>
        {duels.length} {duels.length === 1 ? "Duell" : "Duelle"}
      </div>

      <div
        onClick={startPicking}
        style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 52, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15px/1 Archivo", cursor: "pointer", marginBottom: picking ? 12 : 20 }}
      >
        Neues Duell starten
      </div>

      {picking && (
        <div style={{ marginBottom: 20 }}>
          {friends.length === 0 && (
            <div style={{ font: "400 12px/1.5 Archivo", color: "rgba(243,234,218,.5)" }}>
              Noch keine Freunde — lade zuerst jemanden auf der Freunde-Seite ein.
            </div>
          )}
          {friends.map((f) => (
            <div
              key={f.id}
              onClick={() => !busy && challenge(f.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: "rgba(243,234,218,.06)", marginBottom: 6, cursor: busy ? "default" : "pointer" }}
            >
              <Avatar initials={initialsOf(f.name)} size={32} />
              <div style={{ font: "700 13px/1 Archivo" }}>{f.name}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginBottom: 12 }}>{error}</div>}

      {!loading && duels.length === 0 && (
        <div style={{ font: "400 13px/1.6 Archivo", color: "rgba(243,234,218,.5)" }}>Noch keine Duelle gespielt.</div>
      )}

      {duels.map((d) => (
        <div
          key={d.id}
          onClick={() => navigate(`/duelle/${d.id}`)}
          style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 16, padding: 15, marginBottom: 10, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initialsOf(d.opponent_name)} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 14px/1.2 Archivo" }}>{d.opponent_name}</div>
              <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 4 }}>
                {d.status === "finished" ? "Beendet" : d.my_turn ? "Du bist dran" : "Wartet auf Gegner"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "500 15px/1 'DM Mono',monospace" }}>{d.my_total} : {d.opp_total}</div>
              <div style={{ font: "700 10px/1 Archivo", color: d.my_turn ? "#F0B429" : "rgba(243,234,218,.5)", marginTop: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
                {d.status === "finished" ? (d.my_total > d.opp_total ? "Gewonnen" : d.my_total < d.opp_total ? "Verloren" : "Unentschieden") : d.my_turn ? "Dein Zug" : "Wartet"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 13 }}>
            {Array.from({ length: d.rounds }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < d.rounds_closed ? "#F0B429" : "rgba(243,234,218,.15)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
