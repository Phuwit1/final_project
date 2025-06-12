from typing import Union, Dict, Any
from fastapi import FastAPI, HTTPException
import requests
import os
from dotenv import load_dotenv, dotenv_values
from pydantic import BaseModel
import ollama
import json

load_dotenv()

app = FastAPI()

class RouteSummarizeRequest(BaseModel):
    route: Dict[str, Any]

class RouteRequest(BaseModel):
    start: str
    goal: str
    start_time: str

@app.get("/route")
async def route(text: RouteRequest):
    url = "https://navitime-route-totalnavi.p.rapidapi.com/route_transit"
    rapidapi_key = os.getenv("RAPIDAPI_KEY")

    querystring = {"start": text.start,"goal": text.goal,"datum":"wgs84","term":"1440","limit":"5","start_time": text.start_time,"coord_unit":"degree"}

    headers = {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "navitime-route-totalnavi.p.rapidapi.com"
    }

    response = requests.get(url, headers=headers, params=querystring)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "Failed to fetch data from the API", "status_code": response.status_code}


@app.get("/route/summarize")
async def route_translate(text: RouteSummarizeRequest):
    prompt = f"""
        Summarize this JSON file into a clear, human-readable, easy-to-read route guide.

        - Translate all Japanese to English.

        - You may freely adjust the format (e.g., add/remove bullet points or emojis) to improve readability and presentation.

        - Return the result strictly as a JSON array only — no extra comments or explanations outside the JSON format.

        🧭 Example JSON Format:
        [
            {
                "title": "(emoji) Option 1: Fastest (⏱ 44 min, 🔁 1 transfer)",
                "detail": [

                    {"(emoji) Walk: From origin to Nishi-Nippori Station (5 min)"},

                    {"(emoji) JR Yamanote Line: Nishi-Nippori → Ikebukuro (10 min)"},

                    {"(emoji) Seibu Ikebukuro Line: Ikebukuro → Nerima (12 min)"},

                    {"(emoji) Seibu Toshima Line: Nerima → Toshimaen (2 min)"},

                    {"(emoji) Walk: To destination (4 min)"}
                ],
                "fare": "💴 Total Fare: ~¥360",
                "distance": "📏 Distance: 13.5 km"
            },
            {
                "......**another option**......"
            },
            {
                "......**another option**......"
            }
        ]

        In (emoji) you can change as you want
    """
    
    response = ollama.chat(model="gemma3:4b", messages=[
        {"role": "system", "content" : "You are an assistant that helps to traslate and summarize a route JSON from Japanese to English."},
        # {"role": "system", "content" : "You are an assistant that helps to make a time schedule for a trip to **thai language**."},
        {"role": "user", "content" : prompt},
    ])
    
    response_answer = response.get("message", {}).get("content", "No content available")
    return response_answer
    # response_answer = response_answer.strip().replace("\n", "").replace("```", "")
    # if response_answer.startswith('json'):
    #     response_answer = response_answer[4:]
    # # return response_answer
    # try:
    #     data = json.loads(response_answer)
    #     print("Method 1 successful")
    # except json.JSONDecodeError as e:
    #     print(f"Method 1 failed: {e}")
    #     raise HTTPException(status_code=500, detail="Failed to parse JSON from model response")

    # return data
