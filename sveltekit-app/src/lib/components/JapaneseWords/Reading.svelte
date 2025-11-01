<script lang="ts">
	/**
	 * Component for displaying kana readings with pitch accent visualization
	 * Based on 10ten-ja-reader's Reading component
	 */
	import PitchAccent from '$lib/PitchAccent.svelte';

	export let kana: string;
	export let pitchAccents: number[] | undefined = undefined;
	export let accentDisplay: 'none' | 'binary' | 'binary-hi-contrast' = 'binary';

	// Use the first pitch accent if available
	const accentPos = pitchAccents && pitchAccents.length > 0 ? pitchAccents[0] : undefined;
</script>

{#if accentDisplay === 'none' || accentPos === undefined}
	<span>{kana}</span>
{:else}
	<PitchAccent {kana} pitchAccents={pitchAccents || []} />
{/if}

