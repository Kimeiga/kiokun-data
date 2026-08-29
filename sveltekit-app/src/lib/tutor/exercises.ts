import type { TutorExercise, TutorLearnerProfile } from './types';

export const tutorExercises: TutorExercise[] = [
	{
		id: 'ja-comprehension-01',
		language: 'ja',
		direction: 'to_english',
		level: 3,
		levelLabel: 'Intermediate · Japanese',
		prompt: 'せっかく駅まで来たのに、電車を見送ることになってしまった。',
		promptTokens: [
			{ text: 'せっかく', lookup: 'せっかく' },
			{ text: '駅まで' },
			{ text: '来た' },
			{ text: 'のに、' },
			{ text: '電車を' },
			{ text: '見送る', lookup: '見送る' },
			{ text: 'ことに', lookup: 'ことになる' },
			{ text: 'なって' },
			{ text: 'しまった。', lookup: 'しまう' }
		],
		requiredMeaning: 'Although the speaker made the worthwhile effort to come as far as the station, circumstances resulted in them having to let the train go without boarding it; the outcome is regrettable.',
		context: 'The speaker intended to take the train. 見送る describes watching or letting this train depart, not seeing a person off.',
		certifiedAnswers: [
			'Even though I came all the way to the station, I ended up having to let the train go without me.',
			'Although I had gone to the trouble of coming to the station, I ended up watching the train leave.'
		],
		grammarTargets: ['せっかく…のに', 'ことになる', '〜てしまう'],
		dictionaryTerms: ['せっかく', '見送る', 'ことになる', 'しまう']
	},
	{
		id: 'zh-comprehension-01',
		language: 'zh',
		direction: 'to_english',
		level: 3,
		levelLabel: 'Intermediate · Mandarin',
		prompt: '我本来以为休息一下会好一点，结果反而更累了。',
		promptTokens: [
			{ text: '我' },
			{ text: '本来', lookup: '本来' },
			{ text: '以为' },
			{ text: '休息一下' },
			{ text: '会好一点，' },
			{ text: '结果' },
			{ text: '反而', lookup: '反而' },
			{ text: '更累了。' }
		],
		requiredMeaning: 'The speaker originally expected a short rest to make things somewhat better, but the actual result was the opposite: they became even more tired.',
		context: '反而 marks a reversal of the prior expectation. 更累 compares the final tiredness with the earlier state.',
		certifiedAnswers: [
			'I originally thought resting for a while would make me feel a little better, but instead I ended up even more tired.',
			'I thought a short rest would help, but it actually made me feel even more tired.'
		],
		grammarTargets: ['本来…结果…', '反而', '更 + adjective'],
		dictionaryTerms: ['本来', '反而', '结果']
	},
	{
		id: 'ja-production-01',
		language: 'ja',
		direction: 'from_english',
		level: 3,
		levelLabel: 'Intermediate · Japanese',
		prompt: 'I decided to walk to work every morning, but I gave up after only three days.',
		promptTokens: [{ text: 'I decided to walk to work every morning, but I gave up after only three days.' }],
		requiredMeaning: 'The speaker personally decided to make walking to work every morning a practice, but stopped doing it after just three days.',
		context: 'Use a form that expresses a personal decision, not an externally arranged outcome. Preserve the surprisingly short duration.',
		certifiedAnswers: ['毎朝歩いて通勤することにしたが、たった三日でやめてしまった。', '毎朝職場まで歩くことにしたのに、三日で諦めてしまった。'],
		grammarTargets: ['dictionary form + ことにする', 'たった + duration', '〜てしまう'],
		dictionaryTerms: ['ことにする', 'たった', 'しまう']
	},
	{
		id: 'zh-production-01',
		language: 'zh',
		direction: 'from_english',
		level: 3,
		levelLabel: 'Intermediate · Mandarin',
		prompt: 'Since you have already made up your mind, I will not try to persuade you anymore.',
		promptTokens: [{ text: 'Since you have already made up your mind, I will not try to persuade you anymore.' }],
		requiredMeaning: 'The other person’s decision is treated as an established reason; consequently the speaker will stop trying to persuade them.',
		context: 'A natural answer can use 既然 to establish the premise and 就 to introduce the consequence.',
		certifiedAnswers: ['既然你已经决定了，我就不再劝你了。', '既然你已经下定决心了，那我就不再说服你了。'],
		grammarTargets: ['既然…就…', '不再', '了 for changed situation'],
		dictionaryTerms: ['既然', '不再', '劝']
	},
	{
		id: 'ja-comprehension-02',
		language: 'ja',
		direction: 'to_english',
		level: 4,
		levelLabel: 'Upper intermediate · Japanese',
		prompt: '頼まれたから引き受けたというより、断る理由が見つからなかった。',
		promptTokens: [{ text: '頼まれたから' }, { text: '引き受けた' }, { text: 'というより、', lookup: 'というより' }, { text: '断る理由が' }, { text: '見つからなかった。' }],
		requiredMeaning: 'It was not so much that the speaker accepted because they were asked; rather, they could not find a reason to refuse.',
		context: 'というより revises the first proposed characterization in favor of the second; it does not necessarily deny that a request occurred.',
		certifiedAnswers: ['It was less that I accepted because I was asked and more that I could not find a reason to refuse.', 'Rather than taking it on simply because I was asked, I just could not think of a reason to say no.'],
		grammarTargets: ['X というより Y', 'passive 頼まれる', 'reason + が見つからない'],
		dictionaryTerms: ['引き受ける', 'というより', '断る']
	},
	{
		id: 'zh-comprehension-02',
		language: 'zh',
		direction: 'to_english',
		level: 4,
		levelLabel: 'Upper intermediate · Mandarin',
		prompt: '她差点儿错过末班车，好在司机多等了几秒。',
		promptTokens: [{ text: '她' }, { text: '差点儿', lookup: '差点儿' }, { text: '错过末班车，' }, { text: '好在', lookup: '好在' }, { text: '司机' }, { text: '多等了几秒。' }],
		requiredMeaning: 'She nearly missed the last bus or train, but did not miss it because the driver fortunately waited a few additional seconds.',
		context: '差点儿错过 describes a near miss: the undesirable event did not occur. 好在 introduces the fortunate preventing circumstance.',
		certifiedAnswers: ['She almost missed the last train, but fortunately the driver waited a few extra seconds.', 'She nearly missed the last service; luckily, the driver waited a few more seconds.'],
		grammarTargets: ['差点儿 + event', '好在', '多 + verb + quantity'],
		dictionaryTerms: ['差点儿', '好在', '末班车']
	},
	{
		id: 'ja-production-02',
		language: 'ja',
		direction: 'from_english',
		level: 4,
		levelLabel: 'Upper intermediate · Japanese',
		prompt: 'It is not that I dislike the plan; I am just worried that we do not have enough time.',
		promptTokens: [{ text: 'It is not that I dislike the plan; I am just worried that we do not have enough time.' }],
		requiredMeaning: 'The speaker denies disliking the plan and presents insufficient time as the actual concern.',
		context: 'A natural answer may use わけではない to reject an overly broad inference without asserting the exact opposite.',
		certifiedAnswers: ['その案が嫌いなわけではなく、ただ時間が足りないのではないかと心配している。', '計画が嫌なわけではない。ただ、時間が十分にないのではと心配している。'],
		grammarTargets: ['〜わけではない', '〜のではないか', 'contrastive ただ'],
		dictionaryTerms: ['わけではない', '心配', '足りる']
	},
	{
		id: 'zh-production-02',
		language: 'zh',
		direction: 'from_english',
		level: 4,
		levelLabel: 'Upper intermediate · Mandarin',
		prompt: 'Not only did the change fail to solve the problem, it made the situation even more complicated.',
		promptTokens: [{ text: 'Not only did the change fail to solve the problem, it made the situation even more complicated.' }],
		requiredMeaning: 'The change did not solve the problem and additionally worsened matters by increasing the situation’s complexity.',
		context: 'Preserve both the failed expected result and the contrary worsening. A natural answer may use 不但没…反而….',
		certifiedAnswers: ['这个改动不但没解决问题，反而让情况变得更复杂了。', '这次修改不仅没有解决问题，反而使情况更加复杂了。'],
		grammarTargets: ['不但/不仅…反而…', '没(有) + result', '让/使 + object + 变得'],
		dictionaryTerms: ['反而', '复杂', '改动']
	}
];

