<script lang="ts">
	import { slide, fade } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import ThemeToggle from "./ThemeToggle.svelte";
	import AuthButton from "./AuthButton.svelte";
	import LanguageToggle from "./LanguageToggle.svelte";
	import HandwritingInput from "./HandwritingInput.svelte";
	import { useSession } from "$lib/auth-client";
	import { goto } from "$app/navigation";
	import { navigateOrSearch } from "$lib/utils/search-navigation";

	let handwritingInput: HandwritingInput;

	let { currentWord = "" }: { currentWord?: string } = $props();

	let cachedGlosses: Record<string, string> | null = null;

	async function goToRandomCharacter() {
		if (!cachedGlosses) {
			const res = await fetch("/game_data/component_glosses.json");
			if (!res.ok) return;
			cachedGlosses = await res.json();
		}
		const keys = Object.keys(cachedGlosses!);
		const char = keys[Math.floor(Math.random() * keys.length)];
		await goto(`/${char}`);
	}
	// Use internal state for search input, synced with currentWord via key
	let internalSearchValue = $state("");
	let mobileMenuOpen = $state(false);
	const session = useSession();

	// Sync internal value with prop when prop changes
	let lastCurrentWord = $state(currentWord);
	$effect(() => {
		if (currentWord !== lastCurrentWord) {
			internalSearchValue = currentWord;
			lastCurrentWord = currentWord;
		}
	});

	// Initialize on mount
	$effect(() => {
		internalSearchValue = currentWord;
	});

	async function handleSearch(event: KeyboardEvent) {
		if (event.key === "Enter") {
			const word = internalSearchValue.trim();
			if (word) {
				await navigateOrSearch(word);
			}
		}
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<header
	class="bg-bg-primary/95 backdrop-blur-md border-b border-border sticky top-0 z-[100] transition-all duration-300"
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

		<!-- Search Bar - Always visible and prioritized -->
		<div class="flex-1 max-w-[600px] min-w-0">
			<input
				type="text"
				class="w-full px-3 py-1.5 md:px-5 md:py-2.5 border border-border rounded-full text-sm md:text-base bg-white dark:bg-black text-black dark:text-white font-sans transition-all duration-300 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-text-muted"
				placeholder="Search..."
				bind:value={internalSearchValue}
				onkeydown={handleSearch}
				onfocus={(e) => e.currentTarget.select()}
			/>
		</div>

		<!-- Desktop Actions - Hidden on mobile -->
		<div class="hidden md:flex items-center gap-3 shrink-0">
			<button
				onclick={() => handwritingInput.open()}
				class="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary border border-border text-xl transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105 cursor-pointer"
				title="Draw Character"
			>
				&#9999;&#65039;
			</button>
			<LanguageToggle compact={true} />
			<a
				href="/users"
				class="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary border border-border text-xl no-underline transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105"
				title="Community"
			>
				👥
			</a>
			<a
				href="/study"
				class="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary border border-border text-xl no-underline transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105"
				title="Study"
			>
				📚
			</a>
			<button
				onclick={goToRandomCharacter}
				class="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary border border-border text-xl transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105 cursor-pointer"
				title="Random Character"
			>
				🎲
			</button>
			{#if $session.data?.user}
				<a
					href="/lists"
					class="flex items-center justify-center w-10 h-10 rounded-full bg-bg-secondary border border-border text-xl no-underline transition-all duration-200 hover:border-accent hover:text-accent hover:scale-105"
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
			class="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-bg-secondary border border-border text-text-primary transition-all duration-200 hover:border-accent shrink-0 relative"
			onclick={toggleMobileMenu}
			aria-label="Toggle menu"
		>
			{#if mobileMenuOpen}
				<!-- X icon with fade transition -->
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
				<!-- Hamburger icon with fade transition -->
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
				<button
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer w-full text-left"
					onclick={() => { closeMobileMenu(); handwritingInput.open(); }}
				>
					<span class="text-lg">&#9999;&#65039;</span>
					<span class="text-sm font-medium">Draw Character</span>
				</button>

				<a
					href="/users"
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-all duration-200 hover:border-accent hover:text-accent"
					onclick={closeMobileMenu}
				>
					<span class="text-lg">👥</span>
					<span class="text-sm font-medium">Community</span>
				</a>

				<a
					href="/study"
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-all duration-200 hover:border-accent hover:text-accent"
					onclick={closeMobileMenu}
				>
					<span class="text-lg">📚</span>
					<span class="text-sm font-medium">Study</span>
				</a>

				<button
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer w-full text-left"
					title="Random Character"
					onclick={() => { closeMobileMenu(); goToRandomCharacter(); }}
				>
					<span class="text-lg">🎲</span>
					<span class="text-sm font-medium">Random Character</span>
				</button>

				{#if $session.data?.user}
					<a
						href="/lists"
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary no-underline transition-all duration-200 hover:border-accent hover:text-accent"
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

<HandwritingInput bind:this={handwritingInput} />
