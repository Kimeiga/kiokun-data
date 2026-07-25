<script lang="ts">
	let { children } = $props();
</script>

<div class="blog">
	{@render children()}
</div>

<style>
	/* The blog keeps its editorial layout, diagrams and motion, but borrows
	   the main site's fonts and theme colors so it reads as the same product.
	   Every blog component references these scoped tokens, so remapping them
	   onto the app's CSS variables restyles everything — and it auto-switches
	   with the site's light/dark [data-theme] because those vars do. */
	.blog {
		--paper: var(--bg-primary);
		--paper-2: var(--bg-secondary);
		--paper-3: var(--bg-tertiary);
		--ink: var(--text-primary);
		--ink-soft: var(--text-secondary);
		--ink-faint: var(--text-tertiary);
		--rule: var(--border-color);
		--shu: var(--accent);
		--shu-soft: color-mix(in srgb, var(--accent) 62%, var(--bg-primary));
		--shu-wash: var(--accent-light);

		--display: var(--font-cjk);
		--body: var(--font-cjk);
		--label: var(--font-cjk);
		--mono: var(--font-mono);

		--measure: 40rem;
		--gutter: clamp(1.1rem, 4vw, 3rem);

		background: var(--paper);
		color: var(--ink);
		font-family: var(--body);
		min-height: 100vh;
		min-height: 100dvh;
		-webkit-font-smoothing: antialiased;
	}

	:global(.blog *) {
		box-sizing: border-box;
	}
	:global(.blog ::selection) {
		background: var(--shu);
		color: var(--bg-secondary);
	}

	:global(.blog .back),
	:global(.blog .blog-home-link) {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
	}
</style>
