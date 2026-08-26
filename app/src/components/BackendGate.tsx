import type { ReactNode } from "react";
import { isBackendConfigured } from "../lib/supabase";
import { ScreenColumn, Eyebrow } from "./ui";

// Wraps any screen that needs the real backend. Lets the whole app boot and
// stay explorable (onboarding, auth screens, the design itself) even before
// a Supabase project is wired up — see SUPABASE_SETUP.md.
export function BackendGate({ children }: { children: ReactNode }) {
  if (isBackendConfigured) return <>{children}</>;
  return (
    <ScreenColumn style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Eyebrow color="#F0B429" style={{ marginBottom: 12 }}>
        Backend nicht verbunden
      </Eyebrow>
      <div style={{ font: "900 22px/1.2 'Archivo Black',Archivo", marginBottom: 12 }}>
        Diese Ansicht braucht Supabase.
      </div>
      <p style={{ font: "400 13.5px/1.6 Archivo", color: "rgba(243,234,218,.65)" }}>
        Setze <code style={{ fontFamily: "'DM Mono',monospace" }}>VITE_SUPABASE_URL</code> und{" "}
        <code style={{ fontFamily: "'DM Mono',monospace" }}>VITE_SUPABASE_ANON_KEY</code> in{" "}
        <code style={{ fontFamily: "'DM Mono',monospace" }}>app/.env.local</code>, nachdem du die Migrationen aus{" "}
        <code style={{ fontFamily: "'DM Mono',monospace" }}>supabase/migrations</code> ausgeführt hast. Details in{" "}
        <code style={{ fontFamily: "'DM Mono',monospace" }}>SUPABASE_SETUP.md</code>.
      </p>
    </ScreenColumn>
  );
}
