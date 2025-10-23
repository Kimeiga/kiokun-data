import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { D1Database } from "@cloudflare/workers-types";
import { getDb } from "./db";
import * as schema from "./db/schema";

export function createAuth(d1: D1Database, env: Record<string, string>) {
	const db = getDb(d1);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		emailAndPassword: {
			enabled: false, // We only want Google OAuth
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
		},
		// Better Auth will automatically detect the base URL from the request
		// This works for both local dev (any port) and production
		trustedOrigins: [
			"http://localhost:5173",
			"http://localhost:5174",
			"http://localhost:5175",
			"https://kiokun.pages.dev",
		],
	});
}

