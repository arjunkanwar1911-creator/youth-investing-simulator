'use client';
// This part runs in the browser. It is the page's old <script>, started once the boxes are on screen.
import { useEffect } from 'react';

export default function PageClient({ html }) {
  useEffect(() => {
    (async () => {
      
      const { QUESTIONS, quizFor, compareScores } = await import('../../lib/quiz.js');
      const {
        MISSIONS, browserStorage, loadProgress, saveProgress, submitQuiz, resumeTutorial,
        restart, earnedBadge, dots, syncWallet,
      } = await import('../../lib/tutorial.js');
      
      const $ = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const storage = browserStorage();
      let progress = loadProgress(storage);
      
      /** Save a new progress, and keep the practice wallet in step with it. */
      function change(next) {
        syncWallet(storage, progress, next);
        progress = next;
        saveProgress(storage, progress);
      }
      
      // ---- the quiz (the same one before and after) ----
      function drawQuiz(when) {
        const { questions } = quizFor(when);
        $('quiz-step').textContent = when === 'before' ? 'Starter quiz' : 'Final quiz';
        $('quiz-lead').textContent = when === 'before'
          ? `${questions.length} quick questions before you start. It's fine to say "Not sure". The point is to see where you begin.`
          : 'The same questions again. Let\'s see what changed.';
        $('quiz-submit').textContent = when === 'before' ? 'Start mission 1' : 'See my result';
        $('qs').innerHTML = questions.map((q, i) => `
          <li><fieldset><legend>${esc(q.text)}</legend>
            ${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"> <span>${esc(o)}</span></label>`).join('')}
            <label class="opt unsure"><input type="radio" name="q${i}" value="-1"> <span>Not sure</span></label>
          </fieldset></li>`).join('');
        $('quiz-msg').hidden = true;
      }
      
      $('quiz').addEventListener('submit', (e) => {
        e.preventDefault();
        const answers = QUESTIONS.map((_, i) => {
          const picked = document.querySelector(`input[name="q${i}"]:checked`);
          return picked ? Number(picked.value) : null;
        });
        const result = submitQuiz(progress, answers);
        if (!result.ok) {
          $('quiz-msg').textContent = result.reason;
          $('quiz-msg').hidden = false;
          return;
        }
        const startingMissions = progress.phase === 'before';
        change(result.progress);
        if (startingMissions) location.href = MISSIONS[0].page;
        else draw();
      });
      
      // ---- the missions list ----
      const STATUS = { done: 'Done', skipped: 'Skipped', now: 'Up next', todo: '' };
      
      function drawMissions() {
        const states = dots(progress);
        $('missions').innerHTML = MISSIONS.map((m, i) => `
          <li class="${states[i]}"><span class="dot"></span>
            <span><b>${i + 1}. ${esc(m.title)}</b><span class="goal">${esc(m.goal)}</span></span>
            <span class="tag">${STATUS[states[i]]}</span></li>`).join('');
      
        const inMissions = progress.phase === 'missions';
        $('missions-note').textContent = inMissions
          ? 'Each mission dims the screen and lights up one control. Do the step and a short card explains what happened.'
          : 'Finished. Here is how each mission went.';
        $('missions-actions').innerHTML = inMissions
          ? `<button type="button" class="buy" id="go">${progress.step === 0 && !progress.showCard && progress.results[0] === null ? 'Start' : 'Continue'} mission ${progress.step + 1}</button>
             <button type="button" class="ghost danger" id="start-over">Start over</button>`
          : '';
        if (inMissions) {
          $('go').addEventListener('click', () => {
            change(resumeTutorial(progress));
            location.href = MISSIONS[progress.step].page;
          });
          $('start-over').addEventListener('click', () => { change(restart()); draw(); });
        }
      }
      
      // ---- before vs after ----
      function drawResults() {
        const { before, after } = progress;
        $('scores').innerHTML = `
          <div class="score-card"><div class="lab">Before</div><div class="num">${before.correct}<small> / ${before.total}</small></div></div>
          <div class="score-card after"><div class="lab">After</div><div class="num">${after.correct}<small> / ${after.total}</small></div></div>`;
        $('verdict').textContent = compareScores(before, after).text;
        $('badge').innerHTML = earnedBadge(progress)
          ? '<div class="badge"><span class="star" aria-hidden="true">&#9733;</span><span><b>Money Mover badge</b>You finished all 5 missions.</span></div>'
          : '<div class="badge locked"><span class="star" aria-hidden="true">&#9733;</span><span><b>Badge not earned yet</b>Do all 5 missions without skipping to earn it.</span></div>';
      }
      
      $('replay').addEventListener('click', () => { change(restart()); draw(); });
      
      // ---- show the part that matches where the learner is ----
      function draw() {
        const { phase } = progress;
        $('quiz-box').hidden = !(phase === 'before' || phase === 'after');
        $('missions-box').hidden = phase === 'before';
        $('results-box').hidden = phase !== 'done';
        if (!$('quiz-box').hidden) drawQuiz(phase);
        if (!$('missions-box').hidden) drawMissions();
        if (phase === 'done') drawResults();
      }
      
      draw();
    })();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
