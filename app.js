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
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_8.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_7.jpg"
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
        "Photo/LINE_ALBUM_Gun_260729_1.jpg",
        "Photo/LINE_ALBUM_1572569 BE_260727_4.jpg"
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
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_3.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_1.jpg"
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
        "Photo/LINE_ALBUM_22072569_260727_1.jpg",
        "Photo/LINE_ALBUM_จตุโชติตอน3-120626_260727_6.jpg"
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
        "Photo/LINE_ALBUM_296 safety audit จตุโชติ_260727_4.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_2.jpg"
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
      photos: ["Photo/step9_tremie_pouring.jpg"],
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
      photos: ["Photo/step10_casing_extraction.jpg"],
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
          <div style="width: 100%; height: 260px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-light); background: #f8fafc;">
            <img src="${data.photos[0]}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
          </div>
        `;
      } else {
        photosHtml = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; height: 260px;">
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

  // Initial Sync
  updateSlide(0, false);
});
