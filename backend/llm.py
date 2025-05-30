from typing import Union, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
import psycopg2
from sentence_transformers import SentenceTransformer
import ollama
import json
# import uvicorn

# if __name__ == "__main__":
    # uvicorn.run("llm:app", host="0.0.0.0", port=8000, reload=True)

app = FastAPI()
embedder = SentenceTransformer("BAAI/bge-m3")

class Item(BaseModel):
    start_date : str
    end_date : str
    text: str

class FixRequest(BaseModel):
    text: str
    itinerary_data: Dict[str, Any]

    
def query_documents(query_text, k=3):
    conn = psycopg2.connect(
        host="localhost",
        database="LLM",
        user="postgres",
        password="password"
    )

    cur = conn.cursor()
    query_embedding = embedder.encode(query_text).tolist()
    query_embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    query = """
        SELECT content, embedding <=> %s::vector AS similarity_score
        FROM documents
        ORDER BY similarity_score ASC
        LIMIT %s
    """
    cur.execute(query, (query_embedding_str, k))
    results = cur.fetchall()
    cur.close()
    conn.close()
    print("Query results:", results)
    return results

# ข้อมูลสภาพอากาศในญี่ปุ่น
def get_season_data():
    return {
        "Spring: March - May": {
            "description": "Spring begins with plum blossoms blooming around the country, the precursor to Japan's famous cherry blossoms in spring. Cherry blossoms are at their peak in Tokyo around the end of March and the beginning of April. Enjoy incredible views of Japan's varied landscapes- cities, mountains, temples, shrines, and gardens- all enveloped in light pink.",
            "clothing": "Light jackets, light sweaters, with a light coat on top. Layers work best as it gets warm during the day but it can still be very chilly at night."
        },
        "Summer: June - August/September": {
            "description": "The Japanese summer begins in June with a three to four week rainy season. This is actually one of the best times for festivals, though, because it is such an important season for rice planting. As an added bonus, travel can be cheaper because of the weather, and tourist spots will be less crowded, too. It is staggeringly hot and humid from July, August, and usually even through September. Many Japanese enjoy bathing in the sea and relaxing at cool resorts in the north of Japan and in the mountains.",
            "clothing": "Light clothes, rain boots, ponchos/umbrellas."
        },
        "Autumn: September/October - November": {
            "description": "Autumn in Japan begins in different places in different times within Japan. In the north, it comes sooner, but in major cities like Tokyo, Kyoto, and Osaka, you'll find that September brings some respite from summer but that it is still hot and humid. When fall does come, though, the colors are beautiful, surrounding Japan's unique architecture and landscape in a shock of brilliant yellow, orange, and red.",
            "clothing": "Light jackets, light sweaters and other similar kinds of tops."
        },
        "Winter: December - February":{
            "description": "Winter in Japan can be very, very cold. While there isn't much snow in many parts of the country, central and northern Japan have some of the world's best powder snow that's perfect for winter sports.",
            "clothing": "Coats, sweaters, thick socks."
        }
    }



@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}

@app.post("/items/")
async def create_item(item: Item):
    return item


@app.post("/llm/")
async def query_llm(text: Item):
    retrieved_docs = query_documents(text.text)
    context = "\n".join([i[0] for i in retrieved_docs])
    season_data = get_season_data()
    json_structure = """
    {
        "itinerary": [
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" }
            ]
            },
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" }
            ]
            }
        ],
        "comments": "comments or additional notes about the itinerary"
    }
    """
    prompt = f"""Generate a detailed travel itinerary in JSON format. 
        
        The itinerary must include:  
        - **Multiple days** with specific dates (`YYYY-MM-DD`).  
        - **Day labels** (e.g., `"Day 1"`, `"Day 2"`).  
        - **A schedule** for each day, containing: 
        - **Time slots** (`HH:mm`, 24-hour format).  
        - **Activities** for each time slot.
        
        - **Comments** or additional notes about the itinerary **example about the season for example, is that month suitable for that kind of weather? Like going to see cherry blossoms in a month when they’re not blooming. ** here is season data {season_data}.
    

        Ensure the response **ONLY** contains valid JSON without any explanations or additional text. Use the following context: {context}.
        *** The trip starts on **{text.start_date}** 'DD-MM-YYYY' and ends on **{text.end_date}** 'DD-MM-YYYY'. ***
        json_structure: {json_structure}
    """
    # ถ้าภาษาไทยเพิ่มด้านบนด้วย ^^^^ ตรง activities + ข้างล่าง json_structure
    response = ollama.chat(model="gemma3:4b", messages=[
        {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip."},
        # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
        {"role": "user", "content" : prompt},
    ])
    
    response_answer = response.get("message", {}).get("content", "No content available")
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    # return response_answer
    try:
        data = json.loads(response_answer)
        print("Method 1 successful")
    except json.JSONDecodeError as e:
        print(f"Method 1 failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")

    return data

@app.post("/llm/fix/")
def query_llm_fix(text: FixRequest):
    retrieved_docs = query_documents(text.text)
    context = "\n".join([i[0] for i in retrieved_docs])
    season_data = get_season_data()
    # Convert itinerary_data to a JSON string for the prompt
    itinerary_json = str(json.dumps(text.itinerary_data))
    
    json_structure = """
    {
        "itinerary": [
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" }
            ]
            },
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" },
                { "time": "HH:mm", "activity": "" }
            ]
            }
        ],
        "comments": "comments or additional notes about the itinerary"
    }
    """
    # prompt = f"""can you change activities in day 2 to watching movies and day 3 to go to the beach from this itinerary: {itinerary_json}."""
    # prompt = f"""Change activities from this itinerary: {itinerary_json} based on the following user request. ** This is an request: {text.text} ** """
    prompt = f"""Change the activities in this itinerary: {itinerary_json}

        Your task:
        1. MODIFY THE ACTIVITIES based on this user request: {text.text}
        2. Use this additional context to improve the travel plan: {context}
        3. You MUST REPLACE the original activities with new ones that align with the user's request

        Requirements for the modified itinerary:
        - Maintain the same structure with multiple days (YYYY-MM-DD format)
        - Keep the day labels (e.g., "Day 1", "Day 2")
        - Preserve the time slots (HH:mm, 24-hour format)
        - REPLACE the activities with new ones that match the user request
        - Include relevant comments about seasonal appropriateness using this data: {season_data}
        (e.g., check if activities match seasonal conditions like cherry blossoms blooming periods)

        DO NOT keep the original activities. Your response should only contain the modified JSON following this structure: {json_structure}.

        IMPORTANT: The activities in your response must be DIFFERENT from the original itinerary.
    """
    
    response = ollama.chat(model="gemma3:4b", messages=[
        {"role": "system", "content": "You are an assistant that helps to refine and improve travel itineraries activity."},
        # {"role": "system", "content": "You are an assistant that helps to refine travel itineraries in **thai language**."},
        {"role": "user", "content": prompt},
    ])
    
    response_answer = response.get("message", {}).get("content", "No content available")
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    # return response_answer
    try:
    # Parse the input text directly
        data = json.loads(response_answer)
        print("Method 1 successful")
    except json.JSONDecodeError as e:
        print(f"Method 1 failed: {e}")
    return data

