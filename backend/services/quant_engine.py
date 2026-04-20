"""
Quantitative engine: price fetching, portfolio metrics, XIRR, and Beta.
"""

from datetime import date, timedelta
from typing import Optional
import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import brentq


# ---------------------------------------------------------------------------
# 1. Price data
# ---------------------------------------------------------------------------

def fetch_price_history(
    ticker: str,
    period: str = "1y",
    interval: str = "1d",
) -> pd.DataFrame:
    """Return OHLCV DataFrame from yfinance for the given ticker and period."""
    data = yf.download(ticker, period=period, interval=interval, auto_adjust=True, progress=False)
    if data.empty:
        raise ValueError(f"No price data returned for ticker '{ticker}'")
    return data


def get_latest_price(ticker: str) -> float:
    """Return the most recent closing price for a ticker."""
    hist = fetch_price_history(ticker, period="5d")
    return float(hist["Close"].dropna().iloc[-1].item())


def get_usd_to_inr() -> float:
    """Fetch live USD→INR rate. Falls back to 84.0 if unavailable."""
    try:
        hist = yf.download("USDINR=X", period="2d", interval="1d", auto_adjust=True, progress=False)
        if not hist.empty:
            return float(hist["Close"].dropna().iloc[-1].item())
    except Exception:
        pass
    return 84.0


# Cache the rate per process lifetime to avoid repeated fetches within one request cycle
_fx_cache: dict[str, float] = {}

def get_price_in_inr(ticker: str) -> float:
    """
    Return latest price in INR.
    Indian tickers (ending in .NS or .BO) are already in INR.
    All others are assumed USD and converted using live USDINR rate.
    """
    price = get_latest_price(ticker)
    if ticker.upper().endswith((".NS", ".BO")):
        return price
    if "USDINR" not in _fx_cache:
        _fx_cache["USDINR"] = get_usd_to_inr()
    return price * _fx_cache["USDINR"]


# ---------------------------------------------------------------------------
# 2. Total holding value
# ---------------------------------------------------------------------------

def calculate_total_value(
    ticker: str,
    transactions: list[dict],
) -> dict:
    """
    Calculate current total value of a holding.

    transactions: list of dicts with keys:
        date (date), transaction_type ('buy'|'sell'), quantity (float), price (float)

    Returns dict with net_quantity, avg_cost, current_price, total_value, unrealised_pnl.
    """
    net_qty = 0.0
    total_cost = 0.0

    for tx in transactions:
        qty = float(tx["quantity"])
        px = float(tx["price"])
        if tx["transaction_type"] == "buy":
            total_cost += qty * px
            net_qty += qty
        else:
            # Reduce cost proportionally on sell
            if net_qty > 0:
                avg = total_cost / net_qty
                total_cost -= avg * qty
            net_qty -= qty

    net_qty = max(net_qty, 0.0)
    avg_cost = (total_cost / net_qty) if net_qty > 0 else 0.0

    # Current price in INR (USD tickers auto-converted via live FX rate)
    current_price_inr = get_price_in_inr(ticker)

    # avg_cost stored in the DB is in the currency the user entered (assumed INR already,
    # or if user entered USD prices we convert so both sides match)
    is_inr_ticker = ticker.upper().endswith((".NS", ".BO"))
    if not is_inr_ticker:
        fx = _fx_cache.get("USDINR") or get_usd_to_inr()
        _fx_cache["USDINR"] = fx
        avg_cost_inr = avg_cost * fx
    else:
        avg_cost_inr = avg_cost

    total_value = net_qty * current_price_inr
    unrealised_pnl = total_value - (net_qty * avg_cost_inr)

    return {
        "net_quantity": round(net_qty, 4),
        "avg_cost": round(avg_cost_inr, 4),
        "current_price": round(current_price_inr, 4),
        "total_value": round(total_value, 4),
        "unrealised_pnl": round(unrealised_pnl, 4),
        "currency": "INR",
    }


# ---------------------------------------------------------------------------
# 3. XIRR
# ---------------------------------------------------------------------------

def _xnpv(rate: float, cashflows: list[tuple[date, float]]) -> float:
    """Net present value for irregular cashflows at a given rate."""
    t0 = cashflows[0][0]
    return sum(
        cf / (1 + rate) ** ((d - t0).days / 365.0)
        for d, cf in cashflows
    )


def calculate_xirr(
    transactions: list[dict],
    current_value: float,
    valuation_date: Optional[date] = None,
) -> float:
    """
    Calculate XIRR given a list of transactions and the current market value.

    Cash flow convention:
      - buy  → negative (money goes out)
      - sell → positive (money comes in)
      - current_value is treated as a final positive cashflow today

    Returns annualised rate as a decimal (e.g. 0.15 = 15%).
    Raises ValueError if XIRR cannot be computed.
    """
    if valuation_date is None:
        valuation_date = date.today()

    cashflows: list[tuple[date, float]] = []
    for tx in transactions:
        tx_date = tx["date"] if isinstance(tx["date"], date) else date.fromisoformat(str(tx["date"]))
        amount = float(tx["quantity"]) * float(tx["price"])
        cf = -amount if tx["transaction_type"] == "buy" else amount
        cashflows.append((tx_date, cf))

    # Terminal value — remaining holding sold at market today
    cashflows.append((valuation_date, current_value))
    cashflows.sort(key=lambda x: x[0])

    try:
        rate = brentq(_xnpv, -0.999, 100.0, args=(cashflows,), xtol=1e-8, maxiter=1000)
    except ValueError as exc:
        raise ValueError(
            "XIRR could not converge — check that cashflows change sign at least once."
        ) from exc

    return round(rate, 6)


# ---------------------------------------------------------------------------
# 4. Beta
# ---------------------------------------------------------------------------

def calculate_beta(
    ticker: str,
    benchmark: str = "^GSPC",
    period: str = "1y",
) -> dict:
    """
    Calculate Beta of ticker relative to benchmark over the given period.

    Returns dict with beta, correlation, ticker_annual_vol, benchmark_annual_vol.
    """
    raw = yf.download(
        [ticker, benchmark],
        period=period,
        interval="1d",
        auto_adjust=True,
        progress=False,
    )["Close"]

    if isinstance(raw, pd.Series):
        raise ValueError("Expected two tickers but got a single Series back.")

    prices = raw[[ticker, benchmark]].dropna()
    if len(prices) < 30:
        raise ValueError(f"Insufficient price data to compute beta (got {len(prices)} rows).")

    returns = prices.pct_change().dropna()

    cov_matrix = returns.cov()
    beta = cov_matrix.loc[ticker, benchmark] / cov_matrix.loc[benchmark, benchmark]
    correlation = returns[ticker].corr(returns[benchmark])
    ticker_vol = returns[ticker].std() * np.sqrt(252)
    bench_vol = returns[benchmark].std() * np.sqrt(252)

    return {
        "ticker": ticker,
        "benchmark": benchmark,
        "beta": round(float(beta), 4),
        "correlation": round(float(correlation), 4),
        "ticker_annual_vol": round(float(ticker_vol), 4),
        "benchmark_annual_vol": round(float(bench_vol), 4),
    }
