import type { Config } from "drizzle-kit";

export default {
	schema: "./src/lib/server/db/schema.ts",
	out: "./migrations",
	dialect: "sqlite",
	driver: "d1-http",
} satisfies Config;

