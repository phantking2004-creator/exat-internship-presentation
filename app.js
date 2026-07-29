/* ==========================================================================
   EXAT Internship Presentation - Application Logic & Real-time Live Sync
   Synchronization: Total Slides = 32
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const totalSlides = 32;
  let currentSlide = 0;
  let audioEnabled = true;

  // Real-time PeerJS variables
  let peer = null;
  let isPresenter = false;
  let activeConnections = [];
  let currentPeerConn = null;

  // DOM Elements
  const wrapper = document.getElementById('slides-wrapper');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const currentSlideNumEl = document.getElementById('current-slide-num');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const tocSelect = document.getElementById('toc-select');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');

  // Live Modal Elements
  const liveSyncBtn = document.getElementById('live-sync-btn');
  const liveModal = document.getElementById('live-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const createRoomBtn = document.getElementById('create-room-btn');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const presenterInfo = document.getElementById('presenter-info');
  const connectedCountEl = document.getElementById('connected-count');
  const joinRoomInput = document.getElementById('join-room-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const viewerInfo = document.getElementById('viewer-info');
  const viewerStatusText = document.getElementById('viewer-status-text');
  const liveBtnText = document.getElementById('live-btn-text');

  // Web Audio API Synthesizer
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
      console.warn('Audio error:', e);
    }
  }

  // Broadcast slide change to all connected viewers (Presenter Mode)
  function broadcastSlideChange(slideIndex) {
    if (!isPresenter || activeConnections.length === 0) return;
    activeConnections.forEach(conn => {
      if (conn && conn.open) {
        conn.send({ type: 'GOTO_SLIDE', slide: slideIndex });
      }
    });
  }

  // Update Slide Position & UI State
  function updateSlide(index, playAudio = true, isRemote = false) {
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

    // Broadcast if action triggered locally by Presenter
    if (!isRemote && isPresenter) {
      broadcastSlideChange(currentSlide);
    }
  }

  // Real-time Live Sync Logic (PeerJS)
  function initPresenterRoom() {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const roomId = `exat-slide-${randomCode}`;

    if (typeof Peer === 'undefined') {
      alert('ไม่สามารถโหลดไดรเวอร์ PeerJS ได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      return;
    }

    peer = new Peer(roomId);

    peer.on('open', (id) => {
      isPresenter = true;
      if (presenterInfo) presenterInfo.classList.remove('hidden');
      if (roomCodeDisplay) roomCodeDisplay.value = id;
      if (liveBtnText) liveBtnText.textContent = `🔴 Live (คุมห้อง ${id})`;

      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${id}`;
      if (copyLinkBtn) {
        copyLinkBtn.onclick = () => {
          navigator.clipboard.writeText(shareUrl);
          alert(`คัดลอกลิงก์เรียลไทม์แล้ว:\n${shareUrl}`);
        };
      }
    });

    peer.on('connection', (conn) => {
      activeConnections.push(conn);
      updateConnectedCount();

      conn.on('open', () => {
        // Send initial slide state
        conn.send({ type: 'GOTO_SLIDE', slide: currentSlide });
      });

      conn.on('close', () => {
        activeConnections = activeConnections.filter(c => c !== conn);
        updateConnectedCount();
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      alert(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`);
    });
  }

  function updateConnectedCount() {
    if (connectedCountEl) {
      connectedCountEl.textContent = `🟢 เชื่อมต่อสด: ${activeConnections.length} ผู้รับชม`;
    }
  }

  function joinPresenterRoom(roomId) {
    if (!roomId) return;
    if (typeof Peer === 'undefined') {
      alert('ไม่สามารถโหลดไดรเวอร์ PeerJS ได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      return;
    }

    peer = new Peer();

    peer.on('open', () => {
      currentPeerConn = peer.connect(roomId);

      currentPeerConn.on('open', () => {
        isPresenter = false;
        if (viewerInfo) viewerInfo.classList.remove('hidden');
        if (viewerStatusText) viewerStatusText.textContent = `🟢 เชื่อมต่อกับห้อง ${roomId} แล้ว (สไลด์จะเปลี่ยนตามผู้นำเสนออัตโนมัติ)`;
        if (liveBtnText) liveBtnText.textContent = `🟢 Live Sync (ชมสดห้อง ${roomId})`;
        if (liveModal) liveModal.classList.remove('active');
      });

      currentPeerConn.on('data', (data) => {
        if (data && data.type === 'GOTO_SLIDE') {
          updateSlide(data.slide, true, true);
        }
      });

      currentPeerConn.on('close', () => {
        if (viewerStatusText) viewerStatusText.textContent = '❌ การเชื่อมต่อกับผู้นำเสนอหลุด';
      });
    });

    peer.on('error', (err) => {
      alert(`ไม่สามารถเข้าร่วมห้อง ${roomId} ได้ โปรดตรวจสอบรหัสห้องอีกครั้ง`);
    });
  }

  // Event Listeners for UI
  if (liveSyncBtn) {
    liveSyncBtn.addEventListener('click', () => {
      if (liveModal) liveModal.classList.add('active');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (liveModal) liveModal.classList.remove('active');
    });
  }

  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
      initPresenterRoom();
    });
  }

  if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
      const inputCode = joinRoomInput ? joinRoomInput.value.trim() : '';
      if (inputCode) {
        joinPresenterRoom(inputCode);
      } else {
        alert('กรุณากรอกรหัสห้อง');
      }
    });
  }

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
    if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT')) {
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
      updateSlide(currentSlide + 1);
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      updateSlide(currentSlide - 1);
    }
  }

  // Check URL parameters for auto-join room (e.g. ?room=exat-slide-1234)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    joinPresenterRoom(roomParam);
  }

  // Initial Sync
  updateSlide(0, false);
});
