import { readdir } from 'node:fs/promises';
import path from 'node:path';

const [deploymentUrlArgument, outputDirectoryArgument = '.svelte-kit/cloudflare'] =
	process.argv.slice(2);

if (!deploymentUrlArgument) {
	throw new Error('Usage: node scripts/verify-pages-deployment.mjs <deployment-url> [output-dir]');
}

const deploymentUrl = new URL(deploymentUrlArgument);
const outputDirectory = path.resolve(outputDirectoryArgument);
const immutableDirectory = path.join(outputDirectory, '_app', 'immutable');

async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(entryPath)));
		} else if (entry.isFile()) {
			files.push(entryPath);
		}
	}

	return files;
}

async function fetchWithRetry(url, expectedStatus, attempts = 8) {
	let lastStatus = 0;
	let lastError;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: {
					'Cache-Control': 'no-cache',
					'User-Agent': 'kiokun-deployment-verifier'
				}
			});
			lastStatus = response.status;
			await response.body?.cancel();
			if (response.status === expectedStatus) return;
		} catch (error) {
			lastError = error;
		}

		await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 750, 4000)));
	}

	const detail = lastError instanceof Error ? ` (${lastError.message})` : '';
	throw new Error(`${url} returned ${lastStatus || 'no response'}, expected ${expectedStatus}${detail}`);
}

async function verifyJapaneseSentenceAnalysis() {
	const url = new URL('/api/sentence/analyze', deploymentUrl);
	const requests = Array.from({ length: 12 }, async (_, index) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Cache-Control': 'no-cache',
				'Content-Type': 'application/json',
				'User-Agent': `kiokun-deployment-verifier/${index}`
			},
			body: JSON.stringify({
				text: 'すみません、空港までどうやって行きますか。',
				language: 'ja'
			})
		});
		const responseText = await response.text();
		if (!response.ok) {
			throw new Error(
				`Japanese sentence analysis request ${index + 1} returned ${response.status}: ${responseText.slice(0, 160)}`
			);
		}

		const result = JSON.parse(responseText);
		if (!Array.isArray(result.words) || result.words.length < 6) {
			throw new Error(`Japanese sentence analysis request ${index + 1} returned incomplete words`);
		}
		if (!result.words.some((word) => word.surfaceForm === 'どうやって')) {
			throw new Error(`Japanese sentence analysis request ${index + 1} missed the travel phrase`);
		}
		if (
			!result.words.some(
				(word) => word.surfaceForm === '行き' && word.dictionaryForm === '行く'
			)
		) {
			throw new Error(
				`Japanese sentence analysis request ${index + 1} missed the verb form`
			);
		}
	});

	await Promise.all(requests);
}

await fetchWithRetry(new URL('/', deploymentUrl), 200);

const immutableFiles = await collectFiles(immutableDirectory);
const immutableUrls = immutableFiles.map((file) => {
	const relativePath = path.relative(outputDirectory, file).split(path.sep).join('/');
	return new URL(`/${relativePath}`, deploymentUrl);
});

const failures = [];
const concurrency = 24;
let nextIndex = 0;

async function worker() {
	while (nextIndex < immutableUrls.length) {
		const index = nextIndex;
		nextIndex += 1;
		const url = immutableUrls[index];
		try {
			await fetchWithRetry(url, 200, 3);
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length > 0) {
	throw new Error(
		`Deployment is missing ${failures.length} immutable assets:\n${failures.slice(0, 20).join('\n')}`
	);
}

await fetchWithRetry(
	new URL('/api/users/this-user-does-not-exist/notes', deploymentUrl),
	404
);
await fetchWithRetry(new URL('/api/stroke-data?char=%EF%A7%84', deploymentUrl), 200);
await verifyJapaneseSentenceAnalysis();

console.log(
	`Verified ${immutableUrls.length} immutable assets, critical APIs, and repeated Japanese sentence analysis at ${deploymentUrl}`
);
