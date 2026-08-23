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
	isPublic: integer("isPublic", { mode: "boolean" }).notNull().default(false),
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

// Named, auto-composed deck membership is separate from SRS state so one card
// can appear in multiple study views without duplicating review progress.
export const studyCardDeckMemberships = sqliteTable("study_card_deck_memberships", {
	id: text("id").primaryKey(),
	cardId: text("cardId")
		.notNull()
		.references(() => studyCards.id, { onDelete: "cascade" }),
	deck: text("deck").notNull(), // 'searched-words' | 'searched-sentences'
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	cardDeckUnique: unique().on(table.cardId, table.deck),
}));

// The sentence where a learner encountered a card is first-class study data.
// A card may keep several examples while the review screen shows the latest.
export const studyCardContexts = sqliteTable("study_card_contexts", {
	id: text("id").primaryKey(),
	cardId: text("cardId")
		.notNull()
		.references(() => studyCards.id, { onDelete: "cascade" }),
	sentence: text("sentence").notNull(),
	translation: text("translation"),
	language: text("language").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	cardSentenceUnique: unique().on(table.cardId, table.sentence),
}));

export const userLearningSettings = sqliteTable("user_learning_settings", {
	userId: text("userId")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	autoSaveSentences: integer("autoSaveSentences", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const savedSentences = sqliteTable("saved_sentences", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	text: text("text").notNull(),
	language: text("language").notNull(), // 'zh', 'ja', 'ko'
	translation: text("translation"),
	pinyin: text("pinyin"),
	saveMode: text("saveMode").notNull().default("manual"), // 'manual' | 'auto'
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	userSentenceUnique: unique().on(table.userId, table.language, table.text),
}));

// Keeps the generated sentence deck traceable to the sentence that supplied
// each word, which also lets deletion remove only obsolete memberships.
export const savedSentenceWords = sqliteTable("saved_sentence_words", {
	id: text("id").primaryKey(),
	sentenceId: text("sentenceId")
		.notNull()
		.references(() => savedSentences.id, { onDelete: "cascade" }),
	cardId: text("cardId")
		.notNull()
		.references(() => studyCards.id, { onDelete: "cascade" }),
	surfaceForm: text("surfaceForm").notNull(),
	position: integer("position").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	sentencePositionUnique: unique().on(table.sentenceId, table.position),
}));

