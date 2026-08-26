<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let {
		children,
		id,
		class: className = '',
		viewportClass = '',
		maxHeight = '24rem',
		ariaLabel,
	}: {
		children: Snippet;
		id?: string;
		class?: string;
		viewportClass?: string;
		maxHeight?: string;
		ariaLabel?: string;
	} = $props();

	let viewport: HTMLDivElement | null = $state(null);
	let canScrollUp = $state(false);
	let canScrollDown = $state(false);

	function updateScrollAffordance() {
		const element = viewport;
		if (!element) return;
		const tolerance = 2;
		const scrollable = element.scrollHeight > element.clientHeight + tolerance;
		canScrollUp = scrollable && element.scrollTop > tolerance;
		canScrollDown = scrollable && element.scrollTop + element.clientHeight < element.scrollHeight - tolerance;
	}

	onMount(() => {
		const element = viewport;
		if (!element) return;

		const frame = requestAnimationFrame(updateScrollAffordance);
		const resizeObserver = typeof ResizeObserver !== 'undefined'
			? new ResizeObserver(updateScrollAffordance)
			: null;
		const mutationObserver = typeof MutationObserver !== 'undefined'
			? new MutationObserver(() => requestAnimationFrame(updateScrollAffordance))
			: null;

		resizeObserver?.observe(element);
		mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true });
		window.addEventListener('resize', updateScrollAffordance);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			window.removeEventListener('resize', updateScrollAffordance);
		};
	});
</script>

<div
	class={`scroll-window-shell ${className}`}
	style={`--scroll-window-max-height: ${maxHeight}`}
>
	<!-- Keyboard focus is intentional only while this region overflows, so keyboard users can scroll it directly. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		{id}
		class={`scroll-window-viewport ${viewportClass}`}
		bind:this={viewport}
		onscroll={updateScrollAffordance}
		role={ariaLabel ? 'region' : undefined}
		aria-label={ariaLabel}
		tabindex={canScrollUp || canScrollDown ? 0 : undefined}
	>
		{@render children()}
	</div>

	{#if canScrollUp}
		<span class="scroll-window-affordance scroll-window-affordance-top" aria-hidden="true"></span>
	{/if}
	{#if canScrollDown}
		<span class="scroll-window-affordance scroll-window-affordance-bottom" aria-hidden="true"></span>
	{/if}
</div>

<style>
	.scroll-window-shell {
		position: relative;
		min-width: 0;
	}

	.scroll-window-viewport {
		max-height: var(--scroll-window-max-height);
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior-y: contain;
		scrollbar-color: var(--border-light) transparent;
		scrollbar-width: thin;
		touch-action: pan-y;
		-webkit-overflow-scrolling: touch;
	}

	.scroll-window-viewport:focus-visible {
		position: relative;
		z-index: 2;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.scroll-window-affordance {
		position: absolute;
		z-index: 3;
		left: 1px;
		right: 1px;
		height: 1.75rem;
		pointer-events: none;
	}

	.scroll-window-affordance-bottom {
		bottom: 1px;
		background: linear-gradient(
			to bottom,
			transparent,
			color-mix(in srgb, var(--bg-primary) 88%, transparent)
		);
		box-shadow: inset 0 -0.85rem 1rem -0.9rem color-mix(in srgb, var(--text-primary) 42%, transparent);
	}

	.scroll-window-affordance-top {
		top: 1px;
		background: linear-gradient(
			to top,
			transparent,
			color-mix(in srgb, var(--bg-primary) 88%, transparent)
		);
		box-shadow: inset 0 0.85rem 1rem -0.9rem color-mix(in srgb, var(--text-primary) 42%, transparent);
	}
</style>
