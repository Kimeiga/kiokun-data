# Better Auth Session State Fix

## Problem

The Google login state was inconsistent - sometimes it worked on initial page load, sometimes only after reload, and vice versa. This was caused by a **race condition** in how Better Auth's client-side session was being initialized.

## Root Cause

Better Auth's Svelte client (`useSession()`) fetches the session asynchronously when the app loads. However, components that use `useSession()` may mount and render before the session fetch completes, causing them to initially see a `null` session even when the user is logged in.

### The Race Condition

1. **Page loads** → SvelteKit renders the app
2. **Components mount** → `AuthButton.svelte`, `Notes.svelte` call `useSession()`
3. **Better Auth client** → Starts fetching `/api/auth/get-session` in the background
4. **Race!** → Sometimes the fetch completes before components render, sometimes after

This resulted in:
- ✅ **Works on reload**: Session was cached, so `useSession()` had data immediately
- ❌ **Doesn't work initially**: Session fetch was still in progress when components checked auth state
- ❌ **Works initially but not on reload**: Opposite timing issue

## Solution

We implemented a **two-part fix** to ensure the session is properly handled:

### 1. Correct Better Auth Client Configuration (`auth-client.ts`)

```typescript
// sveltekit-app/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
	// CRITICAL: baseURL must point to the auth API endpoint, not just the origin
	baseURL: typeof window !== "undefined" ? `${window.location.origin}/api/auth` : "/api/auth",
	fetchOptions: {
		onError(context) {
			console.error("Auth fetch error:", context.error);
		},
	},
});

export const {
	signIn,
	signOut,
	useSession,
} = authClient;
```

**Why**: The `baseURL` must include `/api/auth` so Better Auth knows where to find the authentication endpoints. Previously it was set to just the origin, causing 404 errors when trying to fetch the session.

### 2. Reactive Session Handling in Components (`Notes.svelte` example)

```typescript
// sveltekit-app/src/lib/components/Notes.svelte
const session = useSession();
let notes = $state<Note[]>([]);
let myNote = $state<Note | null>(null);
let otherNotes = $state<Note[]>([]);
let hasAttemptedLoad = $state(false);

// Wait for session to be ready, then load notes once
// Re-separate notes if session changes (user logs in/out)
$effect(() => {
	const userId = $session.data?.user?.id;

	if ($session.data !== undefined) {
		if (!hasAttemptedLoad) {
			// First load - fetch notes from API
			hasAttemptedLoad = true;
			loadNotes();
		} else if (notes.length > 0) {
			// Session changed after initial load - re-separate notes without re-fetching
			if (userId) {
				myNote = notes.find((n) => n.userId === userId) || null;
				otherNotes = notes.filter((n) => n.userId !== userId);
			} else {
				myNote = null;
				otherNotes = notes;
			}
		}
	}
});
```

**Why**: This single `$effect()` handles both initial load and session changes:
- Waits for session to be ready (`$session.data !== undefined`) before loading
- Loads notes only once when session is ready
- Re-separates notes when session changes (login/logout) without re-fetching
- Avoids race conditions and double-fetching

### 3. Server-Side Session Passing (`+layout.server.ts`)

```typescript
// sveltekit-app/src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		session: locals.session,
		isAdmin: locals.isAdmin
	};
};
```

**Why**: This makes server-side session data available to the client through SvelteKit's data loading mechanism, useful for SSR and debugging.

## How It Works Now

1. **Server renders** → `hooks.server.ts` gets session from Better Auth
2. **Server loads data** → `+layout.server.ts` passes session to client
3. **Client hydrates** → `+layout.svelte` immediately fetches fresh session
4. **Components mount** → `useSession()` has data ready (either from cache or fresh fetch)

## Testing

To verify the fix works:

1. **Clear cookies** and reload → Should show signed-out state
2. **Sign in with Google** → Should immediately show user info
3. **Reload page** → Should maintain signed-in state
4. **Navigate between pages** → Session should persist
5. **Open in new tab** → Should show correct auth state

## Technical Details

### Better Auth Session Flow

```
┌─────────────────┐
│  Browser Load   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ hooks.server.ts │ ← Checks session cookie
│ (Server-side)   │   via Better Auth API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│+layout.server.ts│ ← Passes session to client
│ (Server-side)   │   via SvelteKit data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ +layout.svelte  │ ← Fetches fresh session
│ (Client-side)   │   from /api/auth/get-session
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  useSession()   │ ← Returns session store
│  (Components)   │   with reactive data
└─────────────────┘
```

### Session Cookie

Better Auth stores the session in an HTTP-only cookie named `better-auth.session_token`. This cookie is:
- **Secure**: Only sent over HTTPS in production
- **HttpOnly**: Not accessible via JavaScript (prevents XSS)
- **SameSite**: Protects against CSRF attacks

## Common Issues

### Session not persisting after reload

**Cause**: Cookies might be blocked or cleared
**Fix**: Check browser settings, ensure HTTPS in production

### "Unauthorized" errors

**Cause**: Session cookie not being sent with requests
**Fix**: Verify `trustedOrigins` in `auth.ts` includes your domain

### Session shows old data

**Cause**: Client-side cache not invalidating
**Fix**: The `authClient.$fetch()` call in `+layout.svelte` should refresh it

## Related Files

- `sveltekit-app/src/routes/+layout.server.ts` - Server-side session loading
- `sveltekit-app/src/routes/+layout.svelte` - Client-side session initialization
- `sveltekit-app/src/lib/auth-client.ts` - Better Auth client configuration
- `sveltekit-app/src/lib/server/auth.ts` - Better Auth server configuration
- `sveltekit-app/src/hooks.server.ts` - Request-level session handling

## References

- [Better Auth Documentation](https://www.better-auth.com/)
- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- [SvelteKit Hooks](https://kit.svelte.dev/docs/hooks)

