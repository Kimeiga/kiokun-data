#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type {
	IdsForwardLookup,
	CharacterWords,
	WordIndex,
	CharacterGlosses,
	QuestionState
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(process.cwd(), '.quiz-state.json');
const DATA_DIR = path.join(__dirname, '../data');

// Load data
let idsForward: IdsForwardLookup;
let characterWords: CharacterWords;
let wordIndex: WordIndex;
let characterGlosses: CharacterGlosses;

function loadData() {
	console.log('📚 Loading data...');
	idsForward = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ids_forward.json'), 'utf-8'));
	characterWords = JSON.parse(
		fs.readFileSync(path.join(DATA_DIR, 'character_words.json'), 'utf-8')
	);
	wordIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'word_index.json'), 'utf-8'));
	characterGlosses = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'character_glosses.json'), 'utf-8'));
	console.log('✅ Data loaded!\n');
}

function getGloss(char: string): string {
	return characterGlosses[char] || char;
}

// Question 1: Character (kanji) → Component Glosses
// Shows: 禎
// Ask: Which component glosses make up this character?
// Answer: "to show + chaste"
function generateCharToComponentGlossesQuestion(): QuestionState {
	const characters = Object.keys(idsForward).filter((char) => {
		const entry = idsForward[char];
		if (!entry || !entry.components || entry.components.length < 2) return false;
		return entry.components.every(comp => characterGlosses[comp]) && characterGlosses[char];
	});

	if (characters.length === 0) {
		throw new Error('No suitable characters found');
	}

	const char = characters[Math.floor(Math.random() * characters.length)];
	const entry = idsForward[char];

	if (!entry || !entry.components) {
		throw new Error(`Invalid entry for character: ${char}`);
	}

	const correctComponentGlosses = entry.components.map(comp => getGloss(comp)).join(' + ');

	// Generate wrong component gloss combinations
	const wrongOptions: string[] = [];
	while (wrongOptions.length < 5) {
		const randomChar = characters[Math.floor(Math.random() * characters.length)];
		const randomEntry = idsForward[randomChar];
		if (!randomEntry || !randomEntry.components) continue;

		const option = randomEntry.components.map(comp => getGloss(comp)).join(' + ');
		if (randomChar !== char && !wrongOptions.includes(option)) {
			wrongOptions.push(option);
		}
	}

	const correctAnswerIndex = Math.floor(Math.random() * 6);
	const options = [...wrongOptions];
	options.splice(correctAnswerIndex, 0, correctComponentGlosses);

	console.log(`\n❓ Question: Character → Component Glosses`);
	console.log(`\nGiven this character: ${char}`);
	console.log(`\nWhich component glosses (in order) make up this character?\n`);

	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\nAnswer with: npm start -- --answer <number>`);

	return {
		type: 'char-to-component-glosses',
		character: char,
		components: entry.components,
		correctAnswer: correctAnswerIndex,
		options,
		timestamp: Date.now()
	};
}

// Question 2: Character Gloss → Component Characters (kanjis)
// Shows: "auspicious"
// Ask: Which component characters make up this character?
// Answer: "示 + 貞"
function generateCharGlossToComponentCharsQuestion(): QuestionState {
	const characters = Object.keys(idsForward).filter((char) => {
		const entry = idsForward[char];
		if (!entry || !entry.components || entry.components.length < 2) return false;
		return entry.components.every(comp => characterGlosses[comp]) && characterGlosses[char];
	});

	if (characters.length === 0) {
		throw new Error('No suitable characters found');
	}

	const char = characters[Math.floor(Math.random() * characters.length)];
	const entry = idsForward[char];

	if (!entry || !entry.components) {
		throw new Error(`Invalid entry for character: ${char}`);
	}

	const charGloss = getGloss(char);
	const correctComponentChars = entry.components.join(' + ');

	// Generate wrong component character combinations
	const wrongOptions: string[] = [];
	while (wrongOptions.length < 5) {
		const randomChar = characters[Math.floor(Math.random() * characters.length)];
		const randomEntry = idsForward[randomChar];
		if (!randomEntry || !randomEntry.components) continue;

		const option = randomEntry.components.join(' + ');
		if (randomChar !== char && !wrongOptions.includes(option)) {
			wrongOptions.push(option);
		}
	}

	const correctAnswerIndex = Math.floor(Math.random() * 6);
	const options = [...wrongOptions];
	options.splice(correctAnswerIndex, 0, correctComponentChars);

	console.log(`\n❓ Question: Character Gloss → Component Characters`);
	console.log(`\nGiven this character gloss: "${charGloss}"`);
	console.log(`\nWhich component characters (in order) make up this character?\n`);

	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\nAnswer with: npm start -- --answer <number>`);

	return {
		type: 'char-gloss-to-component-chars',
		character: char,
		components: entry.components,
		correctAnswer: correctAnswerIndex,
		options,
		timestamp: Date.now()
	};
}

