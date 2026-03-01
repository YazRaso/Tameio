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
 * Polls eth_getTransactionReceipt until the transaction is mined.
 * Resolves with the receipt, or throws if it reverts or times out (~3 min).
 */
export async function waitForReceipt(
  provider: EthereumProvider,
  txHash: string,
  intervalMs = 2000,
  maxAttempts = 90,
): Promise<{ status: string; transactionHash: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status: string; transactionHash: string } | null;

    if (receipt !== null) return receipt;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for transaction confirmation.");
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

/**
 * Registers USDCm as a watched token in MetaMask so its balance appears
 * in the wallet's token list. Safe to call multiple times — MetaMask is a no-op
 * if the token is already tracked.
 */
export async function watchUSDCToken(provider: EthereumProvider): Promise<void> {
  const address = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!address) return;
  try {
    await provider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address,
          symbol: "USDCm",
          decimals: 18,
          // No image URL needed — MetaMask will show a generic token icon
        },
      } as unknown as unknown[],
    });
  } catch {
    // Non-fatal — user may have dismissed the prompt; balance tracking is optional
  }
}
