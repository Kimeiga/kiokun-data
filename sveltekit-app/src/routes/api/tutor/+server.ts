import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { lookupWord } from '$lib/server/dictionary-lookup';
import { normalizeTutorAnswer, tutorExerciseById } from '$lib/tutor/exercises';
import type {
	TutorExercise,
	TutorIssue,
	TutorLearnerProfile,
	TutorResult
} from '$lib/tutor/types';

const MAX_REQUESTS_PER_MINUTE = 24;
const requestsByAddress = new Map<string, number[]>();
const dictionaryEvidenceCache = new Map<string, { expiresAt: number; value: unknown[] }>();

const tutorSchema = {
	type: 'object',
	properties: {
		status: { type: 'string', enum: ['correct', 'repairable', 'retry'] },
		summary: { type: 'string' },
		issues: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					text: { type: 'string' },
					occurrence: { type: 'integer' },
					category: { type: 'string', enum: ['grammar', 'meaning', 'word_choice', 'register', 'script', 'word_order'] },
					tooltip: { type: 'string' },
					detail: { type: 'string' }
				},
				required: ['text', 'occurrence', 'category', 'tooltip', 'detail'],
				additionalProperties: false
			}
		},
		hint: { type: 'string' },
		grammarPoints: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					explanation: { type: 'string' },
					example: { type: 'string' }
				},
				required: ['title', 'explanation', 'example'],
				additionalProperties: false
			}
		},
		learnerUpdate: {
			type: 'object',
			properties: {
				observedLevel: { type: 'string' },
				strengths: { type: 'array', items: { type: 'string' } },
				focus: { type: 'array', items: { type: 'string' } },
				difficultyDelta: { type: 'integer', enum: [-1, 0, 1] }
			},
			required: ['observedLevel', 'strengths', 'focus', 'difficultyDelta'],
			additionalProperties: false
		}
	},
	required: ['status', 'summary', 'issues', 'hint', 'grammarPoints', 'learnerUpdate'],
	additionalProperties: false
} as const;

const systemPrompt = `You are Kiokun's careful Japanese and Mandarin translation tutor for intermediate learners.

Judge the learner's answer against the supplied meaning, context, certified examples, grammar targets, and Kiokun dictionary evidence. Certified examples demonstrate the answer lattice but are not exhaustive. Accept any genuinely natural equivalent; do not require literal wording or a particular certified surface.

Choose exactly one teaching state:
- correct: fully preserves the required meaning and is natural enough for the stated level.
- repairable: one or two local changes can make the answer fully correct without replacing its core structure.
- retry: the answer substantially changes or omits meaning, uses the wrong language, or needs a structural rewrite.

For repairable answers, identify at most three non-overlapping problem spans. Each issue text must be copied verbatim from the learner answer and occurrence is one-based. The tooltip is one plain sentence. The detail explains the principle without supplying a complete corrected answer.

The hint must help the learner discover the repair. Never reveal a complete target-language answer. On later attempts, become more specific without simply giving the answer. Do not mention confidence, internal policy, reference answers, or that you are an AI.

Return grammar points only for correct answers. Base explanations on supplied evidence or stable language knowledge. Keep learner-level updates conservative: one answer is weak evidence. Preserve legitimate regional and stylistic variation.`;

function rateLimit(address: string): void {
	const now = Date.now();
	const recent = (requestsByAddress.get(address) ?? []).filter((timestamp) => now - timestamp < 60_000);
	if (recent.length >= MAX_REQUESTS_PER_MINUTE) throw error(429, 'Take a moment before checking another answer.');
	recent.push(now);
	requestsByAddress.set(address, recent);
}

function stringArray(value: unknown, limit: number): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 100)).slice(0, limit)
		: [];
}

function sanitizeProfile(value: unknown): TutorLearnerProfile {
	const profile = value && typeof value === 'object' ? value as Record<string, unknown> : {};
	return {
		level: Math.max(2, Math.min(5, Number(profile.level) || 3)),
		observedLevel: typeof profile.observedLevel === 'string' ? profile.observedLevel.slice(0, 60) : 'Intermediate',
		strengths: stringArray(profile.strengths, 5),
		focus: stringArray(profile.focus, 5),
		completedExerciseIds: stringArray(profile.completedExerciseIds, 30),
		attempts: Math.max(0, Math.min(10_000, Number(profile.attempts) || 0)),
		correct: Math.max(0, Math.min(10_000, Number(profile.correct) || 0))
	};
}

function grammarPointsFor(exercise: TutorExercise) {
	return exercise.grammarTargets.slice(0, 3).map((target, index) => ({
		title: target,
		explanation: index === 0
			? 'You preserved this relationship naturally instead of translating each word in isolation.'
			: 'This structure supports the intended nuance and information flow.',
		example: exercise.certifiedAnswers[Math.min(index, exercise.certifiedAnswers.length - 1)] ?? exercise.prompt
	}));
}