// Question 3: Component Characters (kanjis) → Character Gloss
// Shows: "示 + 貞"
// Ask: What is the gloss of the character they form?
// Answer: "auspicious"
function generateComponentCharsToCharGlossQuestion(): QuestionState {
	const characters = Object.keys(idsForward).filter((char) => {
		const entry = idsForward[char];
		if (!entry || !entry.components || entry.components.length < 2) return false;
		return entry.components.every(comp => characterGlosses[comp]) && characterGlosses[char];
	});

	if (characters.length === 0) {
		throw new Error('No suitable characters found');
	}

	const char = characters[Math.floor(Math.random() * characters.length)];
	const entry = idsForward[char];

	if (!entry || !entry.components) {
		throw new Error(`Invalid entry for character: ${char}`);
	}

	const correctGloss = getGloss(char);

	// Generate wrong glosses
	const wrongGlosses: string[] = [];
	const allGlossedChars = Object.keys(characterGlosses);
	while (wrongGlosses.length < 5) {
		const randomChar = allGlossedChars[Math.floor(Math.random() * allGlossedChars.length)];
		const gloss = getGloss(randomChar);
		if (gloss !== correctGloss && !wrongGlosses.includes(gloss)) {
			wrongGlosses.push(gloss);
		}
	}

	const correctAnswerIndex = Math.floor(Math.random() * 6);
	const options = [...wrongGlosses];
	options.splice(correctAnswerIndex, 0, correctGloss);

	console.log(`\n❓ Question: Component Characters → Character Gloss`);
	console.log(`\nGiven these component characters in order: ${entry.components.join(' + ')}`);
	console.log(`\nWhat is the gloss of the character they form?\n`);

	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\nAnswer with: npm start -- --answer <number>`);

	return {
		type: 'component-chars-to-char-gloss',
		character: char,
		components: entry.components,
		correctAnswer: correctAnswerIndex,
		options,
		timestamp: Date.now()
	};
}

// Question 4: Component Glosses → Character (kanji)
// Shows: "to show + chaste"
// Ask: Which character do they form?
// Answer: 禎
function generateComponentGlossesToCharQuestion(): QuestionState {
	const characters = Object.keys(idsForward).filter((char) => {
		const entry = idsForward[char];
		if (!entry || !entry.components || entry.components.length < 2) return false;
		return entry.components.every(comp => characterGlosses[comp]) && characterGlosses[char];
	});

	if (characters.length === 0) {
		throw new Error('No suitable characters found');
	}

	const char = characters[Math.floor(Math.random() * characters.length)];
	const entry = idsForward[char];

	if (!entry || !entry.components) {
		throw new Error(`Invalid entry for character: ${char}`);
	}

	const componentGlosses = entry.components.map(comp => getGloss(comp));

	// Generate wrong characters
	const wrongChars: string[] = [];
	while (wrongChars.length < 5) {
		const randomChar = characters[Math.floor(Math.random() * characters.length)];
		if (randomChar !== char && !wrongChars.includes(randomChar)) {
			wrongChars.push(randomChar);
		}
	}

	const correctAnswerIndex = Math.floor(Math.random() * 6);
	const options = [...wrongChars];
	options.splice(correctAnswerIndex, 0, char);

	console.log(`\n❓ Question: Component Glosses → Character`);
	console.log(`\nGiven these component glosses in order: ${componentGlosses.join(' + ')}`);
	console.log(`\nWhich character do they form?\n`);

	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\nAnswer with: npm start -- --answer <number>`);

	return {
		type: 'component-glosses-to-char',
		character: char,
		components: entry.components,
		correctAnswer: correctAnswerIndex,
		options,
		timestamp: Date.now()
	};
}

