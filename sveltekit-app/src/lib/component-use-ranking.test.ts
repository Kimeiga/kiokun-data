import assert from 'node:assert/strict';
import {
	cleanCharacterUseGloss,
	sortCharacterUses
} from './component-use-ranking';

const sorted = sortCharacterUses(
	[
		{ character: '㟁', roles: ['meaning'] },
		{ character: '䍐', roles: ['meaning'] },
		{ character: '刊', roles: ['meaning'] },
		{ character: '汗', roles: ['sound'] },
		{ character: '岸', roles: ['meaning'] }
	],
	{
		'㟁': 'shore (archaic)',
		'䍐': 'net',
		'刊': 'publication',
		'汗': 'sweat',
		'岸': 'shore'
	},
	['meaning', 'sound']
);

assert.deepEqual(sorted.slice(0, 3).map((use) => use.character), ['岸', '刊', '汗']);
assert.equal(cleanCharacterUseGloss('Tray A Tray'), 'Tray');

console.log('component-use ranking tests passed');
