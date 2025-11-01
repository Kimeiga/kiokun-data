<script lang="ts">
	/**
	 * Component for displaying word definitions with smart grouping
	 * Based on 10ten-ja-reader's Definitions component
	 */
	import type { JapaneseSense } from '$lib/types';
	import Tag from '../shared/Tag.svelte';
	import Sense from './Sense.svelte';
	import { getPosLabel, getMiscLabel } from '$lib/utils/japaneseLabels';

	export let senses: JapaneseSense[];

	interface SenseGroup {
		pos: string[];
		misc: string[];
		senses: JapaneseSense[];
	}

	// Group senses by primary part-of-speech
	function groupSenses(senses: JapaneseSense[]): SenseGroup[] {
		const groups = new Map<string, SenseGroup>();

		for (const sense of senses) {
			const primaryPos = sense.partOfSpeech && sense.partOfSpeech.length > 0
				? sense.partOfSpeech[0]
				: 'no-pos';

			if (!groups.has(primaryPos)) {
				groups.set(primaryPos, {
					pos: primaryPos !== 'no-pos' ? [primaryPos] : [],
					misc: [],
					senses: []
				});
			}

			groups.get(primaryPos)!.senses.push(sense);
		}

		return Array.from(groups.values());
	}

	// Determine if we should use grouping
	const posGroups = senses.length > 1 ? groupSenses(senses) : [];
	const linesWithGrouping = posGroups.length + senses.length;
	const linesWithoutGrouping = senses.length;
	const useGroups = posGroups.length > 0 && linesWithGrouping / linesWithoutGrouping <= 1.5;

	let startIndex = 1;
</script>

<div class="definitions">
	{#if senses.length === 1}
		<!-- Single definition: inline tags, no numbering -->
		<div class="single-sense">
			<Sense sense={senses[0]} showPos={true} />
		</div>
	{:else if useGroups}
		<!-- Multiple definitions: grouped by POS -->
		{#each posGroups as group}
			<div class="sense-group">
				<!-- Group heading -->
				{#if group.pos.length > 0 || group.misc.length > 0}
					<p class="group-heading">
						{#each group.pos as pos}
							<Tag type="pos" text={getPosLabel(pos)} langTag="en" />
						{/each}
						{#each group.misc as misc}
							<Tag type="misc" text={getMiscLabel(misc)} langTag="en" />
						{/each}
						{#if group.pos.length === 0 && group.misc.length === 0}
							<Tag type="pos" text="-" langTag="en" />
						{/if}
					</p>
				{/if}

				<!-- Group items -->
				<ol class="sense-list" start={startIndex}>
					{#each group.senses as sense}
						<li class="sense-item">
							<Sense {sense} showPos={false} />
						</li>
						{@const _ = startIndex++}
					{/each}
				</ol>
			</div>
		{/each}
	{:else}
		<!-- Multiple definitions: flat list -->
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
		font-size: 16px;
		line-height: 1.6;
		color: var(--text-primary);
	}

	.single-sense {
		margin-bottom: 8px;
	}

	.sense-group {
		margin-bottom: 20px;
	}

	.group-heading {
		margin: 4px 0 8px 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.sense-list {
		margin: 0;
		padding-left: 24px;
		list-style: decimal;
	}

	.sense-item {
		margin-bottom: 8px;
		line-height: 1.6;
	}
</style>

