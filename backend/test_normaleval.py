import nltk
from nltk.translate.bleu_score import sentence_bleu, corpus_bleu
from rouge_score import rouge_scorer
from bert_score import score
import numpy as np
from typing import List, Dict, Tuple
import re

# Download required NLTK data - updated for newer NLTK versions
try:
    nltk.download('punkt_tab', quiet=True)
except:
    nltk.download('punkt', quiet=True)

class TripPlannerEvaluator:
    def __init__(self):
        self.rouge_scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    
    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess text for evaluation"""
        # Remove extra whitespace and normalize
        text = re.sub(r'\s+', ' ', text.strip())
        # Convert to lowercase for consistency
        text = text.lower()
        return text
    
    def calculate_bleu_score(self, reference: str, candidate: str) -> Dict[str, float]:
        """
        Calculate BLEU scores (1-gram to 4-gram)
        
        Args:
            reference: Ground truth trip plan
            candidate: Generated trip plan
            
        Returns:
            Dictionary with BLEU-1, BLEU-2, BLEU-3, BLEU-4 scores
        """
        # Preprocess texts
        reference = self.preprocess_text(reference)
        candidate = self.preprocess_text(candidate)
        
        # Tokenize with error handling
        try:
            ref_tokens = nltk.word_tokenize(reference)
            cand_tokens = nltk.word_tokenize(candidate)
        except LookupError:
            # Fallback to simple splitting if NLTK tokenizer fails
            ref_tokens = reference.split()
            cand_tokens = candidate.split()
        
        # Calculate BLEU scores for different n-grams
        bleu_scores = {}
        
        # BLEU-1 (unigram)
        bleu_scores['BLEU-1'] = sentence_bleu([ref_tokens], cand_tokens, weights=(1.0, 0, 0, 0))
        
        # BLEU-2 (bigram)
        bleu_scores['BLEU-2'] = sentence_bleu([ref_tokens], cand_tokens, weights=(0.5, 0.5, 0, 0))
        
        # BLEU-3 (trigram)
        bleu_scores['BLEU-3'] = sentence_bleu([ref_tokens], cand_tokens, weights=(0.33, 0.33, 0.33, 0))
        
        # BLEU-4 (4-gram) - most commonly used
        bleu_scores['BLEU-4'] = sentence_bleu([ref_tokens], cand_tokens, weights=(0.25, 0.25, 0.25, 0.25))
        
        return bleu_scores
    
    def calculate_rouge_scores(self, reference: str, candidate: str) -> Dict[str, float]:
        """
        Calculate ROUGE scores (ROUGE-1, ROUGE-2, ROUGE-L)
        
        Args:
            reference: Ground truth trip plan
            candidate: Generated trip plan
            
        Returns:
            Dictionary with ROUGE scores
        """
        # Preprocess texts
        reference = self.preprocess_text(reference)
        candidate = self.preprocess_text(candidate)
        
        # Calculate ROUGE scores
        scores = self.rouge_scorer.score(reference, candidate)
        
        rouge_scores = {}
        for metric, score_obj in scores.items():
            rouge_scores[f'{metric.upper()}-P'] = score_obj.precision
            rouge_scores[f'{metric.upper()}-R'] = score_obj.recall
            rouge_scores[f'{metric.upper()}-F1'] = score_obj.fmeasure
        
        return rouge_scores
    
    def calculate_bert_score(self, references: List[str], candidates: List[str], 
                           model_type: str = "microsoft/deberta-xlarge-mnli") -> Dict[str, float]:
        """
        Calculate BERTScore
        
        Args:
            references: List of reference trip plans
            candidates: List of generated trip plans
            model_type: BERT model to use for scoring
            
        Returns:
            Dictionary with precision, recall, and F1 scores
        """
        # Preprocess texts
        references = [self.preprocess_text(ref) for ref in references]
        candidates = [self.preprocess_text(cand) for cand in candidates]
        
        # Calculate BERTScore with error handling
        try:
            P, R, F1 = score(candidates, references, model_type=model_type, verbose=False)
            
            return {
                'BERTScore-P': P.mean().item(),
                'BERTScore-R': R.mean().item(),
                'BERTScore-F1': F1.mean().item()
            }
        except Exception as e:
            print(f"Warning: BERTScore calculation failed: {e}")
            print("Falling back to simpler model...")
            try:
                # Try with a lighter model
                P, R, F1 = score(candidates, references, model_type="distilbert-base-uncased", verbose=False)
                return {
                    'BERTScore-P': P.mean().item(),
                    'BERTScore-R': R.mean().item(),
                    'BERTScore-F1': F1.mean().item()
                }
            except Exception as e2:
                print(f"BERTScore failed with fallback model: {e2}")
                return {
                    'BERTScore-P': 0.0,
                    'BERTScore-R': 0.0,
                    'BERTScore-F1': 0.0
                }
    
    def evaluate_single_pair(self, reference: str, candidate: str) -> Dict[str, float]:
        """
        Evaluate a single reference-candidate pair with all metrics
        
        Args:
            reference: Ground truth trip plan
            candidate: Generated trip plan
            
        Returns:
            Dictionary with all evaluation scores
        """
        results = {}
        
        # BLEU scores
        bleu_scores = self.calculate_bleu_score(reference, candidate)
        results.update(bleu_scores)
        
        # ROUGE scores
        rouge_scores = self.calculate_rouge_scores(reference, candidate)
        results.update(rouge_scores)
        
        # BERTScore (for single pair, we need to pass as lists)
        bert_scores = self.calculate_bert_score([reference], [candidate])
        results.update(bert_scores)
        
        return results
    
    def evaluate_batch(self, references: List[str], candidates: List[str]) -> Dict[str, float]:
        """
        Evaluate multiple reference-candidate pairs
        
        Args:
            references: List of ground truth trip plans
            candidates: List of generated trip plans
            
        Returns:
            Dictionary with averaged evaluation scores
        """
        if len(references) != len(candidates):
            raise ValueError("Number of references and candidates must be equal")
        
        # Initialize score accumulator
        all_scores = {}
        
        # Calculate BLEU and ROUGE for each pair
        for ref, cand in zip(references, candidates):
            bleu_scores = self.calculate_bleu_score(ref, cand)
            rouge_scores = self.calculate_rouge_scores(ref, cand)
            
            # Accumulate scores
            for metric, score in {**bleu_scores, **rouge_scores}.items():
                if metric not in all_scores:
                    all_scores[metric] = []
                all_scores[metric].append(score)
        
        # Calculate BERTScore for the entire batch
        bert_scores = self.calculate_bert_score(references, candidates)
        
        # Average all scores
        averaged_scores = {}
        for metric, scores in all_scores.items():
            averaged_scores[metric] = np.mean(scores)
        
        # Add BERTScore
        averaged_scores.update(bert_scores)
        
        return averaged_scores


# Example usage and demonstration
def main():
    # Initialize evaluator
    evaluator = TripPlannerEvaluator()
    
    # Example trip plans for evaluation
    reference_plans = [
        """{
    "itinerary": [
        {
            "date": "2025-03-02",
            "day": "Day 1",
            "schedule": [
                {
                    "time": "14:00",
                    "activity": "Arrive at Narita International Airport (NRT) or Haneda International Airport (HND), Tokyo",
                    "lat": 35.773,
                    "lng": 140.3929
                },
                {
                    "time": "15:30",
                    "activity": "Arrival transfer to hotel in Tokyo (Remm Akihabara or similar)",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "16:30",
                    "activity": "Check-in and rest at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "19:00",
                    "activity": "Dinner and leisure in Akihabara district",
                    "lat": 35.6993,
                    "lng": 139.774
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel and overnight rest",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-03",
            "day": "Day 2",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "09:30",
                    "activity": "Visit Pokémon Center, Sunshine City, Ikebukuro",
                    "lat": 35.7296,
                    "lng": 139.7194
                },
                {
                    "time": "11:00",
                    "activity": "Explore Jump Shop, Shibuya",
                    "lat": 35.6618,
                    "lng": 139.704
                },
                {
                    "time": "12:30",
                    "activity": "Lunch near Nintendo Tokyo, Shibuya",
                    "lat": 35.6623,
                    "lng": 139.7005
                },
                {
                    "time": "14:00",
                    "activity": "Visit Capcom Store, Shinjuku",
                    "lat": 35.69384,
                    "lng": 139.7036
                },
                {
                    "time": "15:30",
                    "activity": "Shopping at Nakano Broadway",
                    "lat": 35.7074,
                    "lng": 139.6652
                },
                {
                    "time": "17:30",
                    "activity": "Visit Ghibli Museum, Mitaka",
                    "lat": 35.6961,
                    "lng": 139.5703
                },
                {
                    "time": "19:00",
                    "activity": "Explore Akihabara district, including Animate and Tamashii Nations Store",
                    "lat": 35.6993,
                    "lng": 139.774
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel for overnight stay",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-04",
            "day": "Day 3",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "09:30",
                    "activity": "Visit Fukagawa Edo Museum, Koto, Tokyo",
                    "lat": 35.6743,
                    "lng": 139.7967
                },
                {
                    "time": "11:30",
                    "activity": "Explore Tsukiji Outer Market",
                    "lat": 35.6671,
                    "lng": 139.7702
                },
                {
                    "time": "13:00",
                    "activity": "Visit Asakusa district and Sensoji Temple",
                    "lat": 35.7148,
                    "lng": 139.7967
                },
                {
                    "time": "15:00",
                    "activity": "Shopping and snacks at Nakamise Shopping Street",
                    "lat": 35.7144,
                    "lng": 139.7967
                },
                {
                    "time": "16:30",
                    "activity": "Visit Shibuya Scramble Crossing and Hachiko Statue",
                    "lat": 35.6595,
                    "lng": 139.7004
                },
                {
                    "time": "18:00",
                    "activity": "Explore Harajuku Takeshita Street",
                    "lat": 35.6702,
                    "lng": 139.702
                },
                {
                    "time": "19:30",
                    "activity": "Dinner and try Tokyo Banana sweets",
                    "lat": 35.6702,
                    "lng": 139.702
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel for overnight",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-05",
            "day": "Day 4",
            "schedule": [
                {
                    "time": "07:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "08:00",
                    "activity": "Depart Tokyo by Shinkansen to Kyoto",
                    "lat": 35.6812,
                    "lng": 139.7671
                },
                {
                    "time": "10:30",
                    "activity": "Arrive in Kyoto, visit Kaiten Sushi restaurant for lunch",
                    "lat": 35.0116,
                    "lng": 135.7681
                },
                {
                    "time": "12:00",
                    "activity": "Visit Todaiji Temple, Nara",
                    "lat": 34.6851,
                    "lng": 135.8448
                },
                {
                    "time": "14:00",
                    "activity": "Explore Nara Deer Park",
                    "lat": 34.6852,
                    "lng": 135.8434
                },
                {
                    "time": "15:30",
                    "activity": "Visit Fushimi Inari Shrine",
                    "lat": 34.9671,
                    "lng": 135.7727
                },
                {
                    "time": "17:30",
                    "activity": "Try Inari Sushi at local recommended restaurant",
                    "lat": 34.9671,
                    "lng": 135.7727
                },
                {
                    "time": "19:00",
                    "activity": "Enjoy Kyoto Station Light Show",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "20:00",
                    "activity": "Check in at Vischio Kyoto Hotel By GRANVIA or similar",
                    "lat": 34.9858,
                    "lng": 135.7585
                }
            ]
        },
        {
            "date": "2025-03-06",
            "day": "Day 5",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "09:30",
                    "activity": "Walk through Arashiyama Bamboo Grove",
                    "lat": 35.0094,
                    "lng": 135.6662
                },
                {
                    "time": "10:30",
                    "activity": "Jinrikisha (Rickshaw) ride in Arashiyama",
                    "lat": 35.0094,
                    "lng": 135.6662
                },
                {
                    "time": "12:00",
                    "activity": "Visit Golden Pavilion (Kinkakuji Temple)",
                    "lat": 35.0394,
                    "lng": 135.7292
                },
                {
                    "time": "13:30",
                    "activity": "Matcha Tea Ceremony Experience",
                    "lat": 35.0313,
                    "lng": 135.7681
                },
                {
                    "time": "15:00",
                    "activity": "Lunch - recommended local ramen",
                    "lat": 35.0313,
                    "lng": 135.7681
                },
                {
                    "time": "17:00",
                    "activity": "Visit Ninenzaka Street",
                    "lat": 35.0036,
                    "lng": 135.7787
                },
                {
                    "time": "18:30",
                    "activity": "Return to hotel for rest",
                    "lat": 34.9858,
                    "lng": 135.7585
                }
            ]
        },
        {
            "date": "2025-03-07",
            "day": "Day 6",
            "schedule": [
                {
                    "time": "07:30",
                    "activity": "Breakfast at hotel",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "08:30",
                    "activity": "Travel by bullet train to Osaka",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "09:30",
                    "activity": "Visit Universal Studios Japan",
                    "lat": 34.6643,
                    "lng": 135.4323
                },
                {
                    "time": "17:00",
                    "activity": "Explore Super Nintendo World within Universal Studios",
                    "lat": 34.6636,
                    "lng": 135.4333
                },
                {
                    "time": "19:00",
                    "activity": "Dinner and leisure in Universal Wonderland area",
                    "lat": 34.664,
                    "lng": 135.4327
                },
                {
                    "time": "21:00",
                    "activity": "Check-in at Hotel Universal Port Vita or similar",
                    "lat": 34.6633,
                    "lng": 135.4342
                }
            ]
        },
        {
            "date": "2025-03-08",
            "day": "Day 7",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 34.6633,
                    "lng": 135.4342
                },
                {
                    "time": "09:30",
                    "activity": "Check-out and departure transfer to Kansai International Airport (KIX) or Osaka International Itami Airport (ITM)",
                    "lat": 34.4347,
                    "lng": 135.244
                },
                {
                    "time": "11:00",
                    "activity": "Flight departure from Japan",
                    "lat": 34.4347,
                    "lng": 135.244
                }
            ]
        }
    ],
    "comments": "The itinerary is scheduled during early March, which is suitable for experiencing early spring in Japan. Tokyo and Kyoto may begin seeing early plum blossoms and possibly early cherry blossoms by late March, so the weather will be cool with layering recommended (light jackets and sweaters). The distances and travel times between cities such as Tokyo, Kyoto, and Osaka are manageable with efficient Shinkansen travel. Activities balance modern and traditional Japanese culture with ample time for rest and local cuisine. Early March weather in these regions can be chilly, especially in mornings and evenings."
}"""
    ]
    
    generated_plans = [
        """{
    "itinerary": [
        {
            "date": "2025-03-02",
            "day": "Day 1",
            "schedule": [
                {
                    "time": "14:00",
                    "activity": "Arrive at Narita International Airport (NRT) or Haneda International Airport (HND), Tokyo",
                    "lat": 35.773,
                    "lng": 140.3929
                },
                {
                    "time": "15:30",
                    "activity": "Arrival transfer to hotel in Tokyo (Remm Akihabara or similar)",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "16:30",
                    "activity": "Check-in and rest at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "19:00",
                    "activity": "Dinner and leisure in Akihabara district",
                    "lat": 35.6993,
                    "lng": 139.774
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel and overnight rest",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-03",
            "day": "Day 2",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "09:30",
                    "activity": "Visit Pokémon Center, Sunshine City, Ikebukuro",
                    "lat": 35.7296,
                    "lng": 139.7194
                },
                {
                    "time": "11:00",
                    "activity": "Explore Jump Shop, Shibuya",
                    "lat": 35.6618,
                    "lng": 139.704
                },
                {
                    "time": "12:30",
                    "activity": "Lunch near Nintendo Tokyo, Shibuya",
                    "lat": 35.6623,
                    "lng": 139.7005
                },
                {
                    "time": "14:00",
                    "activity": "Visit Capcom Store, Shinjuku",
                    "lat": 35.69384,
                    "lng": 139.7036
                },
                {
                    "time": "15:30",
                    "activity": "Shopping at Nakano Broadway",
                    "lat": 35.7074,
                    "lng": 139.6652
                },
                {
                    "time": "17:30",
                    "activity": "Visit Ghibli Museum, Mitaka",
                    "lat": 35.6961,
                    "lng": 139.5703
                },
                {
                    "time": "19:00",
                    "activity": "Explore Akihabara district, including Animate and Tamashii Nations Store",
                    "lat": 35.6993,
                    "lng": 139.774
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel for overnight stay",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-04",
            "day": "Day 3",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "09:30",
                    "activity": "Visit Fukagawa Edo Museum, Koto, Tokyo",
                    "lat": 35.6743,
                    "lng": 139.7967
                },
                {
                    "time": "11:30",
                    "activity": "Explore Tsukiji Outer Market",
                    "lat": 35.6671,
                    "lng": 139.7702
                },
                {
                    "time": "13:00",
                    "activity": "Visit Asakusa district and Sensoji Temple",
                    "lat": 35.7148,
                    "lng": 139.7967
                },
                {
                    "time": "15:00",
                    "activity": "Shopping and snacks at Nakamise Shopping Street",
                    "lat": 35.7144,
                    "lng": 139.7967
                },
                {
                    "time": "16:30",
                    "activity": "Visit Shibuya Scramble Crossing and Hachiko Statue",
                    "lat": 35.6595,
                    "lng": 139.7004
                },
                {
                    "time": "18:00",
                    "activity": "Explore Harajuku Takeshita Street",
                    "lat": 35.6702,
                    "lng": 139.702
                },
                {
                    "time": "19:30",
                    "activity": "Dinner and try Tokyo Banana sweets",
                    "lat": 35.6702,
                    "lng": 139.702
                },
                {
                    "time": "21:00",
                    "activity": "Return to hotel for overnight",
                    "lat": 35.69868,
                    "lng": 139.77311
                }
            ]
        },
        {
            "date": "2025-03-05",
            "day": "Day 4",
            "schedule": [
                {
                    "time": "07:00",
                    "activity": "Breakfast at hotel",
                    "lat": 35.69868,
                    "lng": 139.77311
                },
                {
                    "time": "08:00",
                    "activity": "Depart Tokyo by Shinkansen to Kyoto",
                    "lat": 35.6812,
                    "lng": 139.7671
                },
                {
                    "time": "10:30",
                    "activity": "Arrive in Kyoto, visit Kaiten Sushi restaurant for lunch",
                    "lat": 35.0116,
                    "lng": 135.7681
                },
                {
                    "time": "12:00",
                    "activity": "Visit Todaiji Temple, Nara",
                    "lat": 34.6851,
                    "lng": 135.8448
                },
                {
                    "time": "14:00",
                    "activity": "Explore Nara Deer Park",
                    "lat": 34.6852,
                    "lng": 135.8434
                },
                {
                    "time": "15:30",
                    "activity": "Visit Fushimi Inari Shrine",
                    "lat": 34.9671,
                    "lng": 135.7727
                },
                {
                    "time": "17:30",
                    "activity": "Try Inari Sushi at local recommended restaurant",
                    "lat": 34.9671,
                    "lng": 135.7727
                },
                {
                    "time": "19:00",
                    "activity": "Enjoy Kyoto Station Light Show",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "20:00",
                    "activity": "Check in at Vischio Kyoto Hotel By GRANVIA or similar",
                    "lat": 34.9858,
                    "lng": 135.7585
                }
            ]
        },
        {
            "date": "2025-03-06",
            "day": "Day 5",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "09:30",
                    "activity": "Walk through Arashiyama Bamboo Grove",
                    "lat": 35.0094,
                    "lng": 135.6662
                },
                {
                    "time": "10:30",
                    "activity": "Jinrikisha (Rickshaw) ride in Arashiyama",
                    "lat": 35.0094,
                    "lng": 135.6662
                },
                {
                    "time": "12:00",
                    "activity": "Visit Golden Pavilion (Kinkakuji Temple)",
                    "lat": 35.0394,
                    "lng": 135.7292
                },
                {
                    "time": "13:30",
                    "activity": "Matcha Tea Ceremony Experience",
                    "lat": 35.0313,
                    "lng": 135.7681
                },
                {
                    "time": "15:00",
                    "activity": "Lunch - recommended local ramen",
                    "lat": 35.0313,
                    "lng": 135.7681
                },
                {
                    "time": "17:00",
                    "activity": "Visit Ninenzaka Street",
                    "lat": 35.0036,
                    "lng": 135.7787
                },
                {
                    "time": "18:30",
                    "activity": "Return to hotel for rest",
                    "lat": 34.9858,
                    "lng": 135.7585
                }
            ]
        },
        {
            "date": "2025-03-07",
            "day": "Day 6",
            "schedule": [
                {
                    "time": "07:30",
                    "activity": "Breakfast at hotel",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "08:30",
                    "activity": "Travel by bullet train to Osaka",
                    "lat": 34.9858,
                    "lng": 135.7585
                },
                {
                    "time": "09:30",
                    "activity": "Visit Universal Studios Japan",
                    "lat": 34.6643,
                    "lng": 135.4323
                },
                {
                    "time": "17:00",
                    "activity": "Explore Super Nintendo World within Universal Studios",
                    "lat": 34.6636,
                    "lng": 135.4333
                },
                {
                    "time": "19:00",
                    "activity": "Dinner and leisure in Universal Wonderland area",
                    "lat": 34.664,
                    "lng": 135.4327
                },
                {
                    "time": "21:00",
                    "activity": "Check-in at Hotel Universal Port Vita or similar",
                    "lat": 34.6633,
                    "lng": 135.4342
                }
            ]
        },
        {
            "date": "2025-03-08",
            "day": "Day 7",
            "schedule": [
                {
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "lat": 34.6633,
                    "lng": 135.4342
                },
                {
                    "time": "09:30",
                    "activity": "Check-out and departure transfer to Kansai International Airport (KIX) or Osaka International Itami Airport (ITM)",
                    "lat": 34.4347,
                    "lng": 135.244
                },
                {
                    "time": "11:00",
                    "activity": "Flight departure from Japan",
                    "lat": 34.4347,
                    "lng": 135.244
                }
            ]
        }
    ],
    "comments": "The itinerary is scheduled during early March, which is suitable for experiencing early spring in Japan. Tokyo and Kyoto may begin seeing early plum blossoms and possibly early cherry blossoms by late March, so the weather will be cool with layering recommended (light jackets and sweaters). The distances and travel times between cities such as Tokyo, Kyoto, and Osaka are manageable with efficient Shinkansen travel. Activities balance modern and traditional Japanese culture with ample time for rest and local cuisine. Early March weather in these regions can be chilly, especially in mornings and evenings."
}"""
    ]
    
    print("=== Single Pair Evaluation ===")
    # Evaluate single pair
    single_scores = evaluator.evaluate_single_pair(reference_plans[0], generated_plans[0])
    for metric, score in single_scores.items():
        print(f"{metric}: {score:.4f}")
    
    print("\n=== Batch Evaluation ===")
    # Evaluate batch
    batch_scores = evaluator.evaluate_batch(reference_plans, generated_plans)
    for metric, score in batch_scores.items():
        print(f"{metric}: {score:.4f}")
    
    print("\n=== Interpretation Guide ===")
    print("BLEU Scores (0-1, higher is better):")
    print("  - 0.0-0.3: Poor quality")
    print("  - 0.3-0.6: Reasonable quality") 
    print("  - 0.6-1.0: High quality")
    print("\nROUGE Scores (0-1, higher is better):")
    print("  - ROUGE-1: Unigram overlap")
    print("  - ROUGE-2: Bigram overlap") 
    print("  - ROUGE-L: Longest common subsequence")
    print("\nBERTScore (0-1, higher is better):")
    print("  - Captures semantic similarity better than n-gram metrics")
    print("  - More robust to paraphrasing and word choice variations")


if __name__ == "__main__":
    main()

# Installation requirements:
# pip install nltk rouge-score bert-score transformers torch

# Additional setup for NLTK (run once):
# import nltk
# nltk.download('punkt_tab')  # For newer NLTK versions
# nltk.download('punkt')      # For older NLTK versions
