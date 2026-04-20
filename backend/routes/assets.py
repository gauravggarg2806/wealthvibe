from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.models import User
from services.quant_engine import calculate_total_value, calculate_xirr, calculate_beta

router = APIRouter(prefix="/api/users", tags=["assets"])


def _tx_dicts(transactions):
    return [
        {
            "date": tx.date,
            "transaction_type": tx.transaction_type.value,
            "quantity": tx.quantity,
            "price": tx.price,
        }
        for tx in transactions
    ]


@router.get("/{user_id}/assets")
def get_assets(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    results = []
    for asset in user.assets:
        tx = _tx_dicts(asset.transactions)
        if not tx:
            continue

        try:
            val = calculate_total_value(asset.ticker, tx)
        except Exception as e:
            results.append({"id": asset.id, "ticker": asset.ticker, "error": str(e)})
            continue

        # XIRR
        try:
            xirr = calculate_xirr(tx, val["total_value"])
        except Exception:
            xirr = None

        # Beta (equity only — debt instruments often lack sufficient data)
        beta = None
        if asset.asset_class.value == "equity":
            try:
                beta_result = calculate_beta(asset.ticker)
                beta = beta_result["beta"]
            except Exception:
                beta = None

        invested = val["avg_cost"] * val["net_quantity"]
        pnl_pct = (val["unrealised_pnl"] / invested * 100) if invested else 0.0

        results.append({
            "id": asset.id,
            "ticker": asset.ticker,
            "name": asset.name,
            "asset_class": asset.asset_class.value,
            "target_allocation_pct": asset.target_allocation_percentage,
            "net_quantity": val["net_quantity"],
            "avg_cost": val["avg_cost"],
            "current_price": val["current_price"],
            "current_value": val["total_value"],
            "unrealised_pnl": val["unrealised_pnl"],
            "pnl_percentage": round(pnl_pct, 2),
            "xirr": round(xirr * 100, 2) if xirr is not None else None,
            "beta": beta,
        })

    return results
