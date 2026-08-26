import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getWeek, submitAttempt, practiceQuestions, practiceGuess, getDuel, submitDuelGuess } from "../lib/db";
import type { PracticeQuestion, WeekQuestion } from "../lib/types";
import { parseGuess, nf, sliderToVal, valToSlider, scalePosPct, band } from "../lib/scoring";
import { enqueue, makeIdemKey, readQueue, removeFromQueue } from "../lib/offlineQueue";
import { supabase } from "../lib/supabase";
import { categoryColorByName } from "../data/categories";

type Mode = "week" | "practice" | "duel";

interface ActiveQuestion {
  key: string; // stable id for idempotency + list tracking
  text: string;
  unit: string;
  catName: string;
  volatile: boolean;
  progressLabel: string;
}

interface RevealData {
  score: number;
  truth: number;
  guess: number;
  percentile?: number;
  oppScore?: number | null;
  oppGuess?: number | null;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

export default function GuessFlow({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, refreshProfile } = useAuth();
  const params = useParams<{ duelId: string; roundId: string }>();

  const [phase, setPhase] = useState<"loading" | "question" | "revealing" | "waiting" | "done" | "error">("loading");
  const [question, setQuestion] = useState<ActiveQuestion | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [slider, setSlider] = useState(520);
  const [submitting, setSubmitting] = useState(false);

  // mode-specific working sets
  const weekRef = useRef<WeekQuestion[]>([]);
  const practiceQueueRef = useRef<PracticeQuestion[]>([]);
  const practiceIdxRef = useRef(0);

  const backTarget = mode === "week" ? "/home" : mode === "practice" ? "/uebung" : `/duelle/${params.duelId}`;

  const loadWeek = useCallback(async () => {
    const w = await getWeek();
    weekRef.current = w.questions;
    const next = w.questions.find((q) => !q.answered);
    if (!next) {
      setPhase("done");
      await refreshProfile();
      return;
    }
    setQuestion({
      key: String(next.id),
      text: next.text,
      unit: next.unit,
      catName: next.cat_name,
      volatile: next.volatile,
      progressLabel: `Wochenchallenge · Frage ${next.position} von ${w.questions.length}`,
    });
    setEntry("");
    setSlider(520);
    setPhase("question");
  }, [refreshProfile]);

  const loadPractice = useCallback(async () => {
    if (practiceIdxRef.current >= practiceQueueRef.current.length) {
      setPhase("done");
      return;
    }
    const q = practiceQueueRef.current[practiceIdxRef.current];
    setQuestion({
      key: String(q.id),
      text: q.text,
      unit: q.unit,
      catName: q.cat_name,
      volatile: q.volatile,
      progressLabel: `Übung · Frage ${practiceIdxRef.current + 1} von ${practiceQueueRef.current.length}`,
    });
    setEntry("");
    setSlider(520);
    setPhase("question");
  }, []);

  const roundChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const loadDuel = useCallback(async () => {
    if (!params.duelId || !params.roundId) return;
    const d = await getDuel(params.duelId);
    const r = d.round_list.find((rr) => rr.round_id === params.roundId);
    if (!r) {
      setErrorMsg("Runde nicht gefunden.");
      setPhase("error");
      return;
    }
    if (r.my_guess != null && !r.closed) {
      setPhase("waiting");
      if (supabase && !roundChannelRef.current) {
        roundChannelRef.current = supabase
          .channel(`duel_round:${r.round_id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "duel_rounds", filter: `id=eq.${r.round_id}` },
            () => void loadDuel(),
          )
          .subscribe();
      }
      return;
    }
    if (r.my_guess != null && r.closed) {
      setReveal({
        score: r.my_score ?? 0,
        truth: r.truth ?? 0,
        guess: r.my_guess,
        oppScore: r.opp_score,
        oppGuess: r.opp_guess,
      });
      setPhase("revealing");
      return;
    }
    setQuestion({
      key: r.round_id,
      text: r.text,
      unit: r.unit,
      catName: r.cat_name,
      volatile: false,
      progressLabel: `Duell · Runde ${r.n} von ${d.rounds}`,
    });
    setEntry("");
    setSlider(520);
    setPhase("question");
  }, [params.duelId, params.roundId]);

  useEffect(() => {
    setPhase("loading");
    setErrorMsg(null);
    const run = async () => {
      try {
        if (mode === "week") await loadWeek();
        else if (mode === "practice") {
          if (practiceQueueRef.current.length === 0) {
            const catIds: number[] = (location.state as { catIds?: number[] } | null)?.catIds ?? [0, 1, 2, 3, 4];
            practiceQueueRef.current = await practiceQuestions(catIds, 20);
            practiceIdxRef.current = 0;
          }
          await loadPractice();
        } else {
          await loadDuel();
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Konnte nicht geladen werden.");
        setPhase("error");
      }
    };
    void run();
    return () => {
      if (roundChannelRef.current && supabase) {
        supabase.removeChannel(roundChannelRef.current);
        roundChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, params.roundId]);

  const guessValue = useMemo(() => parseGuess(entry), [entry]);
  const hasEntry = entry !== "" && isFinite(guessValue);

  const press = (label: string) => {
    setEntry((e) => {
      let next = e;
      if (label === "⌫") next = e.slice(0, -1);
      else if (label === ",") next = e.includes(",") ? e : (e || "0") + ",";
      else next = (e + label).slice(0, 9);
      const v = parseGuess(next);
      if (isFinite(v) && v > 0) setSlider(valToSlider(v));
      return next;
    });
  };

  const onSlide = (t: number) => {
    setSlider(t);
    setEntry(String(sliderToVal(t)).replace(".", ","));
  };

  const submit = async () => {
    if (!hasEntry || !question || submitting) return;
    setSubmitting(true);
    const idemKey = makeIdemKey();
    try {
      if (mode === "week") {
        const qid = Number(question.key);
        if (!navigator.onLine) {
          enqueue({ kind: "attempt", questionId: qid, guess: guessValue, idemKey, queuedAt: Date.now() });
          setErrorMsg("Offline — dein Zug wird gesendet, sobald du wieder online bist.");
          setSubmitting(false);
          return;
        }
        const res = await submitAttempt(qid, guessValue, idemKey);
        setReveal({ score: res.score, truth: res.truth, guess: guessValue, percentile: res.percentile });
        setPhase("revealing");
      } else if (mode === "practice") {
        const res = await practiceGuess(Number(question.key), guessValue);
        setReveal({ score: res.score, truth: res.truth, guess: guessValue });
        setPhase("revealing");
      } else {
        if (!navigator.onLine) {
          enqueue({ kind: "duelGuess", roundId: question.key, guess: guessValue, idemKey, queuedAt: Date.now() });
          setErrorMsg("Offline — dein Zug wird gesendet, sobald du wieder online bist.");
          setSubmitting(false);
          return;
        }
        const res = await submitDuelGuess(question.key, guessValue, idemKey);
        setReveal({
          score: res.score,
          truth: res.truth,
          guess: guessValue,
          oppScore: res.closed ? res.opp_score : undefined,
          oppGuess: res.closed ? res.opp_guess : undefined,
        });
        setPhase(res.closed ? "revealing" : "waiting");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Senden fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    setReveal(null);
    if (mode === "week") await loadWeek();
    else if (mode === "practice") {
      practiceIdxRef.current += 1;
      await loadPractice();
    } else {
      navigate(`/duelle/${params.duelId}`);
    }
  };

  // Flush any queued offline guesses once the browser reports back online.
  useEffect(() => {
    const flush = async () => {
      for (const item of readQueue()) {
        try {
          if (item.kind === "attempt") await submitAttempt(item.questionId, item.guess, item.idemKey);
          else await submitDuelGuess(item.roundId, item.guess, item.idemKey);
          removeFromQueue(item.idemKey);
        } catch {
          // leave it queued, we'll retry on the next online event
        }
      }
    };
    window.addEventListener("online", flush);
    if (navigator.onLine) void flush();
    return () => window.removeEventListener("online", flush);
  }, []);

  if (!profile) return null;

  if (phase === "loading") {
    return <div style={{ padding: 20, font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>lädt…</div>;
  }

  if (phase === "error") {
    return (
      <div className="screen-in" style={{ padding: "8px 20px 18px" }}>
        <div onClick={() => navigate(backTarget)} style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", cursor: "pointer" }}>
          ✕
        </div>
        <div style={{ marginTop: 20, font: "700 15px/1.4 Archivo", color: "#F0B429" }}>{errorMsg}</div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
        <div onClick={() => navigate(backTarget)} style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", cursor: "pointer" }}>
          ✕
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ font: "900 22px/1.3 'Archivo Black',Archivo", marginBottom: 10 }}>Zug gesendet</div>
          <div style={{ font: "400 13px/1.6 Archivo", color: "rgba(243,234,218,.6)", maxWidth: 260 }}>
            Sobald dein Gegner auch getippt hat, siehst du hier automatisch die Auflösung.
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px", textAlign: "center", justifyContent: "center", alignItems: "center" }}>
        <div style={{ font: "900 26px/1.2 'Archivo Black',Archivo", marginBottom: 12 }}>
          {mode === "week" ? "Woche geschafft ✓" : "Runde beendet"}
        </div>
        <div
          onClick={() => navigate(mode === "week" ? "/home" : "/uebung")}
          style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, padding: "14px 28px", font: "800 15px/1 Archivo", cursor: "pointer" }}
        >
          {mode === "week" ? "Zurück zur Startseite" : "Zurück zur Übung"}
        </div>
      </div>
    );
  }

  if (phase === "revealing" && reveal && question) {
    const b = band(reveal.score);
    const isDuel = mode === "duel";
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
        <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)", margin: "6px 0 20px" }}>
          {question.progressLabel} · <span style={{ color: categoryColorByName(question.catName) }}>{question.catName}</span>
        </div>
        <div style={{ font: "600 15px/1.35 Archivo", color: "rgba(243,234,218,.7)", marginBottom: 30 }}>{question.text}</div>

        <div style={{ textAlign: "center" }}>
          <div style={{ font: "900 66px/1 'Archivo Black',Archivo", letterSpacing: "-.04em", color: b.tint }}>+{reveal.score}</div>
          <div style={{ font: "900 13px/1 'Archivo Black',Archivo", letterSpacing: ".1em", textTransform: "uppercase", color: b.tint, marginTop: 12 }}>
            {b.label}
          </div>
        </div>

        <div style={{ margin: "36px 0 8px", position: "relative", height: 76 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 38, height: 2, background: "rgba(243,234,218,.18)" }} />
          <div style={{ position: "absolute", top: 26, left: `${scalePosPct(reveal.truth)}%`, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ width: 3, height: 26, background: "#F3EADA", margin: "0 auto" }} />
            <div style={{ font: "500 12px/1 'DM Mono',monospace", marginTop: 7, whiteSpace: "nowrap" }}>{nf(reveal.truth)}</div>
            <div style={{ font: "400 9.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 4 }}>Wahrheit</div>
          </div>
          <div style={{ position: "absolute", top: 0, left: `${scalePosPct(reveal.guess)}%`, transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ font: "400 9.5px/1 'DM Mono',monospace", color: b.tint, marginBottom: 4 }}>du</div>
            <div style={{ font: "500 12px/1 'DM Mono',monospace", color: b.tint, whiteSpace: "nowrap" }}>{nf(reveal.guess)}</div>
            <div style={{ width: 3, height: 22, background: b.tint, margin: "6px auto 0" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
          <div style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 14, padding: 14 }}>
            <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Abweichung</div>
            <div style={{ font: "900 19px/1 'Archivo Black',Archivo", marginTop: 8 }}>
              {(() => {
                const off = Math.round(((reveal.guess - reveal.truth) / (reveal.truth || 1)) * 100);
                return `${off > 0 ? "+" : ""}${off} %`;
              })()}
            </div>
          </div>
          {isDuel && reveal.oppGuess != null ? (
            <div style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 14, padding: 14 }}>
              <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Gegner</div>
              <div style={{ font: "900 19px/1 'Archivo Black',Archivo", marginTop: 8 }}>+{reveal.oppScore}</div>
            </div>
          ) : reveal.percentile != null ? (
            <div style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 14, padding: 14 }}>
              <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Besser als</div>
              <div style={{ font: "900 19px/1 'Archivo Black',Archivo", marginTop: 8 }}>{reveal.percentile} %</div>
            </div>
          ) : null}
        </div>

        {question.volatile && (
          <div style={{ marginTop: 12, border: "1px solid rgba(240,180,41,.3)", borderRadius: 12, padding: "11px 13px", font: "400 11.5px/1.5 Archivo", color: "rgba(243,234,218,.65)" }}>
            <span style={{ color: "#F0B429", fontWeight: 700 }}>Richtwert</span> — dieser Wert ändert sich mit der Zeit.
          </div>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <div
            onClick={() => navigate("/teilen")}
            style={{ width: 56, border: "1px solid rgba(243,234,218,.25)", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "600 17px/1 Archivo", color: "#F3EADA", cursor: "pointer" }}
          >
            ↗
          </div>
          <div
            onClick={next}
            style={{ flex: 1, background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: "pointer" }}
          >
            {isDuel ? "Zur Duell-Übersicht" : "Nächste Frage"}
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div onClick={() => navigate(backTarget)} style={{ font: "600 13px/1 Archivo", color: "rgba(243,234,218,.55)", cursor: "pointer" }}>
          ✕
        </div>
        <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.55)" }}>{question.progressLabel}</div>
        <div style={{ font: "400 11px/1 'DM Mono',monospace", color: categoryColorByName(question.catName) }}>{question.catName}</div>
      </div>
      <div style={{ font: "900 26px/1.18 'Archivo Black',Archivo", letterSpacing: "-.02em", marginBottom: 8 }}>{question.text}</div>
      <div style={{ font: "400 12px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginBottom: 26 }}>
        Antwort in {question.unit}
      </div>

      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ font: "900 58px/1 'Archivo Black',Archivo", letterSpacing: "-.04em", color: hasEntry ? "#F3EADA" : "rgba(243,234,218,.3)" }}>
          {hasEntry ? nf(guessValue) : "—"}
        </div>
        <div style={{ font: "400 12px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginTop: 10 }}>{question.unit}</div>
      </div>

      <div style={{ margin: "24px 0 6px" }}>
        <input
          type="range"
          min={0}
          max={1000}
          value={slider}
          onChange={(e) => onSlide(Number(e.target.value))}
          style={{ width: "100%", accentColor: categoryColorByName(question.catName), height: 26 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.35)", marginTop: 2 }}>
          <span>1</span>
          <span>100</span>
          <span>10 000</span>
          <span>1 Mio</span>
        </div>
        <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.4)", textAlign: "center", marginTop: 12 }}>
          Grob mit der Skala, fein mit der Tastatur
        </div>
      </div>

      <div style={{ flex: 1 }} />
      {errorMsg && <div style={{ font: "400 11.5px/1.5 Archivo", color: "#F0B429", marginBottom: 10, textAlign: "center" }}>{errorMsg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 12 }}>
        {KEYS.map((k) => (
          <div
            key={k}
            onClick={() => press(k)}
            style={{ background: "#12393E", border: "1px solid rgba(243,234,218,.12)", borderRadius: 12, height: 50, display: "flex", alignItems: "center", justifyContent: "center", font: "500 21px/1 'DM Mono',monospace", cursor: "pointer" }}
          >
            {k}
          </div>
        ))}
      </div>
      <div
        onClick={submit}
        style={{
          background: hasEntry ? "#F0B429" : "rgba(240,180,41,.35)",
          color: "#0D2B2F",
          borderRadius: 14,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "800 15.5px/1 Archivo",
          cursor: hasEntry && !submitting ? "pointer" : "default",
        }}
      >
        {submitting ? "Sendet…" : "Tipp abgeben"}
      </div>
    </div>
  );
}
