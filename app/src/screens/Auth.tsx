import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackRow, Btn } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import { supabase, isBackendConfigured } from "../lib/supabase";

const inputStyle = {
  background: "#12393E",
  border: "1px solid rgba(243,234,218,.16)",
  borderRadius: 13,
  padding: 15,
  font: "400 14.5px/1 'DM Mono',monospace",
  color: "#F3EADA",
  width: "100%",
} as const;

export default function Auth() {
  const navigate = useNavigate();
  const { session, signInWithPassword, signUpWithPassword, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthNote, setOauthNote] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate("/home");
  }, [session, navigate]);

  const guard = () => {
    if (!isBackendConfigured) {
      setError("Backend nicht verbunden — siehe SUPABASE_SETUP.md.");
      return false;
    }
    return true;
  };

  const submit = async () => {
    setError(null);
    if (!guard()) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password, name || "Spieler");
      } else {
        await signInWithPassword(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    setError(null);
    if (!guard()) return;
    if (!email) {
      setError("Trag zuerst deine E-Mail-Adresse ein.");
      return;
    }
    setBusy(true);
    try {
      await sendMagicLink(email);
      setMagicSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Link konnte nicht verschickt werden.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "apple" | "google") => {
    setOauthNote(null);
    if (!guard()) return;
    if (!supabase) return;
    const { error: e } = await supabase.auth.signInWithOAuth({ provider });
    if (e) {
      setOauthNote(
        `${provider === "apple" ? "Apple" : "Google"}-Anmeldung ist noch nicht eingerichtet (OAuth-Provider fehlt in Supabase) — siehe SUPABASE_SETUP.md.`,
      );
    }
  };

  return (
    <div
      className="screen-in"
      style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "14px 24px 26px", background: "#0D2B2F", color: "#F3EADA" }}
    >
      <BackRow onClick={() => navigate("/")} />
      <div style={{ font: "900 30px/1.02 'Archivo Black',Archivo", letterSpacing: "-.03em", margin: "22px 0 8px" }}>
        Dein Konto
      </div>
      <div style={{ font: "400 13.5px/1.55 Archivo", color: "rgba(243,234,218,.58)", marginBottom: 26 }}>
        Damit Serie, Liga und Duelle auf jedem Gerät gleich aussehen. Der lokale Spielstand wird beim ersten Login
        übernommen.
      </div>

      {magicSent && (
        <div style={{ border: "1px solid rgba(240,180,41,.4)", background: "rgba(240,180,41,.09)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ font: "800 14px/1.3 Archivo", color: "#F0B429", marginBottom: 6 }}>Link ist unterwegs</div>
          <div style={{ font: "400 13px/1.55 Archivo", color: "rgba(243,234,218,.7)" }}>
            Wir haben an <span style={{ fontFamily: "'DM Mono',monospace" }}>{email}</span> einen Anmeldelink
            geschickt.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setMode("signin")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: mode === "signin" ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)",
            color: mode === "signin" ? "#F0B429" : "#F3EADA", font: "700 12px/1 Archivo",
          }}
        >
          Anmelden
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: mode === "signup" ? "rgba(240,180,41,.18)" : "rgba(243,234,218,.06)",
            color: mode === "signup" ? "#F0B429" : "#F3EADA", font: "700 12px/1 Archivo",
          }}
        >
          Konto erstellen
        </button>
      </div>

      {mode === "signup" && (
        <>
          <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,234,218,.4)", marginBottom: 10 }}>
            Spielername
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marek"
            style={{ ...inputStyle, marginBottom: 14 }}
          />
        </>
      )}

      <div style={{ font: "400 10px/1 'DM Mono',monospace", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(243,234,218,.4)", marginBottom: 10 }}>
        E-Mail
      </div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="du@beispiel.de"
        style={{ ...inputStyle, marginBottom: 10 }}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="••••••••••"
        style={{ ...inputStyle, marginBottom: 14 }}
      />

      {error && <div style={{ font: "400 12px/1.5 Archivo", color: "#F0B429", marginBottom: 10 }}>{error}</div>}

      <Btn onClick={submit} disabled={busy} height={52}>
        {mode === "signup" ? "Konto erstellen" : "Anmelden"}
      </Btn>
      <div onClick={magic} style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center", font: "600 13.5px/1 Archivo", color: "#F0B429", cursor: "pointer" }}>
        Stattdessen Link per E-Mail
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 18px" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(243,234,218,.15)" }} />
        <div style={{ font: "400 10.5px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>oder</div>
        <div style={{ flex: 1, height: 1, background: "rgba(243,234,218,.15)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn variant="cream" onClick={() => oauth("apple")}>
          Mit Apple anmelden
        </Btn>
        <Btn variant="outline" onClick={() => oauth("google")}>
          Mit Google anmelden
        </Btn>
      </div>
      {oauthNote && (
        <div style={{ font: "400 11px/1.5 Archivo", color: "rgba(243,234,218,.5)", marginTop: 10 }}>{oauthNote}</div>
      )}

      <div style={{ font: "400 11px/1.55 Archivo", color: "rgba(243,234,218,.38)", marginTop: 20 }}>
        Mit der Anmeldung stimmst du den Nutzungsbedingungen zu. Wir speichern Spielername, E-Mail und Spielstand —
        nichts davon geht an Dritte.
      </div>
    </div>
  );
}
