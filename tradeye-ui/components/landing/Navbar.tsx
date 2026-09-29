"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/trade/ThemeToggle";
import { useAuth } from "@/components/auth/auth-store";
import { cx } from "@/components/trade/lib/cx";

export function Navbar({ onLoginClick }: { onLoginClick: () => void }) {
  const { token, email, ready, logout } = useAuth();
  const initial = (email ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Tradeye
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-5 text-sm text-muted sm:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <Link href="/trade" className="hover:text-foreground">
            Terminal
          </Link>
        </nav>
        <span className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {ready && token ? (
            <>
              <span
                title={email ?? ""}
                aria-label={`Logged in as ${email ?? ""}`}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
              >
                {initial}
              </span>
              <button
                type="button"
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="rounded p-1.5 text-muted hover:bg-border/50 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <Link
                href="/trade"
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Launch terminal
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onLoginClick}
                className={cx(
                  "rounded px-3 py-1.5 text-xs font-medium text-foreground",
                  "hover:bg-border/50",
                )}
              >
                Log in
              </button>
              <Link
                href="/trade"
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Launch terminal
              </Link>
            </>
          )}
        </span>
      </div>
    </header>
  );
}
