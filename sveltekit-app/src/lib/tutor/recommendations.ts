import {
	createCourseLessonRecommendation,
	recommendCourseLesson,
	type CourseLessonRecommendation
} from '$lib/courses/recommendations';
import type { TutorExercise } from './types';

const lessonByExerciseId: Record<string, { lessonId: string; reason: string }> = {
	'ja-comprehension-01': {
		lessonId: 'u4-01-find-place',
		reason: 'Review the location and station language used in the prompt.'
	},
	'zh-comprehension-01': {
		lessonId: 'zh-12-routine',
		reason: 'Review the routine vocabulary used to describe resting and a change in condition.'
	},
	'ja-production-01': {
		lessonId: 'u2-03-frequency',
		reason: 'Review the frequency and negative patterns used to describe a short-lived routine.'
	},
	'zh-production-01': {
		lessonId: 'zh-13-frequency-negation',
		reason: 'Review the negative pattern used to say that an action will no longer continue.'
	},
	'ja-comprehension-02': {
		lessonId: 'u4-03-invite',
		reason: 'Review the patterns for proposing, accepting, and declining an activity.'
	},
	'zh-comprehension-02': {
		lessonId: 'zh-11-clock-time',
		reason: 'Review time expressions used when discussing transport and a near miss.'
	},
	'ja-production-02': {
		lessonId: 'u6-01-likes',
		reason: 'Review the pattern for stating whether you like an idea or activity.'
	},
	'zh-production-02': {
		lessonId: 'zh-13-frequency-negation',
		reason: 'Review Mandarin negative forms before revisiting the contrast in this sentence.'
	}
};

export function recommendTutorLesson(exercise: TutorExercise): CourseLessonRecommendation | null {
	const mapped = lessonByExerciseId[exercise.id];
	if (mapped) {
		return createCourseLessonRecommendation(exercise.language, mapped.lessonId, mapped.reason);
	}

	const english = exercise.direction === 'from_english'
		? exercise.prompt
		: exercise.certifiedAnswers[0] ?? exercise.requiredMeaning;
	const target = exercise.direction === 'to_english'
		? exercise.prompt
		: exercise.certifiedAnswers[0] ?? '';
	return recommendCourseLesson(exercise.language, english, target);
}
