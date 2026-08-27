import assert from 'node:assert/strict';
import { languageCourses } from './catalog';
import { gradeChoice } from './grading';

const expectedLessonCounts = new Map([
	['japanese', 32],
	['mandarin', 24],
	['cantonese', 24],
	['korean', 24]
]);

let choiceCount = 0;

assert.deepEqual(
	languageCourses.map((course) => course.slug),
	['japanese', 'mandarin', 'cantonese', 'korean']
);

for (const course of languageCourses) {
	const expectedCount = expectedLessonCounts.get(course.slug);
	assert.equal(course.lessons.length, expectedCount, course.slug + ' lesson count');
	assert.deepEqual(
		course.lessons.map((lesson) => lesson.sequence),
		Array.from({ length: course.lessons.length }, (_, index) => index + 1),
		course.slug + ' lesson sequence'
	);
	assert.equal(
		new Set(course.lessons.map((lesson) => lesson.id)).size,
		course.lessons.length,
		course.slug + ' lesson ids must be unique'
	);
	assert.ok(course.lessons[0].scriptCharts?.length, course.slug + ' must begin with a reference chart');

	const activityIds = course.lessons.flatMap((lesson) =>
		lesson.activities.map((activity) => activity.id)
	);
	assert.equal(
		new Set(activityIds).size,
		activityIds.length,
		course.slug + ' activity ids must be unique'
	);

	for (const unit of course.units) {
		assert.ok(unit.nativeTitle.length > 0, unit.id + ' needs a native title');
		for (const lessonId of unit.lessonIds) {
			assert.ok(
				course.lessons.some((lesson) => lesson.id === lessonId),
				course.slug + ': ' + lessonId + ' must resolve'
			);
		}
	}

	for (const lesson of course.lessons) {
		assert.ok(lesson.scenario.length >= 2, lesson.id + ' needs an initial example');
		assert.ok(lesson.notice.length >= 2, lesson.id + ' needs form-focused noticing');
		assert.ok(lesson.explanation.length >= 2, lesson.id + ' needs an explanation');
		assert.ok(lesson.vocabulary.length >= 3, lesson.id + ' needs dictionary references');
		assert.ok(lesson.activities.length >= 3, lesson.id + ' needs at least three practice activities');
		assert.ok(
			lesson.activities.some((activity) => activity.type === 'production'),
			lesson.id + ' needs open production'
		);
		assert.ok(lesson.transferPrompt.length > 20, lesson.id + ' needs a transfer task');

		for (const activity of lesson.activities) {
			if (activity.type !== 'choice') continue;
			choiceCount += 1;

			assert.ok(activity.prompt.trim().length > 0, activity.id + ' needs a prompt');
			assert.ok(activity.rationale.trim().length > 0, activity.id + ' needs corrective feedback');
			assert.ok(activity.options.length >= 3, activity.id + ' needs at least three options');
			assert.equal(
				new Set(activity.options.map((option) => option.value)).size,
				activity.options.length,
				activity.id + ' option values must be unique'
			);
			assert.equal(
				new Set(activity.options.map((option) => option.label.normalize('NFKC').trim())).size,
				activity.options.length,
				activity.id + ' option labels must be unique'
			);
			assert.equal(
				activity.options.filter((option) => option.value === activity.answer).length,
				1,
				activity.id + ' answer must match exactly one option'
			);
			assert.equal(gradeChoice(activity, ''), 'invalid_input', activity.id + ' must reject an empty attempt');

			for (const option of activity.options) {
				assert.equal(
					gradeChoice(activity, option.value),
					option.value === activity.answer ? 'certified_correct' : 'target_mismatch',
					activity.id + ': ' + option.value + ' must grade deterministically'
				);
			}
		}
	}
}

assert.equal(choiceCount, 120, 'every authored multiple-choice question must be validated');

const mandarin = languageCourses.find((course) => course.slug === 'mandarin');
const cantonese = languageCourses.find((course) => course.slug === 'cantonese');
const korean = languageCourses.find((course) => course.slug === 'korean');

assert.ok(mandarin?.lessons.some((lesson) => lesson.id === 'zh-04-tone-changes'));
assert.ok(cantonese?.lessons.some((lesson) => lesson.id === 'yue-04-stop-codas'));
assert.ok(korean?.lessons.some((lesson) => lesson.id === 'ko-05-batchim'));
assert.ok(mandarin?.lessons.some((lesson) => lesson.id === 'zh-23-family-home-mission'));
assert.ok(cantonese?.lessons.some((lesson) => lesson.id === 'yue-23-family-home-mission'));
assert.ok(korean?.lessons.some((lesson) => lesson.id === 'ko-23-family-home-mission'));
assert.equal(cantonese?.speechLanguage, 'yue');
assert.equal(cantonese?.studyLanguage, 'zh');

console.log('Multilingual course catalog invariants passed');
