from fastapi import FastAPI
import requests
import os
from dotenv import load_dotenv, dotenv_values
load_dotenv()

app = FastAPI()


@app.get("/route/")
async def root():
    url = "https://navitime-route-totalnavi.p.rapidapi.com/route_transit"
    rapidapi_key = os.getenv("RAPIDAPI_KEY")

    querystring = {"start":"35.665251,139.712092","goal":"35.661971,139.703795","datum":"wgs84","term":"1440","limit":"5","start_time":"2025-06-04T10:00:00","coord_unit":"degree"}
    querystring = {"start":"35.665251,139.712092","goal":"35.661971,139.703795","datum":"wgs84","term":"1440","limit":"5","start_time":"2025-06-04T10:00:00","coord_unit":"degree"}

    headers = {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "navitime-route-totalnavi.p.rapidapi.com"
    }

    response = requests.get(url, headers=headers, params=querystring)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "Failed to fetch data from the API", "status_code": response.status_code}

