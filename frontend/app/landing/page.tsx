import Link from "next/link";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    label: "Scalability",
    headline: "10,000 TPS — the floor, not the ceiling.",
    body: "Traditional banking infrastructure processes tens of thousands of transactions per second. Ethereum, the most widely adopted smart-contract chain, tops out at roughly 12–13 TPS in practice — 120 in theory. That gap has made on-chain banking a thought experiment, not a product. Monad changes the arithmetic.",
  },
  {
    label: "Regulation",
    headline: "Policy has finally caught up.",
    body: "The regulatory fog that surrounded digital assets for a decade is lifting. The GENIUS Act in the United States and Canada's Stablecoin Framework are the clearest signals yet that governments are ready to define — and legitimise — stablecoin-based financial products. Tameio is built for the world that's coming.",
  },
  {
    label: "Privacy",
    headline: "A public ledger is not a banking system.",
    body: "On a transparent blockchain, any counterparty can trace your entire financial history to a single address. That isn't just commercially unacceptable — it directly conflicts with the financial-privacy protections enshrined in the Gramm–Leach–Bliley Act and the principle of banker's secrecy. Unlink's privacy layer closes that gap.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-24">
      {/* ── Page heading ── */}
      <div className="w-full max-w-5xl text-center mb-16">
        <p
          className="text-xs uppercase tracking-[0.25em] font-medium mb-4"
          style={{ color: "oklch(0.78 0.14 72)" }}
        >
          Why Tameio
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
          The case for on-chain banking
        </h2>
      </div>

      {/* ── Hero card ── */}
      <div className="w-full max-w-5xl mb-6">
        <div
          className="relative rounded-2xl p-10 sm:p-14 overflow-hidden transition-transform duration-300 hover:-translate-y-1.5"
          style={{
            background: "oklch(0.11 0 0)",
            border: "1px solid oklch(0.78 0.14 72 / 0.25)",
          }}
        >
          {/* Subtle ambient glow in the card */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              right: "-10%",
              width: 480,
              height: 480,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, oklch(0.78 0.14 72 / 0.08) 0%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />

          <div className="relative z-10 max-w-3xl">
            <span
              className="inline-block text-xs uppercase tracking-[0.2em] font-semibold mb-6 px-3 py-1 rounded-full"
              style={{
                color: "oklch(0.78 0.14 72)",
                background: "oklch(0.78 0.14 72 / 0.08)",
                border: "1px solid oklch(0.78 0.14 72 / 0.2)",
              }}
            >
              The inflection point
            </span>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-6 leading-snug">
              A lot has changed in the last few months.
            </h3>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Historically, blockchains have not had the ability to scale and
              support banking-grade systems. Throughput was too low, regulation
              was ambiguous, and financial privacy on a public ledger was
              structurally impossible. Those three obstacles kept on-chain
              banking in the domain of whitepapers.
            </p>

            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              That's no longer true. Monad delivers 10,000 TPS with sub-second
              finality. Stablecoin legislation is being signed into law. And
              privacy-preserving infrastructure has matured enough to meet
              regulatory requirements. Tameio exists because the conditions for
              a real on-chain bank finally do.
            </p>
          </div>
        </div>
      </div>

      {/* ── Three pillar cards ── */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-5 mb-20">
        {pillars.map((pillar) => (
          <div
            key={pillar.label}
            className="rounded-2xl p-8 flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-1.5"
            style={{
              background: "oklch(0.11 0 0)",
              border: "1px solid oklch(0.78 0.14 72 / 0.25)",
            }}
          >
            <span
              className="text-xs uppercase tracking-[0.2em] font-semibold"
              style={{ color: "oklch(0.78 0.14 72)" }}
            >
              {pillar.label}
            </span>

            <h4 className="text-xl font-semibold text-foreground leading-snug">
              {pillar.headline}
            </h4>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {pillar.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground text-sm max-w-sm">
          Ready to experience the bank of tomorrow?
        </p>
        <Button
          asChild
          size="lg"
          className="px-16 text-lg h-14 rounded-xl font-semibold tracking-wide"
        >
          <Link href="/kyc">Get started</Link>
        </Button>
      </div>
    </main>
  );
}
