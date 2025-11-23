from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from prisma import Prisma
import string, secrets
from dependencies import get_db, get_current_user
from schemas import TripGroup, GroupMember

router = APIRouter(tags=["Trip"])

def generate_unique_code(length=8):
    characters = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

async def generate_unique_code_not_exists(db: Prisma, length=8) -> str:
    for _ in range(10):
        code = generate_unique_code(length)
        existing = await db.tripgroup.find_unique(where={"uniqueCode": code})
        if not existing:
            return code
    raise Exception("Cannot generate unique code")

# --- Trip Group ---
@router.get("/trip_group")
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

@router.get("/trip_group/{trip_id}")
async def read_trip_group_by_id(trip_id: int, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        trip_group = await db.tripgroup.find_unique(
            where={"trip_id": trip_id},
            include={"owner": True, "members": True, "tripSchedules": True, "budget": True}
        )
        if not trip_group:
            return {"error": "Trip not found"}
        if trip_group.owner_id != current_user.customer_id:
            return {"error": "Unauthorized"}
        return trip_group
    except Exception as e:
        return {"error": str(e)}

@router.post("/trip_group")
async def create_trip_group(trip_group: TripGroup, request: Request, db: Prisma = Depends(get_db)):
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

@router.put("/trip_group/{trip_id}")
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

@router.delete("/trip_group/{trip_id}")
async def delete_trip_group(trip_id: int, db: Prisma = Depends(get_db)):
    try:
        trip_group = await db.tripgroup.delete(
            where={"trip_id": trip_id}
        )
        return trip_group
    
    except Exception as e:
        return {"error": str(e)}

# --- Group Member ---
@router.get("/group_member")
async def read_group_member(db: Prisma = Depends(get_db)):
    try:
        group_member = await db.groupmember.find_many()
        return group_member
    
    except Exception as e:
        return {"error": str(e)}

@router.post("/group_member")
async def create_group_member(group_member: GroupMember, db: Prisma = Depends(get_db)):
    return await db.groupmember.create(data=group_member.model_dump())

@router.delete("/group_member/{group_member_id}")
async def delete_group_member(group_member_id: int, db: Prisma = Depends(get_db)):
    return await db.groupmember.delete(where={"group_member_id": group_member_id})