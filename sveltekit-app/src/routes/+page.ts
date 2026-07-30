import { getHomeDailyPicks } from '$lib/home-daily-picks';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	return {
		dailyPicks: getHomeDailyPicks()
	};
};
