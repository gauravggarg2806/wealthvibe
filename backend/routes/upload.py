import io
from datetime import date as date_type

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from models.models import Asset, AssetClass, Transaction, TransactionType, User

router = APIRouter(prefix="/api/users", tags=["upload"])

REQUIRED_COLUMNS = {"Date", "Ticker", "Type", "Quantity", "Price"}


def _parse_asset_class(ticker: str) -> AssetClass:
    """Default all uploaded tickers to equity; can be overridden later."""
    return AssetClass.equity


def _parse_tx_type(raw: str) -> TransactionType:
    val = raw.strip().lower()
    if val in ("buy", "b"):
        return TransactionType.buy
    if val in ("sell", "s"):
        return TransactionType.sell
    raise ValueError(f"Invalid transaction type '{raw}' — must be Buy or Sell")


@router.post("/{user_id}/upload-statement")
async def upload_statement(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    # --- Column validation ---
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=(
                f"CSV is missing required columns: {sorted(missing)}. "
                f"Expected: {sorted(REQUIRED_COLUMNS)}. Got: {sorted(df.columns.tolist())}"
            ),
        )

    df = df[list(REQUIRED_COLUMNS)].copy()
    df.columns = [c.strip() for c in df.columns]

    # --- Cache existing assets to avoid repeated queries ---
    asset_cache: dict[str, Asset] = {
        a.ticker: a for a in db.query(Asset).filter(Asset.user_id == user_id).all()
    }

    inserted = 0
    row_errors: list[dict] = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-based + header row
        try:
            # Date
            try:
                tx_date = pd.to_datetime(row["Date"]).date()
            except Exception:
                raise ValueError(f"Invalid date '{row['Date']}'")

            # Ticker
            ticker = str(row["Ticker"]).strip().upper()
            if not ticker:
                raise ValueError("Ticker cannot be empty")

            # Type
            tx_type = _parse_tx_type(str(row["Type"]))

            # Quantity
            qty = float(row["Quantity"])
            if qty <= 0:
                raise ValueError("Quantity must be > 0")

            # Price
            price = float(row["Price"])
            if price <= 0:
                raise ValueError("Price must be > 0")

            # Asset — reuse or create
            if ticker not in asset_cache:
                asset = Asset(
                    user_id=user_id,
                    ticker=ticker,
                    name=ticker,                        # name defaults to ticker; user can rename later
                    asset_class=_parse_asset_class(ticker),
                    target_allocation_percentage=0.0,
                )
                db.add(asset)
                db.flush()
                asset_cache[ticker] = asset

            db.add(Transaction(
                asset_id=asset_cache[ticker].id,
                date=tx_date,
                transaction_type=tx_type,
                quantity=qty,
                price=price,
            ))
            inserted += 1

        except (ValueError, TypeError) as exc:
            row_errors.append({"row": row_num, "error": str(exc)})

    if inserted == 0 and row_errors:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail={"message": "No rows were imported — all rows had errors.", "errors": row_errors},
        )

    db.commit()

    return {
        "message": f"Import complete. {inserted} transaction(s) inserted.",
        "inserted": inserted,
        "skipped": len(row_errors),
        "errors": row_errors,
    }
