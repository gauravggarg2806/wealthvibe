from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models.models  # ensure all models are registered before create_all
from routes.insights import router as insights_router
from routes.dashboard import router as dashboard_router
from routes.assets import router as assets_router
from routes.transactions import router as transactions_router
from routes.upload import router as upload_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="WealthVibe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insights_router)
app.include_router(dashboard_router)
app.include_router(assets_router)
app.include_router(transactions_router)
app.include_router(upload_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "wealthvibe-backend"}
