export type RandomSource = () => number;

function randomIndex(total: number, random: RandomSource): number {
	const value = random();
	const bounded = Number.isFinite(value)
		? Math.min(Math.max(value, 0), 1 - Number.EPSILON)
		: 0;
	return Math.floor(bounded * total);
}

/**
 * Choose a global exercise position that has not appeared in this session.
 * Random retries preserve a random distribution in ordinary use. The scan is
 * a bounded fallback for a repeated or injected random value.
 */
export function chooseUnseenExerciseId(
	total: number,
	seen: ReadonlySet<number>,
	random: RandomSource = Math.random
): number {
	if (!Number.isInteger(total) || total <= 0) {
		throw new RangeError('Exercise total must be a positive integer');
	}
	if (seen.size >= total) {
		throw new RangeError('Every exercise has already been seen');
	}

	for (let attempt = 0; attempt < 24; attempt += 1) {
		const candidate = randomIndex(total, random);
		if (!seen.has(candidate)) return candidate;
	}

	const start = randomIndex(total, random);
	for (let offset = 0; offset < total; offset += 1) {
		const candidate = (start + offset) % total;
		if (!seen.has(candidate)) return candidate;
	}

	throw new RangeError('No unseen exercise is available');
}
