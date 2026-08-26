import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { TabBar } from "./components/TabBar";
import { PushBanner } from "./components/PushBanner";
import { BackendGate } from "./components/BackendGate";

import Onboarding from "./screens/Onboarding";
import Auth from "./screens/Auth";
import Home from "./screens/Home";
import GuessFlow from "./screens/GuessFlow";
import Practice from "./screens/Practice";
import Duels from "./screens/Duels";
import DuelDetail from "./screens/DuelDetail";
import Friends from "./screens/Friends";
import Profile from "./screens/Profile";
import Share from "./screens/Share";
import Paywall from "./screens/Paywall";

const TAB_ROUTES = ["/home", "/duelle", "/freunde", "/profil"];

function LoadingScreen() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ font: "400 11px/1 'DM Mono',monospace", color: "rgba(243,234,218,.4)" }}>lädt…</div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuth();
  if (!ready) return <LoadingScreen />;
  if (!session) return <Navigate to="/" replace />;
  return <BackendGate>{children}</BackendGate>;
}

function RootRoute() {
  const { ready, session } = useAuth();
  if (!ready) return <LoadingScreen />;
  if (session) return <Navigate to="/home" replace />;
  return <Onboarding />;
}

function Shell() {
  const location = useLocation();
  const { profile } = useAuth();
  const showTabs = TAB_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="app-shell">
      {profile && <PushBanner />}
      <div className="app-shell__content hide-scrollbar">
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/konto" element={<Auth />} />
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/schaetzen" element={<RequireAuth><GuessFlow mode="week" /></RequireAuth>} />
          <Route path="/uebung" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/uebung/spielen" element={<RequireAuth><GuessFlow mode="practice" /></RequireAuth>} />
          <Route path="/duelle" element={<RequireAuth><Duels /></RequireAuth>} />
          <Route path="/duelle/:duelId" element={<RequireAuth><DuelDetail /></RequireAuth>} />
          <Route
            path="/duelle/:duelId/runde/:roundId"
            element={<RequireAuth><GuessFlow mode="duel" /></RequireAuth>}
          />
          <Route path="/freunde" element={<RequireAuth><Friends /></RequireAuth>} />
          <Route path="/profil" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/teilen" element={<RequireAuth><Share /></RequireAuth>} />
          <Route path="/plus" element={<RequireAuth><Paywall /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showTabs && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}
