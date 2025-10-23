<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Data comes pre-expanded from field-mappings.ts

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

	console.log('[JapaneseNames] Received names:', names);
	console.log('[JapaneseNames] First name structure:', names[0]);

	// Type display names
	const typeNames: Record<string, string> = {
		'surname': '姓',
		'fem': '女性名',
		'masc': '男性名',
		'given': '名',
		'place': '地名',
		'unclass': '名前',
		'company': '会社',
		'product': '製品',
		'work': '作品',
		'person': '人名',
		'station': '駅名'
	};

	// Track expanded state
	const INITIAL_DISPLAY_COUNT = 5;
	let isExpanded = $state(false);

	// Get display list based on expanded state
	const displayList = $derived(isExpanded ? names : names.slice(0, INITIAL_DISPLAY_COUNT));
	const hasMore = names.length > INITIAL_DISPLAY_COUNT;
</script>

<div class="japanese-names">
	<h3>📛 Japanese Names</h3>
	<div class="names-list">
		{#each displayList as name}
			<div class="name-entry">
				<div class="name-forms">
					{#each name.kanji as kanji}
						<span class="kanji-form">{kanji.text}</span>
					{/each}
					{#each name.kana as kana}
						<span class="kana-form">{kana.text}</span>
					{/each}
				</div>
				<div class="name-info">
					<div class="name-types">
						{#each name.translation as trans}
							{#each trans.type as type}
								<span class="type-tag">{typeNames[type] || type}</span>
							{/each}
						{/each}
					</div>
					<div class="name-meanings">
						{#each name.translation as trans}
							{#each trans.translation as meaning}
								<span class="meaning">{meaning.text}</span>
							{/each}
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if hasMore}
		<button
			class="show-more-btn"
			onclick={() => isExpanded = !isExpanded}
		>
			{isExpanded ? '▲ Show less' : `▼ Show ${names.length - INITIAL_DISPLAY_COUNT} more`}
		</button>
	{/if}
</div>

<style>
	.japanese-names {
		margin: 1.5rem 0;
		padding: 1rem;
		background: var(--surface-2);
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
	}

	.names-list {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}

	.name-entry {
		padding: 0.75rem;
		background: var(--surface-1);
		border-radius: 0.375rem;
		border: 1px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.name-entry:hover {
		border-color: var(--accent-color);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.name-forms {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.kanji-form {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 1.1rem;
	}

	.kana-form {
		color: var(--text-secondary);
		font-style: italic;
	}

	.name-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.name-types {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.type-tag {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--accent-color);
		background: var(--accent-color-alpha);
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		border: 1px solid var(--accent-color);
	}

	.name-meanings {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.meaning {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		background: var(--surface-3);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.show-more-btn {
		margin-top: 0.75rem;
		width: 100%;
		padding: 0.5rem;
		background: var(--surface-3);
		border: 1px solid var(--border-color);
		border-radius: 0.25rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.show-more-btn:hover {
		background: var(--surface-4);
		color: var(--text-primary);
		border-color: var(--accent-color);
	}

	@media (max-width: 768px) {
		.names-list {
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		}
	}

	@media (max-width: 480px) {
		.names-list {
			grid-template-columns: 1fr;
		}
	}
</style>
