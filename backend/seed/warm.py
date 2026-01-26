# backend/warmup.py
import asyncio
import sys
import os
from datetime import datetime, timezone

# Import ของจำเป็น
from prisma import Prisma
from service.google_map import fetch_google_place_details

async def main():
    print("🔥 Starting Cache Warmup (ดึงข้อมูลรวดเดียว)...")
    
    # 1. เชื่อมต่อ Database
    db = Prisma()
    await db.connect()

    # 2. ดึงสถานที่ทั้งหมดออกมา (หรือจะเลือกเฉพาะที่ยังไม่มีข้อมูลก็ได้)
    # ถ้าอยากดึงเฉพาะอันที่ยังไม่เคย Cache ให้เพิ่ม where={ 'last_fetched_at': None }
    all_attractions = await db.cacheattraction.find_many()
    
    total = len(all_attractions)
    print(f"🎯 Found {total} attractions to update.")

    for index, attraction in enumerate(all_attractions):
        print(f"[{index+1}/{total}] Fetching: {attraction.name}...")
        
        try:
            # 3. ยิง Google API (เหมือนใน Service แต่ทำวนลูป)
            google_data = await fetch_google_place_details(attraction.google_place_id)
            
            if google_data:
                # Map ข้อมูล
                new_rating = google_data.get("rating")
                new_review_count = google_data.get("userRatingCount")
                new_address = google_data.get("formattedAddress")
                summary_obj = google_data.get("editorialSummary", {})
                new_description = summary_obj.get("text")
                new_types = google_data.get("types", [])
                    
                photos = google_data.get("photos", [])
                new_photo_ref = photos[0]["name"] if photos else None 

                # 4. บันทึกลง DB ทันที
                await db.cacheattraction.update(
                    where={"attraction_id": attraction.attraction_id},
                    data={
                        "rating": new_rating,
                        "review_count": new_review_count,
                        "address": new_address,
                        "photo_ref": new_photo_ref,
                        "last_fetched_at": datetime.now(timezone.utc),
                        "description": new_description,
                        "place_types": new_types
                    }
                )
                print(f"   ✅ Updated!")
            else:
                print(f"   ⚠️ No data from Google")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

        # (Optional) หน่วงเวลาสักนิดกัน Google ตกใจ (0.1 วินาที)
        await asyncio.sleep(0.1)

    # 5. ปิด Connection
    await db.disconnect()
    print("✨ All Done! Cache is hot and ready.")

if __name__ == "__main__":
    asyncio.run(main())