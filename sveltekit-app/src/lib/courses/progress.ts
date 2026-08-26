import type { AnswerStatus, CourseProgress } from './types';

const DEFAULT_COURSE_ID = 'japanese-a1';

function storageKey(courseId: string): string {
	return `kiokun:course:${courseId}:progress:v1`;
}

export function emptyCourseProgress(): CourseProgress {
	return { version: 1, lessons: {} };
}

export function loadCourseProgress(
	storage: Pick<Storage, 'getItem'>,
	courseId = DEFAULT_COURSE_ID
): CourseProgress {
	try {
		const raw = storage.getItem(storageKey(courseId));
		if (!raw) return emptyCourseProgress();
		const parsed = JSON.parse(raw) as Partial<CourseProgress>;
		if (parsed.version !== 1 || !parsed.lessons || typeof parsed.lessons !== 'object') {
			return emptyCourseProgress();
		}
		return parsed as CourseProgress;
	} catch {
		return emptyCourseProgress();
	}
}

export function recordActivityAttempt(
	progress: CourseProgress,
	lessonId: string,
	activityId: string,
	status: AnswerStatus
): CourseProgress {
	const lesson = progress.lessons[lessonId] || { activities: {} };
	return {
		version: 1,
		lessons: {
			...progress.lessons,
			[lessonId]: {
				...lesson,
				activities: {
					...lesson.activities,
					[activityId]: { status, updatedAt: new Date().toISOString() }
				}
			}
		}
	};
}

export function markLessonComplete(progress: CourseProgress, lessonId: string): CourseProgress {
	const lesson = progress.lessons[lessonId] || { activities: {} };
	return {
		version: 1,
		lessons: {
			...progress.lessons,
			[lessonId]: {
				...lesson,
				completedAt: new Date().toISOString()
			}
		}
	};
}

export function saveCourseProgress(
	storage: Pick<Storage, 'setItem'>,
	progress: CourseProgress,
	courseId = DEFAULT_COURSE_ID
): void {
	storage.setItem(storageKey(courseId), JSON.stringify(progress));
}

export function completedLessonIds(progress: CourseProgress): Set<string> {
	return new Set(
		Object.entries(progress.lessons)
			.filter(([, lesson]) => Boolean(lesson.completedAt))
			.map(([lessonId]) => lessonId)
	);
}