// Custom words - user-coined dictionary entries
export const customWords = sqliteTable("custom_words", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	// The canonical word form used as the URL slug (e.g., "重来", "食べる", "학교")
	word: text("word").notNull().unique(),
	// Language: "zh", "ja", "ko"
	language: text("language").notNull(),
	// Chinese fields
	simplified: text("simplified"),
	traditional: text("traditional"),
	pinyin: text("pinyin"),
	jyutping: text("jyutping"),
	// Japanese fields
	kanji: text("kanji"),
	kana: text("kana"),
	// Korean fields
	hangul: text("hangul"),
	hanja: text("hanja"),
	// Common fields
	partOfSpeech: text("partOfSpeech"), // JSON array: ["noun", "verb"]
	definitions: text("definitions").notNull(), // JSON array: ["meaning 1", "meaning 2"]
	notes: text("notes"), // optional markdown notes
	// Timestamps
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// LEARNING RESOURCES TABLES
// ============================================================================

// Language categories for organizing learning resources
// e.g., "Japanese", "Chinese (Mandarin)", "Chinese (Cantonese)"
export const languageCategories = sqliteTable("language_categories", {
	id: text("id").primaryKey(), // e.g., "japanese", "chinese-mandarin"
	name: text("name").notNull(), // Display name: "Japanese", "Chinese (Mandarin)"
	slug: text("slug").notNull().unique(), // URL-friendly: "japanese", "chinese-mandarin"
	languageCode: text("languageCode").notNull(), // ISO code: "ja", "zh", "yue"
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Resource sources (YouTube channels, podcasts, etc.)
// e.g., "Scripting Japan", "ChinesePod"
export const resourceSources = sqliteTable("resource_sources", {
	id: text("id").primaryKey(),
	languageCategoryId: text("languageCategoryId")
		.notNull()
		.references(() => languageCategories.id),
	name: text("name").notNull(), // "Scripting Japan"
	slug: text("slug").notNull(), // "scripting-japan"
	sourceType: text("sourceType").notNull(), // "youtube", "podcast", "blog"
	sourceUrl: text("sourceUrl").notNull(), // YouTube channel URL
	sourceIdentifier: text("sourceIdentifier"), // YouTube channel ID for API
	description: text("description"), // About the channel/source
	thumbnailUrl: text("thumbnailUrl"), // Channel avatar/logo
	isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	// Unique slug per language category
	languageSlugUnique: unique().on(table.languageCategoryId, table.slug),
}));

// Video posts (individual videos from sources)
export const videoPosts = sqliteTable("video_posts", {
	id: text("id").primaryKey(),
	resourceSourceId: text("resourceSourceId")
		.notNull()
		.references(() => resourceSources.id),
	title: text("title").notNull(), // Video title
	slug: text("slug").notNull(), // URL-friendly title
	videoUrl: text("videoUrl").notNull(), // Full YouTube URL
	videoId: text("videoId").notNull(), // YouTube video ID
	thumbnailUrl: text("thumbnailUrl"), // Video thumbnail
	duration: integer("duration"), // Duration in seconds
	publishedAt: integer("publishedAt", { mode: "timestamp" }), // Original publish date
	transcript: text("transcript"), // Full transcript text
	summary: text("summary"), // AI-generated summary (Gemini)
	viewCount: integer("viewCount"), // YouTube view count
	isProcessed: integer("isProcessed", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	// Unique slug per source
	sourceSlugUnique: unique().on(table.resourceSourceId, table.slug),
	// Unique video ID
	videoIdUnique: unique().on(table.videoId),
}));

// Extracted words/slang from videos
// Links to existing dictionary via word slug
export const extractedWords = sqliteTable("extracted_words", {
	id: text("id").primaryKey(),
	videoPostId: text("videoPostId")
		.notNull()
		.references(() => videoPosts.id, { onDelete: "cascade" }),
	word: text("word").notNull(), // The slang/word in original script
	wordSlug: text("wordSlug").notNull(), // Dictionary slug for linking
	reading: text("reading"), // Pronunciation (hiragana for Japanese, pinyin for Chinese)
	translation: text("translation").notNull(), // Natural spoken translation
	context: text("context"), // Example sentence from video
	timestamp: integer("timestamp"), // Timestamp in video (seconds)
	sortOrder: integer("sortOrder").notNull().default(0), // Display order
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	// Allow multiple instances of same word in different videos
	// No unique constraint needed
}));

// ============================================================================
// ARTIFACTS TABLES
// ============================================================================
// Real-world language encounters (product packaging, signs, menus, etc.)
// Users create artifacts from things they find, add sentences, and link words

export const artifacts = sqliteTable("artifacts", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"), // Optional description/context
	language: text("language").notNull(), // 'zh', 'ja', 'ko'
	type: text("type").notNull().default("other"), // 'packaging', 'sign', 'menu', 'book', 'media', 'other'
	isPublic: integer("isPublic", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// Images associated with artifacts (stored in R2)
export const artifactImages = sqliteTable("artifact_images", {
	id: text("id").primaryKey(),
	artifactId: text("artifactId")
		.notNull()
		.references(() => artifacts.id, { onDelete: "cascade" }),
	imageUrl: text("imageUrl").notNull(), // R2 path like /api/images/userId/filename.jpg
	sortOrder: integer("sortOrder").notNull().default(0),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Sentences found on artifacts (optionally tied to a specific image)
export const artifactSentences = sqliteTable("artifact_sentences", {
	id: text("id").primaryKey(),
	artifactId: text("artifactId")
		.notNull()
		.references(() => artifacts.id, { onDelete: "cascade" }),
	imageId: text("imageId")
		.references(() => artifactImages.id, { onDelete: "cascade" }), // nullable — ties text to a specific image
	originalText: text("originalText").notNull(), // The sentence in original language
	translation: text("translation"), // Optional English translation
	sortOrder: integer("sortOrder").notNull().default(0),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Links words in the dictionary to sentences where they appear
// Includes precomputed dictionary data (reading, gloss) for instant rendering
export const sentenceWords = sqliteTable("sentence_words", {
	id: text("id").primaryKey(),
	sentenceId: text("sentenceId")
		.notNull()
		.references(() => artifactSentences.id, { onDelete: "cascade" }),
	wordSlug: text("wordSlug").notNull(), // Dictionary slug for linking to word pages
	surfaceForm: text("surfaceForm").notNull(), // The actual text as it appears in the sentence
	position: integer("position").notNull(), // Character position in the sentence
	dictionaryForm: text("dictionaryForm"), // Deconjugated form (e.g., 剥がす for 剥が)
	reading: text("reading"), // Pronunciation (e.g., はがす, tòumíng)
	gloss: text("gloss"), // First English definition
	conjugation: text("conjugation"), // Conjugation form label (e.g., 連用形, 未然形)
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Mobile/offline sync tombstones.
// Rows deleted from the primary tables need a durable marker so other clients
// can pull and apply the deletion after they come back online.
export const syncTombstones = sqliteTable("sync_tombstones", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	entity: text("entity").notNull(),
	entityId: text("entityId").notNull(),
	deletedAt: integer("deletedAt", { mode: "timestamp" }).notNull(),
}, (table) => ({
	userEntityUnique: unique().on(table.userId, table.entity, table.entityId),
}));
