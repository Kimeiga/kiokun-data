import assert from 'node:assert/strict';
import { chooseNextTutorExercise, normalizeTutorAnswer, tutorExercises } from './exercises';
import type { TutorLearnerProfile } from './types';

const profile: TutorLearnerProfile = {
	level: 3,
	observedLevel: 'Intermediate',
	strengths: [],
	focus: [],
	completedExerciseIds: [],
	attempts: 0,
	correct: 0
};

assert.equal(
	normalizeTutorAnswer('  EVEN THOUGH it happened!  '),
	normalizeTutorAnswer('even though it happened.')
);
assert.equal(normalizeTutorAnswer('既然你已经决定了。'), normalizeTutorAnswer('既然你已经决定了'));

const first = chooseNextTutorExercise(profile, null);
assert.equal(first.direction, 'to_english', 'new sessions should favor comprehension');

const next = chooseNextTutorExercise(
	{ ...profile, completedExerciseIds: [first.id] },
	first.id
);
assert.notEqual(next.id, first.id, 'the next exercise should not immediately repeat');
assert.equal(next.direction, 'to_english', 'unseen comprehension should remain the default');

assert.ok(tutorExercises.length >= 8, 'the tutor should ship with a balanced seed set');
for (const exercise of tutorExercises) {
	assert.ok(exercise.certifiedAnswers.length >= 2, `${exercise.id} needs multiple certified answers`);
	assert.ok(exercise.dictionaryTerms.length > 0, `${exercise.id} needs dictionary evidence`);
	assert.ok(exercise.promptTokens.map((token) => token.text).join('').length > 0, `${exercise.id} needs prompt tokens`);
}

console.log(`Tutor exercise tests passed (${tutorExercises.length} exercises).`);
