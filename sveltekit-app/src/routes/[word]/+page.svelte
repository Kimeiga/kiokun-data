<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';
	import PitchAccent from '$lib/PitchAccent.svelte';
	import Contains from '$lib/Contains.svelte';
	import AppearsIn from '$lib/AppearsIn.svelte';

	let { data }: { data: PageData } = $props();

	// Initialize Hanzi Writer for stroke animation
	onMount(async () => {
		if (data.data.chinese_char && typeof window !== 'undefined') {
			// Dynamically import Hanzi Writer
			const HanziWriter = (await import('hanzi-writer')).default;

			const target = document.getElementById('hanzi-writer-target');
			if (target) {
				const writer = HanziWriter.create(target, data.word, {
					width: 72,
					height: 72,
					padding: 5,
					showOutline: true,
					strokeAnimationSpeed: 3, // 3x speed = ~0.33 seconds per stroke
					delayBetweenStrokes: 200, // 0.2 seconds between strokes
					delayBetweenLoops: 1000, // 0.5s fade + 0.5s pause = 1 second
					strokeColor: getComputedStyle(document.documentElement).getPropertyValue('--color-stroke').trim() || '#2c3e50',
					outlineColor: getComputedStyle(document.documentElement).getPropertyValue('--color-outline').trim() || '#e0e0e0',
					drawingColor: getComputedStyle(document.documentElement).getPropertyValue('--color-stroke').trim() || '#2c3e50',
					strokeFadeDuration: 500 // 0.5 seconds to fade out all strokes
				});

				// Loop the animation
				writer.loopCharacterAnimation();
			}
		}
	});

	function getPartOfSpeechLabel(pos: string): string {
		if (!data.labels?.partOfSpeech) return pos;
		return data.labels.partOfSpeech[pos] || pos;
	}

	function getMiscLabel(misc: string): string {
		if (!data.labels?.misc) return misc;
		return data.labels.misc[misc] || misc;
	}

	function getKanjiTagLabel(tag: string): string {
		if (!data.labels?.tag) return tag;
		return data.labels.tag[tag] || tag;
	}
</script>

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
</svelte:head>

<Header currentWord={data.word} />

