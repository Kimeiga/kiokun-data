#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../../output_dictionary');
const DATA_DIR = path.join(__dirname, '../data');

interface ChineseCharGloss {
	gloss?: string;
}

async function extractGlosses() {
	console.log('📚 Extracting character glosses...');
	
	const glossMap: Record<string, string> = {};
	
	// Read all JSON files from output_dictionary
	const files = fs.readdirSync(OUTPUT_DIR);
	let processed = 0;
	
	for (const file of files) {
		if (!file.endsWith('.json')) continue;
		
		const filePath = path.join(OUTPUT_DIR, file);
		const content = fs.readFileSync(filePath, 'utf-8');
		
		try {
			const data = JSON.parse(content);
			
			// Extract character and gloss
			if (data.chinese_char && data.chinese_char.gloss) {
				const char = data.key || file.replace('.json', '');
				glossMap[char] = data.chinese_char.gloss;
			}
		} catch (e) {
			// Skip invalid JSON
		}
		
		processed++;
		if (processed % 1000 === 0) {
			console.log(`  Processed ${processed} files...`);
		}
	}
	
	console.log(`✅ Extracted ${Object.keys(glossMap).length} character glosses`);
	
	// Save to data directory
	const outputPath = path.join(DATA_DIR, 'character_glosses.json');
	fs.writeFileSync(outputPath, JSON.stringify(glossMap, null, 2));
	
	console.log(`💾 Saved to ${outputPath}`);
}

extractGlosses().catch(console.error);

