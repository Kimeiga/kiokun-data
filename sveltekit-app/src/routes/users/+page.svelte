<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';

	interface User {
		id: string;
		name: string;
		email: string;
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

<svelte:head>
	<title>Users - Kiokun</title>
	<meta name="description" content="Browse all users and their notes" />
</svelte:head>

<Header currentWord="" />

<main class="users-page">
	<div class="container">
		<h1>Community Members</h1>
		<p class="subtitle">Explore notes from our community of learners</p>

		{#if loading}
			<div class="loading">
				<p>Loading users...</p>
			</div>
		{:else if error}
			<div class="error">
				<p>{error}</p>
			</div>
		{:else if users.length === 0}
			<div class="empty">
				<p>No users found</p>
			</div>
		{:else}
			<div class="users-grid">
				{#each users as user}
					<a href="/users/{user.id}" class="user-card">
						<div class="user-avatar">
							{#if user.image}
								<img src={user.image} alt={user.name} />
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
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 2rem 1rem;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.5rem;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		text-align: center;
	}

	.subtitle {
		text-align: center;
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-bottom: 3rem;
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary);
	}

	.error {
		color: #e74c3c;
	}

	.users-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.user-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.user-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px var(--shadow-hover);
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
		h1 {
			font-size: 2rem;
		}

		.users-grid {
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			gap: 1rem;
		}

		.user-card {
			padding: 1.25rem;
		}

		.user-avatar {
			width: 60px;
			height: 60px;
		}
	}
</style>

