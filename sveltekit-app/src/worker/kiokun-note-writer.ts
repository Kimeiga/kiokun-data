interface Env {
	DB: D1Database;
	ADMIN_EMAIL: string;
}

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

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/health' && request.method === 'GET') {
			return response({ ok: true });
		}
		if (url.pathname !== '/notes') return response({ error: 'Not found' }, 404);
		if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

		const timestamp = request.headers.get('x-kiokun-timestamp');
		const signature = request.headers.get('x-kiokun-signature');
		if (!timestamp || !signature) return response({ error: 'Missing request signature' }, 401);

		const rawBody = await request.text();
		if (!(await verifyRequest(rawBody, timestamp, signature))) {
			return response({ error: 'Invalid request signature' }, 401);
		}

		let body: Record<string, unknown>;
		try {
			const parsed = JSON.parse(rawBody);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
			body = parsed as Record<string, unknown>;
		} catch {
			return response({ error: 'Invalid JSON' }, 400);
		}

		const character = typeof body.character === 'string' ? body.character.trim() : '';
		const noteText = typeof body.noteText === 'string' ? body.noteText.trim() : '';
		const isPublic = body.isPublic === true;
		const mode = body.mode === 'replace' ? 'replace' : 'append';
		if (!character || character.length > 128) return response({ error: 'Character is required' }, 400);
		if (!noteText || noteText.length > 50_000) return response({ error: 'Note text is required' }, 400);

		const owner = await env.DB.prepare('SELECT id FROM user WHERE email = ? LIMIT 1')
			.bind(env.ADMIN_EMAIL)
			.first<{ id: string }>();
		if (!owner) return response({ error: 'Kiokun owner account was not found' }, 500);

		const existing = await env.DB.prepare(
			'SELECT id, noteText FROM notes WHERE userId = ? AND character = ? LIMIT 1',
		)
			.bind(owner.id, character)
			.first<{ id: string; noteText: string }>();

		const now = Math.floor(Date.now() / 1000);
		if (existing) {
			const current = (existing.noteText ?? '').trim();
			let nextText = noteText;
			if (mode === 'append' && current) {
				nextText = current.includes(noteText) ? current : `${current}\n\n${noteText}`;
			}

			await env.DB.prepare(
				'UPDATE notes SET noteText = ?, isAdmin = 0, isPublic = ?, updatedAt = ? WHERE id = ?',
			)
				.bind(nextText, isPublic ? 1 : 0, now, existing.id)
				.run();

			return response({ success: true, id: existing.id, updated: true, mode });
		}

		const id = crypto.randomUUID();
		await env.DB.prepare(
			'INSERT INTO notes (id, userId, character, noteText, isAdmin, isPublic, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
		)
			.bind(id, owner.id, character, noteText, isPublic ? 1 : 0, now, now)
			.run();

		return response({ success: true, id, updated: false, mode });
	},
};
