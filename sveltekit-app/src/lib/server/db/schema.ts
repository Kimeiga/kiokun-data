import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

// Better Auth tables
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
	image: text("image"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", {
		mode: "timestamp",
	}),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }),
	updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// Notes table for user notes
// Each user can have ONE note per character (enforced by unique constraint)
export const notes = sqliteTable("notes", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	character: text("character").notNull(),
	noteText: text("noteText").notNull(), // Markdown supported
	isAdmin: integer("isAdmin", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	// Unique constraint: one note per user per character
	userCharacterUnique: unique().on(table.userId, table.character),
}));

// Study cards table for spaced repetition system (SRS)
// Tracks user's vocabulary learning with SM-2 algorithm fields
export const studyCards = sqliteTable("study_cards", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	word: text("word").notNull(), // The word/character being studied
	language: text("language").notNull(), // 'zh', 'ja', 'ko'
	// SM-2 algorithm fields
	easeFactor: integer("easeFactor", { mode: "number" }).notNull().default(250), // Stored as 250 = 2.5 (multiply by 100)
	interval: integer("interval").notNull().default(0), // Days until next review
	repetitions: integer("repetitions").notNull().default(0), // Successful reviews in a row
	nextReview: integer("nextReview", { mode: "timestamp" }).notNull(), // When to review next
	lastReviewed: integer("lastReviewed", { mode: "timestamp" }), // Last review time
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	// One card per user per word
	userWordUnique: unique().on(table.userId, table.word),
}));
