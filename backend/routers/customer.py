from fastapi import APIRouter, Depends, HTTPException
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

@router.patch("/customer/{customer_id}") 
async def update_user(customer_id : int, user_update: Customer, db: Prisma = Depends(get_db),):
    update_data = user_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided to update")
    try:
        # 3. สั่ง update ลง DB (Prisma จะ update เฉพาะ column ที่มีใน update_data)
        updated_user = await db.customer.update(
            where={"customer_id": customer_id},
            data=update_data
        )
        
        return updated_user

    except Exception as e:
        print(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user information")

@router.delete("/customer/{customer_id}")
async def delete_customer(customer_id: int, db: Prisma = Depends(get_db)):
    try:
        customer = await db.customer.delete(
            where={"customer_id": customer_id}
        )
        return customer
    
    except Exception as e:
        return {"error": str(e)}