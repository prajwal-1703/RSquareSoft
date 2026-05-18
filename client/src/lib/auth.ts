/**
 * PulseGrid AI — Auth State (SSR-safe, localStorage-based)
 */

import { authApi, setTokens, clearTokens } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "doctor" | "nurse" | "admin" | "lab_technician";
  department?: string;
}

type AuthListener = (user: AuthUser | null) => void;
const listeners = new Set<AuthListener>();

// ── SSR guard ─────────────────────────────────────────────────────
const isBrowser = typeof window !== "undefined";

function getStoredUser(): AuthUser | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem("pg_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: AuthUser | null) {
  if (!isBrowser) return;
  if (user) {
    localStorage.setItem("pg_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("pg_user");
  }
  listeners.forEach((fn) => fn(user));
}

export const auth = {
  getUser: getStoredUser,

  isLoggedIn(): boolean {
    if (!isBrowser) return false;
    return !!getStoredUser() && !!localStorage.getItem("pg_access_token");
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const result = await authApi.login(email, password);
    setTokens(result.data.accessToken, result.data.refreshToken);
    setStoredUser(result.data.user);
    return result.data.user;
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearTokens();
      setStoredUser(null);
    }
  },

  subscribe(fn: AuthListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Returns redirect path based on role */
  roleHomePath(role: AuthUser["role"]): string {
    switch (role) {
      case "admin": return "/admin";
      case "doctor": return "/icu";
      case "nurse": return "/icu";
      case "lab_technician": return "/ehr";
      default: return "/admin";
    }
  },
};
