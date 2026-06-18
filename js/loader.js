/* ============================================================
   loader.js — Entrance Loader Animation
   "BE" morphs into "Bharat Electronics" with a progress bar.
   Used by: ALL pages (include before main.js)
   
   IMPORTANT: Only plays ONCE per browser tab session.
   Uses sessionStorage so switching between pages (Home → Shop
   → About etc.) does NOT replay it — only a fresh tab/visit does.
   
   To disable entirely: set SKIP_LOADER = true below.
   To force it to always replay (e.g. for testing): clear
   sessionStorage, or run sessionStorage.removeItem('be_loader_shown')
   in the browser console.
   ============================================================ */

const SKIP_LOADER = false; // set true to disable loader site-wide
const LOADER_SESSION_KEY = 'be_loader_shown';

(function runLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  /* If already shown this session, remove instantly — no flash, no delay */
  if (SKIP_LOADER || sessionStorage.getItem(LOADER_SESSION_KEY)) {
    loader.remove();
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const beText        = document.getElementById('loaderBE');
    const fullText       = document.getElementById('loaderFull');
    const tagline         = document.getElementById('loaderTag');
    const progressTrack    = document.getElementById('loaderProgressTrack');
    const progressFill      = document.getElementById('loaderProgressFill');
    if (!beText || !fullText) return;

    /* Mark as shown immediately so a fast double-navigation
       (e.g. clicking a link before this finishes) doesn't replay it */
    sessionStorage.setItem(LOADER_SESSION_KEY, 'true');

    /* Step 1: progress bar starts filling right away — "loading" feel */
    if (progressTrack && progressFill) {
      progressTrack.style.transition = 'opacity 0.3s ease';
      progressTrack.style.opacity    = '1';
      setTimeout(() => {
        progressFill.style.transition = 'width 1.3s cubic-bezier(0.4,0,0.2,1)';
        progressFill.style.width      = '100%';
      }, 50);
    }

    /* Step 2: BE blurs out, full name blurs in */
    setTimeout(() => {
      beText.style.transition = 'opacity 0.35s ease, transform 0.35s ease, filter 0.35s ease';
      beText.style.opacity    = '0';
      beText.style.transform  = 'scale(0.85)';
      beText.style.filter     = 'blur(4px)';

      fullText.style.transition = 'opacity 0.45s ease, transform 0.45s ease, filter 0.45s ease';
      fullText.style.opacity    = '1';
      fullText.style.transform  = 'scale(1)';
      fullText.style.filter     = 'blur(0px)';
    }, 500);

    /* Step 3: tagline fades in */
    setTimeout(() => {
      if (tagline) {
        tagline.style.transition = 'opacity 0.4s ease';
        tagline.style.opacity    = '1';
      }
    }, 900);

    /* Step 4: hide loader, reveal page */
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 450);
    }, 1450);
  });
})();
