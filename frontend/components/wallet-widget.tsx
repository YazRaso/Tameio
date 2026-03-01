"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePublicWallet } from "@/lib/public-wallet-context";

export function WalletWidget() {
  const { eoaAddress, connecting, connect, disconnect } = usePublicWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div className="fixed top-5 right-6 z-50 flex items-center">
      {!eoaAddress ? (
        /* ── Not connected ── */
        <Button
          size="sm"
          variant="outline"
          className="rounded-full h-9 px-5 text-xs font-medium tracking-wide backdrop-blur"
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
      ) : (
        /* ── Connected ── */
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-border bg-card/80 backdrop-blur px-4 py-2 text-xs font-mono text-foreground hover:bg-card transition-colors cursor-pointer"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {`${eoaAddress.slice(0, 6)}…${eoaAddress.slice(-4)}`}
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden"
              style={{ zIndex: 60 }}
            >
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  disconnect();
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-destructive hover:bg-muted/60 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
