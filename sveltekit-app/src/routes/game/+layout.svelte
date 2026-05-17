<script lang="ts">
	import { browser } from '$app/environment';

	let { children } = $props();

	// Mirror Kiokun's global theme (documentElement[data-theme]) so the game's
	// dark styles match the rest of the site without owning a separate toggle.
	let dark = $state(false);

	$effect(() => {
		if (!browser) return;
		const root = document.documentElement;
		const sync = () => {
			dark = (root.getAttribute('data-theme') ?? 'dark') === 'dark';
		};
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<!-- Fonts: Geist (UI) + Noto Sans for all CJK scripts the game uses -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500&family=Noto+Sans+JP:wght@400;500&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+TC:wght@400;500&family=Noto+Sans+KR:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!--
  All of duojp's CSS custom properties are scoped to .duojp-scope (not :root)
  so they cannot leak into the rest of the Kiokun app. The game page's own
  `:global(.dark) ...` rules resolve against the `dark` class on this wrapper.
-->
<div class="duojp-scope" class:dark>
	{@render children()}
</div>

<style>
	.duojp-scope {
		/* Light theme */
		--bg-primary: #fafafa;
		--bg-secondary: #ffffff;
		--bg-tertiary: #f4f4f5;
		--text-primary: #18181b;
		--text-secondary: #52525b;
		--text-muted: #a1a1aa;
		--border-color: #e4e4e7;
		--border-dashed: #d4d4d8;
		--shadow-color: rgba(0, 0, 0, 0.06);
		--green-primary: #22c55e;
		--green-dark: #16a34a;
		--blue-primary: #3b82f6;
		--blue-dark: #2563eb;
		--tile-bg: #ffffff;
		--tile-border: #e4e4e7;
		--tile-shadow: #d4d4d8;

		font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		min-height: 100%;
		display: flex;
		flex-direction: column;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.duojp-scope.dark {
		/* Dark theme */
		--bg-primary: #09090b;
		--bg-secondary: #18181b;
		--bg-tertiary: #27272a;
		--text-primary: #fafafa;
		--text-secondary: #a1a1aa;
		--text-muted: #71717a;
		--border-color: #3f3f46;
		--border-dashed: #52525b;
		--shadow-color: rgba(0, 0, 0, 0.5);
		--tile-bg: #27272a;
		--tile-border: #3f3f46;
		--tile-shadow: #18181b;
	}
</style>
