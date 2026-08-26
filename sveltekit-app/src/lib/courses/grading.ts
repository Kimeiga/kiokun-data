import type {
	AnswerStatus,
	ArrangeActivity,
	ChoiceActivity,
	ShortAnswerActivity
} from './types';

export function normalizeCourseAnswer(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.replace(/[。！？!?、，,]/g, '')
		.replace(/\s+/g, '')
		.trim();
}

export function gradeChoice(activity: ChoiceActivity, value: string): AnswerStatus {
	if (!value.trim()) return 'invalid_input';
	return value === activity.answer ? 'certified_correct' : 'target_mismatch';
}

export function gradeArrangement(activity: ArrangeActivity, tiles: string[]): AnswerStatus {
	if (tiles.length === 0) return 'invalid_input';
	const attempt = normalizeCourseAnswer(tiles.join(''));
	const answer = normalizeCourseAnswer(activity.answer.join(''));
	return attempt === answer ? 'certified_correct' : 'target_mismatch';
}

export function gradeShortAnswer(activity: ShortAnswerActivity, value: string): AnswerStatus {
	const attempt = normalizeCourseAnswer(value);
	if (!attempt) return 'invalid_input';
	const accepted = activity.acceptedAnswers.some(
		(answer) => normalizeCourseAnswer(answer) === attempt
	);
	return accepted ? 'certified_correct' : 'target_mismatch';
}

export function isPassingStatus(status: AnswerStatus | undefined): boolean {
	return status === 'certified_correct' || status === 'unverified';
}
