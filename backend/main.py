from typing import Union, List, Dict, Any
from prisma import Prisma, types
from prisma.errors import ForeignKeyViolationError, UniqueViolationError, RecordNotFoundError
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import bcrypt
from jose import jwt, JWTError
from typing import Annotated, Optional
from datetime import date, datetime, time, timedelta, date as D, time as T
from fastapi.middleware.cors import CORSMiddleware
import secrets
import string
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware
import re, os, json, psycopg2
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from contextlib import asynccontextmanager


from routers import auth, customer, trip_group, budget, trip_plan, ai
from dependencies import load_cities_data, get_cities_list, cities_data, SECRET_KEY, ALGORITHM, get_db


load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    load_cities_data()
    yield
    # --- shutdown ---
    cities_data.clear()

app = FastAPI(lifespan=lifespan)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# class for request model


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Middleware ---
@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    
    if request.url.path in ["/login", "/register", "/refresh-token", "/google-login"]:
        return await call_next(request)

    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing or invalid token"})

    token = auth.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise ValueError("Missing email in token")
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    # ตรวจสอบในฐานข้อมูลว่าตรงกับ currentToken หรือไม่
    async with Prisma() as db:
        user = await db.customer.find_unique(where={"email": email})
        if not user or user.currentToken != token:
            return JSONResponse(status_code=401, content={"detail": "Token mismatch or user not found"})

    # แนบข้อมูล user ไว้ให้ endpoint ถัดไปใช้งานได้
    request.state.email = email
    return await call_next(request)


# --- Routers ---
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(trip_group.router)
app.include_router(budget.router)
app.include_router(trip_plan.router)
app.include_router(ai.router)


@app.get("/cities")
def get_cities():
    data = get_cities_list()
    return {"items": [c.model_dump() for c in data], "total": len(data)}
