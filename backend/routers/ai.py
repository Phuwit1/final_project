from fastapi import APIRouter, Depends
from schemas import ChatBody
from llm import query_llm, query_llm_fix, Item, FixRequest
import re

router = APIRouter(tags=["AI"])

nav_re = re.compile(r"(?:ไป\s*วันที่|ไป\s*วัน|วันที่|วัน|day)\s*(\d{1,2})", re.I)
fix_keywords = ["แก้","เปลี่ยน","เพิ่ม","ลบ","ย้าย","สลับ","update","change","edit","add","remove"]

@router.post("/llm/")
async def create_itinerary(item: Item):
    return await query_llm(item)

@router.post("/llm/fix/")
async def fix_itinerary(req: FixRequest):
    return await query_llm_fix(req)

@router.post("/ai/chat")
async def ai_chat(body: ChatBody):
    if not body.messages:
        return {"reply": "พิมพ์ข้อความมาได้เลยค่ะ"}

    user_text = body.messages[-1].content.strip()
    m = nav_re.search(user_text)
    if m:
        day = int(m.group(1))
        return {"reply": f"ไปวันที่ {day} นะคะ", "action": {"type": "goto_day", "day": day}}

    if body.itinerary_data and any(k in user_text.lower() for k in fix_keywords):
        fixed = query_llm_fix(FixRequest(start_date=body.start_date, end_date=body.end_date, cities=[], text=user_text, itinerary_data=body.itinerary_data))
        return {"reply": "ปรับแผนให้แล้วค่ะ", "itinerary": fixed}

    generated = await query_llm(Item(start_date=body.start_date, end_date=body.end_date, cities=[], text=user_text))
    return {"reply": "นี่คือร่างแผนทริปค่ะ", "itinerary": generated}