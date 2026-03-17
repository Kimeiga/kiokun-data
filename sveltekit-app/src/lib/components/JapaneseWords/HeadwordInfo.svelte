<script lang="ts">
	/**
	 * Component for displaying kanji/kana info tags (iK, oK, rK, sK, ik, ok, rk, sk)
	 * Based on 10ten-ja-reader's HeadwordInfo component
	 */
	import { getHeadInfoLabel } from '$lib/utils/japaneseLabels';

	export let info: string[];
</script>

{#each info as tag}
	<span class="info-tag">
		({getHeadInfoLabel(tag)})
	</span>
{/each}

<style>
	.info-tag {
		margin-left: var(--spacing-xs);
		font-size: var(--font-size-caption2);
		color: var(--text-tertiary, #95a5a6);
	}
</style>

