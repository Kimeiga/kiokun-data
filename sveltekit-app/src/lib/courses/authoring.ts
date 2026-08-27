import type {
	ArrangeActivity,
	ChoiceActivity,
	CourseDialogueLine,
	CourseLesson,
	CourseVocabularyItem,
	LessonKind,
	ProductionActivity,
	ScriptChart
} from './types';

export type DialogueInput = [speaker: string, text: string, reading: string, translation: string];
export type VocabularyInput = [
	word: string,
	reading: string,
	meaning: string,
	note?: string,
	dictionaryAnchor?: string
];

export interface ChoiceInput {
	prompt: string;
	options: Array<[value: string, label: string]>;
	answer: string;
	rationale: string;
}

interface ArrangeInput {
	prompt: string;
	tiles: string[];
	answer: string[];
	translation: string;
	rationale: string;
}

interface ProductionInput {
	mode: 'speak' | 'write';
	prompt: string;
	modelAnswer: string;
	modelReading: string;
	checklist: string[];
}

export interface LessonInput {
	id: string;
	unitId: string;
	title: string;
	shortTitle: string;
	kind?: LessonKind;
	durationMinutes?: number;
	canDo: string;
	focus: string[];
	scenario: DialogueInput[];
	notice: string[];
	explanation: string[];
	scriptCharts?: ScriptChart[];
	vocabulary: VocabularyInput[];
	choice: ChoiceInput;
	reviewChoices?: ChoiceInput[];
	arrange: ArrangeInput;
	production: ProductionInput;
	transferPrompt: string;
	transferSupport: string;
}

function dialogue(input: DialogueInput): CourseDialogueLine {
	return {
		speaker: input[0],
		text: input[1],
		reading: input[2],
		translation: input[3]
	};
}

function vocabulary(input: VocabularyInput): CourseVocabularyItem {
	return {
		word: input[0],
		reading: input[1],
		meaning: input[2],
		note: input[3],
		dictionaryAnchor: input[4]
	};
}

function choice(id: string, input: ChoiceInput, index = 0): ChoiceActivity {
	return {
		id: index === 0 ? `${id}-check` : `${id}-check-${index + 1}`,
		type: 'choice',
		title: 'Meaning check',
		prompt: input.prompt,
		options: input.options.map(([value, label]) => ({ value, label })),
		answer: input.answer,
		rationale: input.rationale
	};
}

function arrange(id: string, input: ArrangeInput): ArrangeActivity {
	return {
		id: `${id}-build`,
		type: 'arrange',
		title: 'Sentence construction',
		prompt: input.prompt,
		tiles: input.tiles,
		answer: input.answer,
		translation: input.translation,
		rationale: input.rationale
	};
}

function production(id: string, input: ProductionInput): ProductionActivity {
	return {
		id: `${id}-produce`,
		type: 'production',
		title: input.mode === 'speak' ? 'Speaking response' : 'Writing response',
		prompt: input.prompt,
		mode: input.mode,
		modelAnswer: input.modelAnswer,
		modelReading: input.modelReading,
		checklist: input.checklist
	};
}

export function lesson(input: LessonInput): CourseLesson {
	return {
		id: input.id,
		sequence: 0,
		unitId: input.unitId,
		title: input.title,
		shortTitle: input.shortTitle,
		kind: input.kind ?? 'core',
		durationMinutes: input.durationMinutes ?? 14,
		canDo: input.canDo,
		focus: input.focus,
		scenario: input.scenario.map(dialogue),
		notice: input.notice,
		explanation: input.explanation,
		scriptCharts: input.scriptCharts,
		vocabulary: input.vocabulary.map(vocabulary),
		activities: [
			choice(input.id, input.choice),
			...(input.reviewChoices ?? []).map((reviewChoice, index) =>
				choice(input.id, reviewChoice, index + 1)
			),
			arrange(input.id, input.arrange),
			production(input.id, input.production)
		],
		transferPrompt: input.transferPrompt,
		transferSupport: input.transferSupport
	};
}
