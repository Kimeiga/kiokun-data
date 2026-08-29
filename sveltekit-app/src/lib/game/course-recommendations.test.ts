import assert from 'node:assert/strict';
import { getCourseBySlug, getCourseLesson } from '$lib/courses/catalog';
import { recommendCourseLesson } from './course-recommendations';

const cases = [
	['ja', 'Where is the station?', '駅はどこですか。', 'japanese', 'u4-01-find-place'],
	['zh', 'What is your name?', '你叫什么名字？', 'mandarin', 'zh-05-name'],
	['ko', 'How is the weather today?', '오늘 날씨가 어때요?', 'korean', 'ko-25-weather'],
	['ja', 'What did you do over the weekend?', '週末、何をしましたか。', 'japanese', 'u6-03-weekend-past']
] as const;

for (const [language, english, target, slug, expectedLessonId] of cases) {
	const recommendation = recommendCourseLesson(language, english, target);
	assert.ok(recommendation, `${language} needs a recommendation`);
	assert.equal(recommendation.lessonId, expectedLessonId);
	assert.equal(recommendation.href, `/courses/${slug}/${expectedLessonId}`);
	const course = getCourseBySlug(slug);
	assert.ok(course && getCourseLesson(course, recommendation.lessonId));
}

const fallback = recommendCourseLesson('ko', 'This is an unusual sentence.', '특이한 문장이에요.');
assert.equal(fallback?.lessonId, 'ko-00-blocks');
assert.equal(recommendCourseLesson('tr', 'Hello.', 'Merhaba.'), null);

console.log('Course recommendation invariants passed');
