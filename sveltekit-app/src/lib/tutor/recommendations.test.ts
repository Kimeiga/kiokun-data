import assert from 'node:assert/strict';
import { getCourseBySlug, getCourseLesson } from '$lib/courses/catalog';
import { tutorExercises } from './exercises';
import { recommendTutorLesson } from './recommendations';

const expectedLessonByExercise: Record<string, string> = {
	'ja-comprehension-01': 'u4-01-find-place',
	'zh-comprehension-01': 'zh-12-routine',
	'ja-production-01': 'u2-03-frequency',
	'zh-production-01': 'zh-13-frequency-negation',
	'ja-comprehension-02': 'u4-03-invite',
	'zh-comprehension-02': 'zh-11-clock-time',
	'ja-production-02': 'u6-01-likes',
	'zh-production-02': 'zh-13-frequency-negation'
};

for (const exercise of tutorExercises) {
	const recommendation = recommendTutorLesson(exercise);
	assert.ok(recommendation, `${exercise.id} needs a course recommendation`);
	assert.equal(recommendation.lessonId, expectedLessonByExercise[exercise.id]);
	const slug = exercise.language === 'ja' ? 'japanese' : 'mandarin';
	const course = getCourseBySlug(slug);
	assert.ok(course && getCourseLesson(course, recommendation.lessonId));
	assert.equal(recommendation.href, `/courses/${slug}/${recommendation.lessonId}`);
}

console.log(`Tutor recommendation tests passed (${tutorExercises.length} exercises).`);
