import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// ── Environment Variables ──────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
// Support both ENDPOINT_URL and ALCHEMY_ENDPOINT_URL; fall back to public RPC
const ALCHEMY_ENDPOINT_URL =
  process.env.ENDPOINT_URL ||
  process.env.ALCHEMY_ENDPOINT_URL ||
  "https://testnet-rpc.monad.xyz";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

// ── Hardhat Configuration ──────────────────────────────────────────────────
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      // Required for Monad – targets the Prague EVM fork for full opcode support
      evmVersion: "prague",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      metadata: {
        // Required for Sourcify/MonadVision contract verification
        bytecodeHash: "ipfs",
      },
    },
  },

  networks: {
    // ── Monad Testnet ──────────────────────────────────────────────────────
    monadTestnet: {
      url: ALCHEMY_ENDPOINT_URL,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
      chainId: 10143,
    },
    // ── Monad Mainnet ──────────────────────────────────────────────────────
    monadMainnet: {
      url: "https://rpc.monad.xyz",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
      chainId: 143,
    },
  },

  // ── Contract Verification ──────────────────────────────────────────────
  sourcify: {
    enabled: true,
    // Monad-specific Sourcify API (BlockVision)
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadvision.com",
  },

  etherscan: {
    enabled: true,
    apiKey: {
      monadTestnet: ALCHEMY_API_KEY,
      monadMainnet: ALCHEMY_API_KEY,
    },
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=10143",
          browserURL: "https://testnet.monadscan.com",
        },
      },
      {
        network: "monadMainnet",
        chainId: 143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=143",
          browserURL: "https://monadscan.com",
        },
      },
    ],
  },
};

export default config;
