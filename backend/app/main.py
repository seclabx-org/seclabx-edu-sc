from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.request_id import RequestIdMiddleware
from app.core.response import err
from app.core.errors import AppError
from app.api.routes import auth, meta, resources, admin, files

setup_logging()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(RequestIdMiddleware)

origins = [x.strip() for x in settings.ALLOW_ORIGINS.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meta.router)
app.include_router(resources.router)
app.include_router(files.router)
app.include_router(admin.router)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return err(request, exc.code, exc.message, exc.status_code, exc.details or {})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return err(request, "VALIDATION_ERROR", "Validation failed", 400, {"errors": exc.errors()})


@app.get("/healthz")
def healthz():
    return {"ok": True}
