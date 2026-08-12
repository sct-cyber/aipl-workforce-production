import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "aipl.remember";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url, is_active, must_change_password")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const signOut = async () => {
    try {
      localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.removeItem(REMEMBER_KEY);
    } catch {}
    await supabase.auth.signOut();
  };

  return {
    session,
    user,
    profile: profileQ.data,
    loading: loading || profileQ.isLoading,
    signOut,
  };
}

export { REMEMBER_KEY };
