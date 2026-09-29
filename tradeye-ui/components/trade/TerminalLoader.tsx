"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-store";

const Terminal = dynamic(() => import("@/components/trade/Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted">Loading terminal…</p>
    </div>
  ),
});

export default function TerminalLoader() {
  const router = useRouter();
  const { token, ready, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (ready && !token) router.replace("/");
  }, [ready, token, router]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading terminal…</p>
      </div>
    );
  }

  return <Terminal />;
}
