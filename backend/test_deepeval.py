import os
from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI
# from deepeval.test_case import LLMTestCase

OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, ContextualRelevancyMetric, BiasMetric, ToxicityMetric, NonAdviceMetric, PIILeakageMetric, RoleViolationMetric
# MisuseMetric,

json_structure = json_structure = """
    {
        "itinerary": [
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 }
            ]
            },
            {
            "date": "YYYY-MM-DD",
            "day": "Day x",
            "schedule": [
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 },
                { "time": "HH:mm", "activity": "", "lat": 0.0, "lng": 0.0 }
            ]
            }
        ],
        "comments": "comments or additional notes about the itinerary"
    }
"""

season_data = """{
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
"""

context = ['{"Title": "Traverse Japan with Anime", "Itinerary": ""description": "[ Tokyo - Nara - Kyoto - Osaka ] Explore Tokyo and Kyoto with our "Traverse Japan Tour." Discover iconic spots like Tokyo\'s Tsukiji Fish Market, the vibrant district of Asakusa, and immerse yourself in the world of Japanese animation at the Ghibli Museum. In Kyoto, find serenity at Fushimi Inari Shrine and Arashiyama. Enjoy sushi and experience the thrill of taking the Shinkansen. Join us for tradition and modernity in Japan. *The minimum number of participants for this tour is two.",            "days": [                {                    "day": "1",                    "head": "Arrive in Japan\', \'Check-in Hotel",                    "text": "Breakfast Narita Int\'l Airport (NRT) or Haneda Int\'l Airport (HND)   *Designated Arrival Airport(s) Arrival Transfer   Purchase Optional Travel Insurance Welcome to Japan! Japan Deluxe Tours has arranged transportation services to meet you at your airport\'s arrival lobby and will take you to your hotel. Rest at the hotel and be ready to start your exciting tour tomorrow. **INFORMATION** From Narita Airport to downtown hotel in Tokyo - about 90 mins(Bus) From Haneda Airport to downtown hotel in Tokyo - about 30 mins(Bus) Remm AKIHABARA or similar Breakfast"                },                {                    "day": "2",                    "head": "Meet Your Favorite Iconic Anime Characters",                    "text": "Breakfast Pokemon Center   JUMP SHOP   Nintendo Tokyo   CAPCOM STORE   Nakano Broadway   Ghibli Museum   Akihabara   Animate   Tamashii Nations Store Tokyo   Gacha Gacha Machines   Sofmap Amusement Store (JDT Recommend)   Super Potato (JDT Recommends)   Return to a hotel Our journey today will lead us to some of Tokyo\'s most exciting and dynamic destinations, beginning with a visit to the PokÃ©mon Center, a paradise for PokÃ©mon enthusiasts. Here, you can explore a wide range of PokÃ©mon-themed merchandise, from plush toys to trading cards. Next, we\'ll head to the Jump Shop, where you can immerse yourself in the world of Shonen Jump manga and anime. This store offers a diverse selection of manga volumes, character goods, and collectibles from popular series such as ONE PIECE, Dragon Ball, Demon Slayers, and many more. Our journey will then lead us to Nintendo Tokyo, a haven for video game aficionados. Inside, you\'ll encounter a splendid assortment of Nintendo merchandise, games, and exclusive items inspired by iconic Nintendo characters and franchises, including the legendary Mario. For enthusiasts of Capcom\'s renowned video game titles, the Capcom Store is an essential destination. This store features a remarkable collection of Capcom video game memorabilia, including stylish apparel, accessories, and exclusive items from beloved game series such as Resident Evil and Street Fighter. Afterward, we\'ll explore Nakano Broadway, a shopping complex known for its anime and pop culture shops. Here, you can browse through an array of stores offering anime figures, vintage collectibles, and rare merchandise from various series. The day will conclude with a visit to the enchanting Ghibli Museum, a celebration of Studio Ghibli\'s animation and artistry. You\'ll have the chance to explore the museum\'s unique exhibits, watch exclusive short films, and experience the magic of Ghibli. Our anime adventure will also take us to Akihabara, a mecca for electronics and anime enthusiasts. In Akihabara, you can explore Animate, a massive store dedicated to anime and manga, as well as Tamashii Nations, a place to discover high-quality action figures and collectibles. Lastly, we\'ll visit Gachapon, a store where you can indulge in the fun of Japanese capsule toys. Here, you can find a wide variety of collectible figures and quirky items from capsule machines, offering a unique and enjoyable shopping experience. Remm AKIHABARA or similar Breakfast"                },                {                    "day": "3",                    "head": "Exploring Historical Asakusa and Vibrant Shibuya",                    "text": "Breakfast Lunch [ Tokyo ] Fukagawa Edo Museum   Tsukiji Fish Market   Asakusa   Sensoji Temple   Shibuya Scramble Crossing   Shibuya Hachiko   Harajuku Takeshita Street   Tokyo Banana (JDT Recommends)   Return to the hotel   Today\'s itinerary will take you to some of Tokyo\'s most iconic and vibrant locations, beginning with a visit to the Fukagawa Edo Museum. This museum provides a fascinating glimpse into Tokyo\'s history, particularly during the Edo period. As you explore, you\'ll step back in time and wander through meticulously recreated streets from Japan\'s traditional Edo era.Next, we\'ll make our way to Tsukiji, where you can experience the bustling Tsukiji Outer Market. Here, you\'ll encounter a wide array of fresh flavors and delectable dishes. Tsukiji Outer Market is renowned for its seafood offerings and is the perfect place to savor mouthwatering sushi and other culinary delights.Afterward, we\'ll head to the historic district of Asakusa, where you\'ll have the opportunity to explore the iconic Sensoji Temple. This temple is one of Tokyo\'s most popular and revered religious sites, known for its stunning architecture and cultural significance. You can immerse yourself in Japanese traditions, capture memorable photographs, and browse the bustling Nakamise Shopping Street for traditional souvenirs and snacks.Finally, we\'ll conclude our day with a visit to Shibuya, where you can witness the famous Hachiko Statue and experience the excitement of Shibuya Crossing. The Hachiko Statue pays tribute to the heartwarming story of Hachiko, the loyal dog, and is a popular meeting point for locals and visitors alike. Shibuya Crossing, on the other hand, is a mesmerizing spectacle where thousands of pedestrians cross simultaneously. It\'s a must-see phenomenon that offers a glimpse into Tokyo\'s vibrant urban life. Remm AKIHABARA or similar Breakfast Lunch"         },                {                    "day": "4",                    "head": "The Endless Gates of Fushimi Inari",                    "text": "Breakfast Lunch Bullet Train [ Kyoto Prefecture ] Kaiten Sushi   [ Nara Prefecture ] Todaiji Temple   Deer Park   Fushimi Inari Shrine   Inari Sushi (JDT Recommends)   Kyoto Station Light Show (JDT Recommend)   Check into a hotel Our day begins with a bullet train experience to Kyoto, allowing you to enjoy the thrill of riding the Shinkansen, Japan\'s high-speed train. The Shinkansen is not only a rapid mode of transportation but also an essential Japanese experience. As you journey to Kyoto in comfort and speed, be sure to capture some stunning photos of the scenic landscapes along the way. Upon arrival in Kyoto, we\'ll delight in a unique dining experience at a rotating sushi restaurant. Here, you can savor a variety of delicious sushi dishes while enjoying the fun and novelty of the rotating sushi conveyor belt. Our next stop will be the majestic Todai-ji Temple (Eastern Great Temple), where you can explore the grandeur of one of Japan\'s most iconic Buddhist temples. Inside, you\'ll find the impressive Great Buddha Hall, which houses one of the largest bronze statues of Buddha in the world. Following our visit to Todai-ji Temple, we\'ll head to Nara Park, known for its friendly deer population. You can interact with these gentle creatures, feed them, and even take memorable photos as you enjoy the serene natural surroundings. Next, our journey takes us to Fushimi Inari Shrine, a renowned Shinto shrine famous for its thousands of vibrant red torii gates that create a captivating path. You can take a leisurely stroll through this picturesque shrine, capturing photos and embracing the tranquil atmosphere. As evening descends, we\'ll make our way to Kyoto Station to witness the enchanting illumination display, transforming the station into a dazzling spectacle. This dazzling light show at Kyoto Station is a perfect way to conclude our day of exploration. Vischio Kyoto Hotel By GRANVIA or similar Breakfast Lunch"                },          {                    "day": "5",                    "head": "Serene Stroll Through Arashiyama Bamboo Grove\', \'Rickshaw Ride",                    "text": "Breakfast Arashiyama   Jinrikisha Ride Experience   Golden Pavilion   Matcha Experience   Ninenzaka   Yatsuhashi (JDT Recommends)   Ramen (JDT Recommends)   Return to the hotel Our day begins with a visit to Arashiyama to walk through the Bamboo Groove Forest. The morning\'s sunlight passing through the bamboo makes for a perfect morning sight. We will also enjoy a spirited rickshaw ride through Arashiyama. Guests can enjoy seeing many of the traditional-style shops and temples during the ride. Following our time in Arashiyama, we will head to the Golden Pavilion, or Kinkakuji Temple, a Japanâ€™s must see attraction where the two upper floors are covered in gold leaf. The reflection of the golden temple on the lake adds to the stunning sight. After our time at the Golden Pavilion, we will stop at a sake museum for some sampling and to learn the history of Japan\'s national drink. We will also be stopping for a kaiten sushi lunch during your Japan tour. Keeping with the traditional feel, we included a tea-ceremony to help you relax and enjoy Japanese culture. After our tea ceremony, it\'s off to Nara to Todaiji Temple. Todaiji Temple holds the World Guinness Record as the largest wooden building. Inside the temple, you will behold the largest Buddha statue in Japan. Just outside the temple is the Nara Deer Park, where you will be greeted by numerous deer that roam around freely. The deer here at the park are known to be friendly and may even bow at you for a little treat. We then return to the hotel. Vischio Kyoto Hotel By GRANVIA or similar Breakfast"                },             {                    "day": "6",                    "head": "Universal Studio Japan",                    "text": "Breakfast Universal Studios Japan   Super Nintendo World (JDT Recommend)   Universal Wonderland - Hello Kitty   Check into a hotel Explore Nintendo World Area at Universal Studio Japan in Osaka on your self-guided day. Get ready to slap on your Mario Kart racing gear and toss some Koopa Shells. Do not forget to purchase Power-up Bands, a wristband that can be linked to a smartphone app or a Nitendo Switch, where they can store these virtual coins and keys. Enjoy other attractions and areas at Universal Studio Japan such as Hollywood Dream Ride and Hello Kittyâ€™s Cupcake Dream. After an exciting day at Universal studio Japan, we will go back to a hotel. *Entering Mario World requires an additional fee. (Express Pass) *The transportation from Kyoto to Universal Studios will be a Shared Bus. Private car transportation will be an additional cost of $200 per car. HOTEL UNIVERSAL PORT VITA or similar Breakfast"                },                {                    "day": "7",                    "head": "Tour Disbands\', \'Depart from Japan",                    "text": "Breakfast Departure Transfer   Kansai Int\'l Airport (KIX) or Osaka Int\'l Airport (ITM) - Itami Airport   *Designated Departure Airport(s) Your pleasant and memorable Japan tour ends today. The tour will disband after breakfast. Fly home with cherished memories or enjoy your extended stay in Japan. **INFORMATION** From downtown hotel in Osaka to KIX Airport - about 70 mins (Bus) From downtown hotel in Osaka to ITM Airport - about 30 mins (Bus) Breakfast"                },]"}'
           , '{"Title": "Winter Discovery | Snow Monkey", "Itinerary": ""description": "Unveil the magic of winter in Japan on this unforgettable 7-day adventure! Start in Kyoto , exploring iconic landmarks like Todaiji Temple in Nara , the mesmerizing vermillion gates of Fushimi Inari Shrine , and the engaging Samurai\', \'Ninja Museum . Immerse yourself in Arashiyama\'s serene bamboo grove with a rickshaw ride, marvel at the gilded beauty of Kinkaku-ji (Golden Pavilion) , and participate in a traditional tea ceremony. Enjoy a special dinner with a Maiko , a geisha in training. Travel via the high-speed Shinkansen to Hakone , ascend via the Hakone Ropeway to the volcanic hot springs of Owakudani , and wander through the scenic Hakone Open-Air Museum . Culminate your journey in vibrant Tokyo with visits to the bustling Tsukiji Fish Market , historic Senso-ji Temple in Asakusa , trendy Takeshita Street in Harajuku , and the world-famous Shibuya Crossing . The true highlight awaits in Yudanaka at the incredible Jigokudani Monkey Park , where you\'ll witness adorable snow monkeys luxuriating in their natural hot spring baths. This tour provides a delightful blend of culture, history, and unique winter experiences in Japan.",            "days": [                {                    "day": "1",                    "head": "Arrive in Japan\', \'Check-in Hotel",                    "text": "Kansai Int\'l Airport (KIX) or Osaka Int\'l Airport (ITM) - Itami Airport Arrival Transfer Check in to the hotel   Purchase Optional Travel Insurance Welcome to Japan! We will have transportation services to take you to your hotel. Please refer to your tour app for more information. Rest at the hotel and be ready to start your exciting tour tomorrow. **INFORMATION** From KIX Airport to downtown hotel in Osaka - about 70 mins (Bus) From ITM Airport to downtown hotel in Osaka - about 30 mins (Bus) Hotel Emion Kyoto or similar"                },                {                    "day": "2",                    "head": "Meet\', \'Greet the friendly Deer of Nara",                    "text": "Breakfast Lunch [ Nara Prefecture ] Todaiji Temple   Deer Park   Naramachi   [ Kyoto Prefecture ] Fushimi Inari Shrine   Inari Sushi (JDT Recommends)   KYOTO SAMURAI and NINJA MUSEUM   Ramen (JDT Recommends)   Yatsuhashi (JDT Recommends)   We start our day with a visit to Todaiji Temple in Nara. Todaiji Temple holds the Guinness World Record as the largest wooden building. Inside the temple, you will behold the largest Buddha statue in Japan. Just outside the temple is Nara Deer Park, where you will be greeted by numerous deer that roam around freely. The deer here at the park are known to be friendly and may even bow at you for a little treat. Next, we take a stroll through Naramachi. Naramachi is an area preserving old townscapes, where you can explore traditional shops, historic buildings, and quaint streets that offer a glimpse into Japan\'s past. We then head to Fushimi Inari Shrine in Kyoto, famous for its thousands of vermilion torii gates that form a mesmerizing pathway up the mountain. This iconic site is a must-visit for its stunning beauty and spiritual significance. Afterward, we visit the Samurai\', \'Ninja Museum, where you can learn about the fascinating history and culture of these legendary Japanese warriors. Engage with interactive exhibits and even try on samurai armor or ninja costumes for an immersive experience. Hotel Emion Kyoto or similar Breakfast Lunch"                },                {              "day": "3",                    "head": "Dine with Japan\'s Next Generation of Geisha Artisans",                    "text": "Breakfast Dinner [ Kyoto Prefecture ] Arashiyama   Jin-riki-sha Ride   Golden Pavilion   Ninenzaka   Matcha Experience   Maiko Dining Experience   Check into the hotel   Kyoto Station Light Show (JDT Recommend)   Japanese Hot Springs   Today, our Kyoto tour begins with a visit to Arashiyama. The morning\'s sunlight passing through the bamboo makes for a perfect morning sight. We will also enjoy a spirited rickshaw ride through the bamboo grove. You will be welcomed by the friendly smiles of the Rickshaw drivers who are both entertaining and very knowledgeable. They will also take amazing pictures for you in the Bamboo forest that you will want to show all your friends back home. Following our time in Arashiyama, we will head to the Golden Pavilion, or Kinkakuji Temple, a Japanâ€™s must see attraction where the two upper floors are covered in gold leaf. The reflection of the golden temple on the lake adds to the stunning sight. Next, Next will be the ancient street of Ninenzaka. The street is filled with shops and souvenir stands as well as a great place for photos and to see what Japan looked like many years ago. We will also partake in a hands-on lesson on the tea ceremony. Learn about the history and meaning behind the ceremony as you watch it being performed before your eyes. Try your hand at making a traditional cup of matcha! We then proceed to the hotel. You will also have  the option to see the colorful Kyoto Station light show projected on the grand staircase. Enjoy a once-in-a-lifetime experience with a Maiko. Maiko are apprentice to Geisha. During the dinner, you will able to see her perform Japanese traditional dances, chances to take photos, and ask questions about her life as a Maiko. It is a great opportunity to learn about Kyoto\'s traditional culture. Onyado Nono Kyoto Shichijo or similar Breakfast Dinner"                },                {                    "day": "4",                    "head": "Scenic Views of Japan\'s most Famous Mountain",                    "text": "Breakfast Lunch Bullet Train   [ Hakone ] Owakudani Valley   Hakone Ropeway - Mt. Fuji View   Open-Air Museum   [ Tokyo ] Check in to the hotel   Tokyo Banana (JDT Recommends) Today, we headed to Hakone, a popular weekend getaway destination from Tokyo. Here, you get to see sulfur smoke coming from active volcano vents and, if weather permits, a stunning view of Mt. Fuji. First, we will experience the thrill of riding the Shinkansen (bullet train). The Shinkansen is the fastest way to travel on land and offers a comfortable and efficient journey, providing scenic views along the way. Next, we will take a relaxing ride on the Hakone Ropeway down to Owakudani Valley. The ropeway provides a scenic view of the Hakone area and, if weather permits, Mt. Fuji. We will explore Owakudani, giving you enough time to marvel at the active natural volcanic vents and try the black egg. Boiled in one of the vents, it is said that eating one of these eggs will add 7 years to your life. Following lunch, we will visit the Hakone Open-Air Museum. Enjoy viewing the numerous sculptures and stroll through the beautiful nature and stunning landscape of Hakone. After a full day of exploration and culture, we will head to Tokyo. Enjoy a relaxing evening and reflect on the day\'s adventures. Tobu Hotel Levant Tokyo or similar Breakfast Lunch"                },                {               "day": "5",                    "head": "Tour Tokyo Landmarks including Historic Asakusa",                    "text": "Breakfast Lunch Tsukiji Fish Market   Shibuya Scramble Crossing   Shibuya Hachiko   Experience the Flavors of Japan   [ Asakusa ] Sensoji Temple   teamLab Planets TOKYO   Bullet Train   [ Nagano Prefecture ] Check into the hotel We start off our Tokyo tour with a visit to Tokyo\'s Tsukiji Fish Market, the former home of the world-famous tuna auction. Browse through the freshest flavors, mouth-watering dishes, and incredible sushi meals at this market that serves over thousands of businesses and local families daily before we explore the rest of the sights in Tokyo! The tour will then head to the old town district of Asakusa where you can purchase traditional Japanese souvenirs at the Nakamise area and explore Senso-ji Temple, the oldest and the most popular temples in Tokyo. For lunch, enjoy a Japanese seasonal dining experience. Then we are off to Harajuku to explore the famous Takeshita Street and Omotesando area. The area is filled with cute shops, delicious crepes, high end stores, and beautiful cafÃ©s and restaurants. Don\'t forget to check out the Cat CafÃ© and Headgehog cafÃ© for those who love animals. We will then make our way to the famous Shibuya Crosswalk to be part of the thousands who cross daily. This crosswalk gathers as much foot traffic as New York City, and crossing is an experience unlike any other. HOTEL METROPOLITAN NAGANO or similar Breakfast Lunch"                },                {                    "day": "6",                    "head": "Snow Monkeys in Sight",                    "text": "Breakfast [ Nagano Prefecture ] Yudanaka   Jigokudani Wild Monkey Park - Visit   Snow Monkey [ Tokyo ] Return to the Hotel Today is the day you\'ve been waiting for during your Winter Japan Tour! It\'s off to the remarkable Jigokudani Monkey Park in Yudanaka. Home to the popular snow monkeys, Jigokudani is best place to go in all Japan to see cute, furry snow monkey bathing in the natural Japanese hot-springs. Unlike other breeds of monkey, the snow monkey are capable of handling much colder temperatures, and are only found in Japan thanks to the abundance of natural Japanese hot-springs. Although some monkey prefer to stay in the mountains, tourists flock to Jigokudani to see snow monkey bathing special designated hot springs meant just for them. Some of the snow monkeys may have a little mound of snow on top of their heads, but they never seem to mind as long as they can unwind in the hot-springs. Yudanaka is also a popular hot-springs resort, offering a traditional atmosphere in the mountains of Japan. Admire the stunning scenery of the Japanese mountains while traveling to see adorable snow monkeys. Stop by for a relaxing free foot-bath during your vacation or pause to pick up some traditional Japanese souvenirs or snacks while touring this charming mountain town. After following your tour guide through Yudanaka, we will then return to the hotel. Tobu Hotel Levant Tokyo or similar Breakfast"                },                {                    "day": "7",                    "head": "Tour Disbands\', \'Depart from Japan",                    "text": "Breakfast Departure Transfer   Narita Int\'l Airport (NRT) or Haneda Int\'l Airport (HND) *Designated Airport(s) Your pleasant and memorable Japan tour ends today. The tour will disband after breakfast. Fly home with cherished memories or enjoy your extended stay in Japan. **INFORMATION** From downtown hotel in Tokyo to Narita Airport - about 90 mins(Bus) From downtown hotel in Tokyo to Haneda Airport - about 30 mins(Bus) Breakfast"                },]"}'
            ,'{"Title": "Highlights of Japan", "Itinerary": ""description": "Uncover the essence of Japan in just 7 days! This meticulously crafted tour showcases iconic landmarks and unique cultural encounters. Begin in Tokyo, exploring the vibrant Tsukiji Fish Market , the historic Asakusa district. Immerse yourself in the captivating world of TeamLab and witness the electrifying energy of Shibuya Crossing . Ascend the Hakone Ropeway for breathtaking vistas of Mt. Fuji and the geothermal wonders of Owakudani . Travel by bullet train to Kyoto, where you\'ll explore the serene Arashiyama Bamboo Grove , the shimmering Golden Pavilion (Kinkaku-ji) , and the enchanting atmosphere of Ninenzaka . Participate in a traditional tea ceremony , indulge in the flavors of Kyoto cuisine with a special Maiko Dinner , and visit the vibrant red torii gates of Fushimi Inari Shrine . Continue to Nara, where you\'ll encounter gentle deer in Nara Park and marvel at the colossal Buddha statue in Todai-ji Temple .",            "days": [                {                    "day": "1",                    "head": "Arrive in Japan\', \'Check-in Hotel",                    "text": "Narita Int\'l Airport (NRT) or Haneda Int\'l Airport (HND)   Arrival Transfer   Purchase Optional Travel Insurance Welcome to Japan! Japan Deluxe Tours has arranged transportation services to meet you at your airport\'s arrival lobby and will take you to your hotel. Rest at the hotel and be ready to start your exciting tour tomorrow. **INFORMATION** From Narita Airport to downtown hotel in Tokyo - about 90 mins(Bus) From Haneda Airport to downtown hotel in Tokyo - about 30 mins(Bus) Tobu Hotel Levant Tokyo or similar"                },                {                    "day": "2",                    "head": "Enjoy the day free at your Leisure",                    "text": "Breakfast Free at your own leisure   Tokyo Disneyland\', \'DisneySea (Optional Tour - $150)   Sanrio Puroland (JDT Recommends)   Shin Yokohama Ramen Museum (JDT Recommends) We have cleared up the day for you to explore and enjoy Japan as you wish. During this time, you can also: Spend the day at Tokyo Disneyland or DisneySea Visit the Ramen Museum Explore Warner Bros. Studio Tour Tokyo - THE MAKING OF Harry Potter Tobu Hotel Levant Tokyo or similar Breakfast"                },                {                    "day": "3",                    "head": "Strolling Through Historic Asakusa",                    "text": "Breakfast Lunch Tsukiji Fish Market   Shibuya Scramble Crossing   Shibuya Hachiko   Experience the Flavors of Japan   [ Asakusa ] Sensoji Temple   teamLab Planets TOKYO   Convenience Store (JDT Recommends)   Return to the hotel   Tokyo Banana (JDT Recommends) Kick off your unforgettable Tokyo sightseeing tour with a flavorful journey through the lively Tsukiji Fish Market , the historic seafood market once home to the world-famous tuna auctions. Here, you\'ll discover a rich selection of fresh Japanese seafood , seasonal ingredients, and traditional street food stalls. From expertly crafted sushi to sizzling grilled seafood skewers, this is the perfect place to taste the true flavors of Tokyo . Next, head to one of Japanâ€™s most iconic spots â€” the Shibuya Scramble Crossing . Join thousands of pedestrians in crossing what is often called the busiest intersection in the world , capturing unforgettable moments from multiple angles. Just steps away is the beloved Hachiko Statue , honoring the loyal dog whose story continues to touch hearts across generations. This area is a must-see for fans of modern Japanese culture and dynamic city life. For lunch, enjoy a seasonal Japanese dining experience curated by our expert team. Based on the time of year, your meal will highlight regional delicacies and trending dishes that showcase the creativity and tradition of Japanese cuisine . Whether it\'s grilled fish in winter or bamboo shoots in spring, each course brings you closer to Japanâ€™s culinary soul. We then step into the heart of traditional Tokyo with a visit to Asakusa , home to the city\'s oldest Buddhist temple â€” Senso-ji Temple . Stroll along the vibrant Nakamise shopping street , where you can shop for Japanese souvenirs and enjoy snacks like ningyo-yaki or matcha treats. With its rich spiritual heritage and picturesque architecture, Senso-ji offers an unforgettable glimpse into historic Tokyo . Conclude your day at the dazzling teamLab Planets TOKYO , an immersive digital art museum that seamlessly blends technology, light, water, and nature . Walk barefoot through interactive exhibits that respond to your movements, offering a one-of-a-kind multi-sensory experience . It\'s the perfect fusion of Japanese innovation and contemporary art, and a stunning finale to your Tokyo adventure. Tobu Hotel Levant Tokyo or similar Breakfast Lunch"                },                {                    "day": "4",                    "head": "Immerse in Traditional Japanese Culture",                    "text": "Breakfast Lunch [ Hakone ] Open-Air Museum   Owakudani Valley   Hakone Ropeway - Mt. Fuji View   Bullet Train   Check into the hotel   Japanese Hot Springs   Start your day with a scenic ride on the Hakone Ropeway , one of the best ways to take in the breathtaking views of Mount Fuji , lush valleys, and the unique volcanic landscape of Hakone . On a clear day, the aerial cable car offers a spectacular panoramic experience as you soar above active geothermal terrain. Arriving at the dramatic Owakudani Valley , you\'ll explore a rugged landscape formed by volcanic eruptions over 3,000 years ago. Here, volcanic steam vents and sulfur springs offer a glimpse into Hakoneâ€™s dynamic natural forces. Donâ€™t miss the famous Kuro Tamago (black eggs) â€” boiled in the hot springs and said to add seven years to your life for each egg you eat! Next, enjoy a cultural and artistic highlight at the Hakone Open-Air Museum , Japanâ€™s first outdoor sculpture museum . Stroll through its vast garden filled with modern and contemporary art by masters like Picasso , set against the ever-changing backdrop of Hakoneâ€™s mountains. The seamless blend of nature and art makes this museum a one-of-a-kind destination. After a day of nature and creativity, board the Shinkansen bullet train for a comfortable and efficient transfer to Kyoto . This high-speed journey is not only fast but also a quintessential part of the Japanese travel experience , allowing you to enjoy scenic views of the countryside as you glide toward Japanâ€™s cultural capital. *Please note: The itinerary may be adjusted depending on weather and operational conditions to ensure a safe and enjoyable experience. Onyado Nono Kyoto Shichijo or similar Breakfast Lunch"                },                {                    "day": "5",                    "head": "Breathtaking Maiko Show\', \'Bamboo Forest",                    "text": "Breakfast Dinner Arashiyama   Jinrikisha Ride Experience   Golden Pavilion   KYOTO SAMURAI and NINJA MUSEUM   Maiko Dining Experience   Return to the hotel   Yatsuhashi (JDT Recommends)   Kyoto Station Light Show (JDT Recommend)   Start your unforgettable day in Kyoto with a guided visit to the scenic Arashiyama district, a favorite destination among both locals and international visitors. Stroll through the enchanting Arashiyama Bamboo Grove , where sunlight filters through towering green stalks â€” a magical setting that perfectly captures the beauty of traditional Japan. Continue your exploration with a fun and memorable rickshaw ride through Arashiyama . As youâ€™re pulled along quiet lanes and riverside paths, enjoy views of historic temples , quaint bridges, and Kyoto\'s natural charm, all while learning about the area from your friendly guide. Next, the tour heads to Kinkaku-ji , or the Golden Pavilion , one of Kyotoâ€™s most iconic landmarks. This stunning UNESCO World Heritage Site is renowned for its brilliant gold-covered exterior, reflected beautifully on the mirror-like pond that surrounds it. Itâ€™s a must-see highlight of any Kyoto tour. After lunch, immerse yourself in history at the Kyoto Samurai\', \'Ninja Museum . Perfect for all ages, this interactive museum lets you learn about Japanâ€™s legendary warriors. Enjoy hands-on experiences like wearing armor or handling replica swords as you gain insight into samurai culture and ninja traditions. Conclude your day with a cultural highlight â€” a Maiko Dining experience . Enjoy a traditional Kyoto-style meal while watching a performance by a Maiko, an apprentice Geisha. Her elegant dance and gracious presence offer a unique opportunity to experience Kyotoâ€™s living heritage in an authentic and memorable setting. Hotel Emion Kyoto or similar Breakfast Dinner"                },                {                    "day": "6",                "head": "Meet\', \'Greet the friendly Deer of Nara",                    "text": "Breakfast Lunch [ Kyoto Prefecture ] Ninenzaka   [ Nara Prefecture ] Todaiji Temple   Deer Park   Matcha Experience   Byodoin Temple   Fushimi Inari Shrine   Inari Sushi (JDT Recommends)   Return to the hotel   Ramen (JDT Recommends)   Begin your day with a scenic stroll along Ninenzaka , one of Kyotoâ€™s most charming historical streets . Lined with preserved traditional machiya townhouses , this stone-paved slope offers a nostalgic glimpse into old Kyoto and is the perfect backdrop for photos and souvenir shopping. From there, travel to Nara to explore the world-famous Todai-ji Temple , a UNESCO World Heritage Site. Marvel at the templeâ€™s massive wooden structure and its breathtaking Great Buddha statue â€” one of the largest bronze Buddha statues in Japan. Just outside, enjoy time at Nara Deer Park , where over a thousand free-roaming deer â€” considered sacred messengers of the gods â€” create a delightful and uniquely Japanese experience. Many will even bow for treats! Next, return to Kyoto for a soothing break with a traditional matcha tasting experience . Enjoy the rich, earthy flavors of finely whisked Japanese green tea in a serene setting, perfect for a moment of cultural reflection and relaxation. Continue your journey with a visit to the elegant Byodo-in Temple in Uji. This stunning UNESCO World Heritage Site is renowned for its Phoenix Hall , which appears on Japanâ€™s 10-yen coin. Surrounded by tranquil gardens and mirror-like ponds, the temple offers a serene example of Heian-era architecture and spiritual beauty. Conclude your day at Fushimi Inari Taisha Shrine , one of Kyotoâ€™s most iconic landmarks. Walk beneath the thousands of vermilion torii gates that wind their way up the mountainside â€” a mesmerizing and symbolic path that represents prosperity and good fortune. It\'s one of Japanâ€™s most photogenic and spiritually powerful sites. Hotel Emion Kyoto or similar Breakfast Lunch"                },                {                    "day": "7",                    "head": "Tour Disbands\', \'Depart from Japan",                    "text": "Breakfast Departure Transfer   Kansai Int\'l Airport (KIX) or Osaka Int\'l Airport (ITM) - Itami Airport Your pleasant and memorable Japan tour ends today. The tour will disband after breakfast. Fly home with cherished memories or enjoy your extended stay in Japan. **INFORMATION** From downtown hotel in Osaka to KIX Airport - about 70 mins (Bus) From downtown hotel in Osaka to ITM Airport - about 30 mins (Bus) Breakfast"                },]"}'
]
start_date = "02/03/2025"
end_date = "08/03/2025"
t_output = """
    {
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
}
"""

