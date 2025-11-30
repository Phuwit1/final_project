from fastapi import APIRouter, Depends, HTTPException, Request
from prisma import Prisma
import bcrypt
from jose import jwt, JWTError
from datetime import datetime

from dependencies import get_db, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM
from schemas import Customer, CustomerLogin, CustomerOut, TokenRefreshRequest

router = APIRouter(tags=["Auth"])

@router.post("/refresh-token", response_model=CustomerOut)
async def refresh_token(data: TokenRefreshRequest, db: Prisma = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db_user = await db.customer.find_unique(where={"email": email})
    if not db_user or db_user.refreshToken != data.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token mismatch")

    new_access = create_access_token(email)
    new_refresh = create_refresh_token(email)

    await db.customer.update(
        where={"email": email},
        data={"currentToken": new_access, "refreshToken": new_refresh}
    )
    return {"email": email, "token": new_access, "refresh_token": new_refresh}

@router.post("/register", response_model=CustomerOut)
async def register(customer: Customer, db: Prisma = Depends(get_db)):
    existing = await db.customer.find_unique(where={"email": customer.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(customer.password.encode(), bcrypt.gensalt()).decode()
    access_token = create_access_token(customer.email)
    refresh_token = create_refresh_token(customer.email)

    birth_date = None
    if customer.birth_date:
        if isinstance(customer.birth_date, str):
            birth_date = datetime.fromisoformat(customer.birth_date)
        elif isinstance(customer.birth_date, datetime):
            birth_date = customer.birth_date

    await db.customer.create(
        data={
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "email": customer.email,
            "password": hashed,
            # "currentToken": access_token, <= idk what this is for registration
            "currentToken": None,
            "refreshToken": refresh_token,
            "phone_number": customer.phone_number,
            "birth_date": birth_date,
        }
    )
    return {"email": customer.email, "token": access_token, "refresh_token": refresh_token}

@router.post("/login", response_model=CustomerOut)
async def login(customer: CustomerLogin, db: Prisma = Depends(get_db)):
    db_customer = await db.customer.find_unique(where={"email": customer.email})
    if not db_customer or not bcrypt.checkpw(customer.password.encode(), db_customer.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if db_customer.currentToken:
        raise HTTPException(status_code=403, detail="User already logged in elsewhere")

    access_token = create_access_token(customer.email)
    refresh_token = create_refresh_token(customer.email)

    await db.customer.update(
        where={"email": customer.email},
        data={"currentToken": access_token, "refreshToken": refresh_token}
    )
    return {"email": customer.email, "token": access_token, "refresh_token": refresh_token}

@router.post("/logout")
async def logout(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await db.customer.update(
        where={"email": email},
        data={"currentToken": None, "refreshToken": None}
    )
    return {"detail": "Logged out successfully"}

@router.get("/user")
async def get_user(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
    }
