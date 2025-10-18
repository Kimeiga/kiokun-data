<script lang="ts">
	let { children } = $props();
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

<style>
	:global(:root) {
		/* Light theme colors */
		--bg-primary: #f8f9fa;
		--bg-secondary: #ffffff;
		--bg-tertiary: #f8f9fa;
		--text-primary: #333333;
		--text-secondary: #6c757d;
		--text-tertiary: #555555;
		--text-muted: #95a5a6;
		--border-color: #e9ecef;
		--border-light: #e0e0e0;
		--shadow: rgba(0, 0, 0, 0.1);
		--shadow-hover: rgba(0, 0, 0, 0.15);
		--accent: #3498db;
		--accent-light: rgba(52, 152, 219, 0.1);

		/* Specific colors */
		--color-heading: #2c3e50;
		--color-pinyin: #3498db;
		--color-onyomi: #e74c3c;
		--color-kunyomi: #27ae60;
		--color-separator: #bdc3c7;
		--color-gloss: #27ae60;
		--color-hint-bg: #fff3cd;
		--color-hint-border: #ffc107;
		--color-hint-text: #856404;
		--color-stroke: #2c3e50;
		--color-outline: #e0e0e0;

		/* Tag colors - light theme */
		--tag-pos-bg: #e9ecef;
		--tag-pos-text: #6c757d;
		--tag-misc-bg: #fff3cd;
		--tag-misc-text: #856404;
		--tag-inline-bg: #e3f2fd;
		--tag-inline-text: #1976d2;
		--badge-hsk-bg: #3498db;
		--badge-hsk-text: #ffffff;
		--badge-movie-bg: #e3f2fd;
		--badge-movie-text: #1976d2;
		--badge-book-bg: #f3e5f5;
		--badge-book-text: #7b1fa2;

		/* Progress bars */
		--progress-bg: #e0e0e0;
		--progress-movie: linear-gradient(90deg, #1976d2, #42a5f5);
		--progress-book: linear-gradient(90deg, #7b1fa2, #ba68c8);
		--progress-word-bg: linear-gradient(90deg, #e3f2fd, #bbdefb);

		/* Toggle button colors */
		--toggle-bg: #ffffff;
		--toggle-border: #e9ecef;
		--toggle-color: #333333;
		--toggle-shadow: rgba(0, 0, 0, 0.1);
		--toggle-shadow-hover: rgba(0, 0, 0, 0.2);
	}

	:global([data-theme='dark']) {
		/* Dark theme colors */
		--bg-primary: #1a1a1a;
		--bg-secondary: #2d2d2d;
		--bg-tertiary: #252525;
		--text-primary: #e4e4e4;
		--text-secondary: #a0a0a0;
		--text-tertiary: #b8b8b8;
		--text-muted: #707070;
		--border-color: #404040;
		--border-light: #3a3a3a;
		--shadow: rgba(0, 0, 0, 0.3);
		--shadow-hover: rgba(0, 0, 0, 0.5);
		--accent: #5dade2;
		--accent-light: rgba(93, 173, 226, 0.15);

		/* Specific colors */
		--color-heading: #e4e4e4;
		--color-pinyin: #5dade2;
		--color-onyomi: #ff6b6b;
		--color-kunyomi: #51cf66;
		--color-separator: #606060;
		--color-gloss: #51cf66;
		--color-hint-bg: #3a3520;
		--color-hint-border: #d4a017;
		--color-hint-text: #f0d090;
		--color-stroke: #e4e4e4;
		--color-outline: #404040;

		/* Tag colors - dark theme */
		--tag-pos-bg: #3a3a3a;
		--tag-pos-text: #b0b0b0;
		--tag-misc-bg: #4a4020;
		--tag-misc-text: #f0d090;
		--tag-inline-bg: #2a4a5a;
		--tag-inline-text: #7ec8f0;
		--badge-hsk-bg: #5dade2;
		--badge-hsk-text: #1a1a1a;
		--badge-movie-bg: #2a4a5a;
		--badge-movie-text: #7ec8f0;
		--badge-book-bg: #4a2a5a;
		--badge-book-text: #d4a0e0;

		/* Progress bars */
		--progress-bg: #3a3a3a;
		--progress-movie: linear-gradient(90deg, #4a7ba7, #6ba3d0);
		--progress-book: linear-gradient(90deg, #8b5fa2, #b88fc8);
		--progress-word-bg: linear-gradient(90deg, #2a4a5a, #3a5a6a);

		/* Toggle button colors */
		--toggle-bg: #2d2d2d;
		--toggle-border: #404040;
		--toggle-color: #e4e4e4;
		--toggle-shadow: rgba(0, 0, 0, 0.3);
		--toggle-shadow-hover: rgba(0, 0, 0, 0.6);
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		line-height: 1.6;
		color: var(--text-primary);
		background: var(--bg-primary);
		transition: background-color 0.3s ease, color 0.3s ease;
	}
</style>

