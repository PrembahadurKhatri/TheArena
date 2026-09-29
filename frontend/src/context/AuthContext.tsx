import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api from "@/api/axios";

export interface ArenaUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  location?: string;
  province?: string;
  isPremium: boolean;
  membershipExpiresAt?: string | null;
  role: "player" | "admin";
}

interface AuthContextValue {
  user: ArenaUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    location?: string;
    province?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ArenaUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = localStorage.getItem("arena_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      localStorage.removeItem("arena_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("arena_token", data.token);
    setUser(data.user);
  }

  async function register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    location?: string;
    province?: string;
  }) {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("arena_token", data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("arena_token");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
