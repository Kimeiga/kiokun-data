<script lang="ts">
	import type { LayoutData } from './$types';
	import '../app.css';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import SeoMeta from '$lib/components/SeoMeta.svelte';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const dictionaryRouteExclusions = new Set([
		'artifacts',
		'blog',
		'category',
		'custom-words',
		'demo',
		'frequency',
		'game',
		'homophones',
		'japanese-emoji',
		'learning',
		'learning-resources',
		'lists',
		'login',
		'phonetic',
		'privacy',
		'reel',
		'research',
		'search',
		'sentence',
		'study',
		'test',
		'terms',
		'users'
	]);

	let routeLoading = $state(false);
	let pendingRouteLabel = $state('');
	let routeLoadingFallback: ReturnType<typeof setTimeout> | null = null;

	function labelForRoute(url: URL): string {
		const pathSegments = url.pathname.split('/').filter(Boolean);
		if (pathSegments.length !== 1) return '';
		const [segment] = pathSegments;
		if (dictionaryRouteExclusions.has(segment)) return '';

		try {
			return decodeURIComponent(segment);
		} catch {
			return segment;
		}
	}

	function sameDocumentTarget(url: URL): boolean {
		return url.pathname === window.location.pathname && url.search === window.location.search;
	}

	function showRouteLoading(url: URL): void {
		if (sameDocumentTarget(url)) return;

		pendingRouteLabel = labelForRoute(url);
		routeLoading = true;

		if (routeLoadingFallback) clearTimeout(routeLoadingFallback);
		routeLoadingFallback = setTimeout(() => {
			routeLoading = false;
			pendingRouteLabel = '';
			routeLoadingFallback = null;
		}, 10000);
	}

	function hideRouteLoading(): void {
		routeLoading = false;
		pendingRouteLabel = '';

		if (routeLoadingFallback) {
			clearTimeout(routeLoadingFallback);
			routeLoadingFallback = null;
		}
	}

	beforeNavigate((navigation) => {
		if (navigation.willUnload || !navigation.to?.url) return;

		showRouteLoading(navigation.to.url);
		void navigation.complete.finally(hideRouteLoading);
	});

	afterNavigate(hideRouteLoading);

	onMount(() => {
		const isCapacitor = window.location.protocol === 'capacitor:';
		document.documentElement.classList.toggle('capacitor-native', isCapacitor);

		const handleClick = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}

			const target = event.target instanceof Element ? event.target : null;
			const anchor = target?.closest('a[href]');
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target || anchor.download) return;

			const url = new URL(anchor.href);
			if (url.origin !== window.location.origin) return;

			showRouteLoading(url);
		};

		document.addEventListener('click', handleClick, { capture: true });

		async function installClientIntegrations() {
			if (isCapacitor) {
				const { installCapacitorOfflineBridge } = await import('$lib/native/capacitor-offline');
				void installCapacitorOfflineBridge();
				return;
			}

			if ('modelContext' in navigator) {
				const { registerWebMCPTools } = await import('$lib/webmcp-tools');
				void registerWebMCPTools();
			}
		}

		void installClientIntegrations();

		return () => document.removeEventListener('click', handleClick, { capture: true });
	});
</script>

<svelte:head>
	<script>
		// Prevent flash of unstyled content by applying theme immediately
		(function() {
			const theme = localStorage.getItem('theme') || 'dark';
			document.documentElement.setAttribute('data-theme', theme);
			document.querySelector('#theme-color')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f8f9fa');
			if (window.location.protocol === 'capacitor:') {
				document.documentElement.classList.add('capacitor-native');
			}
		})();
	</script>
</svelte:head>

<KeyboardShortcuts />
<SeoMeta />
<a class="skip-link" href="#main-content">Skip to content</a>
{#if routeLoading}
	<div class="route-loading" aria-live="polite" aria-busy="true">
		<div class="route-loading-bar"></div>
		<div class="route-loading-panel">
			<div class="route-loading-spinner"></div>
			{#if pendingRouteLabel}
				<div class="route-loading-label">{pendingRouteLabel}</div>
			{/if}
		</div>
	</div>
{/if}
{@render children()}

<style>
	.route-loading {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.34);
		backdrop-filter: blur(2px);
	}

	.route-loading-bar {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 2px;
		overflow: hidden;
		background: var(--bg-tertiary);
	}

	.route-loading-bar::after {
		content: '';
		position: absolute;
		inset: 0;
		width: 42%;
		background: var(--accent);
		animation: route-loading-bar 1s ease-in-out infinite;
	}

	.route-loading-panel {
		display: flex;
		min-width: 92px;
		min-height: 92px;
		max-width: min(220px, calc(100vw - 48px));
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		box-shadow: 0 16px 40px var(--shadow);
	}

	.route-loading-spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: var(--radius-full);
		animation: route-loading-spin 0.75s linear infinite;
	}

	.route-loading-label {
		max-width: 100%;
		overflow: hidden;
		color: var(--text-primary);
		font-family: var(--font-cjk);
		font-size: var(--font-size-headline);
		font-weight: 600;
		line-height: 1.15;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@keyframes route-loading-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes route-loading-bar {
		0% {
			transform: translateX(-120%);
		}
		100% {
			transform: translateX(240%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.route-loading-spinner,
		.route-loading-bar::after {
			animation: none;
		}
	}
</style>
