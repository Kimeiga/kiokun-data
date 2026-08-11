<script lang="ts">
	/**
	 * Component for displaying word definitions with smart grouping
	 * Based on 10ten-ja-reader's Definitions component
	 */
	import type { JapaneseSense } from '$lib/types';
	import Sense from './Sense.svelte';

	export let senses: JapaneseSense[];
</script>

<div class="definitions">
	{#if senses.length === 1}
		<!-- Single definition: inline tags, no numbering -->
		<div class="single-sense">
			<Sense sense={senses[0]} showPos={true} />
		</div>
	{:else}
		<!-- Keep every definition self-contained: gloss first, labels second. -->
		<ol class="sense-list">
			{#each senses as sense}
				<li class="sense-item">
					<Sense {sense} showPos={true} />
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.definitions {
		font-size: var(--font-size-callout);
		line-height: 1.5;
		color: var(--text-primary);
	}

	.single-sense {
		margin-bottom: var(--spacing-sm);
	}

	.sense-list {
		margin: 0;
		padding-left: 1.5rem;
		list-style: decimal;
	}

	.sense-item {
		margin-bottom: var(--spacing-md);
		padding-left: var(--spacing-xs);
		line-height: 1.5;
	}

	/* No trailing space inside an entry — whatever follows owns the gap. */
	.single-sense:last-child,
	.sense-item:last-child {
		margin-bottom: 0;
	}
</style>