// Question 3: Character → Real Word (all options contain the same character)
// Shows: 倾
// Ask: Which word is real?
// Options: All contain 倾, but only one is a real word
function generateCharacterToRealWordQuestion(): QuestionState {
	// Pick a random character that appears in words
	const charactersInWords = Object.keys(characterWords).filter(
		(char) => characterWords[char].length >= 6 // Need at least 6 words for this question
	);

	if (charactersInWords.length === 0) {
		throw new Error('No suitable characters found for character-to-real-word question');
	}

	const char = charactersInWords[Math.floor(Math.random() * charactersInWords.length)];
	const words = characterWords[char];

	// Pick a random real word containing this character
	const correctWord = words[Math.floor(Math.random() * words.length)];

	// Generate fake words (also containing this character)
	// We'll pick other real words containing this character as wrong answers
	const wrongWords: string[] = [];
	const shuffledWords = [...words].sort(() => Math.random() - 0.5);

	for (const word of shuffledWords) {
		if (word !== correctWord && !wrongWords.includes(word)) {
			wrongWords.push(word);
			if (wrongWords.length === 5) break;
		}
	}

	// If we don't have enough words, fill with random words containing the character
	while (wrongWords.length < 5) {
		const randomWord = words[Math.floor(Math.random() * words.length)];
		if (randomWord !== correctWord && !wrongWords.includes(randomWord)) {
			wrongWords.push(randomWord);
		}
	}

	const correctAnswer = Math.floor(Math.random() * 6);
	const options = [...wrongWords];
	options.splice(correctAnswer, 0, correctWord);

	console.log(`\n❓ Question: Character → Real Word`);
	console.log(`\nGiven this character: ${char}`);
	const gloss = getGloss(char);
	if (gloss !== char) {
		console.log(`(Gloss: ${gloss})`);
	}
	console.log(`\nWhich word is real? (All options contain ${char})\n`);

	options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\nAnswer with: npm start -- --answer <number>`);

	return {
		type: 'character-to-real-word',
		character: char,
		correctAnswer,
		options,
		timestamp: Date.now()
	};
}

function generateQuestion(): QuestionState {
	const questionTypes = [
		'char-to-component-glosses',
		'char-gloss-to-component-chars',
		'component-chars-to-char-gloss',
		'component-glosses-to-char',
		'character-to-real-word'
	] as const;
	const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];

	switch (type) {
		case 'char-to-component-glosses':
			return generateCharToComponentGlossesQuestion();
		case 'char-gloss-to-component-chars':
			return generateCharGlossToComponentCharsQuestion();
		case 'component-chars-to-char-gloss':
			return generateComponentCharsToCharGlossQuestion();
		case 'component-glosses-to-char':
			return generateComponentGlossesToCharQuestion();
		case 'character-to-real-word':
			return generateCharacterToRealWordQuestion();
	}
}

function saveState(state: QuestionState) {
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState(): QuestionState | null {
	if (!fs.existsSync(STATE_FILE)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function clearState() {
	if (fs.existsSync(STATE_FILE)) {
		fs.unlinkSync(STATE_FILE);
	}
}

function main() {
	const args = process.argv.slice(2);

	loadData();

	// Check if answering a question
	const answerIndex = args.indexOf('--answer');
	if (answerIndex !== -1) {
		const state = loadState();
		if (!state) {
			console.log('❌ No active question. Generate one first!');
			process.exit(1);
		}

		const answer = parseInt(args[answerIndex + 1]) - 1; // Convert to 0-based index

		if (isNaN(answer) || answer < 0 || answer > 5) {
			console.log('❌ Invalid answer. Please provide a number between 1 and 6.');
			process.exit(1);
		}

		console.log(`\n📝 Your answer: ${answer + 1}. ${state.options[answer]}`);
		console.log(`✅ Correct answer: ${state.correctAnswer + 1}. ${state.options[state.correctAnswer]}`);

		if (answer === state.correctAnswer) {
			console.log('\n🎉 Correct!\n');
		} else {
			console.log('\n❌ Wrong!\n');
		}

		// Show explanation
		if (state.character && state.components) {
			console.log(`\nThe character is: ${state.character} (${getGloss(state.character)})`);
			console.log(`Components: ${state.components.join(' + ')}`);
			console.log(`Component glosses: ${state.components.map(c => getGloss(c)).join(' + ')}`);
		} else if (state.type === 'character-to-real-word' && state.character) {
			console.log(`\nThe character ${state.character} (${getGloss(state.character)}) appears in: ${state.options[state.correctAnswer]}`);
		}

		clearState();
		console.log('\nGenerate next question with: npm start\n');
		return;
	}

	// Generate new question
	const question = generateQuestion();
	saveState(question);
}

main();

