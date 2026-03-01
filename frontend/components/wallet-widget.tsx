"use client";

import { useRef, useEffect, useState } from "react";
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
import { usePublicWallet } from "@/lib/public-wallet-context";

export function WalletWidget() {
  const { eoaAddress, connecting, connect, disconnect } = usePublicWallet();
  const {
    ready,
    walletExists,
    activeAccount,
    busy,
    createWallet,
    createAccount,
    clearWallet,
  } = useUnlink();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleActivate() {
    setSettingUp(true);
    try {
      if (!walletExists) {
        const result = await createWallet();
        setMnemonic(result.mnemonic);
        setShowMnemonicModal(true);
      } else {
        await createAccount();
      }
    } finally {
      setSettingUp(false);
    }
  }

  async function handleDisconnect() {
    setDropdownOpen(false);
    await clearWallet();
    disconnect();
  }

  function copyMnemonic() {
    if (mnemonic) {
      navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ── Step 1: MetaMask not connected ──────────────────────────────────────
  if (!eoaAddress) {
    return (
      <div className="fixed top-5 right-6 z-50">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full h-9 px-5 text-xs font-medium tracking-wide border-border bg-card/80 backdrop-blur hover:bg-card"
          onClick={connect}
          disabled={connecting}
        >
          {connecting ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
              Connecting…
            </span>
          ) : (
            "Connect Wallet"
          )}
        </Button>
      </div>
    );
  }

  // ── Step 2: MetaMask connected, Unlink private account not ready ─────────
  if (!ready || !activeAccount) {
    const isWorking = busy || settingUp || !ready;
    return (
      <>
        <div className="fixed top-5 right-6 z-50 flex items-center gap-2">
          {/* Dim address pill to show partial state */}
          <span className="rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5 text-xs font-mono text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5 align-middle" />
            {`${eoaAddress.slice(0, 6)}…${eoaAddress.slice(-4)}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-9 px-4 text-xs font-medium tracking-wide border-border bg-card/80 backdrop-blur hover:bg-card"
            onClick={handleActivate}
            disabled={isWorking}
          >
            {isWorking ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                Setting up…
              </span>
            ) : (
              "Activate"
            )}
          </Button>
        </div>

        {/* Recovery phrase modal */}
        <Dialog open={showMnemonicModal} onOpenChange={setShowMnemonicModal}>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save Your Recovery Phrase</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Write down these words somewhere safe. This is the{" "}
                <span className="text-foreground font-medium">only way</span> to
                recover your private account.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-mono text-sm leading-relaxed text-foreground break-words">
                {mnemonic}
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="lg" className="h-12 px-6 text-sm" onClick={copyMnemonic}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button size="lg" className="h-12 px-6 text-sm" onClick={() => { setShowMnemonicModal(false); setMnemonic(null); }}>
                I&apos;ve saved it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── Step 3: Fully connected ──────────────────────────────────────────────
  return (
    <>
      <div className="fixed top-5 right-6 z-50" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-4 py-2 text-xs font-mono text-foreground hover:bg-card transition-colors cursor-pointer"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {`${eoaAddress.slice(0, 6)}…${eoaAddress.slice(-4)}`}
        </button>

        {dropdownOpen && (
          <div
            className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden"
            style={{ zIndex: 60 }}
          >
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="w-full px-4 py-2.5 text-left text-xs text-destructive hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </>
  );
}

