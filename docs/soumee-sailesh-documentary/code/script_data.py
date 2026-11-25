"""Master script: Hindi narration + English captions, sentence by sentence.

Each narration section is generated separately in ElevenLabs (voice: DN News).
Interview bites are her own Bengali words, translated to English captions
(translation by the production; to be checked by a Bengali-speaking editor).
"""

# ---- Narration: full documentary ------------------------------------------
FULL = {
 "F01": [("त्रिपुरा के एक छोटे-से इलाक़े से बॉलीवुड के बड़े पर्दे तक।", "From a small locality in Tripura to the big screen of Bollywood."),
         ("सलमान ख़ान की फ़िल्म 'मातृभूमि' में अब त्रिपुरा की बेटी सौमी शैलेश की आवाज़ सुनाई दे रही है।", "Tripura's Soumee Sailesh can now be heard in Salman Khan's film Maatrubhumi.")],
 "F02": [("गीत का नाम है 'मदिरापन'।", "The song is called Madirapan."),
         ("यह कहानी है खोवाई ज़िले के चेबरी की उस लड़की की, जो संगीत का सपना लेकर लगभग दो हज़ार किलोमीटर दूर मुंबई पहुँची।", "This is the story of a young woman from Chebri, Khowai, who took her dream of music to Mumbai, about 2,000 km away.")],
 "F03": [("सौमी शैलेश को संहिता देबनाथ के नाम से भी जाना जाता है।", "Soumee Sailesh is also known as Sanhita Debnath."),
         ("उनका जन्म त्रिपुरा में हुआ और बचपन खोवाई ज़िले के चेबरी में बीता।", "She was born in Tripura and grew up in Chebri, in Khowai district."),
         ("चेबरी, खोवाई शहर से कुछ किलोमीटर दूर बसा एक इलाक़ा है।", "Chebri lies a few kilometres from Khowai town.")],
 "F04": [("संगीत से उनका रिश्ता बचपन में ही जुड़ गया था।", "Her bond with music began in childhood."),
         ("संगीत की पहली सीख उन्हें अपनी माँ से मिली।", "Her first lessons in music came from her mother.")],
 "F04b": [("खोवाई ज़िला दो हज़ार बारह में पश्चिम त्रिपुरा से अलग होकर बना था।", "Khowai district was carved out of West Tripura in 2012."),
          ("इसकी उत्तरी सीमा बांग्लादेश से लगती है।", "Its northern edge is the international border with Bangladesh.")],
 "F05": [("इसके बाद उन्होंने शास्त्रीय संगीत के साथ-साथ संगीत की दूसरी विधाओं का भी प्रशिक्षण लिया।", "She then trained in classical music as well as other musical forms."),
         ("आगे चलकर उन्होंने एस. डी. बर्मन कॉलेज से बैचलर ऑफ़ म्यूज़िक की डिग्री हासिल की।", "She later earned a Bachelor of Music degree from S.D. Barman College.")],
 "F06": [("हिंदी फ़िल्म संगीत से त्रिपुरा का रिश्ता पुराना है।", "Tripura's link with Hindi film music goes back a long way."),
         ("महान संगीतकार सचिन देव बर्मन त्रिपुरा के राजपरिवार से थे।", "The celebrated composer Sachin Dev Burman belonged to Tripura's royal family."),
         ("उसी धरती से निकली सौमी ने भी संगीत को ही अपना रास्ता चुना।", "Soumee, from the same land, also chose music as her path.")],
 "F06b": [("उनके बेटे राहुल देव बर्मन ने भी आगे चलकर हिंदी फ़िल्म संगीत में बड़ा नाम कमाया।", "His son, Rahul Dev Burman, also went on to become a major name in Hindi film music.")],
 "F07": [("साल दो हज़ार सत्रह में सौमी पेशेवर गायन में करियर बनाने के लिए मुंबई चली गईं।", "In 2017, Soumee moved to Mumbai to build a career as a professional singer."),
         ("चेबरी से मुंबई की सीधी दूरी लगभग दो हज़ार किलोमीटर है।", "The straight-line distance from Chebri to Mumbai is about 2,000 km.")],
 "F08": [("मुंबई का संगीत उद्योग बड़ा है, लेकिन यहाँ मुक़ाबला भी उतना ही कड़ा है।", "Mumbai's music industry is big, and the competition is just as tough."),
         ("देश भर से बड़ी संख्या में कलाकार यहाँ अपनी जगह बनाने आते हैं।", "Large numbers of artists from across India come here to find a place."),
         ("इन चुनौतियों के बीच सौमी ने लगातार काम किया।", "Amid these challenges, Soumee kept working."),
         ("उन्होंने टेलीविज़न धारावाहिकों, म्यूज़िक एल्बमों, फ़िल्मों, विज्ञापनों और लाइव कार्यक्रमों में काम किया।", "She worked on television series, music albums, films, advertisements and live shows.")],
 "F09": [("और फिर उन्हें एक बड़ा अवसर मिला।", "Then came a major opportunity."),
         ("सलमान ख़ान अभिनीत फ़िल्म 'मातृभूमि' के गीत 'मदिरापन' में सौमी शैलेश ने प्लेबैक सिंगिंग की है।", "Soumee Sailesh has sung playback on Madirapan, a song from the Salman Khan-starrer Maatrubhumi.")],
 "F09b": [("हिंदी फ़िल्मों में गीत प्लेबैक सिंगर रिकॉर्ड करते हैं, और पर्दे पर कलाकार उन पर अभिनय करते हैं।", "In Hindi films, playback singers record the songs, and actors perform them on screen."),
          ("इसलिए गीत के दृश्यों में सौमी नहीं, बल्कि फ़िल्म के कलाकार दिखाई देते हैं।", "So the song's visuals show the film's actors, not Soumee.")],
 "F10": [("इस गीत का संगीत हिमेश रेशमिया ने दिया है और बोल समीर अनजान ने लिखे हैं।", "The song's music is by Himesh Reshammiya, and the lyrics are by Sameer Anjaan."),
         ("गीत के आधिकारिक वीडियो में गायकों के रूप में जावेद अली, मोहम्मद दानिश और सौमी शैलेश के नाम दिए गए हैं।", "The official video credits Javed Ali, Mohd Danish and Soumee Sailesh as its singers.")],
 "F11": [("किसी बड़े बैनर की फ़िल्म में गाने का मौक़ा किसी भी उभरते गायक के लिए अहम माना जाता है।", "A chance to sing in a major banner's film is seen as important for any emerging singer."),
         ("सौमी के लिए भी यह उनके संगीत सफ़र का एक अहम पड़ाव है।", "For Soumee, it is an important milestone in her musical journey.")],
 "F12": [("आगे की राह को लेकर सौमी के सपने बड़े हैं।", "Soumee has big dreams for the road ahead."),
         ("वह एक स्थापित प्लेबैक सिंगर के रूप में अपनी पहचान बनाना चाहती हैं।", "She wants to establish herself as a recognised playback singer."),
         ("वह रोमांटिक, रूहानी, भावनात्मक, रॉक और समकालीन संगीत में भी अपनी आवाज़ आज़माना चाहती हैं।", "She wants to try her voice in romantic, soulful, emotional, rock and contemporary music.")],
 "F13": [("उनका एक बड़ा सपना है, संगीतकार ए. आर. रहमान के साथ काम करना।", "One of her big dreams is to work with composer A.R. Rahman."),
         ("और अगले पाँच वर्षों में वह संगीत की दुनिया में अपनी एक अलग पहचान बनाना चाहती हैं।", "Within the next five years, she wants to build a distinct identity in music.")],
 "F14": [("संगीत की राह चुनने वाले युवाओं के लिए उनका संदेश साफ़ है।", "Her message to young people choosing music is clear."),
         ("अपने सपनों पर भरोसा रखें, लगातार अभ्यास करें और धैर्य रखें।", "Believe in your dreams, practise consistently and be patient."),
         ("अस्वीकार या असफलता से डरें नहीं।", "Do not be afraid of rejection or failure.")],
 "F15": [("मुंबई में रहते हुए भी सौमी का अपनी जन्मभूमि त्रिपुरा से गहरा भावनात्मक रिश्ता है।", "Though she lives in Mumbai, Soumee has a deep emotional bond with Tripura, where she was born.")],
 "F16": [("त्रिपुरा के एक छोटे-से इलाक़े से शुरू हुआ संगीत का यह सफ़र आज बॉलीवुड की एक फ़िल्म के संगीत तक पहुँच गया है।", "A musical journey that began in a small locality of Tripura has now reached the music of a Bollywood film."),
         ("चेबरी से बॉलीवुड तक, सौमी शैलेश का सफ़र अभी जारी है।", "From Chebri to Bollywood, Soumee Sailesh's journey continues.")],
}