t_input = f"""
    Generate a detailed travel itinerary in JSON format. 
            
    The itinerary must include:  
        - **Multiple days** with specific dates (`YYYY-MM-DD`).  
        - **Day labels** (e.g., `"Day 1"`, `"Day 2"`).  
        - **A schedule** for each day, containing: 
        - **Time slots** (`HH:mm`, 24-hour format).  
        - **Activities** for each time slot.
        - **Latitude and longitude** coordinates for each activity (e.g., `"lat": 35.6895`, `"lng": 139.6917`).
        - **lat** and **lng** are the coordinates of the activity location, which can be found on Google Maps or similar services.
        - *** **lat** and **lng** can be empty if the activity is not location-specific (e.g., "Shopping" or "Dining" or "Hotel"). ***
        
        - **Comments** or additional notes about the itinerary **example about the season for example, is that month suitable for that kind of weather? Like going to see cherry blossoms in a month when they're not blooming. ** here is season data {season_data}.


    Ensure the response **ONLY** contains valid JSON without any explanations or additional text. Use the following context: {context}.
    **** Verify that the itinerary aligns with the travel period ({start_date}–{end_date}) and includes manageable distances and travel times between locations ****
    
    *** NO double quotes at the start and end of the JSON response. ***
    *** The trip starts on **{start_date}** 'DD-MM-YYYY' and ends on **{end_date}** 'DD-MM-YYYY'. ***
    json_structure: {json_structure}
    make the itinerary in English language.
"""

t_rcontext = context

test_case = LLMTestCase(
    input = t_input,
    actual_output = t_output,
    retrieval_context = t_rcontext
)

AnsRelevancyMetric = AnswerRelevancyMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

FaithfulMetric = FaithfulnessMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

ContextRelevancyMetric = ContextualRelevancyMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

BiasMetric = BiasMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

ToxicityMetric = ToxicityMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

NonAdviceMetric = NonAdviceMetric(
    advice_types=["financial", "medical", "legal"],
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

# MisuseMetric = MisuseMetric(
#     domain="itinerary",
#     threshold=0.7,
#     model="gpt-4.1-mini",
#     include_reason=True
# )

PIILeakageMetric = PIILeakageMetric(
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

RoleViolationMetric = RoleViolationMetric(
    role="travel agent",
    threshold=0.7,
    model="gpt-4.1-mini",
    include_reason=True
)

evaluate(test_cases=[test_case], metrics=[
    AnsRelevancyMetric,
    FaithfulMetric,
    ContextRelevancyMetric,
    BiasMetric,
    ToxicityMetric,
    NonAdviceMetric,
    # MisuseMetric,
    PIILeakageMetric,
    RoleViolationMetric
])

# deepeval test run test_deepeval.py
