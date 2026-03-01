"""
Tameio Risk Model
-----------------
Converts a FICO credit score into a personalised lending interest rate.

Formula chain
  PD  = 1 / (1 + e^(a + b * score))   a=12, b=-0.016
  EL  = PD × LGD                       LGD=0.60
  Rate = Base Rate + EL + Profit Margin Base=2.0, Margin=0.5
"""

import math


# ── Constants ─────────────────────────────────────────────────────────────────

_A: float = 12.0        # logistic intercept
_B: float = -0.016      # logistic slope (negative → higher score → lower PD)
_LGD: float = 0.60      # Loss Given Default
_BASE_RATE: float = 4.0   # % floor rate — 10-year US Treasury yield
_PROFIT_MARGIN: float = 0.5  # % margin added on top


# ── Core function ─────────────────────────────────────────────────────────────

def calculate_interest_rate(fico_score: float) -> float:
    """
    Return the annualised interest rate (%) for a borrower with the given
    FICO score.

    Args:
        fico_score: Credit score in the standard FICO range (300–850).

    Returns:
        Interest rate as a percentage float, e.g. 4.27 means 4.27 %.
    """

    # Step 1 – Probability of Default (logistic / sigmoid function)
    # Negate the exponent so that a higher FICO score → smaller exponent value
    # → smaller PD → lower interest rate (correct real-world behaviour).
    pd: float = 1.0 / (1.0 + math.exp(-(_A + _B * fico_score)))

    # Step 2 – Expected Loss rate
    el_rate: float = pd * _LGD

    # Step 3 – Final interest rate
    interest_rate: float = _BASE_RATE + el_rate + _PROFIT_MARGIN

    return round(interest_rate, 6)
