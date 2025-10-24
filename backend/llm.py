from typing import Union, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from sentence_transformers import SentenceTransformer
from openai import OpenAI

import google.generativeai as genai

from dotenv import load_dotenv
from datetime import datetime
from tavily import TavilyClient
import requests, psycopg2, json, os, math, urllib.parse



load_dotenv()
# import uvicorn

# if __name__ == "__main__":
    # uvicorn.run("llm:app", host="0.0.0.0", port=8000, reload=True)

app = FastAPI()
embedder = SentenceTransformer("BAAI/bge-m3")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

class Item(BaseModel):
    start_date : str
    end_date : str
    cities: list
    text: str

class FixRequest(BaseModel):
    start_date : str
    end_date : str
    cities: list
    text: str
    itinerary_data: Dict[str, Any]

class Location(BaseModel):
    itinerary_data: Dict[str, Any]


def choose_k_density(num_days, months, cities, num_docs, base_k=2, max_k=20):
    length_factor = num_days // 2     
    
    city_factor = len(cities)
    
    density_factor = int(math.log1p(int(num_docs))) // 2
    
    month_factor = len(months) // 2  
    k = base_k + length_factor + city_factor + density_factor + month_factor
    return min(max_k, max(base_k, k))
    
def query_documents(num_days, months, cities, query_text):
    db_url = os.getenv('DATABASE_LLM_URL')
    conn = psycopg2.connect(db_url)

    num_k = 0
    
    if num_days <= 3:
        num_k = 1
    if num_days > 3 and num_days <=7:
        num_k = 2
    else:
        num_k = 3
        
    num_days_1 = max(1, num_days - num_k)
    num_days_2 = num_days + num_k

    cur = conn.cursor()
    query_embedding = embedder.encode(query_text).tolist()
    query_embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    query_count = """
        SELECT COUNT(*) 
        FROM documents
        WHERE cities @> %s AND months @> %s AND duration_days BETWEEN %s AND %s
    """
    cur.execute(query_count, (cities, months, num_days_1, num_days_2))
    num_docs = cur.fetchall()[0][0]
    k = choose_k_density(num_days, months, cities, num_docs)
    query = """
        SELECT content, embedding <=> %s::vector AS similarity_score
        FROM documents
        WHERE cities @> %s AND months @> %s AND duration_days BETWEEN %s AND %s
        ORDER BY similarity_score ASC
        LIMIT %s
    """
    # where @> or && dont know use @> or &&

    cur.execute(query, (query_embedding_str, cities, months, num_days_1, num_days_2, k))
    results = cur.fetchall()
    cur.close()
    conn.close()
    output = [i[0] for i in results]
    print("Top K: ",k , "\nQuery result: ", num_docs, output)
    return output

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


