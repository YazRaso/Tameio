"use client";

import { UnlinkProvider } from "@unlink-xyz/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UnlinkProvider chain="monad-testnet" autoSync={true}>
      {children}
    </UnlinkProvider>
  );
}
