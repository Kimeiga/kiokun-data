import assert from 'node:assert/strict';
import { gradeArrangement, gradeChoice, gradeShortAnswer, normalizeCourseAnswer } from './grading';
import { japaneseA1Course } from './japanese-a1';
import type { ArrangeActivity, ChoiceActivity, ShortAnswerActivity } from './types';

assert.equal(japaneseA1Course.units.length, 6);
assert.equal(japaneseA1Course.lessons.length, 32);
assert.deepEqual(
	japaneseA1Course.lessons.map((lesson) => lesson.sequence),
	Array.from({ length: 32 }, (_, index) => index + 1)
);
assert.equal(new Set(japaneseA1Course.lessons.map((lesson) => lesson.id)).size, 32);
assert.equal(japaneseA1Course.units[0].lessonIds.length, 8);
assert.equal(japaneseA1Course.lessons[0].id, 'lp-00-writing-systems');
assert.equal(japaneseA1Course.lessons[0].scriptCharts?.length, 2);
assert.equal(japaneseA1Course.lessons[0].scriptCharts?.[0].rows.length, 11);
assert.equal(japaneseA1Course.lessons[0].scriptCharts?.[1].rows.length, 11);
assert.ok(
	japaneseA1Course.lessons.some((lesson) => lesson.id === 'lp-05-voicing-marks'),
	'launchpad needs a dakuten and handakuten lesson'
);
assert.ok(
	japaneseA1Course.lessons.some((lesson) => lesson.id === 'lp-06-contracted-sounds'),
	'launchpad needs contracted sounds and ヴ'
);
assert.ok(
	japaneseA1Course.lessons.some((lesson) => lesson.id === 'u5-04-family-home-mission'),
	'course needs an integrated family and home mission'
);

for (const unit of japaneseA1Course.units) {
	assert.ok(unit.lessonIds.length >= 4, unit.id + ' must contain at least four lessons');
	for (const lessonId of unit.lessonIds) {
		assert.ok(
			japaneseA1Course.lessons.some((lesson) => lesson.id === lessonId),
			lessonId + ' must resolve to a lesson'
		);
	}
}

for (const lesson of japaneseA1Course.lessons) {
	assert.ok(lesson.canDo.length > 20, lesson.id + ' needs an observable Can-do');
	assert.ok(lesson.scenario.length >= 2, lesson.id + ' needs cold input');
	assert.ok(lesson.notice.length >= 2, lesson.id + ' needs noticing guidance');
	assert.ok(lesson.explanation.length >= 2, lesson.id + ' needs explanation');
	assert.ok(lesson.vocabulary.length >= 3, lesson.id + ' needs dictionary anchors');
	assert.ok(lesson.activities.length >= 3, lesson.id + ' needs retrieval and production');
	assert.ok(
		lesson.activities.some((activity) => activity.type === 'production'),
		lesson.id + ' needs original production'
	);
	assert.ok(lesson.transferPrompt.length > 20, lesson.id + ' needs a transfer check');
	assert.equal(
		new Set(lesson.activities.map((activity) => activity.id)).size,
		lesson.activities.length,
		lesson.id + ' activity ids must be unique'
	);
}

const activityIds = japaneseA1Course.lessons.flatMap((lesson) =>
	lesson.activities.map((activity) => activity.id)
);
assert.equal(
	new Set(activityIds).size,
	activityIds.length,
	'activity ids must be unique across the course'
);

const shortAnswer: ShortAnswerActivity = {
	id: 'test-short',
	type: 'short-answer',
	title: 'Test',
	prompt: 'Test',
	acceptedAnswers: ['もう一度お願いします'],
	referenceAnswer: 'もう一度お願いします。',
	rationale: 'Test'
};
assert.equal(gradeShortAnswer(shortAnswer, ' もう一度、お願いします。 '), 'certified_correct');
assert.equal(gradeShortAnswer(shortAnswer, ''), 'invalid_input');
assert.equal(gradeShortAnswer(shortAnswer, 'ゆっくりお願いします'), 'target_mismatch');

const arrangement: ArrangeActivity = {
	id: 'test-arrange',
	type: 'arrange',
	title: 'Test',
	prompt: 'Test',
	tiles: ['です', 'マヤ'],
	answer: ['マヤ', 'です'],
	translation: 'I am Maya.',
	rationale: 'Test'
};
assert.equal(gradeArrangement(arrangement, ['マヤ', 'です']), 'certified_correct');
assert.equal(gradeArrangement(arrangement, []), 'invalid_input');

const choice: ChoiceActivity = {
	id: 'test-choice',
	type: 'choice',
	title: 'Test',
	prompt: 'Test',
	options: [{ label: 'A', value: 'a' }],
	answer: 'a',
	rationale: 'Test'
};
assert.equal(gradeChoice(choice, 'a'), 'certified_correct');
assert.equal(gradeChoice(choice, 'b'), 'target_mismatch');
assert.equal(normalizeCourseAnswer(' 七時半です。 '), '七時半です');

console.log('Japanese A1 curriculum invariants passed');
