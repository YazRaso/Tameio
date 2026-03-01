"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWithdraw, useTxStatus, useUnlink } from "@unlink-xyz/react";
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

// TODO: update port/base URL once the rate engine is deployed to a real host
const RATE_ENGINE_URL = "http://localhost:8000";

// Fail loudly at runtime if the env var is missing — sending to 0x000...000 is a burn address
const USDC_TOKEN = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
if (!USDC_TOKEN) throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set in .env.local");

type DialogState = "confirm" | "loading" | "success" | "error";

export default function BorrowPage() {
  const { activeAccount } = useUnlink();
  const { eoaAddress } = usePublicWallet();
  const { withdraw, isPending, isError: isWithdrawError, error: withdrawError, reset: resetWithdraw } = useWithdraw();

  const [relayId, setRelayId] = useState<string | null>(null);
  const { state: txState, txHash: chainTxHash, error: txError } = useTxStatus(relayId);

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

  // Sync Unlink relay status → dialog state
  useEffect(() => {
    if (!relayId) return;
    if (txState === "succeeded") {
      setTxHash(chainTxHash ?? null);
      setDialogState("success");
    } else if (txState === "reverted" || txState === "failed" || txState === "dead") {
      setErrorMessage(txError ?? `Transaction ${txState} on-chain`);
      setDialogState("error");
    }
  }, [txState, chainTxHash, txError, relayId]);

  // Surface withdraw hook errors
  useEffect(() => {
    if (isWithdrawError && withdrawError) {
      setErrorMessage((withdrawError as Error).message ?? "Withdrawal failed");
      setDialogState("error");
    }
  }, [isWithdrawError, withdrawError]);

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
    setRelayId(null);
    setDialogOpen(true);
  }

  async function handleAccept() {
    if (!eoaAddress) {
      setErrorMessage("Wallet not connected. Please connect your MetaMask wallet first.");
      setDialogState("error");
      return;
    }
    if (!activeAccount) {
      setErrorMessage("Unlink private account not ready. Please wait a moment and try again.");
      setDialogState("error");
      return;
    }
    setDialogState("loading");
    resetWithdraw();
    try {
      // USDCm on Monad testnet has 18 decimals (NOT 6 like mainnet USDC)
      const amountBigInt = parseTokenAmount(amount, 18);
      const result = await withdraw([{
        token: USDC_TOKEN,
        amount: amountBigInt,
        recipient: eoaAddress,
      }]);
      if (result?.relayId) {
        setRelayId(result.relayId);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Transaction failed");
      setDialogState("error");
    }
  }

  function handleReject() {
    setDialogOpen(false);
  }

  function copyHash() {
    if (txHash) navigator.clipboard.writeText(txHash);
  }

  const rateDisplay = quoteRate !== null ? `${quoteRate.toFixed(2)}% APR` : "—";
  const isProcessing = isPending || (!!relayId && dialogState === "loading");

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
                {isPending ? "Generating proof…" : "Waiting for on-chain confirmation…"}
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
                  Your loan was approved and funds are on their way.
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

// ── Token amount helpers ──────────────────────────────────────────────────────

/**
 * Parse a human-readable decimal string into a BigInt with `decimals` precision.
 * Avoids float arithmetic — "1.5" with decimals=18 → 1_500_000_000_000_000_000n
 */
function parseTokenAmount(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = value.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  // Build 10^decimals as a string to avoid BigInt literal / ** operator (requires ES2020+)
  const multiplier = BigInt("1" + "0".repeat(decimals));
  return BigInt(whole) * multiplier + BigInt(fracPadded);
}
