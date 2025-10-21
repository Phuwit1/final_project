import os, json
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

class Item(BaseModel):
    itinerary: str
    start_date: str
    end_date: str

load_dotenv()
app = FastAPI()
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


@app.post("/sum/")
def main(text: Item):
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    context = text.itinerary
    start_date = text.start_date
    end_date = text.end_date
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
            **** Verify that the itinerary aligns with the travel period ({start_date}–{end_date}) and includes manageable distances and travel times between locations ****
            
            *** NO double quotes at the start and end of the JSON response. ***
            *** The trip starts on **{start_date}** 'DD-MM-YYYY' and ends on **{end_date}** 'DD-MM-YYYY'. ***
            json_structure: {json_structure}
            make the itinerary in English language.
        """

     # __________________ OpenAI __________________
        # ถ้าภาษาไทยเพิ่มด้านบนด้วย ^^^^ ตรง activities + ข้างล่าง json_structure
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
    #     model_name="gemini-2.5-flash",
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

    return (data)




