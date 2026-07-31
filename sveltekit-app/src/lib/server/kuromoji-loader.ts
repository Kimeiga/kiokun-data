/**
 * Kuromoji tokenizer loader for Cloudflare Workers.
 * Loads dictionary files from R2 bucket instead of filesystem.
 */
import type kuromoji from 'kuromoji';
import type { R2Bucket } from '@cloudflare/workers-types';
import { gunzipSync } from 'fflate';
// Kuromoji exposes only its filesystem-oriented builder publicly. These
// internal constructors let Workers supply the same dictionary bytes from R2.
// @ts-expect-error Kuromoji does not publish declarations for internal modules.
import DictionaryLoader from 'kuromoji/src/loader/DictionaryLoader.js';
// @ts-expect-error Kuromoji does not publish declarations for internal modules.
import Tokenizer from 'kuromoji/src/Tokenizer.js';

let cachedTokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let cachedTokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

/**
 * Get or initialize the kuromoji tokenizer.
 * Dictionary files are loaded from R2 on first call, then cached.
 */
export async function getTokenizer(bucket: R2Bucket): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
	if (cachedTokenizer) return cachedTokenizer;
	if (cachedTokenizerPromise) return cachedTokenizerPromise;

	cachedTokenizerPromise = buildTokenizer(bucket);
	try {
		cachedTokenizer = await cachedTokenizerPromise;
		return cachedTokenizer;
	} catch (error) {
		// A transient R2 failure should not poison every later request handled
		// by this worker isolate.
		cachedTokenizerPromise = null;
		throw error;
	}
}

async function buildTokenizer(
	bucket: R2Bucket
): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
	const dictFiles = [
		'base.dat.gz', 'cc.dat.gz', 'check.dat.gz',
		'tid.dat.gz', 'tid_map.dat.gz', 'tid_pos.dat.gz',
		'unk.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz',
		'unk_invoke.dat.gz', 'unk_map.dat.gz', 'unk_pos.dat.gz',
	];

	// Load all dictionary files from R2 in parallel
	const dictBuffers: Record<string, ArrayBuffer> = {};
	await Promise.all(
		dictFiles.map(async (filename) => {
			const obj = await bucket.get(`kuromoji-dict/${filename}`);
			if (!obj) throw new Error(`Dictionary file not found in R2: kuromoji-dict/${filename}`);
			dictBuffers[filename] = await obj.arrayBuffer();
		})
	);

	// Build the tokenizer with a custom dictionary loader. The public Kuromoji
	// builder constructs its own NodeDictionaryLoader internally, so trying to
	// patch a `builder.loader` property has no effect.
	return new Promise((resolve, reject) => {
		const loader = new DictionaryLoader('/r2/kuromoji-dict/');
		loader.loadArrayBuffer = (
			url: string,
			callback: (error: Error | null, data?: ArrayBuffer) => void
		) => {
			const filename = url.split('/').pop()!;
			const buffer = dictBuffers[filename];
			if (!buffer) {
				callback(new Error(`Dictionary file not found: ${filename}`));
				return;
			}

			try {
				const decompressed = gunzipSync(new Uint8Array(buffer));
				const exactBuffer = decompressed.buffer.slice(
					decompressed.byteOffset,
					decompressed.byteOffset + decompressed.byteLength
				) as ArrayBuffer;
				callback(null, exactBuffer);
			} catch (error) {
				callback(error instanceof Error ? error : new Error(String(error)));
			}
		};

		loader.load((err: Error | null, dictionary: unknown) => {
			if (err) {
				reject(err);
			} else {
				resolve(new Tokenizer(dictionary));
			}
		});
	});
}

export interface TokenizedWord {
	surfaceForm: string;
	reading: string | null;  // katakana reading
	basicForm: string | null; // dictionary form
	pos: string; // part of speech
	conjugation: string | null; // conjugation form (e.g., 連用形, 未然形)
	position: number; // character position in text
}

/**
 * Tokenize Japanese text using kuromoji.
 * Returns enriched tokens with reading, dictionary form, and POS.
 */
export function tokenizeJapanese(
	tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>,
	text: string
): TokenizedWord[] {
	const tokens = tokenizer.tokenize(text);
	const result: TokenizedWord[] = [];

	for (const t of tokens) {
		// Build conjugation label (e.g., "連用形 of 食べる")
		const conjForm = t.conjugated_form !== '*' ? t.conjugated_form : null;
		const isConjugated = conjForm && t.basic_form !== '*' && t.basic_form !== t.surface_form;

		result.push({
			surfaceForm: t.surface_form,
			reading: katakanaToHiragana(t.reading) || null,
			basicForm: t.basic_form !== '*' ? t.basic_form : null,
			pos: t.pos,
			conjugation: isConjugated ? conjForm : null,
			position: t.word_position,
		});
	}

	return result;
}

/**
 * Convert katakana to hiragana for more natural reading display.
 */
function katakanaToHiragana(str: string | undefined): string | undefined {
	if (!str || str === '*') return undefined;
	return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
		String.fromCharCode(ch.charCodeAt(0) - 0x60)
	);
}
