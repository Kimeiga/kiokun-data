import type { PronunciationMnemonicCard } from '$lib/types';

export interface PronunciationLanguagePreferences {
	chinese: boolean;
	japanese: boolean;
}

export function filterPronunciationCards(
	cards: PronunciationMnemonicCard[] | undefined,
	preferences: PronunciationLanguagePreferences
): PronunciationMnemonicCard[] {
	return (cards || []).filter((card) =>
		card.language === 'zh' ? preferences.chinese : preferences.japanese
	);
}

export function groupPronunciationReadings(card: PronunciationMnemonicCard) {
	return {
		core: card.readings.filter((reading) => reading.status === 'core'),
		secondary: card.readings.filter((reading) => reading.status === 'secondary')
	};
}
