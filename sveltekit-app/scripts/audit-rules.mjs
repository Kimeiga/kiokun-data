#!/usr/bin/env node
/**
 * Ruled-surface audit.
 *
 * The design system's rule is "one edge, one rule": a section bar is itself the
 * divider and carries no border, and neighbouring ruled surfaces share a single
 * hairline rather than stacking two. This script checks that rule empirically.
 *
 * It walks every element under <main>, records each visible horizontal rule as
 * a band with correct geometry (a border-bottom ends at the box bottom; an
 * outline is displaced outside the box by outline-offset), drops bands that an
 * overflow ancestor clips away, and reports bands that sit within 6px of each
 * other while overlapping horizontally.
 *
 * Pairs at a gap of ~0 are expected and healthy: that is two surfaces sharing
 * one edge. A pair with a *visible* gap is the defect — two hairlines reading
 * as a doubled line. Only those fail the run.
 *
 * Requires playwright-core (npm i -D playwright-core). Set CHROME_PATH if the
 * browser is not at the Playwright default.
 *
 * Usage:
 *   node scripts/audit-rules.mjs                        # audit production
 *   node scripts/audit-rules.mjs --base=http://localhost:5173
 *   node scripts/audit-rules.mjs --routes=/日本,/search?q=日
 *   node scripts/audit-rules.mjs --shots --out=.audit
 *   node scripts/audit-rules.mjs --self-test            # prove the detector works
 *
 * Exits non-zero if any rule pair has a visible gap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
	const hit = argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = arg('base', 'https://kiokun.com').replace(/\/$/, '');
const OUT = arg('out', '.audit');
const SHOTS = flag('shots');
const SELF_TEST = flag('self-test');
const CHROME =
	process.env.CHROME_PATH ||
	(fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const DEFAULT_ROUTES = [
	'/' + encodeURIComponent('日本'),
	'/' + encodeURIComponent('水'),
	'/search?q=' + encodeURIComponent('日'),
	'/homophones/japanese',
	'/homophones/chinese',
	'/frequency',
	'/learning',
	'/artifacts',
	'/users',
	'/blog'
];
const ROUTES = (arg('routes', '') ? arg('routes', '').split(',') : DEFAULT_ROUTES).map((r) =>
	r.startsWith('/') ? r : '/' + r
);

const BREAKPOINTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1440, height: 900 }
];

const VISIBLE_GAP = 0.6; // px — below this two rules are coincident, not doubled

// ---------------------------------------------------------------------------
// The detector. Runs inside the page.
// ---------------------------------------------------------------------------
const AUDIT = () => {
	const TOL = 6; // px — two rules this close read as one doubled line
	const MIN_LEN = 24; // ignore hairline fragments narrower than this
	const OVERLAP_FRAC = 0.5; // pair only rules that genuinely sit over each other

	const root = document.querySelector('main') || document.body;
	if (!root) return { error: 'no <main> or <body>' };

	const isTransparent = (c) => {
		if (!c || c === 'transparent') return true;
		const m = c.match(/rgba?\(([^)]+)\)/);
		if (!m) return false;
		const p = m[1].split(',').map((s) => parseFloat(s.trim()));
		return p.length >= 4 && p[3] === 0;
	};

	const describe = (el) => {
		let s = el.tagName.toLowerCase();
		if (el.id) s += '#' + el.id;
		const cls = (el.getAttribute('class') || '')
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.filter((c) => !/^s-[A-Za-z0-9_-]+$/.test(c))
			.slice(0, 4);
		if (cls.length) s += '.' + cls.join('.');
		return s;
	};

	const pathOf = (el) => {
		const out = [];
		let n = el;
		while (n && n !== root && out.length < 4) {
			out.push(describe(n));
			n = n.parentElement;
		}
		return out.join(' < ');
	};

	// A band is invisible if any overflow ancestor clips its y out of view.
	const clipped = (el, y) => {
		let p = el.parentElement;
		while (p && p !== document.documentElement) {
			const cs = getComputedStyle(p);
			const oy = cs.overflowY;
			if (oy === 'hidden' || oy === 'clip' || oy === 'scroll' || oy === 'auto') {
				const r = p.getBoundingClientRect();
				if (y < r.top - 0.5 || y > r.bottom + 0.5) return true;
			}
			p = p.parentElement;
		}
		return false;
	};

	const bands = [];
	const push = (el, kind, top, w, rect, color) => {
		if (rect.width < MIN_LEN) return;
		const mid = top + w / 2;
		if (clipped(el, mid)) return;
		bands.push({
			kind,
			y: mid,
			thickness: w,
			x1: rect.left,
			x2: rect.right,
			color,
			el: describe(el),
			path: pathOf(el)
		});
	};

	for (const el of [root, ...root.querySelectorAll('*')]) {
		const cs = getComputedStyle(el);
		if (cs.display === 'none' || cs.visibility === 'hidden') continue;
		if (parseFloat(cs.opacity) === 0) continue;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) continue;

		for (const side of ['Top', 'Bottom']) {
			const w = parseFloat(cs['border' + side + 'Width']) || 0;
			const st = cs['border' + side + 'Style'];
			const col = cs['border' + side + 'Color'];
			if (w > 0 && st !== 'none' && st !== 'hidden' && !isTransparent(col)) {
				const top = side === 'Top' ? rect.top : rect.bottom - w;
				push(el, 'border-' + side.toLowerCase(), top, w, rect, col);
			}
		}

		const ow = parseFloat(cs.outlineWidth) || 0;
		if (
			ow > 0 &&
			cs.outlineStyle !== 'none' &&
			cs.outlineStyle !== 'hidden' &&
			!isTransparent(cs.outlineColor)
		) {
			const off = parseFloat(cs.outlineOffset) || 0;
			push(el, 'outline-top', rect.top - off - ow, ow, rect, cs.outlineColor);
			push(el, 'outline-bottom', rect.bottom + off, ow, rect, cs.outlineColor);
		}
	}

	bands.sort((a, b) => a.y - b.y);

	const pairs = [];
	for (let i = 0; i < bands.length; i++) {
		for (let j = i + 1; j < bands.length; j++) {
			const gap = bands[j].y - bands[i].y;
			if (gap > TOL) break;
			const a = bands[i];
			const b = bands[j];
			const ov = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
			if (ov <= 0) continue;
			const narrower = Math.min(a.x2 - a.x1, b.x2 - b.x1);
			if (narrower <= 0 || ov / narrower < OVERLAP_FRAC) continue;
			pairs.push({
				gap: +gap.toFixed(2),
				y: +a.y.toFixed(1),
				overlap: Math.round(ov),
				a: { kind: a.kind, t: a.thickness, el: a.el, path: a.path, color: a.color },
				b: { kind: b.kind, t: b.thickness, el: b.el, path: b.path, color: b.color }
			});
		}
	}

	return { total: bands.length, pairs };
};

// ---------------------------------------------------------------------------
// Networking. Chromium cannot use a CONNECT-only egress proxy (its tunnels are
// reset), but Node's fetch can, so when a proxy is configured we serve every
// request from Node and Chromium never opens a socket of its own.
// ---------------------------------------------------------------------------
const USE_NODE_FETCH = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
const cache = new Map();

async function serveFromNode(route) {
	const req = route.request();
	const url = req.url();
	const method = req.method();
	const key = method + ' ' + url;
	if (method === 'GET' && cache.has(key)) return route.fulfill(cache.get(key));
	try {
		const headers = { ...req.headers() };
		delete headers['accept-encoding'];
		delete headers['host'];
		const resp = await fetch(url, {
			method,
			headers,
			body: ['GET', 'HEAD'].includes(method) ? undefined : req.postDataBuffer() || undefined
		});
		const body = Buffer.from(await resp.arrayBuffer());
		const out = {};
		for (const [k, v] of resp.headers) {
			// fetch already decompressed; these headers would misdescribe the body.
			if (k === 'content-encoding' || k === 'content-length') continue;
			out[k] = v;
		}
		const filled = { status: resp.status, headers: out, body };
		if (method === 'GET' && resp.status < 400 && body.length < 4_000_000) cache.set(key, filled);
		return route.fulfill(filled);
	} catch {
		return route.abort();
	}
}

async function settle(page) {
	await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
	// Nudge lazy sections into existence, then settle back at the top.
	await page.evaluate(async () => {
		const step = window.innerHeight;
		for (let y = 0; y < document.body.scrollHeight; y += step) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 90));
		}
		window.scrollTo(0, 0);
		await new Promise((r) => setTimeout(r, 400));
	});
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
}

async function load(page, url) {
	let resp = null;
	// Production 5xxes intermittently under load; retry before believing it.
	for (let attempt = 0; attempt < 4; attempt++) {
		resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		if (!resp || resp.status() < 500) break;
		await page.waitForTimeout(4000 * (attempt + 1));
	}
	await settle(page);
	return resp;
}

// ---------------------------------------------------------------------------

const browser = await chromium.launch({
	executablePath: CHROME,
	args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const visibleGaps = (res) => (res.pairs || []).filter((p) => p.gap >= VISIBLE_GAP);

if (SELF_TEST) {
	// Prove the detector reports a doubled rule when one exists — otherwise a
	// clean result would be indistinguishable from a broken detector.
	const ctx = await browser.newContext({ viewport: BREAKPOINTS[2] });
	if (USE_NODE_FETCH) await ctx.route('**/*', serveFromNode);
	const page = await ctx.newPage();
	await load(page, BASE + ROUTES[0]);

	const before = visibleGaps(await page.evaluate(AUDIT)).length;
	const injected = await page.evaluate(() => {
		let n = 0;
		for (const el of document.querySelectorAll('main *')) {
			const cs = getComputedStyle(el);
			if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') {
				el.style.outline = '1px solid rgb(255,0,0)';
				el.style.outlineOffset = '2px';
				if (++n >= 40) break;
			}
		}
		return n;
	});
	const after = visibleGaps(await page.evaluate(AUDIT)).length;

	console.log(`self-test: baseline visible-gap pairs = ${before}`);
	console.log(`self-test: after stacking rules on ${injected} elements = ${after}`);
	const ok = after > 0;
	console.log(ok ? 'self-test PASSED — detector catches doubled rules' : 'self-test FAILED');
	await browser.close();
	process.exit(ok ? 0 : 1);
}

