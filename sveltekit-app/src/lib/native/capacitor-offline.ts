import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Preferences } from '@capacitor/preferences';
import { getCjkSearchTerms, getSearchTarget } from '$lib/search-aliases';

const DATABASE = 'KiokunDictionary';
const nativeDictionaryPrefix = '/__kiokun_offline__/dictionary/';
const LOCAL_NOTES_KEY = 'kiokun.localNotes.v1';
const LOCAL_USER_ID = 'local-device';
const WEB_APP_ORIGIN = 'https://kiokun.pages.dev';

interface LocalNote {
	id: string;
	userId: string;
	character: string;
	noteText: string;
	isAdmin: boolean;
	createdAt: number;
	updatedAt: number;
	user: {
		id: string;
		name: string;
		image: string | null;
	} | null;
}

interface SearchRow {
	word: string;
	language: string;
	definition: string;
	pronunciation: string;
	reading_search: string;
	is_common: number | boolean;
}

interface GroupedResult {
	word: string;
	targetWord: string;
	language: string;
	languages: string[];
	pronunciation: string;
	definitions: string[];
	is_common: boolean;
	_pronunciations?: Map<string, string>;
	_displayScore?: number;
}

let installPromise: Promise<void> | null = null;
let databasePromise: Promise<SQLiteDBConnection> | null = null;
let originalFetch: typeof fetch | null = null;

export function installCapacitorOfflineBridge(): Promise<void> {
	if (installPromise) return installPromise;
	installPromise = install();
	return installPromise;
}

async function install(): Promise<void> {
	if (!isCapacitorRuntime() || !Capacitor.isNativePlatform()) return;
	if (originalFetch) return;

	originalFetch = window.fetch.bind(window);
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = requestUrl(input);
		const method = requestMethod(input, init);
		const handled = await handleOfflineFetch(url, input, init, method);
		if (handled) return handled;
		return originalFetch!(input, init);
	};

	// Warm the readonly connection after the app paints so first search is faster.
	void getDatabase();
}

