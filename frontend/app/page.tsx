import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Eyebrow badge */}
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground tracking-wide">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Powered by Monad
        </span>

        {/* Wordmark */}
        <h1 className="text-8xl font-bold tracking-tight text-primary leading-none">
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
        <div className="flex gap-4 mt-4">
          <Button asChild size="lg" className="px-8 text-base h-12">
            <Link href="/deposit">Deposit</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8 text-base h-12">
            <Link href="/borrow">Borrow</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
