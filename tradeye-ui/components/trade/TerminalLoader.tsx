"use client";

import dynamic from "next/dynamic";

const Terminal = dynamic(() => import("@/components/trade/Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted">Loading terminal…</p>
    </div>
  ),
});

export default function TerminalLoader() {
  return <Terminal />;
}
