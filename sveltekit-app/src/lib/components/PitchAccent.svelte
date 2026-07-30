<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		word: string;
		reading?: string;
	}

	let { word, reading }: Props = $props();

	let accent = $state<number | null>(null);
	let loaded = $state(false);

	function simpleHash(str: string): number {
		let h = 0;
		for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
		return h;
	}

	onMount(() => {
		if (!word) return;

		const shard = (simpleHash(word) & 0xFF).toString(16).padStart(2, '0');
		fetch(`/pitch/${shard}.json`)
			.then(r => r.ok ? r.json() : null)
			.then(data => {
				if (!data || !data[word]) { loaded = true; return; }
				const readings = data[word];
				if (reading && readings[reading] !== undefined) {
					accent = readings[reading];
				} else {
					accent = Object.values(readings)[0] as number;
				}
				loaded = true;
			})
			.catch(() => { loaded = true; });
	});

	function renderPattern(kana: string, acc: number): { char: string; high: boolean }[] {
		const morae: string[] = [];
		for (let i = 0; i < kana.length; i++) {
			const next = kana[i + 1];
			if (next && 'ゃゅょャュョ'.includes(next)) {
				morae.push(kana[i] + next);
				i++;
			} else {
				morae.push(kana[i]);
			}
		}
		return morae.map((char, i) => {
			let high: boolean;
			if (acc === 0) high = i > 0;
			else if (acc === 1) high = i === 0;
			else high = i > 0 && i < acc;
			return { char, high };
		});
	}

	function pitchType(acc: number, moraCount: number): string {
		if (acc === 0) return '平板';
		if (acc === 1) return '頭高';
		if (acc === moraCount) return '尾高';
		return '中高';
	}

	function countMorae(kana: string): number {
		let count = 0;
		for (let i = 0; i < kana.length; i++) {
			if ('ゃゅょャュョ'.includes(kana[i])) continue;
			if (kana[i] === 'っ' || kana[i] === 'ッ') { count++; continue; }
			const c = kana.charCodeAt(i);
			if ((c >= 0x3040 && c <= 0x309F) || (c >= 0x30A0 && c <= 0x30FF)) count++;
		}
		return count;
	}

	let displayReading = $derived(reading || word);
	let pattern = $derived(accent !== null ? renderPattern(displayReading, accent) : null);
	let moraCount = $derived(countMorae(displayReading));
</script>

{#if loaded && accent !== null && pattern}
	<span class="pitch-display" title="{pitchType(accent, moraCount)} (accent: {accent})">
		{#each pattern as mora}
			<span class="pitch-mora" class:high={mora.high}>{mora.char}</span>
		{/each}
		<span class="pitch-label">{pitchType(accent, moraCount)}</span>
	</span>
{/if}

<style>
	.pitch-display {
		display: inline-flex;
		align-items: flex-end;
		gap: 0;
		margin-left: var(--spacing-sm);
		font-size: 12px;
		vertical-align: middle;
	}
	.pitch-mora {
		display: inline-block;
		padding: 0 1px;
		border-top: 2px solid transparent;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-family: var(--font-cjk);
		line-height: 1.3;
	}
	.pitch-mora.high {
		border-top-color: var(--accent);
		border-bottom-color: transparent;
		color: var(--text-secondary);
	}
	.pitch-mora:not(.high) {
		border-bottom-color: var(--text-muted);
		border-top-color: transparent;
	}
	.pitch-label {
		font-size: 12px;
		color: var(--text-muted);
		margin-left: 3px;
		white-space: nowrap;
	}
</style>
