/* GB Quest branded startup overlay.
 * The splash stays visible until the browser has finished loading and the
 * game engine has presented its first frame (body.game-rendered).
 */
(() => {
  'use strict';
  const root = document.getElementById('gbq-boot-screen');
  if (!root) return;

  const progress = document.getElementById('gbq-boot-progress');
  const bar = document.getElementById('gbq-boot-bar');
  const percent = document.getElementById('gbq-boot-percent');
  const status = document.getElementById('gbq-boot-status');
  const retry = document.getElementById('gbq-boot-retry');
  const startedAt = performance.now();
  let value = 8;
  let pageLoaded = document.readyState === 'complete';
  let firstFrame = document.body.classList.contains('game-rendered');
  let finished = false;

  const phases = [
    [20, 'Preparing the world of Aelmoor…'],
    [38, 'Loading heroes and ancient bloodlines…'],
    [56, 'Awakening the realm systems…'],
    [72, 'Preparing dungeons and forgotten kingdoms…'],
    [86, 'Waiting for the first frame…'],
    [94, 'Finalizing the adventure…']
  ];

  function setProgress(next, message) {
    value = Math.max(value, Math.min(100, Math.round(next)));
    progress.style.width = value + '%';
    percent.textContent = value + '%';
    bar.setAttribute('aria-valuenow', String(value));
    if (message) status.textContent = message;
  }

  const progressTimer = window.setInterval(() => {
    if (finished) return;
    const nextPhase = phases.find(([threshold]) => value < threshold);
    if (nextPhase) setProgress(Math.min(nextPhase[0], value + 2), nextPhase[1]);
  }, 190);

  function completeWhenReady() {
    if (finished || !pageLoaded || !firstFrame) return;
    const remaining = Math.max(0, 1100 - (performance.now() - startedAt));
    window.setTimeout(() => {
      if (finished || !pageLoaded || !firstFrame) return;
      finished = true;
      window.clearInterval(progressTimer);
      setProgress(100, 'The lanterns are lit. Welcome to Aelmoor.');
      window.setTimeout(() => {
        root.classList.add('is-hidden');
        window.setTimeout(() => root.remove(), 900);
      }, 260);
    }, remaining);
  }

  window.addEventListener('load', () => {
    pageLoaded = true;
    setProgress(Math.max(value, 92), 'Game resources loaded. Starting the world…');
    completeWhenReady();
  }, { once: true });

  const observer = new MutationObserver(() => {
    if (!firstFrame && document.body.classList.contains('game-rendered')) {
      firstFrame = true;
      setProgress(Math.max(value, 88), 'Game engine online. Preparing your adventure…');
      completeWhenReady();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (firstFrame) completeWhenReady();

  retry.addEventListener('click', () => window.location.reload());
  window.setTimeout(() => {
    if (finished || (pageLoaded && firstFrame)) return;
    status.textContent = 'Startup is taking longer than expected. Check your connection and retry.';
    retry.style.display = 'inline-block';
    observer.disconnect();
  }, 25000);
})();
