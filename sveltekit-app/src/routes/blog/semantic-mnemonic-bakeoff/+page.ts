import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const prerender = true;

export interface MnemonicOutput {
	character: string;
	meaning: string;
	equation: string;
	mnemonic: string;
	hero_image_prompt?: string;
}

export interface ModelValidation {
	problems: string[];
	valid: boolean;
	heuristic_score: number;
	style_score?: number;
	combined_score?: number;
	card?: MnemonicOutput;
}

export interface ModelResult {
	name: string;
	provider: string;
	model: string;
	ok: boolean;
	elapsed_seconds: number;
	score?: number;
	partial_score?: number;
	coverage?: number;
	valid_count?: number;
	problem_count?: number;
	outputs?: MnemonicOutput[];
	validations?: ModelValidation[];
	error?: string;
}

export interface RankedResult {
	name: string;
	provider: string;
	model: string;
	score: number;
	elapsed_seconds: number;
	valid_count?: number;
	problem_count?: number;
	coverage?: number;
}

export interface BakeoffCharacter {
	character: string;
	meaning: string;
	components: Array<{ character: string; gloss: string }>;
	gold_equation?: string;
	gold_mnemonic?: string;
}

export interface MnemonicBakeoffData {
	created_at: string;
	prompt_note: string;
	characters: BakeoffCharacter[];
	skipped?: Record<string, string>;
	results: ModelResult[];
	ranked: RankedResult[];
	recommendation?: {
		model: string;
		reason: string;
	};
}

export const load: PageLoad<MnemonicBakeoffData> = async ({ fetch }) => {
	const response = await fetch('/research/mnemonics/semantic_mnemonic_benchmark_22.json');
	if (!response.ok) {
		error(404, 'Expanded semantic mnemonic benchmark data not found');
	}

	return response.json();
};
