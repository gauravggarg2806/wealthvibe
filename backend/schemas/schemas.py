from datetime import date
from pydantic import BaseModel, EmailStr
from models.models import AssetClass, TransactionType


# --- User ---

class UserCreate(BaseModel):
    name: str
    email: EmailStr


class UserRead(BaseModel):
    id: int
    name: str
    email: str

    model_config = {"from_attributes": True}


# --- Asset ---

class AssetCreate(BaseModel):
    ticker: str
    name: str
    asset_class: AssetClass
    target_allocation_percentage: float


class AssetRead(BaseModel):
    id: int
    user_id: int
    ticker: str
    name: str
    asset_class: AssetClass
    target_allocation_percentage: float

    model_config = {"from_attributes": True}


# --- Transaction ---

class TransactionCreate(BaseModel):
    date: date
    transaction_type: TransactionType
    quantity: float
    price: float


class TransactionRead(BaseModel):
    id: int
    asset_id: int
    date: date
    transaction_type: TransactionType
    quantity: float
    price: float

    model_config = {"from_attributes": True}
