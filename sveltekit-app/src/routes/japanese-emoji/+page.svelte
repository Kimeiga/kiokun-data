<script lang="ts">
	import Header from '$lib/components/Header.svelte';

	// Kanji/semantic emoji - these have meaning from Japanese characters (most interesting for learners)
	const kanjiEmoji = [
		{ emoji: '🈁', kanji: 'ココ', reading: 'koko', meaning: 'Here', description: 'Katakana for "here" (ここ). You\'ll see this on Japanese maps and shopping mall directories with a pointing finger showing "You are here" (現在地).', usage: 'Maps, location markers, directories', emojipedia: 'japanese-here-button', xSearch: '🈁', imageSearch: '現在地 地図 日本' },
		{ emoji: '🈂️', kanji: 'サ', reading: 'sa', meaning: 'Service', description: 'Short for サービス (sābisu). In Japanese restaurants, this means "on the house" - a free extra like a drink or side dish. Different from Western "service charge"!', usage: 'Restaurants, shops offering free extras', emojipedia: 'japanese-service-charge-button', xSearch: '🈂 サービス', imageSearch: 'サービス 無料 日本' },
		{ emoji: '🈷️', kanji: '月', reading: 'tsuki/getsu', meaning: 'Monthly', description: 'Indicates monthly fees or subscriptions (月額 gekkai). You\'ll see this on streaming services, gym memberships, and phone plans showing the price per month.', usage: 'Subscriptions, monthly payments, plans', emojipedia: 'japanese-monthly-amount-button', xSearch: '🈷 月額', dictLink: '月', imageSearch: '月額 料金' },
		{ emoji: '🈶', kanji: '有', reading: 'yū/aru', meaning: 'Available/Fee', description: 'Means something is available or requires payment (有料 yūryō = fee required). The opposite of 🈚. Common on parking signs, Wi-Fi notices, and facility usage.', usage: '"Wi-Fi available", "Paid parking"', emojipedia: 'japanese-not-free-of-charge-button', xSearch: '🈶 有料', dictLink: '有', imageSearch: '有料 駐車場 看板' },
		{ emoji: '🈯', kanji: '指', reading: 'shi/yubi', meaning: 'Reserved', description: 'From 指定席 (shiteiseki = reserved seat). On Japanese trains like the Shinkansen, you\'ll see this distinguishing reserved cars from 自由席 (free seating) cars.', usage: 'Train reservations, theater seats', emojipedia: 'japanese-reserved-button', xSearch: '🈯 指定席', dictLink: '指', imageSearch: '指定席 新幹線' },
		{ emoji: '🉐', kanji: '得', reading: 'toku', meaning: 'Bargain', description: 'Means "profit" or "good deal" - you\'ll see this on sale posters and advertisements indicating a special bargain. Often used with お得 (otoku = great deal).', usage: 'Sales ads, special deals, promotions', emojipedia: 'japanese-bargain-button', xSearch: '🉐 セール', dictLink: '得', imageSearch: 'お得 セール 看板' },
		{ emoji: '🈹', kanji: '割', reading: 'wari', meaning: 'Discount', description: 'From 割引 (waribiki = discount). In Japanese supermarkets, staff place red-and-yellow stickers with this kanji on items nearing expiration: "2割引" means 20% off, "半額" means half price!', usage: 'Supermarket stickers, sale signs', emojipedia: 'japanese-discount-button', xSearch: '🈹 割引', dictLink: '割', imageSearch: '割引 シール スーパー' },
		{ emoji: '🈚', kanji: '無', reading: 'mu/nashi', meaning: 'Free/None', description: 'Indicates "free of charge" (無料 muryō) or "none available". The opposite of 🈶. You\'ll see this on free Wi-Fi signs, free parking, and "no additives" food labels.', usage: 'Free Wi-Fi, free parking, "no charge"', emojipedia: 'japanese-free-of-charge-button', xSearch: '🈚 無料', dictLink: '無', imageSearch: '無料 Wi-Fi 看板' },
		{ emoji: '🈲', kanji: '禁', reading: 'kin', meaning: 'Prohibited', description: 'From 禁止 (kinshi = forbidden). Appears on "No Smoking" (禁煙) signs, "No Photography" signs, and other prohibition notices throughout Japan.', usage: 'No smoking, no entry, prohibition signs', emojipedia: 'japanese-prohibited-button', xSearch: '🈲 禁止', dictLink: '禁', imageSearch: '禁煙 禁止 看板' },
		{ emoji: '🉑', kanji: '可', reading: 'ka', meaning: 'Acceptable', description: 'Indicates permission or possibility. Common in approval stamps, "pets allowed" signs, and credit card acceptance notices (カード可 = cards accepted).', usage: 'Approval stamps, "allowed" signs', emojipedia: 'japanese-acceptable-button', xSearch: '🉑', dictLink: '可', imageSearch: 'カード可 ペット可 看板' },
		{ emoji: '🈸', kanji: '申', reading: 'shin/mōsu', meaning: 'Apply', description: 'From 申し込む (mōshikomu = to apply). Used on application forms, registration buttons, and sign-up pages. Also the zodiac sign for Monkey!', usage: 'Application forms, registration, sign-ups', emojipedia: 'japanese-application-button', xSearch: '🈸 申込', dictLink: '申', imageSearch: '申込 申請 フォーム' },
		{ emoji: '🈴', kanji: '合', reading: 'gō/ai', meaning: 'Pass', description: 'From 合格 (gōkaku = pass an exam). This is the kanji every Japanese student hopes to see on their test results! Used for exam results, certifications, and quality approvals.', usage: 'Exam results, certifications, approvals', emojipedia: 'japanese-passing-grade-button', xSearch: '🈴 合格', dictLink: '合', imageSearch: '合格 スタンプ 試験' },
		{ emoji: '🈳', kanji: '空', reading: 'kū/kara/sora', meaning: 'Vacant', description: 'Indicates vacancy or availability. In parking lots, LED signs show 空 when spaces are available. Hotels display 空室あり (vacancy). Also means "sky" or Buddhist "emptiness".', usage: 'Hotel vacancy, parking available', emojipedia: 'japanese-vacancy-button', xSearch: '🈳 空室', dictLink: '空', imageSearch: '空車 満車 駐車場 看板' },
		{ emoji: '㊗️', kanji: '祝', reading: 'shuku/iwau', meaning: 'Congratulations', description: 'From 祝う (iwau = to celebrate). This circled character appears on gift envelopes (祝儀袋), greeting cards, and celebratory banners for weddings, graduations, and New Year.', usage: 'Gift envelopes, celebration cards', emojipedia: 'japanese-congratulations-button', xSearch: '㊗ おめでとう', dictLink: '祝', imageSearch: '祝儀袋 ご祝儀' },
		{ emoji: '㊙️', kanji: '秘', reading: 'hi', meaning: 'Secret', description: 'From 秘密 (himitsu = secret). マル秘 (maru-hi = circled secret) is the official "confidential" stamp used on Japanese business documents - like "classified" in English!', usage: 'Confidential stamps, playful secrets', emojipedia: 'japanese-secret-button', xSearch: '㊙ 秘密', dictLink: '秘', imageSearch: 'マル秘 スタンプ 機密' },
		{ emoji: '🈺', kanji: '営', reading: 'ei', meaning: 'Open', description: 'From 営業中 (eigyōchū = open for business). You\'ll see this lit up in red on shop signs indicating they\'re currently open. The opposite is 準備中 (preparing/closed).', usage: 'Shop signs, business hours', emojipedia: 'japanese-open-for-business-button', xSearch: '🈺 営業中', dictLink: '営', imageSearch: '営業中 看板 店舗' },
		{ emoji: '🈵', kanji: '満', reading: 'man', meaning: 'Full', description: 'Indicates something is full or sold out. Parking lots show 満車 on LED signs when no spaces remain. Hotels display 満室 (no vacancy). Event venues show 満席 (sold out).', usage: 'Parking full, sold out, fully booked', emojipedia: 'japanese-no-vacancy-button', xSearch: '🈵 満席', dictLink: '満', imageSearch: '満車 満室 看板' },
	];

	// Cultural/pictorial emoji - Japanese items, festivals, food, etc.
	const culturalEmoji = [
		{ emoji: '🗾', name: 'Map of Japan', description: 'The only country with its own map emoji! Shows all four main islands: Hokkaido, Honshu, Shikoku, and Kyushu. Japan is called 日本 (Nihon/Nippon), meaning "origin of the sun".', emojipedia: 'map-of-japan', xSearch: '🗾 日本', imageSearch: '日本 地図 四島' },
		{ emoji: '🗻', name: 'Mount Fuji', description: 'Japan\'s sacred mountain (富士山 Fujisan) at 3,776m is a UNESCO World Heritage Site. This perfectly symmetrical volcano is visible from Tokyo on clear days and has been depicted in art for centuries, including Hokusai\'s famous "Great Wave".', emojipedia: 'mount-fuji', xSearch: '🗻 富士山', imageSearch: '富士山 写真' },
		{ emoji: '🗼', name: 'Tokyo Tower', description: 'Built in 1958, this 333m communications tower in Minato, Tokyo was inspired by the Eiffel Tower but painted orange-white for aviation safety. It was Japan\'s tallest structure until Tokyo Skytree opened in 2012.', emojipedia: 'tokyo-tower', xSearch: '🗼 東京タワー', imageSearch: '東京タワー 夜景' },
		{ emoji: '🏯', name: 'Japanese Castle', description: 'Traditional castles (城 shiro) feature distinctive curved roofs and white walls. Famous examples include Himeji Castle (a UNESCO site called "White Heron Castle") and Osaka Castle, built by Toyotomi Hideyoshi in 1583.', emojipedia: 'japanese-castle', xSearch: '🏯 城', imageSearch: '姫路城' },
		{ emoji: '⛩️', name: 'Shinto Shrine Gate', description: 'Torii (鳥居, literally "bird perch") are vermillion gates marking sacred space at Shinto shrines. They separate the everyday world from the spiritual realm. Fushimi Inari in Kyoto has thousands of them!', emojipedia: 'shinto-shrine', xSearch: '⛩️ 神社', imageSearch: '伏見稲荷 千本鳥居' },
		{ emoji: '🎌', name: 'Crossed Flags', description: 'Two Japanese flags (日章旗 Nisshōki, "sun-mark flag") crossed for national celebrations. The red circle represents the sun, earning Japan the name "Land of the Rising Sun" (日出ずる国).', emojipedia: 'crossed-flags', xSearch: '🎌 日本', imageSearch: '日章旗 国旗' },
		{ emoji: '👘', name: 'Kimono', description: 'Traditional Japanese garment (着物, literally "thing to wear") with T-shaped robes and wide sleeves. Worn left-over-right (right-over-left is only for the deceased!). Still worn for weddings, Coming of Age Day, and festivals.', emojipedia: 'kimono', xSearch: '👘 着物', imageSearch: '着物 振袖' },
		{ emoji: '👺', name: 'Tengu', description: 'Mountain spirits (天狗, "heavenly dogs") from Japanese folklore with long red noses and magical powers. Originally seen as war demons, they became protectors of mountains and martial arts masters. Featured in many festivals as masks.', emojipedia: 'goblin', xSearch: '👺 天狗', imageSearch: '天狗 面' },
		{ emoji: '👹', name: 'Oni', description: 'Japanese ogres/demons (鬼) with horns, wild hair, and colorful skin (red, blue, or green). During Setsubun festival on Feb 3rd, people throw beans while shouting "Oni wa soto!" (demons out!) to drive away evil.', emojipedia: 'ogre', xSearch: '👹 鬼 節分', imageSearch: '節分 鬼' },
		{ emoji: '🥷', name: 'Ninja', description: 'Covert agents of feudal Japan (忍者, "one who endures") specializing in espionage, sabotage, and guerrilla warfare. Contrary to pop culture, they rarely wore all-black - that\'s from kabuki theater conventions!', emojipedia: 'ninja', xSearch: '🥷 忍者', imageSearch: '忍者 忍び' },
	];

	// Festival emoji
	const festivalEmoji = [
		{ emoji: '🎍', name: 'Kadomatsu', description: 'New Year\'s "gate pine" (門松) placed in pairs outside homes to welcome ancestral spirits. Made with three cut bamboo pieces (representing heaven, humanity, earth) and pine sprigs (symbolizing longevity). Displayed Dec 28 - Jan 7.', emojipedia: 'pine-decoration', xSearch: '🎍 お正月', imageSearch: '門松 正月飾り' },
		{ emoji: '🎎', name: 'Hina Dolls', description: 'Ornamental emperor and empress dolls (雛人形) displayed on tiered platforms for Hinamatsuri (Girls\' Day) on March 3rd. Families with daughters display these heirloom dolls to wish for their health and happiness. A full set has 15 dolls!', emojipedia: 'japanese-dolls', xSearch: '🎎 ひな祭り', imageSearch: 'ひな人形 七段飾り' },
		{ emoji: '🎏', name: 'Koinobori', description: 'Carp streamers (鯉のぼり) flown for Children\'s Day (こどもの日) on May 5th. Carp represent strength because they swim upstream. Traditionally: black carp = father, red = mother, smaller blue/green = children. Some rivers display thousands!', emojipedia: 'carp-streamer', xSearch: '🎏 こどもの日', imageSearch: '鯉のぼり 川' },
		{ emoji: '🎋', name: 'Tanabata Tree', description: 'For the Star Festival (七夕) on July 7th, people write wishes on colorful paper strips called tanzaku (短冊) and hang them on bamboo branches. The festival celebrates the yearly meeting of star-crossed lovers Orihime and Hikoboshi.', emojipedia: 'tanabata-tree', xSearch: '🎋 七夕', imageSearch: '七夕 短冊 笹' },
		{ emoji: '🎑', name: 'Moon Viewing', description: 'Tsukimi (月見, "moon viewing") celebrates the autumn harvest moon. Families display pampas grass (susuki) and eat tsukimi dango - white rice dumplings stacked in pyramids. McDonald\'s Japan even sells "Tsukimi Burgers" with egg!', emojipedia: 'moon-viewing-ceremony', xSearch: '🎑 月見', imageSearch: '月見 団子 すすき' },
		{ emoji: '🎐', name: 'Wind Chime', description: 'Fūrin (風鈴, "wind bell") are delicate glass bells hung in summer. Their gentle chiming sound is said to make people feel cooler - a form of psychological air conditioning! Many temples hold fūrin festivals with hundreds of chimes.', emojipedia: 'wind-chime', xSearch: '🎐 風鈴', imageSearch: '風鈴 ガラス' },
		{ emoji: '🎴', name: 'Hanafuda', description: 'Flower cards (花札) are traditional playing cards featuring seasonal flowers and plants for each month. Created when gambling cards were banned! Nintendo actually started as a hanafuda company in 1889 before making video games.', emojipedia: 'flower-playing-cards', xSearch: '🎴 花札', imageSearch: '花札 札' },
	];

	// Food and drink emoji
	const foodEmoji = [
		{ emoji: '🍣', name: 'Sushi', description: 'Nigiri sushi (握り寿司) - hand-pressed vinegared rice topped with fresh seafood. The emoji shows salmon or tuna on rice. Fun fact: "sushi" refers to the seasoned rice, not the fish! Conveyor belt sushi (回転寿司) is a fun, affordable way to try it.', emojipedia: 'sushi', xSearch: '🍣 寿司', imageSearch: '握り寿司 盛り合わせ' },
		{ emoji: '🍜', name: 'Ramen', description: 'Japan\'s beloved noodle soup (ラーメン) with wheat noodles in flavorful broth. Regional styles include: tonkotsu (pork bone) from Hakata, miso from Sapporo, shoyu (soy sauce) from Tokyo. Slurping is encouraged - it shows you\'re enjoying it!', emojipedia: 'steaming-bowl', xSearch: '🍜 ラーメン', imageSearch: 'ラーメン 味噌' },
		{ emoji: '🍙', name: 'Onigiri', description: 'Triangular rice balls (おにぎり) wrapped in crispy nori seaweed with fillings like salmon, tuna mayo, or pickled plum (umeboshi). The ultimate Japanese convenience food - available at every konbini (convenience store) for about ¥100-150!', emojipedia: 'rice-ball', xSearch: '🍙 おにぎり', imageSearch: 'おにぎり コンビニ' },
		{ emoji: '🍱', name: 'Bento Box', description: 'Compartmentalized lunchboxes (弁当) are an art form in Japan. Parents make elaborate "kyaraben" (character bento) for kids, and train stations sell regional "ekiben". A balanced bento follows the 4:3:2:1 ratio of rice, veggies, protein, and pickle.', emojipedia: 'bento-box', xSearch: '🍱 弁当', imageSearch: 'キャラ弁 弁当' },
		{ emoji: '🍤', name: 'Fried Shrimp', description: 'Ebi fry (エビフライ) - large shrimp coated in panko breadcrumbs and deep-fried golden. A yoshoku (Western-influenced Japanese) dish, often served with tonkatsu sauce or tartar sauce. The tail stays on for presentation!', emojipedia: 'fried-shrimp', xSearch: '🍤 エビフライ', imageSearch: 'エビフライ 定食' },
		{ emoji: '🍥', name: 'Narutomaki', description: 'Fish cake (鳴門巻き) with distinctive pink spiral pattern, named after the Naruto whirlpools. A classic ramen topping! The anime character Naruto Uzumaki is named after this - note the spiral on his costume.', emojipedia: 'fish-cake-with-swirl', xSearch: '🍥 なると', imageSearch: '鳴門巻き ラーメン' },
		{ emoji: '🍡', name: 'Dango', description: 'Sweet rice dumplings (団子) on bamboo skewers. The tri-color "hanami dango" (pink, white, green) represents cherry blossoms, snow, and grass - eaten during spring flower viewing. The colors may also represent sunset, moon, and earth!', emojipedia: 'dango', xSearch: '🍡 団子', imageSearch: '花見団子 三色' },
		{ emoji: '🍘', name: 'Senbei', description: 'Crispy rice crackers (煎餅) in countless varieties - plain, soy-glazed, wrapped in nori, or spicy. A traditional snack since the Edo period! Often sold at tourist spots and temples. The emoji shows the classic nori-wrapped style.', emojipedia: 'rice-cracker', xSearch: '🍘 煎餅', imageSearch: '煎餅 海苔' },
		{ emoji: '🍢', name: 'Oden', description: 'Winter comfort food (おでん) - various ingredients simmered in dashi broth: fish cakes, boiled eggs, daikon radish, and konjac. Every convenience store serves it from autumn to spring! Each region has unique ingredients.', emojipedia: 'oden', xSearch: '🍢 おでん', imageSearch: 'おでん 屋台' },
		{ emoji: '🍲', name: 'Nabe', description: 'Hot pot (鍋物) cooked communally at the table - the ultimate winter bonding meal. Styles include sukiyaki, shabu-shabu, and chanko (sumo wrestler stew). Everyone gathers around, adds ingredients, and shares from one pot!', emojipedia: 'pot-of-food', xSearch: '🍲 鍋', imageSearch: 'すき焼き 鍋' },
		{ emoji: '🍵', name: 'Matcha', description: 'Powdered green tea (抹茶) whisked with hot water in a bowl without handles. Central to the tea ceremony (茶道). The emoji shows a yunomi tea cup. Modern Japan uses matcha in everything: lattes, ice cream, Kit Kats, and more!', emojipedia: 'teacup-without-handle', xSearch: '🍵 抹茶', imageSearch: '抹茶 茶道' },
		{ emoji: '🍶', name: 'Sake', description: 'Rice wine (日本酒 nihonshu) served in a ceramic bottle called tokkuri with small cups (ochoko). Served hot or cold depending on quality and preference. "Kanpai!" (乾杯) is the Japanese toast - meaning "dry the cup!"', emojipedia: 'sake', xSearch: '🍶 日本酒', imageSearch: '日本酒 徳利 お猪口' },
		{ emoji: '🍧', name: 'Kakigōri', description: 'Shaved ice (かき氷) with colorful syrups - the quintessential Japanese summer treat! Blue Hawaii, strawberry, and melon are popular. Fancy versions use condensed milk, fresh fruit, and matcha. Look for the 氷 (ice) flag at shops!', emojipedia: 'shaved-ice', xSearch: '🍧 かき氷', imageSearch: 'かき氷 いちご' },
	];

	// Miscellaneous symbols
	const symbolEmoji = [
		{ emoji: '♨️', name: 'Hot Springs', description: 'The onsen (温泉) symbol appears on maps and signs marking Japan\'s 25,000+ natural hot springs. Three wavy lines represent rising steam. Onsen culture is central to Japanese life - with specific etiquette like washing before entering!', emojipedia: 'hot-springs', xSearch: '♨️ 温泉', imageSearch: '温泉 露天風呂' },
		{ emoji: '🔰', name: 'Beginner Mark', description: 'The shoshinsha mark (初心者マーク) or "wakaba mark" (young leaf) is legally required on cars of new drivers in Japan for one year. The teal-and-yellow V-shape is also used for "newbie" status in games, jobs, and online!', emojipedia: 'japanese-symbol-for-beginner', xSearch: '🔰 初心者', imageSearch: '初心者マーク 車' },
		{ emoji: '📛', name: 'Name Badge', description: 'This tulip-shaped name tag (名札) is worn by Japanese kindergarteners and elementary students. The flower shape is so iconic that foreigners nicknamed it "tofu on fire"! New company employees also wear name badges.', emojipedia: 'name-badge', xSearch: '📛 名札', imageSearch: '幼稚園 名札 チューリップ' },
		{ emoji: '💮', name: 'White Flower', description: 'The hanamaru (花丸, "flower circle") is a stamp or mark teachers draw on excellent student work - Japan\'s equivalent of a gold star! It\'s a circle with flower-like loops around the edge. Getting one feels like winning!', emojipedia: 'white-flower', xSearch: '💮 花丸', imageSearch: '花丸 宿題' },
		{ emoji: '💢', name: 'Anger Symbol', description: 'A manga/anime visual shorthand for anger - representing a throbbing vein on the forehead. You\'ll see this in countless anime when characters get annoyed! Also called "pikon" after the sound effect.', emojipedia: 'anger-symbol', xSearch: '💢 怒り 漫画', imageSearch: '漫画 怒りマーク 青筋' },
		{ emoji: '💠', name: 'Kawaii Symbol', description: 'A decorative diamond flower shape used in Japanese "kawaii" (cute) culture. Common in stationery, stickers, and graphic design. Represents the aesthetic focus on cuteness that pervades Japanese pop culture.', emojipedia: 'diamond-with-a-dot', xSearch: '💠 かわいい', imageSearch: 'かわいい デコレーション' },
		{ emoji: '🏩', name: 'Love Hotel', description: 'Hotels for couples (ラブホテル) with themed rooms, privacy, and hourly rates. Recognizable by heart-shaped signs and ornate architecture. A unique Japanese institution providing privacy in a country with thin walls and multi-gen homes!', emojipedia: 'love-hotel', xSearch: '🏩 ラブホ', imageSearch: 'ラブホテル 看板' },
		{ emoji: '🏣', name: 'Japanese Post Office', description: 'Post office marked with the 〒 postal symbol (yubin mark), unique to Japan. Japan Post also provides banking services! The distinctive red mailboxes (郵便ポスト) are found throughout the country.', emojipedia: 'japanese-post-office', xSearch: '🏣 郵便局', imageSearch: '郵便局 ポスト 赤' },
		{ emoji: '💴', name: 'Yen Banknote', description: 'Japanese yen (円) currency. Japan is still largely cash-based! New 2024 bills feature Shibusawa Eiichi (¥10,000), Tsuda Umeko (¥5,000), and Kitasato Shibasaburo (¥1,000). The ¥ symbol comes from "yen" written in romaji.', emojipedia: 'yen-banknote', xSearch: '💴 円', imageSearch: '日本円 新紙幣 2024' },
		{ emoji: '🚅', name: 'Shinkansen', description: 'The bullet train (新幹線, "new trunk line") network launched in 1964 for the Tokyo Olympics. Trains reach 320 km/h and are famous for punctuality - the average delay is under 1 minute! The emoji shows the N700 series.', emojipedia: 'bullet-train', xSearch: '🚅 新幹線', imageSearch: '新幹線 N700' },
		{ emoji: '🙈🙉🙊', name: 'Three Wise Monkeys', description: 'See no evil, hear no evil, speak no evil (見ざる聞かざる言わざる) - a famous 17th-century carving at Nikkō Tōshōgū Shrine. The pun works in Japanese: "zaru" means both "monkey" and "not" in old Japanese!', emojipedia: 'see-no-evil-monkey', xSearch: '🙈🙉🙊 日光', imageSearch: '日光東照宮 三猿' },
	];