# ---- Narration: short horizontal -------------------------------------------
SHORT = {
 "H01": [("त्रिपुरा से बॉलीवुड तक!", "From Tripura to Bollywood."),
         ("सलमान ख़ान की फ़िल्म 'मातृभूमि' में त्रिपुरा की सौमी शैलेश को प्लेबैक सिंगिंग का मौक़ा मिला है।", "Tripura's Soumee Sailesh has sung playback in Salman Khan's film Maatrubhumi.")],
 "H02": [("खोवाई ज़िले के चेबरी की सौमी को संहिता देबनाथ के नाम से भी जाना जाता है।", "Soumee, from Chebri in Khowai district, is also known as Sanhita Debnath."),
         ("माँ से संगीत की पहली सीख लेने वाली सौमी, दो हज़ार सत्रह में अपना सपना लेकर मुंबई पहुँचीं।", "She learnt music first from her mother, and moved to Mumbai in 2017 to follow her dream.")],
 "H03": [("अब उन्होंने फ़िल्म के गीत 'मदिरापन' में अपनी आवाज़ दी है।", "She has now sung on the film's song, Madirapan."),
         ("संगीत हिमेश रेशमिया का है और बोल समीर अनजान के।", "The music is by Himesh Reshammiya and the lyrics by Sameer Anjaan."),
         ("जावेद अली और मोहम्मद दानिश भी इस गीत के गायक हैं।", "Javed Ali and Mohd Danish are also among the song's singers.")],
 "H04": [("सौमी का सपना है एक स्थापित प्लेबैक सिंगर बनना और ए. आर. रहमान के साथ काम करना।", "Soumee dreams of becoming an established playback singer and working with A.R. Rahman."),
         ("चेबरी से बॉलीवुड तक, उनका सफ़र अभी जारी है।", "From Chebri to Bollywood, her journey continues.")],
}

