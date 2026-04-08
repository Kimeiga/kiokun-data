<script lang="ts">
	import { useSession } from "$lib/auth-client";

	interface Props {
		word: string;
		language: 'zh' | 'ja' | 'ko';
		size?: 'sm' | 'md' | 'lg';
	}

	let { word, language, size = 'md' }: Props = $props();
	
	const session = useSession();
	
	let isSaved = $state(false);
	let isLoading = $state(false);
	let justSaved = $state(false);
	let showSignInHint = $state(false);

	// Check if card already exists on mount
	$effect(() => {
		if ($session.data?.user) {
			checkIfSaved();
		}
	});

	async function checkIfSaved() {
		try {
			const res = await fetch(`/api/study?due=false`);
			if (res.ok) {
				const data = await res.json();
				isSaved = data.cards?.some((c: { word: string }) => c.word === word) ?? false;
			}
		} catch (e) {
			console.error("Error checking study card:", e);
		}
	}

	async function toggleSave() {
		if (!$session.data?.user) {
			showSignInHint = true;
			setTimeout(() => showSignInHint = false, 3000);
			return;
		}

		isLoading = true;
		try {
			if (isSaved) {
				// Remove from study
				const res = await fetch('/api/study', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ word }),
				});
				if (res.ok) {
					isSaved = false;
				}
			} else {
				// Add to study
				const res = await fetch('/api/study', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ word, language }),
				});
				if (res.ok) {
					isSaved = true;
					justSaved = true;
					setTimeout(() => justSaved = false, 2000);
				}
			}
		} catch (e) {
			console.error("Error toggling study card:", e);
		} finally {
			isLoading = false;
		}
	}

	const sizeClasses = {
		sm: 'w-8 h-8 text-xs justify-center',
		md: 'px-3 py-1.5 text-sm gap-1.5',
		lg: 'px-4 py-2 text-base gap-2',
	};
</script>

<div class="relative inline-block">
	<button
		onclick={toggleSave}
		disabled={isLoading}
		class="inline-flex items-center rounded-full font-medium transition-colors duration-150
			{sizeClasses[size]}
			{isSaved
				? 'bg-accent/15 text-accent hover:bg-accent/25'
				: 'bg-accent/10 text-accent hover:bg-accent/20'}
			{isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
			{justSaved ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''}"
	>
		{#if isLoading}
			<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		{:else if isSaved}
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
			</svg>
		{:else}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
		{/if}
	</button>

	{#if showSignInHint}
		<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-bg-tertiary text-text-primary text-xs rounded-lg shadow-lg whitespace-nowrap z-10 border border-border">
			Sign in to save words
		</div>
	{/if}
</div>

