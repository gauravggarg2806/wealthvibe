"""
Recommendation engine: portfolio rebalancing, tax-loss harvesting, overvaluation flags.
"""

from typing import Any, Optional
import yfinance as yf
from sqlalchemy.orm import Session

from models.models import Asset, AssetClass, Transaction
from services.quant_engine import calculate_total_value, get_latest_price


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _transactions_as_dicts(transactions: list[Transaction]) -> list[dict]:
    return [
        {
            "date": tx.date,
            "transaction_type": tx.transaction_type.value,
            "quantity": tx.quantity,
            "price": tx.price,
        }
        for tx in transactions
    ]


def _avg_buy_price(transactions: list[Transaction]) -> float:
    """Weighted average buy price across all buy transactions."""
    total_cost = sum(tx.quantity * tx.price for tx in transactions if tx.transaction_type.value == "buy")
    total_qty = sum(tx.quantity for tx in transactions if tx.transaction_type.value == "buy")
    return total_cost / total_qty if total_qty else 0.0


def _get_trailing_pe(ticker: str) -> Optional[float]:
    """Fetch trailing P/E ratio from yfinance. Returns None if unavailable."""
    try:
        info = yf.Ticker(ticker).info
        return info.get("trailingPE") or info.get("forwardPE")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Rule 1 — Rebalancing Alert
# ---------------------------------------------------------------------------

def _check_rebalancing(assets: list[Asset], asset_values: dict[int, dict]) -> Optional[dict]:
    """
    Compare actual equity allocation % vs the sum of user-set target allocations.
    Fires if actual equity % exceeds target equity % by more than 5 percentage points.
    """
    total_portfolio_value = sum(v["total_value"] for v in asset_values.values())
    if total_portfolio_value == 0:
        return None

    equity_value = sum(
        asset_values[a.id]["total_value"]
        for a in assets
        if a.asset_class == AssetClass.equity and asset_values[a.id]["total_value"] > 0
    )
    debt_value = sum(
        asset_values[a.id]["total_value"]
        for a in assets
        if a.asset_class == AssetClass.debt and asset_values[a.id]["total_value"] > 0
    )

    actual_equity_pct = (equity_value / total_portfolio_value) * 100
    target_equity_pct = sum(
        a.target_allocation_percentage
        for a in assets
        if a.asset_class == AssetClass.equity
    )

    drift = actual_equity_pct - target_equity_pct

    if drift > 5:
        return {
            "alert_type": "rebalancing",
            "severity": "high" if drift > 15 else "medium",
            "actual_equity_pct": round(actual_equity_pct, 2),
            "target_equity_pct": round(target_equity_pct, 2),
            "drift_pct": round(drift, 2),
            "actual_debt_value": round(debt_value, 2),
            "actual_equity_value": round(equity_value, 2),
            "message": (
                f"Equity allocation is {drift:.1f}pp above target "
                f"({actual_equity_pct:.1f}% actual vs {target_equity_pct:.1f}% target). "
                "Consider selling equity or buying debt to rebalance."
            ),
        }
    return None


# ---------------------------------------------------------------------------
# Rule 2 — Tax-Loss Harvesting
# ---------------------------------------------------------------------------

def _check_tax_loss_harvesting(assets: list[Asset], asset_values: dict[int, dict]) -> list[dict]:
    """
    Flag assets where current price is ≥10% below the average buy price.
    """
    alerts = []
    for asset in assets:
        val = asset_values.get(asset.id)
        if not val or val["net_quantity"] == 0 or val["avg_cost"] == 0:
            continue

        current_price = val["current_price"]
        avg_cost = val["avg_cost"]
        loss_pct = ((avg_cost - current_price) / avg_cost) * 100

        if loss_pct >= 10:
            alerts.append({
                "alert_type": "tax_loss_harvesting",
                "severity": "high" if loss_pct >= 25 else "medium",
                "ticker": asset.ticker,
                "asset_name": asset.name,
                "avg_buy_price": round(avg_cost, 4),
                "current_price": round(current_price, 4),
                "loss_pct": round(loss_pct, 2),
                "unrealised_loss": round(val["unrealised_pnl"], 2),
                "message": (
                    f"{asset.ticker} is trading {loss_pct:.1f}% below your average cost "
                    f"(₹{current_price:.2f} vs avg ₹{avg_cost:.2f}). "
                    "Consider harvesting this loss to offset capital gains."
                ),
            })
    return alerts


# ---------------------------------------------------------------------------
# Rule 3 — Overvaluation Flag
# ---------------------------------------------------------------------------

def _check_overvaluation(assets: list[Asset], pe_threshold: float = 40.0) -> list[dict]:
    """
    Fetch trailing P/E for equity assets and flag those above the threshold.
    """
    alerts = []
    for asset in assets:
        if asset.asset_class != AssetClass.equity:
            continue
        pe = _get_trailing_pe(asset.ticker)
        if pe is not None and pe > pe_threshold:
            alerts.append({
                "alert_type": "overvaluation",
                "severity": "high" if pe > 80 else "medium",
                "ticker": asset.ticker,
                "asset_name": asset.name,
                "trailing_pe": round(pe, 2),
                "pe_threshold": pe_threshold,
                "message": (
                    f"{asset.ticker} has a trailing P/E of {pe:.1f}, "
                    f"which exceeds the threshold of {pe_threshold:.0f}x. "
                    "This may indicate the asset is potentially overvalued."
                ),
            })
    return alerts


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_portfolio_insights(user_id: int, db: Session) -> dict[str, Any]:
    """
    Run all three insight rules for a user and return a consolidated report.
    """
    from models.models import User

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": f"User {user_id} not found"}

    assets: list[Asset] = user.assets
    if not assets:
        return {
            "user_id": user_id,
            "alerts": [],
            "summary": "No assets found for this user.",
        }

    # Pre-compute current values for all assets (one price fetch per ticker)
    asset_values: dict[int, dict] = {}
    for asset in assets:
        tx_dicts = _transactions_as_dicts(asset.transactions)
        if not tx_dicts:
            asset_values[asset.id] = {
                "net_quantity": 0,
                "avg_cost": 0,
                "current_price": 0,
                "total_value": 0,
                "unrealised_pnl": 0,
            }
        else:
            try:
                asset_values[asset.id] = calculate_total_value(asset.ticker, tx_dicts)
            except Exception as exc:
                asset_values[asset.id] = {
                    "net_quantity": 0,
                    "avg_cost": 0,
                    "current_price": 0,
                    "total_value": 0,
                    "unrealised_pnl": 0,
                    "error": str(exc),
                }

    alerts: list[dict] = []

    rebalance = _check_rebalancing(assets, asset_values)
    if rebalance:
        alerts.append(rebalance)

    alerts.extend(_check_tax_loss_harvesting(assets, asset_values))
    alerts.extend(_check_overvaluation(assets))

    total_value = sum(v["total_value"] for v in asset_values.values())
    total_pnl = sum(v["unrealised_pnl"] for v in asset_values.values())

    return {
        "user_id": user_id,
        "user_name": user.name,
        "total_portfolio_value": round(total_value, 2),
        "total_unrealised_pnl": round(total_pnl, 2),
        "alert_count": len(alerts),
        "alerts": alerts,
        "asset_summary": [
            {
                "ticker": a.ticker,
                "name": a.name,
                "asset_class": a.asset_class.value,
                "target_allocation_pct": a.target_allocation_percentage,
                **asset_values[a.id],
            }
            for a in assets
        ],
    }
