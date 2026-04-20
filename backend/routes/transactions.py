from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models.models import Asset, AssetClass, Transaction, TransactionType, User

router = APIRouter(prefix="/api", tags=["transactions"])


class TransactionPayload(BaseModel):
    user_id: int
    ticker: str
    asset_name: str
    asset_class: AssetClass
    transaction_type: TransactionType
    quantity: float
    price: float
    date: date_type
    target_allocation_percentage: float = 0.0

    @field_validator("ticker")
    @classmethod
    def upper_ticker(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("quantity", "price")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Must be positive")
        return v


@router.post("/transactions", status_code=201)
def create_transaction(payload: TransactionPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {payload.user_id} not found")

    # Reuse existing asset for this ticker+user, or create a new one
    asset = (
        db.query(Asset)
        .filter(Asset.user_id == payload.user_id, Asset.ticker == payload.ticker)
        .first()
    )
    if not asset:
        asset = Asset(
            user_id=payload.user_id,
            ticker=payload.ticker,
            name=payload.asset_name,
            asset_class=payload.asset_class,
            target_allocation_percentage=payload.target_allocation_percentage,
        )
        db.add(asset)
        db.flush()

    tx = Transaction(
        asset_id=asset.id,
        date=payload.date,
        transaction_type=payload.transaction_type,
        quantity=payload.quantity,
        price=payload.price,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return {
        "transaction_id": tx.id,
        "asset_id": asset.id,
        "ticker": asset.ticker,
        "message": "Transaction recorded successfully",
    }
