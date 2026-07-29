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
      title: "วางพิกัดตำแหน่ง (Survey & Staking Out)",
      icon: "📍",
      subtitle: "การกำหนดจุดศูนย์กลางเสาเข็มเจาะและตอกหมุดอ้างอิงสนาม",
      photos: ["Photo/90062.jpg"],
      details: [
        "ใช้อุปกรณ์กล้อง Total Station กำหนดพิกัดจุดศูนย์กลางเสาเข็ม (Pile Center) ตามแบบวิศวกรรม",
        "ตอกหมุดอ้างอิง (Offset Pin) จำนวน 4 ทิศทาง (ระยะห่าง 1.0 - 2.0 เมตร) สำหรับตรวจสอบตำแหน่งขณะกด Casing",
        "ความคลาดเคลื่อนตำแหน่งศูนย์กลาง (Positioning Accuracy): ต้องไม่เกิน 5.0 ซม. ตามข้อกำหนด EXAT"
      ]
    },
    2: {
      title: "กดท่อ Casing (Temporary Casing Driving)",
      icon: "🏗️",
      subtitle: "การกดท่อเหล็กชั่วคราวป้องกันการพังทลายของชั้นดิน",
      photos: [
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_8.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_7.jpg"
      ],
      details: [
        "กดท่อเหล็กชั่วคราว (Temporary Steel Casing) ความหนาไม่น้อยกว่า 10 มม. ความยาว 12 - 15 เมตร",
        "ใช้เครื่องจักร Vibro Hammer หรือ Hydraulic Casing Oscillator ในการกดท่ออย่างต่อเนื่อง",
        "ตรวจสอบความดิ่ง (Verticality Alignment) 2 ทิศทางตั้งฉาก: ความเอียงต้องไม่เกิน 1:100 (1%)"
      ]
    },
    3: {
      title: "ขุดเจาะหลุม (Soil Excavation)",
      icon: "🚜",
      subtitle: "การขุดเจาะดินด้วยหัวเจาะชนิด Auger และ Drilling Bucket",
      photos: [
        "Photo/LINE_ALBUM_Gun_260729_1.jpg",
        "Photo/LINE_ALBUM_1572569 BE_260727_4.jpg"
      ],
      details: [
        "ใช้หัวเจาะ Auger ขุดดินชั้นบนบริเวณภายในท่อ Casing (ความลึก 0 - 12 ม.)",
        "เปลี่ยนเป็นถังขุด Drilling Bucket เมื่อเจาะเข้าสู่ชั้นดินลึกและระดับน้ำใต้ดิน",
        "ขุดเจาะลึกลงไปจนถึงระดับความลึกปลายเสาเข็มออกแบบ (Design Tip Elevation) ตามกำหนด"
      ]
    },
    4: {
      title: "เติม Drilling Slurry (Slurry Stabilization)",
      icon: "🧪",
      subtitle: "การใช้สารพยุงหลุมเจาะรักษาเสถียรภาพผนังหลุม",
      photos: [
        "Photo/LINE_ALBUM_296 safety audit จตุโชติ_260727_1.jpg",
        "Photo/LINE_ALBUM_22072569_260729_1.jpg"
      ],
      details: [
        "เติมสารพยุงหลุมเจาะ (Polymer/Bentonite Slurry) รักษาระดับสารพยุงให้สูงกว่าระดับน้ำใต้ดิน >= 1.5 ม.",
        "ความหนาแน่น (Density): < 1.02 g/ml (Mud Balance ASTM D4380)",
        "ความหนืด (Viscosity): 45 - 90 วินาที (Marsh Funnel API-RP13B-S2)",
        "ค่า pH: 8 - 12 (ASTM D4972) **ห้ามใช้หาก pH < 8 เด็ดขาด**",
        "ปริมาณทรายปนเปื้อน (Sand Content): <= 1% (Sand Screen ASTM D4381)"
      ]
    },
    5: {
      title: "ทำความสะอาดก้นหลุม (Base Cleaning)",
      icon: "🧹",
      subtitle: "การขจัดเศษตกตะกอนและทรายปนเปื้อนก้นหลุมเจาะ",
      photos: [
        "Photo/LINE_ALBUM_296 safety audit จตุโชติ_260727_4.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_2.jpg"
      ],
      details: [
        "ใช้ Cleaning Bucket (ถังเจาะก้นราบ) ตักกวาดเศษดินและตะกอนตกค้างก้นหลุม",
        "ปั๊มหมุนเวียนสารพยุงหลุมเจาะผ่านเครื่องแยกทราย (Desander Unit) เพื่อตกตะกอนทรายปนเปื้อน",
        "ความหนาของชั้นตะกอนก้นหลุม (Sludge Thickness): ต้องไม่เกิน 5.0 ซม. ก่อนเริ่มหย่อนกรงเหล็ก"
      ]
    },
    6: {
      title: "ทดสอบ Koden Test (Sonic Caliper Test)",
      icon: "📡",
      subtitle: "การตรวจวัดความดิ่ง รูปทรง และความสมบูรณ์ของหลุมเจาะด้วยคลื่นเสียง",
      photos: [
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_3.jpg",
        "Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260729_1.jpg"
      ],
      details: [
        "หย่อนหัววัด Koden Test (Ultrasonic Drilling Logger) ลงในหลุมเจาะสารพยุง Slurry",
        "ส่งคลื่นสะท้อนความถี่สูงวัดเส้นผ่านศูนย์กลาง (Diameter Profile) และความดิ่ง (Verticality Profile) 2 แนวตั้งฉาก",
        "ตรวจสอบว่าหลุมเจาะไม่มีการคอด (Neck), พอง (Bulge) หรือการเอียงเกินเกณฑ์มาตรฐาน 1%"
      ]
    },
    7: {
      title: "หย่อนกรงเหล็กเสริม (Rebar Cage Installation)",
      icon: "⛓️",
      subtitle: "การประกอบ ยกรอย และติดตั้งกรงเหล็กเสริมเสาเข็ม",
      photos: [
        "Photo/LINE_ALBUM_22072569_260727_1.jpg",
        "Photo/LINE_ALBUM_จตุโชติตอน3-120626_260727_6.jpg"
      ],
      details: [
        "ผูก/ยึดกรงเหล็กเสริมตาม Bending Schedule พร้อมเชื่อมทบแนวต่อเหล็กตามมาตรฐานวิศวกรรม",
        "ติดตั้งลูกปูนรองระยะ (Concrete Spacers) โดยรอบทุกระยะ 2.0-3.0 ม. เพื่อรักษาความหนา Concrete Cover (7.5-10 ซม.)",
        "ติดตั้งท่อ Sonic Logging Tube (ท่อเหล็กดำ ID 50 มม. หนา >= 1.6 มม.) จำนวน 4 - 8 ท่อตามขนาดเสาเข็ม"
      ]
    },
    8: {
      title: "ติดตั้งท่อ Tremie (Tremie Pipe Assembly)",
      icon: "🔩",
      subtitle: "การประกอบท่อเหล็กลำเลียงคอนกรีตใต้น้ำ",
      photos: ["Photo/LINE_ALBUM_11669 งานจตุโชติ สัญญา3_260727_1.jpg"],
      details: [
        "ประกอบท่อ Tremie Pipe ทำด้วยเหล็กเท่านั้น (**ห้ามใช้อลูมิเนียมเด็ดขาด**) ขนาด ศก. 250 - 300 มม.",
        "ต่อท่อนท่อท่อนละ 1.0 - 3.0 ม. ลงถึงก้นหลุมเจาะ โดยยกปลายท่อสูงจากก้นหลุม 20 - 30 ซม.",
        "ใส่ปลั๊กกั้น/ลูกบอลโฟม (Foam Plug) ในท่อ Tremie เพื่อแยกคอนกรีตสดไม่ให้สัมผัส Slurry โดยตรงขณะเปิดเท"
      ]
    },
    9: {
      title: "เทคอนกรีตใต้น้ำ (Tremie Concrete Pouring)",
      icon: "🏗️",
      subtitle: "การเทคอนกรีตเกรด 30 AASHTO T 119 หน่วงเวลา >= 4 ชั่วโมง",
      photos: ["Photo/step9_tremie_pouring.jpg"],
      details: [
        "ใช้คอนกรีต Grade 30 (กำลังอัดทรงกระบอก Cylinder >= 30 MPa / 300 ksc) ค่ายุบตัว Slump 18 - 23 ซม.",
        "ระยะเวลาเริ่มแข็งตัว (Setting Time): >= 4 ชั่วโมง (ASTM C494 Type D) เทคอนกรีตดัน Slurry ลอยขึ้นด้านบน",
        "ควบคุมปลายท่อ Tremie ให้จมอยู่ในเนื้อปูนสดไม่น้อยกว่า 2.0 - 5.0 ม. ตลอดเวลาขณะเทและตัดต่อท่อ",
        "เก็บตัวอย่างปูน: 9 แท่ง/ต้น (ทรงกระบอก 15x30 ซม. จำนวน 3 ชุด ชุดละ 3 แท่ง)"
      ]
    },
    10: {
      title: "ถอนท่อ Casing (Casing Extraction & Backfill)",
      icon: "🚜",
      subtitle: "การถอนท่อเหล็กชั่วคราวและการกลบหลังหัวเข็ม",
      photos: ["Photo/step10_casing_extraction.jpg"],
      details: [
        "ใช้ Crane / Vibro Hammer ถอนท่อ Casing ออกอย่างช้าๆ ขณะคอนกรีตสดยังไม่เซ็ตตัว",
        "ตรวจสอบระดับคอนกรีตเผื่อ (Over-pouring) เหนือระดับตัดหัวเข็ม (Cut-off Level) ไม่น้อยกว่า 0.5 - 1.0 ม.",
        "เติมทรายหรือดินกลบหลุมส่วนบน (Backfill) เพื่อป้องกันอุบัติเหตุและหลีกเลี่ยงการพังทลายของปากหลุม"
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