@app.post("/llm/")
async def query_llm(text: Item):
    date_start_str = text.start_date
    date_end_str = text.end_date
    date_start = datetime.strptime(date_start_str, "%d/%m/%Y")
    date_end = datetime.strptime(date_end_str, "%d/%m/%Y")
    num_days = (date_end - date_start).days + 1
    
    query_txt = f"{text.text}"
    months = []
    # Iterate over each month in the date range
    current = date_start
    while current <= date_end:
        month_name = current.strftime('%B')  # Full month name (e.g., March)
        if month_name not in months:  # Avoid duplicates
            months.append(month_name)
        # Move to next month
        if current.month == 12:
            current = datetime(current.year + 1, 1, 1)
        else:
            current = datetime(current.year, current.month + 1, 1)

    # print(months)
    retrieved_docs = query_documents(num_days, months, text.cities, query_txt)
    season_data = get_season_data()
    json_structure = """
    {
        "itinerary": [
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                // more schedule items as needed
            ]
            },
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                // more schedule items as needed
            ]
            },
            // more schedule items as needed
        ],
        "comments": "comments or additional notes about the itinerary"
    }
    """
    
    if len(retrieved_docs) <= 0:
        web_search = f"""Japan Itinerary {num_days}days starts {date_start_str}-{date_end_str} {', '.join(text.cities)} {text.text}"""
        tavily_response = tavily_client.search(
            query=web_search,
            include_answer="advanced"
        )
        tavily_context = tavily_response['answer']
        print("no retrieced doc found: ", tavily_context)
        prompt = f"""Generate a detailed travel itinerary in JSON format. 
            
            The itinerary must include:  
            - **Multiple days** with specific dates (`YYYY-MM-DD`).  
            - **Day labels** (e.g., `"Day 1"`, `"Day 2"`).  
            - **A schedule** for each day, containing: 
            - **Time slots** (`HH:mm`, 24-hour format).  
            - **Activities** for each time slot.
            - ** Do not guess coordinates. Always keep lat/lng null. **
            - *** need_location should be false if the activity is not location-specific (e.g., "Shopping", "Dining", "Hotel rest time", "Free time") and if need_location is false make it null.***
            - *** For specific attractions, museums, temples, or landmarks, need_location always true and give me specific name of location from activity at specific_location_name if need_location is false make it null. ***
            - Make sure that specific_location_name is from activity and don't change activity make it normal like itinerary plan
            
            - **Comments** or additional notes about the itinerary **example about the season for example, is that month suitable for that kind of weather? Like going to see cherry blossoms in a month when they're not blooming. ** here is season data {season_data}.
        
            Ensure the response contains **only** valid JSON with no explanations or extra text. Create an itinerary based on {text.cities} and {text.text}. If {text.cities} and {text.text} are not realistically possible due to distance, time, or season, adjust them as needed ** you can use this information {tavily_context} to make the itinerary better **
            **** Verify that the itinerary aligns with the travel period ({text.start_date}–{text.end_date}) and includes manageable distances and travel times between locations ****
            
            *** NO double quotes at the start and end of the JSON response. ***
            *** The trip starts on **{text.start_date}** 'DD-MM-YYYY' and ends on **{text.end_date}** 'DD-MM-YYYY'. ***
            json_structure: {json_structure}
            make the itinerary in English language.
        """

    else:
        context = ([i for i in retrieved_docs])
        prompt = f"""Generate a detailed travel itinerary in JSON format. 
            
            The itinerary must include:  
            - **Multiple days** with specific dates (`YYYY-MM-DD`).  
            - **Day labels** (e.g., `"Day 1"`, `"Day 2"`).  
            - **A schedule** for each day, containing: 
            - **Time slots** (`HH:mm`, 24-hour format).  
            - **Activities** for each time slot.
            - ** Do not guess coordinates. Always keep lat/lng null. **
            - *** need_location should be false if the activity is not location-specific (e.g., "Shopping", "Dining", "Hotel rest time", "Free time").***
            - *** For specific attractions, museums, temples, or landmarks, need_location always true and give me specific name of location from activity at specific_location_name. ***
            - Make sure that specific_location_name is from activity and don't change activity make it normal like itinerary plan
            
            - **Comments** or additional notes about the itinerary **example about the season for example, is that month suitable for that kind of weather? Like going to see cherry blossoms in a month when they're not blooming. ** here is season data {season_data}.
        

            Ensure the response **ONLY** contains valid JSON without any explanations or additional text. *** Use the following context: {context}. ***
            **** Verify that the itinerary aligns with the travel period ({text.start_date}–{text.end_date}) and includes manageable distances and travel times between locations ****
            
            *** NO double quotes at the start and end of the JSON response. ***
            *** The trip starts on **{text.start_date}** 'DD-MM-YYYY' and ends on **{text.end_date}** 'DD-MM-YYYY'. ***
            json_structure: {json_structure}
            make the itinerary in English language.
        """

    # __________________ OpenAI __________________
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip."},
            # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
            {"role": "user", "content" : prompt},
        ],
        # reasoning={
        #     "effort": "minimal"
        # }
    )
    
    response_answer = response.choices[0].message.content
    # _______________________________________________
    
    # __________________ Gemini __________________
    # system_prompt = "You are an assistant that helps to make a time schedule for a trip."
    # client = genai.GenerativeModel(
    #     model_name="gemini-2.5-pro",
    #     system_instruction=system_prompt
    # )

    # contents = [
    #     {
    #         'role': 'user',
    #         'parts': prompt
    #     }
    # ]

    # response = client.generate_content(contents) 
    # response_answer = response.text
    # ________________________________________________
    
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    try:
        data = json.loads(response_answer)
        print("JSON parsed successfully")
    except json.JSONDecodeError as e:
        print(f"JSON parsing failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")

    return data

