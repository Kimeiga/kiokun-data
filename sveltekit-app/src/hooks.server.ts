import { createAuth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	// Get auth instance
	const auth = createAuth(event.platform!.env.DB, {
		GOOGLE_CLIENT_ID: event.platform!.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: event.platform!.env.GOOGLE_CLIENT_SECRET,
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
		const adminEmail = event.platform!.env.ADMIN_EMAIL || "hak7alp@gmail.com";
		event.locals.isAdmin = event.locals.user.email === adminEmail;
	} else {
		event.locals.isAdmin = false;
	}

	return resolve(event);
};

