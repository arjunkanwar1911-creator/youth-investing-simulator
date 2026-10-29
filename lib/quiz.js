// The quiz that runs before mission 1 and again after mission 5.
//
// There is ONE list of questions. The "before" and "after" quizzes are built
// from that same list, so a better score really means "learned something" and
// not "got an easier test". Like portfolio.js, this knows nothing about the page.

export const NOT_SURE = -1; // a learner can say "not sure"; it counts as wrong, but it is an answer

export const QUESTIONS = [
  {
    id: 'time',
    text: 'You invest ₹10,000 and leave it for 20 years instead of 5. Why does it grow so much more?',
    options: [
      'The bank adds a bonus in year 20.',
      'The growth from early years also earns growth, which is called compound interest.',
      'Prices always go up when you wait longer.',
    ],
    answer: 1,
  },
  {
    id: 'fund',
    text: 'What do you own when you buy one share of an index fund?',
    options: [
      'One company, picked by an expert.',
      'A loan you have given to the government.',
      'A tiny slice of many companies at once.',
    ],
    answer: 2,
  },
  {
    id: 'forex',
    text: 'A US share costs 100 dollars and its dollar price stays the same. The dollar becomes more expensive in rupees. What happens to what your share is worth in rupees?',
    options: [
      'It is worth more rupees.',
      'It is worth fewer rupees.',
      'Nothing. The rupee value was fixed when you bought it.',
    ],
    answer: 0,
  },
  {
    id: 'concentration',
    text: 'Why is it risky to put most of your money in one company?',
    options: [
      'Single companies pay lower prices.',
      'If that one company has a bad day, most of your money has a bad day too.',
      'The app charges extra for big buys.',
    ],
    answer: 1,
  },
  {
    id: 'spread',
    text: 'Which is better spread out?',
    options: [
      'Five different technology companies.',
      'All of it in the most popular company.',
      'An index fund plus shares from a few different sectors.',
    ],
    answer: 2,
  },
  {
    id: 'panic',
    text: 'A share you own drops 10% in a week and you sell it in a panic. What happens to the loss?',
    options: [
      'It becomes real, and you miss any recovery that comes after.',
      'It disappears, because you stopped owning the share.',
      'The app gives the money back.',
    ],
    answer: 0,
  },
];

/** The quiz for 'before' or 'after'. Same questions both times, on purpose. */
export function quizFor(when) {
  if (when !== 'before' && when !== 'after') throw new Error(`No such quiz: ${when}`);
  return { when, questions: QUESTIONS };
}

/**
 * answers: one entry per question. A number is the chosen option, NOT_SURE (-1)
 * means "not sure", and null or undefined means nothing was picked.
 * Returns { ok: true, correct, total, percent, wrongIds } or { ok: false, reason }.
 * A quiz with any question left blank is refused, so "I just hit submit" can't
 * pass as a score of 0.
 */
export function scoreQuiz(answers, questions = QUESTIONS) {
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return { ok: false, reason: 'Answer every question first.' };
  }
  const unanswered = answers.filter((a) => a === null || a === undefined).length;
  if (unanswered === answers.length) return { ok: false, reason: 'This quiz is blank. Pick an answer for each question.' };
  if (unanswered > 0) {
    return { ok: false, reason: `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still blank. Pick "Not sure" if you don't know.` };
  }
  const valid = answers.every((a, i) => Number.isInteger(a) && a >= NOT_SURE && a < questions[i].options.length);
  if (!valid) return { ok: false, reason: 'One of those answers is not one of the choices.' };

  const wrongIds = questions.filter((q, i) => answers[i] !== q.answer).map((q) => q.id);
  const correct = questions.length - wrongIds.length;
  return { ok: true, correct, total: questions.length, percent: Math.round((correct / questions.length) * 100), wrongIds };
}

/**
 * Before vs after, in plain words. Honest when there is no improvement: the same
 * or a lower score is said as it is.
 */
export function compareScores(before, after) {
  const change = after.correct - before.correct;
  const verdict = change > 0 ? 'better' : change < 0 ? 'lower' : 'same';
  const text = verdict === 'better'
    ? `You went from ${before.correct} to ${after.correct} out of ${after.total}. That is ${change} more right.`
    : verdict === 'same'
      ? `You got ${after.correct} out of ${after.total} both times.`
      : `You got ${after.correct} this time, down from ${before.correct}. Replay the missions and try again.`;
  return { change, verdict, text };
}
