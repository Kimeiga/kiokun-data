import assert from 'node:assert/strict';
import {
	compactKoreanGloss,
	getKoreanDisplayTokens,
	getKoreanMorphologyGloss,
	getKoreanSuffixGloss,
} from './korean-gloss-helpers';

assert.deepEqual(
	getKoreanDisplayTokens('1970년 12월 29일생'),
	['1970년', '12월', '29일생'],
);
assert.deepEqual(getKoreanDisplayTokens('그는 학생이다.'), ['그는', '학생이다']);

assert.equal(getKoreanMorphologyGloss('1970년'), '1970 year');
assert.equal(getKoreanMorphologyGloss('12월'), 'December');
assert.equal(getKoreanMorphologyGloss('29일생'), 'born on the twenty-ninth');
assert.equal(getKoreanMorphologyGloss('1년생'), 'one-year-old; first-year');
assert.equal(getKoreanMorphologyGloss('십오'), 'fifteen');
assert.equal(getKoreanMorphologyGloss('년생'), 'year-old; student in that year');
assert.equal(getKoreanSuffixGloss('갑자생'), 'born; student');

assert.equal(compactKoreanGloss('-nyeon — A suffix used to mean the year.'), 'year');
assert.equal(
	compactKoreanGloss('nyeonsaeng — A bound noun used to refer to a student in a certain grade.'),
	'student in a certain grade',
);
assert.equal(compactKoreanGloss('life; lifetime — One\'s lifetime from birth to death.'), 'life');

console.log('korean gloss helper tests passed');
