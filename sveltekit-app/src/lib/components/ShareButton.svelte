<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		title?: string;
		text?: string;
		url?: string;
	}

	let { title = '', text = '', url = '' }: Props = $props();

	let copied = $state(false);

	async function share() {
		const shareUrl = url || (browser ? window.location.href : '');
		const shareTitle = title || (browser ? document.title : '');

		// Try native share (mobile)
		if (browser && navigator.share) {
			try {
				await navigator.share({ title: shareTitle, text, url: shareUrl });
				return;
			} catch {
				// User cancelled or not supported
			}
		}

		// Fallback: copy URL to clipboard
		if (browser) {
			try {
				await navigator.clipboard.writeText(shareUrl);
				copied = true;
				setTimeout(() => { copied = false; }, 2000);
			} catch {}
		}
	}
</script>

<button class="share-btn" onclick={share} title={copied ? 'Copied!' : 'Share'}>
	{#if copied}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="20 6 9 17 4 12"></polyline>
		</svg>
	{:else}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
			<polyline points="16 6 12 2 8 6"></polyline>
			<line x1="12" y1="2" x2="12" y2="15"></line>
		</svg>
	{/if}
</button>

<style>
	.share-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}
	.share-btn:hover {
		color: var(--accent);
		background: var(--accent-light);
	}
</style>
