"use client";

import { useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { useKyc } from "@/lib/kyc-context";
import { ShieldCheck, FileText, ScanFace, ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PageState = "idle" | "loading" | "processing" | "success" | "error";

export default function KycPage() {
  const { kyc, setKycStatus } = useKyc();
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already verified in this session, show the success screen immediately
  const alreadyVerified = kyc.status === "verified";

  async function startVerification() {
    setPageState("loading");
    setErrorMessage(null);

    try {
      // 1. Create a VerificationSession on the server
      const res = await fetch("/api/create-verification-session", {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to start identity verification");
      }

      const { clientSecret, sessionId } = await res.json();

      // 2. Load Stripe.js and open the Identity modal
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe failed to load");

      setPageState("processing");
      setKycStatus("processing", sessionId);

      const { error } = await stripe.verifyIdentity(clientSecret);

      if (error) {
        throw new Error(error.message ?? "Verification was cancelled or failed");
      }

      // 3. Modal closed without error — verification submitted
      setKycStatus("verified", sessionId);
      setPageState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMessage(msg);
      setKycStatus("failed");
      setPageState("error");
    }
  }

  function retry() {
    setPageState("idle");
    setErrorMessage(null);
    setKycStatus("unverified");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Back link */}
      <div className="absolute top-8 left-8">
        <Link
          href="/landing"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="w-full max-w-md flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-3 text-center">
          <div
            className="mx-auto mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-border"
            style={{ background: "oklch(0.14 0.03 72 / 0.6)" }}
          >
            <ShieldCheck
              className="h-8 w-8"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, #f9e97e 0%, #c8860a 40%, #f5d060 70%, #e8b84b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Identity Verification
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            Tameio is regulated infrastructure. A one-time identity check is
            required before you can deposit or borrow.
          </p>
        </div>

        {/* Status card */}
        <div
          className="rounded-2xl border border-border p-6 flex flex-col gap-6"
          style={{ background: "oklch(0.11 0 0)" }}
        >
          {/* Success state */}
          {(alreadyVerified || pageState === "success") && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2
                className="h-14 w-14"
                style={{ color: "oklch(0.72 0.19 145)" }}
              />
              <div>
                <p className="font-semibold text-foreground text-lg">
                  Identity Verified
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Your government ID has been successfully verified. You can
                  now access all Tameio features.
                </p>
              </div>
              {kyc.verifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Verified on{" "}
                  {new Date(kyc.verifiedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
              <Button asChild className="mt-2 w-full h-12 rounded-xl font-semibold">
                <Link href="/">Go to Dashboard</Link>
              </Button>
            </div>
          )}

          {/* Error state */}
          {pageState === "error" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <XCircle className="h-14 w-14 text-destructive" />
              <div>
                <p className="font-semibold text-foreground text-lg">
                  Verification Failed
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {errorMessage ?? "Something went wrong. Please try again."}
                </p>
              </div>
              <Button
                onClick={retry}
                className="mt-2 w-full h-12 rounded-xl font-semibold"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Idle / loading / processing state */}
          {!alreadyVerified &&
            pageState !== "success" &&
            pageState !== "error" && (
              <>
                {/* Steps */}
                <ul className="flex flex-col gap-4">
                  {[
                    {
                      icon: FileText,
                      title: "Government-issued ID",
                      desc: "Passport, national ID card, or driver's licence",
                    },
                    {
                      icon: ScanFace,
                      title: "Selfie match",
                      desc: "A quick photo to confirm it's really you",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Encrypted & secure",
                      desc: "Processed by Stripe — Tameio never stores raw documents",
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <li key={title} className="flex items-start gap-4">
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border"
                        style={{ background: "oklch(0.14 0.03 72 / 0.5)" }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: "oklch(0.78 0.14 72)" }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="h-px bg-border" />

                {/* CTA */}
                <Button
                  onClick={startVerification}
                  disabled={pageState === "loading" || pageState === "processing"}
                  className="w-full h-12 rounded-xl font-semibold text-base"
                >
                  {pageState === "loading" && (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing…
                    </>
                  )}
                  {pageState === "processing" && (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verification in progress…
                    </>
                  )}
                  {pageState === "idle" && "Start Identity Check"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Powered by{" "}
                  <span className="font-medium text-foreground/70">
                    Stripe Identity
                  </span>{" "}
                  · Takes about 2 minutes
                </p>
              </>
            )}
        </div>
      </div>
    </main>
  );
}