<div class="container">
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

							<!-- Hanzi Writer Animation (same size as character) -->
							{#if data.data.chinese_char}
								<div
									id="hanzi-writer-target"
									style="width: 72px; height: 72px;"
								></div>
							{/if}

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
											<span style="font-size: 18px; color: var(--color-pinyin); font-weight: 600;">
												{filteredPinyins.map((pf) => pf.pinyin).join(', ')}
											</span>
										</div>
									{/if}
								{/if}

								<!-- Japanese Readings -->
								{#if data.data.japanese_char?.readingMeaning?.readings}
									{@const onyomi =
										data.data.japanese_char.readingMeaning.readings?.filter((r) => r.type === 'ja_on').map((r) => r.value) || []}
									{@const kunyomi =
										data.data.japanese_char.readingMeaning.readings?.filter((r) => r.type === 'ja_kun').map((r) => r.value) || []}
									<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
										<div>
											<span style="font-size: 14px;">🇯🇵</span>
											{#if onyomi.length > 0}
												<span
													style="font-size: 18px; color: var(--color-onyomi); font-family: 'MS Mincho', serif;"
												>
													{onyomi.join('、')}
												</span>
											{/if}
											{#if kunyomi.length > 0}
												{#if onyomi.length > 0}
													<span style="color: var(--color-separator);">|</span>
												{/if}
												<span
													style="font-size: 18px; color: var(--color-kunyomi); font-family: 'MS Mincho', serif;"
												>
													{kunyomi.join('、')}
												</span>
											{/if}
										</div>
										{#if data.data.chinese_char?.gloss}
											<div style="font-size: 20px; color: var(--color-gloss); font-weight: 600;">
												{data.data.chinese_char.gloss}
											</div>
										{/if}
									</div>
								{:else if data.data.chinese_char?.gloss}
									<div style="font-size: 20px; color: var(--color-gloss); font-weight: 600;">
										{data.data.chinese_char.gloss}
									</div>
								{/if}
							</div>
						</div>

						<!-- Mnemonic Hint -->
						{#if data.data.chinese_char?.hint}
							<div
								style="margin-top: 12px; padding: 10px; background: var(--color-hint-bg); border-left: 4px solid var(--color-hint-border); border-radius: 4px;"
							>
								<div style="font-size: 13px; color: var(--color-hint-text); line-height: 1.6;">
									💡 {data.data.chinese_char.hint}
								</div>
							</div>
						{/if}
					</div>

					<!-- Components -->
					{#if data.data.chinese_char?.components && data.data.chinese_char.components.length > 0}
						{@const makemeahanziImage = data.data.chinese_char.images?.find(
							(img) => img.source === 'makemeahanzi' && img.data
						)}
						<div style="margin-bottom: 20px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--color-heading);"
							>
								🧩 Components
							</div>
							<div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start;">
								{#each data.data.chinese_char.components as comp, compIndex}
									{@const char = typeof comp === 'string' ? comp : comp.character || comp.char || comp}
									{@const types = comp.componentType || comp.type || []}
									{@const isMeaning = types.includes('meaning')}
									{@const isPhonetic = types.includes('phonetic')}
									{@const highlightColor = isMeaning
										? '#27ae60'
										: isPhonetic
											? '#e74c3c'
											: '#95a5a6'}
									<div
										style="text-align: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; border: 2px solid {highlightColor};"
									>
										{#if makemeahanziImage?.data?.strokes}
											{@const totalStrokes = makemeahanziImage.data.strokes.length}
											{@const numComponents = data.data.chinese_char.components.length}
											{@const strokesPerComponent = Math.ceil(totalStrokes / numComponents)}
											{@const startStroke = compIndex * strokesPerComponent}
											{@const endStroke = Math.min((compIndex + 1) * strokesPerComponent, totalStrokes)}
											<!-- SVG with highlighted strokes for this component -->
											<svg
												width="80"
												height="80"
												viewBox="0 0 1024 1024"
												style="border: 1px solid #e0e0e0; margin-bottom: 8px;"
											>
												<g transform="scale(1, -1) translate(0, -900)">
													{#each makemeahanziImage.data.strokes as stroke, strokeIndex}
														{@const isHighlighted = strokeIndex >= startStroke && strokeIndex < endStroke}
														<path
															d={stroke}
															fill={isHighlighted ? highlightColor : '#d0d0d0'}
															stroke={isHighlighted ? highlightColor : '#d0d0d0'}
															stroke-width={isHighlighted ? '12' : '8'}
														/>
													{/each}
												</g>
											</svg>
										{:else}
											<!-- Fallback: just show the character -->
											<div
												style="font-size: 32px; font-family: 'MS Mincho', serif; line-height: 1; margin-bottom: 8px;"
											>
												{char}
											</div>
										{/if}
										<div
											style="font-size: 16px; font-weight: 600; font-family: 'MS Mincho', serif;"
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
								style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--color-heading);"
							>
								🏛️ Historical Evolution
							</div>
							<div style="display: flex; gap: 12px; overflow-x: auto; padding: 10px 0;">
								{#each data.data.chinese_char.images as image}
									{#if image.source === 'makemeahanzi' && image.data}
										<!-- MakeMeAHanzi: Show complete character -->
										<div
											style="flex-shrink: 0; text-align: center; padding: 10px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-light);"
										>
											<svg
												width="80"
												height="80"
												viewBox="0 0 1024 1024"
												style="border: 1px solid #e0e0e0;"
											>
												<g transform="scale(1, -1) translate(0, -900)">
													{#each image.data.strokes as stroke}
														<path
															d={stroke}
															fill="#2c3e50"
															stroke="#2c3e50"
															stroke-width="8"
														/>
													{/each}
												</g>
											</svg>
											<div style="font-size: 11px; color: #7f8c8d; margin-top: 6px; font-weight: 600;">
												{image.type}
											</div>
											<div style="font-size: 10px; color: #95a5a6; margin-top: 2px;">
												{image.era || ''}
											</div>
										</div>
									{:else if image.path}
										<!-- Historical images from Academia Sinica (hosted on Dong Chinese) -->
										<div
											style="flex-shrink: 0; text-align: center; padding: 10px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-light);"
										>
											<img
												src="https://data.dong-chinese.com/img/sinica/{image.path}"
												alt="{image.type} {image.era}"
												style="width: 80px; height: 80px; object-fit: contain;"
												onerror={(e) => {
													e.currentTarget.parentElement.style.display = 'none';
												}}
											/>
											<div style="font-size: 11px; color: #7f8c8d; margin-top: 6px; font-weight: 600;">
												{image.type}
											</div>
											<div style="font-size: 10px; color: #95a5a6; margin-top: 2px;">
												{image.era || ''}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<!-- Usage Statistics -->
					{#if data.data.chinese_char?.statistics}
						{@const stats = data.data.chinese_char.statistics}
						<div style="margin-top: 20px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 15px; color: var(--color-heading);"
							>
								📊 Usage Statistics
							</div>

							<!-- HSK Level and Ranks -->
							<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
								{#if stats.hskLevel}
									<span class="badge badge-hsk">HSK {stats.hskLevel}</span>
								{/if}
								{#if stats.movieWordRank}
									<span class="badge" style="background: var(--badge-movie-bg); color: var(--badge-movie-text);"
										>Movie Rank: #{stats.movieWordRank.toLocaleString()}</span
									>
								{/if}
								{#if stats.bookWordRank}
									<span class="badge" style="background: var(--badge-book-bg); color: var(--badge-book-text);"
										>Book Rank: #{stats.bookWordRank.toLocaleString()}</span
									>
								{/if}
							</div>

							<!-- Frequency Bars -->
							{#if stats.movieWordCountPercent || stats.bookWordCountPercent}
								<div style="margin-bottom: 20px;">
									<div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-tertiary);">
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
												style="background: var(--progress-bg); height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: var(--progress-movie); height: 100%; width: {Math.min(
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
												style="background: var(--progress-bg); height: 8px; border-radius: 4px; overflow: hidden;"
											>
												<div
													style="background: var(--progress-book); height: 100%; width: {Math.min(
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
									<div style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--text-tertiary);">
										Top Words Containing This Character
									</div>
									<div
										style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;"
									>
										{#each stats.topWords.slice(0, 12) as topWord}
											{@const sharePercent = (topWord.share * 100).toFixed(1)}
											<div
												style="position: relative; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; font-size: 13px; overflow: hidden;"
											>
												<!-- Background progress bar -->
												<div
													style="position: absolute; top: 0; left: 0; height: 100%; width: {topWord.share *
														100}%; background: var(--progress-word-bg); opacity: 0.6; z-index: 0;"
												></div>
												<!-- Content -->
												<div style="position: relative; z-index: 1;">
													<div
														style="display: flex; justify-content: space-between; align-items: center;"
													>
														<span style="font-weight: 600; color: var(--color-heading);">{topWord.word}</span>
														<span style="font-size: 11px; color: var(--badge-movie-text); font-weight: 600;"
															>{sharePercent}%</span
														>
													</div>
													{#if topWord.gloss}
														<div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">
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

		<!-- Word Definitions Container (Two Columns on Desktop) -->
		<div class="word-definitions-container">
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
												style="font-size: 18px; color: var(--color-onyomi); font-family: 'MS Mincho', serif;"
											>
												[{item.pinyin}]
											</div>
										{/if}
									</div>
									<!-- Definitions -->
									{#if item.definitions && item.definitions.length > 0}
										<div style="color: var(--text-primary); line-height: 1.6;">
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
								{#if applicableKana.length > 0}
									<div
										style="font-size: 18px; color: var(--color-onyomi); font-family: 'MS Mincho', serif; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"
									>
										<span>[</span>
										{#each applicableKana as kana, index}
											{#if kana.pitchAccents && kana.pitchAccents.length > 0}
												<PitchAccent kana={kana.text} pitchAccents={kana.pitchAccents} />
											{:else}
												<span>{kana.text}</span>
											{/if}
											{#if index < applicableKana.length - 1}<span>, </span>{/if}
										{/each}
										<span>]</span>
									</div>
								{/if}
							</div>



							<!-- Senses (Meanings) -->
							{#if word.sense && word.sense.length > 0}
								{@const groupedSenses = word.sense.reduce((groups, sense, idx) => {
									// Group by primary (first) part-of-speech only
									const primaryPos = sense.partOfSpeech && sense.partOfSpeech.length > 0
										? sense.partOfSpeech[0]
										: 'no-pos';
									if (!groups[primaryPos]) {
										groups[primaryPos] = {
											primaryPartOfSpeech: primaryPos,
											senses: []
										};
									}
									groups[primaryPos].senses.push({
										...sense,
										originalIndex: idx,
										additionalPartOfSpeech: sense.partOfSpeech && sense.partOfSpeech.length > 1
											? sense.partOfSpeech.slice(1)
											: []
									});
									return groups;
								}, {})}

								{#if word.sense.length === 1}
									<!-- Single definition: inline tags, no numbering -->
									{@const sense = word.sense[0]}
									{@const glossTexts = sense.gloss
										? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
										: []}
									{#if glossTexts.length > 0}
										<div style="margin-bottom: 8px; margin-left: 0px;">
											{#if sense.partOfSpeech && sense.partOfSpeech.length > 0}
												{#each sense.partOfSpeech as pos}
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(pos)}
													</span>
												{/each}
											{/if}
											{#if sense.misc && sense.misc.length > 0}
												{#each sense.misc as misc}
													<span
														class="pos-tag"
														style="display: inline-block; margin-right: 6px; background: var(--tag-inline-bg); color: var(--tag-inline-text); padding: 2px 8px; border-radius: 3px; font-size: 11px;"
														>{getMiscLabel(misc)}</span
													>
												{/each}
											{/if}
											<span style="color: var(--text-primary);">{glossTexts.join('; ')}</span>
										</div>
									{/if}
								{:else}
									<!-- Multiple definitions: grouped with numbering -->
									{#each Object.entries(groupedSenses) as [posKey, group]}
										<div style="margin-bottom: 20px;">
											{#if group.primaryPartOfSpeech !== 'no-pos'}
												<p style="margin: 1px 0 0.5rem 0;">
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(group.primaryPartOfSpeech)}
													</span>
												</p>
											{/if}

											{#each group.senses as sense}
												{@const glossTexts = sense.gloss
													? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
													: []}
												{#if glossTexts.length > 0}
													<div style="margin-bottom: 8px; margin-left: 0px;">
														<span style="font-weight: 600; margin-right: 8px;">{sense.originalIndex + 1}.</span>
														{#if sense.additionalPartOfSpeech && sense.additionalPartOfSpeech.length > 0}
															{#each sense.additionalPartOfSpeech as pos}
																<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
																	{getPartOfSpeechLabel(pos)}
																</span>
															{/each}
														{/if}
														{#if sense.misc && sense.misc.length > 0}
															{#each sense.misc as misc}
																<span
																	class="pos-tag"
																	style="display: inline-block; margin-right: 6px; background: var(--tag-inline-bg); color: var(--tag-inline-text); padding: 2px 8px; border-radius: 3px; font-size: 11px;"
																	>{getMiscLabel(misc)}</span
																>
															{/each}
														{/if}
														<span style="color: var(--text-primary);">{glossTexts.join('; ')}</span>
													</div>
												{/if}
											{/each}
										</div>
									{/each}
								{/if}
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

											// Add kanji tags if present
											const kanjiTags = k.tags && k.tags.length > 0
												? k.tags.map(tag => {
													const label = getKanjiTagLabel(tag);
													return `<span style="font-size: 12px; color: #666; font-weight: normal;">(${label})</span>`;
												}).join(' ')
												: '';

											const kanjiWithTags = kanjiTags ? `${kanjiPart} ${kanjiTags}` : kanjiPart;

											if (applicableReadings.length > 0) {
												return `${kanjiWithTags} [${applicableReadings.join(', ')}]`;
											}
											return kanjiWithTags;
										})
										.join('; ')}
									<div style="margin-top: 20px;">
										<div
											style="font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; font-size: 13px;"
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
								{#if applicableKana.length > 0}
									<div
										style="font-size: 18px; color: var(--color-onyomi); font-family: 'MS Mincho', serif; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"
									>
										<span>[</span>
										{#each applicableKana as kana, index}
											{#if kana.pitchAccents && kana.pitchAccents.length > 0}
												<PitchAccent kana={kana.text} pitchAccents={kana.pitchAccents} />
											{:else}
												<span>{kana.text}</span>
											{/if}
											{#if index < applicableKana.length - 1}<span>, </span>{/if}
										{/each}
										<span>]</span>
									</div>
								{/if}
							</div>



							<!-- Senses (Meanings) -->
							{#if word.sense && word.sense.length > 0}
								{@const groupedSenses = word.sense.reduce((groups, sense, idx) => {
									// Group by primary (first) part-of-speech only
									const primaryPos = sense.partOfSpeech && sense.partOfSpeech.length > 0
										? sense.partOfSpeech[0]
										: 'no-pos';
									if (!groups[primaryPos]) {
										groups[primaryPos] = {
											primaryPartOfSpeech: primaryPos,
											senses: []
										};
									}
									groups[primaryPos].senses.push({
										...sense,
										originalIndex: idx,
										additionalPartOfSpeech: sense.partOfSpeech && sense.partOfSpeech.length > 1
											? sense.partOfSpeech.slice(1)
											: []
									});
									return groups;
								}, {})}

								{#if word.sense.length === 1}
									<!-- Single definition: inline tags, no numbering -->
									{@const sense = word.sense[0]}
									{@const glossTexts = sense.gloss
										? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
										: []}
									{#if glossTexts.length > 0}
										<div style="margin-bottom: 8px; margin-left: 0px;">
											{#if sense.partOfSpeech && sense.partOfSpeech.length > 0}
												{#each sense.partOfSpeech as pos}
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(pos)}
													</span>
												{/each}
											{/if}
											{#if sense.misc && sense.misc.length > 0}
												{#each sense.misc as misc}
													<span
														class="pos-tag"
														style="display: inline-block; margin-right: 6px; background: var(--tag-inline-bg); color: var(--tag-inline-text); padding: 2px 8px; border-radius: 3px; font-size: 11px;"
														>{getMiscLabel(misc)}</span
													>
												{/each}
											{/if}
											<span style="color: var(--text-primary);">{glossTexts.join('; ')}</span>
										</div>
									{/if}
								{:else}
									<!-- Multiple definitions: grouped with numbering -->
									{#each Object.entries(groupedSenses) as [posKey, group]}
										<div style="margin-bottom: 20px;">
											{#if group.primaryPartOfSpeech !== 'no-pos'}
												<p style="margin: 1px 0 0.5rem 0;">
													<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
														{getPartOfSpeechLabel(group.primaryPartOfSpeech)}
													</span>
												</p>
											{/if}

											{#each group.senses as sense}
												{@const glossTexts = sense.gloss
													? sense.gloss.map((g) => (typeof g === 'string' ? g : g.text || g.value || ''))
													: []}
												{#if glossTexts.length > 0}
													<div style="margin-bottom: 8px; margin-left: 0px;">
														<span style="font-weight: 600; margin-right: 8px;">{sense.originalIndex + 1}.</span>
														{#if sense.additionalPartOfSpeech && sense.additionalPartOfSpeech.length > 0}
															{#each sense.additionalPartOfSpeech as pos}
																<span class="pos-tag" style="display: inline-block; margin-right: 6px; margin-bottom: 8px;">
																	{getPartOfSpeechLabel(pos)}
																</span>
															{/each}
														{/if}
														{#if sense.misc && sense.misc.length > 0}
															{#each sense.misc as misc}
																<span
																	class="pos-tag"
																	style="display: inline-block; margin-right: 6px; background: var(--tag-inline-bg); color: var(--tag-inline-text); padding: 2px 8px; border-radius: 3px; font-size: 11px;"
																	>{getMiscLabel(misc)}</span
																>
															{/each}
														{/if}
														<span style="color: var(--text-primary);">{glossTexts.join('; ')}</span>
													</div>
												{/if}
											{/each}
										</div>
									{/each}
								{/if}
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

											// Add kanji tags if present
											const kanjiTags = k.tags && k.tags.length > 0
												? k.tags.map(tag => {
													const label = getKanjiTagLabel(tag);
													return `<span style="font-size: 12px; color: #666; font-weight: normal;">(${label})</span>`;
												}).join(' ')
												: '';

											const kanjiWithTags = kanjiTags ? `${kanjiPart} ${kanjiTags}` : kanjiPart;

											if (applicableReadings.length > 0) {
												return `${kanjiWithTags} [${applicableReadings.join(', ')}]`;
											}
											return kanjiWithTags;
										})
										.join('; ')}
									<div style="margin-top: 20px;">
										<div
											style="font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; font-size: 13px;"
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
		<!-- End Word Definitions Container -->

		<!-- Contains Section (for multi-character words) -->
		<Contains words={data.data.contains || []} />

		<!-- Appears In Section -->
		<AppearsIn
			chineseWords={data.data.contained_in_chinese || []}
			japaneseWords={data.data.contained_in_japanese || []}
		/>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	.word-definitions-container {
		display: grid;
		grid-template-columns: 1fr;
		gap: 30px;
		margin-bottom: 30px;
	}

	/* Two columns on desktop */
	@media (min-width: 768px) {
		.word-definitions-container {
			grid-template-columns: 1fr 1fr;
		}
	}

	.section {
		background: var(--bg-secondary);
		border-radius: 12px;
		box-shadow: 0 2px 10px var(--shadow);
		margin-bottom: 0;
		overflow: hidden;
		transition: background-color 0.3s ease, box-shadow 0.3s ease;
	}

	.section-content {
		padding: 30px;
	}

	.pos-tag {
		display: inline-block;
		background: var(--tag-pos-bg);
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--tag-pos-text);
		margin-right: 8px;
		transition: background-color 0.3s ease, color 0.3s ease;
	}

	.badge {
		padding: 6px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-hsk {
		background: var(--badge-hsk-bg);
		color: var(--badge-hsk-text);
		transition: background-color 0.3s ease, color 0.3s ease;
	}
</style>

