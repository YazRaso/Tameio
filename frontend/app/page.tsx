"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useKyc } from "@/lib/kyc-context";

export default function Home() {
  const { kyc } = useKyc();
  const router = useRouter();

  useEffect(() => {
    if (kyc.status !== "verified") {
      router.replace("/landing");
    }
  }, [kyc.status, router]);

  if (kyc.status !== "verified") return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Ambient glow behind wordmark */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 520,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(200,134,10,0.18) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
        {/* Eyebrow badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground tracking-wide">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Powered by Monad
        </span>

        {/* Wordmark */}
        <h1
          className="text-8xl font-bold tracking-tight leading-none"
          style={{
            background: "linear-gradient(160deg, #f9e97e 0%, #c8860a 22%, #f5d060 40%, #7a4a00 55%, #e8b84b 68%, #c8860a 80%, #f9e97e 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Tameio
        </h1>

        {/* Subtext — bumped up significantly */}
        <p className="text-2xl font-light text-foreground/80 max-w-lg leading-snug">
          The bank of tomorrow —{" "}
          <span className="text-foreground font-normal">
            decentralized lending &amp; borrowing
          </span>{" "}
          on-chain.
        </p>

        {/* CTAs */}
        <div className="flex gap-6 mt-6">
          <Button asChild size="lg" className="px-14 text-lg h-16 rounded-xl font-semibold tracking-wide">
            <Link href="/deposit">Deposit</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="px-14 text-lg h-16 rounded-xl font-semibold tracking-wide"
          >
            <Link href="/borrow">Borrow</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
