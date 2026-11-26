import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api, { SESSION_ENDED_EVENT } from "@/api/axios";

export interface SportProfile {
  sport: string;
  position: string | null;
  experienceLevel: "beginner" | "intermediate" | "advanced" | "professional" | null;
}

export interface Privacy {
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showAge: boolean;
  discoverable: boolean;
  emailNotifications: boolean;
}

export interface Entitlements {
  plan: "free" | "premium";
  maxOwnedTeams: number | null; // null = unlimited
  advancedMatchmaking: boolean;
  maxSearchRadiusKm: number;
  advancedStats: boolean;
  profileBadge: boolean;
  bookingDiscountPct: number;
  canOrganizeTournaments: boolean;
}

export interface ArenaUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  phone?: string;
  photo?: string;
  location?: string;
  province?: string;
  district?: string;
  municipality?: string;
  hasGeo?: boolean;
  bio?: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  sportProfiles?: SportProfile[];
  sportPreferences?: string[];
  privacy?: Privacy;
  isPremium: boolean;
  membershipExpiresAt?: string | null;
  role: "player" | "admin";
  entitlements?: Entitlements;
  // Staff only. For showing the right screens; the server checks every action.
  isSuperAdmin?: boolean;
  permissions?: string[];
}

/** True when the signed-in user holds this staff permission (Super Admins hold all). */
export function can(user: ArenaUser | null, permission: string) {
  if (!user || user.role !== "admin") return false;
  return !!user.isSuperAdmin || !!user.permissions?.includes(permission);
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
  /** Revoke every session of this account (all devices), then sign out here. */
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Replace the stored token (e.g. after a password change) and reload the user. */
  setToken: (token: string) => Promise<void>;
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

  // The API client signals when the server ended this session.
  useEffect(() => {
    const onEnded = () => setUser(null);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
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

  async function logoutAll() {
    try {
      await api.post("/auth/logout-all");
    } finally {
      logout();
    }
  }

  async function setToken(token: string) {
    localStorage.setItem("arena_token", token);
    await refreshUser();
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, logoutAll, refreshUser, setToken }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
