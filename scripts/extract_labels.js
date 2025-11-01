#!/usr/bin/env node

/**
 * Extract label mappings from 10ten-ja-reader messages.json
 * and create a simplified JSON file for our use
 */

const fs = require('fs');
const path = require('path');

const messagesPath = path.join(__dirname, '../10ten-ja-reader/_locales/en/messages.json');
const outputPath = path.join(__dirname, '../sveltekit-app/src/lib/japanese-labels.json');

// Read the messages.json file
const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

// Extract labels by category
const labels = {
  pos: {},        // Part of speech
  misc: {},       // Miscellaneous
  field: {},      // Field of application
  dial: {},       // Dialect
  head_info: {}   // Headword info (like io, iK, oK, etc.)
};

// Process each message
for (const [key, value] of Object.entries(messages)) {
  if (key.startsWith('pos_label_')) {
    const tag = key.replace('pos_label_', '');
    labels.pos[tag] = value.message;
  } else if (key.startsWith('misc_label_')) {
    const tag = key.replace('misc_label_', '');
    labels.misc[tag] = value.message;
  } else if (key.startsWith('field_label_')) {
    const tag = key.replace('field_label_', '');
    labels.field[tag] = value.message;
  } else if (key.startsWith('dial_label_')) {
    const tag = key.replace('dial_label_', '');
    labels.dial[tag] = value.message;
  } else if (key.startsWith('head_info_label_')) {
    const tag = key.replace('head_info_label_', '');
    labels.head_info[tag] = value.message;
  }
}

// Create a flat mapping for easy lookup (tag -> label)
const flatLabels = {};

// Add all labels with their category prefix
for (const [category, categoryLabels] of Object.entries(labels)) {
  for (const [tag, label] of Object.entries(categoryLabels)) {
    flatLabels[tag] = label;
  }
}

// Write the output file
const output = {
  labels,
  flatLabels
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`✅ Extracted ${Object.keys(flatLabels).length} labels to ${outputPath}`);
console.log(`   - POS: ${Object.keys(labels.pos).length}`);
console.log(`   - Misc: ${Object.keys(labels.misc).length}`);
console.log(`   - Field: ${Object.keys(labels.field).length}`);
console.log(`   - Dialect: ${Object.keys(labels.dial).length}`);
console.log(`   - Head Info: ${Object.keys(labels.head_info).length}`);

