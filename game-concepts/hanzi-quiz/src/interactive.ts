#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import type {
	IdsForwardLookup,
	CharacterWords,
	WordIndex,
	CharacterGlosses,
	QuestionState
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

// Load data
let idsForward: IdsForwardLookup;
let characterWords: CharacterWords;
let wordIndex: WordIndex;
let characterGlosses: CharacterGlosses;

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	cyan: '\x1b[36m',
	dim: '\x1b[2m',
};

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

// Import question generators from quiz.ts
// For now, we'll duplicate the logic here
function generateQuestion(): QuestionState {
	const questionTypes = [
		'char-to-component-glosses',
		'char-gloss-to-component-chars',
		'component-chars-to-char-gloss',
		'component-glosses-to-char',
		'character-to-real-word'
	] as const;
	const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];

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

	let options: string[] = [];
	let correctAnswerIndex = 0;

	if (type === 'char-to-component-glosses') {
		const correctComponentGlosses = entry.components.map(comp => getGloss(comp)).join(' + ');
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
		correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongOptions];
		options.splice(correctAnswerIndex, 0, correctComponentGlosses);
	} else if (type === 'char-gloss-to-component-chars') {
		const correctComponentChars = entry.components.join(' + ');
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
		correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongOptions];
		options.splice(correctAnswerIndex, 0, correctComponentChars);
	} else if (type === 'component-chars-to-char-gloss') {
		const correctGloss = getGloss(char);
		const wrongGlosses: string[] = [];
		const allGlossedChars = Object.keys(characterGlosses);
		while (wrongGlosses.length < 5) {
			const randomChar = allGlossedChars[Math.floor(Math.random() * allGlossedChars.length)];
			const gloss = getGloss(randomChar);
			if (gloss !== correctGloss && !wrongGlosses.includes(gloss)) {
				wrongGlosses.push(gloss);
			}
		}
		correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongGlosses];
		options.splice(correctAnswerIndex, 0, correctGloss);
	} else if (type === 'component-glosses-to-char') {
		const wrongChars: string[] = [];
		while (wrongChars.length < 5) {
			const randomChar = characters[Math.floor(Math.random() * characters.length)];
			if (randomChar !== char && !wrongChars.includes(randomChar)) {
				wrongChars.push(randomChar);
			}
		}
		correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongChars];
		options.splice(correctAnswerIndex, 0, char);
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
		correctAnswerIndex = Math.floor(Math.random() * 6);
		options = [...wrongWords];
		options.splice(correctAnswerIndex, 0, correctWord);
		return {
			type,
			character: wordChar,
			correctAnswer: correctAnswerIndex,
			options,
			timestamp: Date.now()
		};
	}

	return {
		type,
		character: char,
		components: entry.components,
		correctAnswer: correctAnswerIndex,
		options,
		timestamp: Date.now()
	};
}

function displayQuestion(question: QuestionState) {
	console.clear();
	console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
	
	if (question.type === 'char-to-component-glosses') {
		console.log(`${colors.yellow}❓ Character → Component Glosses${colors.reset}\n`);
		console.log(`Given this character: ${colors.cyan}${question.character}${colors.reset}\n`);
		console.log(`Which component glosses (in order) make up this character?\n`);
	} else if (question.type === 'char-gloss-to-component-chars') {
		console.log(`${colors.yellow}❓ Character Gloss → Component Characters${colors.reset}\n`);
		console.log(`Given this character gloss: ${colors.cyan}"${getGloss(question.character!)}"`);
		console.log(`\nWhich component characters (in order) make up this character?\n`);
	} else if (question.type === 'component-chars-to-char-gloss') {
		console.log(`${colors.yellow}❓ Component Characters → Character Gloss${colors.reset}\n`);
		console.log(`Given these component characters: ${colors.cyan}${question.components!.join(' + ')}${colors.reset}\n`);
		console.log(`What is the gloss of the character they form?\n`);
	} else if (question.type === 'component-glosses-to-char') {
		console.log(`${colors.yellow}❓ Component Glosses → Character${colors.reset}\n`);
		const glosses = question.components!.map(c => getGloss(c)).join(' + ');
		console.log(`Given these component glosses: ${colors.cyan}${glosses}${colors.reset}\n`);
		console.log(`Which character do they form?\n`);
	} else {
		console.log(`${colors.yellow}❓ Character → Real Word${colors.reset}\n`);
		console.log(`Given this character: ${colors.cyan}${question.character}${colors.reset}`);
		console.log(`${colors.dim}(Gloss: ${getGloss(question.character!)})`);
		console.log(`\nWhich word is real? (All options contain ${question.character})\n`);
	}

	question.options.forEach((opt, i) => {
		console.log(`  ${i + 1}. ${opt}`);
	});

	console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

function showFeedback(question: QuestionState, userAnswer: number) {
	const correct = userAnswer === question.correctAnswer;
	
	if (correct) {
		console.log(`\n${colors.green}✓ Correct!${colors.reset}`);
	} else {
		console.log(`\n${colors.red}✗ Wrong!${colors.reset}`);
		console.log(`${colors.dim}Correct answer: ${question.correctAnswer + 1}. ${question.options[question.correctAnswer]}${colors.reset}`);
	}

	// Show explanation
	if (question.character && question.components) {
		console.log(`${colors.dim}Character: ${question.character} (${getGloss(question.character)})`);
		console.log(`Components: ${question.components.join(' + ')}`);
		console.log(`Component glosses: ${question.components.map(c => getGloss(c)).join(' + ')}${colors.reset}`);
	} else if (question.type === 'character-to-real-word' && question.character) {
		console.log(`${colors.dim}The word is: ${question.options[question.correctAnswer]}${colors.reset}`);
	}
}

async function main() {
	loadData();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	let currentQuestion = generateQuestion();
	displayQuestion(currentQuestion);

	rl.on('line', (input) => {
		const answer = parseInt(input.trim());
		
		if (isNaN(answer) || answer < 1 || answer > 6) {
			console.log(`${colors.red}Please enter a number between 1 and 6${colors.reset}`);
			return;
		}

		showFeedback(currentQuestion, answer - 1);
		
		// Generate next question after a brief pause
		setTimeout(() => {
			currentQuestion = generateQuestion();
			displayQuestion(currentQuestion);
		}, 2000);
	});

	rl.on('close', () => {
		console.log('\nGoodbye!');
		process.exit(0);
	});
}

main();

