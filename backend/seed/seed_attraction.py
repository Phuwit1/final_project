# seed.py (สำหรับ CacheAttraction)
import asyncio
import os
import httpx
from prisma import Prisma
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

ATTRACTIONS = [
    {"name": "Senso-ji", "city_name": "Tokyo"},
    {"name": "Tokyo Tower", "city_name": "Tokyo"},
    {"name": "Fushimi Inari Taisha", "city_name": "Kyoto"},
    {"name": "Kiyomizu-dera", "city_name": "Kyoto"},
    {"name": "Universal Studios Japan", "city_name": "Osaka"},
]

async def find_place_id(place_name):
    if not GOOGLE_API_KEY:
        print("❌ Error: Missing API Key")
        return None
        
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id"
    }
    payload = {"textQuery": place_name}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                if data.get('places'):
                    return data['places'][0]['id']
        except Exception as e:
            print(f"⚠️ Connection Error: {e}")
    return None

async def main():
    print("🌱 Starting Seed...")
    db = Prisma()
    await db.connect()

    for item in ATTRACTIONS:
        # 1. จัดการ City
        city = await db.city.find_unique(where={'name': item['city_name']})
        if not city:
            print(f"Creating city: {item['city_name']}")
            city = await db.city.create(data={
                'name': item['city_name'],
                'image_url': 'https://via.placeholder.com/300' 
            })

        # 2. หา Place ID
        print(f"🔍 Searching ID for: {item['name']}...")
        place_id = await find_place_id(item['name'])

        if place_id:
            # 3. Save ลง CacheAttraction (ตรงนี้ต้องตรงกับ Schema)
            try:
                await db.cacheattraction.upsert(
                    where={
                        'google_place_id': place_id 
                    },
                    data={
                        'create': {
                            'name': item['name'],
                            'google_place_id': place_id,
                            'city_id': city.city_id
                        },
                        'update': {
                            'name': item['name'],
                            'city_id': city.city_id
                        }
                    }
                )
                print(f"✅ Seeded: {item['name']}")
            except Exception as e:
                print(f"❌ Failed to save {item['name']}: {e}")
        else:
            print(f"⚠️ Could not find Google ID for {item['name']}")

    await db.disconnect()
    print("✨ Finished!")

if __name__ == "__main__":
    asyncio.run(main())