from fastapi import APIRouter, HTTPException
from service.attraction import get_attraction_with_cache
import os
from db import db

router = APIRouter()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

@router.get("/attractions/{id}")
async def get_attraction(id: int):

    attraction = await get_attraction_with_cache(id)
    if not attraction:
        raise HTTPException(status_code=404, detail="Not found")
    
    # แปลง photo_ref เป็น URL รูปภาพพร้อมใช้
    img_url = None
    if attraction.photo_ref:
        img_url = f"https://places.googleapis.com/v1/{attraction.photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key={GOOGLE_API_KEY}"

    return {
        "id": attraction.attraction_id,
        "name": attraction.name,
        "rating": attraction.rating,
        "image": img_url,
        "address": attraction.address
    }


@router.get("/attractions/")
async def get_all_attractions():
    attractions = await db.cacheattraction.find_many(
        order={
            "rating": "desc"
        }
    )
    return attractions

@router.get("/explore-cities")
async def get_explore_data():
    cities = await db.city.find_many(
        include={
            "attractions": {
                "take": 5,                
                "order_by": {"rating": "desc"} 
            }
        }
    )
    return cities