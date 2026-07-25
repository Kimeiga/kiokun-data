import type { JapaneseSense } from './types';

export interface JapaneseSenseExample {
	text: string;
	translation?: string;
}

export function japaneseExamplesForSense(sense: JapaneseSense): JapaneseSenseExample[] {
	const examples: JapaneseSenseExample[] = [];
	for (const example of sense.examples || []) {
		const japanese = example.sentences?.find(
			(sentence) => (sentence as any).land === 'jpn' || sentence.lang === 'jpn'
		);
		const english = example.sentences?.find(
			(sentence) => (sentence as any).land === 'eng' || sentence.lang === 'eng'
		);
		if (!japanese?.text) continue;
		examples.push({
			text: japanese.text,
			translation: english?.text
		});
	}
	return examples;
}
