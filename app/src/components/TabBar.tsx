import { NavLink } from "react-router-dom";
import { HomeIcon, DuelIcon, FriendsIcon, ProfileIcon } from "./icons";

const TABS = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/duelle", label: "Duelle", Icon: DuelIcon },
  { to: "/freunde", label: "Freunde", Icon: FriendsIcon },
  { to: "/profil", label: "Profil", Icon: ProfileIcon },
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
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} style={{ flex: 1, textDecoration: "none" }}>
          {({ isActive }) => {
            const color = isActive ? "#F0B429" : "rgba(243,234,218,.45)";
            return (
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
                <Icon color={color} />
                <div style={{ font: "700 9.5px/1 Archivo", letterSpacing: ".03em", color }}>{label}</div>
              </div>
            );
          }}
        </NavLink>
      ))}
    </div>
  );
}
