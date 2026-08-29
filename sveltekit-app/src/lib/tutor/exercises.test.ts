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

const firstCandidate = chooseNextTutorExercise(profile, null, () => 0);
const lastCandidate = chooseNextTutorExercise(profile, null, () => 0.999999);
assert.notEqual(firstCandidate.id, lastCandidate.id, 'the random value should change the first exercise');

const next = chooseNextTutorExercise(
	{ ...profile, completedExerciseIds: [firstCandidate.id] },
	firstCandidate.id,
	() => 0
);
assert.notEqual(next.id, firstCandidate.id, 'the next exercise should not immediately repeat');

const completedIds = tutorExercises.slice(0, -1).map((exercise) => exercise.id);
const onlyUnseen = chooseNextTutorExercise({ ...profile, completedExerciseIds: completedIds }, null, () => 0.5);
assert.equal(onlyUnseen.id, tutorExercises.at(-1)?.id, 'unseen exercises should be chosen before repeats');

assert.ok(tutorExercises.length >= 8, 'the tutor should ship with a balanced seed set');
for (const exercise of tutorExercises) {
	assert.ok(exercise.certifiedAnswers.length >= 2, `${exercise.id} needs multiple certified answers`);
	assert.ok(exercise.dictionaryTerms.length > 0, `${exercise.id} needs dictionary evidence`);
	assert.ok(exercise.promptTokens.map((token) => token.text).join('').length > 0, `${exercise.id} needs prompt tokens`);
}

console.log(`Tutor exercise tests passed (${tutorExercises.length} exercises).`);
