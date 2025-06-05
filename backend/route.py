from fastapi import FastAPI
import requests
import os
from dotenv import load_dotenv, dotenv_values
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

class RouteRequest(BaseModel):
    start: str
    goal: str
    start_time: str

@app.get("/route")
async def root(text: RouteRequest):
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