# ---- Interview bites (seconds in INTERVIEW/interview_selfie_vertical.mov) ---
# Bengali transcript is machine-assisted (Whisper large-v3, cleaned by hand);
# please have a Bengali speaker confirm it against the recording.
BITES = {
 "B1": (0.30, 5.95, "নমস্কার, আমি সৌমী শৈলেশ। আমি ত্রিপুরার খোয়াইয়ের মেয়ে। ত্রিপুরার মাটিতেই আমার জন্ম আর বেড়ে ওঠা।",
        [(0.30, 1.83, "Namaskar, I am Soumee Sailesh."), (1.83, 3.60, "I am a girl from Khowai, Tripura."), (3.60, 5.95, "I was born and raised on Tripura's soil.")]),
 "B2": (6.35, 13.45, "ছোটবেলা থেকেই গান ছিল আমার ড্রিম আর প্যাশন, আর নিজের মনোভাব, ইমোশন প্রকাশ করার একটা সুন্দর মাধ্যম।",
        [(6.35, 9.42, "Since childhood, music has been my dream and my passion,"), (9.42, 13.45, "and a beautiful way to express my feelings and emotions.")]),
 "B3": (13.55, 21.35, "সেই ড্রিমকে নিয়ে একদিন চলে গেলাম মুম্বইতে। জার্নিটা খুব ইজি ছিল না, কিন্তু নিজের ড্রিম আর মিউজিকের প্রতি বিশ্বাস কখনও হারাইনি।",
        [(13.55, 17.49, "One day, I left for Mumbai with that dream. The journey was not easy,"), (17.49, 21.35, "but I never lost faith in my dream and in music.")]),
 "B4": (21.60, 36.00, "আজ আমার কণ্ঠে বলিউডের মেগাস্টার সলমন খান স্যারের ফিল্ম মাতৃভূমি, ওই ফিল্মে আমার গান মদিরাপন রিলিজ হয়েছে। এটা আমার জন্য একটা অনেক স্পেশাল মোমেন্ট। এই গানের কম্পোজার হিমেশ রেশমিয়া স্যার এবং লিরিসিস্ট সমীর অনজান স্যার।",
        [(21.60, 26.05, "Today, my song in Bollywood megastar Salman Khan sir's film Maatrubhumi,"), (26.05, 29.47, "Madirapan, sung in my voice, has been released."),
         (29.47, 32.31, "This is a very special moment for me."), (32.31, 36.00, "The composer is Himesh Reshammiya sir; the lyricist, Sameer Anjaan sir.")]),
 "B5": (36.00, 46.20, "ত্রিপুরা থেকে মুম্বই আসা আর সেখান থেকে বলিউডের জার্নি, এটা আমার জন্য জাস্ট একটা অ্যাচিভমেন্ট নয়। এটা আমার বহু বছরের ড্রিম, হার্ডওয়ার্ক আর পেশেন্সের একটা রেজাল্ট।",
        [(36.00, 39.92, "Coming from Tripura to Mumbai, and from there the journey to Bollywood,"), (39.92, 42.00, "is not just an achievement for me."),
         (42.00, 46.20, "It is the result of many years of dreams, hard work and patience.")]),
 "B6": (46.40, 53.00, "যারা সবসময় আমার পাশে থেকেছেন, আমাকে সাপোর্ট করেছেন, আমার গানকে ভালোবেসেছেন, তাদের কাছে আমি অনেক কৃতজ্ঞ।",
        [(46.40, 49.40, "To everyone who has always stood by me and supported me,"), (49.40, 53.00, "and loved my songs, I am very grateful.")]),
 "B7": (53.10, 59.00, "এটা শুধু একটা বিগিনিং, আমার ড্রিম অনেক বড়। আর মিউজিকের সাথে জার্নি আরও অনেকটা বাকি।",
        [(53.10, 56.00, "This is only the beginning. My dreams are big."), (56.00, 59.00, "And my journey with music still has a long way to go.")]),
 "B8": (59.00, 64.95, "আশা করি আগামী দিনেও আমার এই জার্নিতে আপনারা সবসময় আমার পাশে থাকবেন। থ্যাঙ্ক ইউ।",
        [(59.00, 62.00, "I hope that in the days ahead, too,"), (62.00, 64.95, "you will always stand by me on this journey. Thank you.")]),
}
