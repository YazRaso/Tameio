"""
Tameio Rate Engine – FastAPI Service
-------------------------------------
Exposes the risk model as a lightweight HTTP API consumed by the Tameio
borrowing flow.  A GET request to /rate generates a random FICO score and
returns the personalised interest rate for that score.

A POST to /borrow approves the loan, calls releaseToBorrower on TameioVault
using the owner private key, and returns the on-chain transaction hash.

Endpoints
  GET  /health  – liveness probe
  GET  /rate    – generate random FICO score and return interest rate
  POST /borrow  – approve loan and disburse USDC via TameioVault
"""

import json
import math
import os
import random
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from web3 import Web3

from risk_model import calculate_interest_rate

# ── Environment ───────────────────────────────────────────────────────────────

# Load from backend/.env (one directory up from rate_engine/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

ENDPOINT_URL: str = os.environ.get("ENDPOINT_URL", "https://testnet-rpc.monad.xyz")
PRIVATE_KEY: str = os.environ.get("PRIVATE_KEY", "")
VAULT_ADDRESS: str = os.environ.get("VAULT_ADDRESS", "")

# ── TameioVault ABI (load from Hardhat artifacts) ─────────────────────────────

_ABI_PATH = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
    / "contracts"
    / "TameioVault.sol"
    / "TameioVault.json"
)
with _ABI_PATH.open() as _f:
    _VAULT_ABI = json.load(_f)["abi"]

# ── App bootstrap ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Tameio Rate Engine",
    description="Risk-based interest rate calculator for the Tameio crypto lending platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RateResponse(BaseModel):
    fico_score: float
    probability_of_default: float = Field(description="PD as a decimal, e.g. 0.042")
    expected_loss_rate: float = Field(description="EL rate as a decimal")
    interest_rate_pct: float = Field(description="Final annualised interest rate in %")
    message: str


class BorrowRequest(BaseModel):
    borrower: str = Field(description="Borrower's EOA address (0x…)")
    amount: str = Field(description="Loan amount in USDCm base units (18 decimals) as a string, e.g. '1000000000000000000' = 1 USDCm")
    duration_days: int = Field(description="Loan duration in days")
    # Private disbursement via Unlink pool (optional — falls back to direct EOA transfer)
    pool_address: Optional[str] = Field(default=None, description="Unlink pool address for vault→pool direct deposit")
    pool_calldata: Optional[str] = Field(default=None, description="Hex-encoded pool.deposit(...) calldata with ZK note commitments")


class BorrowResponse(BaseModel):
    tx_hash: str = Field(description="On-chain transaction hash of the release call")
    interest_rate_pct: float = Field(description="Approved annualised interest rate in %")
    fico_score: float
    private: bool = Field(description="True if funds were routed vault→Unlink pool (no EOA exposure)")
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_vault():
    """Return an initialised Web3 contract instance for TameioVault."""
    if not VAULT_ADDRESS:
        raise HTTPException(status_code=500, detail="VAULT_ADDRESS is not configured on the server.")
    if not PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="PRIVATE_KEY is not configured on the server.")

    w3 = Web3(Web3.HTTPProvider(ENDPOINT_URL))
    if not w3.is_connected():
        raise HTTPException(status_code=503, detail="Cannot connect to Monad RPC endpoint.")

    checksum_address = Web3.to_checksum_address(VAULT_ADDRESS)
    contract = w3.eth.contract(address=checksum_address, abi=_VAULT_ABI)
    return w3, contract


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
def health_check():
    """Liveness probe – confirms the service is running."""
    return {"status": "ok", "service": "tameio-rate-engine"}


@app.get("/rate", response_model=RateResponse, tags=["Rate"])
def get_interest_rate():
    """
    Calculate the personalised interest rate for a borrower.

    Generates a random FICO score (300–850), converts it to a Probability of
    Default (PD) via a logistic function, computes Expected Loss (EL = PD × LGD),
    and returns Base Rate + EL + Profit Margin as the final rate.
    """
    score = float(random.randint(300, 850))
    rate = calculate_interest_rate(score)

    pd = 1.0 / (1.0 + math.exp(-(12.0 + (-0.016) * score)))
    el = pd * 0.60

    return RateResponse(
        fico_score=score,
        probability_of_default=round(pd, 6),
        expected_loss_rate=round(el, 6),
        interest_rate_pct=rate,
        message=f"Approved. Your personalised rate is {rate:.2f}%",
    )