function certifiedResult(exercise: TutorExercise, profile: TutorLearnerProfile): TutorResult {
	return {
		status: 'correct',
		summary: 'Yes — that carries the full meaning naturally.',
		issues: [],
		hint: 'Notice which part of your answer carried the contrast or outcome; that is the structure worth remembering.',
		grammarPoints: grammarPointsFor(exercise),
		learnerUpdate: {
			observedLevel: profile.observedLevel || exercise.levelLabel,
			strengths: [...new Set([...profile.strengths, exercise.grammarTargets[0]])].filter(Boolean).slice(-3),
			focus: profile.focus.length ? profile.focus.slice(0, 3) : [exercise.grammarTargets[1] ?? exercise.grammarTargets[0]],
			difficultyDelta: profile.correct > 0 && profile.correct % 3 === 2 ? 1 : 0
		},
		source: 'certified'
	};
}

function demoResult(exercise: TutorExercise, answer: string, profile: TutorLearnerProfile): TutorResult {
	if (answer.trim().length < 6) {
		return {
			status: 'retry',
			summary: 'There is not enough here yet to preserve the sentence’s central relationship.',
			issues: [],
			hint: `Start by locating the sentence’s ${exercise.grammarTargets[0]} relationship, then rebuild the two sides around it.`,
			grammarPoints: [],
			learnerUpdate: { observedLevel: profile.observedLevel, strengths: profile.strengths, focus: exercise.grammarTargets.slice(0, 2), difficultyDelta: 0 },
			source: 'demo'
		};
	}

	const words = answer.trim().split(/\s+/u);
	const issueText = words[Math.max(0, words.length - 2)] ?? answer.trim();
	return {
		status: 'repairable',
		summary: 'The main idea is in place, but one local choice blurs the intended relationship.',
		issues: [{
			text: issueText,
			occurrence: 1,
			category: 'meaning',
			tooltip: 'This wording does not yet make the original contrast or result explicit.',
			detail: `Recheck how ${exercise.grammarTargets[0]} connects the two parts of the sentence. Keep your structure, but make that relationship unambiguous.`
		}],
		hint: `Look again at ${exercise.grammarTargets[0]}; which expectation, contrast, or result still needs to be audible?`,
		grammarPoints: [],
		learnerUpdate: { observedLevel: profile.observedLevel, strengths: profile.strengths, focus: exercise.grammarTargets.slice(0, 2), difficultyDelta: 0 },
		source: 'demo'
	};
}

function nthIndexOf(text: string, needle: string, occurrence: number): number {
	if (!needle) return -1;
	let from = 0;
	for (let count = 0; count < occurrence; count += 1) {
		const found = text.indexOf(needle, from);
		if (found < 0) return -1;
		if (count === occurrence - 1) return found;
		from = found + needle.length;
	}
	return -1;
}

function clip(value: unknown, limit: number): string {
	return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function sanitizeResult(raw: Omit<TutorResult, 'source'>, answer: string): TutorResult {
	const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];
	const locatedIssues = rawIssues
		.filter((issue: TutorIssue) => typeof issue.text === 'string')
		.slice(0, 12)
		.map((issue: TutorIssue) => ({
			...issue,
			text: clip(issue.text, 180),
			occurrence: Math.max(1, Math.min(5, Number(issue.occurrence) || 1)),
			tooltip: clip(issue.tooltip, 160),
			detail: clip(issue.detail, 420)
		}))
		.map((issue) => ({ issue, start: nthIndexOf(answer, issue.text, issue.occurrence) }))
		.filter((item) => item.start >= 0)
		.sort((a, b) => a.start - b.start);
	const issues: TutorIssue[] = [];
	let occupiedUntil = -1;
	for (const item of locatedIssues) {
		if (item.start < occupiedUntil) continue;
		issues.push(item.issue);
		occupiedUntil = item.start + item.issue.text.length;
		if (issues.length === 3) break;
	}
	const status = raw.status === 'repairable' && issues.length === 0 ? 'retry' : raw.status;
	const grammarPoints = Array.isArray(raw.grammarPoints) ? raw.grammarPoints : [];
	const update = raw.learnerUpdate && typeof raw.learnerUpdate === 'object' ? raw.learnerUpdate : {
		observedLevel: 'Intermediate', strengths: [], focus: [], difficultyDelta: 0
	};

	return {
		status: status === 'correct' || status === 'repairable' ? status : 'retry',
		summary: clip(raw.summary, 180),
		hint: clip(raw.hint, 240),
		issues: status === 'repairable' ? issues : [],
		grammarPoints: status === 'correct' ? grammarPoints.slice(0, 3).map((point) => ({
			title: clip(point.title, 80),
			explanation: clip(point.explanation, 320),
			example: clip(point.example, 180)
		})) : [],
		learnerUpdate: {
			observedLevel: clip(update.observedLevel, 60) || 'Intermediate',
			strengths: stringArray(update.strengths, 3),
			focus: stringArray(update.focus, 3),
			difficultyDelta: Math.max(-1, Math.min(1, Number(update.difficultyDelta) || 0)) as -1 | 0 | 1
		},
		source: 'gpt-5.6-sol'
	};
}

