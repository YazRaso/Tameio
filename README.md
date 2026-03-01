# Tameio — The Bank of Tomorrow

Tameio is a proof-of-concept onchain banking system built on **Monad** and **Unlink**, demonstrating how a modern financial system can be built using blockchain technology and stablecoins (USDC).

## Why Blockchain Banking?

Traditional blockchains fall short of what a real banking system demands:

| Requirement        | Ethereum   | **Monad + Unlink**       |
| ------------------ | ---------- | ------------------------ |
| Throughput         | ~15–30 TPS | **10,000 TPS**           |
| Financial Privacy  | Limited    | **Banker-grade secrecy** |
| Block Confirmation | Slow       | **Rapid**                |

## What Tameio Does

Tameio offers two core financial primitives:

### Deposit (Lending)

Users deposit stablecoins into Tameio at a **fixed, pre-determined interest rate**. On success, the funds are withdrawn from the user's wallet and the transaction hash is returned.

### Borrow

Users borrow stablecoins from Tameio for a chosen amount and duration. Loan requests are evaluated by a **rate engine** that determines approval and the applicable interest rate. On success, funds are deposited into the user's wallet and the transaction hash is returned.

## Project Structure

```
tameio/
├── frontend/        # Next.js app — landing, deposit, and borrow pages
├── backend/         # Hardhat — Solidity smart contracts (TameioVault)
│   └── rate_engine/ # Python — loan approval & rate calculation engine
└── ml/              # ML model training for risk scoring
```

## Tech Stack

- **Frontend** — Next.js, Tailwind CSS, shadcn/ui
- **Smart Contracts** — Solidity, Hardhat, deployed on Monad
- **Rate Engine** — Python, FastAPI
- **Privacy Layer** — Unlink
- **Stablecoin** — USDC
