import { createAuth } from "$lib/server/auth";
import { building } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	// Adapter Cloudflare intentionally throws when a prerenderable route reads
	// platform.env. Treat that environment like a public, signed-out request.
	let env: App.Platform['env'] | undefined;
	try {
		env = event.platform?.env;
		if (env) void env.GOOGLE_CLIENT_SECRET;
	} catch {
		env = undefined;
	}

	// Skip auth while building/prerendering and in local dev without bindings.
	if (building || !env?.GOOGLE_CLIENT_SECRET) {
		event.locals.session = null;
		event.locals.user = null;
		event.locals.isAdmin = true;
		return resolve(event);
	}

	// Get auth instance
	const auth = createAuth(env.DB, {
		GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
	});

	// Get session from request
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	// Add session and user to locals
	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	// Check if user is admin (hard-coded email check)
	if (event.locals.user) {
		const adminEmail = env.ADMIN_EMAIL || "hak7alp@gmail.com";
		event.locals.isAdmin = event.locals.user.email === adminEmail;
	} else {
		event.locals.isAdmin = false;
	}

	return resolve(event);
};
