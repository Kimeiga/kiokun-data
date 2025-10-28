<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import AuthButton from './AuthButton.svelte';
	import { useSession } from '$lib/auth-client';
	import { navigateOrSearch } from '$lib/utils/search-navigation';

	let { currentWord = '' }: { currentWord?: string } = $props();
	let searchValue = $state(currentWord);
	const session = useSession();

	async function handleSearch(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const word = searchValue.trim();
			if (word) {
				await navigateOrSearch(word);
			}
		}
	}

	// Update searchValue when currentWord changes
	$effect(() => {
		searchValue = currentWord;
	});
</script>

<header class="bg-primary-secondary shadow sticky top-0 z-[100] transition-all duration-300">
	<div class="max-w-[1400px] mx-auto px-3 py-2 md:px-5 md:py-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-6">
		<!-- Logo and Brand -->
		<a href="/" class="flex items-center gap-3 no-underline transition-opacity duration-200 hover:opacity-80 justify-self-center md:justify-self-start">
			<img src="/logo.svg" alt="Kiokun Logo" class="w-8 h-8 md:w-10 md:h-10" />
			<span class="text-xl md:text-2xl font-bold text-text-primary tracking-tight">Kiokun</span>
		</a>

		<!-- Search Bar -->
		<div class="max-w-[600px] w-full justify-self-stretch md:justify-self-center">
			<input
				type="text"
				class="w-full px-4 py-2 md:px-5 md:py-2.5 border-2 border-border rounded-full text-base bg-primary text-text-primary font-cjk transition-all duration-300 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-light)] placeholder:text-text-muted"
				placeholder="Search for a character or word..."
				bind:value={searchValue}
				onkeydown={handleSearch}
			/>
		</div>

		<!-- Actions (Lists, Auth & Theme Toggle) -->
		<div class="flex items-center gap-3 justify-self-center md:justify-self-end">
			<a
				href="/users"
				class="flex items-center justify-center w-10 h-10 rounded-full bg-primary border-2 border-border text-xl no-underline transition-all duration-200 hover:border-accent hover:bg-[var(--accent-light)] hover:scale-105"
				title="Community"
			>
				👥
			</a>
			{#if $session.data?.user}
				<a
					href="/lists"
					class="flex items-center justify-center w-10 h-10 rounded-full bg-primary border-2 border-border text-xl no-underline transition-all duration-200 hover:border-accent hover:bg-[var(--accent-light)] hover:scale-105"
					title="My Notes"
				>
					📝
				</a>
			{/if}
			<AuthButton />
			<ThemeToggle />
		</div>
	</div>
</header>

