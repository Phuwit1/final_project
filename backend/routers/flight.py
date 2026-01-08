from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, APIRouter
import requests
import os


load_dotenv()

router = APIRouter(tags=["Flight"])

def fetch_flight_info(flight_number: str):
    url = "https://aerodatabox.p.rapidapi.com/flights/number/" + flight_number
    rapidapi_key = os.getenv("RAPIDAPI_KEY")
    
    querystring = {"withAircraftImage":"false","withLocation":"false","withFlightPlan":"false"}

    headers = {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "aerodatabox.p.rapidapi.com"
    }

    response = requests.get(url, headers=headers, params=querystring)
    return (response.json())



@router.get("/flight/{flight_number}")
def get_data_from_flight_info(flight_number: str):
    flight_data = fetch_flight_info(flight_number)
    if not flight_data or not isinstance(flight_data, list) or len(flight_data) == 0:
        return None
    
    all_extracted_data = []
    
    for flight in flight_data:
        departure = flight.get("departure", {})
        arrival = flight.get("arrival", {})
    

        extracted_data = {
            "flight_number": flight.get("number"),
            "airline": flight.get("airline", {}).get("name"),
            "status": flight.get("status"),
            "aircraft": flight.get("aircraft", {}).get("model"),
            
            # ขาออก (Departure)
            "departure": {
                "origin_code": departure.get("airport", {}).get("iata"),
                "origin_name": departure.get("airport", {}).get("name"),
                "schedule_dep_time": departure.get("scheduledTime", {}),
                "revised_dep_time": departure.get("revisedTime", {}),
                "predicted_dep_time": departure.get("predictedTime", {}),
                "runway_dep_time": departure.get("runwayTime", {}),
                "terminal_dep": departure.get("terminal", "-"),
                "gate_dep": departure.get("gate", "-"),
            },
            
            # ขาเข้า (Arrival)
            "arrival": {
                "dest_code": arrival.get("airport", {}).get("iata"),
                "dest_name": arrival.get("airport", {}).get("name"),
                "schedule_arr_time": arrival.get("scheduledTime", {}),
                "revised_arr_time": arrival.get("revisedTime", {}),
                "predicted_arr_time": arrival.get("predictedTime", {}),
                "runway_arr_time": arrival.get("runwayTime", {}),
                "terminal_arr": arrival.get("terminal", "-"),
                "gate_arr": arrival.get("gate", "-"),
                "baggageBelt": arrival.get("baggageBelt", "-")
            }
        }
        all_extracted_data.append(extracted_data)

    return all_extracted_data
