<script lang="ts">
	/**
	 * Component for displaying a single sense/definition
	 * Based on 10ten-ja-reader's Sense component
	 */
	import type { JapaneseSense, JapaneseGloss } from '$lib/types';
	import Tag from '../shared/Tag.svelte';
	import SenseExampleList from '$lib/components/SenseExampleList.svelte';
	import { japaneseExamplesForSense } from '$lib/japanese-examples';
	import { getPosLabel, getMiscLabel, getFieldLabel, getDialectLabel } from '$lib/utils/japaneseLabels';

	export let sense: JapaneseSense;
	export let showPos: boolean = true;
	$: senseExamples = japaneseExamplesForSense(sense);

	function getGlossText(gloss: JapaneseGloss): string {
		return gloss.text;
	}

	function getGlossType(gloss: JapaneseGloss): string | undefined {
		if (gloss.type && gloss.type !== 'none') {
			// For now, just return the type as-is since we don't have gloss type labels
			return gloss.type;
		}
		return undefined;
	}
</script>

<div class="sense-content">
	<div class="sense-primary">
		{#if sense.gloss && sense.gloss.length > 0}
			{#each sense.gloss as gloss, index}
				{#if index > 0}; {/if}
				{@const typeStr = getGlossType(gloss)}
				{#if typeStr}
					<span class="gloss-type">({typeStr})</span>
				{/if}
				<span>{getGlossText(gloss)}</span>
			{/each}
		{/if}

		{#if sense.info && sense.info.length > 0}
			<span class="info-text"> ({sense.info.join('; ')})</span>
		{/if}
	</div>

	{#if (showPos && sense.partOfSpeech?.length) || sense.field?.length || sense.misc?.length || sense.dialect?.length}
		<div class="sense-meta" aria-label="Definition labels">
			{#if showPos}
				{#each sense.partOfSpeech || [] as pos}
					<Tag type="pos" text={getPosLabel(pos)} langTag="en" />
				{/each}
			{/if}
			{#each sense.field || [] as field}
				<Tag type="field" text={getFieldLabel(field)} langTag="en" />
			{/each}
			{#each sense.misc || [] as misc}
				<Tag type="misc" text={getMiscLabel(misc)} langTag="en" />
			{/each}
			{#each sense.dialect || [] as dial}
				<Tag type="dial" text={getDialectLabel(dial)} langTag="en" />
			{/each}
		</div>
	{/if}

	<SenseExampleList examples={senseExamples} language="ja" />
</div>

<style>
	.sense-content {
		display: grid;
		min-width: 0;
		gap: var(--spacing-xs);
		color: var(--text-primary);
	}

	.sense-primary {
		min-width: 0;
		font-size: var(--font-size-body);
		line-height: 1.45;
	}

	.sense-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.sense-meta :global(.tag) {
		margin-right: 0;
	}

	.gloss-type {
		font-size: 0.9em;
		color: var(--text-secondary);
		margin-right: var(--spacing-xs);
	}

	.info-text {
		font-size: 0.9em;
		color: var(--text-secondary);
	}

</style>
