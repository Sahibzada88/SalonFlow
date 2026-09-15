from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from app.core.config import settings
from app.core.logging_config import setup_logging, get_logger
from app.api.v1 import auth, salons, dashboard, customers, appointments, billing, staff, services, feedback

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SalonFlow API - Salon Management SaaS",
    # Hide interactive docs in production to reduce information exposure.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# The original config used allow_origins=["*"] together with
# allow_credentials=True, which is a real misconfiguration (most browsers
# reject that combination outright, and where they don't, it means literally
# any website can make credentialed requests on a logged-in user's behalf).
# CORS_ALLOWED_ORIGINS is a real allowlist, driven by env var so each
# deployment (local / staging / prod) can set its own frontend origin(s).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handling
# ---------------------------------------------------------------------------
# The original code wrapped every route body in `except Exception as e:
# raise HTTPException(400, str(e))`, which (a) collapsed every failure mode
# - auth errors, validation errors, DB errors - into HTTP 400, and (b) leaked
# raw exception text (including database error messages) straight to the
# client. Routes now let HTTPExceptions propagate normally and only catch
# what they specifically expect; anything unexpected lands here.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    if settings.DEBUG:
        # Only show real error details in local/dev
        return JSONResponse(status_code=500, content={"detail": str(exc)})
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again."},
    )


app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(salons.router, prefix="/api/v1/salons", tags=["Salons"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["Customers"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["Appointments"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["Billing"])
app.include_router(staff.router, prefix="/api/v1/staff", tags=["Staff"])
app.include_router(services.router, prefix="/api/v1/services", tags=["Services"])
app.include_router(feedback.router, prefix="/api/v1/feedback", tags=["Feedback"])


@app.get("/")
async def root():
    return {"message": "Welcome to SalonFlow API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


# ===== Vercel Handler =====
handler = Mangum(app)
