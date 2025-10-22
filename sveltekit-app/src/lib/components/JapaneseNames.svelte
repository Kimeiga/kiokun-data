<script lang="ts">
	// JapaneseNames component - displays Japanese name data from JMnedict
	// Data comes pre-expanded from field-mappings.ts
	
	interface JmnedictName {
		id: string;
		kanji: Array<{text: string; tags?: string[]}>;
		kana: Array<{text: string; tags?: string[]; applies_to_kanji?: string[]}>;
		translation: Array<{
			name_type: string[];
			related?: string[];
			translation: Array<{lang?: string; text: string}>;
		}>;
	}

	interface Props {
		names: JmnedictName[];
		word: string;
	}

	let { names, word }: Props = $props();
	
	// Group names by type for better organization
	const groupedNames = names.reduce((groups, name) => {
		name.translation.forEach(translation => {
			translation.name_type.forEach(type => {
				if (!groups[type]) groups[type] = [];
				groups[type].push(name);
			});
		});
		return groups;
	}, {} as Record<string, JmnedictName[]>);

	// Type display names
	const typeNames: Record<string, string> = {
		'surname': '姓',
		'given': '名',
		'place': '地名', 
		'unclass': '名前',
		'company': '会社',
		'product': '製品',
		'work': '作品'
	};
</script>

<div class="japanese-names">
	<h3>📛 Japanese Names</h3>
	<div class="names-grid">
		{#each Object.entries(groupedNames) as [type, nameList]}
			<div class="name-type-group">
				<h4 class="name-type-badge">{typeNames[type as keyof typeof typeNames] || type}</h4>
				<div class="names-list">
					{#each nameList as name}
						<div class="name-entry">
							<div class="name-forms">
								{#each name.kanji as kanji}
									<span class="kanji-form">{kanji.text}</span>
								{/each}
								{#each name.kana as kana}
									<span class="kana-form">{kana.text}</span>
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
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.japanese-names {
		margin: 1.5rem 0;
		padding: 1rem;
		background: var(--surface-2);
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
	}

	.names-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}

	.name-type-group {
		background: var(--surface-1);
		border-radius: 0.375rem;
		padding: 0.75rem;
	}

	.name-type-badge {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--accent-color);
		margin-bottom: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--accent-color-alpha);
		border-radius: 0.25rem;
		display: inline-block;
	}

	.names-list {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
	}

	.name-entry {
		padding: 0.5rem;
		background: var(--surface-3);
		border-radius: 0.25rem;
		border-left: 3px solid var(--accent-color);
	}

	.name-forms {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.25rem;
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

	.name-meanings {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.meaning {
		font-size: 0.875rem;
		color: var(--text-tertiary);
		background: var(--surface-4);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	@media (max-width: 768px) {
		.names-grid {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		}
		
		.names-list {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 480px) {
		.names-list {
			grid-template-columns: 1fr;
		}
	}
</style>
