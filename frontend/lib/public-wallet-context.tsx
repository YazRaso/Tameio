"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Minimal EIP-1193 provider type
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

interface PublicWalletContextValue {
  eoaAddress: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const PublicWalletContext = createContext<PublicWalletContextValue>({
  eoaAddress: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export function PublicWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [eoaAddress, setEoaAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // On mount: passively check if wallet is already authorised (no prompt)
  useEffect(() => {
    const provider = getEthereum();
    if (!provider) return;

    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0) setEoaAddress(list[0]);
      })
      .catch(() => {});

    function handleAccountsChanged(...args: unknown[]) {
      const accounts = args[0] as string[];
      setEoaAddress(accounts.length > 0 ? accounts[0] : null);
    }

    provider.on("accountsChanged", handleAccountsChanged);
    return () => provider.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  const connect = useCallback(async () => {
    const provider = getEthereum();
    if (!provider) {
      alert(
        "No wallet extension detected. Please install MetaMask or Phantom and refresh."
      );
      return;
    }
    setConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const list = accounts as string[];
      if (list.length > 0) setEoaAddress(list[0]);
    } catch (err) {
      console.error("Wallet connection rejected:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setEoaAddress(null);
  }, []);

  return (
    <PublicWalletContext.Provider
      value={{ eoaAddress, connecting, connect, disconnect }}
    >
      {children}
    </PublicWalletContext.Provider>
  );
}

export function usePublicWallet() {
  return useContext(PublicWalletContext);
}
