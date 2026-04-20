import enum
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base


class AssetClass(str, enum.Enum):
    equity = "equity"
    mutual_fund = "mutual_fund"
    debt = "debt"


class TransactionType(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)

    assets = relationship("Asset", back_populates="owner", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticker = Column(String, nullable=False)
    name = Column(String, nullable=False)
    asset_class = Column(Enum(AssetClass), nullable=False)
    target_allocation_percentage = Column(Float, nullable=False)

    owner = relationship("User", back_populates="assets")
    transactions = relationship("Transaction", back_populates="asset", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    date = Column(Date, nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)

    asset = relationship("Asset", back_populates="transactions")
