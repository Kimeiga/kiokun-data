/**
 * Kuromoji tokenizer loader for Cloudflare Workers.
 * Loads dictionary files from R2 bucket instead of filesystem.
 */
import kuromoji from 'kuromoji';
import type { R2Bucket } from '@cloudflare/workers-types';

let cachedTokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

/**
 * Get or initialize the kuromoji tokenizer.
 * Dictionary files are loaded from R2 on first call, then cached.
 */
export async function getTokenizer(bucket: R2Bucket): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
	if (cachedTokenizer) return cachedTokenizer;

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

	// Build tokenizer with custom dictionary loader
	return new Promise((resolve, reject) => {
		// Monkey-patch the dictionary loader to use our R2 buffers
		const builder = kuromoji.builder({
			dicPath: '/dummy/', // Won't actually be used
		});

		// Override the internal loader
		(builder as any).loader.load = function (url: string, callback: (err: any, data: any) => void) {
			const filename = url.split('/').pop()!;
			const buffer = dictBuffers[filename];
			if (buffer) {
				callback(null, new Uint8Array(buffer));
			} else {
				callback(new Error(`Dictionary file not found: ${filename}`), null);
			}
		};

		builder.build((err, tokenizer) => {
			if (err) {
				reject(err);
			} else {
				cachedTokenizer = tokenizer;
				resolve(tokenizer);
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
