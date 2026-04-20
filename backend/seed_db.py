"""Run once to seed the production database with a demo user and portfolio."""
from datetime import date
from database import engine, SessionLocal, Base
import models.models
from models.models import User, Asset, AssetClass, Transaction, TransactionType

Base.metadata.create_all(bind=engine)
db = SessionLocal()

existing = db.query(User).filter(User.id == 1).first()
if existing:
    print(f"User already exists: {existing.name} (id={existing.id})")
else:
    user = User(name="Gaurav", email="gaurav@wealthvibe.app")
    db.add(user)
    db.flush()

    portfolio = [
        ("AAPL", "Apple Inc.",                  AssetClass.equity,      30.0, [
            (date(2024, 1, 10), TransactionType.buy,  20, 185.50),
            (date(2024, 6,  1), TransactionType.buy,  10, 192.00),
        ]),
        ("MSFT", "Microsoft Corp.",              AssetClass.equity,      25.0, [
            (date(2024, 2, 15), TransactionType.buy,  10, 410.00),
        ]),
        ("TLT",  "iShares 20Y Treasury Bond ETF", AssetClass.debt,       45.0, [
            (date(2024, 3,  1), TransactionType.buy,   5,  92.00),
        ]),
        ("INTC", "Intel Corp.",                  AssetClass.equity,       0.0, [
            (date(2023, 7,  1), TransactionType.buy,  50, 100.00),
        ]),
    ]

    for ticker, name, ac, target, txs in portfolio:
        asset = Asset(
            user_id=user.id, ticker=ticker, name=name,
            asset_class=ac, target_allocation_percentage=target,
        )
        db.add(asset)
        db.flush()
        for d, tt, qty, price in txs:
            db.add(Transaction(asset_id=asset.id, date=d, transaction_type=tt, quantity=qty, price=price))

    db.commit()
    print(f"Done. Seeded user id={user.id} with {len(portfolio)} assets.")
