const API_BASE = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneName = process.env.CLOUDFLARE_ZONE_NAME || 'kiokun.com';

if (!token) {
	throw new Error('CLOUDFLARE_API_TOKEN is required');
}

async function cf(path, init = {}) {
	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...(init.headers || {})
		}
	});

	const payload = await response.json().catch(() => null);
	if (!response.ok || !payload?.success) {
		const errors = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ');
		throw new Error(`Cloudflare API ${response.status} for ${path}${errors ? `: ${errors}` : ''}`);
	}

	return payload.result;
}

const zones = await cf(`/zones?name=${encodeURIComponent(zoneName)}&status=active&per_page=50`);
const zone = zones.find((candidate) => candidate.name === zoneName);
if (!zone) {
	throw new Error(`Could not find active Cloudflare zone ${zoneName}`);
}

const current = await cf(`/zones/${zone.id}/bot_management`);
const desired = {};

// Only request settings exposed by this zone/plan. This keeps the script safe
// across Cloudflare Free/Pro/Business/Enterprise bot-management variants.
if ('ai_bots_protection' in current) desired.ai_bots_protection = 'block';
if ('ai_training' in current) desired.ai_training = 'block';
if ('ai_user' in current) desired.ai_user = 'block';
if ('crawler_protection' in current) desired.crawler_protection = 'enabled';
if ('content_bots_protection' in current) desired.content_bots_protection = 'block';
if ('fight_mode' in current) desired.fight_mode = true;

if (Object.keys(desired).length === 0) {
	throw new Error(`Cloudflare returned no configurable bot-protection settings for ${zoneName}`);
}

await cf(`/zones/${zone.id}/bot_management`, {
	method: 'PUT',
	body: JSON.stringify(desired)
});

const verified = await cf(`/zones/${zone.id}/bot_management`);
for (const [key, value] of Object.entries(desired)) {
	if (verified[key] !== value) {
		throw new Error(`Cloudflare did not persist ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(verified[key])}`);
	}
}

console.log(`Cloudflare edge bot protection enforced for ${zoneName}: ${Object.keys(desired).join(', ')}`);