fs.mkdirSync(OUT, { recursive: true });
const results = [];

for (const bp of BREAKPOINTS) {
	const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
	if (USE_NODE_FETCH) await ctx.route('**/*', serveFromNode);
	const page = await ctx.newPage();

	for (const route of ROUTES) {
		const url = BASE + route;
		const label = `${decodeURIComponent(route)}@${bp.name}`;
		const entry = { route, bp: bp.name, url };
		try {
			const resp = await load(page, url);
			entry.status = resp ? resp.status() : null;
			Object.assign(entry, await page.evaluate(AUDIT));
			if (SHOTS) {
				const file = path.join(OUT, label.replace(/[^\w.@-]+/g, '_') + '.png');
				await page.screenshot({ path: file, fullPage: true }).catch(() => {});
			}
			const bad = visibleGaps(entry).length;
			console.log(
				`${label.padEnd(30)} status=${entry.status} rules=${entry.total} shared-edge=${
					entry.pairs.length - bad
				} doubled=${bad}`
			);
		} catch (e) {
			entry.error = String(e).slice(0, 300);
			console.log(`${label.padEnd(30)} FAILED ${entry.error}`);
		}
		results.push(entry);
	}
	await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'rules.json'), JSON.stringify(results, null, 2));

const doubled = results.flatMap((r) => visibleGaps(r).map((p) => ({ ...p, route: r.route, bp: r.bp })));
const failedNav = results.filter((r) => r.error || (r.status && r.status >= 400));

console.log(`\n${results.length} page/breakpoint combos, ${OUT}/rules.json written`);
if (failedNav.length) {
	console.log(`${failedNav.length} combos did not load cleanly:`);
	for (const f of failedNav) console.log(`  ${decodeURIComponent(f.route)}@${f.bp} ${f.status || f.error}`);
}

if (!doubled.length) {
	console.log('PASS — every rule pair shares one edge; no doubled hairlines.');
	process.exit(failedNav.length ? 1 : 0);
}

console.log(`FAIL — ${doubled.length} doubled rule(s):`);
for (const p of doubled.slice(0, 40)) {
	console.log(`  ${decodeURIComponent(p.route)}@${p.bp}  y=${p.y}  gap=${p.gap}px`);
	console.log(`    ${p.a.kind} ${p.a.path}`);
	console.log(`    ${p.b.kind} ${p.b.path}`);
}
process.exit(1);
