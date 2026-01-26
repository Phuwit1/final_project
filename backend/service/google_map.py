import httpx
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

async def fetch_google_place_details(place_id: str):
    if not GOOGLE_API_KEY:
        print("❌ Error: GOOGLE_API_KEY not found in .env")
        return None

    url = f"https://places.googleapis.com/v1/places/{place_id}"
    
    params = {
        "fields": "rating,userRatingCount,formattedAddress,photos,editorialSummary,types",
        "key": GOOGLE_API_KEY
    }
    
    # ใช้ภาษาอังกฤษเป็น default หรือเปลี่ยนเป็น 'th' ถ้าต้องการข้อมูลภาษาไทย
    headers = {"Accept-Language": "en"} 

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️ Google API Error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"⚠️ Connection Error: {e}")
            return None