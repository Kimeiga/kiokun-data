<script lang="ts">
	import Header from '$lib/components/Header.svelte';

	// Kanji/semantic emoji - these have meaning from Japanese characters (most interesting for learners)
	const kanjiEmoji = [
		{ emoji: '🈁', kanji: 'ココ', reading: 'koko', meaning: 'Here', description: 'Katakana for "here" (ここ). Used to indicate a location or "you are here" on maps.', usage: 'Maps, location markers, directions', emojipedia: 'japanese-here-button', xSearch: '🈁' },
		{ emoji: '🈂️', kanji: 'サ', reading: 'sa', meaning: 'Service', description: 'Short for サービス (sābisu/service). Indicates free service or "service charge included".', usage: 'Shops, restaurants indicating free extras', emojipedia: 'japanese-service-charge-button', xSearch: '🈂 サービス' },
		{ emoji: '🈷️', kanji: '月', reading: 'tsuki/getsu', meaning: 'Month/Moon', description: 'Used to indicate monthly fees or subscriptions (月額 gekkai).', usage: 'Subscription services, monthly payments', emojipedia: 'japanese-monthly-amount-button', xSearch: '🈷 月額', dictLink: '月' },
		{ emoji: '🈶', kanji: '有', reading: 'yū/aru', meaning: 'Have/Exists', description: 'Indicates something is available or there is a fee (有料 yūryō = paid/not free).', usage: '"Wi-Fi available", "Fee applies"', emojipedia: 'japanese-not-free-of-charge-button', xSearch: '🈶 有料', dictLink: '有' },
		{ emoji: '🈯', kanji: '指', reading: 'shi/yubi', meaning: 'Reserved/Designated', description: 'From 指定席 (shiteiseki = reserved seat). Used in train reservations.', usage: 'Reserved seating, designated areas', emojipedia: 'japanese-reserved-button', xSearch: '🈯 指定席', dictLink: '指' },
		{ emoji: '🉐', kanji: '得', reading: 'toku', meaning: 'Bargain/Profit', description: 'Indicates a special deal or discount. Common in sales promotions.', usage: 'Sales, special offers, bargain finds', emojipedia: 'japanese-bargain-button', xSearch: '🉐 セール', dictLink: '得' },
		{ emoji: '🈹', kanji: '割', reading: 'wari', meaning: 'Discount', description: 'From 割引 (waribiki = discount). Indicates reduced prices.', usage: 'Store sales, price reductions, coupons', emojipedia: 'japanese-discount-button', xSearch: '🈹 割引', dictLink: '割' },
		{ emoji: '🈚', kanji: '無', reading: 'mu/nashi', meaning: 'Nothing/Free', description: 'Indicates no charge or free (無料 muryō). Opposite of 🈶.', usage: '"Free Wi-Fi", "No charge", "Not available"', emojipedia: 'japanese-free-of-charge-button', xSearch: '🈚 無料', dictLink: '無' },
		{ emoji: '🈲', kanji: '禁', reading: 'kin', meaning: 'Prohibited', description: 'From 禁止 (kinshi = forbidden). Used for "no smoking", "no entry", etc.', usage: '禁煙 No smoking, prohibition signs', emojipedia: 'japanese-prohibited-button', xSearch: '🈲 禁止', dictLink: '禁' },
		{ emoji: '🉑', kanji: '可', reading: 'ka', meaning: 'Acceptable/OK', description: 'Indicates permission or that something is allowed/possible.', usage: '"Pets allowed", "OK to use"', emojipedia: 'japanese-acceptable-button', xSearch: '🉑', dictLink: '可' },
		{ emoji: '🈸', kanji: '申', reading: 'shin/mōsu', meaning: 'Application', description: 'From 申し込む (mōshikomu = to apply). Also the zodiac Monkey.', usage: 'Job applications, registration forms', emojipedia: 'japanese-application-button', xSearch: '🈸 申込', dictLink: '申' },
		{ emoji: '🈴', kanji: '合', reading: 'gō/ai', meaning: 'Pass/Meet', description: 'From 合格 (gōkaku = pass an exam). Indicates success or meeting requirements.', usage: 'Exam results, passing grades, approval', emojipedia: 'japanese-passing-grade-button', xSearch: '🈴 合格', dictLink: '合' },
		{ emoji: '🈳', kanji: '空', reading: 'kū/kara/sora', meaning: 'Empty/Vacant', description: 'Indicates vacancy or availability. Also means "sky" or Buddhist "emptiness".', usage: 'Hotel vacancies, parking spaces available', emojipedia: 'japanese-vacancy-button', xSearch: '🈳 空室', dictLink: '空' },
		{ emoji: '㊗️', kanji: '祝', reading: 'shuku/iwau', meaning: 'Congratulations', description: 'From 祝う (iwau = to celebrate). Used for celebrations and well-wishes.', usage: 'Birthdays, weddings, achievements', emojipedia: 'japanese-congratulations-button', xSearch: '㊗ おめでとう', dictLink: '祝' },
		{ emoji: '㊙️', kanji: '秘', reading: 'hi', meaning: 'Secret', description: 'From 秘密 (himitsu = secret). Often used playfully as "classified".', usage: 'Secret info, confidential, マル秘 (top secret)', emojipedia: 'japanese-secret-button', xSearch: '㊙ 秘密', dictLink: '秘' },
		{ emoji: '🈺', kanji: '営', reading: 'ei', meaning: 'Open/Operating', description: 'From 営業中 (eigyōchū = open for business).', usage: 'Store hours, "We are open" signs', emojipedia: 'japanese-open-for-business-button', xSearch: '🈺 営業中', dictLink: '営' },
		{ emoji: '🈵', kanji: '満', reading: 'man', meaning: 'Full/No Vacancy', description: 'Indicates something is full or sold out. Opposite of 🈳.', usage: 'Parking full, hotel booked, sold out', emojipedia: 'japanese-no-vacancy-button', xSearch: '🈵 満席', dictLink: '満' },
	];

	// Cultural/pictorial emoji - Japanese items, festivals, food, etc.
	const culturalEmoji = [
		{ emoji: '🗾', name: 'Map of Japan', description: 'The only country with its own map emoji! Shows the Japanese archipelago.', emojipedia: 'map-of-japan', xSearch: '🗾 日本', imageSearch: '日本 地図' },
		{ emoji: '🗻', name: 'Mount Fuji', description: 'Japan\'s iconic sacred mountain (富士山 Fujisan), a UNESCO World Heritage Site.', emojipedia: 'mount-fuji', xSearch: '🗻 富士山', imageSearch: '富士山' },
		{ emoji: '🗼', name: 'Tokyo Tower', description: 'The famous 333m communications tower in Minato, Tokyo, built in 1958.', emojipedia: 'tokyo-tower', xSearch: '🗼 東京タワー', imageSearch: '東京タワー' },
		{ emoji: '🏯', name: 'Japanese Castle', description: 'A traditional Japanese castle (城 shiro) like Himeji or Osaka Castle.', emojipedia: 'japanese-castle', xSearch: '🏯 城', imageSearch: '日本 城' },
		{ emoji: '⛩️', name: 'Shinto Shrine Gate', description: 'Torii (鳥居) - the iconic red gate marking the entrance to a Shinto shrine.', emojipedia: 'shinto-shrine', xSearch: '⛩️ 神社', imageSearch: '鳥居 神社' },
		{ emoji: '🎌', name: 'Crossed Flags', description: 'Two Japanese flags (日章旗 Nisshōki) crossed, often for national celebrations.', emojipedia: 'crossed-flags', xSearch: '🎌 日本', imageSearch: '日章旗' },
		{ emoji: '👘', name: 'Kimono', description: 'Traditional Japanese garment (着物) worn for special occasions and festivals.', emojipedia: 'kimono', xSearch: '👘 着物', imageSearch: '着物' },
		{ emoji: '👺', name: 'Tengu', description: 'A mythological creature (天狗) with a long red nose, associated with mountains.', emojipedia: 'goblin', xSearch: '👺 天狗', imageSearch: '天狗' },
		{ emoji: '👹', name: 'Oni', description: 'Japanese ogre/demon (鬼) from folklore, often red or blue with horns.', emojipedia: 'ogre', xSearch: '👹 鬼', imageSearch: '鬼 日本' },
		{ emoji: '🥷', name: 'Ninja', description: 'Covert agent of feudal Japan (忍者), masters of stealth and espionage.', emojipedia: 'ninja', xSearch: '🥷 忍者', imageSearch: '忍者' },
	];

	// Festival emoji
	const festivalEmoji = [
		{ emoji: '🎍', name: 'Kadomatsu', description: 'New Year\'s decoration (門松) made of bamboo and pine, placed at entrances.', emojipedia: 'pine-decoration', xSearch: '🎍 お正月', imageSearch: '門松' },
		{ emoji: '🎎', name: 'Hina Dolls', description: 'Ornamental dolls for Hinamatsuri (雛祭り) - Girls\' Day on March 3rd.', emojipedia: 'japanese-dolls', xSearch: '🎎 ひな祭り', imageSearch: 'ひな人形' },
		{ emoji: '🎏', name: 'Koinobori', description: 'Carp streamers (鯉のぼり) flown for Kodomo no Hi (Children\'s Day) on May 5th.', emojipedia: 'carp-streamer', xSearch: '🎏 こどもの日', imageSearch: '鯉のぼり' },
		{ emoji: '🎋', name: 'Tanabata Tree', description: 'Bamboo decorated with wishes on paper strips for the Star Festival (七夕) in July.', emojipedia: 'tanabata-tree', xSearch: '🎋 七夕', imageSearch: '七夕 笹' },
		{ emoji: '🎑', name: 'Moon Viewing', description: 'Tsukimi (月見) - autumn harvest moon festival with dango and pampas grass.', emojipedia: 'moon-viewing-ceremony', xSearch: '🎑 月見', imageSearch: '月見 団子' },
		{ emoji: '🎐', name: 'Wind Chime', description: 'Fūrin (風鈴) - glass wind chime, a symbol of summer in Japan.', emojipedia: 'wind-chime', xSearch: '🎐 風鈴', imageSearch: '風鈴' },
		{ emoji: '🎴', name: 'Hanafuda', description: 'Flower cards (花札) - traditional Japanese playing cards with seasonal motifs.', emojipedia: 'flower-playing-cards', xSearch: '🎴 花札', imageSearch: '花札' },
	];

	// Food and drink emoji
	const foodEmoji = [
		{ emoji: '🍣', name: 'Sushi', description: 'Nigiri sushi (寿司) - vinegared rice topped with raw fish.', emojipedia: 'sushi', xSearch: '🍣 寿司', imageSearch: '寿司' },
		{ emoji: '🍜', name: 'Ramen', description: 'Japanese noodle soup (ラーメン) with various broths and toppings.', emojipedia: 'steaming-bowl', xSearch: '🍜 ラーメン', imageSearch: 'ラーメン' },
		{ emoji: '🍙', name: 'Onigiri', description: 'Rice ball (おにぎり) often wrapped in nori with a filling inside.', emojipedia: 'rice-ball', xSearch: '🍙 おにぎり', imageSearch: 'おにぎり' },
		{ emoji: '🍱', name: 'Bento Box', description: 'Compartmentalized lunchbox (弁当) with rice, protein, and sides.', emojipedia: 'bento-box', xSearch: '🍱 弁当', imageSearch: '弁当' },
		{ emoji: '🍤', name: 'Fried Shrimp', description: 'Ebi fry (エビフライ) - breaded and deep-fried shrimp, popular in Japan.', emojipedia: 'fried-shrimp', xSearch: '🍤 エビフライ', imageSearch: 'エビフライ' },
		{ emoji: '🍥', name: 'Narutomaki', description: 'Fish cake (鳴門巻き) with pink spiral pattern, common ramen topping.', emojipedia: 'fish-cake-with-swirl', xSearch: '🍥 なると', imageSearch: '鳴門巻き' },
		{ emoji: '🍡', name: 'Dango', description: 'Sweet rice dumplings (団子) on a skewer, often pink, white, and green.', emojipedia: 'dango', xSearch: '🍡 団子', imageSearch: '団子' },
		{ emoji: '🍘', name: 'Senbei', description: 'Rice cracker (煎餅) often wrapped with nori seaweed.', emojipedia: 'rice-cracker', xSearch: '🍘 煎餅', imageSearch: '煎餅' },
		{ emoji: '🍢', name: 'Oden', description: 'Winter hot pot dish (おでん) with various ingredients in dashi broth.', emojipedia: 'oden', xSearch: '🍢 おでん', imageSearch: 'おでん' },
		{ emoji: '🍲', name: 'Nabe', description: 'Hot pot (鍋) - communal dish cooked at the table.', emojipedia: 'pot-of-food', xSearch: '🍲 鍋', imageSearch: '鍋料理' },
		{ emoji: '🍵', name: 'Matcha', description: 'Green tea (抹茶) served in a traditional cup without handles.', emojipedia: 'teacup-without-handle', xSearch: '🍵 抹茶', imageSearch: '抹茶' },
		{ emoji: '🍶', name: 'Sake', description: 'Japanese rice wine (日本酒) served in a traditional bottle (tokkuri) and cup.', emojipedia: 'sake', xSearch: '🍶 日本酒', imageSearch: '日本酒 徳利' },
		{ emoji: '🍧', name: 'Kakigōri', description: 'Shaved ice dessert (かき氷) topped with sweet syrup, popular in summer.', emojipedia: 'shaved-ice', xSearch: '🍧 かき氷', imageSearch: 'かき氷' },
	];

	// Miscellaneous symbols
	const symbolEmoji = [
		{ emoji: '♨️', name: 'Hot Springs', description: 'Onsen (温泉) symbol, marking natural hot spring baths throughout Japan.', emojipedia: 'hot-springs', xSearch: '♨️ 温泉', imageSearch: '温泉' },
		{ emoji: '🔰', name: 'Beginner Mark', description: 'Shoshinsha mark (初心者マーク) - required on cars of new drivers in Japan. Also means "newbie".', emojipedia: 'japanese-symbol-for-beginner', xSearch: '🔰 初心者', imageSearch: '初心者マーク' },
		{ emoji: '📛', name: 'Name Badge', description: 'Tulip-shaped kindergarten name tag worn by Japanese children. Sometimes called "tofu on fire" abroad!', emojipedia: 'name-badge', xSearch: '📛 名札', imageSearch: '幼稚園 名札' },
		{ emoji: '💮', name: 'White Flower', description: 'A stamp (花まる hanamaru) teachers use to mark excellent work. Like a gold star!', emojipedia: 'white-flower', xSearch: '💮 花丸', imageSearch: '花丸 スタンプ' },
		{ emoji: '💢', name: 'Anger Symbol', description: 'Manga/anime symbol for anger - represents a popping vein on the forehead.', emojipedia: 'anger-symbol', xSearch: '💢 怒り', imageSearch: '漫画 怒りマーク' },
		{ emoji: '💠', name: 'Kawaii Symbol', description: 'Cute diamond shape often used in Japanese "kawaii" (cute) culture.', emojipedia: 'diamond-with-a-dot', xSearch: '💠 かわいい', imageSearch: 'かわいい デザイン' },
		{ emoji: '🏩', name: 'Love Hotel', description: 'Hotels for couples (ラブホテル), common in Japan. The H stands for Hotel!', emojipedia: 'love-hotel', xSearch: '🏩 ラブホ', imageSearch: 'ラブホテル 外観' },
		{ emoji: '🏣', name: 'Japanese Post Office', description: 'Post office with the 〒 postal mark, unique to Japan.', emojipedia: 'japanese-post-office', xSearch: '🏣 郵便局', imageSearch: '郵便局' },
		{ emoji: '💴', name: 'Yen Banknote', description: 'Japanese yen (円) currency note.', emojipedia: 'yen-banknote', xSearch: '💴 円', imageSearch: '日本円 紙幣' },
		{ emoji: '🚅', name: 'Shinkansen', description: 'Bullet train (新幹線) - Japan\'s famous high-speed rail network.', emojipedia: 'bullet-train', xSearch: '🚅 新幹線', imageSearch: '新幹線' },
		{ emoji: '🙈🙉🙊', name: 'Three Wise Monkeys', description: 'See/Hear/Speak no evil - from a famous carving at Nikkō\'s Tōshōgū Shrine.', emojipedia: 'see-no-evil-monkey', xSearch: '🙈🙉🙊 日光', imageSearch: '日光 三猿' },
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
					<div class="emoji-large">{item.emoji}</div>
					<div class="kanji-info">
						<span class="kanji-char">{item.kanji}</span>
						<span class="reading">{item.reading}</span>
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
		border-radius: 12px;
		padding: 20px;
		transition: all 0.2s ease;
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
		border-radius: 6px;
		text-decoration: none;
		transition: all 0.15s ease;
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
		border-radius: 16px;
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
		border-radius: 12px;
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
		border-radius: 4px;
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

