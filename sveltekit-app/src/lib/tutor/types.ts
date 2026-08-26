export type TutorLanguage = 'ja' | 'zh';
export type TutorDirection = 'to_english' | 'from_english';
export type TutorStatus = 'correct' | 'repairable' | 'retry';

export interface TutorPromptToken {
	text: string;
	lookup?: string;
}

export interface TutorExercise {
	id: string;
	language: TutorLanguage;
	direction: TutorDirection;
	prompt: string;
	promptTokens: TutorPromptToken[];
	level: number;
	levelLabel: string;
	requiredMeaning: string;
	context: string;
	certifiedAnswers: string[];
	grammarTargets: string[];
	dictionaryTerms: string[];
}

export interface TutorIssue {
	text: string;
	occurrence: number;
	category: 'grammar' | 'meaning' | 'word_choice' | 'register' | 'script' | 'word_order';
	tooltip: string;
	detail: string;
}

export interface TutorGrammarPoint {
	title: string;
	explanation: string;
	example: string;
}

export interface TutorLearnerUpdate {
	observedLevel: string;
	strengths: string[];
	focus: string[];
	difficultyDelta: -1 | 0 | 1;
}

export interface TutorResult {
	status: TutorStatus;
	summary: string;
	issues: TutorIssue[];
	hint: string;
	grammarPoints: TutorGrammarPoint[];
	learnerUpdate: TutorLearnerUpdate;
	source: 'certified' | 'gpt-5.6-sol' | 'demo';
}

export interface TutorLearnerProfile {
	level: number;
	observedLevel: string;
	strengths: string[];
	focus: string[];
	completedExerciseIds: string[];
	attempts: number;
	correct: number;
}

export interface TutorRequest {
	exerciseId: string;
	answer: string;
	attempt: number;
	priorHints: string[];
	profile: TutorLearnerProfile;
}
