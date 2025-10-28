<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import Header from '$lib/components/Header.svelte';
	import PitchAccent from '$lib/PitchAccent.svelte';
	import Contains from '$lib/Contains.svelte';
	import AppearsIn from '$lib/AppearsIn.svelte';
	import JapaneseNames from '$lib/components/JapaneseNames.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import { getDictionaryUrl } from '$lib/shard-utils';
	import { dev } from '$app/environment';

	let { data }: { data: PageData } = $props();

	// Get all character variants
	const traditionalChar = data.data.chinese_char?.char || data.word;
	const simplifiedChar = data.data.chinese_char?.simpVariants?.[0];
	const japaneseChar = data.data.japanese_char?.literal;

	// State for simplified character data
	let simplifiedCharData: any = $state(null);

	// Initialize Hanzi Writer for stroke animations
	onMount(async () => {
		if (typeof window !== 'undefined') {
			// Dynamically import Hanzi Writer
			const HanziWriter = (await import('hanzi-writer')).default;

			const strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--color-stroke').trim() || '#2c3e50';
			const outlineColor = getComputedStyle(document.documentElement).getPropertyValue('--color-outline').trim() || '#e0e0e0';

			const writerConfig = {
				width: 72,
				height: 72,
				padding: 5,
				showOutline: true,
				strokeAnimationSpeed: 3,
				delayBetweenStrokes: 200,
				delayBetweenLoops: 1000,
				strokeColor,
				outlineColor,
				drawingColor: strokeColor,
				strokeFadeDuration: 500
			};

			// Traditional character animation
			if (traditionalChar) {
				const tradTarget = document.getElementById('trad-writer-target');
				if (tradTarget) {
					const writer = HanziWriter.create(tradTarget, traditionalChar, writerConfig);
					writer.loopCharacterAnimation();
				}
			}

			// Simplified character animation
			if (simplifiedChar) {
				const simpTarget = document.getElementById('simp-writer-target');
				if (simpTarget) {
					const writer = HanziWriter.create(simpTarget, simplifiedChar, writerConfig);
					writer.loopCharacterAnimation();
				}

				// Load simplified character data for component breakdown
				try {
					const url = getDictionaryUrl(simplifiedChar, dev);
					const response = await fetch(url);
					if (response.ok) {
						const arrayBuffer = await response.arrayBuffer();
						const { inflateSync } = await import('fflate');
						const decompressed = inflateSync(new Uint8Array(arrayBuffer));
						const jsonData = JSON.parse(new TextDecoder().decode(decompressed));
						console.log('[SIMP CHAR] Full JSON data:', jsonData);
						simplifiedCharData = jsonData.chinese_char;
						console.log('[SIMP CHAR] Loaded data for', simplifiedChar, simplifiedCharData);
					} else {
						console.error(`Failed to load char data for ${simplifiedChar}: ${response.status}`);
					}
				} catch (e) {
					console.error(`Failed to load char data for ${simplifiedChar}`, e);
				}
			}

			// Japanese character animation (try Hanzi Writer first, fallback to note if not available)
			if (japaneseChar) {
				const jpTarget = document.getElementById('jp-writer-target');
				if (jpTarget) {
					try {
						const writer = HanziWriter.create(jpTarget, japaneseChar, writerConfig);
						writer.loopCharacterAnimation();
					} catch (e) {
						// If Hanzi Writer doesn't have this character, show a note
						jpTarget.innerHTML = '<div style="font-size: 10px; color: #999; text-align: center; padding: 20px;">No stroke data</div>';
					}
				}
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

{#if typeof window !== 'undefined'}
	{console.log('[PAGE] Rendering page for:', data.word)}
{/if}

<svelte:head>
	<title>{data.word} - Kiokun Dictionary</title>
</svelte:head>

<Header currentWord={data.word} />

<div class="max-w-6xl mx-auto px-3 py-4 md:px-5 md:py-5">
	<div id="content">
		<!-- Character Header -->
		{#if data.data.chinese_char || data.data.japanese_char}
			<div class="bg-primary-secondary rounded-xl shadow overflow-hidden transition-all duration-300 mb-0">
				<div class="p-4 md:p-6 lg:p-8">
					<!-- Character Variants Display -->
					<div class="mb-5">
						<div class="flex items-start gap-6 md:gap-8 mb-4 flex-wrap">
							<!-- Traditional Chinese Character -->
							{#if traditionalChar}
								<div class="flex flex-col items-center gap-2">
									<div class="text-5xl md:text-6xl font-bold font-cjk leading-none">
										{traditionalChar}
									</div>
									<div class="text-sm">🇹🇼</div>
									<div
										id="trad-writer-target"
										class="w-[72px] h-[72px]"
									></div>
								</div>
							{/if}

							<!-- Simplified Chinese Character -->
							{#if simplifiedChar}
								<div class="flex flex-col items-center gap-2">
									<div class="text-5xl md:text-6xl font-bold font-cjk leading-none">
										{simplifiedChar}
									</div>
									<div class="text-sm">🇨🇳</div>
									<div
										id="simp-writer-target"
										class="w-[72px] h-[72px]"
									></div>
								</div>
							{/if}

							<!-- Japanese Character -->
							{#if japaneseChar}
								<div class="flex flex-col items-center gap-2">
									<div class="text-5xl md:text-6xl font-bold font-cjk leading-none">
										{japaneseChar}
									</div>
									<div class="text-sm">🇯🇵</div>
									<div
										id="jp-writer-target"
										class="w-[72px] h-[72px]"
									></div>
								</div>
							{/if}
						</div>

						<!-- Pronunciations and Gloss -->
						<div class="flex flex-col gap-3 mb-4">
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
									<div class="flex items-center gap-2">
										<span class="text-sm">🇨🇳</span>
										<span class="text-base md:text-lg text-pinyin font-semibold">
											{filteredPinyins.map((pf) => pf.pinyin).join(', ')}
										</span>
									</div>
								{/if}
							{/if}

							<!-- Japanese Readings -->
							{#if data.data.japanese_char?.readingMeaning}
								{@const allReadings = data.data.japanese_char.readingMeaning.groups?.[0]?.readings ||
								                       data.data.japanese_char.readingMeaning.readings || []}
								{@const onyomi = allReadings.filter((r) => r.type === 'ja_on').map((r) => r.value)}
								{@const kunyomi = allReadings.filter((r) => r.type === 'ja_kun').map((r) => r.value)}
								{#if onyomi.length > 0 || kunyomi.length > 0}
									<div class="flex items-center gap-2">
										<span class="text-sm">🇯🇵</span>
										{#if onyomi.length > 0}
											<span class="text-base md:text-lg text-onyomi font-cjk">
												{onyomi.join('、')}
											</span>
										{/if}
										{#if kunyomi.length > 0}
											{#if onyomi.length > 0}
												<span class="text-[var(--color-separator)]">|</span>
											{/if}
											<span class="text-base md:text-lg text-kunyomi font-cjk">
												{kunyomi.join('、')}
											</span>
										{/if}
									</div>
								{/if}
							{/if}

							<!-- English Gloss -->
							{#if data.data.chinese_char?.gloss}
								<div class="text-lg md:text-xl text-gloss font-semibold">
									{data.data.chinese_char.gloss}
								</div>
							{/if}
						</div>

						<!-- Mnemonic Hint -->
						{#if data.data.chinese_char?.hint}
							<div class="mt-3 p-2.5 rounded border-l-4" style="background: var(--color-hint-bg); border-left-color: var(--color-hint-border);">
								<div class="text-sm leading-relaxed" style="color: var(--color-hint-text);">
									💡 {data.data.chinese_char.hint}
								</div>
							</div>
						{/if}

						<!-- Comments (from Academia Sinica, etc.) -->
						{#if data.data.chinese_char?.comments && data.data.chinese_char.comments.length > 0}
							<div class="mt-3">
								{#each data.data.chinese_char.comments as comment}
									{#if comment && comment.source && comment.comment}
										<div class="p-2.5 rounded border-l-4 mb-2" style="background: var(--bg-tertiary); border-left-color: var(--border-light);">
											<div class="text-xs text-tertiary font-semibold mb-1">
												{comment.source}
											</div>
											<div class="text-sm leading-relaxed" style="color: var(--text-secondary);">
												{comment.comment}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					<!-- Components Section -->
					{#if data.data.chinese_char?.components && data.data.chinese_char.components.length > 0}
						{@const makemeahanziImage = data.data.chinese_char.images?.find(
							(img) => img && img.source === 'makemeahanzi' && img.data
						)}
						<div style="margin-bottom: 20px;">
							<div
								style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--color-heading);"
							>
								🧩 Components
							</div>

							<!-- Traditional Character Components -->
							<div style="margin-bottom: 20px;">
								<div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--text-secondary);">
									Traditional (🇹🇼 {traditionalChar})
								</div>
								<div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start;">
									{#each data.data.chinese_char.components as comp, compIndex}
										{@const char = typeof comp === 'string' ? comp : comp.character || comp.char || comp}
										{@const types = comp.componentType || comp.type || []}
										{@const hint = comp.hint}
										{@const isMeaning = types.includes('meaning')}
										{@const isPhonetic = types.includes('phonetic')}
										{@const isIconic = types.includes('iconic')}
										{@const highlightColor = isMeaning
											? '#27ae60'
											: isPhonetic
												? '#e74c3c'
												: isIconic
													? '#3498db'
													: '#95a5a6'}
										<div
											style="text-align: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; border: 2px solid {highlightColor}; max-width: 120px;"
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
														.map((t) =>
															t === 'meaning' ? '🟢 meaning' :
															t === 'phonetic' ? '🔴 sound' :
															t === 'iconic' ? '🔵 iconic' :
															t
														)
														.join(' ')}
												</div>
											{/if}
											{#if hint}
												<div
													style="font-size: 9px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.3;"
												>
													{hint}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<!-- Simplified Character Components (if different) -->
							{#if simplifiedChar && simplifiedChar !== traditionalChar}
								<div style="margin-bottom: 20px;">
									<div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--text-secondary);">
										Simplified (🇨🇳 {simplifiedChar})
									</div>
									{#if simplifiedCharData?.components && simplifiedCharData.components.length > 0}
										{@const simpMakemeahanziImage = simplifiedCharData.images?.find(
											(img) => img && img.source === 'makemeahanzi' && img.data
										)}
										<div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start;">
											{#each simplifiedCharData.components as comp, compIndex}
												{@const char = typeof comp === 'string' ? comp : comp.character || comp.char || comp}
												{@const types = comp.componentType || comp.type || []}
												{@const hint = comp.hint}
												{@const isMeaning = types.includes('meaning')}
												{@const isPhonetic = types.includes('phonetic')}
												{@const isIconic = types.includes('iconic')}
												{@const highlightColor = isMeaning
													? '#27ae60'
													: isPhonetic
														? '#e74c3c'
														: isIconic
															? '#3498db'
															: '#95a5a6'}
												<div
													style="text-align: center; padding: 8px; background: var(--bg-secondary); border-radius: 6px; border: 2px solid {highlightColor}; max-width: 120px;"
												>
													{#if simpMakemeahanziImage?.data?.strokes}
														{@const totalStrokes = simpMakemeahanziImage.data.strokes.length}
														{@const numComponents = simplifiedCharData.components.length}
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
																{#each simpMakemeahanziImage.data.strokes as stroke, strokeIndex}
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
																.map((t) =>
																	t === 'meaning' ? '🟢 meaning' :
																	t === 'phonetic' ? '🔴 sound' :
																	t === 'iconic' ? '🔵 iconic' :
																	t
																)
																.join(' ')}
														</div>
													{/if}
													{#if hint}
														<div
															style="font-size: 9px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.3;"
														>
															{hint}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{:else}
										<div style="font-size: 12px; color: var(--text-tertiary); font-style: italic;">
											Component breakdown coming soon
										</div>
									{/if}
								</div>
							{/if}
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

		<!-- Notes Section -->
		<Notes character={data.word} />

		<!-- Word Definitions Container (Two Columns on Desktop) -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 mb-5 md:mb-8">
			<!-- Chinese Words -->
		{#if data.data.chinese_words && data.data.chinese_words.length > 0}
			<div class="bg-primary-secondary rounded-xl shadow overflow-hidden transition-all duration-300 mb-0">
				<div class="p-4 md:p-5">
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
			<div class="bg-primary-secondary rounded-xl shadow overflow-hidden transition-all duration-300 mb-0">
				<div class="p-4 md:p-5">
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

		<!-- Japanese Names Section -->
		{#if data.data.japanese_names && data.data.japanese_names.length > 0}
			<JapaneseNames names={data.data.japanese_names} word={data.word} />
		{/if}

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
	/* Custom styles that are hard to express in Tailwind or use CSS variables */
	.pos-tag {
		@apply inline-block px-2 py-0.5 rounded text-[11px] font-semibold mr-2 transition-all duration-300;
		background: var(--tag-pos-bg);
		color: var(--tag-pos-text);
	}

	.badge {
		@apply px-3 py-1.5 rounded-full text-xs font-semibold uppercase;
	}

	.badge-hsk {
		@apply transition-all duration-300;
		background: var(--badge-hsk-bg);
		color: var(--badge-hsk-text);
	}
</style>

