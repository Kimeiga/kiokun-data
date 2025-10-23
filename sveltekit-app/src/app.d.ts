// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				id: string;
				userId: string;
				expiresAt: Date;
			} | null;
			user: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image?: string | null;
				createdAt: Date;
				updatedAt: Date;
			} | null;
			isAdmin: boolean;
		}
		// interface PageData {}
		interface Platform {
			env: {
				DB: D1Database;
				BUCKET: R2Bucket;
				R2_ACCESS_KEY_ID: string;
				R2_SECRET_ACCESS_KEY: string;
				R2_ACCOUNT_ID: string;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				BASE_URL?: string;
				ADMIN_EMAIL?: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};