@app.post("/borrow", response_model=BorrowResponse, tags=["Borrow"])
def execute_borrow(req: BorrowRequest):
    """
    Approve a loan request and disburse USDC to the borrower.

    1. Generates a FICO-based interest rate.
    2. Calls releaseToBorrower(borrower, amount) on TameioVault using the
       owner private key held server-side.
    3. Returns the on-chain tx hash for the frontend to display.

    The vault must hold sufficient USDC before this endpoint is called.
    """
    try:
        amount_int = int(req.amount)
    except ValueError:
        raise HTTPException(status_code=400, detail="amount must be a valid integer string")
    if amount_int <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")

    # ── Rate calculation ──────────────────────────────────────────────────
    score = float(random.randint(300, 850))
    rate = calculate_interest_rate(score)

    # ── On-chain disbursement ─────────────────────────────────────────────
    w3, vault = _get_vault()

    # Normalise private key format
    pk = PRIVATE_KEY if PRIVATE_KEY.startswith("0x") else "0x" + PRIVATE_KEY
    owner_account = w3.eth.account.from_key(pk)

    try:
        borrower_checksum = Web3.to_checksum_address(req.borrower)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid borrower address: {req.borrower}")

    try:
        nonce = w3.eth.get_transaction_count(owner_account.address)

        use_private = bool(req.pool_address and req.pool_calldata)

        if use_private:
            # ── Private path: vault → Unlink pool directly, zero EOA exposure ──
            pool_addr = Web3.to_checksum_address(req.pool_address)
            # Accept calldata as hex string with or without 0x prefix
            calldata_bytes = bytes.fromhex(req.pool_calldata.removeprefix("0x"))

            fn = vault.functions.releaseToBorrowerPrivate(
                borrower_checksum, amount_int, pool_addr, calldata_bytes
            )

            # Dry-run first — surfaces revert reason before wasting a tx.
            try:
                fn.call({"from": owner_account.address})
            except Exception as sim_exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Simulation failed (revert reason): {sim_exc}",
                ) from sim_exc

            try:
                estimated = fn.estimate_gas({"from": owner_account.address})
                # ZK proof verification is expensive; pad generously.
                gas_limit = int(estimated * 1.8)
            except Exception:
                gas_limit = 2_000_000  # ZK proof + approve + pool call

            tx = fn.build_transaction({
                "from": owner_account.address,
                "nonce": nonce,
                "gas": gas_limit,
                "gasPrice": w3.eth.gas_price,
                "chainId": 10143,
            })
        else:
            # ── Legacy path: vault → borrower EOA (backward compat) ──────────
            fn_legacy = vault.functions.releaseToBorrower(borrower_checksum, amount_int)

            # Dry-run first.
            try:
                fn_legacy.call({"from": owner_account.address})
            except Exception as sim_exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Simulation failed (revert reason): {sim_exc}",
                ) from sim_exc

            try:
                estimated = fn_legacy.estimate_gas({"from": owner_account.address})
                gas_limit = int(estimated * 1.6)
            except Exception:
                gas_limit = 400_000

            tx = fn_legacy.build_transaction({
                "from": owner_account.address,
                "nonce": nonce,
                "gas": gas_limit,
                "gasPrice": w3.eth.gas_price,
                "chainId": 10143,
            })

        signed = owner_account.sign_transaction(tx)
        raw_tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash = w3.to_hex(raw_tx_hash)  # always 0x-prefixed
        receipt = w3.eth.wait_for_transaction_receipt(raw_tx_hash, timeout=60)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"On-chain transaction failed: {exc}") from exc

    if receipt.status != 1:
        raise HTTPException(
            status_code=500,
            detail=f"Transaction reverted on-chain. Hash: {tx_hash}",
        )

    return BorrowResponse(
        tx_hash=tx_hash,
        interest_rate_pct=rate,
        fico_score=score,
        private=use_private,
        message=f"Loan of {amount_int / 10**18:.4f} USDCm disbursed {'privately via Unlink' if use_private else 'to EOA'} at {rate:.2f}% APR.",
    )
