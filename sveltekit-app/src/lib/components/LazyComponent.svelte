<script lang="ts">
	import { onMount } from "svelte";
	import type { Component } from "svelte";

	type ComponentModule = { default: Component<any> };

	interface Props {
		loader: () => Promise<ComponentModule>;
		props?: Record<string, unknown>;
		rootMargin?: string;
		minHeight?: string;
		className?: string;
		eager?: boolean;
	}

	let {
		loader,
		props = {},
		rootMargin = "900px 0px",
		minHeight = "1px",
		className = "",
		eager = false,
	}: Props = $props();

	let anchor: HTMLDivElement | null = $state(null);
	let Loaded = $state<Component<any> | null>(null);
	let loading = $state(false);

	async function load() {
		if (Loaded || loading) return;
		loading = true;
		try {
			Loaded = (await loader()).default;
		} catch (err) {
			console.error("Failed to lazy-load component:", err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const loadForHash = () => {
			if (window.location.hash) load();
		};

		if (eager || window.location.hash) {
			load();
			window.addEventListener("hashchange", loadForHash);
			return () => window.removeEventListener("hashchange", loadForHash);
		}

		const el = anchor;
		if (!el || !("IntersectionObserver" in window)) {
			load();
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					load();
					observer.disconnect();
				}
			},
			{ rootMargin }
		);

		observer.observe(el);
		window.addEventListener("hashchange", loadForHash);
		return () => {
			observer.disconnect();
			window.removeEventListener("hashchange", loadForHash);
		};
	});
</script>

{#if Loaded}
	<Loaded {...props} />
{:else}
	<div
		bind:this={anchor}
		class="lazy-component-anchor {className}"
		style:min-height={minHeight}
		aria-hidden="true"
	></div>
{/if}

<style>
	.lazy-component-anchor {
		width: 100%;
	}
</style>
