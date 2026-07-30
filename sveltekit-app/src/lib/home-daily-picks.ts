export interface HomeDailyPick {
	value: string;
	gloss: string;
}

export interface HomeDailyPicks {
	character: HomeDailyPick;
	word: HomeDailyPick;
}

// Keep the daily choices compact, dependable, and available to both SSR and
// the offline Capacitor build. Every item is also featured elsewhere on the
// homepage, so the daily cards never need a dictionary probe before rendering.
const characterPool: readonly HomeDailyPick[] = [
	{ value: '龍', gloss: 'dragon' },
	{ value: '圖', gloss: 'map' },
	{ value: '鐵', gloss: 'iron' },
	{ value: '齒', gloss: 'tooth' },
	{ value: '廣', gloss: 'wide' },
	{ value: '實', gloss: 'real' },
	{ value: '戰', gloss: 'war' },
	{ value: '驛', gloss: 'station' },
	{ value: '氣', gloss: 'energy / qi' },
	{ value: '樂', gloss: 'music / joy' },
	{ value: '觀', gloss: 'to observe' },
	{ value: '經', gloss: 'to pass through' },
	{ value: '變', gloss: 'to change' },
	{ value: '藝', gloss: 'art' },
	{ value: '賣', gloss: 'to sell' },
	{ value: '讀', gloss: 'to read' }
];

const wordPool: readonly HomeDailyPick[] = [
	{ value: '友達', gloss: 'friend' },
	{ value: '勉強', gloss: 'study' },
	{ value: '天気', gloss: 'weather' },
	{ value: '家族', gloss: 'family' },
	{ value: '約束', gloss: 'promise' },
	{ value: '冒険', gloss: 'adventure' },
	{ value: '努力', gloss: 'effort' },
	{ value: '希望', gloss: 'hope' },
	{ value: '自由', gloss: 'freedom' },
	{ value: '平和', gloss: 'peace' },
	{ value: '感謝', gloss: 'gratitude' },
	{ value: '挑戦', gloss: 'challenge' },
	{ value: '記憶', gloss: 'memory' },
	{ value: '幸福', gloss: 'happiness' },
	{ value: '運命', gloss: 'fate' },
	{ value: '冒頭', gloss: 'beginning' },
	{ value: '宇宙', gloss: 'universe' },
	{ value: '地球', gloss: 'earth' },
	{ value: '景色', gloss: 'scenery' },
	{ value: '季節', gloss: 'season' },
	{ value: '旅行', gloss: 'travel' },
	{ value: '健康', gloss: 'health' },
	{ value: '知識', gloss: 'knowledge' },
	{ value: '哲学', gloss: 'philosophy' },
	{ value: '芸術', gloss: 'art' },
	{ value: '言葉', gloss: 'word' },
	{ value: '夢中', gloss: 'absorbed' },
	{ value: '感動', gloss: 'emotion' },
	{ value: '永遠', gloss: 'eternity' },
	{ value: '瞬間', gloss: 'moment' }
];

function dayHash(seed: string): number {
	let hash = 0;
	for (let index = 0; index < seed.length; index += 1) {
		hash = (hash << 5) - hash + seed.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

function utcDayKey(date: Date): string {
	return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

export function getHomeDailyPicks(date = new Date()): HomeDailyPicks {
	const day = utcDayKey(date);
	return {
		character: characterPool[dayHash(day) % characterPool.length],
		word: wordPool[dayHash(`${day}-word`) % wordPool.length]
	};
}
