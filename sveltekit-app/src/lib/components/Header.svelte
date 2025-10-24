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

<header class="header">
	<div class="header-content">
		<!-- Logo and Brand -->
		<a href="/" class="logo-section">
			<img src="/logo.svg" alt="Kiokun Logo" class="logo" />
			<span class="brand-name">Kiokun</span>
		</a>

		<!-- Search Bar -->
		<div class="search-section">
			<input
				type="text"
				class="search-box"
				placeholder="Search for a character or word..."
				bind:value={searchValue}
				onkeydown={handleSearch}
			/>
		</div>

		<!-- Actions (Lists, Auth & Theme Toggle) -->
		<div class="actions-section">
			<a href="/users" class="users-link" title="Community">
				👥
			</a>
			{#if $session.data?.user}
				<a href="/lists" class="lists-link" title="My Notes">
					📝
				</a>
			{/if}
			<AuthButton />
			<ThemeToggle />
		</div>
	</div>
</header>

<style>
	.header {
		background: var(--bg-secondary);
		box-shadow: 0 2px 10px var(--shadow);
		position: sticky;
		top: 0;
		z-index: 100;
		transition: background-color 0.3s ease, box-shadow 0.3s ease;
	}

	.header-content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 12px 20px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 24px;
	}

	.logo-section {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		transition: opacity 0.2s ease;
	}

	.logo-section:hover {
		opacity: 0.8;
	}

	.logo {
		width: 40px;
		height: 40px;
	}

	.brand-name {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.5px;
	}

	.search-section {
		max-width: 600px;
		width: 100%;
		justify-self: center;
	}

	.search-box {
		width: 100%;
		padding: 10px 20px;
		border: 2px solid var(--border-color);
		border-radius: 24px;
		font-size: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family: 'SimSun', 'MS Mincho', serif;
		transition: all 0.3s ease;
	}

	.search-box:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-light);
	}

	.search-box::placeholder {
		color: var(--text-muted);
	}

	.actions-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.users-link,
	.lists-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		font-size: 20px;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.users-link:hover,
	.lists-link:hover {
		border-color: var(--accent);
		background: var(--accent-light);
		transform: scale(1.05);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.header-content {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.logo-section {
			justify-self: center;
		}

		.search-section {
			justify-self: stretch;
		}

		.actions-section {
			justify-self: center;
		}

		.brand-name {
			font-size: 20px;
		}

		.logo {
			width: 32px;
			height: 32px;
		}
	}
</style>

