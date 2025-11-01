<script lang="ts">
	/**
	 * Component for displaying a single sense/definition
	 * Based on 10ten-ja-reader's Sense component
	 */
	import type { JapaneseSense, JapaneseGloss } from '$lib/types';
	import Tag from '../shared/Tag.svelte';
	import { getPosLabel, getMiscLabel, getFieldLabel, getDialectLabel } from '$lib/utils/japaneseLabels';

	export let sense: JapaneseSense;
	export let showPos: boolean = true;

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

<span class="sense-content">
	<!-- Part of speech tags -->
	{#if showPos && sense.partOfSpeech && sense.partOfSpeech.length > 0}
		<span class="tags">
			{#each sense.partOfSpeech as pos}
				<Tag type="pos" text={getPosLabel(pos)} langTag="en" />
			{/each}
		</span>
	{/if}

	<!-- Field tags -->
	{#if sense.field && sense.field.length > 0}
		<span class="tags">
			{#each sense.field as field}
				<Tag type="field" text={getFieldLabel(field)} langTag="en" />
			{/each}
		</span>
	{/if}

	<!-- Misc tags -->
	{#if sense.misc && sense.misc.length > 0}
		<span class="tags">
			{#each sense.misc as misc}
				<Tag type="misc" text={getMiscLabel(misc)} langTag="en" />
			{/each}
		</span>
	{/if}

	<!-- Dialect tags -->
	{#if sense.dialect && sense.dialect.length > 0}
		<span class="tags">
			{#each sense.dialect as dial}
				<Tag type="dial" text={getDialectLabel(dial)} langTag="en" />
			{/each}
		</span>
	{/if}

	<!-- Glosses -->
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

	<!-- Additional info -->
	{#if sense.info && sense.info.length > 0}
		<span class="info-text"> ({sense.info.join('; ')})</span>
	{/if}
</span>

<style>
	.sense-content {
		color: var(--text-primary);
	}

	.tags {
		margin-right: 4px;
	}

	.gloss-type {
		font-size: 0.9em;
		color: var(--text-secondary);
		margin-right: 4px;
	}

	.info-text {
		font-size: 0.9em;
		color: var(--text-secondary);
		font-lang: ja;
	}
</style>

