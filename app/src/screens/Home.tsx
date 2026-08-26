import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getWeek, listDuels, getMyLeague, type DuelListItem, type LeagueInfo } from "../lib/db";
import type { WeekPayload } from "../lib/types";
import { formatCountdown } from "../lib/format";
import { Card, StatTile, ProgressDots, initialsOf } from "../components/ui";
import { AvatarView } from "../components/AvatarView";

const TIER_LABEL: Record<string, string> = {
  bronze: "BRONZE",
  silver: "SILBER",
  gold: "GOLD",
  diamond: "DIAMANT",
  platin: "PLATIN",
};

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [week, setWeek] = useState<WeekPayload | null>(null);
  const [duels, setDuels] = useState<DuelListItem[]>([]);
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getWeek().catch((e) => {
        throw e;
      }),
      listDuels(profile.id).catch(() => []),
      getMyLeague(profile.id).catch(() => null),
    ])
      .then(([w, d, l]) => {
        if (cancelled) return;
        setWeek(w);
        setDuels(d);
        setLeague(l);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Konnte die Woche nicht laden."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!profile || loading) {
    return (
      <div style={{ padding: 20, font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>lädt…</div>
    );
  }

  if (error || !week) {
    return (
      <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
        <div style={{ font: "900 21px/1 'Archivo Black',Archivo", marginBottom: 12 }}>Keine aktive Woche</div>
        <div style={{ font: "400 13px/1.6 Archivo", color: "rgba(243,234,218,.6)" }}>
          {error ?? "Ein Operator muss rotate_week() einmal ausführen (siehe SUPABASE_SETUP.md)."}
        </div>
      </div>
    );
  }

  const answered = week.questions.filter((q) => q.answered);
  const avg = answered.length ? Math.round(answered.reduce((s, q) => s + (q.score ?? 0), 0) / answered.length) : null;
  const nextQuestion = week.questions.find((q) => !q.answered);
  const complete = !nextQuestion;

  return (
    <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ font: "900 21px/1 'Archivo Black',Archivo", letterSpacing: "-.02em" }}>
            Woche {week.iso_week.split("-W")[1]}
          </div>
          <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
            Synchronisiert
          </div>
        </div>
        <div onClick={() => navigate("/profil")} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "700 12px/1 Archivo" }}>{profile.name}</div>
            <div style={{ font: "400 10px/1.3 'DM Mono',monospace", color: "#F0B429", marginTop: 4 }}>
              {league ? `${TIER_LABEL[league.tier]} · #${league.myRank}` : "—"}
            </div>
          </div>
          <AvatarView config={profile.avatar} initials={initialsOf(profile.name)} />
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(160deg,#1B4C52,#12393E)",
          border: "1px solid rgba(243,234,218,.14)",
          borderRadius: 20,
          padding: 22,
          marginBottom: 14,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -30, top: -30, width: 150, height: 150, borderRadius: "50%", border: "1px solid rgba(240,180,41,.18)" }} />
        <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "#F0B429", marginBottom: 12 }}>
          Wochenchallenge
        </div>
        <div style={{ font: "900 25px/1.12 'Archivo Black',Archivo", letterSpacing: "-.02em", maxWidth: 250, position: "relative" }}>
          Fünf Fragen. Für alle dieselben.
        </div>
        <ProgressDots total={week.questions.length} filled={answered.length} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>Läuft ab in</div>
            <div style={{ font: "500 17px/1.2 'DM Mono',monospace", color: "#F3EADA", marginTop: 3 }}>
              {formatCountdown(week.closes_at)}
            </div>
          </div>
          <div
            onClick={() => !complete && navigate("/schaetzen")}
            style={{
              background: complete ? "rgba(243,234,218,.12)" : "#F0B429",
              color: complete ? "#F3EADA" : "#0D2B2F",
              borderRadius: 12,
              padding: "14px 20px",
              font: "800 14px/1 Archivo",
              cursor: complete ? "default" : "pointer",
            }}
          >
            {complete ? "Woche geschafft ✓" : `Weiter, Frage ${(nextQuestion?.position ?? 1)}`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <StatTile value={profile.streak} label="Wochen Serie" />
        <StatTile value={avg !== null ? <>{avg}<span style={{ fontSize: 14 }}> %</span></> : "—"} label="Trefferquote" />
        <StatTile value={league ? `#${league.myRank}` : "—"} label="in der Liga" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ font: "800 14px/1 Archivo" }}>Deine Duelle</div>
        <div onClick={() => navigate("/duelle")} style={{ font: "600 12px/1 Archivo", color: "#F0B429", cursor: "pointer" }}>
          Alle {duels.length}
        </div>
      </div>
      {duels.length === 0 && (
        <div style={{ font: "400 12px/1.5 Archivo", color: "rgba(243,234,218,.45)", marginBottom: 9 }}>
          Noch keine Duelle — lade einen Freund auf der Freunde-Seite ein.
        </div>
      )}
      {duels.slice(0, 2).map((d) => (
        <div
          key={d.id}
          onClick={() => navigate(`/duelle/${d.id}`)}
          style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 15, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 9, cursor: "pointer" }}
        >
          <AvatarView config={d.opponent_avatar} initials={initialsOf(d.opponent_name)} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 13.5px/1.2 Archivo" }}>{d.opponent_name}</div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 4 }}>
              {d.status === "finished" ? "Beendet" : d.my_turn ? "Du bist dran" : "Wartet auf Gegner"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "500 13px/1 'DM Mono',monospace" }}>{d.my_total} : {d.opp_total}</div>
            <div style={{ font: "700 10px/1 Archivo", color: d.my_turn ? "#F0B429" : "rgba(243,234,218,.5)", marginTop: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {d.status === "finished" ? (d.my_total > d.opp_total ? "Gewonnen" : d.my_total < d.opp_total ? "Verloren" : "Unentschieden") : d.my_turn ? "Dein Zug" : "Wartet"}
            </div>
          </div>
        </div>
      ))}

      <Card
        style={{ marginTop: 14, border: "1px dashed rgba(243,234,218,.22)", background: "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div onClick={() => navigate("/uebung")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <div style={{ font: "800 13.5px/1 Archivo" }}>Übungsmodus</div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
              Zählt nicht für die Liga
            </div>
          </div>
          <div style={{ font: "600 20px/1 Archivo", color: "#F0B429" }}>+</div>
        </div>
      </Card>
    </div>
  );
}
