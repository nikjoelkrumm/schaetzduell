import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import { TOTAL_QUESTIONS } from "../data/questions";
import { CATEGORIES } from "../data/categories";
import { isBackendConfigured } from "../lib/supabase";

export default function Onboarding() {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const playAsGuest = async () => {
    setErr(null);
    if (!isBackendConfigured) {
      setErr("Backend nicht verbunden — siehe SUPABASE_SETUP.md.");
      return;
    }
    setBusy(true);
    try {
      await continueAsGuest();
      navigate("/home");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Konnte nicht als Gast starten.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="screen-in"
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px 26px",
        background: "#0D2B2F",
        color: "#F3EADA",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0" }}>
        <img
          src="/appicon.svg"
          alt=""
          width={76}
          height={76}
          style={{
            borderRadius: 20,
            boxShadow: "0 10px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(243,234,218,.14)",
            marginBottom: 30,
            display: "block",
          }}
        />
        <div style={{ font: "900 42px/.94 'Archivo Black',Archivo", letterSpacing: "-.035em", marginBottom: 16 }}>
          Wie gut
          <br />
          schätzt du
          <br />
          wirklich?
        </div>
        <div style={{ font: "400 15px/1.55 Archivo", color: "rgba(243,234,218,.62)", maxWidth: 290 }}>
          Eine Wochenchallenge für alle. Duelle gegen Freunde, Runde für Runde. {TOTAL_QUESTIONS} Fragen, keine
          davon zum Raten.
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 34 }}>
          <div>
            <div style={{ font: "900 24px/1 'Archivo Black',Archivo", color: "#F0B429" }}>{TOTAL_QUESTIONS}</div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
              Fragen
            </div>
          </div>
          <div>
            <div style={{ font: "900 24px/1 'Archivo Black',Archivo", color: "#F0B429" }}>{CATEGORIES.length}</div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
              Kategorien
            </div>
          </div>
          <div>
            <div style={{ font: "900 24px/1 'Archivo Black',Archivo", color: "#F0B429" }}>1</div>
            <div style={{ font: "400 10.5px/1.4 'DM Mono',monospace", color: "rgba(243,234,218,.5)", marginTop: 5 }}>
              Challenge pro Woche
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn onClick={() => navigate("/konto")}>Los geht's</Btn>
        <Btn variant="ghost" height={50} disabled={busy} onClick={playAsGuest}>
          Erst mal ohne Konto spielen
        </Btn>
        {err && (
          <div style={{ font: "400 11px/1.5 Archivo", color: "#F0B429", textAlign: "center" }}>{err}</div>
        )}
      </div>
    </div>
  );
}
