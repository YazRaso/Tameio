"use client";

import { useState } from "react";
import Link from "next/link";
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

type DialogState = "confirm" | "loading" | "success" | "error";

export default function BorrowPage() {
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(""); // in days
  const [quoteRate, setQuoteRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("confirm");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    try {
      // TODO: This endpoint is a dummy value — replace with real backend URL when available
      const res = await fetch("http://localhost:8000/get_rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          duration_days: Number(duration),
        }),
      });

      if (!res.ok) throw new Error("Rate engine returned an error");
      const data = await res.json();
      setQuoteRate(data.rate);
    } catch {
      // Fallback for dev: show dialog with a placeholder rate
      setQuoteRate(null);
    } finally {
      setFetchingRate(false);
    }

    setDialogState("confirm");
    setTxHash(null);
    setErrorMessage(null);
    setDialogOpen(true);
  }

  async function handleAccept() {
    setDialogState("loading");
    try {
      // Simulate wallet transaction prompt & confirmation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // TODO: Replace with actual wallet interaction (e.g. wagmi sendTransaction)
      const simulatedHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");

      setTxHash(simulatedHash);
      setDialogState("success");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Transaction failed"
      );
      setDialogState("error");
    }
  }

  function handleReject() {
    setDialogOpen(false);
  }

  function copyHash() {
    if (txHash) navigator.clipboard.writeText(txHash);
  }

  const rateDisplay =
    quoteRate !== null ? `${quoteRate}% APR` : "Pending quote";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
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
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Borrow
          </h2>
          <p className="text-muted-foreground text-sm">
            Borrow USDC from Tameio. Your rate is calculated by our pricing
            engine.
          </p>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <Label htmlFor="borrow-amount" className="text-sm text-foreground">
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              USDC
            </span>
          </div>
        </div>

        {/* Duration input */}
        <div className="space-y-2">
          <Label htmlFor="borrow-duration" className="text-sm text-foreground">
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              Days
            </span>
          </div>
        </div>

        <Button
          className="w-full"
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
                <Button variant="ghost" onClick={handleReject}>
                  Reject
                </Button>
                <Button onClick={handleAccept}>Accept &amp; Sign</Button>
              </DialogFooter>
            </>
          )}

          {/* ── Loading ── */}
          {dialogState === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner />
              <p className="text-sm text-muted-foreground">
                Waiting for wallet confirmation…
              </p>
            </div>
          )}

          {/* ── Success ── */}
          {dialogState === "success" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-primary">
                  Loan Confirmed
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your loan was approved and funds are on their way.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
                <Row label="Duration" value={`${duration} days`} />
                <Row label="Rate" value={rateDisplay} />
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Transaction Hash
                  </span>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <code className="flex-1 truncate text-xs font-mono text-foreground">
                      {txHash}
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
                  href={`https://explorer.monad.xyz/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-primary underline-offset-4 hover:underline"
                >
                  View on Monad Explorer →
                </a>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
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
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => setDialogState("confirm")}>
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
    <div className="flex items-center justify-between text-sm">
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
