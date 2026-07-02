<script lang="ts">
	import type { LayoutData } from './$types';
	import '../app.css';
	import { onMount } from 'svelte';
	import { registerWebMCPTools } from '$lib/webmcp-tools';
	import { installCapacitorOfflineBridge } from '$lib/native/capacitor-offline';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';

	let { children, data }: { children: any; data: LayoutData } = $props();

	// Register WebMCP tools for AI assistant integration
	onMount(() => {
		const isCapacitor = window.location.protocol === 'capacitor:';
		document.documentElement.classList.toggle('capacitor-native', isCapacitor);
		void installCapacitorOfflineBridge();
		if (!isCapacitor) {
			registerWebMCPTools();
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
