from fastapi import APIRouter, Depends
from prisma import Prisma
from dependencies import get_db
from schemas import Budget, BudgetUpdate, Expense

router = APIRouter(tags=["Budget"])


# --- Budget ---


@router.get("/budget/trip/{trip_id}")
async def read_budget_by_trip_id(trip_id: int, db: Prisma = Depends(get_db)):
    return await db.budget.find_many(where={"trip_id": trip_id}, include={"expenses": True})

@router.post("/budget")
async def create_budget(budget: Budget, db: Prisma = Depends(get_db)):
    return await db.budget.create(data=budget.model_dump())

@router.put("/budget/{budget_id}")
async def update_budget(budget_id: int, budget: BudgetUpdate, db: Prisma = Depends(get_db)):
    return await db.budget.update(where={"budget_id": budget_id}, data=budget.model_dump())

@router.delete("/budget/{budget_id}")
async def delete_budget(budget_id: int, db: Prisma = Depends(get_db)):
    return await db.budget.delete(where={"budget_id": budget_id})

# --- Expense ---
@router.post("/expense")
async def create_expense(expense: Expense, db: Prisma = Depends(get_db)):
    return await db.expense.create(data=expense.model_dump())

@router.delete("/expense/{expense_id}")
async def delete_expense(expense_id: int, db: Prisma = Depends(get_db)):
    return await db.expense.delete(where={"expense_id": expense_id})