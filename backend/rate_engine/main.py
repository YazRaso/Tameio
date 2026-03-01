"""
Tameio Rate Engine – FastAPI Service
-------------------------------------
Exposes the risk model as a lightweight HTTP API consumed by the Tameio
borrowing flow.  A GET request to /rate generates a random FICO score and
returns the personalised interest rate for that score.

Endpoints
  GET  /health  – liveness probe
  GET  /rate    – generate random FICO score and return interest rate
"""

import math
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from risk_model import calculate_interest_rate

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
