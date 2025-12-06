from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from prisma import Prisma
import string, secrets
from dependencies import get_db, get_current_user
from schemas import TripGroup, GroupMember, JoinGroupRequest

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
            include={
                "owner": True,
                "members": {
                    "include": {
                        "customer": True 
                    }
                },
                "budget": True,
                "tripPlan": {
                    "include": {
                        "schedules": True 
                    }
                }
            }
        )
       
        if not trip_group:
            return {"error": "Trip not found"}
        is_member = any(m.customer_id == current_user.customer_id for m in trip_group.members)
        
        if trip_group.owner_id != current_user.customer_id and not is_member:
             raise HTTPException(status_code=403, detail="Unauthorized")
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
    

    # --- backend/routers/trip.py ---

@router.post("/trip_group/create_from_plan/{plan_id}")
async def create_group_from_plan(plan_id: int, request: Request, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
   
    # 2. หา TripPlan ต้นทาง
    trip_plan = await db.tripplan.find_unique(where={"plan_id": plan_id})
    if not trip_plan:
        raise HTTPException(status_code=404, detail="Trip Plan not found")
    
    # ตรวจสอบว่าเป็นคนสร้าง Plan หรือไม่
    if trip_plan.creator_id != current_user.customer_id:
        raise HTTPException(status_code=403, detail="Only the plan creator can create a group")

    # 3. เช็คว่า Plan นี้มี Group อยู่แล้วหรือยัง
    if trip_plan.trip_id is not None:
         # กรณีมีอยู่แล้ว อาจจะคืนค่า Group เดิมกลับไป หรือแจ้ง Error ก็ได้
         existing_group = await db.tripgroup.find_unique(where={"trip_id": trip_plan.trip_id})
         return existing_group

    try:
        # 4. สร้าง Unique Code
        unique_code = await generate_unique_code_not_exists(db)

        # 5. สร้าง TripGroup + Add Member + Link TripPlan (ใช้ Transaction ผ่านการ Nest create)
        # หมายเหตุ: Prisma Python รองรับ Nested writes
        new_trip_group = await db.tripgroup.create(
            data={
                "start_date": trip_plan.start_plan_date,
                "end_date": trip_plan.end_plan_date,
                "owner_id": current_user.customer_id,
                "uniqueCode": unique_code,
                "description": "Group created from Trip Plan",
                "plan_id": trip_plan.plan_id,
                # เพิ่ม User เป็น Member คนแรกทันที
                "members": {
                    "create": {
                        "customer_id": current_user.customer_id
                    }
                }
            }
        )

        # 6. อัปเดต TripPlan ให้ชี้ไปที่ Group ใหม่
        await db.tripplan.update(
            where={"plan_id": plan_id},
            data={"trip_id": new_trip_group.trip_id}
        )
        
        return new_trip_group

    except Exception as e:
        print(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trip_group/code/{unique_code}")
async def get_trip_by_code(unique_code: str, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        trip = await db.tripgroup.find_unique(
            where={"uniqueCode": unique_code},
            include={
                "owner": True,
                "members": True,
                "tripPlan": True  # ✅ เพิ่ม: ดึง TripPlan มาด้วยเพื่อเอาชื่อกลุ่ม
            }
        )
        if not trip:
            raise HTTPException(status_code=404, detail="ไม่พบกลุ่มนี้")
        
        # เช็คสถานะสมาชิก
        is_member = any(m.customer_id == current_user.customer_id for m in trip.members)
        
        # ✅ ดึงชื่อจาก TripPlan ถ้าไม่มีให้ใช้ "No Name"
        group_name = trip.tripPlan.name_group if trip.tripPlan else "No Name"

        return {
            "trip_id": trip.trip_id,
            "name_group": group_name,  # ✅ ส่งชื่อที่ดึงมากลับไปให้ Frontend
            "description": trip.description,
            "owner_name": f"{trip.owner.first_name} {trip.owner.last_name}",
            "member_count": len(trip.members),
            "start_date": trip.start_date,
            "end_date": trip.end_date,
            "is_member": is_member
        }
    except Exception as e:
        print(f"Error getting trip by code: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/trip_group/join")
async def join_group(data: JoinGroupRequest, request: Request, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    # 1. ตรวจสอบ User
   

    # 2. หา Group จาก Code
    trip_group = await db.tripgroup.find_unique(
        where={"uniqueCode": data.unique_code},
        include={"members": True}
    )
    
    if not trip_group:
        raise HTTPException(status_code=404, detail="Invalid Group Code")

    # 3. เช็คว่าอยู่ในกลุ่มแล้วหรือยัง
    is_member = any(m.customer_id == current_user.customer_id for m in trip_group.members)
    if is_member:
        return {"message": "Already a member", "trip_group": trip_group}

    # 4. เพิ่ม Member
    try:
        await db.groupmember.create(
            data={
                "customer_id": current_user.customer_id,
                "trip_id": trip_group.trip_id
            }
        )
        
        # return ข้อมูลกลุ่มล่าสุดกลับไป
        updated_group = await db.tripgroup.find_unique(where={"trip_id": trip_group.trip_id})
        return updated_group

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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


@router.delete("/trip_group/{trip_id}/leave")
async def leave_trip_group(trip_id: int, db: Prisma = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        # ลบสมาชิกออกจากกลุ่ม
        await db.groupmember.delete_many(
            where={
                "trip_id": trip_id,
                "customer_id": current_user.customer_id
            }
        )
        return {"message": "Left the trip group successfully"}
    
    except Exception as e:
        return {"error": str(e)}
    

    # ✅ อันนี้เพิ่มใหม่! เอาไว้ให้ Owner กด "ลบสมาชิก" (Kick)
@router.delete("/trip_group/{trip_id}/members/{group_member_id}") # ✅ เปลี่ยนชื่อตัวแปรให้ชัดเจน
async def remove_member(
    trip_id: int, 
    group_member_id: int, # ✅ รับเป็น group_member_id (PK)
    db: Prisma = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    try:
        # 1. ตรวจสอบสิทธิ์ Owner
        trip = await db.tripgroup.find_unique(where={"trip_id": trip_id})
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        if trip.owner_id != current_user.customer_id:
            raise HTTPException(status_code=403, detail="Only the owner can remove members")

        # 2. ตรวจสอบว่าสมาชิกคนนี้อยู่ในทริปนี้จริงหรือไม่ (และหาตัวตนก่อนลบ)
        target_member = await db.groupmember.find_unique(
            where={"group_member_id": group_member_id}
        )

        if not target_member or target_member.trip_id != trip_id:
            raise HTTPException(status_code=404, detail="Member not found in this group")

        # 3. ป้องกัน Owner ลบตัวเอง (เช็คจาก customer_id ของเป้าหมาย)
        if target_member.customer_id == current_user.customer_id:
             raise HTTPException(status_code=400, detail="Cannot remove yourself via this endpoint")

        # 4. ทำการลบ (ใช้ delete ธรรมดาเพราะลบจาก ID โดยตรง)
        await db.groupmember.delete(
            where={"group_member_id": group_member_id}
        )
        
        return {"message": "Member removed successfully"}

    except Exception as e:
        print(f"Error removing member: {e}")
        # ถ้า error เป็น HTTPException ให้ raise ต่อไปเลย
        if isinstance(e, HTTPException):
            raise e
        return JSONResponse(status_code=500, content={"error": str(e)})