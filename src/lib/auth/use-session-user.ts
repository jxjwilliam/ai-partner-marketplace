"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/types";
import {
  apiFetch,
  clearClientToken,
} from "@/lib/auth/client-session";

type SessionState = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useSessionUser(): SessionState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me");
      if (res.status === 401) {
        clearClientToken();
        setUser(null);
        return;
      }
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as { user?: User | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // offline — still clear local state
    }
    clearClientToken();
    setUser(null);
  }, []);

  return { user, loading, refresh, logout };
}
