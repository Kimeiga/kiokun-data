<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';

	interface User {
		id: string;
		name: string;
		image: string | null;
		createdAt: Date;
		noteCount: number;
	}

	let users: User[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	async function loadUsers() {
		try {
			loading = true;
			error = '';
			const response = await fetch('/api/users');

			if (!response.ok) {
				throw new Error('Failed to load users');
			}

			users = await response.json();
		} catch (err) {
			error = 'Failed to load users';
			console.error('Error loading users:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadUsers();
	});

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
</script>

<Header currentWord="" />

<main id="main-content" class="users-page learner-page learner-page--wide">
	<div class="container">
		<div class="learner-intro">
			<h1>Community Notes</h1>
			<p>See how other learners explain characters in their own words and discover useful study notes.</p>
		</div>

		{#if loading}
			<div class="loading" role="status">
				<p>Loading learners…</p>
			</div>
		{:else if error}
			<div class="error" role="alert">
				<p>{error}. Please try again.</p>
			</div>
		{:else if users.length === 0}
			<div class="empty">
				<p>No users found</p>
			</div>
		{:else}
			<div class="users-grid divider-grid mobile-full-bleed">
				{#each users as user}
					<a href="/users/{user.id}" class="user-card divider-cell">
						<div class="user-avatar">
							{#if user.image}
								<img src={user.image} alt="" loading="lazy" decoding="async" />
							{:else}
								<div class="avatar-placeholder">
									{user.name.charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>
						<div class="user-info">
							<h2 class="user-name">{user.name}</h2>
							<p class="user-stats">
								{user.noteCount} {user.noteCount === 1 ? 'note' : 'notes'}
							</p>
							<p class="user-joined">
								Joined {formatDate(user.createdAt)}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</main>

<style>
	.users-page {
		min-height: calc(100dvh - var(--kiokun-header-height, 4.5rem));
		background: var(--bg-primary);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary);
	}

	.error {
		color: var(--color-error);
	}

	.users-grid {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		margin-top: 1.5rem;
	}

	.user-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s ease, border-color 0.15s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.user-card:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
	}

	.user-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		overflow: hidden;
		margin-bottom: 1rem;
		border: 3px solid var(--border-color);
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--accent);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: bold;
	}

	.user-info {
		width: 100%;
	}

	.user-name {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.user-stats {
		color: var(--accent);
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.user-joined {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.users-grid {
			grid-template-columns: 1fr;
		}

		.user-card {
			flex-direction: row;
			gap: 1rem;
			padding: 0.9rem;
			text-align: left;
		}

		.user-avatar {
			width: 60px;
			height: 60px;
			flex: 0 0 auto;
			margin: 0;
		}
	}
</style>
