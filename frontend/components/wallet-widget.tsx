"use client";

import { useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function WalletWidget() {
  const {
    ready,
    walletExists,
    activeAccount,
    busy,
    createWallet,
    createAccount,
  } = useUnlink();

  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreateWallet() {
    const result = await createWallet();
    setMnemonic(result.mnemonic);
    setShowMnemonicModal(true);
  }

  async function handleCreateAccount() {
    await createAccount();
  }

  function copyMnemonic() {
    if (mnemonic) {
      navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const address = activeAccount?.address as string | undefined;

  return (
    <>
      {/* Compact status pill — fixed top-right */}
      <div className="fixed top-5 right-6 z-50 flex items-center">
        {!ready ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-4 py-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
            Initializing
          </div>
        ) : !walletExists ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-9 px-5 text-xs font-medium tracking-wide border-border bg-card/80 backdrop-blur hover:bg-card"
            onClick={handleCreateWallet}
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                Creating…
              </span>
            ) : (
              "Set up Wallet"
            )}
          </Button>
        ) : !activeAccount ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-9 px-5 text-xs font-medium tracking-wide border-border bg-card/80 backdrop-blur hover:bg-card"
            onClick={handleCreateAccount}
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                Creating…
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-4 py-2 text-xs font-mono text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Connected"}
          </div>
        )}
      </div>

      {/* Recovery phrase modal */}
      <Dialog open={showMnemonicModal} onOpenChange={setShowMnemonicModal}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Your Recovery Phrase</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Write down or securely store these words. This is the{" "}
              <span className="text-foreground font-medium">only way</span> to
              recover your wallet if you lose access.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-mono text-sm leading-relaxed text-foreground break-words">
              {mnemonic}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 text-sm"
              onClick={copyMnemonic}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              size="lg"
              className="h-12 px-6 text-sm"
              onClick={() => {
                setShowMnemonicModal(false);
                setMnemonic(null);
              }}
            >
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
