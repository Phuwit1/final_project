from fastapi import APIRouter, Depends
from prisma import Prisma
from dependencies import get_db
from schemas import Budget, BudgetUpdate, Expense

router = APIRouter(tags=["Budget"])


# --- Budget ---
@router.get("/budget/plan/{plan_id}")
async def read_budget_by_id(plan_id: int, db: Prisma = Depends(get_db)):
    try:
        budget = await db.budget.find_unique(
            where={"plan_id": plan_id},
            include={
                "expenses": True
            }
        )
        return budget
    except Exception as e:
        return {"error": str(e)}

@router.post("/budget")
async def create_budget(budget: Budget, db: Prisma = Depends(get_db)):
    try:
        budget = budget.model_dump()
        budgets = await db.budget.create(
            data = budget
        )
        return budgets
    
    except Exception as e:
        return {"error": str(e)}

@router.put("/budget/{budget_id}")
async def update_budget(budget_id: int, budget: BudgetUpdate, db: Prisma = Depends(get_db)):
    try: 
        budgets = await db.budget.update(
            where={"budget_id": budget_id},
            data=budget.model_dump()
        )
        return budgets
    except Exception as e:
        return {"error": str(e)}

@router.delete("/budget/{budget_id}")
async def delete_budget(budget_id: int, db: Prisma = Depends(get_db)):
    try: 
        budget = await db.budget.delete(
            where={"budget_id": budget_id}
        )
        return budget
    except Exception as e:
        return {"error": str(e)}

# --- Expense ---
@router.post("/expense")
async def create_expense(expense: Expense, db: Prisma = Depends(get_db)):
    try:
        expense = expense.model_dump()
        expenses = await db.expense.create(
            data = expense
        )
        return expenses
    
    except Exception as e:
        return {"error": str(e)}

@router.put("/expense/{expense_id}")
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
    
@router.delete("/expense/{expense_id}")
async def delete_expense(expense_id: int, db: Prisma = Depends(get_db)):
    try:
        expense = await db.expense.delete(
            where={"expense_id": expense_id}
        )
        return expense
    
    except Exception as e:
        return {"error": str(e)}