import assert from 'node:assert/strict';
import { orderContainsWords, type ContainsPreview } from './contains-order';

function words(...values: string[]): ContainsPreview[] {
	return values.map((w) => ({ w, d: `${w} definition` }));
}

assert.deepEqual(
	orderContainsWords(words('先', '延', 'ば', 'し', '延ばし'), ['先延ばし']).map(({ w }) => w),
	['先', '延ばし', '延', 'ば', 'し'],
	'immediate Japanese subwords should precede their character-level breakdown'
);

assert.deepEqual(
	orderContainsWords(
		words('国', '際', '連', '合', '加', '盟', '国際', '連合', '加盟', '国際連合', '加盟国'),
		['国際連合加盟国']
	).map(({ w }) => w),
	['国際連合', '加盟国', '国際', '連合', '加盟', '国', '際', '連', '合', '加', '盟'],
	'each complete level should be shown before the next level'
);

assert.deepEqual(
	orderContainsWords(words('先', '延', 'ば', 'し'), ['先延ばし']).map(({ w }) => w),
	['先', '延', 'ば', 'し'],
	'character-only entries should keep their reading order'
);

console.log('✓ Contains hierarchy ordering tests passed');
