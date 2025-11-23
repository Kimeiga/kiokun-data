<script lang="ts">
	import ThemeToggle from "./ThemeToggle.svelte";
	import AuthButton from "./AuthButton.svelte";
	import { useSession } from "$lib/auth-client";
	import { navigateOrSearch } from "$lib/utils/search-navigation";

	let { currentWord = "" }: { currentWord?: string } = $props();
	let searchValue = $state(currentWord);
	const session = useSession();

	async function handleSearch(event: KeyboardEvent) {
		if (event.key === "Enter") {
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

<header
	class="bg-bg-primary/95 backdrop-blur-md border-b border-border sticky top-0 z-[100] transition-all duration-300"
>
	<div
		class="max-w-[1400px] mx-auto px-3 py-2 md:px-5 md:py-3 flex items-center justify-between gap-2 md:gap-6"
	>
		<!-- Logo and Brand -->
		<a
			href="/"
			class="flex items-center gap-2 md:gap-3 no-underline transition-opacity duration-200 hover:opacity-80 shrink-0"
		>
			<img
				src="/logo.svg"
				alt="Kiokun Logo"
				class="w-8 h-8 md:w-10 md:h-10"
			/>
			<span
				class="hidden md:block text-xl md:text-2xl font-bold text-text-primary tracking-tight"
				>Kiokun</span
			>
		</a>

		<!-- Search Bar -->
		<div class="flex-1 max-w-[600px] min-w-0">
			<input
				type="text"
				class="w-full px-3 py-1.5 md:px-5 md:py-2.5 border border-border rounded-full text-sm md:text-base bg-white dark:bg-black text-black dark:text-white font-cjk transition-all duration-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-text-muted"
				placeholder="Search..."
				bind:value={searchValue}
				onkeydown={handleSearch}
				onfocus={(e) => e.currentTarget.select()}
			/>
		</div>

		<!-- Actions (Lists, Auth & Theme Toggle) -->
		<div class="flex items-center gap-2 md:gap-3 shrink-0">
			<a
				href="/users"
				class="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-bg-secondary border border-border text-base md:text-xl no-underline transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105"
				title="Community"
			>
				👥
			</a>
			{#if $session.data?.user}
				<a
					href="/lists"
					class="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-bg-secondary border border-border text-base md:text-xl no-underline transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105"
					title="My Notes"
				>
					📝
				</a>
			{/if}
			<div class="scale-90 md:scale-100 origin-right">
				<AuthButton />
			</div>
			<div class="scale-90 md:scale-100 origin-right">
				<ThemeToggle />
			</div>
		</div>
	</div>
</header>
