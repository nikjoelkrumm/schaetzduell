import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDuel, createDuel } from "../lib/db";
import type { DuelDetail as DuelDetailT } from "../lib/types";
import { nf } from "../lib/scoring";
import { supabase } from "../lib/supabase";

export default function DuelDetail() {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const [duel, setDuel] = useState<DuelDetailT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!duelId) return;
    try {
      setDuel(await getDuel(duelId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duell nicht gefunden.");
    }
  }, [duelId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live-update while this screen is open — a round the opponent just closed
  // (or reopened by playing) refreshes without a manual reload.
  useEffect(() => {
    const sb = supabase;
    if (!sb || !duelId) return;
    const channel = sb
      .channel(`duel:${duelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_rounds", filter: `duel_id=eq.${duelId}` }, () => void load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [duelId, load]);

  if (error) {
    return (
      <div className="screen-in" style={{ padding: "8px 20px 18px" }}>
        <div onClick={() => navigate("/duelle")} style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", cursor: "pointer" }}>
          ← Duelle
        </div>
        <div style={{ marginTop: 20, font: "700 15px/1.4 Archivo", color: "#F0B429" }}>{error}</div>
      </div>
    );
  }

  if (!duel) {
    return <div style={{ padding: 20, font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>lädt…</div>;
  }

  const myTotal = duel.round_list.reduce((s, r) => s + (r.my_score ?? 0), 0);
  const oppTotal = duel.round_list.reduce((s, r) => s + (r.opp_score ?? 0), 0);
  const nextOpenRound = duel.round_list.find((r) => !r.closed && r.my_guess == null);

  const rematch = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createDuel(duel.opponent, duel.rounds, duel.id);
      navigate(`/duelle/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revanche konnte nicht gestartet werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
      <div onClick={() => navigate("/duelle")} style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", padding: "8px 0", cursor: "pointer" }}>
        ← Duelle
      </div>
      <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".16em", textTransform: "uppercase", color: "#F0B429", margin: "20px 0 10px" }}>
        {duel.status === "finished" ? "Duell beendet" : `${duel.round_list.filter((r) => r.closed).length} von ${duel.rounds} Runden aufgelöst`}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 26 }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: "700 13px/1 Archivo", color: "rgba(243,234,218,.6)" }}>Du</div>
          <div style={{ font: "900 46px/1 'Archivo Black',Archivo", color: "#F0B429", marginTop: 6 }}>{myTotal}</div>
        </div>
        <div style={{ font: "900 16px/1 'Archivo Black',Archivo", color: "rgba(243,234,218,.3)", paddingBottom: 12 }}>:</div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ font: "700 13px/1 Archivo", color: "rgba(243,234,218,.6)" }}>{duel.opponent_name}</div>
          <div style={{ font: "900 46px/1 'Archivo Black',Archivo", marginTop: 6 }}>{oppTotal}</div>
        </div>
      </div>

      {duel.round_list.map((r) => (
        <div
          key={r.round_id}
          onClick={() => !r.closed && r.my_guess == null && navigate(`/duelle/${duel.id}/runde/${r.round_id}`)}
          style={{ borderBottom: "1px solid rgba(243,234,218,.1)", padding: "13px 0", cursor: !r.closed && r.my_guess == null ? "pointer" : "default" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ font: "600 12.5px/1.35 Archivo", color: "rgba(243,234,218,.75)", flex: 1, minWidth: 0 }}>
              {r.closed ? r.text : !r.closed && r.my_guess != null ? `Runde ${r.n} · wartet auf ${duel.opponent_name}` : `Runde ${r.n} · ${r.cat_name} — jetzt schätzen`}
            </div>
            {r.closed && <div style={{ font: "500 12px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)", whiteSpace: "nowrap" }}>{nf(r.truth ?? 0)} {r.unit}</div>}
          </div>
          {r.closed && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 9, alignItems: "center" }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(243,234,218,.12)", overflow: "hidden" }}>
                  <div style={{ height: 6, borderRadius: 3, background: "#F0B429", width: `${r.my_score ?? 0}%` }} />
                </div>
                <div style={{ font: "500 11px/1 'DM Mono',monospace", color: "#F0B429", width: 34, textAlign: "right" }}>{r.my_score}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(243,234,218,.12)", overflow: "hidden" }}>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(243,234,218,.6)", width: `${r.opp_score ?? 0}%` }} />
                </div>
                <div style={{ font: "500 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.6)", width: 34, textAlign: "right" }}>{r.opp_score}</div>
              </div>
            </>
          )}
        </div>
      ))}

      <div style={{ flex: 1 }} />
      {error && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginTop: 12 }}>{error}</div>}
      {duel.status === "finished" ? (
        <div
          onClick={rematch}
          style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: busy ? "default" : "pointer", marginTop: 22, opacity: busy ? 0.6 : 1 }}
        >
          Revanche fordern
        </div>
      ) : nextOpenRound ? (
        <div
          onClick={() => navigate(`/duelle/${duel.id}/runde/${nextOpenRound.round_id}`)}
          style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: "pointer", marginTop: 22 }}
        >
          Runde {nextOpenRound.n} spielen
        </div>
      ) : null}
    </div>
  );
}
