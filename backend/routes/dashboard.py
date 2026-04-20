from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, AssetClass
from services.quant_engine import calculate_total_value

router = APIRouter(prefix="/api/users", tags=["dashboard"])

# Chart colours kept consistent with frontend src/theme/colors.ts
_CLASS_COLORS = {
    AssetClass.equity: "#4F46E5",
    AssetClass.mutual_fund: "#F59E0B",
    AssetClass.debt: "#10B981",
}


@router.get("/{user_id}/dashboard")
def get_dashboard(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    class_values: dict[AssetClass, float] = {}
    total_cost = 0.0

    for asset in user.assets:
        tx_dicts = [
            {
                "date": tx.date,
                "transaction_type": tx.transaction_type.value,
                "quantity": tx.quantity,
                "price": tx.price,
            }
            for tx in asset.transactions
        ]
        if not tx_dicts:
            continue
        try:
            val = calculate_total_value(asset.ticker, tx_dicts)
        except Exception:
            continue

        ac = asset.asset_class
        class_values[ac] = class_values.get(ac, 0.0) + val["total_value"]
        total_cost += val["avg_cost"] * val["net_quantity"]

    total_value = sum(class_values.values())
    total_pnl = total_value - total_cost
    pnl_pct = (total_pnl / total_cost * 100) if total_cost else 0.0

    allocation = [
        {
            "label": ac.value.replace("_", " ").title(),
            "value": round(v, 2),
            "percentage": round(v / total_value * 100, 2) if total_value else 0,
            "color": _CLASS_COLORS.get(ac, "#6B7280"),
        }
        for ac, v in class_values.items()
    ]

    return {
        "total_portfolio_value": round(total_value, 2),
        "total_unrealised_pnl": round(total_pnl, 2),
        "pnl_percentage": round(pnl_pct, 2),
        "allocation": allocation,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }
