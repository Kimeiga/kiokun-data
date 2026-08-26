<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fade, slide } from 'svelte/transition';
	import { navigateOrSearch } from '$lib/utils/search-navigation';
	import { useSession } from '$lib/auth-client';
	import AuthButton from './AuthButton.svelte';
	import HandwritingInput from './HandwritingInput.svelte';
	import LanguageToggle from './LanguageToggle.svelte';
	import SearchDropdown from './SearchDropdown.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let {
		currentWord = '',
		autofocus = false,
		isHomePage = false
	}: {
		currentWord?: string;
		autofocus?: boolean;
		isHomePage?: boolean;
	} = $props();

	let handwritingInput = $state<HandwritingInput>();
	let searchDropdown = $state<SearchDropdown>();
	let searchInput = $state<HTMLInputElement>();
	let handwritingOpen = $state(false);
	let searchDropdownOpen = $state(false);
	let searchActiveDescendant = $state('');
	let internalSearchValue = $state('');
	let mobileMenuOpen = $state(false);
	const session = useSession();

	function closeTransientPanels(): void {
		searchDropdown?.close();
		handwritingInput?.close();
		mobileMenuOpen = false;
	}

	async function navigateSearch(word: string): Promise<void> {
		closeTransientPanels();
		await navigateOrSearch(word);
	}

	async function handleSearch(event: KeyboardEvent): Promise<void> {
		if (searchDropdown?.handleKeydown(event)) return;
		if (event.key !== 'Enter') return;

		event.preventDefault();
		const word = internalSearchValue.trim();
		if (word) await navigateSearch(word);
	}

	async function doSearch(): Promise<void> {
		const word = internalSearchValue.trim();
		if (word) await navigateSearch(word);
	}

	function handleHandwritingSelect(character: string): void {
		internalSearchValue += character;
		searchInput?.focus();
	}

	function toggleHandwriting(): void {
		searchDropdown?.close();
		mobileMenuOpen = false;
		handwritingOpen = !handwritingOpen;
	}

	function toggleMobileMenu(): void {
		searchDropdown?.close();
		handwritingInput?.close();
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu(): void {
		mobileMenuOpen = false;
	}
</script>

<header class="app-header">
	<div class="app-header-inner">
		<a href="/" class="header-logo" aria-label="Kiokun home">
			<img src="/logo.svg" alt="" />
			<span>Kiokun</span>
		</a>

		{#if !isHomePage}
			<form
				class="header-search"
				role="search"
				onsubmit={(event) => {
					event.preventDefault();
					void doSearch();
				}}
			>
				<div class="header-search-field">
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="site-search"
						name="q"
						type="text"
						role="combobox"
						aria-label="Search the dictionary"
						aria-autocomplete="list"
						aria-controls="site-search-results"
						aria-expanded={searchDropdownOpen}
						aria-activedescendant={searchActiveDescendant || undefined}
						autocomplete="off"
						enterkeyhint="search"
						placeholder={currentWord ? `Search from ${currentWord}…` : 'Search…'}
						bind:value={internalSearchValue}
						bind:this={searchInput}
						onkeydown={handleSearch}
						onfocus={() => searchDropdown?.handleFocus()}
						onblur={() => searchDropdown?.handleBlur()}
						autofocus={autofocus}
					/>

					{#if internalSearchValue.trim()}
						<button type="submit" class="search-submit" aria-label="Search" title="Search">
							<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.3-4.3"/>
							</svg>
						</button>
					{/if}

					<SearchDropdown
						bind:this={searchDropdown}
						bind:value={internalSearchValue}
						bind:open={searchDropdownOpen}
						bind:activeDescendant={searchActiveDescendant}
						inputId="site-search"
						listboxId="site-search-results"
						onNavigate={closeTransientPanels}
					/>
				</div>

				<button
					type="button"
					class="draw-button"
					class:active={handwritingOpen}
					onclick={toggleHandwriting}
					title="Draw a character"
					aria-label="Draw a character"
					aria-expanded={handwritingOpen}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
					</svg>
				</button>

			</form>
		{:else}
			<div class="header-spacer"></div>
		{/if}

		<nav class="desktop-navigation" aria-label="Primary navigation">
			{#if !isHomePage}
				<LanguageToggle compact={true} />
			{/if}
			<a href="/game" class="nav-icon" title="Sentence game" aria-label="Sentence game">🎮</a>
			<a href="/tutor" class="nav-icon" title="AI translation tutor" aria-label="AI translation tutor">✍️</a>
			<a href="/learning" class="nav-icon" title="Learning" aria-label="Learning">🎓</a>
			<a href="/blog" class="nav-icon" title="The Kiokun Notebook" aria-label="The Kiokun Notebook">📓</a>
			{#if $session.data?.user}
				<a href="/lists" class="nav-icon" title="My notes" aria-label="My notes">📝</a>
			{/if}
			<AuthButton />
			<ThemeToggle />
		</nav>

		<button
			type="button"
			class="mobile-menu-button"
			onclick={toggleMobileMenu}
			aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
			aria-expanded={mobileMenuOpen}
			aria-controls="mobile-navigation"
		>
			{#if mobileMenuOpen}
				<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" in:fade={{ duration: 140 }} out:fade={{ duration: 80 }}>
					<path d="M18 6 6 18M6 6l12 12"/>
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" in:fade={{ duration: 140 }} out:fade={{ duration: 80 }}>
					<path d="M4 6h16M4 12h16M4 18h16"/>
				</svg>
			{/if}
		</button>
	</div>

	{#if mobileMenuOpen}
		<nav
			id="mobile-navigation"
			class="mobile-navigation"
			aria-label="Mobile navigation"
			transition:slide={{ duration: 220, easing: cubicOut }}
		>
			<div class="mobile-navigation-inner">
				<a href="/game" onclick={closeMobileMenu}><span aria-hidden="true">🎮</span>Sentence Game</a>
				<a href="/tutor" onclick={closeMobileMenu}><span aria-hidden="true">✍️</span>Translation Tutor</a>
				<a href="/learning" onclick={closeMobileMenu}><span aria-hidden="true">🎓</span>Learning</a>
				<a href="/blog" onclick={closeMobileMenu}><span aria-hidden="true">📓</span>Notebook</a>
				{#if $session.data?.user}
					<a href="/lists" onclick={closeMobileMenu}><span aria-hidden="true">📝</span>My Notes</a>
				{/if}

				<div class="mobile-settings">
					<LanguageToggle compact={false} />
				</div>
				<div class="mobile-account">
					<AuthButton />
					<ThemeToggle />
				</div>
			</div>
		</nav>
	{/if}
</header>

<HandwritingInput
	bind:this={handwritingInput}
	bind:visible={handwritingOpen}
	onSelect={handleHandwritingSelect}
/>

<style>
	.app-header {
		--kiokun-header-height: 3.75rem;
		position: sticky;
		z-index: 100;
		top: 0;
		border-bottom: 1px solid var(--border-color);
		background: color-mix(in srgb, var(--bg-primary) 94%, transparent);
		backdrop-filter: blur(12px);
	}

	.app-header-inner {
		display: flex;
		min-height: var(--kiokun-header-height);
		max-width: 87.5rem;
		align-items: center;
		gap: 0.5rem;
		margin: 0 auto;
		padding: 0.5rem;
	}

	.header-logo {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		color: var(--text-primary);
		text-decoration: none;
	}

	.header-logo img {
		width: 2.25rem;
		height: 2.25rem;
	}

	.header-logo span {
		display: none;
		font-size: 1.35rem;
		font-weight: 750;
		letter-spacing: -0.025em;
	}

	.header-spacer,
	.header-search {
		min-width: 0;
		flex: 1;
	}

	.header-search {
		position: relative;
		display: flex;
		max-width: 37.5rem;
		align-items: center;
		gap: 0.4rem;
	}

	.header-search-field {
		position: relative;
		min-width: 0;
		flex: 1;
	}

	.header-search input {
		width: 100%;
		height: 2.75rem;
		padding: 0 2.8rem 0 0.9rem;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		outline: 0;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font: inherit;
		font-size: 1rem;
		transition: border-color 140ms ease, box-shadow 140ms ease;
	}

	.header-search input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-light);
	}

	.header-search input::placeholder {
		color: var(--text-muted);
	}

	.search-submit {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		transform: translateY(-50%);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--bg-primary);
		cursor: pointer;
	}

	.draw-button,
	.mobile-menu-button,
	.nav-icon {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-full);
		background: var(--bg-secondary);
		color: var(--text-primary);
		text-decoration: none;
		cursor: pointer;
		transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
	}

	.draw-button:hover,
	.mobile-menu-button:hover,
	.nav-icon:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.draw-button.active {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--bg-primary);
	}

	.desktop-navigation {
		display: none;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.55rem;
	}

	.nav-icon {
		font-size: 1.15rem;
	}

	.mobile-menu-button {
		border-radius: var(--radius-md);
	}

	.mobile-navigation {
		overflow: hidden;
		border-top: 1px solid var(--border-color);
		background: var(--bg-primary);
	}

	.mobile-navigation-inner {
		display: grid;
		max-width: 87.5rem;
		gap: 0.5rem;
		margin: 0 auto;
		padding: 0.7rem 0.8rem 1rem;
	}

	.mobile-navigation a {
		display: flex;
		min-height: 2.75rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 650;
		text-decoration: none;
	}

	.mobile-settings,
	.mobile-account {
		padding-top: 0.65rem;
		border-top: 1px solid var(--border-color);
	}

	.mobile-account {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	:global(html.capacitor-native) .app-header-inner {
		padding-top: calc(var(--kiokun-safe-area-top) + 0.5rem);
	}

	@media (max-width: 360px) {
		.app-header-inner {
			gap: 0.3rem;
			padding-inline: 0.3rem;
		}

		.header-search input {
			padding-left: 0.75rem;
		}
	}

	@media (min-width: 768px) {
		.app-header {
			--kiokun-header-height: 4.5rem;
		}

		.app-header-inner {
			gap: 1rem;
			padding: 0.75rem 1.25rem;
		}

		.header-logo {
			width: auto;
			gap: 0.7rem;
		}

		.header-logo img {
			width: 2.5rem;
			height: 2.5rem;
		}

		.header-logo span {
			display: block;
		}

		.header-search input {
			padding-left: 1.1rem;
		}

		.desktop-navigation {
			display: flex;
		}

		.mobile-menu-button,
		.mobile-navigation {
			display: none;
		}

		:global(html.capacitor-native) .app-header-inner {
			padding-top: calc(var(--kiokun-safe-area-top) + 0.75rem);
		}
	}
</style>