export const tutorExerciseById = new Map(tutorExercises.map((exercise) => [exercise.id, exercise]));

export function chooseNextTutorExercise(
	profile: TutorLearnerProfile,
	currentId: string | null,
	random: () => number = Math.random
): TutorExercise {
	const unseen = tutorExercises.filter((exercise) => !profile.completedExerciseIds.includes(exercise.id) && exercise.id !== currentId);
	const pool = unseen.length ? unseen : tutorExercises.filter((exercise) => exercise.id !== currentId);
	const nearLevel = pool.filter((exercise) => Math.abs(exercise.level - profile.level) <= 1);
	const candidates = nearLevel.length ? nearLevel : pool;
	const focused = candidates.filter((exercise) => exercise.grammarTargets.some((target) =>
		profile.focus.some((focus) => target.includes(focus) || focus.includes(target))
	));
	const selectionPool = focused.length ? [...candidates, ...focused] : candidates;
	const randomIndex = Math.min(
		selectionPool.length - 1,
		Math.max(0, Math.floor(random() * selectionPool.length))
	);

	return selectionPool[randomIndex] ?? tutorExercises[0];
}

export function normalizeTutorAnswer(value: string): string {
	return value.normalize('NFKC').trim().replace(/[。！？.!?]+$/u, '').replace(/\s+/g, ' ').toLocaleLowerCase();
}
