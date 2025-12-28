import uuid
from fastapi import Request
from fastapi.responses import JSONResponse, Response


def ok(request: Request, data):
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "data": data,
            "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
        },
    )


def created(request: Request, data):
    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "data": data,
            "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
        },
    )


def no_content():
    return Response(status_code=204)


def err(request: Request, code: str, message: str, status_code: int = 400, details=None):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": code, "message": message, "details": details or {}},
            "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
        },
    )
