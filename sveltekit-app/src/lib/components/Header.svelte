<script lang="ts">
	import { slide, fade } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import ThemeToggle from "./ThemeToggle.svelte";
	import AuthButton from "./AuthButton.svelte";
	import LanguageToggle from "./LanguageToggle.svelte";
	import HandwritingInput from "./HandwritingInput.svelte";
	import { useSession } from "$lib/auth-client";
	import { navigateOrSearch } from "$lib/utils/search-navigation";
	import SearchDropdown from "./SearchDropdown.svelte";

	let handwritingInput: HandwritingInput;
	let handwritingOpen = $state(false);

	let { currentWord = "", autofocus = false, isHomePage = false }: { currentWord?: string; autofocus?: boolean; isHomePage?: boolean } = $props();

	// Search bar starts empty — user types to search
	let internalSearchValue = $state("");
	let mobileMenuOpen = $state(false);
	const session = useSession();

	async function handleSearch(event: KeyboardEvent) {
		if (event.key === "Enter") {
			const word = internalSearchValue.trim();
			if (word) {
				await navigateOrSearch(word);
			}
		}
	}

	async function doSearch() {
		const word = internalSearchValue.trim();
		if (word) {
			await navigateOrSearch(word);
		}
	}

	function handleHandwritingSelect(char: string) {
		internalSearchValue += char;
	}

	function toggleHandwriting() {
		handwritingOpen = !handwritingOpen;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<header
	class="bg-bg-primary/95 backdrop-blur-md border-b border-border sticky top-0 z-[100]"
>
	<div
		class="max-w-[1400px] mx-auto px-3 py-2 md:px-5 md:py-3 flex items-center justify-between gap-2 md:gap-4"
	>
		<!-- Logo -->
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

		{#if !isHomePage}
			<!-- Search Bar with draw + search buttons (not on home page) -->
			<div class="flex-1 max-w-[600px] min-w-0 relative">
				<div class="flex gap-1.5 items-center">
					<div class="flex-1 relative">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							class="w-full pl-3 pr-3 py-1.5 md:pl-5 md:pr-4 md:py-2.5 border border-border-light rounded-full text-sm md:text-base bg-bg-tertiary text-text-primary font-sans transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-text-muted"
							placeholder="Search..."
							bind:value={internalSearchValue}
							onkeydown={handleSearch}
							onfocus={(e) => e.currentTarget.select()}
							onblur={() => setTimeout(() => {}, 200)}
							autofocus={autofocus}
						/>
						<SearchDropdown bind:value={internalSearchValue} />
					</div>
					{#if internalSearchValue.trim()}
						<button
							onclick={doSearch}
							class="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-accent text-white shrink-0 cursor-pointer transition-opacity hover:opacity-80"
							title="Search"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
						</button>
					{/if}
					<button
						onclick={toggleHandwriting}
						class="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full shrink-0 cursor-pointer transition-colors duration-150 border"
						class:bg-accent={handwritingOpen}
						class:text-white={handwritingOpen}
						class:border-accent={handwritingOpen}
						class:bg-bg-secondary={!handwritingOpen}
						class:text-text-tertiary={!handwritingOpen}
						class:border-border={!handwritingOpen}
						class:hover:text-accent={!handwritingOpen}
						class:hover:border-accent={!handwritingOpen}
						title="Draw Character"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
					</button>
				</div>
				<HandwritingInput bind:this={handwritingInput} bind:visible={handwritingOpen} onSelect={handleHandwritingSelect} />
			</div>
		{:else}
			<!-- Spacer on home page to push nav to the right -->
			<div class="flex-1"></div>
		{/if}

		<!-- Nav Actions: desktop only, mobile uses hamburger menu -->
		<div class="hidden md:flex items-center gap-2 md:gap-3 shrink-0">
			{#if !isHomePage}
				<LanguageToggle compact={true} />
			{/if}
			<a
				href="/learning"
				class="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-bg-secondary border border-border text-lg md:text-xl no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
				title="Learning — resources, study, artifacts & community"
			>
				🎓
			</a>
			<a
				href="/blog"
				class="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-bg-secondary border border-border text-lg md:text-xl no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
				title="The Kiokun Notebook — engineering blog"
			>
				📓
			</a>
			{#if $session.data?.user}
				<a
					href="/lists"
					class="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-bg-secondary border border-border text-lg md:text-xl no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
					title="My Notes"
				>
					📝
				</a>
			{/if}
			<AuthButton />
			<ThemeToggle />
		</div>

		<!-- Mobile Hamburger Button -->
		<button
				class="md:hidden flex items-center justify-center w-11 h-11 rounded-lg bg-bg-secondary border border-border text-text-primary transition-colors duration-150 hover:border-accent shrink-0 relative"
				onclick={toggleMobileMenu}
				aria-label="Toggle menu"
			>
				{#if mobileMenuOpen}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="absolute"
						in:fade={{ duration: 150, delay: 100 }}
						out:fade={{ duration: 100 }}
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="absolute"
						in:fade={{ duration: 150, delay: 100 }}
						out:fade={{ duration: 100 }}
					>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				{/if}
			</button>
	</div>

	<!-- Mobile Menu Dropdown with slide animation -->
	{#if mobileMenuOpen}
		<div
			class="md:hidden border-t border-border bg-bg-primary/98 backdrop-blur-md overflow-hidden"
			transition:slide={{ duration: 250, easing: cubicOut }}
		>
			<div class="max-w-[1400px] mx-auto px-4 py-3 flex flex-col gap-3">
				<!-- Navigation Links -->
				<a
					href="/learning"
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
					onclick={closeMobileMenu}
				>
					<span class="text-lg">🎓</span>
					<span class="text-sm font-medium">Learning</span>
				</a>

				<a
					href="/blog"
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
					onclick={closeMobileMenu}
				>
					<span class="text-lg">📓</span>
					<span class="text-sm font-medium">Notebook</span>
				</a>

				{#if $session.data?.user}
					<a
						href="/lists"
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-colors duration-150 hover:border-accent hover:text-accent"
						onclick={closeMobileMenu}
					>
						<span class="text-lg">📝</span>
						<span class="text-sm font-medium">My Notes</span>
					</a>
				{/if}

				<!-- Language Toggle -->
				<div class="pt-2 border-t border-border">
					<LanguageToggle compact={false} />
				</div>

				<!-- Auth and Theme Row -->
				<div class="flex items-center justify-between gap-3 pt-2 border-t border-border">
					<AuthButton />
					<ThemeToggle />
				</div>
			</div>
		</div>
	{/if}
</header>

