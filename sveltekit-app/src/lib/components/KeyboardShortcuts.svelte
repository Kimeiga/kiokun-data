<script lang="ts">
	import { goto } from '$app/navigation';

	let showHelp = $state(false);

	const shortcuts: { key: string; description: string }[] = [
		{ key: '/', description: 'Focus search' },
		{ key: 'Cmd+K', description: 'Focus search' },
		{ key: '?', description: 'Show keyboard shortcuts' },
		{ key: 'Escape', description: 'Close modal / blur search' },
		{ key: 'h', description: 'Go to home' },
		{ key: 'r', description: 'Random character' }
	];

	function isEditing(event: KeyboardEvent): boolean {
		const target = event.target as HTMLElement;
		if (!target) return false;
		const tagName = target.tagName.toLowerCase();
		if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
		if (target.isContentEditable) return true;
		return false;
	}

	function handleKeydown(event: KeyboardEvent) {
		// Escape always works, even in inputs
		if (event.key === 'Escape') {
			if (showHelp) {
				showHelp = false;
				event.preventDefault();
				return;
			}
			const active = document.activeElement as HTMLElement | null;
			if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
				active.blur();
				event.preventDefault();
			}
			return;
		}

		// Cmd+K / Ctrl+K works everywhere
		if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			focusSearch();
			return;
		}

		// Don't trigger single-key shortcuts while editing
		if (isEditing(event)) return;

		if (event.key === '/') {
			event.preventDefault();
			focusSearch();
			return;
		}

		if (event.key === '?') {
			event.preventDefault();
			showHelp = !showHelp;
			return;
		}

		if (event.key === 'h' && !event.metaKey && !event.ctrlKey && !event.altKey) {
			event.preventDefault();
			goto('/');
			return;
		}

		if (event.key === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey) {
			event.preventDefault();
			window.dispatchEvent(new CustomEvent('random-character'));
			return;
		}
	}

	function focusSearch() {
		const input = document.querySelector('header input[type="text"]') as HTMLInputElement | null;
		if (input) {
			input.focus();
			input.select();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showHelp = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if showHelp}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="shortcut-overlay"
		role="dialog"
		aria-label="Keyboard shortcuts"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}
	>
		<div class="shortcut-modal">
			<div class="shortcut-header">
				<h2>Keyboard Shortcuts</h2>
				<button
					class="shortcut-close"
					onclick={() => (showHelp = false)}
					aria-label="Close shortcuts"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
			<ul class="shortcut-list">
				{#each shortcuts as shortcut}
					<li class="shortcut-item">
						<kbd class="shortcut-key">{shortcut.key}</kbd>
						<span class="shortcut-desc">{shortcut.description}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	.shortcut-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
	}

	.shortcut-modal {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: var(--spacing-lg);
		min-width: 280px;
		max-width: 360px;
		width: 90vw;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.shortcut-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
	}

	.shortcut-header h2 {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: 600;
		color: var(--text-primary);
	}

	.shortcut-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.shortcut-close:hover {
		color: var(--text-primary);
		border-color: var(--text-secondary);
	}

	.shortcut-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) 0;
		border-bottom: 1px solid var(--border-color);
	}

	.shortcut-item:last-child {
		border-bottom: none;
	}

	.shortcut-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		padding: 2px 8px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 5px;
		font-size: var(--font-size-footnote);
		font-family: inherit;
		color: var(--text-primary);
		line-height: 1.6;
	}

	.shortcut-desc {
		font-size: var(--font-size-caption1);
		color: var(--text-secondary);
	}
</style>
