#!/usr/bin/env node

/**
 * Verification script to ensure all tags from japanese_types.rs are covered in japanese_labels.json
 * 
 * Run with: node verify_labels_coverage.js
 */

const fs = require('fs');
const path = require('path');

// Load the labels JSON
const labelsPath = path.join(__dirname, 'japanese_labels.json');
const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));

// Expected counts from japanese_types.rs
const expectedCounts = {
    partOfSpeech: 86,  // Lines 409-574
    misc: 58,          // Lines 350-405 (excluding 'obsc' and 'aphorism' which aren't in the enum)
    field: 96,         // Lines 143-244
    dialect: 12,       // Lines 100-113
    tag: 9,            // Lines 56-72 (Ateji, Gikun, IK, Ik, Io, OK, Ok, RK, Rk, SK, Sk - but SK/Sk not in labels)
    glossType: 4,      // Lines 258-263
    languageSource: 66 // Lines 276-346
};

console.log('🔍 Verifying Japanese Labels Coverage\n');
console.log('=' .repeat(60));

let allPassed = true;

// Check each category
for (const [category, expectedCount] of Object.entries(expectedCounts)) {
    const actualCount = Object.keys(labels[category] || {}).length;
    const status = actualCount >= expectedCount ? '✅' : '❌';
    
    if (actualCount < expectedCount) {
        allPassed = false;
    }
    
    console.log(`${status} ${category.padEnd(20)} Expected: ${expectedCount.toString().padStart(3)}, Got: ${actualCount.toString().padStart(3)}`);
}

console.log('=' .repeat(60));

// Calculate totals
const totalExpected = Object.values(expectedCounts).reduce((a, b) => a + b, 0);
const totalActual = Object.values(labels).reduce((acc, cat) => acc + Object.keys(cat).length, 0);

console.log(`\nTotal tags mapped: ${totalActual} / ${totalExpected}`);

if (allPassed) {
    console.log('\n✅ All categories have sufficient coverage!');
} else {
    console.log('\n❌ Some categories are missing tags. Please review.');
}

// Show sample mappings
console.log('\n📋 Sample Mappings:\n');
console.log('Part of Speech:');
console.log(`  n → "${labels.partOfSpeech.n}"`);
console.log(`  v5r → "${labels.partOfSpeech['v5r']}"`);
console.log(`  adj-i → "${labels.partOfSpeech['adj-i']}"`);

console.log('\nMisc:');
console.log(`  uk → "${labels.misc.uk}"`);
console.log(`  hon → "${labels.misc.hon}"`);
console.log(`  arch → "${labels.misc.arch}"`);

console.log('\nField:');
console.log(`  comp → "${labels.field.comp}"`);
console.log(`  med → "${labels.field.med}"`);
console.log(`  Buddh → "${labels.field.Buddh}"`);

console.log('\nDialect:');
console.log(`  ksb → "${labels.dialect.ksb}"`);
console.log(`  osb → "${labels.dialect.osb}"`);

console.log('\nTag:');
console.log(`  ateji → "${labels.tag.ateji}"`);
console.log(`  uk → "${labels.tag.uk || 'N/A (uk is in misc, not tag)'}"`);

console.log('\nGloss Type:');
console.log(`  literal → "${labels.glossType.literal}"`);
console.log(`  figurative → "${labels.glossType.figurative}"`);

console.log('\nLanguage Source:');
console.log(`  eng → "${labels.languageSource.eng}"`);
console.log(`  chi → "${labels.languageSource.chi}"`);
console.log(`  fre → "${labels.languageSource.fre}"`);

console.log('\n✨ Verification complete!\n');

