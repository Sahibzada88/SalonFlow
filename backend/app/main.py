from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import auth, salons, dashboard, customers, appointments, billing

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SalonFlow API - Salon Management SaaS"
)

# CORS middleware - Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(salons.router, prefix="/api/v1/salons", tags=["Salons"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["Appointments"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["Billing"])



@app.get("/")
async def root():
    return {"message": "Welcome to SalonFlow API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}

# Add this at the very bottom
import os
from mangum import Mangum

# Handler for Vercel serverless
handler = Mangum(app)