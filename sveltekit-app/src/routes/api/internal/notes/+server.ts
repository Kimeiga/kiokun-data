import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { notes, user } from '$lib/server/db/schema';

const PUBLIC_KEY_SPKI_BASE64 = 'MCowBQYDK2VwAyEAcibx8K6sLDtzCWH5borVDTe1LsXojHbS9iPLE0HhnSM=';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const encoder = new TextEncoder();

function base64ToArrayBuffer(value: string): ArrayBuffer {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

function textToArrayBuffer(value: string): ArrayBuffer {
	return encoder.encode(value).buffer as ArrayBuffer;
}

async function verifyRequest(rawBody: string, timestamp: string, signature: string): Promise<boolean> {
	const timestampMs = Number(timestamp);
	if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
		return false;
	}

	try {
		const publicKey = await crypto.subtle.importKey(
			'spki',
			base64ToArrayBuffer(PUBLIC_KEY_SPKI_BASE64),
			{ name: 'Ed25519' },
			false,
			['verify'],
		);
		return crypto.subtle.verify(
			'Ed25519',
			publicKey,
			base64ToArrayBuffer(signature),
			textToArrayBuffer(`${timestamp}.${rawBody}`),
		);
	} catch {
		return false;
	}
}

export async function POST({ request, platform }: RequestEvent) {
	const timestamp = request.headers.get('x-kiokun-timestamp');
	const signature = request.headers.get('x-kiokun-signature');
	if (!timestamp || !signature) throw error(401, 'Missing request signature');

	const rawBody = await request.text();
	if (!(await verifyRequest(rawBody, timestamp, signature))) {
		throw error(401, 'Invalid request signature');
	}

	let body: unknown;
	try {
		body = JSON.parse(rawBody);
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!body || typeof body !== 'object') throw error(400, 'Invalid request body');
	const payload = body as Record<string, unknown>;
	const character = typeof payload.character === 'string' ? payload.character.trim() : '';
	const noteText = typeof payload.noteText === 'string' ? payload.noteText.trim() : '';
	const isPublic = payload.isPublic === true;
	const mode = payload.mode === 'replace' ? 'replace' : 'append';

	if (!character || character.length > 128) throw error(400, 'Character is required');
	if (!noteText || noteText.length > 50_000) throw error(400, 'Note text is required');

	const adminEmail = platform?.env.ADMIN_EMAIL;
	if (!adminEmail) throw error(500, 'ADMIN_EMAIL is not configured');

	const db = getDb(platform!.env.DB);
	const owners = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, adminEmail))
		.limit(1);
	const owner = owners[0];
	if (!owner) throw error(500, 'Kiokun owner account was not found');

	const existing = await db
		.select({ id: notes.id, noteText: notes.noteText })
		.from(notes)
		.where(and(eq(notes.userId, owner.id), eq(notes.character, character)))
		.limit(1);

	const now = new Date();
	if (existing.length > 0) {
		const current = existing[0].noteText.trim();
		let nextText = noteText;
		if (mode === 'append' && current) {
			nextText = current.includes(noteText) ? current : `${current}\n\n${noteText}`;
		}

		await db
			.update(notes)
			.set({
				noteText: nextText,
				isAdmin: false,
				isPublic,
				updatedAt: now,
			})
			.where(eq(notes.id, existing[0].id));

		return json({ success: true, id: existing[0].id, updated: true, mode });
	}

	const id = crypto.randomUUID();
	await db.insert(notes).values({
		id,
		userId: owner.id,
		character,
		noteText,
		isAdmin: false,
		isPublic,
		createdAt: now,
		updatedAt: now,
	});

	return json({ success: true, id, updated: false, mode });
}
