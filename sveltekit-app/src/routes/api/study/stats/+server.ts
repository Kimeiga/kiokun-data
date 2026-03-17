import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { studyCards } from "$lib/server/db/schema";
import { eq, and, lte, gte, count, sql } from "drizzle-orm";

// GET /api/study/stats - Get study statistics
export async function GET({ locals, platform }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);

	try {
		const now = new Date();
		const today = new Date(now);
		today.setHours(0, 0, 0, 0);
		
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		const nextWeek = new Date(today);
		nextWeek.setDate(nextWeek.getDate() + 7);

		// Get all cards for this user
		const allCards = await db.select()
			.from(studyCards)
			.where(eq(studyCards.userId, locals.user.id));

		// Calculate statistics
		const totalCards = allCards.length;
		
		// Cards due today (nextReview <= end of today)
		const dueToday = allCards.filter(c => 
			c.nextReview && new Date(c.nextReview) < tomorrow
		).length;

		// Cards due this week
		const dueThisWeek = allCards.filter(c => 
			c.nextReview && new Date(c.nextReview) < nextWeek
		).length;

		// Cards that have been reviewed at least once (learning progress)
		const cardsLearning = allCards.filter(c => c.repetitions > 0).length;
		const cardsNew = allCards.filter(c => c.repetitions === 0).length;
		
		// Cards with good retention (interval >= 21 days)
		const cardsMature = allCards.filter(c => c.interval >= 21).length;

		// Count by language
		const byLanguage: Record<string, number> = {};
		allCards.forEach(c => {
			byLanguage[c.language] = (byLanguage[c.language] || 0) + 1;
		});

		// Calculate average ease factor
		const avgEaseFactor = totalCards > 0
			? allCards.reduce((sum, c) => sum + c.easeFactor, 0) / totalCards / 100
			: 2.5;

		// Find review streak (consecutive days with reviews)
		// We look at unique dates in lastReviewed
		const reviewDates = new Set<string>();
		allCards.forEach(c => {
			if (c.lastReviewed) {
				const date = new Date(c.lastReviewed);
				reviewDates.add(date.toISOString().split('T')[0]);
			}
		});

		let streak = 0;
		const checkDate = new Date(today);
		// If user hasn't reviewed today yet, start checking from yesterday
		const todayStr = today.toISOString().split('T')[0];
		if (!reviewDates.has(todayStr)) {
			checkDate.setDate(checkDate.getDate() - 1);
		}
		
		while (reviewDates.has(checkDate.toISOString().split('T')[0])) {
			streak++;
			checkDate.setDate(checkDate.getDate() - 1);
		}

		// Total reviews done (sum of repetitions)
		const totalReviews = allCards.reduce((sum, c) => sum + c.repetitions, 0);

		// Leech cards: reviewed but ease factor dropped below 200 (struggling)
		const leeches = allCards.filter(c => c.repetitions === 0 && c.easeFactor < 200 && c.lastReviewed);
		const leechCount = leeches.length;
		const leechWords = leeches.slice(0, 10).map(c => c.word);

		// Forecast: cards due per day for next 7 days
		const forecast: number[] = [];
		for (let d = 0; d < 7; d++) {
			const dayStart = new Date(today);
			dayStart.setDate(dayStart.getDate() + d);
			const dayEnd = new Date(dayStart);
			dayEnd.setDate(dayEnd.getDate() + 1);
			forecast.push(allCards.filter(c =>
				c.nextReview && new Date(c.nextReview) >= dayStart && new Date(c.nextReview) < dayEnd
			).length);
		}

		return json({
			totalCards,
			dueToday,
			dueThisWeek,
			cardsNew,
			cardsLearning,
			cardsMature,
			byLanguage,
			avgEaseFactor: Math.round(avgEaseFactor * 100) / 100,
			streak,
			totalReviews,
			leechCount,
			leechWords,
			forecast,
		});
	} catch (err) {
		console.error("Error fetching stats:", err);
		throw error(500, "Failed to fetch statistics");
	}
}

