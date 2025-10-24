from sacrebleu.metrics import BLEU
from rouge_score import rouge_scorer
from bert_score import score
from sentence_transformers import SentenceTransformer
from datetime import datetime
import numpy as np
from typing import List, Dict
import re, requests, psycopg2, os, math, json
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

def choose_k_density(num_days, months, cities, num_docs, base_k=2, max_k=15):
    """
    Adaptive-K selection based on trip duration, number of cities, months, and document density.
    """
    # ปัจจัยตามจำนวนวัน — ยิ่งทริปยาว ควรใช้บริบทมากขึ้น
    length_factor = max(1, round(num_days / 3))

    # ปัจจัยจำนวนเมือง — ยิ่งหลายเมือง ควรเพิ่ม K เพื่อครอบคลุมกิจกรรมหลายพื้นที่
    city_factor = len(cities)

    # ปัจจัยจำนวนเดือน — บ่งบอกถึงฤดูกาลที่หลากหลาย
    month_factor = max(1, round(len(months) / 2))

    # ปัจจัยความหนาแน่นของเอกสารในฐานข้อมูล — ถ้ามีเอกสารมาก ใช้ log เพื่อลดความชัน
    density_factor = max(0, round(math.log1p(num_docs) / 2))

    # รวมค่าแต่ละปัจจัยเข้ากับ base_k
    k = base_k + length_factor + city_factor + month_factor + density_factor

    # จำกัดไม่ให้เกิน max_k
    return min(max_k, max(base_k, k))
    
def query_documents(start_date, end_date, cities, query_text):
    date_start = datetime.strptime(start_date, "%d/%m/%Y")
    date_end = datetime.strptime(end_date, "%d/%m/%Y")
    num_days = (date_end - date_start).days + 1
    
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
        WHERE cities @> %s AND months @> %s AND duration_days = %s
    """
    cur.execute(query_count, (cities, months, num_days))
    num_docs = cur.fetchall()[0][0]
    k = choose_k_density(num_days, months, cities, num_docs)
    # k = 3
    query = """
        SELECT content, embedding <=> %s::vector AS similarity_score
        FROM documents
        WHERE cities @> %s AND months @> %s AND duration_days = %s
        ORDER BY similarity_score ASC
        LIMIT %s
    """
    # where @> or && dont know use @> or &&

    cur.execute(query, (query_embedding_str, cities, months, num_days, k))
    results = cur.fetchall()
    cur.close()
    conn.close()
    output = [i[0] for i in results]
    score = [i[1] for i in results]
    print("Top K: ",k , "\nQuery result: ", len(output))
    return output, score, num_docs


# Example usage
def main():
    evaluator = TripPlannerEvaluator()
    start_date="15/11/2025"
    end_date="22/11/2025"
    cities=["Hakone"]
    text="Looking for a relaxing onsen trip near Mount Fuji"

    references = [[]]
    print("Querying documents...")
    output, score, num_docs = query_documents(start_date, end_date, cities, text)
    for i in output:
        payload = {"itinerary": i, "start_date": start_date, "end_date": end_date}
        references[0].append(requests.post("http://127.0.0.1:8001/sum", json=payload).text)
        print(len(references[0]))
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
    payload2 = {"start_date": start_date, "end_date": end_date, "cities": cities, "text": text}
    candidates.append(requests.post("http://127.0.0.1:8000/llm", json=payload2).text)
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
        f.write(f"Top-k: {len(references[0])}\n\n")
        f.write("=== Multiple Reference Evaluation ===\n")
        for k, v in results.items():
            f.write(f"{k}: {v:.4f}\n")
        f.write("\n\n\n\nRag results:\n")
        f.write(f"Num Doc: {num_docs}\n")
        f.write(f"Average score: {sum(score) / len(references[0])}\n")
        f.write(f"Each score: {score} \n")
        f.write(f"\n\n\nContexts:\n {output}")
        

if __name__ == "__main__":
    main()
