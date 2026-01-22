import asyncio
import os
import httpx
from prisma import Prisma
from dotenv import load_dotenv

# โหลด API Key
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# 🥢 รายชื่อ 6 ร้านอาหารดัง
RESTAURANTS = [
    # 1. ราเมงข้อสอบ (สาขาชิบูย่า) - ต้องไปลองสักครั้ง
    {"name": "Ichiran Ramen Shibuya", "city_name": "Tokyo"},
    
    # 2. ข้าวหน้าเนื้อชุบแป้งทอด (คิวยาวมาก)
    {"name": "Gyukatsu Motomura Shinjuku", "city_name": "Tokyo"},
    
    # 3. ราเมงซุปส้มยูสุ (สดชื่น หอม อร่อย)
    {"name": "Afuri Harajuku", "city_name": "Tokyo"},
    
    # 4. ข้าวห่อไข่ในตำนาน (เชฟหมวกแดง Kichi Kichi)
    {"name": "Kichi Kichi Omurice", "city_name": "Kyoto"},
    
    # 5. ราเมงไฟลุก (Fire Ramen) - โชว์ไฟท่วมหัว
    {"name": "Menbaka Fire Ramen", "city_name": "Kyoto"},
    
    # 6. ปูยักษ์ป้ายขยับได้ (สัญลักษณ์โอซาก้า)
    {"name": "Kani Doraku Dotonbori Honten", "city_name": "Osaka"},
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
    
    # ✅ เพิ่ม includedType เป็น 'restaurant' เพื่อความแม่นยำ
    payload = {
        "textQuery": place_name,
        "includedType": "restaurant" 
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                if data.get('places'):
                    return data['places'][0]['id']
            else:
                print(f"⚠️ Google Error: {res.text}")
        except Exception as e:
            print(f"⚠️ Connection Error: {e}")
    return None

async def main():
    print("🍱 Starting Restaurant Seeding...")
    db = Prisma()
    await db.connect()

    for item in RESTAURANTS:
        # 1. เช็ค/สร้าง City
        city = await db.city.find_unique(where={'name': item['city_name']})
        if not city:
            print(f"Build new city: {item['city_name']}")
            city = await db.city.create(data={
                'name': item['city_name'],
                'image_url': 'https://via.placeholder.com/300' 
            })

        # 2. หา Place ID (เฉพาะร้านอาหาร)
        print(f"🔍 Searching: {item['name']}...")
        place_id = await find_place_id(item['name'])

        if place_id:
            # 3. บันทึกลง DB
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
                print(f"✅ Added: {item['name']}")
            except Exception as e:
                print(f"❌ Failed: {e}")
        else:
            print(f"⚠️ Not found: {item['name']}")

    await db.disconnect()
    print("✨ Bon Appétit! Seeding Finished.")

if __name__ == "__main__":
    asyncio.run(main())