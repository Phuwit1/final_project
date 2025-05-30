from typing import Union
from prisma import Prisma
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from datetime import date, datetime, time, timedelta
# import uvicorn

app = FastAPI()

# if __name__ == "__main__":
#     uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)

# class for request model

class Customer(BaseModel):
    first_name: str
    last_name: str
    email: str
    
class TripGroup(BaseModel):
    owner_id: int
    name_group: str
    description: str
    start_date: datetime
    end_date: datetime
    
class GroupMember(BaseModel):
    customer_id: int
    trip_id: int

class Budget(BaseModel):
    trip_id: int
    total_budget: float

class Expense(BaseModel):
    budget_id: int
    category: str
    amount: float
    description: str

class TripPlan(BaseModel):
    trip_id: int
    start_plan_date: datetime
    end_plan_date: datetime
    day_of_trip: int
    
class TripSchedule(BaseModel):
    plan_id: int
    time: str
    activity: str
    description: str
    


# --- Database Connection ---
async def get_db():
    db = Prisma()
    await db.connect()
    try:
        yield db
    finally:
        await db.disconnect()



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

@app.get("/trip_group")
async def read_trip_group(db: Prisma = Depends(get_db)):
    try:
        trip_group = await db.tripgroup.find_many(
            include={
                "owner": True,
                "members": True,
                "tripPlans": True,
                "budget": True
            }
        )
        
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}

@app.get("/trip_group/{trip_id}")
async def read_trip_group_by_id(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_group = await db.tripgroup.find_unique(
            where={"trip_id": trip_id},
            include={
                "owner": True,
                "members": True,
                "tripPlans": True,
                "budget": True
            }
        )
        
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/trip_group")
async def create_trip_group(trip_group: TripGroup, db: Prisma = Depends(get_db)):
    try:
        trip_group = trip_group.model_dump()
        trip_groups = await db.tripgroup.create(
            data=trip_group
        )
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
async def read_trip_plan(db: Prisma = Depends(get_db)):
    try:
        trip_plan = await db.tripplan.find_many(
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
async def create_trip_plan(trip_plan: TripPlan, db: Prisma = Depends(get_db)):
    try:
        trip_plan = trip_plan.model_dump()
        trip_plans = await db.tripplan.create(
            data=trip_plan
        )
        return trip_plans
    
    except Exception as e:
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
