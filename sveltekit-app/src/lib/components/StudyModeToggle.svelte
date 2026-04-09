<script lang="ts">
	import { browser } from '$app/environment';

	let studyMode = $state(false);
	let revealed = $state<Set<string>>(new Set());

	export function isStudyMode(): boolean { return studyMode; }

	function toggle() {
		studyMode = !studyMode;
		revealed = new Set();
		if (browser) {
			document.documentElement.classList.toggle('study-mode', studyMode);
		}
	}

	function reveal(id: string) {
		if (!studyMode) return;
		revealed = new Set([...revealed, id]);
	}

	// Expose reveal function globally so other components can use it
	$effect(() => {
		if (browser) {
			(window as any).__studyModeReveal = reveal;
			(window as any).__studyModeRevealed = revealed;
			(window as any).__isStudyMode = studyMode;
		}
	});
</script>

<button
	class="study-toggle"
	class:active={studyMode}
	onclick={toggle}
	title={studyMode ? 'Exit study mode' : 'Study mode — hide answers to test yourself'}
>
	{#if studyMode}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
	{:else}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
	{/if}
</button>

<!-- Global study mode CSS injected via style tag -->
{#if studyMode}
	{@html `<style id="study-mode-styles">
		/* Study mode: blur answers until tapped */
		.study-mode .study-hide {
			filter: blur(8px);
			transition: filter 0.2s;
			cursor: pointer;
			user-select: none;
		}
		.study-mode .study-hide:hover {
			filter: blur(4px);
		}
		.study-mode .study-hide.revealed,
		.study-mode .study-hide:active {
			filter: none;
		}
	</style>`}
{/if}

<style>
	.study-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}
	.study-toggle:hover {
		color: var(--accent);
		background: var(--accent-light);
	}
	.study-toggle.active {
		color: var(--accent);
		background: var(--accent-light);
	}
</style>
