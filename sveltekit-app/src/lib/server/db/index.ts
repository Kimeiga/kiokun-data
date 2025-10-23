import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
	if (!d1) {
		throw new Error("D1 database binding is not available. Make sure DB is bound in wrangler.toml");
	}
	return drizzle(d1, { schema });
}

export { schema };

