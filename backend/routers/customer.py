from fastapi import APIRouter, Depends
from prisma import Prisma
from dependencies import get_db
from schemas import Customer

router = APIRouter(tags=["Customer"])

@router.get("/customer")
async def read_customer(db: Prisma = Depends(get_db)):
    try:
        return await db.customer.find_many(
            include={
                "ownedTrips": {"include": {"members": True, "tripPlans": True, "budget": True}},
                "memberships": True
            },
        )
    except Exception as e:
        return {"error": str(e)}

@router.get("/customer/{customer_id}")
async def read_customer_by_id(customer_id: int, db: Prisma = Depends(get_db)):
    try:
        return await db.customer.find_unique(
            where={"customer_id": customer_id},
            include={
                "ownedTrips": {"include": {"members": True, "tripPlans": True, "budget": True}},
                "memberships": True
            },
        )
    except Exception as e:
        return {"error": str(e)}

@router.post("/customer")
async def create_customer(customer: Customer, db: Prisma = Depends(get_db)):
    try:
        customer = customer.model_dump()
        customers = await db.customer.create(
            data=customer
        )
        return customers
    
    except Exception as e:
        return {"error": str(e)}

@router.put("/customer/{customer_id}")
async def update_customer(customer_id: int, customer: Customer, db: Prisma = Depends(get_db)):
    try:
        customer = customer.model_dump(exclude_unset=True)
        customers = await db.customer.update(
            where={"customer_id": customer_id},
            data=customer
        )
        return customers
    
    except Exception as e:
        return {"error": str(e)}


@router.delete("/customer/{customer_id}")
async def delete_customer(customer_id: int, db: Prisma = Depends(get_db)):
    try:
        customer = await db.customer.delete(
            where={"customer_id": customer_id}
        )
        return customer
    
    except Exception as e:
        return {"error": str(e)}