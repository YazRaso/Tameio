"use client";

import { UnlinkProvider } from "@unlink-xyz/react";
import { KycProvider } from "@/lib/kyc-context";
import { PublicWalletProvider } from "@/lib/public-wallet-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PublicWalletProvider>
      <UnlinkProvider chain="monad-testnet" autoSync={true}>
        <KycProvider>
          {children}
        </KycProvider>
      </UnlinkProvider>
    </PublicWalletProvider>
  );
}

