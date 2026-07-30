export interface ContainsPreview {
	w: string;
	d?: string;
	c?: boolean;
	fr?: number;
}

interface Candidate<T extends ContainsPreview> {
	item: T;
	index: number;
	chars: string[];
}

interface PlacedCandidate<T extends ContainsPreview> extends Candidate<T> {
	start: number;
	end: number;
}

interface Hierarchy<T extends ContainsPreview> {
	ordered: PlacedCandidate<T>[];
	topLevelCount: number;
}

/**
 * Orders containment cards breadth-first: the immediate lexical breakdown is
 * shown in reading order, then each component's deeper breakdown, then any
 * overlapping alternatives that did not participate in that hierarchy.
 */
export function orderContainsWords<T extends ContainsPreview>(
	words: T[],
	wordForms: string[]
): T[] {
	const candidates = words
		.map((item, index): Candidate<T> => ({ item, index, chars: [...item.w] }))
		.filter((candidate) => candidate.chars.length > 0);
	const forms = [...new Set(wordForms.filter(Boolean))];

	let selectedForm = forms[0] ?? '';
	let selectedHierarchy: Hierarchy<T> = { ordered: [], topLevelCount: Number.POSITIVE_INFINITY };

	for (const form of forms) {
		const hierarchy = buildHierarchy([...form], candidates);
		if (isBetterHierarchy(hierarchy, selectedHierarchy)) {
			selectedForm = form;
			selectedHierarchy = hierarchy;
		}
	}

	const used = new Set(selectedHierarchy.ordered.map((candidate) => candidate.index));
	const remaining = candidates
		.filter((candidate) => !used.has(candidate.index))
		.sort((a, b) => compareRemaining(a, b, selectedForm));

	return [
		...selectedHierarchy.ordered.map((candidate) => candidate.item),
		...remaining.map((candidate) => candidate.item)
	];
}

function buildHierarchy<T extends ContainsPreview>(
	form: string[],
	candidates: Candidate<T>[]
): Hierarchy<T> {
	if (form.length < 2) {
		return { ordered: [], topLevelCount: Number.POSITIVE_INFINITY };
	}

	const ordered: PlacedCandidate<T>[] = [];
	const used = new Set<number>();
	let ranges = [{ start: 0, end: form.length }];
	let topLevelCount = Number.POSITIVE_INFINITY;
	let level = 0;

	while (ranges.length > 0) {
		const nextRanges: Array<{ start: number; end: number }> = [];

		for (const range of ranges) {
			const breakdown = bestBreakdown(form, candidates, range.start, range.end);
			if (!breakdown) continue;
			if (level === 0) topLevelCount = breakdown.length;

			for (const candidate of breakdown) {
				if (!used.has(candidate.index)) {
					used.add(candidate.index);
					ordered.push(candidate);
				}
				if (candidate.end - candidate.start > 1) {
					nextRanges.push({ start: candidate.start, end: candidate.end });
				}
			}
		}

		ranges = nextRanges;
		level += 1;
	}

	return { ordered, topLevelCount };
}

function bestBreakdown<T extends ContainsPreview>(
	form: string[],
	candidates: Candidate<T>[],
	rangeStart: number,
	rangeEnd: number
): PlacedCandidate<T>[] | null {
	const memo = new Map<number, PlacedCandidate<T>[] | null>();

	const visit = (cursor: number): PlacedCandidate<T>[] | null => {
		if (cursor === rangeEnd) return [];
		if (memo.has(cursor)) return memo.get(cursor) ?? null;

		let best: PlacedCandidate<T>[] | null = null;
		for (const candidate of candidates) {
			const length = candidate.chars.length;
			const end = cursor + length;
			if (end > rangeEnd) continue;
			if (cursor === rangeStart && end === rangeEnd) continue;
			if (!matchesAt(form, candidate.chars, cursor)) continue;

			const tail = visit(end);
			if (!tail) continue;

			const solution: PlacedCandidate<T>[] = [
				{ ...candidate, start: cursor, end },
				...tail
			];
			if (isBetterBreakdown(solution, best)) best = solution;
		}

		memo.set(cursor, best);
		return best;
	};

	return visit(rangeStart);
}

function matchesAt(form: string[], candidate: string[], start: number): boolean {
	return candidate.every((character, offset) => form[start + offset] === character);
}

function isBetterBreakdown<T extends ContainsPreview>(
	candidate: PlacedCandidate<T>[],
	current: PlacedCandidate<T>[] | null
): boolean {
	if (!current) return true;
	if (candidate.length !== current.length) return candidate.length < current.length;

	const candidateQuality = candidate.reduce((total, value) => total + lexicalQuality(value.item), 0);
	const currentQuality = current.reduce((total, value) => total + lexicalQuality(value.item), 0);
	if (candidateQuality !== currentQuality) return candidateQuality > currentQuality;

	const candidateImbalance = lengthImbalance(candidate);
	const currentImbalance = lengthImbalance(current);
	if (candidateImbalance !== currentImbalance) return candidateImbalance < currentImbalance;

	for (let index = 0; index < candidate.length; index += 1) {
		if (candidate[index].index !== current[index].index) {
			return candidate[index].index < current[index].index;
		}
	}
	return false;
}

function lexicalQuality(item: ContainsPreview): number {
	let quality = item.d ? 4 : 0;
	if (item.c) quality += 2;
	if (item.fr !== undefined) quality += 1;
	return quality;
}

function lengthImbalance<T extends ContainsPreview>(values: PlacedCandidate<T>[]): number {
	const lengths = values.map((value) => value.end - value.start);
	return Math.max(...lengths) - Math.min(...lengths);
}

function isBetterHierarchy<T extends ContainsPreview>(
	candidate: Hierarchy<T>,
	current: Hierarchy<T>
): boolean {
	if (candidate.topLevelCount !== current.topLevelCount) {
		return candidate.topLevelCount < current.topLevelCount;
	}
	return candidate.ordered.length > current.ordered.length;
}

function compareRemaining<T extends ContainsPreview>(
	a: Candidate<T>,
	b: Candidate<T>,
	form: string
): number {
	const positionA = form.indexOf(a.item.w);
	const positionB = form.indexOf(b.item.w);
	const normalizedA = positionA === -1 ? Number.POSITIVE_INFINITY : positionA;
	const normalizedB = positionB === -1 ? Number.POSITIVE_INFINITY : positionB;

	if (a.chars.length !== b.chars.length) return b.chars.length - a.chars.length;
	if (normalizedA !== normalizedB) return normalizedA - normalizedB;
	return a.index - b.index;
}
