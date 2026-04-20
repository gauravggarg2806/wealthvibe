"""
Standalone test for recommendation_engine.py using an in-memory SQLite DB.
Run from backend/ with the venv active:
    python test_recommendation_engine.py
"""

from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.models import User, Asset, Transaction, AssetClass, TransactionType
from services.recommendation_engine import generate_portfolio_insights


def build_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def seed(db):
    user = User(name="Gaurav Test", email="gaurav@test.com")
    db.add(user)
    db.flush()

    # --- AAPL: equity, heavy weighting (triggers rebalancing + PE flag) ---
    aapl = Asset(
        user_id=user.id, ticker="AAPL", name="Apple Inc.",
        asset_class=AssetClass.equity, target_allocation_percentage=30.0,
    )
    db.add(aapl)
    db.flush()
    db.add_all([
        Transaction(asset_id=aapl.id, date=date(2024, 1, 10),
                    transaction_type=TransactionType.buy, quantity=20, price=185.50),
        Transaction(asset_id=aapl.id, date=date(2024, 6, 1),
                    transaction_type=TransactionType.buy, quantity=10, price=192.00),
    ])

    # --- MSFT: equity, another large position (keeps equity allocation high) ---
    msft = Asset(
        user_id=user.id, ticker="MSFT", name="Microsoft Corp.",
        asset_class=AssetClass.equity, target_allocation_percentage=25.0,
    )
    db.add(msft)
    db.flush()
    db.add_all([
        Transaction(asset_id=msft.id, date=date(2024, 2, 15),
                    transaction_type=TransactionType.buy, quantity=10, price=410.00),
    ])

    # --- Fake debt asset: small allocation (keeps debt low → triggers rebalance) ---
    # Using a liquid ETF as proxy for debt; small position inflates equity%
    tlt = Asset(
        user_id=user.id, ticker="TLT", name="iShares 20Y Treasury Bond ETF",
        asset_class=AssetClass.debt, target_allocation_percentage=45.0,
    )
    db.add(tlt)
    db.flush()
    db.add_all([
        Transaction(asset_id=tlt.id, date=date(2024, 3, 1),
                    transaction_type=TransactionType.buy, quantity=5, price=92.00),
    ])

    # --- INTC: equity, bought at inflated price — triggers tax-loss harvesting ---
    # Current INTC price ~$68; seeding a buy at $100 gives a ~32% unrealised loss
    intc = Asset(
        user_id=user.id, ticker="INTC", name="Intel Corp.",
        asset_class=AssetClass.equity, target_allocation_percentage=0.0,
    )
    db.add(intc)
    db.flush()
    db.add_all([
        Transaction(asset_id=intc.id, date=date(2023, 7, 1),
                    transaction_type=TransactionType.buy, quantity=50, price=100.00),
    ])

    db.commit()
    return user.id


def separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print("="*60)


if __name__ == "__main__":
    print("\nWealthVibe — Recommendation Engine Tests")

    db = build_session()
    user_id = seed(db)

    separator("Running generate_portfolio_insights()")
    result = generate_portfolio_insights(user_id, db)

    separator("Portfolio Summary")
    print(f"  User            : {result['user_name']}")
    print(f"  Total Value     : ${result['total_portfolio_value']:,.2f}")
    print(f"  Unrealised P&L  : ${result['total_unrealised_pnl']:,.2f}")
    print(f"  Alerts fired    : {result['alert_count']}")

    separator("Asset Breakdown")
    for a in result["asset_summary"]:
        print(f"  {a['ticker']:6s} | class={a['asset_class']:12s} | "
              f"qty={a['net_quantity']:6} | value=${a['total_value']:>10,.2f} | "
              f"pnl=${a['unrealised_pnl']:>10,.2f}")

    separator("Alerts")
    if not result["alerts"]:
        print("  No alerts generated.")
    for alert in result["alerts"]:
        print(f"\n  [{alert['severity'].upper()}] {alert['alert_type']}")
        print(f"  {alert['message']}")

    separator("Rule Coverage Check")
    alert_types = {a["alert_type"] for a in result["alerts"]}
    rules = ["rebalancing", "tax_loss_harvesting", "overvaluation"]
    for rule in rules:
        status = "FIRED" if rule in alert_types else "not triggered (check thresholds/market data)"
        print(f"  {rule:25s} : {status}")

    print("\n  Done.\n")
