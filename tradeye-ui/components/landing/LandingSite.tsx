"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-store";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { CtaBand, Features, Footer, HowItWorks } from "./Sections";
import { LoginModal } from "./LoginModal";

export function LandingSite() {
  const [modalOpen, setModalOpen] = useState(false);
  const hydrate = useAuth((s) => s.hydrate);
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const openLogin = () => setModalOpen(true);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar onLoginClick={openLogin} />
      <main className="flex-1">
        <Hero onLoginClick={openLogin} />
        <Features />
        <HowItWorks onLoginClick={openLogin} />
        <CtaBand onLoginClick={openLogin} />
      </main>
      <Footer />
      {modalOpen && (
        <LoginModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            router.push("/trade");
          }}
        />
      )}
    </div>
  );
}
