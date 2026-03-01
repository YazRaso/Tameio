"use client";

import { useState } from "react";
import Link from "next/link";
import { useDeposit, useUnlink, useTxStatus, useInteract, approve, toCall } from "@unlink-xyz/react";
import { usePublicWallet } from "@/lib/public-wallet-context";
import { getMetaMask, switchToMonad, waitForReceipt, watchUSDCToken } from "@/lib/metamask";
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

// Today's fixed deposit interest rate
const TODAYS_RATE: number = 2;

const USDC_TOKEN = process.env.NEXT_PUBLIC_USDC_ADDRESS as string;
if (!USDC_TOKEN) throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set in .env.local");

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as string;
if (!VAULT_ADDRESS) throw new Error("NEXT_PUBLIC_VAULT_ADDRESS is not set in .env.local");

type DialogState = "confirm" | "loading" | "success" | "error";

export default function DepositPage() {
  const { eoaAddress } = usePublicWallet();
  const { walletExists, activeAccount, createWallet, createAccount, ready, waitForConfirmation } = useUnlink();
  const { deposit: prepareDeposit } = useDeposit();
  const { interact: interactFn } = useInteract();

  const [amount, setAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>("confirm");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [relayId, setRelayId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("Processing…");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { state: relayState } = useTxStatus(relayId);

  function openConfirm() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setDialogState("confirm");
    setTxHash(null);
    setRelayId(null);
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

      const provider = getMetaMask();
      if (!provider) throw new Error("MetaMask not found. Please install MetaMask.");

      await switchToMonad(provider);

      // ── Unlink wallet setup ──────────────────────────────────────────────
      if (ready && !walletExists) await createWallet();
      if (ready && !activeAccount) await createAccount();

      // ── Step 1: prepare the Unlink deposit (generates ZK proof) ─────────
      setLoadingStep("Generating ZK proof for deposit…");
      const result = await prepareDeposit([
        { token: USDC_TOKEN, amount: amountBigInt, depositor: eoaAddress },
      ]) as { to: string; calldata: string; value: bigint; relayId: string };

      // ── Step 2: approve Unlink pool to pull USDC from the user's wallet ──
      setLoadingStep("Awaiting approval signature in MetaMask (1/2)…");
      const approveData = buildApproveCalldata(result.to, amountBigInt);
      const approveHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: eoaAddress, to: USDC_TOKEN, data: approveData }],
      }) as string;

      const approveReceipt = await waitForReceipt(provider, approveHash);
      if (approveReceipt.status === "0x0") {
        throw new Error("USDC approval was reverted on-chain. Please try again.");
      }

      // ── Step 3: submit the Unlink deposit transaction ────────────────────
      setLoadingStep("Awaiting deposit signature in MetaMask (2/2)…");
      const depositHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: eoaAddress,
          to: result.to,
          data: result.calldata,
          value: "0x0",  // ERC-20 deposit — no ETH value
        }],
      }) as string;

      const depositReceipt = await waitForReceipt(provider, depositHash);
      if (depositReceipt.status === "0x0") {
        throw new Error("Deposit transaction was reverted on-chain.");
      }

      setTxHash(depositHash);

      // ── Step 4: wait for Unlink relay to credit the pool balance ─────────
      // The relay watches the chain, detects the deposit TX, and updates the
      // user's private note balance. We must wait before calling interact.
      setLoadingStep("Waiting for Unlink relay to credit pool balance…");
      await waitForConfirmation(result.relayId, { timeout: 120_000 });

      // ── Step 5: interact — atomically spend from pool → TameioVault ─────
      // The adapter unshields amountBigInt USDC, executes:
      //   1. approve(TameioVault, amount)
      //   2. vault.deposit(amount)  ← vault pulls via transferFrom
      // receive minAmount=0n: vault consumed all USDC so nothing reshields back.
      setLoadingStep("Bridging funds into TameioVault via private relay…");
      const approveVaultCall = approve(USDC_TOKEN, VAULT_ADDRESS, amountBigInt);
      const vaultDepositCall = toCall({
        to: VAULT_ADDRESS,
        data: buildDepositCalldata(amountBigInt),
      });
      const interactResult = await interactFn({
        spend: [{ token: USDC_TOKEN, amount: amountBigInt }],
        calls: [approveVaultCall, vaultDepositCall],
        receive: [{ token: USDC_TOKEN, minAmount: 0n }],
      }) as { relayId: string };

      setRelayId(interactResult.relayId);
      setDialogState("success");
      watchUSDCToken(provider);
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

  const rateDisplay = TODAYS_RATE !== null ? `${TODAYS_RATE}% APY` : "TBD";
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
            Deposit
          </h2>
          <p className="text-muted-foreground text-base">
            Lend USDC to Tameio and earn a fixed return.
          </p>
        </div>

        {/* Rate display */}
        <div className="space-y-1 text-center">
          <h2
            className="text-8xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(160deg, #f9e97e 0%, #c8860a 22%, #f5d060 40%, #7a4a00 55%, #e8b84b 68%, #c8860a 80%, #f9e97e 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {TODAYS_RATE !== null ? `${TODAYS_RATE}%` : "TBD"}
          </h2>
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Deposit Rate
          </p>
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
                  Deposit Confirmed
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your USDC was privately deposited into the Unlink pool.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Row label="Amount" value={`${amount} USDC`} />
                {relayState && (
                  <Row label="Relay Status" value={relayState} />
                )}
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
                  href={`https://monad-testnet.socialscan.io/tx/${txHash}`}
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

// ── Token amount helpers ─────────────────────────────────────────────────────

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

/**
 * ABI-encode an ERC-20 approve(address,uint256) call without ethers.
 * selector = keccak256("approve(address,uint256)")[0:4] = 0x095ea7b3
 */
function buildApproveCalldata(spender: string, amount: bigint): string {
  const sel = "095ea7b3";
  const addr = spender.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  const amt = amount.toString(16).padStart(64, "0");
  return `0x${sel}${addr}${amt}`;
}

/**
 * ABI-encode a TameioVault deposit(uint256) call.
 * selector = keccak256("deposit(uint256)")[0:4] = 0xb6b55f25
 * Used by the useInteract adapter call (step 5 — pool → vault).
 */
function buildDepositCalldata(amount: bigint): string {
  const sel = "b6b55f25";
  const amt = amount.toString(16).padStart(64, "0");
  return `0x${sel}${amt}`;
}

