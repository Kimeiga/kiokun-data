export type AnswerStatus =
	| 'certified_correct'
	| 'target_mismatch'
	| 'unverified'
	| 'invalid_input';

export type LessonKind = 'sound' | 'script' | 'core' | 'reader' | 'mission';

export type CourseLanguage = 'ja' | 'zh' | 'yue' | 'ko';
export type StudyLanguage = 'ja' | 'zh' | 'ko';
export type SpeechLanguage = CourseLanguage;

export interface CourseVocabularyItem {
	word: string;
	reading: string;
	meaning: string;
	note?: string;
	dictionaryAnchor?: string;
}

export interface CourseDialogueLine {
	speaker: string;
	text: string;
	reading: string;
	translation: string;
}

export interface ScriptChartCell {
	symbol: string;
	romanization: string;
	note?: string;
}

export interface ScriptChartRow {
	label: string;
	cells: Array<ScriptChartCell | null>;
}

export interface ScriptChart {
	title: string;
	caption: string;
	columns: string[];
	rows: ScriptChartRow[];
}

export interface ChoiceOption {
	label: string;
	value: string;
}

interface BaseActivity {
	id: string;
	title: string;
	prompt: string;
	required?: boolean;
}

export interface ChoiceActivity extends BaseActivity {
	type: 'choice';
	options: ChoiceOption[];
	answer: string;
	rationale: string;
}

export interface ArrangeActivity extends BaseActivity {
	type: 'arrange';
	tiles: string[];
	answer: string[];
	translation: string;
	rationale: string;
}

export interface ShortAnswerActivity extends BaseActivity {
	type: 'short-answer';
	acceptedAnswers: string[];
	referenceAnswer: string;
	rationale: string;
	placeholder?: string;
}

export interface ProductionActivity extends BaseActivity {
	type: 'production';
	mode: 'speak' | 'write';
	modelAnswer: string;
	modelReading: string;
	checklist: string[];
}

export type CourseActivity =
	| ChoiceActivity
	| ArrangeActivity
	| ShortAnswerActivity
	| ProductionActivity;

export interface CourseLesson {
	id: string;
	sequence: number;
	unitId: string;
	title: string;
	shortTitle: string;
	kind: LessonKind;
	durationMinutes: number;
	canDo: string;
	focus: string[];
	scenario: CourseDialogueLine[];
	notice: string[];
	explanation: string[];
	scriptCharts?: ScriptChart[];
	vocabulary: CourseVocabularyItem[];
	activities: CourseActivity[];
	transferPrompt: string;
	transferSupport: string;
}

export interface CourseUnit {
	id: string;
	sequence: number;
	title: string;
	nativeTitle: string;
	strapline: string;
	canDo: string;
	mission: string;
	lessonIds: string[];
}

export interface LanguageCourse {
	id: string;
	slug: string;
	title: string;
	languageName: string;
	nativeName: string;
	glyph: string;
	language: CourseLanguage;
	htmlLanguage: string;
	studyLanguage: StudyLanguage;
	speechLanguage: SpeechLanguage;
	readingLabel: string;
	level: string;
	description: string;
	designPromise: string;
	units: CourseUnit[];
	lessons: CourseLesson[];
}

export type JapaneseLesson = CourseLesson;
export type JapaneseUnit = CourseUnit;
export type JapaneseCourse = LanguageCourse;

export interface ActivityAttempt {
	status: AnswerStatus;
	updatedAt: string;
}

export interface LessonProgress {
	activities: Record<string, ActivityAttempt>;
	completedAt?: string;
}

export interface CourseProgress {
	version: 1;
	lessons: Record<string, LessonProgress>;
}