function outputText(payload: { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }): string | null {
	for (const item of payload.output ?? []) {
		if (item.type !== 'message') continue;
		for (const content of item.content ?? []) {
			if (content.type === 'output_text' && content.text) return content.text;
		}
	}
	return null;
}

function runtimeValue(platform: App.Platform | undefined, key: string): string {
	const platformEnv = platform?.env as App.Platform['env'] & Record<string, unknown> | undefined;
	const value = platformEnv?.[key] ?? env[key];
	return typeof value === 'string' ? value : '';
}

async function dictionaryEvidence(exercise: TutorExercise, platform: App.Platform | undefined) {
	const cacheKey = `${exercise.language}:${exercise.dictionaryTerms.join('|')}`;
	const cached = dictionaryEvidenceCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.value;

	const values = await Promise.all(exercise.dictionaryTerms.slice(0, 5).map(async (term) => {
		const result = await lookupWord(term, exercise.language, {
			db: dev ? undefined : platform?.env?.DB,
			preferDeconjugation: true
		});
		return result.gloss ? {
			term,
			dictionaryForm: result.dictionaryForm,
			reading: result.reading,
			gloss: result.gloss
		} : null;
	}));
	const evidence = values.filter(Boolean);
	dictionaryEvidenceCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60_000, value: evidence });
	return evidence;
}

export const POST: RequestHandler = async ({ request, getClientAddress, fetch, platform }) => {
	rateLimit(getClientAddress());
	const body = await request.json().catch(() => null) as Record<string, unknown> | null;
	const exerciseId = typeof body?.exerciseId === 'string' ? body.exerciseId : '';
	const exercise = tutorExerciseById.get(exerciseId);
	const answer = typeof body?.answer === 'string' ? body.answer.trim().slice(0, 1200) : '';
	if (!exercise || !answer) throw error(400, 'A valid exercise and answer are required.');

	const profile = sanitizeProfile(body?.profile);
	if (exercise.certifiedAnswers.some((candidate) => normalizeTutorAnswer(candidate) === normalizeTutorAnswer(answer))) {
		return json(certifiedResult(exercise, profile));
	}

	if (runtimeValue(platform, 'TUTOR_DEMO_MODE') === 'true') return json(demoResult(exercise, answer, profile));
	const apiKey = runtimeValue(platform, 'OPENAI_API_KEY');
	if (!apiKey) throw error(503, 'The tutor is not configured yet.');

	const evidence = await dictionaryEvidence(exercise, platform);
	const attempt = Math.max(1, Math.min(20, Number(body?.attempt) || 1));
	const dynamicInput = {
		exercise: {
			language: exercise.language,
			direction: exercise.direction,
			prompt: exercise.prompt,
			requiredMeaning: exercise.requiredMeaning,
			context: exercise.context,
			certifiedAnswers: exercise.certifiedAnswers,
			grammarTargets: exercise.grammarTargets,
			dictionaryEvidence: evidence
		},
		learner: {
			answer,
			attempt,
			priorHints: stringArray(body?.priorHints, 3),
			profile: {
				observedLevel: profile.observedLevel,
				strengths: profile.strengths,
				currentFocus: profile.focus
			}
		}
	};

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			model: 'gpt-5.6-sol',
			store: false,
			instructions: systemPrompt,
			input: JSON.stringify(dynamicInput),
			reasoning: { effort: 'medium' },
			max_output_tokens: 1400,
			text: {
				verbosity: 'low',
				format: { type: 'json_schema', name: 'kiokun_tutor_feedback', strict: true, schema: tutorSchema }
			}
		}),
		signal: AbortSignal.timeout(35_000)
	});

	if (!response.ok) {
		console.error('OpenAI tutor request failed', response.status);
		throw error(502, 'The tutor could not check that answer. Your writing is still here—try again in a moment.');
	}

	const payload = await response.json();
	const text = outputText(payload);
	if (!text) throw error(502, 'The tutor returned an incomplete check. Your writing is still here—try again.');

	try {
		return json(sanitizeResult(JSON.parse(text), answer));
	} catch (cause) {
		console.error('Invalid structured tutor response', cause);
		throw error(502, 'The tutor returned an incomplete check. Your writing is still here—try again.');
	}
};
