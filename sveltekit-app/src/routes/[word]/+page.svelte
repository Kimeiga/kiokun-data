<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import PitchAccent from '$lib/PitchAccent.svelte';

	let { data }: { data: PageData } = $props();

	let searchValue = $state(data.word);

	function handleSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const word = searchValue.trim();
			if (word) {
				goto(`/${word}`);
			}
		}
	}

	function getPartOfSpeechLabel(pos: string): string {
		if (!data.labels?.partOfSpeech) return pos;
		return data.labels.partOfSpeech[pos] || pos;
	}

	function getMiscLabel(misc: string): string {
		if (!data.labels?.misc) return misc;
		return data.labels.misc[misc] || misc;
	}
</script>

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
</svelte:head>

<div class="container">
	<div class="header">
		<h1 style="margin-bottom: 20px; color: #2c3e50;">📚 Kiokun Dictionary</h1>
		<input
			type="text"
			class="search-box"
			placeholder="Enter a character or word (e.g., 好, 地図)"
			bind:value={searchValue}
			onkeypress={handleSearch}
		/>
	</div>

	<div id="content">
		<!-- Character Header -->
		{#if data.data.chinese_char || data.data.japanese_char}
			<div class="section">
				<div class="section-content">
					<!-- Character Display -->
					<div style="margin-bottom: 20px;">
						<div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 10px;">
							<!-- Large Character -->
							<div style="font-size: 72px; font-weight: bold; font-family: 'MS Mincho', serif; line-height: 1;">
								{data.word}
							</div>

							<!-- Pronunciations -->
							<div style="display: flex; flex-direction: column; gap: 8px; padding-top: 8px;">
								<!-- Chinese Pinyin -->
								{#if data.data.chinese_char?.pinyinFrequencies}
									{@const wordPinyins = new Set(
										data.data.chinese_words?.flatMap((w) =>
											w.items?.map((item) => item.pinyin).filter(Boolean)
										) || []
									)}
									{@const filteredPinyins = data.data.chinese_char.pinyinFrequencies.filter((pf) =>
										wordPinyins.has(pf.pinyin)
									)}
									{#if filteredPinyins.length > 0}
										<div>
											<span style="font-size: 14px;">🇨🇳</span>
											<span style="font-size: 18px; color: #3498db; font-weight: 600;">
												{filteredPinyins.map((pf) => pf.pinyin).join(', ')}
											</span>
										</div>
									{/if}
								{/if}

								<!-- Japanese Readings -->
								{#if data.data.japanese_char?.readingMeaning?.groups}
									{@const group = data.data.japanese_char.readingMeaning.groups[0]}
									{@const onyomi =
										group?.readings?.filter((r) => r.type === 'ja_on').map((r) => r.value) || []}
									{@const kunyomi =
										group?.readings?.filter((r) => r.type === 'ja_kun').map((r) => r.value) || []}
									<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
										<div>
											<span style="font-size: 14px;">🇯🇵</span>
											{#if onyomi.length > 0}
												<span
													style="font-size: 18px; color: #e74c3c; font-family: 'MS Mincho', serif;"
												>
													{onyomi.join('、')}
												</span>
											{/if}
											{#if kunyomi.length > 0}
												{#if onyomi.length > 0}
													<span style="color: #bdc3c7;">|</span>
												{/if}
												<span
													style="font-size: 18px; color: #27ae60; font-family: 'MS Mincho', serif;"
												>
													{kunyomi.join('、')}
												</span>
											{/if}
										</div>
										{#if data.data.chinese_char?.gloss}
											<div style="font-size: 20px; color: #27ae60; font-weight: 600;">
												{data.data.chinese_char.gloss}
											</div>
										{/if}
									</div>
								{:else if data.data.chinese_char?.gloss}
									<div style="font-size: 20px; color: #27ae60; font-weight: 600;">
										{data.data.chinese_char.gloss}
									</div>
								{/if}
							</div>
						</div>

						<!-- Mnemonic Hint -->
						{#if data.data.chinese_char?.hint}
							<div
								style="margin-top: 12px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;"
							>
								<div style="font-size: 13px; color: #856404; line-height: 1.6;">
									💡 {data.data.chinese_char.hint}
								</div>
							</div>
						{/if}
					</div>

					<!-- Components -->
					{#if data.data.chinese_char?.components && data.data.chinese_char.components.length > 0}
						<div style="margin-bottom: 20px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #2c3e50;"
							>
								🧩 Components
							</div>
							<div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start;">
								{#each data.data.chinese_char.components as comp}
									{@const char = typeof comp === 'string' ? comp : comp.character || comp.char || comp}
									{@const types = comp.type || []}
									{@const isMeaning = types.includes('meaning')}
									{@const isPhonetic = types.includes('phonetic')}
									{@const highlightColor = isMeaning
										? '#27ae60'
										: isPhonetic
											? '#e74c3c'
											: '#95a5a6'}
									<div
										style="text-align: center; padding: 8px; background: white; border-radius: 6px; border: 2px solid {highlightColor};"
									>
										<div
											style="font-size: 32px; font-family: 'MS Mincho', serif; line-height: 1;"
										>
											{char}
										</div>
										<div
											style="font-size: 16px; font-weight: 600; margin-top: 6px; font-family: 'MS Mincho', serif;"
										>
											{char}
										</div>
										{#if types.length > 0}
											<div
												style="font-size: 10px; color: {highlightColor}; margin-top: 4px; font-weight: 600;"
											>
												{types
													.map((t) => (t === 'meaning' ? '🟢 meaning' : t === 'phonetic' ? '🔴 sound' : t))
													.join(' ')}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Historical Evolution -->
					{#if data.data.chinese_char?.images && data.data.chinese_char.images.length > 0}
						<div style="margin-bottom: 20px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #2c3e50;"
							>
								🏛️ Historical Evolution
							</div>
							<div style="display: flex; gap: 12px; overflow-x: auto; padding: 10px 0;">
								{#each data.data.chinese_char.images as image}
									<div
										style="flex-shrink: 0; text-align: center; padding: 10px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;"
									>
										{#if image.type === 'Regular' && image.era === 'Modern'}
											<!-- Display the actual character for Regular Modern -->
											<div
												style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 60px; font-family: 'MS Mincho', serif;"
											>
												{data.word}
											</div>
										{:else}
											<img
												src={image.url}
												alt="{image.type} {image.era}"
												style="width: 80px; height: 80px; object-fit: contain;"
												onerror={(e) => (e.currentTarget.style.display = 'none')}
											/>
										{/if}
										<div style="font-size: 11px; color: #7f8c8d; margin-top: 6px; font-weight: 600;">
											{image.type}
										</div>
										<div style="font-size: 10px; color: #95a5a6; margin-top: 2px;">
											{image.era || ''}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Usage Statistics -->
					{#if data.data.chinese_char?.statistics}
						{@const stats = data.data.chinese_char.statistics}
						<div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 15px; color: #2c3e50;"
							>
								📊 Usage Statistics
							</div>

							<!-- HSK Level and Ranks -->
							<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
								{#if stats.hskLevel}
									<span class="badge badge-hsk">HSK {stats.hskLevel}</span>
								{/if}
								{#if stats.movieWordRank}
									<span class="badge" style="background: #e3f2fd; color: #1976d2;"
										>Movie Rank: #{stats.movieWordRank.toLocaleString()}</span
									>
								{/if}
								{#if stats.bookWordRank}
									<span class="badge" style="background: #f3e5f5; color: #7b1fa2;"
										>Book Rank: #{stats.bookWordRank.toLocaleString()}</span
									>
								{/if}
							</div>

							<!-- Frequency Bars -->
							{#if stats.movieWordCountPercent || stats.bookWordCountPercent}
								<div style="margin-bottom: 20px;">
									<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #555;">
										Frequency
									</div>

									{#if stats.movieWordCountPercent}
										{@const moviePercent = (stats.movieWordCountPercent * 100).toFixed(4)}
										<div style="margin-bottom: 8px;">
											<div
												style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;"
											>
												<span>Movies: {stats.movieWordCount.toLocaleString()} occurrences</span>
												<span>{moviePercent}%</span>
											</div>
											<div
												style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: linear-gradient(90deg, #1976d2, #42a5f5); height: 100%; width: {Math.min(
														parseFloat(moviePercent) * 10,
														100
													)}%;"
												></div>
											</div>
										</div>
									{/if}

									{#if stats.bookWordCountPercent}
										{@const bookPercent = (stats.bookWordCountPercent * 100).toFixed(4)}
										<div style="margin-bottom: 8px;">
											<div
												style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;"
											>
												<span>Books: {stats.bookWordCount.toLocaleString()} occurrences</span>
												<span>{bookPercent}%</span>
											</div>
											<div
												style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: linear-gradient(90deg, #7b1fa2, #ba68c8); height: 100%; width: {Math.min(
														parseFloat(bookPercent) * 10,
														100
													)}%;"
												></div>
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Top Words -->
							{#if stats.topWords && stats.topWords.length > 0}
								<div style="margin-top: 20px;">
									<div style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #555;">
										Top Words Containing This Character
									</div>
									<div
										style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;"
									>
										{#each stats.topWords.slice(0, 12) as topWord}
											{@const sharePercent = (topWord.share * 100).toFixed(1)}
											<div
												style="position: relative; padding: 8px 12px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 13px; overflow: hidden;"
											>
												<!-- Background progress bar -->
												<div
													style="position: absolute; top: 0; left: 0; height: 100%; width: {topWord.share *
														100}%; background: linear-gradient(90deg, #e3f2fd, #bbdefb); opacity: 0.6; z-index: 0;"
												></div>
												<!-- Content -->
												<div style="position: relative; z-index: 1;">
													<div
														style="display: flex; justify-content: space-between; align-items: center;"
													>
														<span style="font-weight: 600; color: #2c3e50;">{topWord.word}</span>
														<span style="font-size: 11px; color: #1976d2; font-weight: 600;"
															>{sharePercent}%</span
														>
													</div>
													{#if topWord.gloss}
														<div style="font-size: 11px; color: #555; margin-top: 2px;">
															{topWord.gloss}
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chinese Words -->
		{#if data.data.chinese_words && data.data.chinese_words.length > 0}
			<div class="section">
				<div class="section-content" style="padding: 20px;">
					{#each data.data.chinese_words as word}
						{#if word.items && word.items.length > 0}
							{@const itemsWithDefs = word.items.filter(
								(item) => item.definitions && item.definitions.length > 0
							)}
							{#each itemsWithDefs as item}
								<div style="margin-bottom: 30px;">
									<!-- Character and Pinyin -->
									<div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
										<div
											style="font-size: 32px; font-family: 'MS Mincho', serif; font-weight: 600;"
										>
											{data.word}
										</div>
										{#if item.pinyin}
											<div
												style="font-size: 18px; color: #e74c3c; font-family: 'MS Mincho', serif;"
											>
												[{item.pinyin}]
											</div>
										{/if}
									</div>
									<!-- Definitions -->
									{#if item.definitions && item.definitions.length > 0}
										<div style="color: #2c3e50; line-height: 1.6;">
											{item.definitions.join('; ')}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Japanese Words -->
		{#if (data.data.japanese_words && data.data.japanese_words.length > 0) || (data.relatedJapaneseWords && data.relatedJapaneseWords.length > 0)}
			<div class="section">
				<div class="section-content" style="padding: 20px;">
					<!-- Direct Japanese Words -->
					{#each data.data.japanese_words || [] as word}
						{@const mainKanji =
							word.kanji.find((k) => k.text === data.word || k.text.includes(data.word)) ||
							word.kanji[0]}
						{@const applicableKana = word.kana && word.kana.length > 0 && mainKanji
							? word.kana.filter((kana) => {
								if (!kana.appliesToKanji) return false;
								return (
									kana.appliesToKanji.includes('*') ||
									kana.appliesToKanji.includes(mainKanji.text)
								);
							})
							: []}
						{@const applicableReadings = applicableKana.map((kana) => kana.text)}
						<div style="margin-bottom: 30px;">
							<!-- Kanji and Kana -->
							<div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
								{#if mainKanji}
									<div
										style="font-size: 32px; font-family: 'MS Mincho', serif; font-weight: 600;"
									>
										{mainKanji.text}
									</div>
								{/if}
								{#if applicableReadings.length > 0}
									<div
										style="font-size: 18px; color: #e74c3c; font-family: 'MS Mincho', serif;"
									>
										[{applicableReadings.join(', ')}]
									</div>
								{/if}
							</div>

							<!-- Pitch Accent Visualization -->
							{#if applicableKana.length > 0}
								{#each applicableKana as kana}
									{#if kana.pitchAccents && kana.pitchAccents.length > 0}
										<div style="margin-bottom: 12px;">
											<PitchAccent kana={kana.text} pitchAccents={kana.pitchAccents} />
										</div>
									{/if}
								{/each}
							{/if}

							<!-- Senses (Meanings) -->
							{#if word.sense && word.sense.length > 0}
								{@const groupedSenses = word.sense.reduce((groups, sense, idx) => {
									const posKey = sense.partOfSpeech && sense.partOfSpeech.length > 0
										? sense.partOfSpeech.join(',')
										: 'no-pos';
									if (!groups[posKey]) {
										groups[posKey] = {
											partOfSpeech: sense.partOfSpeech || [],
											senses: []
										};
									}
									groups[posKey].senses.push({ ...sense, originalIndex: idx });
									return groups;
								}, {})}

								{#each Object.entries(groupedSenses) as [posKey, group]}
									<div style="margin-bottom: 20px;">
										{#if group.partOfSpeech.length > 0}
											<p style="margin: 1px 0 0.5rem 0;">
												{#each group.partOfSpeech as pos}
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(pos)}
													</span>
												{/each}
											</p>
										{/if}

										{#each group.senses as sense}
											{@const glossTexts = sense.gloss
												? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
												: []}
											{#if glossTexts.length > 0}
												<div style="margin-bottom: 8px; margin-left: 0px;">
													<span style="font-weight: 600; margin-right: 8px;">{sense.originalIndex + 1}.</span>
													{#if sense.misc && sense.misc.length > 0}
														{#each sense.misc as misc}
															<span
																class="pos-tag"
																style="display: inline-block; margin-right: 6px; background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 3px; font-size: 11px;"
																>{getMiscLabel(misc)}</span
															>
														{/each}
													{/if}
													<span style="color: #2c3e50;">{glossTexts.join('; ')}</span>
												</div>
											{/if}
										{/each}
									</div>
								{/each}
							{/if}

							<!-- Other Forms -->
							{#if word.kanji && word.kanji.length > 1}
								{@const otherKanji = word.kanji.filter((k) => k.text !== mainKanji?.text)}
								{#if otherKanji.length > 0}
									{@const otherFormsText = otherKanji
										.map((k) => {
											const applicableReadings = word.kana
												? word.kana
														.filter((kana) => {
															if (!kana.appliesToKanji) return false;
															return (
																kana.appliesToKanji.includes('*') ||
																kana.appliesToKanji.includes(k.text)
															);
														})
														.map((kana) => kana.text)
												: [];
											const kanjiPart =
												k.text === data.word || k.text.includes(data.word)
													? `<strong>${k.text}</strong>`
													: k.text;
											if (applicableReadings.length > 0) {
												return `${kanjiPart} [${applicableReadings.join(', ')}]`;
											}
											return kanjiPart;
										})
										.join('; ')}
									<div style="margin-top: 20px;">
										<div
											style="font-weight: 600; color: #7f8c8d; margin-bottom: 8px; font-size: 13px;"
										>
											Other forms
										</div>
										<div
											style="font-size: 16px; font-family: 'MS Mincho', serif; line-height: 1.8;"
										>
											{@html otherFormsText}
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/each}

				<!-- Related Japanese Words -->
				{#each data.relatedJapaneseWords || [] as { word, sourceKey }}
						{@const matchingKanji = word.kanji.filter(
							(k) => k.text === data.word || k.text.includes(data.word)
						)}
						{#if matchingKanji.length > 0}
							{@const mainKanji = matchingKanji[0]}
							{@const applicableKana = word.kana && word.kana.length > 0 && mainKanji
								? word.kana
										.filter((kana) => {
											if (!kana.appliesToKanji) return false;
											return (
												kana.appliesToKanji.includes('*') ||
												kana.appliesToKanji.includes(mainKanji.text)
											);
										})
								: []}
							{@const applicableReadings = applicableKana.map((kana) => kana.text)}
						<div style="margin-bottom: 30px;">
							<!-- Kanji and Kana -->
							<div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px;">
								{#if mainKanji}
									<div
										style="font-size: 32px; font-family: 'MS Mincho', serif; font-weight: 600;"
									>
										{mainKanji.text}
									</div>
								{/if}
								{#if applicableReadings.length > 0}
									<div
										style="font-size: 18px; color: #e74c3c; font-family: 'MS Mincho', serif;"
									>
										[{applicableReadings.join(', ')}]
									</div>
								{/if}
							</div>

							<!-- Pitch Accent Visualization -->
							{#if applicableKana.length > 0}
								{#each applicableKana as kana}
									{#if kana.pitchAccents && kana.pitchAccents.length > 0}
										<div style="margin-bottom: 12px;">
											<PitchAccent kana={kana.text} pitchAccents={kana.pitchAccents} />
										</div>
									{/if}
								{/each}
							{/if}

							<!-- Senses (Meanings) -->
							{#if word.sense && word.sense.length > 0}
								{@const groupedSenses = word.sense.reduce((groups, sense, idx) => {
									const posKey = sense.partOfSpeech && sense.partOfSpeech.length > 0
										? sense.partOfSpeech.join(',')
										: 'no-pos';
									if (!groups[posKey]) {
										groups[posKey] = {
											partOfSpeech: sense.partOfSpeech || [],
											senses: []
										};
									}
									groups[posKey].senses.push({ ...sense, originalIndex: idx });
									return groups;
								}, {})}

								{#each Object.entries(groupedSenses) as [posKey, group]}
									<div style="margin-bottom: 20px;">
										{#if group.partOfSpeech.length > 0}
											<p style="margin: 1px 0 0.5rem 0;">
												{#each group.partOfSpeech as pos}
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(pos)}
													</span>
												{/each}
											</p>
										{/if}

										{#each group.senses as sense}
											{@const glossTexts = sense.gloss
												? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
												: []}
											{#if glossTexts.length > 0}
												<div style="margin-bottom: 8px; margin-left: 0px;">
													<span style="font-weight: 600; margin-right: 8px;">{sense.originalIndex + 1}.</span>
													{#if sense.misc && sense.misc.length > 0}
														{#each sense.misc as misc}
															<span
																class="pos-tag"
																style="display: inline-block; margin-right: 6px; background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 3px; font-size: 11px;"
																>{getMiscLabel(misc)}</span
															>
														{/each}
													{/if}
													<span style="color: #2c3e50;">{glossTexts.join('; ')}</span>
												</div>
											{/if}
										{/each}
									</div>
								{/each}
							{/if}

							<!-- Other Forms -->
							{#if word.kanji && word.kanji.length > 1}
								{@const otherKanji = word.kanji.filter((k) => k.text !== mainKanji?.text)}
								{#if otherKanji.length > 0}
									{@const otherFormsText = otherKanji
										.map((k) => {
											const applicableReadings = word.kana
												? word.kana
														.filter((kana) => {
															if (!kana.appliesToKanji) return false;
															return (
																kana.appliesToKanji.includes('*') ||
																kana.appliesToKanji.includes(k.text)
															);
														})
														.map((kana) => kana.text)
												: [];
											const kanjiPart =
												k.text === data.word || k.text.includes(data.word)
													? `<strong>${k.text}</strong>`
													: k.text;
											if (applicableReadings.length > 0) {
												return `${kanjiPart} [${applicableReadings.join(', ')}]`;
											}
											return kanjiPart;
										})
										.join('; ')}
									<div style="margin-top: 20px;">
										<div
											style="font-weight: 600; color: #7f8c8d; margin-bottom: 8px; font-size: 13px;"
										>
											Other forms
										</div>
										<div
											style="font-size: 16px; font-family: 'MS Mincho', serif; line-height: 1.8;"
										>
											{@html otherFormsText}
										</div>
									</div>
								{/if}
							{/if}
						</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		line-height: 1.6;
		color: #333;
		background: #f8f9fa;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	.header {
		text-align: center;
		margin-bottom: 40px;
		background: white;
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.search-box {
		width: 100%;
		max-width: 400px;
		padding: 15px 25px;
		border: 2px solid #e9ecef;
		border-radius: 30px;
		font-size: 18px;
		margin: 0 auto;
		display: block;
		text-align: center;
		font-family: 'SimSun', 'MS Mincho', serif;
	}

	.search-box:focus {
		outline: none;
		border-color: #3498db;
		box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
	}

	.section {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		margin-bottom: 30px;
		overflow: hidden;
	}

	.section-content {
		padding: 30px;
	}

	.pos-tag {
		display: inline-block;
		background: #e9ecef;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		color: #6c757d;
		margin-right: 8px;
	}

	.misc-tag {
		display: inline-block;
		background: #fff3cd;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		color: #856404;
		margin-right: 8px;
	}

	.badge {
		padding: 6px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-hsk {
		background: #3498db;
		color: white;
	}
</style>

