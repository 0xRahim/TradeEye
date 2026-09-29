"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-store";

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const login = useAuth((s) => s.login);
  const loggingIn = useAuth((s) => s.loggingIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length === 0) {
      setError("Password is required.");
      return;
    }
    setError(null);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="login-title" className="text-base font-semibold">
            Log in to Tradeye
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login"
            className="rounded p-1 text-muted hover:bg-border/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Log in with your Tradeye account.</p>
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate={false}>
          <label className="block">
            <span className="text-xs text-muted">Email</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded border border-border bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-down">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingIn ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
