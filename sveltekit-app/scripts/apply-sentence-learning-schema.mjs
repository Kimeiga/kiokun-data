const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = '21f5b45e-ce53-4a63-b07b-dec1a0b44fcc';

if (!accountId || !apiToken) {
	throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

async function query(sql) {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ sql }),
	});
	const payload = await response.json().catch(() => null);
	const result = payload?.result?.[0];
	if (!response.ok || payload?.success !== true || result?.success === false) {
		const detail = payload?.errors?.map((entry) => entry.message).join('; ') || response.statusText;
		throw new Error(`D1 schema update failed: ${detail}`);
	}
	return result?.results || [];
}

async function ensureColumn(table, column, definition) {
	const columns = await query(`PRAGMA table_info("${table}")`);
	if (columns.some((entry) => entry.name === column)) return;
	await query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}

const schemaStatements = [
	`CREATE TABLE IF NOT EXISTS "study_card_deck_memberships" (
		"id" text PRIMARY KEY NOT NULL,
		"cardId" text NOT NULL,
		"deck" text NOT NULL,
		"createdAt" integer NOT NULL,
		FOREIGN KEY ("cardId") REFERENCES "study_cards"("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS "study_card_deck_memberships_cardId_deck_unique"
		ON "study_card_deck_memberships" ("cardId", "deck")`,
	`CREATE TABLE IF NOT EXISTS "user_learning_settings" (
		"userId" text PRIMARY KEY NOT NULL,
		"autoSaveSentences" integer DEFAULT false NOT NULL,
		"createdAt" integer NOT NULL,
		"updatedAt" integer NOT NULL,
		FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS "saved_sentences" (
		"id" text PRIMARY KEY NOT NULL,
		"userId" text NOT NULL,
		"text" text NOT NULL,
		"language" text NOT NULL,
		"translation" text,
		"pinyin" text,
		"saveMode" text DEFAULT 'manual' NOT NULL,
		"createdAt" integer NOT NULL,
		"updatedAt" integer NOT NULL,
		FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS "saved_sentences_userId_language_text_unique"
		ON "saved_sentences" ("userId", "language", "text")`,
	`CREATE TABLE IF NOT EXISTS "saved_sentence_words" (
		"id" text PRIMARY KEY NOT NULL,
		"sentenceId" text NOT NULL,
		"cardId" text NOT NULL,
		"surfaceForm" text NOT NULL,
		"position" integer NOT NULL,
		"createdAt" integer NOT NULL,
		FOREIGN KEY ("sentenceId") REFERENCES "saved_sentences"("id") ON DELETE CASCADE,
		FOREIGN KEY ("cardId") REFERENCES "study_cards"("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS "saved_sentence_words_sentenceId_position_unique"
		ON "saved_sentence_words" ("sentenceId", "position")`,
	`CREATE TABLE IF NOT EXISTS "sync_tombstones" (
		"id" text PRIMARY KEY NOT NULL,
		"userId" text NOT NULL,
		"entity" text NOT NULL,
		"entityId" text NOT NULL,
		"deletedAt" integer NOT NULL,
		FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS "sync_tombstones_userId_entity_entityId_unique"
		ON "sync_tombstones" ("userId", "entity", "entityId")`,
	`CREATE TABLE IF NOT EXISTS "study_card_contexts" (
		"id" text PRIMARY KEY NOT NULL,
		"cardId" text NOT NULL,
		"sentence" text NOT NULL,
		"translation" text,
		"language" text NOT NULL,
		"createdAt" integer NOT NULL,
		"updatedAt" integer NOT NULL,
		FOREIGN KEY ("cardId") REFERENCES "study_cards"("id") ON DELETE CASCADE
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS "study_card_contexts_cardId_sentence_unique"
		ON "study_card_contexts" ("cardId", "sentence")`,
];

for (const statement of schemaStatements) {
	await query(statement);
}

await ensureColumn('sentence_words', 'dictionaryForm', 'text');
await ensureColumn('sentence_words', 'reading', 'text');
await ensureColumn('sentence_words', 'gloss', 'text');
await ensureColumn('sentence_words', 'conjugation', 'text');
await ensureColumn('notes', 'isPublic', 'integer DEFAULT false NOT NULL');

console.log('Sentence-learning D1 schema is up to date.');
