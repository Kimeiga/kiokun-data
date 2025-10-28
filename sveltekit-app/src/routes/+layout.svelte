<script lang="ts">
	import type { LayoutData } from './$types';
	import '../app.css';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<svelte:head>
	<script>
		// Prevent flash of unstyled content by applying theme immediately
		(function() {
			const theme = localStorage.getItem('theme') || 'dark';
			document.documentElement.setAttribute('data-theme', theme);
		})();
	</script>
</svelte:head>

{@render children()}

