from sacrebleu.metrics import BLEU
from rouge_score import rouge_scorer
from bert_score import score
from sentence_transformers import SentenceTransformer
from datetime import datetime
import numpy as np
from typing import List, Dict
import re, requests, psycopg2, os, math, json, time
from dotenv import load_dotenv

load_dotenv()
embedder = SentenceTransformer("BAAI/bge-m3")


class TripPlannerEvaluator:
    def __init__(self):
        self.rouge_scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    
    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for evaluation"""
        text = re.sub(r'\s+', ' ', text.strip())  # normalize whitespace
        return text.lower()
    
    def calculate_bleu_score(self, references: List[str], candidate: str) -> Dict[str, float]:
        """
        Calculate BLEU scores (1-gram to 4-gram) for multiple references.
        
        Args:
            references: List of ground truth trip plans
            candidate: Generated trip plan
            
        Returns:
            Dictionary with BLEU-1, BLEU-2, BLEU-3, BLEU-4 scores
        """
        # Preprocess
        references = [self.preprocess_text(ref) for ref in references]
        candidate = self.preprocess_text(candidate)
        
        # Compute BLEU scores
        bleu_1 = BLEU(max_ngram_order=1, effective_order=True)
        bleu_2 = BLEU(max_ngram_order=2, effective_order=True)
        bleu_3 = BLEU(max_ngram_order=3, effective_order=True)
        bleu_4 = BLEU(max_ngram_order=4, effective_order=True)
        
        bleu_scores = {
            'BLEU-1': bleu_1.sentence_score(candidate, references).score / 100,
            'BLEU-2': bleu_2.sentence_score(candidate, references).score / 100,
            'BLEU-3': bleu_3.sentence_score(candidate, references).score / 100,
            'BLEU-4': bleu_4.sentence_score(candidate, references).score / 100,
        }
        return bleu_scores
    
    def calculate_rouge_scores(self, references: List[str], candidate: str) -> Dict[str, float]:
        """
        Calculate averaged ROUGE scores over multiple references.
        
        Args:
            references: List of ground truth trip plans
            candidate: Generated trip plan
            
        Returns:
            Dictionary with average ROUGE-1, ROUGE-2, ROUGE-L (P, R, F1)
        """
        candidate = self.preprocess_text(candidate)
        scores = {f'ROUGE{i}-{m}': [] for i in ['1', '2', 'L'] for m in ['P', 'R', 'F1']}

        for ref in references:
            ref = self.preprocess_text(ref)
            s = self.rouge_scorer.score(ref, candidate)
            for k, v in s.items():
                scores[f'{k.upper()}-P'].append(v.precision)
                scores[f'{k.upper()}-R'].append(v.recall)
                scores[f'{k.upper()}-F1'].append(v.fmeasure)
        
        # Average over references
        return {k: float(np.mean(v)) for k, v in scores.items()}
    
    def calculate_bert_score(self, references: List[List[str]], candidates: List[str], 
                             model_type: str = "microsoft/deberta-xlarge-mnli") -> Dict[str, float]:
        """
        Calculate BERTScore (supports multiple references per candidate).
        """
        # Flatten and preprocess
        candidates = [self.preprocess_text(c) for c in candidates]
        references = [[self.preprocess_text(r) for r in refs] for refs in references]
        
        try:
            P, R, F1 = score(candidates, references, model_type=model_type, verbose=False, lang="en")
            return {
                'BERTScore-P': P.mean().item(),
                'BERTScore-R': R.mean().item(),
                'BERTScore-F1': F1.mean().item()
            }
        except Exception as e:
            print(f"Warning: BERTScore failed ({e}), fallback to distilbert...")
            P, R, F1 = score(candidates, references, model_type="distilbert-base-uncased", verbose=False)
            return {
                'BERTScore-P': P.mean().item(),
                'BERTScore-R': R.mean().item(),
                'BERTScore-F1': F1.mean().item()
            }

    def evaluate_single(self, references: List[str], candidate: str) -> Dict[str, float]:
        """
        Evaluate one candidate against multiple references.
        """
        results = {}
        results.update(self.calculate_bleu_score(references, candidate))
        results.update(self.calculate_rouge_scores(references, candidate))
        results.update(self.calculate_bert_score([references], [candidate]))
        return results

    def evaluate_batch(self, references: List[List[str]], candidates: List[str]) -> Dict[str, float]:
        """
        Evaluate batch of candidates with their respective multiple references.
        """
        all_scores = {}
        for refs, cand in zip(references, candidates):
            pair_scores = self.evaluate_single(refs, cand)
            for k, v in pair_scores.items():
                all_scores.setdefault(k, []).append(v)
        
        return {k: np.mean(v) for k, v in all_scores.items()}

def choose_k_density(num_days, months, cities, num_docs, base_k=2, max_k=20):
    length_factor = num_days // 2     
    
    city_factor = len(cities)
    
    density_factor = int(math.log1p(int(num_docs)))  // 2
    
    month_factor = len(months) // 2  
    k = base_k + length_factor + city_factor + density_factor + month_factor
    return min(max_k, max(base_k, k))
    
def query_documents(start_date, end_date, cities, query_text):
    date_start = datetime.strptime(start_date, "%d/%m/%Y")
    date_end = datetime.strptime(end_date, "%d/%m/%Y")
    num_days = (date_end - date_start).days + 1
 
    num_k = 0
    
    if num_days <= 3:
        num_k = 1
    if num_days > 3 and num_days <=7:
        num_k = 2
    else:
        num_k = 3
        
    num_days_1 = max(1, num_days - num_k)
    num_days_2 = num_days + num_k
   
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
    
    
    
    db_url = os.getenv('DATABASE_LLM_URL')
    conn = psycopg2.connect(db_url)

    cur = conn.cursor()
    query_embedding = embedder.encode(query_text).tolist()
    query_embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    query_count = """
        SELECT COUNT(*) 
        FROM documents
        WHERE cities @> %s AND months @> %s AND duration_days BETWEEN %s AND %s
    """
    cur.execute(query_count, (cities, months, num_days))
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
    score = [i[1] for i in results]
    print("Top K: ",k , "\nQuery result: ", len(output))
    return output, score


# Example usage
def main(start_date, end_date, cities, text, itinerary):
    evaluator = TripPlannerEvaluator()
    # start_date = "02/03/2025"
    # end_date = "11/03/2025"
    # cities = ["Tokyo", "Kyoto"]
    # text = "cherry blossoms sushi"

    

    references = [[]]
    references[0].append(json.dumps(itinerary))
    print("Querying documents...")
    output, score = query_documents(start_date, end_date, cities, text)
    for i in output:
        payload = {"itinerary": i, "start_date": start_date, "end_date": end_date}
        references[0].append(requests.post("http://127.0.0.1:8001/sum", json=payload).text)
        # Delay
        # time.sleep(30)  # 30 seconds delay between requests
        
        print(len(references[0]) - 1)
    print("done querying")
    
    # 🔹 Save references as pretty JSON
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    log_dir = f"log/{timestamp}"
    os.makedirs(log_dir, exist_ok=True)
    
    ref_file = f"log/{timestamp}/ref_" + str(start_date).replace("/", "-") + "_" + str(end_date).replace("/", "-") + "_" + "-".join(cities) + ".json"
    with open(ref_file, "w", encoding="utf-8") as file:
        json.dump(references[0], file, ensure_ascii=False, indent=4)
    with open(ref_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    # data ตอนนี้เป็น list ที่ข้างในเป็น string
    # ต้อง parse อีกชั้น
    parsed = [json.loads(item) for item in data]
    # บันทึกใหม่เป็น JSON ที่อ่านง่าย
    ref_pretty_file = f"log/{timestamp}/ref_" + str(start_date).replace("/", "-") + "_" + str(end_date).replace("/", "-") + "_" + "-".join(cities) + "_pretty.json"
    with open(ref_pretty_file, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=4)

    candidates = []

    print("Generating candidate...")
    payload2 = {"start_date": start_date, "end_date": end_date, "cities": cities, "text": text, "itinerary_data": itinerary}
    candidates.append(requests.post("http://127.0.0.1:8000/llm/fix", json=payload2).text)
    print("done generating")
    # 🔹 Save candidate as pretty JSON
    can_file = f"log/{timestamp}/can_" + str(start_date).replace("/", "-") + "_" + str(end_date).replace("/", "-") + "_" + "-".join(cities) + ".json"
    with open(can_file, "w", encoding="utf-8") as file:
        json.dump(candidates, file, ensure_ascii=False, indent=4)
    with open(can_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    # data ตอนนี้เป็น list ที่ข้างในเป็น string
    # ต้อง parse อีกชั้น
    parsed = [json.loads(item) for item in data]
    # บันทึกใหม่เป็น JSON ที่อ่านง่าย
    can_pretty_file = f"log/{timestamp}/can_" + str(start_date).replace("/", "-") + "_" + str(end_date).replace("/", "-") + "_" + "-".join(cities) + "_pretty.json"
    with open(can_pretty_file, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=4)
    
    
    print("=== Multiple Reference Evaluation ===")
    results = evaluator.evaluate_batch(references, candidates)
    for k, v in results.items():
        print(f"{k}: {v:.4f}")

    # บันทึกผลลัพธ์ลงไฟล์
    with open(f"log/{timestamp}/results.txt", "w", encoding="utf-8") as f:
        f.write(f"Start date: {start_date}\n")
        f.write(f"End date: {end_date}\n")
        f.write(f"Cities: {', '.join(cities)}\n")
        f.write(f"Text: {text}\n")
        f.write(f"Itinerary data: {itinerary}\n\n")
        f.write(f"Top-k: {len(references[0])}\n\n")
        f.write("=== Multiple Reference Evaluation ===\n")
        for k, v in results.items():
            f.write(f"{k}: {v:.4f}\n")
        f.write("\n\n\n\nRag results:\n")
        f.write(f"Average score: {sum(score) / (len(references[0] - 1))}\n")
        f.write(f"Each score: {score} \n")
        f.write(f"\n\n\nContexts:\n {output}")
        


start_date = "02/03/2025"
end_date = "11/03/2025"
cities = ["Tokyo", "Kyoto"]
text = "i want to go to onsen on day2"
itinerary = """
{
    "itinerary": [
        {
            "date": "2025-03-02",
            "day": "Day 1",
            "schedule": [
                {
                    "time": "14:00",
                    "activity": "Hotel check-in and settle in",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:30",
                    "activity": "Hotel rest time / unpack and freshen up",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Orientation meeting in hotel lobby (meet guide if arriving on time)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:30",
                    "activity": "Dinner on your own / explore nearby neighborhood",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "21:30",
                    "activity": "Return to hotel and overnight rest",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-03",
            "day": "Day 2",
            "schedule": [
                {
                    "time": "09:00",
                    "activity": "Visit Animate Ikebukuro Honten for anime shopping",
                    "need_location": true,
                    "specific_location_name": "Animate Ikebukuro Honten",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:00",
                    "activity": "Explore Otome Road (Ikebukuro)",
                    "need_location": true,
                    "specific_location_name": "Otome Road",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:30",
                    "activity": "Lunch at a Maid Cafe",
                    "need_location": true,
                    "specific_location_name": "Maid Cafe",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:30",
                    "activity": "Travel to Akihabara by train",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Explore Akihabara anime & electronics district",
                    "need_location": true,
                    "specific_location_name": "Akihabara",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "20:00",
                    "activity": "Attend Underground Idol Live Show",
                    "need_location": true,
                    "specific_location_name": "Underground Idol Live Show",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "22:00",
                    "activity": "Return to hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-04",
            "day": "Day 3",
            "schedule": [
                {
                    "time": "09:30",
                    "activity": "Visit Ghibli Museum (Mitaka) - pre-booked tickets recommended",
                    "need_location": true,
                    "specific_location_name": "Ghibli Museum",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:00",
                    "activity": "Browse Nakano Broadway for collectibles and rare finds",
                    "need_location": true,
                    "specific_location_name": "Nakano Broadway",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Ramen tasting in Ikebukuro (try local shops)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Shinjuku: Kabukicho & Golden Gai food tour / bar hopping",
                    "need_location": true,
                    "specific_location_name": "Golden Gai",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "21:30",
                    "activity": "Return to hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-05",
            "day": "Day 4",
            "schedule": [
                {
                    "time": "08:30",
                    "activity": "Visit Sensoji Temple in Asakusa",
                    "need_location": true,
                    "specific_location_name": "Sensoji Temple",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:30",
                    "activity": "Browse Nakamise District shops",
                    "need_location": true,
                    "specific_location_name": "Nakamise District",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:30",
                    "activity": "Cherry blossom viewing at Ueno Park",
                    "need_location": true,
                    "specific_location_name": "Ueno Park",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:00",
                    "activity": "Stroll Takeshita Street in Harajuku (fashion & snacks)",
                    "need_location": true,
                    "specific_location_name": "Takeshita Street",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:30",
                    "activity": "Experience Shibuya Scramble Crossing and visit Hachiko Statue",
                    "need_location": true,
                    "specific_location_name": "Shibuya Scramble Crossing",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
                    "activity": "Dinner on your own in Shibuya",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-06",
            "day": "Day 5",
            "schedule": [
                {
                    "time": "07:30",
                    "activity": "Depart Tokyo for Hakone (coach/train)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "10:00",
                    "activity": "Visit Mt. Fuji 5th Station (weather dependent)",
                    "need_location": true,
                    "specific_location_name": "Mt. Fuji 5th Station",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:30",
                    "activity": "Lake Ashi sightseeing cruise",
                    "need_location": true,
                    "specific_location_name": "Lake Ashi",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Explore Owakudani volcanic valley",
                    "need_location": true,
                    "specific_location_name": "Owakudani",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Travel Ogawara/Odawara and board Shinkansen to Kyoto",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "21:30",
                    "activity": "Arrive Kyoto, hotel check-in and overnight rest",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-07",
            "day": "Day 6",
            "schedule": [
                {
                    "time": "08:30",
                    "activity": "Visit Fushimi Inari Shrine and walk through torii gates",
                    "need_location": true,
                    "specific_location_name": "Fushimi Inari Shrine",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:00",
                    "activity": "Explore Fushimi Sake District and Gekkeikan Okura Sake Museum (sake tasting)",
                    "need_location": true,
                    "specific_location_name": "Gekkeikan Okura Sake Museum",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Lunch in Fushimi Sake District (on your own)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:30",
                    "activity": "Visit Kiyomizu Temple and view the wooden stage",
                    "need_location": true,
                    "specific_location_name": "Kiyomizu Temple",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:00",
                    "activity": "Stroll Sannenzaka & Ninenzaka preserved streets",
                    "need_location": true,
                    "specific_location_name": "Sannenzaka & Ninenzaka",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:30",
                    "activity": "Walk Gion Geisha District and look for Maiko sightings",
                    "need_location": true,
                    "specific_location_name": "Gion Geisha District",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "20:00",
                    "activity": "Cherry Blossom Light-Up at Maruyama Park",
                    "need_location": true,
                    "specific_location_name": "Maruyama Park",
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-08",
            "day": "Day 7",
            "schedule": [
                {
                    "time": "08:30",
                    "activity": "Morning visit to Nishiki Market (Kyoto's Kitchen)",
                    "need_location": true,
                    "specific_location_name": "Nishiki Market",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "10:30",
                    "activity": "Tour Nijo Castle (UNESCO site)",
                    "need_location": true,
                    "specific_location_name": "Nijo Castle",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Visit Golden Pavilion (Kinkakuji)",
                    "need_location": true,
                    "specific_location_name": "Golden Pavilion",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:30",
                    "activity": "Explore Arashiyama Bamboo Forest",
                    "need_location": true,
                    "specific_location_name": "Arashiyama Bamboo Forest",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:15",
                    "activity": "See the Kimono Forest near Arashiyama Station",
                    "need_location": true,
                    "specific_location_name": "Kimono Forest",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Walk across Togetsukyo Bridge and riverside area",
                    "need_location": true,
                    "specific_location_name": "Togetsukyo Bridge",
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-09",
            "day": "Day 8",
            "schedule": [
                {
                    "time": "09:00",
                    "activity": "Samurai and Ninja Museum visit and hands-on experience",
                    "need_location": true,
                    "specific_location_name": "Samurai and Ninja Museum",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:00",
                    "activity": "Travel Kyoto to Nara by short train ride",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Visit Todaiji Temple and the Great Buddha",
                    "need_location": true,
                    "specific_location_name": "Todaiji Temple",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:30",
                    "activity": "Meet and feed deer in Nara Deer Park",
                    "need_location": true,
                    "specific_location_name": "Nara Deer Park",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Travel to Osaka and hotel check-in",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
                    "activity": "Evening free in Osaka (optional local dining)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-10",
            "day": "Day 9",
            "schedule": [
                {
                    "time": "09:30",
                    "activity": "Explore Umeda anime & pop-culture spots",
                    "need_location": true,
                    "specific_location_name": "Umeda",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:00",
                    "activity": "Visit Nipponbashi Ota Road (Osaka's otaku district)",
                    "need_location": true,
                    "specific_location_name": "Nipponbashi Ota Road",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Free time for shopping or museum visits",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Dotonbori Kuidaore street food tour (3 street foods included)",
                    "need_location": true,
                    "specific_location_name": "Dotonbori",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "20:30",
                    "activity": "Evening stroll along Dotonbori canal and return to hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        },
        {
            "date": "2025-03-11",
            "day": "Day 10",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Hotel check-out",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Last-minute shopping or free time in Osaka",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:00",
                    "activity": "Transfer to airport on your own (tour ends)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Depart Japan",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        }
    ],
    "comments": "Season & logistics notes: This itinerary is scheduled for 02/03/2025–11/03/2025 (early March). Early March in Japan is the beginning of spring but often slightly before the peak cherry blossom (sakura) in many central cities; in Tokyo and Kyoto peak bloom commonly occurs later in March to early April. Expect partial or early blooms at lower-elevation urban parks (some trees may be flowering) but full peak will vary by year and micro-climate. Mt. Fuji visibility and access to the 5th Station are weather-dependent; clear days give excellent views but cloud, rain, or seasonal closures can limit access. Travel times and distances have been kept manageable: typical transfers in this plan are ~1.5–2 hours Tokyo↔Hakone, Hakone→Odawara + Shinkansen to Kyoto ~2–3 hours total, Kyoto↔Nara ~45 mins, Nara→Osaka ~45–60 mins. The itinerary uses efficient public transport and occasional Shinkansen segments; allow flexibility for transit and weather contingencies. Clothing / packing suggestion: (Spring: March–May) Light jackets, light sweaters, and layers are advised — days can be mild but evenings may be chilly. Bring a compact umbrella or light rain jacket (possible spring showers). Notes on reservations: Book Ghibli Museum and select attractions in advance when possible; some events (Ghibli Museum, certain live shows, maid cafe reservations) have limited capacity. If cherry blossom viewing is a priority, consider adjusting a day later in March or adding a short extra-night stay in late March to align with local forecasts. All lat/long coordinates are intentionally null per request."
}
"""
itinerary_data = json.loads(itinerary)
if __name__ == "__main__":
    main(start_date, end_date, cities, text, itinerary_data)
