import type {
	IdsForwardLookup,
	CharacterWords,
	CharacterGlosses,
	Question,
	QuestionType
} from './types';

export function getGloss(char: string, glosses: CharacterGlosses): string {
	return glosses[char] || char;
}

export function needsOrdering(type: QuestionType): boolean {
	return type === 'char-to-component-glosses' || type === 'char-gloss-to-component-chars';
}

export function generateQuestion(
	idsForward: IdsForwardLookup,
	characterWords: CharacterWords,
	characterGlosses: CharacterGlosses
): Question {
	const questionTypes: QuestionType[] = [
		'char-to-component-glosses',
		'char-gloss-to-component-chars',
		'component-chars-to-char-gloss',
		'component-glosses-to-char',
		'character-to-real-word'
	];
	const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];

	const characters = Object.keys(idsForward).filter((char) => {
		const entry = idsForward[char];
		if (!entry || !entry.components || entry.components.length < 2) return false;
		return entry.components.every((comp) => characterGlosses[comp]) && characterGlosses[char];
	});

	if (characters.length === 0) {
		throw new Error('No suitable characters found');
	}

	const char = characters[Math.floor(Math.random() * characters.length)];
	const entry = idsForward[char];

	if (!entry || !entry.components) {
		throw new Error(`Invalid entry for character: ${char}`);
	}

	let options: string[] = [];
	let correctAnswer: number | number[];

	if (type === 'char-to-component-glosses') {
		// Need to select components in order
		const componentGlosses = entry.components.map((comp) => getGloss(comp, characterGlosses));
		const allGlosses = new Set<string>();

		// Add correct glosses
		componentGlosses.forEach((g) => allGlosses.add(g));

		// Add wrong glosses from other characters
		while (allGlosses.size < 6) {
			const randomChar = characters[Math.floor(Math.random() * characters.length)];
			const randomEntry = idsForward[randomChar];
			if (!randomEntry || !randomEntry.components) continue;

			for (const comp of randomEntry.components) {
				const gloss = getGloss(comp, characterGlosses);
				allGlosses.add(gloss);
				if (allGlosses.size >= 6) break;
			}
		}

		options = Array.from(allGlosses).slice(0, 6);
		// Shuffle options
		options.sort(() => Math.random() - 0.5);

		// Find indices of correct answers in order
		correctAnswer = componentGlosses.map((g) => options.indexOf(g));
	} else if (type === 'char-gloss-to-component-chars') {
		// Need to select component characters in order
		const allChars = new Set<string>();

		// Add correct components
		entry.components.forEach((c) => allChars.add(c));

		// Add wrong components from other characters
		while (allChars.size < 6) {
			const randomChar = characters[Math.floor(Math.random() * characters.length)];
			const randomEntry = idsForward[randomChar];
			if (!randomEntry || !randomEntry.components) continue;

			for (const comp of randomEntry.components) {
				allChars.add(comp);
				if (allChars.size >= 6) break;
			}
		}

		options = Array.from(allChars).slice(0, 6);
		// Shuffle options
		options.sort(() => Math.random() - 0.5);

		// Find indices of correct answers in order
		correctAnswer = entry.components.map((c) => options.indexOf(c));
	} else if (type === 'component-chars-to-char-gloss') {
		const correctGloss = getGloss(char, characterGlosses);
		const wrongGlosses: string[] = [];
		const allGlossedChars = Object.keys(characterGlosses);
		while (wrongGlosses.length < 5) {
			const randomChar = allGlossedChars[Math.floor(Math.random() * allGlossedChars.length)];
			const gloss = getGloss(randomChar, characterGlosses);
			if (gloss !== correctGloss && !wrongGlosses.includes(gloss)) {
				wrongGlosses.push(gloss);
			}
		}
		const correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongGlosses];
		options.splice(correctAnswerIndex, 0, correctGloss);
		correctAnswer = correctAnswerIndex;
	} else if (type === 'component-glosses-to-char') {
		const wrongChars: string[] = [];
		while (wrongChars.length < 5) {
			const randomChar = characters[Math.floor(Math.random() * characters.length)];
			if (randomChar !== char && !wrongChars.includes(randomChar)) {
				wrongChars.push(randomChar);
			}
		}
		const correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongChars];
		options.splice(correctAnswerIndex, 0, char);
		correctAnswer = correctAnswerIndex;
	} else {
		// character-to-real-word
		const charactersInWords = Object.keys(characterWords).filter(
			(c) => characterWords[c].length >= 6
		);
		const wordChar = charactersInWords[Math.floor(Math.random() * charactersInWords.length)];
		const words = characterWords[wordChar];
		const correctWord = words[Math.floor(Math.random() * words.length)];
		const wrongWords: string[] = [];
		const shuffledWords = [...words].sort(() => Math.random() - 0.5);
		for (const word of shuffledWords) {
			if (word !== correctWord && !wrongWords.includes(word)) {
				wrongWords.push(word);
				if (wrongWords.length === 5) break;
			}
		}
		const correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongWords];
		options.splice(correctAnswerIndex, 0, correctWord);
		return {
			type,
			character: wordChar,
			correctAnswer: correctAnswerIndex,
			options
		};
	}

	return {
		type,
		character: char,
		components: entry.components,
		correctAnswer,
		options
	};
}

export function checkAnswer(
	question: Question,
	userAnswer: number | number[]
): boolean {
	if (Array.isArray(question.correctAnswer)) {
		if (!Array.isArray(userAnswer)) return false;
		if (userAnswer.length !== question.correctAnswer.length) return false;
		return userAnswer.every((ans, i) => ans === question.correctAnswer[i]);
	} else {
		if (Array.isArray(userAnswer)) return false;
		return userAnswer === question.correctAnswer;
	}
}

