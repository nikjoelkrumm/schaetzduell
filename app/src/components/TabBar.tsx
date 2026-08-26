import { NavLink } from "react-router-dom";

const TABS: { to: string; label: string; shape: string }[] = [
  { to: "/home", label: "Home", shape: "5px" },
  { to: "/duelle", label: "Duelle", shape: "50%" },
  { to: "/freunde", label: "Freunde", shape: "3px" },
  { to: "/profil", label: "Profil", shape: "50%" },
];

export function TabBar() {
  return (
    <div
      style={{
        borderTop: "1px solid rgba(243,234,218,.12)",
        background: "rgba(18,57,62,.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        padding: "10px 8px calc(env(safe-area-inset-bottom) + 14px)",
        flex: "none",
      }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          style={{ flex: 1, textDecoration: "none" }}
        >
          {({ isActive }) => (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "6px 0",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: t.shape,
                  background: isActive ? "#F0B429" : "#F3EADA",
                  opacity: isActive ? 1 : 0.45,
                }}
              />
              <div
                style={{
                  font: "700 9.5px/1 Archivo",
                  letterSpacing: ".03em",
                  color: isActive ? "#F0B429" : "#F3EADA",
                  opacity: isActive ? 1 : 0.45,
                }}
              >
                {t.label}
              </div>
            </div>
          )}
        </NavLink>
      ))}
    </div>
  );
}
