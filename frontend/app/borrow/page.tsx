"use client";

import { useState } from "react";
import Link from "next/link";
import { usePublicWallet } from "@/lib/public-wallet-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const RATE_ENGINE_URL = "http://localhost:8000";

type DialogState = "confirm" | "loading" | "success" | "error";

export default function BorrowPage() {
  const { eoaAddress } = usePublicWallet();

  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [quoteRate, setQuoteRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("confirm");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("Processing…");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid =
    amount &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0 &&
    duration &&
    !isNaN(Number(duration)) &&
    Number(duration) > 0;

  async function openConfirm() {
    if (!isFormValid) return;

    setFetchingRate(true);
    let rate: number;
    try {
      // TODO: dummy value — replace RATE_ENGINE_URL with deployed host
      const res = await fetch(`${RATE_ENGINE_URL}/rate`);
      if (!res.ok) throw new Error(`Rate engine error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      rate = data.interest_rate_pct;
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch rate");
      setDialogState("error");
      setDialogOpen(true);
      setFetchingRate(false);
      return;
    } finally {
      setFetchingRate(false);
    }

    setQuoteRate(rate);
    setDialogState("confirm");
    setTxHash(null);
    setErrorMessage(null);
    setDialogOpen(true);
  }

  async function handleAccept() {
    if (!eoaAddress) {
      setErrorMessage("Wallet not connected. Please connect your MetaMask wallet first.");
      setDialogState("error");
      return;
    }
    setDialogState("loading");
    setIsSubmitting(true);
    try {
      const amountBigInt = parseTokenAmount(amount, 18);

      setLoadingStep("Requesting loan from Tameio…");
      const res = await fetch(`${RATE_ENGINE_URL}/borrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: eoaAddress,
          amount: amountBigInt.toString(),
          duration_days: parseInt(duration, 10),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errBody.detail ?? "Loan request failed");
      }

      const data = await res.json();
      setTxHash(data.tx_hash);
      if (typeof data.interest_rate_pct === "number") setQuoteRate(data.interest_rate_pct);

      setDialogState("success");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Transaction failed");
      setDialogState("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject() {
    setDialogOpen(false);
  }

  function copyHash() {
    if (txHash) navigator.clipboard.writeText(txHash);
  }

  const rateDisplay = quoteRate !== null ? `${quoteRate.toFixed(2)}% APR` : "—";
  const isProcessing = isSubmitting || dialogState === "loading";

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4">
      {/* Back link */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Page header */}
        <div className="space-y-1">
          <h2 className="text-5xl font-semibold tracking-tight text-foreground">
            Borrow
          </h2>
          <p className="text-muted-foreground text-base">
            Borrow USDC from Tameio. Your rate is calculated by our pricing
            engine.
          </p>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <Label htmlFor="borrow-amount" className="text-base text-foreground">
            Amount (USDC)
          </Label>
          <div className="relative">
            <Input
              id="borrow-amount"
              type="number"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-16 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              USDC
            </span>
          </div>
        </div>

        {/* Duration input */}
        <div className="space-y-2">
          <Label htmlFor="borrow-duration" className="text-base text-foreground">
            Duration
          </Label>
          <div className="relative">
            <Input
              id="borrow-duration"
              type="number"
              min="1"
              placeholder="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="pr-16 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              Days
            </span>
          </div>
        </div>

        <Button
          className="w-full h-16 text-lg font-semibold tracking-wide rounded-xl"
          size="lg"
          onClick={openConfirm}
          disabled={!isFormValid || fetchingRate}
        >
          {fetchingRate ? "Fetching rate…" : "Get Rate & Review"}
        </Button>
      </div>

      {/* Confirmation / status dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          {/* ── Confirm ── */}
          {dialogState === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Loan</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Review the terms before signing the transaction.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
                <Row label="Duration" value={`${duration} days`} />
                <Row label="Rate" value={rateDisplay} />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" size="lg" className="h-12 px-8 text-base" onClick={handleReject}>
                  Reject
                </Button>
                <Button size="lg" className="h-12 px-8 text-base" onClick={handleAccept} disabled={isProcessing}>
                  Accept &amp; Sign
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Loading ── */}
          {dialogState === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner />
              <p className="text-base text-muted-foreground">
                {loadingStep}
              </p>
            </div>
          )}

          {/* ── Success ── */}
          {dialogState === "success" && (
            <>
              <DialogHeader>
                <DialogTitle
                  style={{
                    background: "linear-gradient(160deg, #f9e97e 0%, #c8860a 22%, #f5d060 40%, #7a4a00 55%, #e8b84b 68%, #c8860a 80%, #f9e97e 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Loan Confirmed
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your loan was approved and funds are privately shielded in your Unlink balance.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
                <Row label="Duration" value={`${duration} days`} />
                <Row label="Rate" value={rateDisplay} />
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground uppercase tracking-wider">
                    Transaction Hash
                  </span>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <code className="flex-1 text-xs font-mono text-foreground">
                      {txHash ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : ""}
                    </code>
                    <button
                      onClick={copyHash}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <a
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm underline-offset-4 hover:underline"
                  style={{
                    background: "linear-gradient(160deg, #f9e97e 0%, #c8860a 22%, #f5d060 40%, #7a4a00 55%, #e8b84b 68%, #c8860a 80%, #f9e97e 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  View on Monad Explorer →
                </a>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-12 px-8 text-base"
                  onClick={() => {
                    setDialogOpen(false);
                    setAmount("");
                    setDuration("");
                    setQuoteRate(null);
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Error ── */}
          {dialogState === "error" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  Transaction Failed
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {errorMessage ?? "Something went wrong. Please try again."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" size="lg" className="h-12 px-8 text-base" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
                <Button size="lg" className="h-12 px-8 text-base" onClick={() => setDialogState("confirm")}>
                  Try Again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
  );
}

function parseTokenAmount(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = value.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  const multiplier = BigInt("1" + "0".repeat(decimals));
  return BigInt(whole) * multiplier + BigInt(fracPadded);
}
