<script lang="ts">
	import { signIn, signOut, useSession } from "$lib/auth-client";

	const session = useSession();

	async function handleSignIn() {
		await signIn.social({
			provider: "google",
			callbackURL: "/",
		});
	}

	async function handleSignOut() {
		await signOut();
	}
</script>

<div class="auth-button">
	{#if $session.data?.user}
		<div class="user-info">
			{#if $session.data.user.image}
				<img src={$session.data.user.image} alt={$session.data.user.name} class="user-avatar" />
			{/if}
			<span class="user-name">{$session.data.user.name}</span>
			<button onclick={handleSignOut} class="sign-out-btn">Sign Out</button>
		</div>
	{:else}
		<button onclick={handleSignIn} class="sign-in-btn">
			<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
				<path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
				<path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
				<path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
				<path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
			</svg>
			Sign in with Google
		</button>
	{/if}
</div>

<style>
	.auth-button {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
	}

	.user-name {
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.sign-in-btn,
	.sign-out-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.sign-in-btn:hover,
	.sign-out-btn:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-light);
	}

	.sign-out-btn {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
	}
</style>

