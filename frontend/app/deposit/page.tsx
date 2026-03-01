"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useDeposit, useTxStatus, useUnlink } from "@unlink-xyz/react";
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

// Today's fixed deposit interest rate — to be filled in later
const TODAYS_RATE: number | null = null;

// TODO: Replace with the actual USDC token address on Monad testnet
const USDC_TOKEN = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000";

type DialogState = "confirm" | "loading" | "success" | "error";

export default function DepositPage() {
  const { activeAccount } = useUnlink();
  const { eoaAddress } = usePublicWallet();
  const { deposit, isPending, isError: isDepositError, error: depositError, reset: resetDeposit } = useDeposit();

  const [relayId, setRelayId] = useState<string | null>(null);
  const { state: txState, txHash: chainTxHash } = useTxStatus(relayId ?? "");

  const [amount, setAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("confirm");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync on-chain status → dialog state
  useEffect(() => {
    if (!relayId) return;
    if (txState === "succeeded") {
      setTxHash(chainTxHash ?? null);
      setDialogState("success");
    } else if (txState === "failed") {
      setErrorMessage("Transaction failed on-chain");
      setDialogState("error");
    }
  }, [txState, chainTxHash, relayId]);

  // Surface deposit hook errors
  useEffect(() => {
    if (isDepositError && depositError) {
      setErrorMessage((depositError as Error).message ?? "Deposit failed");
      setDialogState("error");
    }
  }, [isDepositError, depositError]);

  function openConfirm() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setDialogState("confirm");
    setTxHash(null);
    setErrorMessage(null);
    setRelayId(null);
    setDialogOpen(true);
  }

  async function handleAccept() {
    if (!eoaAddress) {
      setErrorMessage("Wallet not connected. Please connect your MetaMask or Phantom wallet first.");
      setDialogState("error");
      return;
    }
    if (!activeAccount) {
      setErrorMessage("Unlink private account not ready. Please wait a moment and try again.");
      setDialogState("error");
      return;
    }
    setDialogState("loading");
    resetDeposit();
    try {
      // USDC has 6 decimals
      const amountBigInt = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      const result = await deposit([{
        token: USDC_TOKEN,
        amount: amountBigInt,
        depositor: eoaAddress,
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

  const rateDisplay = TODAYS_RATE !== null ? `${TODAYS_RATE}% APY` : "TBD";
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
            Deposit
          </h2>
          <p className="text-muted-foreground text-base">
            Lend USDC to Tameio and earn a fixed return.
          </p>
        </div>

        {/* Rate badge */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Today&apos;s Rate
          </span>
          <span
            className="ml-auto text-base font-semibold"
            style={{
              background: "linear-gradient(160deg, #f9e97e 0%, #c8860a 22%, #f5d060 40%, #7a4a00 55%, #e8b84b 68%, #c8860a 80%, #f9e97e 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {rateDisplay}
          </span>
        </div>

        {/* Amount input */}
        <div className="space-y-2">
          <Label htmlFor="deposit-amount" className="text-base text-foreground">
            Amount (USDC)
          </Label>
          <div className="relative">
            <Input
              id="deposit-amount"
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

        <Button
          className="w-full h-16 text-lg font-semibold tracking-wide rounded-xl"
          size="lg"
          onClick={openConfirm}
          disabled={!amount || Number(amount) <= 0}
        >
          Review Deposit
        </Button>
      </div>

      {/* Confirmation / status dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          {/* ── Confirm ── */}
          {dialogState === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Deposit</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Review the details before signing the transaction.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
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
                  Deposit Confirmed
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your deposit was processed successfully.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground uppercase tracking-wider">
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
