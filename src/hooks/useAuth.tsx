import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { name: string; email: string | null; is_approved: boolean } | null;
  role: "admin" | "user" | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("name, email, is_approved").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (profileError) {
        console.warn("Profile fetch warning:", profileError.message);
        setProfile(null);
      } else {
        setProfile(profileData ?? null);
      }

      if (roleError) {
        console.warn("Role fetch warning:", roleError.message);
        setRole("user");
      } else {
        setRole((roleData?.role as "admin" | "user") || "user");
      }
    } catch (error) {
      console.error("Failed to hydrate user metadata:", error);
      setProfile(null);
      setRole("user");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const safeSetLoading = (value: boolean) => {
      if (isMounted) setLoading(value);
    };

    const safeHydrateUserMeta = (userId: string) => {
      setTimeout(() => {
        if (!isMounted) return;
        void fetchProfile(userId);
      }, 0);
    };

    const timeoutId = window.setTimeout(() => {
      safeSetLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        safeHydrateUserMeta(nextSession.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }

      safeSetLoading(false);
    });

    (async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          safeHydrateUserMeta(currentSession.user.id);
        }
      } catch (error) {
        console.error("Initial session load error:", error);
      } finally {
        clearTimeout(timeoutId);
        safeSetLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const isNetworkError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const normalized = message.toLowerCase();
      return normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("fetch");
    };

    const sdkAttempt = async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    };

    try {
      const firstAttempt = await sdkAttempt();
      if (!firstAttempt.error) return firstAttempt;

      if (!isNetworkError(firstAttempt.error)) {
        return firstAttempt;
      }

      await new Promise((resolve) => setTimeout(resolve, 450));

      const secondAttempt = await sdkAttempt();
      if (!secondAttempt.error || !isNetworkError(secondAttempt.error)) {
        return secondAttempt;
      }
    } catch (sdkError) {
      if (!isNetworkError(sdkError)) {
        return { error: sdkError };
      }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          error: new Error(
            payload?.msg || payload?.error_description || payload?.error || "Authentication failed"
          ),
        };
      }

      if (!payload?.access_token || !payload?.refresh_token) {
        return { error: new Error("Authentication succeeded but session data is incomplete") };
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });

      return { error: setSessionError };
    } catch (fallbackError) {
      return {
        error:
          fallbackError instanceof Error
            ? fallbackError
            : new Error("Authentication request failed before reaching backend"),
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
