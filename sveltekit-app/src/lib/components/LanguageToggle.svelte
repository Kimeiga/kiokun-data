<script lang="ts">
	import { languageStore } from '$lib/stores/languages.svelte';

	// Compact mode for header, expanded for mobile menu
	let { compact = true }: { compact?: boolean } = $props();
</script>

{#if compact}
	<!-- Compact flag buttons for desktop header -->
	<div class="flex items-center gap-1 bg-bg-secondary rounded-full px-1.5 py-1 border border-border">
		<button
			class="lang-btn"
			class:active={languageStore.preferences.chinese}
			onclick={() => languageStore.toggle('chinese')}
			title="Toggle Chinese"
		>
			🇨🇳
		</button>
		<button
			class="lang-btn"
			class:active={languageStore.preferences.japanese}
			onclick={() => languageStore.toggle('japanese')}
			title="Toggle Japanese"
		>
			🇯🇵
		</button>
		<button
			class="lang-btn"
			class:active={languageStore.preferences.korean}
			onclick={() => languageStore.toggle('korean')}
			title="Toggle Korean"
		>
			🇰🇷
		</button>
	</div>
{:else}
	<!-- Expanded version for mobile menu -->
	<div class="flex flex-col gap-2">
		<div class="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
			Languages
		</div>
		<div class="flex items-center gap-2">
			<button
				class="lang-btn-expanded"
				class:active={languageStore.preferences.chinese}
				onclick={() => languageStore.toggle('chinese')}
			>
				<span class="text-lg">🇨🇳</span>
				<span class="text-sm">Chinese</span>
			</button>
			<button
				class="lang-btn-expanded"
				class:active={languageStore.preferences.japanese}
				onclick={() => languageStore.toggle('japanese')}
			>
				<span class="text-lg">🇯🇵</span>
				<span class="text-sm">Japanese</span>
			</button>
			<button
				class="lang-btn-expanded"
				class:active={languageStore.preferences.korean}
				onclick={() => languageStore.toggle('korean')}
			>
				<span class="text-lg">🇰🇷</span>
				<span class="text-sm">Korean</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.lang-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 16px;
		transition: opacity 0.15s ease, filter 0.15s ease, background 0.15s ease;
		opacity: 0.4;
		filter: grayscale(100%);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.lang-btn:hover {
		opacity: 0.7;
		filter: grayscale(50%);
	}

	.lang-btn.active {
		opacity: 1;
		filter: grayscale(0%);
		background: var(--bg-tertiary);
	}

	.lang-btn-expanded {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: opacity 0.15s ease, filter 0.15s ease, border-color 0.15s ease, background 0.15s ease;
		opacity: 0.5;
		filter: grayscale(100%);
	}

	.lang-btn-expanded:hover {
		opacity: 0.7;
		filter: grayscale(50%);
		border-color: var(--accent);
	}

	.lang-btn-expanded.active {
		opacity: 1;
		filter: grayscale(0%);
		border-color: var(--accent);
		background: var(--bg-tertiary);
	}

	.lang-btn-expanded span:last-child {
		color: var(--text-secondary);
	}

	.lang-btn-expanded.active span:last-child {
		color: var(--text-primary);
	}
</style>