function isCapacitorRuntime(): boolean {
	return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

function requestUrl(input: RequestInfo | URL): URL {
	if (input instanceof Request) return new URL(input.url);
	if (input instanceof URL) return input;
	return new URL(input, window.location.origin);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
	return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

async function handleOfflineFetch(
	url: URL,
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	method: string
): Promise<Response | null> {
	if (url.pathname === '/api/search' && method === 'GET') {
		const query = url.searchParams.get('q') ?? '';
		const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
		const body = await searchOffline(query, limit);
		return jsonResponse(body);
	}

	if (url.pathname === '/api/custom-words' && method === 'GET') {
		return jsonResponse([]);
	}

	if (url.pathname === '/api/user/notes') {
		if (method !== 'GET') return methodNotAllowedResponse();
		return jsonResponse(await allLocalNotes());
	}

	if (url.pathname.startsWith('/api/notes/')) {
		return handleLocalNoteRequest(url, input, init, method);
	}

	if (url.pathname.startsWith(nativeDictionaryPrefix) && method === 'GET') {
		const encoded = url.pathname
			.slice(nativeDictionaryPrefix.length)
			.replace(/\.json\.deflate$/, '');
		const word = decodeURIComponent(encoded);
		const bytes = await compressedEntry(word);
		if (!bytes) return new Response('Not found', { status: 404 });
		return new Response(uint8ArrayBody(bytes), {
			status: 200,
			headers: {
				'Content-Type': 'application/octet-stream',
				'Cache-Control': 'no-store'
			}
		});
	}

	return null;
}

async function handleLocalNoteRequest(
	url: URL,
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	method: string
): Promise<Response> {
	const character = decodeURIComponent(url.pathname.slice('/api/notes/'.length));
	if (!character) return jsonResponse({ message: 'Character parameter is required' }, 400);

	if (method === 'GET') {
		const [remoteNotes, localNotes] = await Promise.all([
			fetchWebNotes(character),
			readLocalNotes()
		]);
		const localNote = localNotes[character];
		const merged = localNote
			? [localNote, ...remoteNotes.filter((note) => note.id !== localNote.id)]
			: remoteNotes;
		return jsonResponse(merged);
	}

	if (method === 'POST' || method === 'PUT') {
		const body = await requestJson(input, init);
		const noteText = typeof body?.noteText === 'string' ? body.noteText.trim() : '';
		if (!noteText) return jsonResponse({ message: 'Note text is required' }, 400);

		const notes = await readLocalNotes();
		const existing = notes[character];
		const now = Date.now();
		const note: LocalNote = {
			id: existing?.id ?? crypto.randomUUID(),
			userId: LOCAL_USER_ID,
			character,
			noteText,
			isAdmin: false,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			user: {
				id: LOCAL_USER_ID,
				name: 'You',
				image: null
			}
		};
		notes[character] = note;
		await writeLocalNotes(notes);
		return jsonResponse({ success: true, id: note.id, updated: Boolean(existing), offline: true });
	}

	if (method === 'DELETE') {
		const body = await requestJson(input, init);
		const notes = await readLocalNotes();
		const noteId = typeof body?.noteId === 'string' ? body.noteId : '';
		if (!noteId || notes[character]?.id === noteId) {
			delete notes[character];
			await writeLocalNotes(notes);
		}
		return jsonResponse({ success: true, offline: true });
	}

	return methodNotAllowedResponse();
}

async function requestJson(input: RequestInfo | URL, init?: RequestInit): Promise<Record<string, unknown> | null> {
	try {
		const body = init?.body;
		if (typeof body === 'string') return JSON.parse(body) as Record<string, unknown>;
		if (input instanceof Request) return (await input.clone().json()) as Record<string, unknown>;
	} catch {
		// Treat malformed or absent JSON like an empty body so callers can return normal 400s.
	}
	return null;
}

async function fetchWebNotes(character: string): Promise<LocalNote[]> {
	if (!originalFetch) return [];

	try {
		const response = await originalFetch(`${WEB_APP_ORIGIN}/api/notes/${encodeURIComponent(character)}`, {
			method: 'GET',
			cache: 'no-store'
		});
		if (!response.ok) return [];
		const value = await response.json();
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

async function readLocalNotes(): Promise<Record<string, LocalNote>> {
	const result = await Preferences.get({ key: LOCAL_NOTES_KEY });
	if (!result.value) return {};
	try {
		const parsed = JSON.parse(result.value) as Record<string, LocalNote>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

async function writeLocalNotes(notes: Record<string, LocalNote>): Promise<void> {
	await Preferences.set({ key: LOCAL_NOTES_KEY, value: JSON.stringify(notes) });
}

async function allLocalNotes(): Promise<LocalNote[]> {
	return Object.values(await readLocalNotes()).sort((first, second) => second.updatedAt - first.updatedAt);
}

async function getDatabase(): Promise<SQLiteDBConnection> {
	if (databasePromise) return databasePromise;
	databasePromise = openDatabase();
	return databasePromise;
}

async function openDatabase(): Promise<SQLiteDBConnection> {
	const sqlite = new SQLiteConnection(CapacitorSQLite);

	try {
		await sqlite.copyFromAssets(false);
	} catch (error) {
		console.warn('Kiokun offline database asset copy skipped or failed:', error);
	}

	const existing = await sqlite.isConnection(DATABASE, true).catch(() => ({ result: false }));
	const db = existing.result
		? await sqlite.retrieveConnection(DATABASE, true)
		: await sqlite.createConnection(DATABASE, false, 'no-encryption', 1, true);
	await db.open();
	return db;
}

async function searchOffline(query: string, limit: number) {
	const trimmed = query.trim();
	if (!trimmed) {
		return { query, results: [], total: 0, offline: true };
	}

	const db = await getDatabase();
	const searchTerms = containsCJK(trimmed) ? getCjkSearchTerms(trimmed) : [trimmed];
	const rows = containsCJK(trimmed)
		? await searchCJK(db, searchTerms, limit)
		: await searchLatin(db, trimmed, limit);
	const grouped = groupRows(rows, trimmed, searchTerms).slice(0, limit);
	return { query, results: grouped, total: grouped.length, offline: true };
}

async function searchCJK(db: SQLiteDBConnection, searchTerms: string[], limit: number): Promise<SearchRow[]> {
	const whereClause = searchTerms.map(() => "word LIKE ? || '%'").join(" OR ");
	const exactRank = searchTerms
		.map((_, index) => `WHEN word = ? THEN ${index === 0 ? 1000 : 900}`)
		.join("\n");
	const prefixRank = searchTerms
		.map((_, index) => `WHEN word LIKE ? || '%' THEN ${index === 0 ? 500 : 450}`)
		.join("\n");
	const cjkLimit = Math.min(
		limit * Math.max(4, Math.min(searchTerms.length, 12)),
		1000
	);

	const response = await db.query(
		`
		SELECT word, language, definition, pronunciation, reading_search, is_common
		FROM dictionary_search
		WHERE ${whereClause}
		ORDER BY
			CASE
				${exactRank}
				${prefixRank}
				ELSE 0
			END DESC,
			is_common DESC,
			LENGTH(word) ASC,
			rowid ASC
		LIMIT ?
		`,
		[...searchTerms, ...searchTerms, ...searchTerms, cjkLimit]
	);
	return (response.values ?? []) as SearchRow[];
}

async function searchLatin(db: SQLiteDBConnection, query: string, limit: number): Promise<SearchRow[]> {
	try {
		const response = await db.query(
			`
			SELECT word, language, definition, pronunciation, reading_search, is_common
			FROM dictionary_search
			WHERE dictionary_search MATCH ?
			ORDER BY is_common DESC, rowid ASC
			LIMIT ?
			`,
			[ftsQuery(query), limit * 3]
		);
		return (response.values ?? []) as SearchRow[];
	} catch {
		const like = `%${query}%`;
		const response = await db.query(
			`
			SELECT word, language, definition, pronunciation, reading_search, is_common
			FROM dictionary_search
			WHERE LOWER(definition) LIKE LOWER(?)
			   OR LOWER(reading_search) LIKE LOWER(?)
			   OR LOWER(word) LIKE LOWER(?)
			ORDER BY is_common DESC, rowid ASC
			LIMIT ?
			`,
			[like, like, like, limit * 3]
		);
		return (response.values ?? []) as SearchRow[];
	}
}

async function compressedEntry(word: string): Promise<Uint8Array | null> {
	const db = await getDatabase();
	const response = await db.query(
		'SELECT compressedData FROM dictionary_entries WHERE key = ? LIMIT 1',
		[word]
	);
	const value = response.values?.[0]?.compressedData;
	if (!value) return null;
	if (Array.isArray(value)) return new Uint8Array(value);
	if (value instanceof Uint8Array) return value;
	return null;
}

function containsCJK(value: string): boolean {
	return /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(value);
}

function ftsQuery(value: string): string {
	return value
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => `"${part.replace(/"/g, '""')}"`)
		.join(' ');
}

function rowDisplayScore(row: SearchRow, targetWord: string, query: string, searchTerms: string[]): number {
	if (row.word === query) return 1000;
	if (row.word === targetWord && targetWord === query) return 950;
	if (row.word === targetWord && searchTerms.includes(row.word)) return 900;
	if (searchTerms.includes(row.word)) return 850;
	if (row.word === targetWord) return 700;
	if (row.language === 'japanese' && targetWord !== row.word) return 650;
	return 500;
}

function groupRows(rows: SearchRow[], query: string, searchTerms: string[]): Omit<GroupedResult, '_pronunciations' | '_displayScore'>[] {
	const grouped = new Map<string, GroupedResult>();

	for (const row of rows) {
		const targetWord = getSearchTarget(row.word, row.language);
		const key = targetWord;
		const displayScore = rowDisplayScore(row, targetWord, query, searchTerms);
		let group = grouped.get(key);
		if (!group) {
			group = {
				word: row.word,
				targetWord,
				language: row.language,
				languages: [row.language],
				pronunciation: '',
				definitions: [],
				is_common: row.is_common === true || row.is_common === 1,
				_pronunciations: new Map(),
				_displayScore: displayScore
			};
			grouped.set(key, group);
		}

		if (displayScore > (group._displayScore ?? 0)) {
			group.word = row.word;
			group.language = row.language;
			group._displayScore = displayScore;
		}

		if (row.definition && !group.definitions.includes(row.definition)) {
			group.definitions.push(row.definition);
		}
		if (row.pronunciation && !group._pronunciations?.has(row.language)) {
			group._pronunciations?.set(row.language, row.pronunciation);
		}
		if (!group.languages.includes(row.language)) {
			group.languages.push(row.language);
		}
		group.is_common = Boolean(group.is_common || row.is_common);
	}

	return Array.from(grouped.values()).map((group) => {
		const pronunciations = group._pronunciations ?? new Map<string, string>();
		group.pronunciation = [
			pronunciations.get('japanese'),
			pronunciations.get('chinese'),
			pronunciations.get('korean')
		]
			.filter(Boolean)
			.join(' · ');
		delete group._pronunciations;
		delete group._displayScore;
		return group;
	});
}

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store'
		}
	});
}

function methodNotAllowedResponse(): Response {
	return jsonResponse({ message: 'Method not allowed' }, 405);
}

function uint8ArrayBody(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
