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
        """
        {
    "itinerary": [
        {
            "date": "2025-03-02",
            "day": "Day 1",
            "schedule": [
                {
                    "time": "14:00",
                    "activity": "Arrive at Narita Int'l Airport (NRT) or Haneda Int'l Airport (HND)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:30",
                    "activity": "Transfer to hotel and check-in",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Rest at hotel and prepare for the tour starting tomorrow",
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
                    "time": "08:00",
                    "activity": "Visit Tsukiji Fish Market",
                    "need_location": true,
                    "specific_location_name": "Tsukiji Fish Market",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "10:30",
                    "activity": "Explore Sensoji Temple",
                    "need_location": true,
                    "specific_location_name": "Sensoji Temple",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:30",
                    "activity": "Enjoy seasonal Japanese lunch",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:00",
                    "activity": "Experience Shibuya Scramble Crossing and photograph Shibuya Hachiko Statue",
                    "need_location": true,
                    "specific_location_name": "Shibuya Hachiko Statue",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:00",
                    "activity": "Visit teamLab Planets TOKYO immersive digital art museum",
                    "need_location": true,
                    "specific_location_name": "teamLab Planets TOKYO",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:30",
                    "activity": "Return to hotel and evening at leisure",
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
                    "time": "09:00",
                    "activity": "Tour the Ghibli Museum in Mitaka",
                    "need_location": true,
                    "specific_location_name": "Ghibli Museum",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:30",
                    "activity": "Explore Nakano Broadway shopping complex",
                    "need_location": true,
                    "specific_location_name": "Nakano Broadway",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Lunch at a famous ramen shop",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:30",
                    "activity": "Visit Pokemon Center and Pikachu Sweets Cafe in Ikebukuro",
                    "need_location": true,
                    "specific_location_name": "Pokemon Center",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:00",
                    "activity": "Shop at Animate Ikebukuro and Mugiwara Store",
                    "need_location": true,
                    "specific_location_name": "Animate Ikebukuro",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:30",
                    "activity": "Explore Akihabara area: Tamashii Nations Store Tokyo, Super Potato, Maid Cafe",
                    "need_location": true,
                    "specific_location_name": "Akihabara",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:30",
                    "activity": "Return to hotel and rest",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Free day at leisure to explore Tokyo or optional tours (e.g., Tokyo Disneyland, DisneySea, Sanrio Puroland)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
                    "activity": "Return to hotel",
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
                    "time": "09:00",
                    "activity": "Visit AnimeJapan Festival",
                    "need_location": true,
                    "specific_location_name": "AnimeJapan",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Explore Gundam Base Tokyo in Odaiba",
                    "need_location": true,
                    "specific_location_name": "Gundam Base Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Visit Small Worlds Tokyo exhibition",
                    "need_location": true,
                    "specific_location_name": "Small Worlds Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Return to hotel and prepare for departure",
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
                    "time": "08:00",
                    "activity": "Breakfast and check-out",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "10:00",
                    "activity": "Departure transfer to Narita Int'l Airport (NRT) or Haneda Int'l Airport (HND)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        }
    ],
    "comments": "The trip takes place in early March, which is the beginning of spring in Japan. While cherry blossoms start blooming mostly from late March to early April in Tokyo, early March might be a little early for full cherry blossom viewing but you can still enjoy early plum blossoms and the beginnings of spring scenery. The weather is cool, suitable for layered clothing with light jackets and sweaters. The itinerary is designed around Tokyo's anime culture and includes manageable travel distances within Tokyo with one free day for optional exploration or rest. Travel times between locations are reasonable to ensure a comfortable pace."
}
"""
    ]
    
    generated_plans = [
        """
        {
    "itinerary": [
        {
            "date": "2025-03-02",
            "day": "Day 1",
            "schedule": [
                {
                    "time": "14:00",
                    "activity": "Arrive at Narita Int'l Airport (NRT) or Haneda Int'l Airport (HND)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:30",
                    "activity": "Arrival Transfer to hotel in downtown Tokyo",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Check-in Tobu Hotel Levant Tokyo or similar",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
                    "activity": "Hotel rest time and leisure",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Explore Tsukiji Fish Market",
                    "need_location": true,
                    "specific_location_name": "Tsukiji Fish Market",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:00",
                    "activity": "Visit Sensoji Temple in Asakusa",
                    "need_location": true,
                    "specific_location_name": "Sensoji Temple",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:30",
                    "activity": "Lunch - Seasonal Japanese meal",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:00",
                    "activity": "Walk Nakamise-dori shopping street",
                    "need_location": true,
                    "specific_location_name": "Nakamise-dori",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:30",
                    "activity": "Visit Shibuya Scramble Crossing",
                    "need_location": true,
                    "specific_location_name": "Shibuya Scramble Crossing",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:00",
                    "activity": "Photo at Shibuya Hachiko Statue",
                    "need_location": true,
                    "specific_location_name": "Hachiko Statue",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Visit teamLab Planets TOKYO",
                    "need_location": true,
                    "specific_location_name": "teamLab Planets TOKYO",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Visit Ghibli Museum in Mitaka",
                    "need_location": true,
                    "specific_location_name": "Ghibli Museum",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "11:00",
                    "activity": "Explore Nakano Broadway shopping complex",
                    "need_location": true,
                    "specific_location_name": "Nakano Broadway",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "12:30",
                    "activity": "Lunch at a famous ramen shop",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "14:00",
                    "activity": "Visit Pokémon Center Mega Tokyo",
                    "need_location": true,
                    "specific_location_name": "Pokémon Center Mega Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Enjoy sweets at Pikachu Sweets Cafe",
                    "need_location": true,
                    "specific_location_name": "Pikachu Sweets Cafe",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "16:00",
                    "activity": "Shop at Animate Ikebukuro",
                    "need_location": true,
                    "specific_location_name": "Animate Ikebukuro",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "17:00",
                    "activity": "Visit Tamashii Nations Store Tokyo in Akihabara",
                    "need_location": true,
                    "specific_location_name": "Tamashii Nations Store Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Stop by Super Potato retro game shop",
                    "need_location": true,
                    "specific_location_name": "Super Potato",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Free day at your own leisure to explore Tokyo or visit optional attractions such as Tokyo Disneyland or DisneySea, Sailor Moon Store, Harajuku Kiddy Land",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "19:00",
                    "activity": "Return to hotel",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "09:00",
                    "activity": "Visit AnimeJapan Festival",
                    "need_location": true,
                    "specific_location_name": "AnimeJapan Festival",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "13:00",
                    "activity": "Explore Gundam Base Tokyo in Odaiba",
                    "need_location": true,
                    "specific_location_name": "Gundam Base Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "15:00",
                    "activity": "Visit Small Worlds Tokyo",
                    "need_location": true,
                    "specific_location_name": "Small Worlds Tokyo",
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "18:00",
                    "activity": "Return to hotel",
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
                    "time": "08:00",
                    "activity": "Breakfast at hotel",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                },
                {
                    "time": "10:00",
                    "activity": "Departure transfer to Narita Int'l Airport (NRT) or Haneda Int'l Airport (HND)",
                    "need_location": false,
                    "specific_location_name": null,
                    "lat": null,
                    "lng": null
                }
            ]
        }
    ],
    "comments": "The travel period is early March, which aligns well with the beginning of cherry blossom season in Tokyo; some early blooms may be visible especially later in the period. The itinerary distances are manageable within Tokyo and Odaiba areas with transit times considered. Activities are balanced with cultural, anime-related, and leisure time, suitable for spring weather with light jackets advised as temperatures can be cool in March."
}
"""
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
