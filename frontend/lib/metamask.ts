/**
 * MetaMask / EIP-1193 helpers.
 * Handles multi-wallet environments (MetaMask + Phantom) and
 * ensures the correct chain is active before sending transactions.
 */

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthereumProvider[];
}

// Monad Testnet chain parameters
const MONAD_TESTNET = {
  chainId: "0x279F", // 10143
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://monad-testnet.socialscan.io"],
};

/**
 * Returns the MetaMask provider.
 * Prefers the MetaMask entry from the providers array when multiple
 * wallets are installed (avoids Phantom hijacking window.ethereum).
 */
export function getMetaMask(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & { ethereum?: EthereumProvider };
  if (!win.ethereum) return null;

  if (win.ethereum.providers?.length) {
    const mm = win.ethereum.providers.find((p) => p.isMetaMask && !p.isPhantom);
    if (mm) return mm;
  }

  return win.ethereum;
}

/**
 * Ensures MetaMask is on Monad Testnet.
 * Tries wallet_switchEthereumChain first; if the chain is unknown,
 * falls back to wallet_addEthereumChain.
 */
export async function switchToMonad(provider: EthereumProvider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET.chainId }],
    });
  } catch (err: unknown) {
    // 4902 = chain not added to MetaMask yet
    if ((err as { code?: number }).code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_TESTNET],
      });
    } else {
      throw err;
    }
  }
}
