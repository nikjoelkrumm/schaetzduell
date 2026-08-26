import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isBackendConfigured } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isGuest: boolean;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "name" | "push_opt_in">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isBackendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signUpWithPassword = useCallback(
    async (email: string, password: string, name: string) => {
      if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");

      // If we're already an anonymous guest, upgrade in place so the same
      // profile row (xp, streak, badges already earned) carries over —
      // this is what "lokaler Spielstand wird beim ersten Login übernommen"
      // means in practice with Supabase auth, rather than a data migration.
      if (session?.user.is_anonymous) {
        const { error } = await supabase.auth.updateUser({ email, password, data: { name } });
        if (error) throw error;
        await supabase.from("profiles").update({ name }).eq("id", session.user.id);
        await refreshProfile();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
    },
    [session, refreshProfile],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const continueAsGuest = useCallback(async () => {
    if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, "name" | "push_opt_in">>) => {
      if (!supabase || !session) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", session.user.id);
      if (error) throw error;
      await refreshProfile();
    },
    [session, refreshProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      profile,
      isGuest: Boolean(profile?.is_guest),
      signUpWithPassword,
      signInWithPassword,
      sendMagicLink,
      continueAsGuest,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [ready, session, profile, signUpWithPassword, signInWithPassword, sendMagicLink, continueAsGuest, signOut, refreshProfile, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
