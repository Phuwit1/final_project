import os
from typing import List
from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from prisma import Prisma
from jose import jwt, JWTError
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json
from schemas import City

load_dotenv()

# JWT Configuration
SECRET_KEY = "B81LunjU4Q5r2ctmjwFSujqAHOAtso4TslFDQKfDlHs"
ALGORITHM = "HS256"

# Database Connection
async def get_db():
    db = Prisma()
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()

# Auth Functions
def create_access_token(email: str, expires_minutes: int = 60):
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, os.getenv("SECRET_KEY_JWT"), algorithm=ALGORITHM)

def create_refresh_token(email: str, expires_days: int = 7):
    expire = datetime.utcnow() + timedelta(days=expires_days)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, os.getenv("SECRET_KEY_JWT"), algorithm=ALGORITHM)

async def get_current_user(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Cities Data Management
cities_data: List[City] = []

def load_cities_data():
    """Load cities data from JSON file on startup"""
    global cities_data
    file_path = "data/cities.json"
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                cities_data = [City(**city) for city in data]
        else:
            cities_data = []
    except Exception as e:
        print(f"Error loading cities data: {e}")
        cities_data = []

def get_cities_list():
    return cities_data