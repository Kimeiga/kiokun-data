import { createAuth } from "$lib/server/auth";
import type { RequestEvent } from "@sveltejs/kit";

export async function GET(event: RequestEvent) {
	return handleAuth(event);
}

export async function POST(event: RequestEvent) {
	return handleAuth(event);
}

async function handleAuth(event: RequestEvent) {
	const auth = createAuth(event.platform!.env.DB, {
		GOOGLE_CLIENT_ID: event.platform!.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: event.platform!.env.GOOGLE_CLIENT_SECRET,
		BASE_URL: event.platform!.env.BASE_URL || event.url.origin,
	});

	return auth.handler(event.request);
}

