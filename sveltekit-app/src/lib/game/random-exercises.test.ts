import assert from 'node:assert/strict';
import { chooseUnseenExerciseId } from './random-exercises';

assert.equal(chooseUnseenExerciseId(10, new Set(), () => 0.42), 4);
assert.equal(chooseUnseenExerciseId(10, new Set([4]), () => 0.52), 5);

let calls = 0;
assert.equal(
	chooseUnseenExerciseId(4, new Set([0, 1, 2]), () => {
		calls += 1;
		return 0;
	}),
	3,
	'the bounded fallback must return the remaining unseen id'
);
assert.ok(calls >= 24, 'the fallback should follow random retries');

assert.throws(() => chooseUnseenExerciseId(0, new Set()), RangeError);
assert.throws(() => chooseUnseenExerciseId(2, new Set([0, 1])), RangeError);

console.log('Random exercise selection invariants passed');
