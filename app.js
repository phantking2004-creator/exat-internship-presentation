/* ==========================================================================
   EXAT Internship Presentation - Application Logic
   Synchronization: Total Slides = 31
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const totalSlides = 31;
  let currentSlide = 0;
  let audioEnabled = true;

  // DOM Elements
  const wrapper = document.getElementById('slides-wrapper');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const currentSlideNumEl = document.getElementById('current-slide-num');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const tocSelect = document.getElementById('toc-select');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');

  // Web Audio API Synthesizer for offline sound feedback
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playSlideSound() {
    if (!audioEnabled) return;
    try {
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Update Slide Position & UI State
  function updateSlide(index, playAudio = true) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;

    currentSlide = index;

    // Slide transformation (100% / 31 per slide = 3.22580645%)
    const offsetPercentage = currentSlide * (100 / totalSlides);
    wrapper.style.transform = `translateX(-${offsetPercentage}%)`;

    // UI Updates
    if (currentSlideNumEl) {
      currentSlideNumEl.textContent = currentSlide + 1;
    }

    if (progressBarFill) {
      const progressPercent = ((currentSlide + 1) / totalSlides) * 100;
      progressBarFill.style.width = `${progressPercent}%`;
    }

    if (tocSelect) {
      tocSelect.value = currentSlide;
    }

    // Button states
    if (prevBtn) prevBtn.disabled = currentSlide === 0;
    if (nextBtn) nextBtn.disabled = currentSlide === totalSlides - 1;

    if (playAudio) playSlideSound();
  }

  // Event Listeners
  if (prevBtn) {
    prevBtn.addEventListener('click', () => updateSlide(currentSlide - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => updateSlide(currentSlide + 1));
  }

  if (tocSelect) {
    tocSelect.addEventListener('change', (e) => {
      const targetIndex = parseInt(e.target.value, 10);
      if (!isNaN(targetIndex)) {
        updateSlide(targetIndex);
      }
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Fullscreen error: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      soundToggleBtn.textContent = audioEnabled ? '🔊 เสียง' : '🔇 ปิดเสียง';
      soundToggleBtn.style.opacity = audioEnabled ? '1' : '0.6';
    });
  }

  // Keyboard Controls
  document.addEventListener('keydown', (e) => {
    // Avoid triggering when focused on select input
    if (document.activeElement && document.activeElement.tagName === 'SELECT') {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        updateSlide(currentSlide + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        updateSlide(currentSlide - 1);
        break;
      case 'Home':
        e.preventDefault();
        updateSlide(0);
        break;
      case 'End':
        e.preventDefault();
        updateSlide(totalSlides - 1);
        break;
      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) {
          if (fullscreenBtn) fullscreenBtn.click();
        }
        break;
    }
  });

  // Touch Swipe Support
  let touchStartX = 0;
  let touchEndX = 0;

  const viewport = document.getElementById('presentation-viewport');
  if (viewport) {
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
      // Swipe left -> Next
      updateSlide(currentSlide + 1);
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      // Swipe right -> Prev
      updateSlide(currentSlide - 1);
    }
  }

  // Initial Sync
  updateSlide(0, false);
});
