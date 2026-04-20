"""
Standalone test script for quant_engine.py.
Run from backend/ with the venv active:
    python test_quant_engine.py
"""

from datetime import date
from services.quant_engine import (
    get_latest_price,
    calculate_total_value,
    calculate_xirr,
    calculate_beta,
)

TICKER = "AAPL"
BENCHMARK = "^GSPC"

# Dummy AAPL transactions spanning ~18 months
TRANSACTIONS = [
    {"date": date(2024, 1, 10), "transaction_type": "buy",  "quantity": 10, "price": 185.50},
    {"date": date(2024, 4, 15), "transaction_type": "buy",  "quantity":  5, "price": 171.20},
    {"date": date(2024, 7, 22), "transaction_type": "sell", "quantity":  3, "price": 223.45},
    {"date": date(2024, 11, 5), "transaction_type": "buy",  "quantity":  8, "price": 222.01},
]


def separator(title: str):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print("="*55)


def test_latest_price():
    separator("1. Latest Price")
    price = get_latest_price(TICKER)
    print(f"  {TICKER} latest close: ${price:.2f}")
    assert price > 0, "Price must be positive"
    print("  PASS")


def test_total_value():
    separator("2. Total Holding Value")
    result = calculate_total_value(TICKER, TRANSACTIONS)
    for k, v in result.items():
        print(f"  {k:25s}: {v}")
    assert result["net_quantity"] == 20.0, f"Expected 20 shares, got {result['net_quantity']}"
    assert result["total_value"] > 0
    print("  PASS")


def test_xirr():
    separator("3. XIRR")
    value_result = calculate_total_value(TICKER, TRANSACTIONS)
    current_value = value_result["total_value"]
    xirr = calculate_xirr(TRANSACTIONS, current_value)
    print(f"  XIRR: {xirr * 100:.2f}%")
    assert -1 < xirr < 100, "XIRR out of sane range"
    print("  PASS")


def test_beta():
    separator("4. Beta vs S&P 500")
    result = calculate_beta(TICKER, benchmark=BENCHMARK, period="1y")
    for k, v in result.items():
        print(f"  {k:25s}: {v}")
    assert 0 < result["beta"] < 5, "Beta out of sane range for AAPL"
    print("  PASS")


if __name__ == "__main__":
    print("\nWealthVibe — Quant Engine Tests")
    print(f"Ticker: {TICKER}  |  Benchmark: {BENCHMARK}")

    test_latest_price()
    test_total_value()
    test_xirr()
    test_beta()

    print("\n" + "="*55)
    print("  All tests passed.")
    print("="*55 + "\n")
