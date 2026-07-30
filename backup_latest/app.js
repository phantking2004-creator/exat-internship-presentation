/* ==========================================================================
   EXAT Internship Presentation - Application Logic & Real-time Live Sync
   Synchronization: Total Slides = 31
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const totalSlides = 31;
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


  // ==========================================
  // Auto Photo Carousel Controller (3 Seconds)
  // ==========================================
  let carouselIntervals = [];

  function stopAllCarousels() {
    carouselIntervals.forEach(timer => clearInterval(timer));
    carouselIntervals = [];
  }

  function initSlideCarousels(slideSection) {
    stopAllCarousels();
    if (!slideSection) return;

    const carousels = slideSection.querySelectorAll('.photo-carousel-wrapper');
    carousels.forEach(carousel => {
      const items = carousel.querySelectorAll('.photo-carousel-item');
      const dots = carousel.querySelectorAll('.carousel-dots-bar .dot');
      if (items.length <= 1) return;

      let currentIndex = 0;

      function goToSlide(targetIndex) {
        items[currentIndex].classList.remove('active');
        if (dots[currentIndex]) dots[currentIndex].classList.remove('active');

        currentIndex = (targetIndex + items.length) % items.length;

        items[currentIndex].classList.add('active');
        if (dots[currentIndex]) dots[currentIndex].classList.add('active');
      }

      // 3-Second Auto Rotate Timer
      const timer = setInterval(() => {
        goToSlide(currentIndex + 1);
      }, 3000);

      carouselIntervals.push(timer);

      // Dot Indicator Click Handlers
      dots.forEach((dot, dotIdx) => {
        dot.onclick = (e) => {
          e.stopPropagation();
          goToSlide(dotIdx);
        };
      });
    });
  }


  // Expose global window.goToSlide for direct HTML onclick attributes
  window.goToSlide = function(targetIndex) {
    updateSlide(targetIndex);
  };
  // Update Slide Position & UI State
  function updateSlide(index, playAudio = true, isRemote = false) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;

    currentSlide = index;

    // Slide transformation (100% / 31 per slide = 3.22580645%)
    const offsetPercentage = currentSlide * (100 / totalSlides);
    wrapper.style.transform = `translateX(-${currentSlide * (100 / totalSlides)}%)`;

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

    // Initialize Auto Photo Carousel for current active slide
    const currentSlideEl = wrapper.children[currentSlide];
    if (currentSlideEl) {
      initSlideCarousels(currentSlideEl);
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

  // 10-Step Bored Pile Workflow Interactive Logic (Slide 6 Inline Renderer)
  const stepActiveContainer = document.getElementById('step-active-container');
  const stepNavBtns = document.querySelectorAll('.step-nav-btn');

  const workflowStepsData = {
    1: {
      title: "1. รังวัดตำแหน่ง",
      icon: "📍",
      subtitle: "การกำหนดจุดศูนย์กลางเสาเข็มและการควบคุมระยะคลาดเคลื่อน",
      photos: ["Photo/90062.jpg"],
      details: [
        "คลาดเคลื่อน Casing ≤ 50 มม.",
        "ระยะเยื้องศูนย์สุดท้าย ≤ 75 มม."
      ]
    },
    2: {
      title: "2. ติดตั้ง Casing",
      icon: "🏗️",
      subtitle: "การกดท่อเหล็กชั่วคราวป้องกันการพังทลายของชั้นดิน",
      photos: [
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_7.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_8.jpg"
      ],
      details: [
        "ASTM A36 ยาว ≥ 13 ม.",
        "ความดิ่งเบี่ยงเบน ≤ 1:100"
      ]
    },
    3: {
      title: "3. ขุดเจาะระบบเปียก",
      icon: "🚜",
      subtitle: "ขั้นตอนการขุดเจาะชั้นดินและการเติมสารพยุงหลุมเจาะ",
      photos: [
        "Photo/LINE_ALBUM_1572569 BE_260727_4_flipped.jpg",
        "Photo/LINE_ALBUM_Gun_260729_1.jpg"
      ],
      details: [
        "ใช้หัวเจาะ Auger ในการเปิดเนื้อดินระยะ 15 ม. หลังจากนั้นเปลี่ยนเป็น Bucket",
        "เติม Polymer พยุงหลุมตลอดเวลา ห้ามต่ำกว่าปาก Casing"
      ]
    },
    4: {
      title: "4. ตรวจสารละลายและบันทึกชั้นดิน",
      icon: "🧪",
      subtitle: "การสุ่มตรวจคุณสมบัติสารละลาย Polymer และการจำแนกชั้นดิน",
      photos: [
        "Photo/LINE_ALBUM_296 safety audit จตุโชติ_260727_1.jpg",
        "Photo/LINE_ALBUM_22072569_260729_1.jpg"
      ],
      details: [
        "เก็บตัวอย่าง Polymer ทุกความลึก 5 ม. และทุกระดับเปลี่ยนชั้นดิน",
        "ตรวจ Mud Balance ก่อนใช้",
        "ห้ามใช้หาก pH < 8"
      ]
    },
    5: {
      title: "5. ตรวจสอบสภาพรูเจาะ",
      icon: "📡",
      subtitle: "การตรวจวัดความดิ่งและรูปทรงหลุมเจาะด้วยคลื่นเสียง Koden Test",
      photos: [
        "Photo/LINE_ALBUM_296 safety audit จตุโชติ_260727_4.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_2.jpg"
      ],
      details: [
        "สแกนรูเจาะด้วย Koden Test ทุกต้น ที่ระยะ 30 ม. และหลังเจาะเสร็จสิ้น"
      ]
    },
    6: {
      title: "6. ติดตั้งโครงเหล็กเสริม",
      icon: "⛓️",
      subtitle: "การประกอบ ยกรอย และเกณฑ์เวลาติดตั้งโครงเหล็กก้นหลุม",
      photos: [
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_3.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_1.jpg"
      ],
      details: [
        "ตรวจสอบระยะห่างเหล็กแกน/ปลอก ระยะหุ้ม และระยะทาบ",
        "ล้างก้นหลุม ≤ 1 ชม.",
        "ติดตั้งโครงเหล็ก ≤ 2 ชม."
      ]
    },
    7: {
      title: "7. ติดตั้งท่อ Sonic",
      icon: "🔩",
      subtitle: "ข้อกำหนดท่อตรวจสอบความสมบูรณ์เสาเข็มด้วยคลื่นเสียง",
      photos: [
        "Photo/LINE_ALBUM_22072569_260727_1.jpg",
        "Photo/LINE_ALBUM_จตุโชติตอน3-120626_260727_6.jpg"
      ],
      details: [
        "เข็ม ∅ ≥ 0.80 ม. ทุกต้น",
        "ท่อเหล็กดำ ID 50 มม. หนา ≥ 1.6 มม., ปลายล่างงอ 90°",
        "จำนวนท่อ: ∅ 1.0-1.2ม. = 4 ท่อ, ∅ 1.5-1.8ม. = 6 ท่อ, ∅ 2.0ม. = 8 ท่อ"
      ]
    },
    8: {
      title: "8. ติดตั้งท่อ Tremie",
      icon: "🏗️",
      subtitle: "ข้อกำหนดท่อลำเลียงคอนกรีตและการวัดระดับก้นหลุม",
      photos: ["Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_1.jpg"],
      details: [
        "ท่อเหล็ก (ห้ามอลูมิเนียม)",
        "วัดระดับก้นหลุมด้วยลูกดิ่ง ≥ 4 จุด",
        "ปลายท่อจมในปูน 3.0-5.0 ม. ขณะเทและตัดต่อท่อ"
      ]
    },
    9: {
      title: "9. เทคอนกรีต",
      icon: "🚚",
      subtitle: "ขั้นตอนการเทคอนกรีตใต้น้ำและการถอนท่อ Casing",
      photos: ["Photo/step9_tremie_pouring_v2.jpg"],
      details: [
        "ใส่ลูกบอลโฟมแยกปูน",
        "เทต่อเนื่องไม่หยุดชะงัก",
        "ถอน Casing ทันทีเมื่อระดับคอนกรีตได้เกณฑ์"
      ]
    },
    10: {
      title: "10. เกร้าท์ปิดท่อ Sonic",
      icon: "🔒",
      subtitle: "การปิดผนึกท่อ Sonic Logging หลังเสร็จสิ้นการตรวจวัด",
      photos: ["Photo/3cd01039-69aa-4a93-b6d2-0bdd0133b823.png"],
      details: [
        "หลังเสร็จสิ้นการทดสอบคลื่นเสียง เกร้าท์ปิดท่อด้วยวัสดุกำลังอัดไม่ต่ำกว่าคอนกรีตเสาเข็ม"
      ]
    }
  };

  function renderActiveStep(stepIndex) {
    const data = workflowStepsData[stepIndex];
    if (!data || !stepActiveContainer) return;

    stepNavBtns.forEach(btn => {
      const idx = parseInt(btn.getAttribute('data-step-index'), 10);
      btn.classList.toggle('active', idx === stepIndex);
    });

    let photosHtml = '';
    if (data.photos && data.photos.length > 0) {
      if (data.photos.length === 1) {
        photosHtml = `
          <div style="width: 100%; height: 330px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-light); background: #f8fafc;">
            <img src="${data.photos[0]}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
          </div>
        `;
      } else {
        photosHtml = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; height: 330px;">
            <div style="border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-light); height: 100%;">
              <img src="${data.photos[0]}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            </div>
            <div style="border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-light); height: 100%;">
              <img src="${data.photos[1]}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            </div>
          </div>
        `;
      }
    }

    const detailsListHtml = data.details.map(d => `<li>${d}</li>`).join('');

    stepActiveContainer.innerHTML = `
      <div class="step-active-card">
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center;">
          ${photosHtml}
          <span style="font-size: 11px; color: var(--text-muted);">📷 ภาพประกอบการปฏิบัติงานสนามขั้นตอนที่ ${stepIndex} (${data.photos.length} รูป)</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${data.icon}</span>
            <div>
              <span class="category-tag" style="background: var(--blue-accent); color: #ffffff; font-size: 10px; padding: 2px 8px;">ขั้นตอนที่ ${stepIndex} จาก 10</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; color: var(--navy-primary); margin-top: 2px;">${data.title}</h3>
            </div>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px;">${data.subtitle}</p>
          
          <div class="card" style="background: rgba(15, 32, 66, 0.02); border: 1px solid var(--border-light); padding: 12px;">
            <div class="card-title" style="font-size: 12px; margin-bottom: 8px;">📌 รายละเอียดการปฏิบัติงาน & ข้อกำหนดวิศวกรรม EXAT</div>
            <ul class="custom-list spec-list" style="font-size: 11px; gap: 6px;">
              ${detailsListHtml}
            </ul>
          </div>
        </div>
      </div>
    `;

    playSlideSound();
  }

  stepNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-step-index'), 10);
      if (!isNaN(idx)) {
        renderActiveStep(idx);
      }
    });
  });

  renderActiveStep(1);

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

  
  // Static Load Test Cycle Simulator Logic (Slide 11 Bulletproof Handler)
  function initStaticLoadSim() {
    const cycleBtns = document.querySelectorAll('.cycle-sim-btn');
    if (!cycleBtns.length) return;

    const cycleData = {
      1: {
        jackText: "⬇️ 850 TON (100%)",
        settlement: "4.25 มม.",
        pileTranslateY: "10px",
        color: "#2563eb"
      },
      2: {
        jackText: "⬇️ 1,700 TON (200%)",
        settlement: "11.80 มม.",
        pileTranslateY: "24px",
        color: "#10b981"
      },
      3: {
        jackText: "⬇️ 2,550 TON (300% MAX)",
        settlement: "23.40 มม.",
        pileTranslateY: "38px",
        color: "#f59e0b"
      }
    };

    cycleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cycle = btn.getAttribute('data-cycle');
        const data = cycleData[cycle];
        if (!data) return;

        cycleBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = '#f8fafc';
          b.style.color = 'var(--navy-primary)';
          b.style.borderColor = 'var(--border-light)';
        });

        btn.classList.add('active');
        btn.style.background = data.color;
        btn.style.color = '#ffffff';
        btn.style.borderColor = data.color;

        const settleValEl = document.getElementById('sim-settlement-val');
        const pileColumnEl = document.getElementById('sim-pile-column');
        const jackTextEl = document.getElementById('sim-jack-text');

        if (settleValEl) {
          settleValEl.textContent = data.settlement;
          settleValEl.style.color = data.color;
        }

        if (jackTextEl) {
          jackTextEl.textContent = data.jackText;
          jackTextEl.style.color = data.color;
        }

        if (pileColumnEl) {
          pileColumnEl.style.transform = `translate(-50%, ${data.pileTranslateY})`;
        }
      });
    });
  }

  // Also bind document event listener fallback for dynamic clicks
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.cycle-sim-btn');
    if (!btn) return;
    
    const cycleBtns = document.querySelectorAll('.cycle-sim-btn');
    const cycle = btn.getAttribute('data-cycle');
    const cycleData = {
      1: { jackText: "⬇️ 850 TON (100%)", settlement: "4.25 มม.", pileTranslateY: "10px", color: "#2563eb" },
      2: { jackText: "⬇️ 1,700 TON (200%)", settlement: "11.80 มม.", pileTranslateY: "24px", color: "#10b981" },
      3: { jackText: "⬇️ 2,550 TON (300% MAX)", settlement: "23.40 มม.", pileTranslateY: "38px", color: "#f59e0b" }
    };
    
    const data = cycleData[cycle];
    if (!data) return;

    cycleBtns.forEach(b => {
      b.classList.remove('active');
      b.style.background = '#f8fafc';
      b.style.color = 'var(--navy-primary)';
      b.style.borderColor = 'var(--border-light)';
    });

    btn.classList.add('active');
    btn.style.background = data.color;
    btn.style.color = '#ffffff';
    btn.style.borderColor = data.color;

    const settleValEl = document.getElementById('sim-settlement-val');
    const pileColumnEl = document.getElementById('sim-pile-column');
    const jackTextEl = document.getElementById('sim-jack-text');

    if (settleValEl) {
      settleValEl.textContent = data.settlement;
      settleValEl.style.color = data.color;
    }

    if (jackTextEl) {
      jackTextEl.textContent = data.jackText;
      jackTextEl.style.color = data.color;
    }

    if (pileColumnEl) {
      pileColumnEl.style.transform = `translate(-50%, ${data.pileTranslateY})`;
    }
  });

  
  // Global helper function for pile cycle simulation
  window.switchPileSimCycle = function(cycleNum) {
    const cycleBtns = document.querySelectorAll('.cycle-sim-btn');
    const cycleData = {
      1: { jackText: "⬇️ 850 TON (100%)", settlement: "4.25 มม.", pileTranslateY: "10px", color: "#2563eb" },
      2: { jackText: "⬇️ 1,700 TON (200%)", settlement: "11.80 มม.", pileTranslateY: "24px", color: "#10b981" },
      3: { jackText: "⬇️ 2,550 TON (300% MAX)", settlement: "23.40 มม.", pileTranslateY: "38px", color: "#f59e0b" }
    };
    
    const data = cycleData[cycleNum];
    if (!data) return;

    cycleBtns.forEach(b => {
      const bCycle = b.getAttribute('data-cycle');
      if (parseInt(bCycle, 10) === parseInt(cycleNum, 10)) {
        b.classList.add('active');
        b.style.background = data.color;
        b.style.color = '#ffffff';
        b.style.borderColor = data.color;
      } else {
        b.classList.remove('active');
        b.style.background = '#f8fafc';
        b.style.color = 'var(--navy-primary)';
        b.style.borderColor = 'var(--border-light)';
      }
    });

    const settleValEl = document.getElementById('sim-settlement-val');
    const pileColumnEl = document.getElementById('sim-pile-column');
    const jackTextEl = document.getElementById('sim-jack-text');

    if (settleValEl) {
      settleValEl.textContent = data.settlement;
      settleValEl.style.color = data.color;
    }

    if (jackTextEl) {
      jackTextEl.textContent = data.jackText;
      jackTextEl.style.color = data.color;
    }

    if (pileColumnEl) {
      pileColumnEl.style.transform = `translate(-50%, ${data.pileTranslateY})`;
    }
  };

  
  // Pre-tensioning 6 Steps Pure SVG Vector Graphics Simulator (Slide 16 - Straight Rectangular Beam)
  window.switchPretensionStep = function(stepNum) {
    const btns = document.querySelectorAll('.pretension-step-btn');
    const titleEl = document.getElementById('pretension-title');
    const descEl = document.getElementById('pretension-desc');
    const svgEl = document.getElementById('pretension-svg');

    if (!btns.length || !svgEl) return;

    btns.forEach(b => {
      const bStep = b.getAttribute('data-step');
      if (parseInt(bStep, 10) === parseInt(stepNum, 10)) {
        b.classList.add('active');
        b.style.background = 'var(--blue-accent)';
        b.style.color = '#ffffff';
        b.style.borderColor = 'var(--blue-accent)';
      } else {
        b.classList.remove('active');
        b.style.background = '#f8fafc';
        b.style.color = 'var(--navy-primary)';
        b.style.borderColor = 'var(--border-light)';
      }
    });

    const topArrowsSVG = `
      <g fill="#000000" stroke="#000000" stroke-width="1.5">
        <line x1="70" y1="4" x2="70" y2="24"/><polygon points="70,30 64,20 76,20"/>
        <line x1="120" y1="4" x2="120" y2="24"/><polygon points="120,30 114,20 126,20"/>
        <line x1="170" y1="4" x2="170" y2="24"/><polygon points="170,30 164,20 176,20"/>
        <line x1="220" y1="4" x2="220" y2="24"/><polygon points="220,30 214,20 226,20"/>
      </g>
    `;

    const sideInwardArrowsSVG = `
      <g fill="#000000" stroke="#000000" stroke-width="2">
        <line x1="4" y1="58" x2="24" y2="58"/><polygon points="28,58 20,53 20,63"/>
        <line x1="266" y1="58" x2="286" y2="58"/><polygon points="262,58 270,53 270,63"/>
      </g>
    `;

    // Always straight rectangular beam element
    const straightBeamSVG = `<rect x="35" y="42" width="220" height="32" rx="3" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>`;

    const stepData = {
      1: {
        title: "1. Unstressed beam",
        desc: "คานสี่เหลี่ยมธรรมดา + ลูกศรสีดำ 4 หัวกดทับด้านบน (↓↓↓↓)",
        svg: `
          ${topArrowsSVG}
          ${straightBeamSVG}
          <text x="145" y="62" font-size="11" fill="#0f172a" font-weight="bold" font-family="sans-serif" text-anchor="middle">Unstressed Beam</text>
        `
      },
      2: {
        title: "2. Load deflection (down)",
        desc: "คานคอนกรีตเกิดการตกท้องช้าง + เส้นโค้งสีชมพูบานเย็น (Magenta Curve)",
        svg: `
          ${topArrowsSVG}
          ${straightBeamSVG}
          <!-- Magenta Curve Deflected Down -->
          <path d="M 35 42 Q 145 74 255 42" stroke="#ec4899" stroke-width="4.5" fill="none" stroke-linecap="round"/>
          <text x="145" y="62" font-size="10.5" fill="#0f172a" font-weight="bold" font-family="sans-serif" text-anchor="middle">Load Deflection (Down)</text>
        `
      },
      3: {
        title: "3. Tendons stressed",
        desc: "เส้นสลิงสีแดงยาวทะลุคาน + หัวลูกศรสีแดงชี้ออกนอกคานทั้งสองข้าง (◄───►)",
        svg: `
          <!-- Red Stressed Tendon Line through Beam (Solid Line) -->
          <line x1="8" y1="58" x2="282" y2="58" stroke="#ef4444" stroke-width="3.5"/>
          <!-- Red Outward Arrows (◄───►) -->
          <g fill="#ef4444" stroke="#ef4444" stroke-width="1.5">
            <line x1="12" y1="58" x2="30" y2="58"/><polygon points="6,58 14,53 14,63"/>
            <line x1="260" y1="58" x2="278" y2="58"/><polygon points="284,58 276,53 276,63"/>
          </g>
          <!-- Straight Beam Outer Frame (Solid Line) -->
          <rect x="35" y="42" width="220" height="32" rx="3" fill="none" stroke="#334155" stroke-width="2"/>
          <text x="145" y="52" font-size="10" fill="#dc2626" font-weight="bold" font-family="sans-serif" text-anchor="middle">Tendons Stressed (◄───►)</text>
        `
      },
      4: {
        title: "4. Prestress forces",
        desc: "ลูกศรสีดำชี้เข้าหาคานสองฝั่ง (➔ [ Beam ] ⬅) + เส้นลวดสีแดงในเนื้อปูน",
        svg: `
          ${sideInwardArrowsSVG}
          ${straightBeamSVG}
          <line x1="35" y1="60" x2="255" y2="60" stroke="#ef4444" stroke-width="3.5"/>
          <text x="145" y="54" font-size="10.5" fill="#0f172a" font-weight="bold" font-family="sans-serif" text-anchor="middle">Prestress Forces Transferred</text>
        `
      },
      5: {
        title: "5. Prestress deflection (up)",
        desc: "ลูกศรสีดำชี้เข้าหาคานสองฝั่ง + เส้นโค้งโก่งตัวขึ้นด้านบนสีชมพูบานเย็น (Camber Up)",
        svg: `
          ${sideInwardArrowsSVG}
          ${straightBeamSVG}
          <!-- Magenta Curve Camber Up -->
          <path d="M 35 42 Q 145 14 255 42" stroke="#ec4899" stroke-width="4.5" fill="none" stroke-linecap="round"/>
          <line x1="35" y1="60" x2="255" y2="60" stroke="#ef4444" stroke-width="3.5"/>
          <text x="145" y="58" font-size="10.5" fill="#0f172a" font-weight="bold" font-family="sans-serif" text-anchor="middle">Prestress Deflection (Camber Up)</text>
        `
      },
      6: {
        title: "6. Total deflection (flat)",
        desc: "ลูกศรชี้ลงด้านบน 4 หัว + ลูกศรชี้เข้าสองฝั่ง + เส้นโค้งชมพูดันสมดุลคานราบเรียบ",
        svg: `
          ${topArrowsSVG}
          ${sideInwardArrowsSVG}
          ${straightBeamSVG}
          <!-- Magenta Curve Balanced Flat Line -->
          <line x1="35" y1="42" x2="255" y2="42" stroke="#ec4899" stroke-width="4.5"/>
          <line x1="35" y1="60" x2="255" y2="60" stroke="#ef4444" stroke-width="3.5"/>
          <text x="145" y="58" font-size="10.5" fill="#0f172a" font-weight="bold" font-family="sans-serif" text-anchor="middle">Total Deflection (Balanced Flat)</text>
        `
      }
    };

    const data = stepData[stepNum];
    if (!data) return;

    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.desc;
    if (svgEl) svgEl.innerHTML = data.svg;
  };
  // Initial Sync
  updateSlide(0, false);
});

// ------------ Slide 29 Country Safety System Switcher with Enlarged 2D Animations ------------
window.switchTunnelSafetyCountry = function(country) {
  const btnJapan = document.getElementById('btn-country-japan');
  const btnKorea = document.getElementById('btn-country-korea');
  const display = document.getElementById('country-safety-display');

  if (!display) return;

  if (country === 'japan') {
    if (btnJapan) {
      btnJapan.style.background = 'var(--blue-accent)';
      btnJapan.style.color = '#ffffff';
      btnJapan.style.borderColor = 'var(--blue-accent)';
    }
    if (btnKorea) {
      btnKorea.style.background = '#f8fafc';
      btnKorea.style.color = 'var(--navy-primary)';
      btnKorea.style.borderColor = 'var(--border-light)';
    }
    display.innerHTML = `<div style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Enlarged 2D Animation Viewport (Japan) -->
                        <div style="position: relative; height: 145px; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-radius: 6px; overflow: hidden; border: 1px solid #334155; display: flex; align-items: center; justify-content: center;">
                          
                          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-top: 4px solid #64748b; border-bottom: 4px solid #475569;"></div>
                          
                          <div style="position: absolute; top: 6px; left: 10px; font-size: 9px; font-weight: 800; color: #10b981; background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 4px; border: 1px solid #059669; z-index: 10;">
                            🎛️ CONTROL ROOM: ACTIVE (ห้องควบคุมศูนย์กลาง)
                          </div>

                          <!-- Rotating Jet Fan System (Top Ceiling) -->
                          <div style="position: absolute; top: 12px; left: 28%; display: flex; align-items: center; gap: 6px; z-index: 5;">
                            <div style="font-size: 22px; animation: fanRotate 0.5s linear infinite; transform-origin: center;">🌀</div>
                            <span style="font-size: 9px; font-weight: 800; color: #38bdf8; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px; border: 1px solid #0284c7;">พัดลม Jet Fan</span>
                          </div>

                          <!-- Animated Smoke Flow (Pushed to right) -->
                          <div style="position: absolute; top: 48px; left: 25%; font-size: 18px; animation: smokeFlow 1.6s ease-out infinite; z-index: 4;">
                            💨 🌫️ 💨
                          </div>

                          <!-- Sprinkler System Spraying Water Mist -->
                          <div style="position: absolute; top: 14px; left: 68%; text-align: center; z-index: 5;">
                            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; animation: warningBlink 1s infinite;">🚿 SPRINKLER</div>
                            <div style="font-size: 15px; color: #60a5fa; animation: waterSpray 0.7s linear infinite; line-height: 1.1; margin-top: 2px;">💧💧💧<br>💧💧💧</div>
                          </div>

                          <!-- Burning Car on Tunnel Road -->
                          <div style="position: absolute; bottom: 12px; left: 58%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; z-index: 5;">
                            <div style="font-size: 18px; animation: warningBlink 0.5s infinite; margin-bottom: -6px;">🔥</div>
                            <div style="font-size: 26px;">🚗</div>
                          </div>

                          <div style="position: absolute; bottom: 6px; left: 0; width: 100%; height: 3px; background: #94a3b8; border-bottom: 1.5px dashed #ffffff;"></div>
                        </div>

                        <!-- Full Text Specification Description Below (Japan) -->
                        <div style="font-size: 13.5px; color: var(--navy-primary); line-height: 1.5; background: rgba(239,68,68,0.04); padding: 10px 12px; border-radius: 6px; border-left: 4px solid #ef4444;">
                          <div style="font-size: 14.5px; font-weight: 800; color: #dc2626; margin-bottom: 6px;">🔥 กรณีเกิดเพลิงไหม้ในอุโมงค์: แสดงระบบควบคุมอัคคีภัย 2 ขั้นตอน</div>
                          <ul style="margin: 0; padding-left: 16px; list-style-type: disc; font-size: 13px; line-height: 1.55;">
                            <li style="margin-bottom: 3px;">
                              <strong>🌬️ พัดลมระบายอากาศขนาดใหญ่ (Jet Fan System):</strong> พัดลมขนาดใหญ่จะพัดควบคุมทิศทางควันไฟ ไม่ให้ควันย้อนกลับมาทางพื้นที่อพยพ
                            </li>
                            <li>
                              <strong>🚿 ระบบสปริงเกอร์ฉีดดับไฟ (Sprinkler System):</strong> ระบบสปริงเกอร์ฉีดดับไฟในอุโมงค์ ซึ่งสามารถสั่งการและควบคุมได้จาก <strong>ห้องควบคุมศูนย์กลาง (Central Control Room)</strong>
                            </li>
                          </ul>
                        </div>
                      </div>`;
  } else if (country === 'korea') {
    if (btnKorea) {
      btnKorea.style.background = 'var(--blue-accent)';
      btnKorea.style.color = '#ffffff';
      btnKorea.style.borderColor = 'var(--blue-accent)';
    }
    if (btnJapan) {
      btnJapan.style.background = '#f8fafc';
      btnJapan.style.color = 'var(--navy-primary)';
      btnJapan.style.borderColor = 'var(--border-light)';
    }
    display.innerHTML = `<div style="display: flex; flex-direction: column; gap: 8px;">
        <!-- Enlarged 2D Animation Viewport (Korea) -->
        <div style="position: relative; height: 145px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); border-radius: 6px; overflow: hidden; border: 1px solid #334155; display: flex; align-items: center; justify-content: center;">
          
          <!-- Tunnel Entrance Portal Arch -->
          <div style="position: absolute; top: 0; right: 0; width: 55%; height: 100%; background: #334155; border-left: 5px solid #f59e0b; border-radius: 45px 0 0 0; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; font-weight: 900; color: #cbd5e1; transform: rotate(-90deg); letter-spacing: 1px;">ทางเข้าอุโมงค์ (TUNNEL)</span>
          </div>

          <!-- Overhead Sign Board Structure -->
          <div style="position: absolute; top: 6px; right: 8%; width: 52%; background: #000000; border: 2px solid #ef4444; border-radius: 4px; padding: 3px 6px; text-align: center; z-index: 8; animation: warningBlink 0.8s infinite;">
            <span style="font-size: 9.5px; font-weight: 900; color: #ef4444;">🚨 EMERGENCY ACCIDENT!</span>
          </div>

          <!-- Dropping Emergency Canvas Curtain (Animates down) -->
          <div style="position: absolute; top: 34px; right: 26%; width: 105px; background: linear-gradient(180deg, #ef4444, #f97316); border: 2px dashed #ffffff; border-radius: 4px; animation: canvasDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; z-index: 9; display: flex; align-items: center; justify-content: center; padding: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
            <span style="font-size: 9px; font-weight: 900; color: #ffffff; text-align: center; text-shadow: 0 1px 2px #000; line-height: 1.2;">⚠️ ห้ามเข้า!<br>มีอุบัติเหตุในอุโมงค์</span>
          </div>

          <!-- Stopped Car Outside Tunnel Entrance -->
          <div style="position: absolute; bottom: 12px; left: 15%; text-align: center; z-index: 5;">
            <span style="font-size: 9px; font-weight: 900; color: #ffffff; background: #dc2626; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">🛑 STOP (สกัดหยุดรถ)</span>
            <div style="font-size: 26px;">🚙</div>
          </div>

          <!-- Road Line -->
          <div style="position: absolute; bottom: 6px; left: 0; width: 100%; height: 3px; background: #64748b; border-bottom: 1.5px dashed #fbbf24;"></div>
        </div>

        <!-- Full Text Specification Description Below (Korea) -->
        <div style="font-size: 13.5px; color: var(--navy-primary); line-height: 1.5; background: rgba(245,158,11,0.06); padding: 10px 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 14.5px; font-weight: 800; color: #d97706; margin-bottom: 6px;">🚨 กรณีเกิดอุบัติเหตุภายในอุโมงค์: แสดงระบบแจ้งเตือนและปิดกั้นหน้าอุโมงค์</div>
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc; font-size: 13px; line-height: 1.55;">
            <li>
              <strong>🚧 ป้ายบอกทาง & ม่านผ้าใบฉุกเฉิน (Emergency Canvas Barrier):</strong> ป้ายบอกทางบริเวณทางเข้าอุโมงค์จะปล่อยผ้าใบแจ้งเตือนฉุกเฉินลงมาทันทีเมื่อเกิดอุบัติเหตุภายในอุโมงค์ เพื่อปิดกั้นและสกัดรถยนต์ไม่ให้ขับเข้าอุโมงค์
            </li>
          </ul>
        </div>
      </div>`;
  }
};

  // ==========================================
  // Universal Image Lightbox Viewer Logic (Guaranteed)
  // ==========================================
  function openLightbox(src, captionText) {
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');

    if (!modal || !img) return;

    img.src = src;
    if (caption) {
      caption.textContent = captionText || 'กด ✕ หรือกด Esc หรือคลิกนอกรูปเพื่อปิดภาพขยายเต็มจอ';
    }

    modal.classList.add('active');
  }

  function closeLightbox() {
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-img');

    if (!modal) return;

    modal.classList.remove('active');
    setTimeout(() => {
      if (img) img.src = '';
    }, 250);
  }

  // Use Capture Phase Event Listener to catch ALL image clicks reliably
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;

    // Check if image is inside presentation slides
    const slide = img.closest('.slide');
    if (slide && img.src) {
      if (img.classList.contains('brand-logo')) return;

      e.preventDefault();
      e.stopPropagation();

      const captionText = img.alt || img.title || 'ภาพประกอบการนำเสนอ EXAT';
      openLightbox(img.src, captionText);
    }
  }, true);

  // Close Lightbox Event Listeners
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('image-lightbox-modal');
    if (!modal || !modal.classList.contains('active')) return;

    if (e.target.id === 'close-lightbox-btn' || e.target.id === 'image-lightbox-modal') {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  });

/* ==========================================================================
   Global Universal Image Lightbox System (100% Reliable)
   ========================================================================== */
