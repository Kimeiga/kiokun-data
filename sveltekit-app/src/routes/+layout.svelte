<script lang="ts">
	import type { LayoutData } from './$types';
	import '../app.css';
	import { onMount } from 'svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';

	let { children, data }: { children: any; data: LayoutData } = $props();

	onMount(async () => {
		const isCapacitor = window.location.protocol === 'capacitor:';
		document.documentElement.classList.toggle('capacitor-native', isCapacitor);

		if (isCapacitor) {
			const { installCapacitorOfflineBridge } = await import('$lib/native/capacitor-offline');
			void installCapacitorOfflineBridge();
			return;
		}

		if ('modelContext' in navigator) {
			const { registerWebMCPTools } = await import('$lib/webmcp-tools');
			void registerWebMCPTools();
		}
	});
</script>

<svelte:head>
	<script>
		// Prevent flash of unstyled content by applying theme immediately
		(function() {
			const theme = localStorage.getItem('theme') || 'dark';
			document.documentElement.setAttribute('data-theme', theme);
			if (window.location.protocol === 'capacitor:') {
				document.documentElement.classList.add('capacitor-native');
			}
		})();
	</script>
</svelte:head>

<KeyboardShortcuts />
{@render children()}
