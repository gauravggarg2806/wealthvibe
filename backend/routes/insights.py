from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services.recommendation_engine import generate_portfolio_insights

router = APIRouter(prefix="/api/users", tags=["insights"])


@router.get("/{user_id}/insights")
def get_insights(user_id: int, db: Session = Depends(get_db)):
    result = generate_portfolio_insights(user_id, db)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
