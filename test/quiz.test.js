import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, NOT_SURE, quizFor, scoreQuiz, compareScores } from '../lib/quiz.js';

const allRight = () => QUESTIONS.map((q) => q.answer);
// A wrong answer for every question: the next option along, wrapping round.
const allWrong = () => QUESTIONS.map((q) => (q.answer + 1) % q.options.length);

test('all right: full marks and nothing to review', () => {
  const r = scoreQuiz(allRight());
  assert.equal(r.ok, true);
  assert.equal(r.correct, QUESTIONS.length);
  assert.equal(r.total, QUESTIONS.length);
  assert.equal(r.percent, 100);
  assert.deepEqual(r.wrongIds, []);
});

test('all wrong: zero, and every question is listed to review', () => {
  const r = scoreQuiz(allWrong());
  assert.equal(r.ok, true);
  assert.equal(r.correct, 0);
  assert.equal(r.percent, 0);
  assert.deepEqual(r.wrongIds, QUESTIONS.map((q) => q.id));
});

test('mixed: questions 1, 3 and 5 right, the other three wrong', () => {
  const answers = allWrong();
  for (const i of [0, 2, 4]) answers[i] = QUESTIONS[i].answer;
  const r = scoreQuiz(answers);
  assert.equal(r.correct, 3);
  assert.equal(r.total, 6);
  assert.equal(r.percent, 50);
  assert.deepEqual(r.wrongIds, [QUESTIONS[1].id, QUESTIONS[3].id, QUESTIONS[5].id]);
});

test('"Not sure" is an answer that counts as wrong, not a blank', () => {
  const r = scoreQuiz(QUESTIONS.map(() => NOT_SURE));
  assert.equal(r.ok, true);
  assert.equal(r.correct, 0);
});

test('a blank quiz is refused, not scored as zero', () => {
  for (const blank of [QUESTIONS.map(() => null), QUESTIONS.map(() => undefined)]) {
    const r = scoreQuiz(blank);
    assert.equal(r.ok, false);
    assert.match(r.reason, /blank/);
    assert.equal(r.correct, undefined);
  }
});

test('a quiz with even one question left blank is refused', () => {
  const answers = allRight();
  answers[3] = null;
  const r = scoreQuiz(answers);
  assert.equal(r.ok, false);
  assert.match(r.reason, /1 question is still blank/);
});

test('nothing handed in, too few answers, or an answer that is not a choice is refused', () => {
  assert.equal(scoreQuiz([]).ok, false);
  assert.equal(scoreQuiz(undefined).ok, false);
  assert.equal(scoreQuiz(allRight().slice(1)).ok, false);
  const wild = allRight();
  wild[0] = 7;
  assert.equal(scoreQuiz(wild).ok, false);
  wild[0] = 1.5;
  assert.equal(scoreQuiz(wild).ok, false);
});

test('the before and after quizzes have identical questions', () => {
  const before = quizFor('before');
  const after = quizFor('after');
  assert.deepEqual(before.questions, after.questions);
  assert.equal(before.questions.length, QUESTIONS.length);
  assert.notEqual(before.when, after.when);
  assert.throws(() => quizFor('during'), /No such quiz/);
});

test('the same answers score the same before and after', () => {
  const answers = allWrong();
  answers[0] = QUESTIONS[0].answer;
  assert.deepEqual(scoreQuiz(answers, quizFor('before').questions), scoreQuiz(answers, quizFor('after').questions));
});

test('every question is well formed: unique id, 3 choices, a real right answer', () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  for (const q of QUESTIONS) {
    assert.ok(q.text.length > 10, q.id);
    assert.equal(q.options.length, 3, q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
  }
});

test('before vs after says it as it is: better, the same, or lower', () => {
  const s = (correct) => ({ correct, total: 6 });
  assert.deepEqual(compareScores(s(2), s(5)), { change: 3, verdict: 'better', text: 'You went from 2 to 5 out of 6. That is 3 more right.' });
  assert.equal(compareScores(s(4), s(4)).verdict, 'same');
  assert.equal(compareScores(s(4), s(4)).change, 0);
  const lower = compareScores(s(5), s(3));
  assert.equal(lower.verdict, 'lower');
  assert.equal(lower.change, -2);
  assert.match(lower.text, /down from 5/);
});
