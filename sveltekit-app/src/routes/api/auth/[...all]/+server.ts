import { createAuth } from "$lib/server/auth";
import type { RequestEvent } from "@sveltejs/kit";

export async function GET(event: RequestEvent) {
	return handleAuth(event);
}

export async function POST(event: RequestEvent) {
	return handleAuth(event);
}

async function handleAuth(event: RequestEvent) {
	try {
		// Check if platform and env exist
		if (!event.platform?.env) {
			console.error("Platform or env is undefined");
			return new Response("Server configuration error", { status: 500 });
		}

		// Check if required env vars exist
		if (!event.platform.env.GOOGLE_CLIENT_ID || !event.platform.env.GOOGLE_CLIENT_SECRET) {
			console.error("Missing required environment variables");
			return new Response("Server configuration error", { status: 500 });
		}

		const auth = createAuth(event.platform.env.DB, {
			GOOGLE_CLIENT_ID: event.platform.env.GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: event.platform.env.GOOGLE_CLIENT_SECRET,
		});

		return auth.handler(event.request);
	} catch (error) {
		console.error("Auth handler error:", error);
		return new Response("Internal server error", { status: 500 });
	}
}

