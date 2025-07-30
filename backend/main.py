from typing import Union
from prisma import Prisma
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import bcrypt
from jose import jwt, JWTError
from typing import Annotated, Optional
from datetime import date, datetime, time, timedelta
from fastapi.middleware.cors import CORSMiddleware
import secrets
import string
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)

# class for request model

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Customer(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    phone_number: str
    birth_date: datetime
    
class TripGroup(BaseModel):
    name_group: str
    description: Optional[str] = ""
    start_date: datetime
    end_date: datetime
    
class GroupMember(BaseModel):
    customer_id: int
    trip_id: int

class Budget(BaseModel):
    trip_id: Optional[int] = None
    plan_id: Optional[int] = None
    total_budget: float

class Expense(BaseModel):
    budget_id: int
    category: str
    amount: float
    description: str

class TripPlan(BaseModel):
    name_group: str
    start_plan_date: datetime
    end_plan_date: datetime
    day_of_trip: Optional[int] = None
    trip_id: Optional[int] = None
    
class TripSchedule(BaseModel):
    plan_id: int
    time: str
    activity: str
    description: str

class CustomerLogin(BaseModel):
    email: str
    password: str

class CustomerOut(BaseModel):
    email: str
    token: str
    refresh_token: str 

class TokenRefreshRequest(BaseModel):
    refresh_token: str


# --- Middleware ---
@app.middleware("http")
async def jwt_middleware(request: Request, call_next):
    
    if request.url.path in ["/login", "/register", "/refresh-token",]:
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


# jwt
SECRET_KEY = "B81LunjU4Q5r2ctmjwFSujqAHOAtso4TslFDQKfDlHs"
ALGORITHM = "HS256"

def create_access_token(email: str, expires_minutes: int = 60):
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(email: str, expires_days: int = 7):
    expire = datetime.utcnow() + timedelta(days=expires_days)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# --- Database Connection ---
async def get_db():
    db = Prisma()
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()


# refresh token

@app.post("/refresh-token", response_model=CustomerOut)
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

    # generate new access and refresh token
    new_access = create_access_token(email)
    new_refresh = create_refresh_token(email)

    await db.customer.update(
        where={"email": email},
        data={
            "currentToken": new_access,
            "refreshToken": new_refresh
        }
    )

    return {"email": email, "token": new_access, "refresh_token": new_refresh}



# Authen

@app.post("/register", response_model=CustomerOut)
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
        else:
            raise HTTPException(status_code=400, detail="Invalid birth_date format")
        

    await db.customer.create(
        data={
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "email": customer.email,
            "password": hashed,
            "currentToken": access_token,
            "refreshToken": refresh_token,
            "phone_number": customer.phone_number,
            "birth_date": birth_date,
        }
    )

    return {
        "email": customer.email,
        "token": access_token,
        "refresh_token": refresh_token
    }


@app.post("/login", response_model=CustomerOut)
async def login(customer: CustomerLogin, db: Prisma = Depends(get_db)):
    db_customer = await db.customer.find_unique(where={"email": customer.email})
    if not db_customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(customer.password.encode(), db_customer.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if db_customer.currentToken:
        raise HTTPException(status_code=403, detail="User already logged in elsewhere")

    access_token = create_access_token(customer.email)
    refresh_token = create_refresh_token(customer.email)

    await db.customer.update(
        where={"email": customer.email},
        data={
            "currentToken": access_token,
            "refreshToken": refresh_token
        }
    )

    return {
        "email": customer.email,
        "token": access_token,
        "refresh_token": refresh_token
    }

@app.post("/logout")
async def logout(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await db.customer.update(
        where={"email": email},
        data={
            "currentToken": None,
            "refreshToken": None
        }
    )
    return {"detail": "Logged out successfully"}



@app.get("/user")
async def get_user(request: Request, db: Prisma = Depends(get_db)):
    email = getattr(request.state, "email", None)
    print(f"Middleware set email: {email}")

    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    print(f"User data: email={user.email}, createdAt={user.createdAt}, updatedAt={user.updatedAt}, token={user.currentToken}")

    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
    }

# ================ Customer ================


@app.get("/customer")
async def read_customer(db: Prisma = Depends(get_db)):
    try:
        customer = await db.customer.find_many(
            include={
                "ownedTrips": {
                    "include": {
                        "members": True,
                        "tripPlans": True,
                        "budget": True,
                    }
                }
            ,
                "memberships": True},
        )
        return customer
    except Exception as e:
        return {"error": str(e)}

@app.get("/customer/{customer_id}")
async def read_customer_by_id(customer_id: int, db: Prisma = Depends(get_db)):
    try:
        customer = await db.customer.find_unique(
            where={"customer_id" : customer_id},
            include={
                "ownedTrips": {
                    "include": {
                        "members": True,
                        "tripPlans": True,
                        "budget": True,
                    }
                }
            ,
                "memberships": True},
        )
        return customer
    except Exception as e:
        return {"error": str(e)}


@app.post("/customer")
async def create_customer(customer: Customer, db: Prisma = Depends(get_db)):
    try:
        customer = customer.model_dump()
        customers = await db.customer.create(
            data=customer
        )
        return customers
    
    except Exception as e:
        return {"error": str(e)}

@app.put("/customer/{customer_id}")
async def update_customer(customer_id: int, customer: Customer, db: Prisma = Depends(get_db)):
    try:
        customer = customer.model_dump()
        customers = await db.customer.update(
            where={"customer_id": customer_id},
            data=customer
        )
        return customers
    
    except Exception as e:
        return {"error": str(e)}


@app.delete("/customer/{customer_id}")
async def delete_customer(customer_id: int, db: Prisma = Depends(get_db)):
    try:
        customer = await db.customer.delete(
            where={"customer_id": customer_id}
        )
        return customer
    
    except Exception as e:
        return {"error": str(e)}

# ==================== trip group ===================

async def get_current_user(
    request: Request,
    db: Prisma = Depends(get_db)
):
    email = getattr(request.state, "email", None)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await db.customer.find_unique(where={"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/trip_group")
async def read_trip_group(db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:

        print("current_user_id:", current_user.customer_id)
        
        trip_group = await db.tripgroup.find_many(
            where={"owner_id": current_user.customer_id},
            include={
                "owner": True,
                "members": True,
                "tripSchedules": True,
                "budget": True
            }
        )
        
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}

@app.get("/trip_group/{trip_id}")
async def read_trip_group_by_id(trip_id: int, db: Prisma = Depends(get_db), current_user = Depends(get_current_user) ):
    try:
        trip_group = await db.tripgroup.find_unique(
            where={"trip_id": trip_id},
            include={
                "owner": True,
                "members": True,
                "tripSchedules": True,
                "budget": True
            }
        )

        if not trip_group:
            return {"error": "Trip not found"}
        
        if trip_group.owner_id != current_user.customer_id:
            return {"error": "You are not authorized to view this trip"}
        
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}
    
    
def generate_unique_code(length=8):
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

async def generate_unique_code_not_exists(db: Prisma, length=8) -> str:
    max_attempts = 10
    for _ in range(max_attempts):
        code = generate_unique_code(length)
        existing = await db.tripgroup.find_unique(where={"uniqueCode": code})
        if not existing:
            return code
    raise Exception("ไม่สามารถสร้างโค้ดที่ไม่ซ้ำได้")


@app.post("/trip_group")
async def create_trip_group(trip_group: TripGroup, request: Request ,db: Prisma = Depends(get_db), ):
    print("👉 received payload:", trip_group)

    try:
        trip_group = trip_group.model_dump()
         
        email = request.state.email
        user = await db.customer.find_unique(where={"email": email})
        if not user:
            return JSONResponse(status_code=404, content={"detail": "User not found"})
        
        unique_code = await generate_unique_code_not_exists(db)
        
        trip_group["owner_id"] = user.customer_id
        trip_group["uniqueCode"] = unique_code
       

        trip_groups = await db.tripgroup.create(
            data=trip_group
        )
        
        print(f"Created trip group with unique code: {unique_code}")
        return trip_groups

    except Exception as e:
        return {"error": str(e)}
    
@app.put("/trip_group/{trip_id}")
async def update_trip_group(trip_id: int, trip_group: TripGroup, db: Prisma = Depends(get_db)):
    try:
        trip_group = trip_group.model_dump()
        trip_groups = await db.tripgroup.update(
            where={"trip_id": trip_id},
            data=trip_group
        )
        return trip_groups
    
    except Exception as e:
        return {"error": str(e)}

@app.delete("/trip_group/{trip_id}")
async def delete_trip_group(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_group = await db.tripgroup.delete(
            where={"trip_id": trip_id}
        )
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}


# ================== Group Member ===================

@app.get("/group_member")
async def read_group_member(db: Prisma = Depends(get_db)):
    try:
        group_member = await db.groupmember.find_many(
            
        )
        return group_member
    
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/group_member/{group_member_id}")
async def read_group_member_by_id(group_member_id: int, db: Prisma = Depends(get_db)):
    try:
        group_member = await db.groupmember.find_unique(
            where={"group_member_id": group_member_id}
        )
        return group_member
    
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/group_member/trip/{trip_id}")
async def read_group_member_by_trip_id(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        group_member = await db.groupmember.find_many(
            where={"trip_id": trip_id}
        )
        return group_member
    
    except Exception as e:
        return {"error": str(e)}


@app.post("/group_member")
async def create_group_member(group_member: GroupMember, db: Prisma = Depends(get_db)):
    try:
        group_member = group_member.model_dump()
        group_members = await db.groupmember.create(
            data=group_member
        )
        return group_members
    
    except Exception as e:
        return {"error": str(e)}


@app.delete("/group_member/{group_member_id}")
async def delete_group_member(group_member_id: int, db: Prisma = Depends(get_db)):
    try:
        group_member = await db.groupmember.delete(
            where={"group_member_id": group_member_id}
        )
        return group_member
    
    except Exception as e:
        return {"error": str(e)}


# ================ Budget ================

@app.get("/budget")
async def read_budget(db: Prisma = Depends(get_db)):
    try:
        budget = await db.budget.find_many(
            include={
                "expenses": True
            }
        )
        return budget
    
    except Exception as e:
        return {"error": str(e)}

@app.get("/budget/{budget_id}")
async def read_budget_by_id(budget_id: int, db: Prisma = Depends(get_db)):
    try:
        budget = await db.budget.find_unique(
            where={"budget_id": budget_id},
            include={
                "expenses": True
            }
        )
        return budget
    except Exception as e:
        return {"error": str(e)}

@app.get("/budget/trip/{trip_id}")
async def read_budget_by_trip_id(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        budget = await db.budget.find_many(
            where={"trip_id": trip_id},
            include={
                "expenses": True
            }
        )
        return budget
    
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/budget")
async def create_budget(budget: Budget, db: Prisma = Depends(get_db)):
    try:
        budget = budget.model_dump()
        budgets = await db.budget.create(
            data = budget
        )
        return budgets
    
    except Exception as e:
        return {"error": str(e)}

@app.put("/budget/{budget_id}")
async def update_budget(budget_id: int, budget: Budget, db: Prisma = Depends(get_db)):
    try: 
        budget = budget.model_dump()
        budgets = await db.budget.update(
            where={"budget_id": budget_id},
            data=budget
        )
        return budgets
    
    except Exception as e:
        return {"error": str(e)}
    
@app.delete("/budget/{budget_id}")
async def delete_budget(budget_id: int, db: Prisma = Depends(get_db)):
    try: 
        budget = await db.budget.delete(
            where={"budget_id": budget_id}
        )
        return budget
    except Exception as e:
        return {"error": str(e)}


# ================= Expense ==================

@app.get("/expense")
async def read_expense(db: Prisma = Depends(get_db)):
    try: 
        expense = await db.expense.find_many()
        return expense
    
    except Exception as e:
        return {"error": str(e)}

@app.get("/expense/{expense_id}")
async def read_expense_by_id(expense_id: int, db: Prisma = Depends(get_db)):
    try:
        expense = await db.expense.find_unique(
            where={"expense_id": expense_id}
        )
        return expense
    
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/expense")
async def create_expense(expense: Expense, db: Prisma = Depends(get_db)):
    try:
        expense = expense.model_dump()
        expenses = await db.expense.create(
            data = expense
        )
        return expenses
    
    except Exception as e:
        return {"error": str(e)}

@app.put("/expense/{expense_id}")
async def update_expense(expense_id: int, expense: Expense, db: Prisma = Depends(get_db)):
    try:
        expense = expense.model_dump()
        expenses = await db.expense.update(
            where={"expense_id": expense_id},
            data=expense
        )
        return expenses
    
    except Exception as e:
        return {"error": str(e)}
    
@app.delete("/expense/{expense_id}")
async def delete_expense(expense_id: int, db: Prisma = Depends(get_db)):
    try:
        expense = await db.expense.delete(
            where={"expense_id": expense_id}
        )
        return expense
    
    except Exception as e:
        return {"error": str(e)}
    


# ==================== Trip Plan ===================

@app.get("/trip_plan")
async def read_trip_plan(db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        print("current_user_id:", current_user.customer_id)

        trip_plan = await db.tripplan.find_many(
            where={"creator_id": current_user.customer_id},
            include={
                "schedules": True,
            }
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}



@app.get("/trip_plan/{plan_id}")
async def read_trip_plan_by_id(plan_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_plan = await db.tripplan.find_unique(
            where={"plan_id": plan_id},
            include={
                "schedules": True,
            }
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/trip_plan/trip/{trip_id}")
async def read_trip_plan_by_id(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_plan = await db.tripplan.find_many(
            where={"trip_id": trip_id},
            include={
                "schedules": True,
            }
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/trip_plan")
async def create_trip_plan(trip_plan: TripPlan, db: Prisma = Depends(get_db), current_user: Customer = Depends(get_current_user)):
    try:

        trip_plan = trip_plan.model_dump()
        trip_plan["creator_id"] = current_user.customer_id
        trip_plan["day_of_trip"] = (trip_plan["end_plan_date"] - trip_plan["start_plan_date"]).days + 1
        
        trip_plans = await db.tripplan.create(
            data=trip_plan
        )

        await db.budget.create(
            data={
                "plan_id": trip_plans.plan_id,
                "total_budget": 0
            }
        )

        return trip_plans
    
    

    
    except Exception as e:
        print("🔥 Validation Error:", e)
        return {"error": str(e)}



@app.put("/trip_plan/{plan_id}")
async def update_trip_plan(plan_id: int, trip_plan: TripPlan, db: Prisma = Depends(get_db)):
    try:
        trip_plan = trip_plan.model_dump()
        trip_plans = await db.tripplan.update(
            where={"plan_id": plan_id},
            data=trip_plan
        )
        return trip_plans
    
    except Exception as e:
        return {"error": str(e)}


@app.delete("/trip_plan/{plan_id}")
async def delete_trip_plan(plan_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_plan = await db.tripplan.delete(
            where={"plan_id": plan_id}
        )
        return trip_plan
    
    except Exception as e:
        return {"error": str(e)}


# ================ Trip Schedule ===============

@app.get("/trip_schedule")
async def read_trip_schedule(db: Prisma = Depends(get_db)):
    try:
        trip_schedule = await db.tripschedule.find_many()
        return trip_schedule
    except Exception as e:
        return {"error": str(e)}

@app.get("/trip_schedule/{schedule_id}")
async def read_trip_schedule_by_id(schedule_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_schedule = await db.tripschedule.find_unique(
            where={"schedule_id": schedule_id}
        )
        return trip_schedule
    
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/trip_schedule")
async def create_trip_schedule(trip_schedule: TripSchedule, db: Prisma = Depends(get_db)):
    try:
        trip_schedule = trip_schedule.model_dump()
        trip_schedules = await db.tripschedule.create(
            data=trip_schedule
        )
        return trip_schedules
    
    except Exception as e:
        return {"error": str(e)}

@app.put("/trip_schedule/{schedule_id}")
async def update_trip_schedule(schedule_id: int, trip_schedule: TripSchedule, db: Prisma = Depends(get_db)):
    try:
        trip_schedule = trip_schedule.model_dump()
        trip_schedules = await db.tripschedule.update(
            where={"schedule_id": schedule_id},
            data=trip_schedule
        )
        return trip_schedules
    
    except Exception as e:
        return {"error": str(e)}

@app.delete("/trip_schedule/{schedule_id}")
async def delete_trip_schedule(schedule_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_schedule = await db.tripschedule.delete(
            where={"schedule_id": schedule_id}
        )
        return trip_schedule
    
    except Exception as e:
        return {"error": str(e)}
