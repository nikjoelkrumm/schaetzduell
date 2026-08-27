import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackRow } from "../components/ui";
import { Confetti } from "../components/Confetti";
import { CATEGORIES } from "../data/categories";
import { QUESTIONS, type LocalQuestion } from "../data/questions";
import { parseGuess, nf } from "../lib/scoring";

// Same jersey-color idea as the original schaetzduell-verbessert.html build's
// `COL` array — one color per player, reused for their peg on the reveal
// axis and their row on the scoreboard.
const PLAYER_COLORS = ["#F0B429", "#E2553C", "#5FBF8B", "#4EA8DE", "#C77DFF", "#F27B9D", "#A3C940", "#E8703A"];

type Stage = "setup" | "categories" | "ask" | "reveal" | "win";

interface Player {
  name: string;
  score: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LocalDuel() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("setup");
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(["", ""]);
  const [target, setTarget] = useState<5 | 10>(5);
  const [cats, setCats] = useState<number[]>([0, 1, 2, 3, 4]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [pool, setPool] = useState<LocalQuestion[]>([]);
  const [qi, setQi] = useState(0);
  const [turn, setTurn] = useState(0);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [entry, setEntry] = useState("");
  const [masked, setMasked] = useState(false);
  const [wonIndexes, setWonIndexes] = useState<number[]>([]);

  const setPlayerCountClamped = (n: number) => {
    const c = Math.max(2, Math.min(8, n));
    setPlayerCount(c);
    setNames((prev) => {
      const next = prev.slice(0, c);
      while (next.length < c) next.push("");
      return next;
    });
  };

  const buildPool = () => shuffle(QUESTIONS.filter((q) => cats.includes(q.catId)));

  const startGame = () => {
    setPlayers(names.map((n, i) => ({ name: n.trim() || `Spieler ${i + 1}`, score: 0 })));
    setPool(buildPool());
    setQi(0);
    setTurn(0);
    setGuesses([]);
    setEntry("");
    setWonIndexes([]);
    setStage("ask");
  };

  const question = pool[qi];

  const submitGuess = () => {
    const v = parseGuess(entry);
    if (!isFinite(v)) return;
    const next = [...guesses, v];
    setGuesses(next);
    setEntry("");
    if (turn < players.length - 1) {
      setTurn(turn + 1);
      return;
    }
    // last player just guessed — score this round and reveal
    const diffs = next.map((g) => Math.abs(g - question.answer));
    const best = Math.min(...diffs);
    const won = diffs.map((d, i) => (d === best ? i : -1)).filter((i) => i >= 0);
    setWonIndexes(won);
    setPlayers((ps) => ps.map((p, i) => (won.includes(i) ? { ...p, score: p.score + 1 } : p)));
    setTurn(0);
    setStage("reveal");
  };

  const skipQuestion = () => {
    const nextQi = qi + 1;
    if (nextQi >= pool.length) return setStage("win");
    setQi(nextQi);
    setGuesses([]);
    setEntry("");
  };

  const afterReveal = () => {
    if (players.some((p) => p.score >= target)) return setStage("win");
    const nextQi = qi + 1;
    if (nextQi >= pool.length) return setStage("win");
    setQi(nextQi);
    setGuesses([]);
    setEntry("");
    setStage("ask");
  };

  const axis = useMemo(() => {
    if (stage !== "reveal" || !question) return null;
    const all = [question.answer, ...guesses];
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (hi === lo) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
    return { pos };
  }, [stage, question, guesses]);

  const board = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${players.length <= 3 ? players.length : players.length <= 4 ? 2 : players.length <= 6 ? 3 : 4}, minmax(0,1fr))`,
        gap: 8,
        marginBottom: 18,
      }}
    >
      {players.map((p, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", font: "700 11.5px/1 Archivo", color: PLAYER_COLORS[i], marginBottom: 5 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <span>{p.score}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(243,234,218,.12)", overflow: "hidden" }}>
            <div
              className="sd-bar-fill"
              style={{ height: 4, borderRadius: 2, background: PLAYER_COLORS[i], width: `${Math.min(100, (p.score / target) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  // ── Setup ──────────────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
        <BackRow onClick={() => navigate("/duelle")} />
        <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "18px 0 8px" }}>
          Lokales Duell
        </div>
        <div style={{ font: "400 13px/1.55 Archivo", color: "rgba(243,234,218,.58)", marginBottom: 24 }}>
          2 bis 8 Spieler, ein Gerät wandert reihum. Wer am nächsten dran ist, bekommt den Punkt.
        </div>

