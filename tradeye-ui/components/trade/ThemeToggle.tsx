"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "./theme-script";

function initialDark(): boolean {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  // Terminal page is client-only (ssr:false), so reading the DOM here is safe.
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  if (typeof document === "undefined") return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded p-1.5 text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export { initialDark };