</script>

<svelte:head>
	<title>Japanese Emoji Guide - Kiokun</title>
	<meta name="description" content="A guide to Japanese cultural emojis - learn the meaning of kanji emoji symbols, festival icons, and Japanese cultural pictographs." />
</svelte:head>

<Header currentWord="" />

<div class="container">
	<header class="page-header">
		<h1>🇯🇵 Japanese Emoji Guide</h1>
		<p class="subtitle">Discover the meaning behind Japan's cultural emoji symbols</p>
		<p class="intro">
			Did you know the word "emoji" comes from Japanese? 絵 (e = picture) + 文字 (moji = character). 
			Because emoji originated in Japan, many symbols reflect Japanese culture, language, and daily life.
		</p>
	</header>

	<!-- Kanji/Semantic Emoji Section -->
	<section class="emoji-section">
		<h2>📝 Kanji Symbol Emoji</h2>
		<p class="section-intro">
			These emoji use real Japanese kanji characters. They originated from Japanese signage and are most useful for language learners!
		</p>
		<div class="emoji-grid kanji-grid">
			{#each kanjiEmoji as item}
				<div class="emoji-card kanji-card">
					<div class="card-header">
						<div class="emoji-large">{item.emoji}</div>
						<div class="kanji-info">
							<span class="kanji-char">{item.kanji}</span>
							<span class="reading">{item.reading}</span>
						</div>
					</div>
					<h3>{item.meaning}</h3>
					<p class="description">{item.description}</p>
					<p class="usage"><strong>Usage:</strong> {item.usage}</p>
					<div class="card-links">
						<a href="https://emojipedia.org/{item.emojipedia}" target="_blank" rel="noopener" title="View on Emojipedia">📖 Details</a>
						<a href="https://x.com/search?q={encodeURIComponent(item.xSearch)}" target="_blank" rel="noopener" title="See real usage on X">🔍 Examples</a>
						{#if item.dictLink}
							<a href="https://jisho.org/search/{encodeURIComponent(item.dictLink)}%20%23kanji" target="_blank" rel="noopener" title="Look up on Jisho.org">辞 Jisho</a>
						{/if}
						<a href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(item.imageSearch)}" target="_blank" rel="noopener" title="See real photos">🖼️ Images</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Cultural Emoji Section -->
	<section class="emoji-section">
		<h2>🏯 Icons & Landmarks</h2>
		<div class="emoji-grid">
			{#each culturalEmoji as item}
				<div class="emoji-card">
					<div class="emoji-large">{item.emoji}</div>
					<h3>{item.name}</h3>
					<p class="description">{item.description}</p>
					<div class="card-links">
						<a href="https://emojipedia.org/{item.emojipedia}" target="_blank" rel="noopener" title="View on Emojipedia">📖 Details</a>
						<a href="https://x.com/search?q={encodeURIComponent(item.xSearch)}" target="_blank" rel="noopener" title="See real usage on X">🔍 Examples</a>
						<a href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(item.imageSearch)}" target="_blank" rel="noopener" title="See images on Google">🖼️ Images</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Festival Emoji Section -->
	<section class="emoji-section">
		<h2>🎋 Festivals & Traditions</h2>
		<div class="emoji-grid">
			{#each festivalEmoji as item}
				<div class="emoji-card">
					<div class="emoji-large">{item.emoji}</div>
					<h3>{item.name}</h3>
					<p class="description">{item.description}</p>
					<div class="card-links">
						<a href="https://emojipedia.org/{item.emojipedia}" target="_blank" rel="noopener" title="View on Emojipedia">📖 Details</a>
						<a href="https://x.com/search?q={encodeURIComponent(item.xSearch)}" target="_blank" rel="noopener" title="See real usage on X">🔍 Examples</a>
						<a href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(item.imageSearch)}" target="_blank" rel="noopener" title="See images on Google">🖼️ Images</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Food Emoji Section -->
	<section class="emoji-section">
		<h2>🍣 Food & Drink</h2>
		<div class="emoji-grid">
			{#each foodEmoji as item}
				<div class="emoji-card">
					<div class="emoji-large">{item.emoji}</div>
					<h3>{item.name}</h3>
					<p class="description">{item.description}</p>
					<div class="card-links">
						<a href="https://emojipedia.org/{item.emojipedia}" target="_blank" rel="noopener" title="View on Emojipedia">📖 Details</a>
						<a href="https://x.com/search?q={encodeURIComponent(item.xSearch)}" target="_blank" rel="noopener" title="See real usage on X">🔍 Examples</a>
						<a href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(item.imageSearch)}" target="_blank" rel="noopener" title="See images on Google">🖼️ Images</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Symbol Emoji Section -->
	<section class="emoji-section">
		<h2>🔰 Symbols & Signs</h2>
		<div class="emoji-grid">
			{#each symbolEmoji as item}
				<div class="emoji-card">
					<div class="emoji-large">{item.emoji}</div>
					<h3>{item.name}</h3>
					<p class="description">{item.description}</p>
					<div class="card-links">
						<a href="https://emojipedia.org/{item.emojipedia}" target="_blank" rel="noopener" title="View on Emojipedia">📖 Details</a>
						<a href="https://x.com/search?q={encodeURIComponent(item.xSearch)}" target="_blank" rel="noopener" title="See real usage on X">🔍 Examples</a>
						<a href="https://www.google.com/search?tbm=isch&q={encodeURIComponent(item.imageSearch)}" target="_blank" rel="noopener" title="See images on Google">🖼️ Images</a>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Finding Examples Section -->
	<section class="emoji-section finding-examples">
		<h2>🔍 Find Real Examples</h2>
		<p class="section-intro">
			Want to see how these emoji are used in the wild? Here are some ways to find real examples:
		</p>
		<div class="tips-grid">
			<div class="tip-card">
				<h3>🐦 X/Twitter Search</h3>
				<p>Search for any emoji directly on X to see how Japanese users use them. Try searching:</p>
				<ul>
					<li><code>🈹 セール</code> - for discount announcements</li>
					<li><code>㊗️ 誕生日</code> - for birthday celebrations</li>
					<li><code>🈺 営業中</code> - for "open" announcements</li>
				</ul>
				<a href="https://x.com/search?q=%F0%9F%88%B9" target="_blank" rel="noopener" class="tip-link">Search 🈹 on X →</a>
			</div>
			<div class="tip-card">
				<h3>📸 Instagram</h3>
				<p>Japanese businesses and influencers use these emoji in posts. Search hashtags like:</p>
				<ul>
					<li><code>#セール</code> + emoji for sales</li>
					<li><code>#新年</code> + 🎍 for New Year posts</li>
					<li><code>#花火</code> + 🎐 for summer festival posts</li>
				</ul>
			</div>
			<div class="tip-card">
				<h3>🔎 Google Search</h3>
				<p>Search the emoji + Japanese context to find usage:</p>
				<ul>
					<li><code>🈵 駐車場</code> - parking lot signs</li>
					<li><code>🈳 空室</code> - hotel vacancies</li>
					<li><code>🈲 禁煙</code> - no smoking signs</li>
				</ul>
			</div>
			<div class="tip-card">
				<h3>📰 Emojipedia</h3>
				<p>For detailed history and cross-platform rendering of each emoji:</p>
				<a href="https://emojipedia.org/squared-cjk-unified-ideograph-5272" target="_blank" rel="noopener" class="tip-link">View 🈹 on Emojipedia →</a>
			</div>
		</div>
	</section>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px 20px 60px;
	}

	.page-header {
		text-align: center;
		padding: 40px 0;
	}

	.page-header h1 {
		font-size: 36px;
		margin: 0 0 12px;
		color: var(--text-primary);
	}

	.subtitle {
		font-size: 18px;
		color: var(--text-secondary);
		margin: 0 0 20px;
	}

	.intro {
		max-width: 700px;
		margin: 0 auto;
		font-size: 15px;
		color: var(--text-tertiary);
		line-height: 1.6;
	}

	.emoji-section {
		margin-bottom: 50px;
	}

	.emoji-section h2 {
		font-size: 24px;
		margin: 0 0 12px;
		padding-bottom: 12px;
		border-bottom: 2px solid var(--border-color);
		color: var(--text-primary);
	}

	.section-intro {
		margin: 0 0 20px;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.kanji-grid {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	}

	.emoji-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 20px;
		transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
	}

	.emoji-card:hover {
		border-color: var(--accent);
		box-shadow: 0 4px 12px var(--shadow);
		transform: translateY(-2px);
	}

	.emoji-large {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.kanji-card .kanji-info {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 8px;
	}

	.kanji-char {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-primary);
		font-family: "Noto Serif JP", serif;
	}

	.reading {
		font-size: 14px;
		color: var(--color-kunyomi);
		font-style: italic;
	}

	/* Card header layout for kanji cards */
	.card-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.card-header .emoji-large {
		margin-bottom: 0;
	}

	.emoji-card h3 {
		font-size: 16px;
		margin: 0 0 8px;
		color: var(--text-primary);
	}

	.description {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 8px;
	}

	.usage {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0 0 12px;
		padding-top: 8px;
		border-top: 1px solid var(--border-color);
	}

	/* Card Links */
	.card-links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.card-links a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		font-size: 12px;
		color: var(--text-secondary);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}

	.card-links a:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--bg-secondary);
	}

	/* Finding Examples Section */
	.finding-examples {
		background: var(--bg-tertiary);
		padding: 30px;
		border-radius: var(--radius-lg);
		margin-top: 40px;
	}

	.tips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 20px;
	}

	.tip-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 20px;
	}

	.tip-card h3 {
		font-size: 16px;
		margin: 0 0 10px;
		color: var(--text-primary);
	}

	.tip-card p {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0 0 12px;
		line-height: 1.5;
	}

	.tip-card ul {
		margin: 0 0 12px;
		padding-left: 20px;
	}

	.tip-card li {
		font-size: 12px;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.tip-card code {
		background: var(--bg-tertiary);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-size: 11px;
	}

	.tip-link {
		display: inline-block;
		font-size: 13px;
		color: var(--accent);
		text-decoration: none;
	}

	.tip-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.container {
			padding: 10px 16px 40px;
		}

		.page-header {
			padding: 30px 0;
		}

		.page-header h1 {
			font-size: 28px;
		}

		.subtitle {
			font-size: 16px;
		}

		.emoji-section h2 {
			font-size: 20px;
		}

		.emoji-grid {
			grid-template-columns: 1fr;
		}

		.kanji-grid {
			grid-template-columns: 1fr;
		}

		.tips-grid {
			grid-template-columns: 1fr;
		}

		.finding-examples {
			padding: 20px;
		}
	}
</style>

