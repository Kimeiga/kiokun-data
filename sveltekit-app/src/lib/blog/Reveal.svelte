<script lang="ts">
	import { onMount } from 'svelte';

	let { children, delay = 0, as = 'div' }: { children: any; delay?: number; as?: string } =
		$props();

	let el: HTMLElement;
	let shown = $state(false);

	onMount(() => {
		const reduce =
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		if (reduce || typeof IntersectionObserver === 'undefined') {
			shown = true;
			return;
		}

		// Safety net: content must never be stuck invisible if the observer
		// never fires (programmatic scroll, odd viewports, etc.).
		const fallback = setTimeout(() => (shown = true), 1600);

		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						clearTimeout(fallback);
						setTimeout(() => (shown = true), delay);
						io.disconnect();
					}
				}
			},
			{ rootMargin: '200px 0px 0px 0px', threshold: 0.01 }
		);
		io.observe(el);
		return () => {
			clearTimeout(fallback);
			io.disconnect();
		};
	});
</script>

<svelte:element this={as} bind:this={el} class="reveal" class:shown>
	{@render children()}
</svelte:element>

<style>
	.reveal {
		opacity: 0;
		transform: translateY(18px);
		transition:
			opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
		will-change: opacity, transform;
	}
	.reveal.shown {
		opacity: 1;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal {
			opacity: 1;
			transform: none;
			transition: none;
		}
	}
</style>