        <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
          Spielziel
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          {([5, 10] as const).map((t) => (
            <div
              key={t}
              onClick={() => setTarget(t)}
              className="sd-tap"
              style={{
                flex: 1, textAlign: "center", padding: 14, borderRadius: 12, cursor: "pointer",
                background: target === t ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)",
                color: target === t ? "#F0B429" : "#F3EADA",
              }}
            >
              <div style={{ font: "800 15px/1 Archivo" }}>{t} Punkte</div>
              <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", opacity: 0.7, marginTop: 4 }}>
                {t === 5 ? "Kurze Runde" : "Volles Duell"}
              </div>
            </div>
          ))}
        </div>

        <div style={{ font: "700 11px/1 'DM Mono',monospace", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(243,234,218,.5)", marginBottom: 10 }}>
          Spieler
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div onClick={() => setPlayerCountClamped(playerCount - 1)} className="sd-tap" style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(243,234,218,.08)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 20px/1 Archivo", cursor: "pointer" }}>
            −
          </div>
          <div style={{ font: "900 20px/1 'Archivo Black',Archivo" }}>{playerCount} Spieler</div>
          <div onClick={() => setPlayerCountClamped(playerCount + 1)} className="sd-tap" style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(243,234,218,.08)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 20px/1 Archivo", cursor: "pointer" }}>
            +
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {names.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: PLAYER_COLORS[i], flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "900 12px/1 'Archivo Black',Archivo", color: "#0D2B2F" }}>
                {i + 1}
              </div>
              <input
                value={n}
                onChange={(e) => setNames((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                placeholder={`Name Spieler ${i + 1}`}
                maxLength={12}
                style={{ flex: 1, background: "#12393E", border: "1px solid rgba(243,234,218,.16)", borderRadius: 11, padding: 12, font: "400 13.5px/1 Archivo", color: "#F3EADA" }}
              />
            </div>
          ))}
        </div>

        <div onClick={() => setStage("categories")} className="sd-tap" style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 54, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15px/1 Archivo", cursor: "pointer" }}>
          Weiter zu den Kategorien
        </div>
      </div>
    );
  }

  // ── Categories ─────────────────────────────────────────────────────
  if (stage === "categories") {
    const poolSize = QUESTIONS.filter((q) => cats.includes(q.catId)).length;
    const toggle = (id: number) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    return (
      <div className="screen-in" style={{ padding: "8px 20px 20px" }}>
        <BackRow onClick={() => setStage("setup")} />
        <div style={{ font: "900 27px/1 'Archivo Black',Archivo", letterSpacing: "-.025em", margin: "18px 0 8px" }}>
          Kategorien
        </div>
        <div style={{ font: "400 13px/1.55 Archivo", color: "rgba(243,234,218,.58)", marginBottom: 20 }}>
          Mehrfachauswahl möglich · Ziel: {target} Punkte
        </div>
        {CATEGORIES.map((c) => {
          const on = cats.includes(c.id);
          const n = QUESTIONS.filter((q) => q.catId === c.id).length;
          return (
            <div
              key={c.id}
              onClick={() => toggle(c.id)}
              className="sd-tap"
              style={{
                background: on ? `${c.color}1a` : "#12393E",
                border: `1px solid ${on ? `${c.color}73` : "rgba(243,234,218,.12)"}`,
                borderRadius: 16, padding: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: on ? c.color : "rgba(243,234,218,.25)", flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: "800 14px/1 Archivo" }}>{c.name}</div>
                <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 6 }}>{c.description}</div>
              </div>
              <div style={{ font: "500 12px/1 'DM Mono',monospace", color: on ? c.color : "rgba(243,234,218,.45)" }}>{n} Fragen</div>
            </div>
          );
        })}
        <div style={{ font: "400 11.5px/1.5 'DM Mono',monospace", color: "rgba(243,234,218,.45)", margin: "6px 0 16px", textAlign: "center" }}>
          {cats.length ? `${poolSize} Fragen im Topf` : "Mindestens eine Kategorie wählen"}
        </div>
        <div
          onClick={() => cats.length && startGame()}
          className="sd-tap"
          style={{ background: cats.length ? "#F0B429" : "rgba(240,180,41,.35)", color: "#0D2B2F", borderRadius: 14, height: 54, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15px/1 Archivo", cursor: cats.length ? "pointer" : "default" }}
        >
          Spiel starten
        </div>
      </div>
    );
  }

  if (!question) return null;

  // ── Ask ────────────────────────────────────────────────────────────
  if (stage === "ask") {
    const val = parseGuess(entry);
    const canSubmit = entry !== "" && isFinite(val);
    const last = turn === players.length - 1;
    const catName = CATEGORIES.find((c) => c.id === question.catId)?.name ?? "";
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
        {board}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>Frage {qi + 1} · bis {target}</div>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "#F0B429" }}>{catName}</div>
        </div>
        <div style={{ font: "900 24px/1.2 'Archivo Black',Archivo", letterSpacing: "-.02em", marginBottom: 6 }}>{question.text}</div>
        <div style={{ font: "400 12px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.45)", marginBottom: 18 }}>Antwort in {question.unit}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLAYER_COLORS[turn] }} />
          <span style={{ font: "800 14px/1 Archivo", color: PLAYER_COLORS[turn] }}>{players[turn].name}</span>
          <span style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)", marginLeft: "auto" }}>{turn + 1} / {players.length}</span>
        </div>

        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/[^0-9.,-]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && submitGuess()}
          inputMode="decimal"
          autoComplete="off"
          placeholder="?"
          style={{
            width: "100%", background: "#12393E", border: "1px solid rgba(243,234,218,.16)", borderRadius: 13,
            padding: 16, font: "700 22px/1 'DM Mono',monospace", color: "#F3EADA", marginBottom: 10,
            ...(masked ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : {}),
          }}
        />

        <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
          <div onClick={() => setMasked((m) => !m)} style={{ font: "600 12px/1 Archivo", color: "#F0B429", cursor: "pointer" }}>
            {masked ? "Zahl anzeigen" : "Zahl verdecken"}
          </div>
          {turn === 0 && (
            <div onClick={skipQuestion} style={{ font: "600 12px/1 Archivo", color: "rgba(243,234,218,.5)", cursor: "pointer" }}>
              Frage überspringen
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <div
          onClick={() => canSubmit && submitGuess()}
          className="sd-tap"
          style={{ background: canSubmit ? "#F0B429" : "rgba(240,180,41,.35)", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: canSubmit ? "pointer" : "default" }}
        >
          {last ? "Abgeben & auflösen" : "Abgeben & weitergeben"}
        </div>
        <div style={{ font: "400 11px/1.4 Archivo", color: "rgba(243,234,218,.4)", textAlign: "center", marginTop: 10 }}>
          {last ? "Danach werden alle Tipps aufgedeckt" : `Handy weitergeben an ${players[turn + 1].name}`}
        </div>
      </div>
    );
  }

  // ── Reveal ─────────────────────────────────────────────────────────
  if (stage === "reveal" && axis) {
    const catName = CATEGORIES.find((c) => c.id === question.catId)?.name ?? "";
    const ranked = guesses
      .map((v, i) => ({ i, v, d: Math.abs(v - question.answer) }))
      .sort((a, b) => a.d - b.d);
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px" }}>
        {board}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.5)" }}>Frage {qi + 1} · bis {target}</div>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "#F0B429" }}>{catName}</div>
        </div>
        <div style={{ font: "600 14px/1.35 Archivo", color: "rgba(243,234,218,.7)", marginBottom: 18 }}>{question.text}</div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ font: "400 10px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>Richtige Antwort</div>
          <div className="sd-pop" style={{ font: "900 34px/1.2 'Archivo Black',Archivo", marginTop: 4 }}>{nf(question.answer)}</div>
          <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.45)" }}>{question.unit}</div>
        </div>

        <div style={{ position: "relative", height: 70, marginBottom: 14 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 30, height: 2, background: "rgba(243,234,218,.18)" }} />
          <div style={{ position: "absolute", top: 22, left: `${axis.pos(question.answer)}%`, transform: "translateX(-50%)", width: 3, height: 18, background: "#F3EADA" }} />
          {guesses.map((v, i) => (
            <div key={i} style={{ position: "absolute", top: `${8 + (i % 3) * 16}px`, left: `${axis.pos(v)}%`, transform: "translateX(-50%)", textAlign: "center" }}>
              <div style={{ font: "800 9px/1 'DM Mono',monospace", color: PLAYER_COLORS[i], background: "#0D2B2F", padding: "2px 4px", borderRadius: 4 }}>
                {players[i].name.slice(0, 3).toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          {ranked.map((o) => (
            <div key={o.i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid rgba(243,234,218,.08)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: PLAYER_COLORS[o.i], flex: "none" }} />
              <div style={{ flex: 1, font: "700 13px/1 Archivo", color: PLAYER_COLORS[o.i] }}>{players[o.i].name}</div>
              <div style={{ font: "500 12px/1 'DM Mono',monospace", color: "rgba(243,234,218,.6)" }}>{nf(o.v)}</div>
              <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)", width: 70, textAlign: "right" }}>
                {o.d === 0 ? "exakt" : `±${nf(Math.round(o.d * 1000) / 1000)}`}
              </div>
              {wonIndexes.includes(o.i) && <div style={{ font: "800 12px/1 Archivo", color: PLAYER_COLORS[o.i] }}>+1</div>}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div onClick={afterReveal} className="sd-tap" style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 56, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15.5px/1 Archivo", cursor: "pointer" }}>
          Weiter
        </div>
      </div>
    );
  }

  // ── Win ────────────────────────────────────────────────────────────
  if (stage === "win") {
    const top = Math.max(...players.map((p) => p.score));
    const champs = players.map((p, i) => ({ p, i })).filter((o) => o.p.score === top);
    const ranked = players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    return (
      <div className="screen-in" style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "8px 20px 18px", position: "relative" }}>
        <Confetti />
        {board}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,234,218,.5)" }}>
            {champs.length > 1 ? "Unentschieden" : "Sieger"}
          </div>
          <div className="sd-pop" style={{ font: "900 30px/1.15 'Archivo Black',Archivo", marginTop: 8, color: champs.length > 1 ? "#F3EADA" : PLAYER_COLORS[champs[0].i] }}>
            {champs.map((o) => o.p.name).join(" & ")}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          {ranked.map((o, pos) => (
            <div key={o.i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(243,234,218,.08)" }}>
              <div style={{ font: "700 12px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)", width: 16 }}>{pos + 1}</div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: PLAYER_COLORS[o.i], flex: "none" }} />
              <div style={{ flex: 1, font: "700 14px/1 Archivo", color: PLAYER_COLORS[o.i] }}>{o.p.name}</div>
              <div style={{ font: "900 16px/1 'Archivo Black',Archivo" }}>{o.p.score}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={startGame} className="sd-tap" style={{ background: "#F0B429", color: "#0D2B2F", borderRadius: 14, height: 54, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15px/1 Archivo", cursor: "pointer", marginBottom: 10 }}>
          Nochmal, gleiche Runde
        </div>
        <div onClick={() => setStage("setup")} className="sd-tap" style={{ border: "1px solid rgba(243,234,218,.25)", color: "#F3EADA", borderRadius: 14, height: 50, display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px/1 Archivo", cursor: "pointer" }}>
          Neu einrichten
        </div>
      </div>
    );
  }

  return null;
}