@app.post("/llm/fix/")
async def query_llm_fix(text: FixRequest):
    
    date_start_str = text.start_date
    date_end_str = text.end_date
    date_start = datetime.strptime(date_start_str, "%d/%m/%Y")
    date_end = datetime.strptime(date_end_str, "%d/%m/%Y")
    num_days = (date_end - date_start).days + 1
           
    
    query_txt = f"{text.text}"
    months = []
    # Iterate over each month in the date range
    current = date_start
    while current <= date_end:
        month_name = current.strftime('%B')  # Full month name (e.g., March)
        if month_name not in months:  # Avoid duplicates
            months.append(month_name)
        # Move to next month
        if current.month == 12:
            current = datetime(current.year + 1, 1, 1)
        else:
            current = datetime(current.year, current.month + 1, 1)

    # print(months)
    retrieved_docs = query_documents(num_days, months, text.cities, query_txt)
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
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                // more schedule items as needed
            ]
            },
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                { "time": "HH:mm", "activity": "", "need_location": boolean, "specific_location_name": null, "lat": null, "lng": null },
                // more schedule items as needed
            ]
            },
            // more schedule items as needed
        ],
        "comments": "comments or additional notes about the itinerary"
    }
    """
    if len(retrieved_docs) <= 0:
        web_search = f"""Japan Itinerary {num_days}days starts {date_start_str}-{date_end_str} {', '.join(text.cities)} {text.text}"""
        tavily_response = tavily_client.search(
            query=web_search,
            include_answer="advanced"
        )
        tavily_context = tavily_response['answer']
        print("no retrieced doc found: ", tavily_context)
        prompt = f"""Change the activities in this itinerary: {itinerary_json}

            Your task:
            - MODIFY THE ACTIVITIES based on this user request: {text.text}
            - Use this additional text and cities to improve the travel plan: {tavily_context}
            - You MUST REPLACE the original activities with new ones that align with the user's request

            Requirements for the modified itinerary:
            - Maintain the same structure with multiple days (YYYY-MM-DD format)
            - Keep the day labels (e.g., "Day 1", "Day 2")
            - Preserve the time slots (HH:mm, 24-hour format)
            - REPLACE the activities with new ones that match the user request
            - Include relevant comments about seasonal appropriateness using this data: {season_data}
            (e.g., check if activities match seasonal conditions like cherry blossoms blooming periods)
            - *** need_location should be false if the activity is not location-specific (e.g., "Shopping", "Dining", "Hotel rest time", "Free time").***
            - *** For specific attractions, museums, temples, or landmarks, need_location always true and give me specific name of location from activity at specific_location_name. ***
            - Make sure that specific_location_name is from activity and don't change activity make it normal like itinerary plan
            
            DO NOT keep the original activities. Your response should only contain the modified JSON following this structure: {json_structure}.
            *** NO double quotes at the start and end of the JSON response. ***
            *** The trip starts on **{text.start_date}** 'DD-MM-YYYY' and ends on **{text.end_date}** 'DD-MM-YYYY'. ***
            **** IMPORTANT: The activities in your response must be DIFFERENT from the original itinerary. ****
            make the itinerary in English language.
        """ 
    else:
        context = ([i for i in retrieved_docs])
        prompt = f"""Change the activities in this itinerary: {itinerary_json}

            Your task:
            - MODIFY THE ACTIVITIES based on this user request: {text.text}
            - Use this additional context to improve the travel plan: {context}
            - You MUST REPLACE the original activities with new ones that align with the user's request

            Requirements for the modified itinerary:
            - Maintain the same structure with multiple days (YYYY-MM-DD format)
            - Keep the day labels (e.g., "Day 1", "Day 2")
            - Preserve the time slots (HH:mm, 24-hour format)
            - REPLACE the activities with new ones that match the user request
            - Include relevant comments about seasonal appropriateness using this data: {season_data}
            (e.g., check if activities match seasonal conditions like cherry blossoms blooming periods)
            - *** need_location should be false if the activity is not location-specific (e.g., "Shopping", "Dining", "Hotel rest time", "Free time").***
            - *** For specific attractions, museums, temples, or landmarks, need_location always true and give me specific name of location from activity at specific_location_name. ***
            - Make sure that specific_location_name is from activity and don't change activity make it normal like itinerary plan
            
            DO NOT keep the original activities. Your response should only contain the modified JSON following this structure: {json_structure}.
            *** NO double quotes at the start and end of the JSON response. ***
            *** The trip starts on **{text.start_date}** 'DD-MM-YYYY' and ends on **{text.end_date}** 'DD-MM-YYYY'. ***
            **** IMPORTANT: The activities in your response must be DIFFERENT from the original itinerary. ****
            make the itinerary in English language.
        """
        
    # __________________ OpenAI __________________
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip."},
            # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
            {"role": "user", "content" : prompt},
        ],
        # reasoning={
        #     "effort": "minimal"
        # }
    )
    
    response_answer = response.choices[0].message.content
    # _______________________________________________
    
    # __________________ Gemini __________________
    # system_prompt = "You are an assistant that helps create a trip schedule."
    # client = genai.GenerativeModel(
    #     model_name="gemini-2.5-pro",
    #     system_instruction=system_prompt
    # )

    # contents = [
    #     {
    #         'role': 'user',
    #         'parts': prompt
    #     }
    # ]

    # response = client.generate_content(contents) 
    # response_answer = response.text
    # ________________________________________________
    
    response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    if response_answer.startswith('json'):
        response_answer = response_answer[4:]
    # return response_answer
    try:
    # Parse the input text directly
        data = json.loads(response_answer)
        print("JSON parsed successfully")
    except json.JSONDecodeError as e:
        print(f"JSON parsing failed: {e}")
    return data


@app.post("/get_location/")
def get_location(text: Location):
    google_api_key = os.getenv("GOOGLE_API_KEY")
        
    itinerary = text.itinerary_data["itinerary"]
    for day in itinerary:
        for time in day["schedule"]:
            if time["need_location"] == True and time["specific_location_name"] is not None:
                address_name = time["specific_location_name"]
                address_encoded = urllib.parse.quote(address_name)
                url = f"https://maps.googleapis.com/maps/api/geocode/json?address={address_encoded}&components=country:JP&region=jp&key={google_api_key}"
                
                response = requests.get(url)
                data = response.json()
                
                # ดึง lat/lng
                if data["status"] == "OK":
                    lat = data["results"][0]["geometry"]["location"]["lat"]
                    lng = data["results"][0]["geometry"]["location"]["lng"]
                    time["lat"] = lat
                    time["lng"] = lng
                else:
                    print("Error:", data["status"])
    
    text.itinerary_data["itinerary"] = itinerary
    
    return text
