<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Based on 10ten-ja-reader's NameEntry component
	import Tag from './shared/Tag.svelte';

	interface JmnedictName {
		id: string;
		kanji: Array<{text: string; tags?: string[]}>;
		kana: Array<{text: string; tags?: string[]; appliesToKanji?: string[]}>;
		translation: Array<{
			type: string[];
			related?: string[];
			translation: Array<{lang?: string; text: string}>;
		}>;
	}

	interface Props {
		names: JmnedictName[];
		word: string;
	}

	let { names, word }: Props = $props();

	// Type display names (English labels for tags)
	const typeLabels: Record<string, string> = {
		'surname': 'surname',
		'fem': 'female given name',
		'masc': 'male given name',
		'given': 'given name',
		'place': 'place name',
		'unclass': 'unclassified name',
		'company': 'company name',
		'product': 'product name',
		'work': 'work of art',
		'person': 'full name of a particular person',
		'station': 'railway station'
	};

	// Map types to tag types for coloring
	function getTagType(type: string): 'fem' | 'masc' | 'place' | 'pos' {
		if (type === 'fem') return 'fem';
		if (type === 'masc') return 'masc';
		if (type === 'place') return 'place';
		return 'pos'; // default grey
	}
</script>

<div class="japanese-names">
	<h3>📛 Japanese Names</h3>
	<div class="names-list">
		{#each names as name}
			<div class="name-entry">
				<!-- Kanji and Kana on same line -->
				<div class="name-headwords" lang="ja">
					{#if name.kanji.length > 0}
						<span class="kanji-forms">
							{name.kanji.map(k => k.text).join('、')}
						</span>
					{/if}
					<span class="kana-forms">
						{name.kana.map(k => k.text).join('、')}
					</span>
				</div>

				<!-- Translations with inline tags -->
				<div class="name-translations">
					{#each name.translation as trans}
						<div class="translation-line">
							<span class="translation-text">
								{trans.translation.map(t => t.text).join(', ')}
							</span>
							{#each trans.type as type}
								<Tag
									type={getTagType(type)}
									text={typeLabels[type] || type}
									langTag="en"
								/>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.japanese-names {
		margin-bottom: 30px;
	}

	h3 {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 12px;
		color: var(--text-color, #2c3e50);
	}

	.names-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.name-entry {
		padding: 12px 16px;
		break-inside: avoid;
	}

	.name-headwords {
		display: flex;
		gap: 16px;
		margin-bottom: 8px;
	}

	.kanji-forms {
		font-size: 24px;
		font-family: 'MS Mincho', serif;
		font-weight: 600;
		color: var(--primary-highlight, #2c3e50);
	}

	.kana-forms {
		font-size: 20px;
		font-family: 'MS Mincho', serif;
		color: var(--reading-highlight, #e74c3c);
	}

	.name-translations {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.translation-line {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: 16px;
	}

	.translation-text {
		color: var(--text-color, #2c3e50);
	}

	/* Dark mode support */
	:global(.dark) h3 {
		color: var(--text-color, #ecf0f1);
	}

	:global(.dark) .translation-text {
		color: var(--text-color, #ecf0f1);
	}
</style>
