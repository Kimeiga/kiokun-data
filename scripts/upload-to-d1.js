#!/usr/bin/env node

/**
 * Upload dictionary files to Cloudflare D1 database
 * 
 * Usage:
 *   node scripts/upload-to-d1.js
 * 
 * This script:
 * 1. Reads all JSON files from output_dictionary/
 * 2. Batches them into groups of 1000
 * 3. Uploads to D1 using wrangler d1 execute
 * 4. Shows progress and timing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DICTIONARY_DIR = path.join(__dirname, '../output_dictionary');
const DATABASE_NAME = 'kiokun-dictionary';
const BATCH_SIZE = 1000; // D1 can handle large batches

console.log('🚀 Starting dictionary upload to D1...\n');

// Get all JSON files
console.log('📂 Reading dictionary files...');
const files = fs.readdirSync(DICTIONARY_DIR).filter(f => f.endsWith('.json'));
console.log(`   Found ${files.length.toLocaleString()} files\n`);

// Read and prepare data
console.log('📖 Reading file contents...');
const entries = [];
let skipped = 0;

for (let i = 0; i < files.length; i++) {
  const filename = files[i];
  const word = filename.replace('.json', '');
  const filepath = path.join(DICTIONARY_DIR, filename);
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);
    
    entries.push({
      word: word,
      data: JSON.stringify(data)
    });
    
    if ((i + 1) % 10000 === 0) {
      console.log(`   Processed ${(i + 1).toLocaleString()} / ${files.length.toLocaleString()} files`);
    }
  } catch (err) {
    console.error(`   ⚠️  Skipped ${filename}: ${err.message}`);
    skipped++;
  }
}

console.log(`   ✅ Processed ${entries.length.toLocaleString()} entries`);
if (skipped > 0) {
  console.log(`   ⚠️  Skipped ${skipped} files due to errors`);
}
console.log();

// Split into batches
console.log(`📦 Creating batches of ${BATCH_SIZE}...`);
const batches = [];
for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  batches.push(entries.slice(i, i + BATCH_SIZE));
}
console.log(`   Created ${batches.length.toLocaleString()} batches\n`);

// Upload batches
console.log('⬆️  Uploading to D1...');
const startTime = Date.now();
let uploaded = 0;

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  
  // Create SQL INSERT statement
  const values = batch.map(entry => {
    const word = entry.word.replace(/'/g, "''"); // Escape single quotes
    const data = entry.data.replace(/'/g, "''"); // Escape single quotes
    return `('${word}', '${data}')`;
  }).join(',\n    ');
  
  const sql = `INSERT OR REPLACE INTO dictionary_entries (word, data) VALUES\n    ${values};`;
  
  // Write to temp file (SQL might be too large for command line)
  const tempFile = path.join(__dirname, 'temp-batch.sql');
  fs.writeFileSync(tempFile, sql);
  
  try {
    // Execute via wrangler
    execSync(`wrangler d1 execute ${DATABASE_NAME} --file=${tempFile} --remote`, {
      stdio: 'pipe'
    });
    
    uploaded += batch.length;
    
    // Progress update
    const percent = ((i + 1) / batches.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (uploaded / (Date.now() - startTime) * 1000).toFixed(0);
    
    console.log(`   [${percent}%] Batch ${i + 1}/${batches.length} - ${uploaded.toLocaleString()} entries uploaded (${rate} entries/sec, ${elapsed}s elapsed)`);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
  } catch (err) {
    console.error(`   ❌ Failed to upload batch ${i + 1}:`, err.message);
    // Continue with next batch
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
const avgRate = (uploaded / (Date.now() - startTime) * 1000).toFixed(0);

console.log();
console.log('✅ Upload complete!');
console.log(`   Total entries: ${uploaded.toLocaleString()}`);
console.log(`   Total time: ${totalTime}s`);
console.log(`   Average rate: ${avgRate} entries/sec`);
console.log();
console.log('🎉 Dictionary is now live in D1!');

