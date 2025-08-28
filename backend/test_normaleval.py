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
    reference_plans = ['{"Title": "Traverse Japan with Anime", "Itinerary": ""description": "[ Tokyo - Nara - Kyoto - Osaka ] Explore Tokyo and Kyoto with our "Traverse Japan Tour." Discover iconic spots like Tokyo\'s Tsukiji Fish Market, the vibrant district of Asakusa, and immerse yourself in the world of Japanese animation at the Ghibli Museum. In Kyoto, find serenity at Fushimi Inari Shrine and Arashiyama. Enjoy sushi and experience the thrill of taking the Shinkansen. Join us for tradition and modernity in Japan. *The minimum number of participants for this tour is two.",            "days": [                {                    "day": "1",                    "head": "Arrive in Japan\', \'Check-in Hotel",                    "text": "Breakfast Narita Int\'l Airport (NRT) or Haneda Int\'l Airport (HND)   *Designated Arrival Airport(s) Arrival Transfer   Purchase Optional Travel Insurance Welcome to Japan! Japan Deluxe Tours has arranged transportation services to meet you at your airport\'s arrival lobby and will take you to your hotel. Rest at the hotel and be ready to start your exciting tour tomorrow. **INFORMATION** From Narita Airport to downtown hotel in Tokyo - about 90 mins(Bus) From Haneda Airport to downtown hotel in Tokyo - about 30 mins(Bus) Remm AKIHABARA or similar Breakfast"                },                {                    "day": "2",                    "head": "Meet Your Favorite Iconic Anime Characters",                    "text": "Breakfast Pokemon Center   JUMP SHOP   Nintendo Tokyo   CAPCOM STORE   Nakano Broadway   Ghibli Museum   Akihabara   Animate   Tamashii Nations Store Tokyo   Gacha Gacha Machines   Sofmap Amusement Store (JDT Recommend)   Super Potato (JDT Recommends)   Return to a hotel Our journey today will lead us to some of Tokyo\'s most exciting and dynamic destinations, beginning with a visit to the PokÃ©mon Center, a paradise for PokÃ©mon enthusiasts. Here, you can explore a wide range of PokÃ©mon-themed merchandise, from plush toys to trading cards. Next, we\'ll head to the Jump Shop, where you can immerse yourself in the world of Shonen Jump manga and anime. This store offers a diverse selection of manga volumes, character goods, and collectibles from popular series such as ONE PIECE, Dragon Ball, Demon Slayers, and many more. Our journey will then lead us to Nintendo Tokyo, a haven for video game aficionados. Inside, you\'ll encounter a splendid assortment of Nintendo merchandise, games, and exclusive items inspired by iconic Nintendo characters and franchises, including the legendary Mario. For enthusiasts of Capcom\'s renowned video game titles, the Capcom Store is an essential destination. This store features a remarkable collection of Capcom video game memorabilia, including stylish apparel, accessories, and exclusive items from beloved game series such as Resident Evil and Street Fighter. Afterward, we\'ll explore Nakano Broadway, a shopping complex known for its anime and pop culture shops. Here, you can browse through an array of stores offering anime figures, vintage collectibles, and rare merchandise from various series. The day will conclude with a visit to the enchanting Ghibli Museum, a celebration of Studio Ghibli\'s animation and artistry. You\'ll have the chance to explore the museum\'s unique exhibits, watch exclusive short films, and experience the magic of Ghibli. Our anime adventure will also take us to Akihabara, a mecca for electronics and anime enthusiasts. In Akihabara, you can explore Animate, a massive store dedicated to anime and manga, as well as Tamashii Nations, a place to discover high-quality action figures and collectibles. Lastly, we\'ll visit Gachapon, a store where you can indulge in the fun of Japanese capsule toys. Here, you can find a wide variety of collectible figures and quirky items from capsule machines, offering a unique and enjoyable shopping experience. Remm AKIHABARA or similar Breakfast"                },                {                    "day": "3",                    "head": "Exploring Historical Asakusa and Vibrant Shibuya",                    "text": "Breakfast Lunch [ Tokyo ] Fukagawa Edo Museum   Tsukiji Fish Market   Asakusa   Sensoji Temple   Shibuya Scramble Crossing   Shibuya Hachiko   Harajuku Takeshita Street   Tokyo Banana (JDT Recommends)   Return to the hotel   Today\'s itinerary will take you to some of Tokyo\'s most iconic and vibrant locations, beginning with a visit to the Fukagawa Edo Museum. This museum provides a fascinating glimpse into Tokyo\'s history, particularly during the Edo period. As you explore, you\'ll step back in time and wander through meticulously recreated streets from Japan\'s traditional Edo era.Next, we\'ll make our way to Tsukiji, where you can experience the bustling Tsukiji Outer Market. Here, you\'ll encounter a wide array of fresh flavors and delectable dishes. Tsukiji Outer Market is renowned for its seafood offerings and is the perfect place to savor mouthwatering sushi and other culinary delights.Afterward, we\'ll head to the historic district of Asakusa, where you\'ll have the opportunity to explore the iconic Sensoji Temple. This temple is one of Tokyo\'s most popular and revered religious sites, known for its stunning architecture and cultural significance. You can immerse yourself in Japanese traditions, capture memorable photographs, and browse the bustling Nakamise Shopping Street for traditional souvenirs and snacks.Finally, we\'ll conclude our day with a visit to Shibuya, where you can witness the famous Hachiko Statue and experience the excitement of Shibuya Crossing. The Hachiko Statue pays tribute to the heartwarming story of Hachiko, the loyal dog, and is a popular meeting point for locals and visitors alike. Shibuya Crossing, on the other hand, is a mesmerizing spectacle where thousands of pedestrians cross simultaneously. It\'s a must-see phenomenon that offers a glimpse into Tokyo\'s vibrant urban life. Remm AKIHABARA or similar Breakfast Lunch"         },                {                    "day": "4",                    "head": "The Endless Gates of Fushimi Inari",                    "text": "Breakfast Lunch Bullet Train [ Kyoto Prefecture ] Kaiten Sushi   [ Nara Prefecture ] Todaiji Temple   Deer Park   Fushimi Inari Shrine   Inari Sushi (JDT Recommends)   Kyoto Station Light Show (JDT Recommend)   Check into a hotel Our day begins with a bullet train experience to Kyoto, allowing you to enjoy the thrill of riding the Shinkansen, Japan\'s high-speed train. The Shinkansen is not only a rapid mode of transportation but also an essential Japanese experience. As you journey to Kyoto in comfort and speed, be sure to capture some stunning photos of the scenic landscapes along the way. Upon arrival in Kyoto, we\'ll delight in a unique dining experience at a rotating sushi restaurant. Here, you can savor a variety of delicious sushi dishes while enjoying the fun and novelty of the rotating sushi conveyor belt. Our next stop will be the majestic Todai-ji Temple (Eastern Great Temple), where you can explore the grandeur of one of Japan\'s most iconic Buddhist temples. Inside, you\'ll find the impressive Great Buddha Hall, which houses one of the largest bronze statues of Buddha in the world. Following our visit to Todai-ji Temple, we\'ll head to Nara Park, known for its friendly deer population. You can interact with these gentle creatures, feed them, and even take memorable photos as you enjoy the serene natural surroundings. Next, our journey takes us to Fushimi Inari Shrine, a renowned Shinto shrine famous for its thousands of vibrant red torii gates that create a captivating path. You can take a leisurely stroll through this picturesque shrine, capturing photos and embracing the tranquil atmosphere. As evening descends, we\'ll make our way to Kyoto Station to witness the enchanting illumination display, transforming the station into a dazzling spectacle. This dazzling light show at Kyoto Station is a perfect way to conclude our day of exploration. Vischio Kyoto Hotel By GRANVIA or similar Breakfast Lunch"                },          {                    "day": "5",                    "head": "Serene Stroll Through Arashiyama Bamboo Grove\', \'Rickshaw Ride",                    "text": "Breakfast Arashiyama   Jinrikisha Ride Experience   Golden Pavilion   Matcha Experience   Ninenzaka   Yatsuhashi (JDT Recommends)   Ramen (JDT Recommends)   Return to the hotel Our day begins with a visit to Arashiyama to walk through the Bamboo Groove Forest. The morning\'s sunlight passing through the bamboo makes for a perfect morning sight. We will also enjoy a spirited rickshaw ride through Arashiyama. Guests can enjoy seeing many of the traditional-style shops and temples during the ride. Following our time in Arashiyama, we will head to the Golden Pavilion, or Kinkakuji Temple, a Japanâ€™s must see attraction where the two upper floors are covered in gold leaf. The reflection of the golden temple on the lake adds to the stunning sight. After our time at the Golden Pavilion, we will stop at a sake museum for some sampling and to learn the history of Japan\'s national drink. We will also be stopping for a kaiten sushi lunch during your Japan tour. Keeping with the traditional feel, we included a tea-ceremony to help you relax and enjoy Japanese culture. After our tea ceremony, it\'s off to Nara to Todaiji Temple. Todaiji Temple holds the World Guinness Record as the largest wooden building. Inside the temple, you will behold the largest Buddha statue in Japan. Just outside the temple is the Nara Deer Park, where you will be greeted by numerous deer that roam around freely. The deer here at the park are known to be friendly and may even bow at you for a little treat. We then return to the hotel. Vischio Kyoto Hotel By GRANVIA or similar Breakfast"                },             {                    "day": "6",                    "head": "Universal Studio Japan",                    "text": "Breakfast Universal Studios Japan   Super Nintendo World (JDT Recommend)   Universal Wonderland - Hello Kitty   Check into a hotel Explore Nintendo World Area at Universal Studio Japan in Osaka on your self-guided day. Get ready to slap on your Mario Kart racing gear and toss some Koopa Shells. Do not forget to purchase Power-up Bands, a wristband that can be linked to a smartphone app or a Nitendo Switch, where they can store these virtual coins and keys. Enjoy other attractions and areas at Universal Studio Japan such as Hollywood Dream Ride and Hello Kittyâ€™s Cupcake Dream. After an exciting day at Universal studio Japan, we will go back to a hotel. *Entering Mario World requires an additional fee. (Express Pass) *The transportation from Kyoto to Universal Studios will be a Shared Bus. Private car transportation will be an additional cost of $200 per car. HOTEL UNIVERSAL PORT VITA or similar Breakfast"                },                {                    "day": "7",                    "head": "Tour Disbands\', \'Depart from Japan",                    "text": "Breakfast Departure Transfer   Kansai Int\'l Airport (KIX) or Osaka Int\'l Airport (ITM) - Itami Airport   *Designated Departure Airport(s) Your pleasant and memorable Japan tour ends today. The tour will disband after breakfast. Fly home with cherished memories or enjoy your extended stay in Japan. **INFORMATION** From downtown hotel in Osaka to KIX Airport - about 70 mins (Bus) From downtown hotel in Osaka to ITM Airport - about 30 mins (Bus) Breakfast"                },]"}'
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
