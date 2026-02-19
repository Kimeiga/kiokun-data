/**
 * SM-2 Spaced Repetition Algorithm
 * 
 * Based on the SuperMemo SM-2 algorithm:
 * https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 * 
 * Quality ratings:
 * 0 - Complete blackout, no recall
 * 1 - Incorrect, but upon seeing correct answer, remembered
 * 2 - Incorrect, but correct answer seemed easy to recall
 * 3 - Correct with serious difficulty
 * 4 - Correct with some hesitation
 * 5 - Perfect response
 * 
 * Simplified to 4 buttons for UX:
 * - Again (0): Complete failure, reset
 * - Hard (2): Correct but difficult
 * - Good (4): Correct with normal effort
 * - Easy (5): Perfect, effortless
 */

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface SRSCard {
	easeFactor: number; // Stored as integer (250 = 2.5)
	interval: number; // Days
	repetitions: number; // Successful reviews in a row
}

export interface ReviewResult {
	easeFactor: number;
	interval: number;
	repetitions: number;
	nextReview: Date;
}

// Map user-friendly ratings to SM-2 quality scores
const ratingToQuality: Record<ReviewRating, number> = {
	again: 0,
	hard: 2,
	good: 4,
	easy: 5,
};

/**
 * Calculate the next review parameters using SM-2 algorithm
 */
export function calculateNextReview(
	card: SRSCard,
	rating: ReviewRating
): ReviewResult {
	const quality = ratingToQuality[rating];
	let { easeFactor, interval, repetitions } = card;
	
	// Convert ease factor from integer storage (250) to decimal (2.5)
	let ef = easeFactor / 100;
	
	if (quality < 3) {
		// Failed review - reset repetitions
		repetitions = 0;
		interval = 0;
	} else {
		// Successful review
		if (repetitions === 0) {
			interval = 1;
		} else if (repetitions === 1) {
			interval = 6;
		} else {
			interval = Math.round(interval * ef);
		}
		repetitions += 1;
	}
	
	// Update ease factor
	// EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
	ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
	
	// Minimum ease factor is 1.3
	ef = Math.max(1.3, ef);
	
	// For "again", show again in 10 minutes (0 days, will show same session)
	// For "hard", reduce the interval slightly
	if (rating === 'again') {
		interval = 0; // Will be shown again in current session
	} else if (rating === 'hard' && interval > 1) {
		interval = Math.max(1, Math.round(interval * 0.8));
	} else if (rating === 'easy') {
		// Bonus for easy cards
		interval = Math.round(interval * 1.3);
	}
	
	// Calculate next review date
	const nextReview = new Date();
	nextReview.setDate(nextReview.getDate() + interval);
	// Set to start of day for consistent scheduling
	nextReview.setHours(0, 0, 0, 0);
	
	return {
		easeFactor: Math.round(ef * 100), // Store as integer
		interval,
		repetitions,
		nextReview,
	};
}

/**
 * Get cards due for review (nextReview <= now)
 */
export function isDue(nextReview: Date): boolean {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	return nextReview <= now;
}

/**
 * Format interval for display
 */
export function formatInterval(days: number): string {
	if (days === 0) return 'Now';
	if (days === 1) return '1 day';
	if (days < 7) return `${days} days`;
	if (days < 30) {
		const weeks = Math.round(days / 7);
		return weeks === 1 ? '1 week' : `${weeks} weeks`;
	}
	if (days < 365) {
		const months = Math.round(days / 30);
		return months === 1 ? '1 month' : `${months} months`;
	}
	const years = Math.round(days / 365);
	return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Preview what the next interval would be for each rating
 */
export function previewIntervals(card: SRSCard): Record<ReviewRating, string> {
	const ratings: ReviewRating[] = ['again', 'hard', 'good', 'easy'];
	const result: Record<ReviewRating, string> = {} as Record<ReviewRating, string>;
	
	for (const rating of ratings) {
		const { interval } = calculateNextReview(card, rating);
		result[rating] = formatInterval(interval);
	}
	
	return result;
}

/**
 * Generate a unique ID for study cards
 */
export function generateStudyCardId(): string {
	return `sc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