window.showImageLightbox = function(src, captionText) {
  const modal = document.getElementById('image-lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const caption = document.getElementById('lightbox-caption');
  if (!modal || !img) return;

  img.src = src;
  if (caption) {
    caption.textContent = captionText || 'กด ✕ หรือคลิกนอกรูปเพื่อปิดภาพขยาย';
  }
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
  });
};

window.closeImageLightbox = function(e) {
  if (e) e.stopPropagation();
  const modal = document.getElementById('image-lightbox-modal');
  if (!modal) return;

  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
    const img = document.getElementById('lightbox-img');
    if (img) img.src = '';
  }, 250);
};

// Bind Escape key listener globally
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeImageLightbox();
  }
});

// Bind click event to all slide images after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const allImages = document.querySelectorAll('.slide img');
  allImages.forEach(img => {
    if (img.classList.contains('brand-logo')) return;
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const altText = img.alt || img.title || 'ภาพประกอบการนำเสนอ EXAT';
      window.showImageLightbox(img.src, altText);
    });
  });
});

/* ==========================================================================
   Dynamic Fullscreen Image Modal Viewer with Dark Background
   ========================================================================== */
window.openImageModal = function(src, captionText) {
  if (!src) return;
  
  let modal = document.getElementById('exat-image-viewer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exat-image-viewer-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999999;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;opacity:0;transition:opacity 0.2s ease;';
    
    modal.innerHTML = `
      <button id="exat-close-modal-btn" title="ปิด (Esc)" style="position:fixed;top:20px;right:24px;background:#ef4444;border:none;color:#ffffff;font-size:24px;font-weight:bold;width:44px;height:44px;border-radius:50%;cursor:pointer;z-index:10000000;box-shadow:0 4px 16px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;">✕</button>
      <div id="exat-modal-content-box" style="position:relative;max-width:92vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <img id="exat-modal-img" src="" alt="ภาพขยาย" style="max-width:92vw;max-height:83vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 50px rgba(0,0,0,0.9);border:1px solid rgba(255,255,255,0.2);background:#000;">
        <div id="exat-modal-caption" style="margin-top:12px;color:#ffffff;font-size: 15px;font-weight:600;text-align:center;background:rgba(11,29,58,0.95);padding:8px 22px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.5);max-width:80vw;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.id === 'exat-close-modal-btn') {
        window.closeImageModal();
      }
    });
  }

  const imgEl = document.getElementById('exat-modal-img');
  const captionEl = document.getElementById('exat-modal-caption');

  if (imgEl) imgEl.src = src;
  if (captionEl) captionEl.textContent = captionText || 'กด ✕ หรือกด Esc หรือคลิกนอกรูปเพื่อปิดภาพขยาย';

  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
  });
};

window.closeImageModal = function() {
  const modal = document.getElementById('exat-image-viewer-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      const imgEl = document.getElementById('exat-modal-img');
      if (imgEl) imgEl.src = '';
    }, 200);
  }
};

// Keydown Escape Listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeImageModal();
  }
});

// Capture phase global click listener on document to intercept ALL image clicks
document.addEventListener('click', (e) => {
  // Find if clicked element or parent is an <img> inside a slide
  const img = e.target.closest('.slide img, .photo-carousel-wrapper img, img');
  if (img && img.src && !img.classList.contains('brand-logo') && img.id !== 'exat-modal-img') {
    e.preventDefault();
    e.stopPropagation();
    const caption = img.alt || img.title || 'ภาพประกอบการนำเสนอ EXAT';
    window.openImageModal(img.src, caption);
  }
}, true);
