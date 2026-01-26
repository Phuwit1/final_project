# app/services/attraction_service.py

from datetime import datetime, timezone, timedelta

from service.google_map import fetch_google_place_details
from db import db


CACHE_DURATION_DAYS = 7 

async def get_attraction_with_cache(attraction_id: int):
    attraction = await db.cacheattraction.find_unique(
        where={"attraction_id": attraction_id},
        include={"city": True}
    )

    if not attraction:
        return None

    is_expired = False
    now = datetime.now(timezone.utc)
    
    if attraction.last_fetched_at:
        last_fetched = attraction.last_fetched_at
        if last_fetched.tzinfo is None:
            last_fetched = last_fetched.replace(tzinfo=timezone.utc)
            
        age = now - last_fetched
        if age.days >= CACHE_DURATION_DAYS:
            is_expired = True
    else:
        is_expired = True

    if is_expired:
        print(f"🔄 Refreshing cache for attraction ID: {attraction_id} ({attraction.name})")
        google_data = await fetch_google_place_details(attraction.google_place_id)
        
        if google_data:
        
            new_rating = google_data.get("rating")
            new_review_count = google_data.get("userRatingCount")
            new_address = google_data.get("formattedAddress")
            summary_obj = google_data.get("editorialSummary", {})
            new_description = summary_obj.get("text")
            new_types = google_data.get("types", [])
        
            photos = google_data.get("photos", [])
            new_photo_ref = None
            if photos and len(photos) > 0:
                # API V1 จะส่งมาเป็น resource name เช่น "places/PLACE_ID/photos/PHOTO_UID"
                new_photo_ref = photos[0]["name"] 

            # 4. อัปเดตข้อมูลลง Database (Cache)
            attraction = await db.cacheattraction.update(
                where={"attraction_id": attraction_id},
                data={
                    "rating": new_rating,
                    "review_count": new_review_count,
                    "address": new_address,
                    "photo_ref": new_photo_ref,
                    "last_fetched_at": now,
                    "description": new_description,
                    "place_types": new_types
                },
                include={"city": True} # return ข้อมูลเมืองกลับไปด้วย
            )
            
    return attraction