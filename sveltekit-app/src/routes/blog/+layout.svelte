<script lang="ts">
	import { browser } from '$app/environment';
	let { children } = $props();

	// Mirror the main site's theme if it's set; otherwise the blog defaults to
	// its own warm "paper" light reading mode (editorial intent).
	let dark = $state(false);
	$effect(() => {
		if (!browser) return;
		const root = document.documentElement;
		const sync = () => {
			dark = root.getAttribute('data-theme') === 'dark';
		};
		sync();
		const o = new MutationObserver(sync);
		o.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		return () => o.disconnect();
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="blog" class:dark>
	{@render children()}
</div>

<style>
	/* ── Scoped design system (washi & sumi, with a vermilion seal accent) ──
	   Tokens live on .blog only so nothing leaks into the dictionary app. */
	.blog {
		--paper: oklch(0.976 0.008 85);
		--paper-2: oklch(0.949 0.011 82);
		--paper-3: oklch(0.927 0.014 80);
		--ink: oklch(0.255 0.018 55);
		--ink-soft: oklch(0.44 0.02 55);
		--ink-faint: oklch(0.6 0.02 60);
		--rule: oklch(0.86 0.014 78);
		--shu: oklch(0.575 0.2 31);
		--shu-soft: oklch(0.7 0.13 36);
		--shu-wash: oklch(0.93 0.045 45);

		--display: 'Fraunces', Georgia, 'Times New Roman', serif;
		--body: 'Newsreader', Georgia, serif;
		--label: 'Hanken Grotesk', system-ui, sans-serif;
		--mono: 'Fraunces', ui-monospace, monospace; /* code uses a tabular fallback below */

		--measure: 38rem;
		--gutter: clamp(1.1rem, 4vw, 3rem);

		background: var(--paper);
		color: var(--ink);
		font-family: var(--body);
		font-optical-sizing: auto;
		min-height: 100vh;
		min-height: 100dvh;
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}

	.blog.dark {
		--paper: oklch(0.205 0.013 58);
		--paper-2: oklch(0.243 0.014 56);
		--paper-3: oklch(0.285 0.016 54);
		--ink: oklch(0.93 0.013 85);
		--ink-soft: oklch(0.77 0.015 80);
		--ink-faint: oklch(0.58 0.015 70);
		--rule: oklch(0.36 0.015 58);
		--shu: oklch(0.7 0.17 35);
		--shu-soft: oklch(0.6 0.15 33);
		--shu-wash: oklch(0.33 0.06 35);
	}

	/* Honor OS preference too when the site hasn't forced a theme. */
	@media (prefers-color-scheme: dark) {
		.blog:not(.dark) {
			--paper: oklch(0.205 0.013 58);
			--paper-2: oklch(0.243 0.014 56);
			--paper-3: oklch(0.285 0.016 54);
			--ink: oklch(0.93 0.013 85);
			--ink-soft: oklch(0.77 0.015 80);
			--ink-faint: oklch(0.58 0.015 70);
			--rule: oklch(0.36 0.015 58);
			--shu: oklch(0.7 0.17 35);
			--shu-soft: oklch(0.6 0.15 33);
			--shu-wash: oklch(0.33 0.06 35);
		}
	}

	:global(.blog *) {
		box-sizing: border-box;
	}
	:global(.blog ::selection) {
		background: var(--shu);
		color: var(--paper);
	}
</style>
