import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
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

