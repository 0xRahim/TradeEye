/**
 * Auth state backed by the Tradeye API (`POST /api/login`, see
 * `components/auth/api.ts`). Persists `{ token, refreshToken, email }` to
 * localStorage; the token is the Supabase `access_token`.
 */
"use client";

import { create } from "zustand";
import { loginRequest } from "./api";

export const AUTH_TOKEN_KEY = "tradeye-auth-token";

interface PersistedAuth {
  token: string;
  refreshToken?: string | null;
  email: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  email: string | null;
  /** True once localStorage has been read (avoids SSR mismatch flash). */
  ready: boolean;
  /** True while a login request is in flight. */
  loggingIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

function readPersisted(): PersistedAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
    if (typeof parsed.token === "string" && typeof parsed.email === "string") {
      return {
        token: parsed.token,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
        email: parsed.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()((set) => ({
  token: null,
  refreshToken: null,
  email: null,
  ready: false,
  loggingIn: false,
  login: async (email, password) => {
    set({ loggingIn: true });
    try {
      const result = await loginRequest(email, password);
      const auth: PersistedAuth = {
        token: result.accessToken,
        refreshToken: result.refreshToken,
        email: result.email,
      };
      try {
        window.localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(auth));
      } catch {
        // Storage blocked — session still counts as logged in.
      }
      set({
        token: auth.token,
        refreshToken: auth.refreshToken ?? null,
        email: auth.email,
        ready: true,
        loggingIn: false,
      });
    } catch (err) {
      set({ loggingIn: false });
      throw err instanceof Error ? err : new Error("Login failed. Try again.");
    }
  },
  logout: () => {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // Ignore storage errors on logout.
    }
    set({ token: null, refreshToken: null, email: null, ready: true });
  },
  hydrate: () => {
    const persisted = readPersisted();
    set(
      persisted
        ? {
            token: persisted.token,
            refreshToken: persisted.refreshToken ?? null,
            email: persisted.email,
            ready: true,
          }
        : { ready: true },
    );
  },
}));
