import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthContext";
import type { AppNotification } from "../lib/types";

// The real, working half of the design's simulated push banner: this
// subscribes to Postgres changes on the caller's own notifications rows
// (written by the send_push() RPC — see 0005_functions.sql) and renders an
// in-app banner the moment one arrives, while the tab is open. True
// OS-level push (APNs/FCM) needs a native Capacitor shell with device
// tokens and is documented as follow-up work in ARCHITECTURE.md.
export function PushBanner() {
  const { profile } = useAuth();
  const [note, setNote] = useState<AppNotification | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sb = supabase;
    if (!sb || !profile) return;
    const channel = sb
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${profile.id}` },
        (payload) => {
          setNote(payload.new as AppNotification);
          window.setTimeout(() => setNote((cur) => (cur?.id === payload.new.id ? null : cur)), 5200);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [profile]);

  if (!note) return null;

  const dismiss = async () => {
    setNote(null);
    if (supabase) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", note.id);
  };

  return (
    <div
      onClick={() => {
        navigate("/duelle");
        void dismiss();
      }}
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        zIndex: 60,
        background: "rgba(27,76,82,.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(243,234,218,.22)",
        borderRadius: 20,
        padding: "13px 15px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        boxShadow: "0 18px 40px rgba(0,0,0,.45)",
        animation: "sd-drop .32s ease both",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: "#F0B429",
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "900 15px/1 'Archivo Black',Archivo",
          color: "#0D2B2F",
        }}
      >
        S
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ font: "700 12.5px/1.3 Archivo" }}>{note.title}</div>
          <div style={{ font: "400 10.5px/1.3 'DM Mono',monospace", color: "rgba(243,234,218,.55)" }}>jetzt</div>
        </div>
        <div style={{ font: "400 12.5px/1.45 Archivo", color: "rgba(243,234,218,.85)", marginTop: 2 }}>
          {note.body}
        </div>
      </div>
    </div>
  );
}
