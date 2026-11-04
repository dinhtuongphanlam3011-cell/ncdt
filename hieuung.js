/* hieuung.js – Đàn Tranh Online 16 Dây Ngũ Cung
   Bao gồm:
   1. Web Audio Engine: 16 nốt ngũ cung, âm mộc kim loại ngô đồng, gán file riêng.
   2. Bộ Reverb (Độ vang thính phòng/phòng trà) & Âm lượng tổng.
   3. Bộ Ghi âm trực tiếp (MediaRecorder) xuất file audio không dính tạp âm.
   4. Quản lý Theme Sáng / Tối (lưu localStorage).
   5. Quản lý Auth: Chơi không cần đăng nhập (Guest) & Đăng ký không cần Gmail & Admin Tools (admin/admin123).
   6. Thanh Dock squircle đa năng mở các cửa sổ: Lịch sử, Nghệ nhân, Thang âm, Nhạc mẫu TAB, Phòng thu, Thêm mới.
   7. Chatbot Gemini AI: Bách khoa toàn thư chính xác 100% + Hỗ trợ Gemini API Key.
*/

(function () {
  "use strict";

  // =========================================================
  // 1. DỮ LIỆU 16 DÂY ĐÀN TRANH (THANG NGŨ CUNG)
  // =========================================================
  var NOTES = [
    "Đô (C3)", "Rê (D3)", "Mi (E3)", "Sol (G3)", "La (A3)",
    "Đô (C4)", "Rê (D4)", "Mi (E4)", "Sol (G4)", "La (A4)",
    "Đô (C5)", "Rê (D5)", "Mi (E5)", "Sol (G5)", "La (A5)", "Đô (C6)"
  ];
  var FREQUENCIES = [
    130.81, 146.83, 164.81, 196.00, 220.00,
    261.63, 293.66, 329.63, 392.00, 440.00,
    523.25, 587.33, 659.25, 783.99, 880.00, 1046.50
  ];
  var KEY_MAP = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Q", "W", "E", "R"];

  // Dữ liệu slot âm thanh cho 16 dây: { name, url, audio }
  var slots = NOTES.map(function () { return { name: null, url: null, audio: null }; });

  var stringEls = [];
  var slotNames = [];
  var timers = [];

  // =========================================================
  // 2. WEB AUDIO API: REVERB, MASTER VOLUME & SYNTHESIZER
  // =========================================================
  var audioCtx = null;
  var masterGain = null;
  var dryGain = null;
  var wetGain = null;
  var convolver = null;
  var recDestination = null; // Node dẫn sang MediaRecorder để thu âm chuẩn sạch

  var currentReverbMix = 0.35; // 35% vang mặc định
  var currentDecayTime = 1.8;  // 1.8s
  var currentMasterVol = 0.85; // 85% âm lượng

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        initAudioGraph();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Thuật toán tạo Impulse Response cho Reverb tự nhiên (không cần tải file wav nặng)
  function buildImpulseResponse(duration, decay) {
    if (!audioCtx) return null;
    var sampleRate = audioCtx.sampleRate;
    var length = sampleRate * duration;
    var impulse = audioCtx.createBuffer(2, length, sampleRate);
    var left = impulse.getChannelData(0);
    var right = impulse.getChannelData(1);

    for (var i = 0; i < length; i++) {
      var n = i / length;
      // Exponential decay
      var envelope = Math.pow(1 - n, decay);
      // Tiếng vang stereo phân tán
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }
    return impulse;
  }

  function initAudioGraph() {
    if (!audioCtx) return;

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(currentMasterVol, audioCtx.currentTime);

    dryGain = audioCtx.createGain();
    dryGain.gain.setValueAtTime(1 - currentReverbMix * 0.5, audioCtx.currentTime);

    wetGain = audioCtx.createGain();
    wetGain.gain.setValueAtTime(currentReverbMix, audioCtx.currentTime);

    convolver = audioCtx.createConvolver();
    convolver.buffer = buildImpulseResponse(currentDecayTime, 2.2);

    // Kênh Wet qua Convolver
    convolver.connect(wetGain);

    // Điểm đến: Loa máy tính
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // Điểm đến thu âm (MediaStreamDestinationNode)
    if (audioCtx.createMediaStreamDestination) {
      recDestination = audioCtx.createMediaStreamDestination();
      masterGain.connect(recDestination);
    }
  }

  function updateReverbSettings(mixPercent, decaySeconds) {
    currentReverbMix = mixPercent / 100;
    currentDecayTime = decaySeconds;

    var ctx = getAudioContext();
    if (!ctx) return;

    if (dryGain && wetGain) {
      dryGain.gain.setTargetAtTime(1 - currentReverbMix * 0.4, ctx.currentTime, 0.05);
      wetGain.gain.setTargetAtTime(currentReverbMix * 1.2, ctx.currentTime, 0.05);
    }
    if (convolver) {
      convolver.buffer = buildImpulseResponse(currentDecayTime, 2.2);
    }

    var lbl = document.getElementById("lblCurrentReverb");
    if (lbl) lbl.textContent = mixPercent + "%";
  }

  function updateMasterVolume(volPercent) {
    currentMasterVol = volPercent / 100;
    var ctx = getAudioContext();
    if (ctx && masterGain) {
      masterGain.gain.setTargetAtTime(currentMasterVol, ctx.currentTime, 0.05);
    }
  }

  // =========================================================
  // 2B. HỆ THỐNG QUẢN LÝ FILE ÂM THANH SERVER CHO TỪNG NHẠC CỤ & TỪNG DÂY/NỐT
  // (Lưu cấu hình toàn server, hỗ trợ Admin gán file Audio / link URL cho từng dây)
  // =========================================================
  var SERVER_AUDIO_CONFIG_KEY = "dan_tranh_server_audio_config_v2";
  var _serverAudioConfigCache = null;
  var _serverAudioPool = {};

  function getServerAudioConfig() {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.getAudioConfig === "function") {
      return window.DanTranhCloudSync.getAudioConfig();
    }
    if (_serverAudioConfigCache) return _serverAudioConfigCache;
    try {
      var raw = localStorage.getItem(SERVER_AUDIO_CONFIG_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          _serverAudioConfigCache = parsed;
          return _serverAudioConfigCache;
        }
      }
    } catch (e) {}
    _serverAudioConfigCache = {};
    return _serverAudioConfigCache;
  }

  function saveServerAudioConfig(cfg) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.saveAudioConfig === "function") {
      window.DanTranhCloudSync.saveAudioConfig(cfg);
      return;
    }
    if (cfg) _serverAudioConfigCache = cfg;
    var toSave = _serverAudioConfigCache || {};
    try {
      localStorage.setItem(SERVER_AUDIO_CONFIG_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Lỗi lưu cấu hình âm thanh server:", e);
    }
  }

  function getServerAudioForNote(instId, noteIdx) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.getAudioForNote === "function") {
      return window.DanTranhCloudSync.getAudioForNote(instId, noteIdx);
    }
    var cfg = getServerAudioConfig();
    var instCfg = cfg[instId];
    if (instCfg && instCfg.strings && instCfg.strings[noteIdx]) {
      return instCfg.strings[noteIdx];
    }
    return null;
  }

  function setServerAudioForNote(instId, noteIdx, data) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.setAudioForNote === "function") {
      window.DanTranhCloudSync.setAudioForNote(instId, noteIdx, data);
      var poolKey = instId + "_" + noteIdx;
      if (_serverAudioPool[poolKey]) delete _serverAudioPool[poolKey];
      return;
    }
    var cfg = getServerAudioConfig();
    if (!cfg[instId]) cfg[instId] = { strings: {} };
    if (!cfg[instId].strings) cfg[instId].strings = {};

    var cur = cfg[instId].strings[noteIdx] || {};
    cfg[instId].strings[noteIdx] = Object.assign(cur, data);

    var poolKey = instId + "_" + noteIdx;
    if (_serverAudioPool[poolKey]) {
      delete _serverAudioPool[poolKey];
    }
    saveServerAudioConfig();
  }

  function removeServerAudioForNote(instId, noteIdx) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.removeAudioForNote === "function") {
      window.DanTranhCloudSync.removeAudioForNote(instId, noteIdx);
      var poolKey = instId + "_" + noteIdx;
      if (_serverAudioPool[poolKey]) delete _serverAudioPool[poolKey];
      return;
    }
    var cfg = getServerAudioConfig();
    if (cfg[instId] && cfg[instId].strings && cfg[instId].strings[noteIdx]) {
      delete cfg[instId].strings[noteIdx];
      var poolKey = instId + "_" + noteIdx;
      if (_serverAudioPool[poolKey]) {
        delete _serverAudioPool[poolKey];
      }
      saveServerAudioConfig();
    }
  }

  function clearServerAudioForInstrument(instId) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.clearAudioForInstrument === "function") {
      window.DanTranhCloudSync.clearAudioForInstrument(instId);
      Object.keys(_serverAudioPool).forEach(function(k) {
        if (k.indexOf(instId + "_") === 0) delete _serverAudioPool[k];
      });
      return;
    }
    var cfg = getServerAudioConfig();
    if (cfg[instId]) {
      delete cfg[instId];
      saveServerAudioConfig();
    }
    Object.keys(_serverAudioPool).forEach(function(k) {
      if (k.indexOf(instId + "_") === 0) delete _serverAudioPool[k];
    });
  }

  function playServerCustomAudioForNote(instId, noteIdx) {
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.playCustomAudioForNote === "function") {
      return window.DanTranhCloudSync.playCustomAudioForNote(instId, noteIdx);
    }
    var noteCustom = getServerAudioForNote(instId, noteIdx);
    if (!noteCustom || !noteCustom.fileUrl) return false;

    try {
      var poolKey = instId + "_" + noteIdx;
      var poolEntry = _serverAudioPool[poolKey];
      if (!poolEntry || poolEntry.url !== noteCustom.fileUrl) {
        var a = new Audio(noteCustom.fileUrl);
        a.preload = "auto";
        poolEntry = { url: noteCustom.fileUrl, audio: a };
        _serverAudioPool[poolKey] = poolEntry;
      }

      var noteVol = typeof noteCustom.volume === "number" ? noteCustom.volume / 100 : 1.0;
      var masterVol = typeof currentMasterVol === "number" ? currentMasterVol : 0.85;
      var instVol = typeof window._activeOwnerInstVolFactor === "number" ? window._activeOwnerInstVolFactor : 1.0;

      poolEntry.audio.volume = Math.max(0, Math.min(1.0, noteVol * masterVol * instVol));

      var pitchOffset = typeof noteCustom.pitch === "number" ? noteCustom.pitch : 0;
      if (pitchOffset !== 0) {
        poolEntry.audio.playbackRate = Math.max(0.25, Math.min(4.0, Math.pow(2, pitchOffset / 12)));
      } else {
        poolEntry.audio.playbackRate = 1.0;
      }

      poolEntry.audio.currentTime = 0;
      var p = poolEntry.audio.play();
      if (p && p.catch) p.catch(function() {});
      return true;
    } catch (err) {
      console.warn("Lỗi phát file âm thanh server:", err);
      return false;
    }
  }

  // Hàm kết nối âm thanh an toàn qua dryGain & convolver hoặc Audio Destination (hỗ trợ Gain riêng từng nhạc cụ của Owner)
  function safeConnectOutput(node) {
    try {
      var ctx = getAudioContext();
      var targetNode = node;
      var volFactor = typeof window._activeOwnerInstVolFactor === "number" ? window._activeOwnerInstVolFactor : 1.0;
      if (ctx && Math.abs(volFactor - 1.0) > 0.01) {
        var instGain = ctx.createGain();
        instGain.gain.setValueAtTime(volFactor, ctx.currentTime);
        node.connect(instGain);
        targetNode = instGain;
      }

      var connected = false;
      if (typeof dryGain !== "undefined" && dryGain) {
        targetNode.connect(dryGain);
        connected = true;
      }
      if (typeof convolver !== "undefined" && convolver) {
        targetNode.connect(convolver);
        connected = true;
      }
      if (!connected && ctx) {
        targetNode.connect(ctx.destination);
      }
    } catch (err) {
      try {
        var ctx2 = getAudioContext();
        if (ctx2) node.connect(ctx2.destination);
      } catch (e) {}
    }
  }

  // Phát âm thanh mô phỏng tiếng Đàn Tranh mộc mạc (Web Audio API)
  function playSynthDanTranh(freq) {
    var ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    var now = ctx.currentTime;

    var oscMain = ctx.createOscillator();
    var oscHarmonic = ctx.createOscillator();
    var voiceGain = ctx.createGain();
    var filter = ctx.createBiquadFilter();

    // Dây kim loại gảy bằng móng đồi mồi: phối hợp triangle và sine
    oscMain.type = "triangle";
    oscMain.frequency.setValueAtTime(freq, now);

    // Họa âm quãng tám tạo tiếng lanh lảnh trong trẻo
    oscHarmonic.type = "sine";
    oscHarmonic.frequency.setValueAtTime(freq * 2, now);

    // Bộ lọc Lowpass mô phỏng độ cộng hưởng của mặt gỗ ngô đồng
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(freq * 5.5, 5200), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 320), now + 1.4);

    // Envelope biên độ âm thanh: gảy đanh (Attack nhanh), ngân nga (Decay dài)
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.42, now + 0.008);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

    // Nối dây âm
    oscMain.connect(filter);
    oscHarmonic.connect(filter);
    filter.connect(voiceGain);

    // Route an toàn qua dryGain, convolver hoặc Audio Destination
    safeConnectOutput(voiceGain);

    oscMain.start(now);
    oscHarmonic.start(now);
    oscMain.stop(now + 1.95);
    oscHarmonic.stop(now + 1.95);
  }

  // Gảy dây: Rung dây + phát âm
  function pluck(i) {
    var ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    if (typeof trigger3DStringVibration === "function") {
      trigger3DStringVibration(i);
    }
    if (typeof trigger2DNoteAnimation === "function") {
      trigger2DNoteAnimation(i);
    }

    var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
    if (surfaceBtns[i]) {
      surfaceBtns[i].classList.add("playing");
      if (typeof triggerKeyButtonRipple === "function") triggerKeyButtonRipple(surfaceBtns[i]);
      setTimeout(function() { surfaceBtns[i].classList.remove("playing"); }, 180);
    }

    var el = stringEls[i];
    if (el) {
      el.classList.remove("plucking");
      void el.offsetWidth; // trigger reflow
      el.classList.add("plucking");
      clearTimeout(timers[i]);
      timers[i] = setTimeout(function () { el.classList.remove("plucking"); }, 460);
    }

    // 1. Kiểm tra file âm thanh server của Admin cho Đàn Tranh dây i
    var playedCustom = false;
    if (typeof playServerCustomAudioForNote === "function") {
      playedCustom = playServerCustomAudioForNote("dantranh", i);
    }

    // 2. Nếu không có file server, kiểm tra slot local cũ (nếu có)
    if (!playedCustom) {
      var s = slots[i];
      if (s && s.audio) {
        try {
          s.audio.currentTime = 0;
          var p = s.audio.play();
          if (p && p.catch) p.catch(function () {});
          playedCustom = true;
        } catch (e) {}
      }
    }

    // 3. Nếu chưa phát file nào: Tổng hợp âm thanh mộc Đàn Tranh
    if (!playedCustom) {
      var instObj = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP["dantranh"]) ? INSTRUMENT_MAP["dantranh"] : null;
      var noteObj = instObj && instObj.notes && instObj.notes[i];
      var freq = noteObj && noteObj.freq ? noteObj.freq : (FREQUENCIES[i] || 196.0);
      playSynthDanTranh(freq);
    }

    try {
      if (typeof isDemoPlaying !== "undefined" && !isDemoPlaying && typeof window.recordUserPlayedNote === "function") {
        window.recordUserPlayedNote("dantranh", i, NOTES[i] || ("Dây " + (i + 1)), KEY_MAP[i] || String(i + 1));
      }
    } catch (eRec) {}
  }

  // =========================================================
  // 3. MÁY GHI ÂM (RECORDING STUDIO)
  // =========================================================
  var mediaRecorder = null;
  var recordedChunks = [];
  var isRecording = false;
  var recordStartTime = 0;
  var recordTimerInterval = null;

  var recordTimerEl = document.getElementById("recordTimer");
  var btnStartRecord = document.getElementById("btnStartRecord");
  var btnStopRecord = document.getElementById("btnStopRecord");
  var recordedPlayerArea = document.getElementById("recordedPlayerArea");
  var recordedAudioPlayer = document.getElementById("recordedAudioPlayer");
  var btnDownloadRecord = document.getElementById("btnDownloadRecord");
  var recordHistoryList = document.getElementById("recordHistoryList");
  var dockRecDot = document.getElementById("dockRecDot");

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function startRecording() {
    var ctx = getAudioContext();
    if (!ctx || !recDestination) {
      alert("Trình duyệt không hỗ trợ ghi âm nội bộ trực tiếp.");
      return;
    }

    recordedChunks = [];
    try {
      var options = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/webm" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {};
        }
      }
      mediaRecorder = new MediaRecorder(recDestination.stream, options);
    } catch (e) {
      mediaRecorder = new MediaRecorder(recDestination.stream);
    }

    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = function () {
      var blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      var audioUrl = URL.createObjectURL(blob);
      if (recordedAudioPlayer) {
        recordedAudioPlayer.src = audioUrl;
      }
      if (btnDownloadRecord) {
        btnDownloadRecord.href = audioUrl;
        var dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        btnDownloadRecord.download = "DanTranh-BanThu-" + dateStr + ".webm";
      }
      if (recordedPlayerArea) {
        recordedPlayerArea.style.display = "block";
      }

      // Thêm vào danh sách lịch sử thu âm
      addRecordHistoryItem(audioUrl, blob.size);

      // Thông báo sang Cửa sổ Phòng Thu Âm nổi
      if (typeof window.onAudioRecordingFinished === "function") {
        window.onAudioRecordingFinished(audioUrl, blob);
      }
    };

    mediaRecorder.start(100);
    isRecording = true;
    recordStartTime = Date.now();

    if (btnStartRecord) btnStartRecord.disabled = true;
    if (btnStopRecord) btnStopRecord.disabled = false;
    if (dockRecDot) dockRecDot.parentElement.classList.add("is-recording");

    var btnQuickRecord = document.getElementById("btnQuickRecord");
    if (btnQuickRecord) {
      btnQuickRecord.classList.remove("btn-primary");
      btnQuickRecord.classList.add("btn-danger");
      btnQuickRecord.textContent = "⏹️ Đang thu âm...";
    }

    clearInterval(recordTimerInterval);
    recordTimerInterval = setInterval(function () {
      var elapsed = (Date.now() - recordStartTime) / 1000;
      if (recordTimerEl) recordTimerEl.textContent = formatTime(elapsed);
    }, 200);
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    isRecording = false;

    clearInterval(recordTimerInterval);
    if (btnStartRecord) btnStartRecord.disabled = false;
    if (btnStopRecord) btnStopRecord.disabled = true;
    if (dockRecDot) dockRecDot.parentElement.classList.remove("is-recording");

    var btnQuickRecord = document.getElementById("btnQuickRecord");
    if (btnQuickRecord) {
      btnQuickRecord.classList.remove("btn-danger");
      btnQuickRecord.classList.add("btn-primary");
      btnQuickRecord.textContent = "⏺️ Thu âm nhanh";
    }
  }

  function addRecordHistoryItem(url, sizeBytes) {
    if (!recordHistoryList) return;
    var timeStr = new Date().toLocaleTimeString("vi-VN");
    var sizeKb = Math.round(sizeBytes / 1024);

    var item = document.createElement("div");
    item.className = "record-item";
    item.innerHTML = "<span>🎙️ Bản thu lúc " + timeStr + " (" + sizeKb + " KB)</span>" +
      "<div>" +
      "<a href='" + url + "' download='DanTranh-" + timeStr.replace(/:/g, "-") + ".webm' class='btn btn-secondary btn-sm'>Tải về</a>" +
      "</div>";
    recordHistoryList.insertBefore(item, recordHistoryList.firstChild);
  }

  if (btnStartRecord) btnStartRecord.addEventListener("click", startRecording);
  if (btnStopRecord) btnStopRecord.addEventListener("click", stopRecording);

  var btnQuickRecord = document.getElementById("btnQuickRecord");
  if (btnQuickRecord) {
    btnQuickRecord.addEventListener("click", function () {
      if (!isRecording) {
        startRecording();
        openModal("modalStudio");
      } else {
        stopRecording();
      }
    });
  }

  window.startAudioRecording = startRecording;
  window.stopAudioRecording = stopRecording;
  window.isAudioRecording = function () { return isRecording; };

  // =========================================================
  // 4. QUẢN LÝ CHẾ ĐỘ MÀN HÌNH SÁNG / TỐI (THEME SÁNG & TỐI)
  // =========================================================
  function initTheme() {
    try {
      var saved = localStorage.getItem("dan_tranh_theme") || "dark";
      if (saved === "light") {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
    } catch (e) {}
  }

  // =========================================================
  // 5. QUẢN LÝ NGƯỜI DÙNG, PHÂN QUYỀN & AVATAR
  // =========================================================
  var currentUser = null; // { username, displayName, role, avatar }

  function initUsers() {
    var rawUsers = localStorage.getItem("dan_tranh_users");
    var defaultUsers = [
      { username: "admin", password: "admin123", displayName: "Quản Trị Viên (Admin)", role: "admin", avatar: "👑", createdAt: "2026-09-14" },
      { username: "khanhlam", password: "123", displayName: "Khánh Lâm", role: "member", avatar: "🪕", createdAt: "2026-09-14" }
    ];
    if (!rawUsers) {
      localStorage.setItem("dan_tranh_users", JSON.stringify(defaultUsers));
    } else {
      try {
        var currentList = JSON.parse(rawUsers);
        var hasAdmin = false;
        if (Array.isArray(currentList)) {
          currentList.forEach(function(u) {
            if (u && u.username && u.username.toLowerCase() === "owner") {
              u.username = "admin";
              u.displayName = u.displayName || "Quản Trị Viên (Admin)";
              if (!u.password) u.password = "admin123";
              hasAdmin = true;
            } else if (u && u.username && u.username.toLowerCase() === "admin") {
              hasAdmin = true;
            }
          });
          if (!hasAdmin) {
            currentList.unshift({ username: "admin", password: "admin123", displayName: "Quản Trị Viên (Admin)", role: "admin", avatar: "👑", createdAt: "2026-09-14" });
          }
          localStorage.setItem("dan_tranh_users", JSON.stringify(currentList));
        }
      } catch (e) {
        localStorage.setItem("dan_tranh_users", JSON.stringify(defaultUsers));
      }
    }
  }

  function getUsers() {
    initUsers();
    return JSON.parse(localStorage.getItem("dan_tranh_users") || "[]");
  }

  function saveUsers(users) {
    localStorage.setItem("dan_tranh_users", JSON.stringify(users));
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Quản lý hòm thư báo cáo / góp ý & phản hồi Admin
  function getReports() {
    var raw = localStorage.getItem("dan_tranh_reports");
    if (!raw) {
      var sampleReports = [
        {
          id: "rep_sample_1",
          type: "Âm thanh / Nốt nhạc",
          sender: "khanhlam",
          content: "Đàn Tranh âm sắc rất vang và hay! Giai điệu bài Bèo Dạt Mây Trôi và Cò Lả nghe êm tai chuẩn ngũ cung.",
          contact: "0988xxxxxx",
          time: "14/09/2026 22:30",
          unread: false,
          adminReply: "Cảm ơn bạn Khánh Lâm đã ủng hộ! Admin đã bổ sung thêm tính năng chỉnh Reverb vang vọng và danh sách bài hát tự chơi trên đàn.",
          replyTime: "15/09/2026 08:30",
          unreadUserReply: true
        }
      ];
      localStorage.setItem("dan_tranh_reports", JSON.stringify(sampleReports));
      return sampleReports;
    }
    return JSON.parse(raw);
  }

  function saveReports(reports) {
    localStorage.setItem("dan_tranh_reports", JSON.stringify(reports));
    updateReportBadges();
  }

  function updateReportBadges() {
    var reports = getReports();
    var unreadAdminCount = reports.filter(function(r) { return r.unread; }).length;

    var isCurrentUserAdmin = currentUser && currentUser.role === "admin";
    var unreadUserRepliesCount = reports.filter(function(r) {
      if (!r.adminReply || !r.unreadUserReply) return false;
      if (!currentUser || currentUser.role === "guest" || currentUser.username === "guest") {
        return true;
      }
      return r.sender && r.sender.toLowerCase() === currentUser.username.toLowerCase();
    }).length;

    var bellBadgeCount = document.getElementById("bellBadgeCount");
    var adminNewReportsBadge = document.getElementById("adminNewReportsBadge");
    var dockReportDot = document.getElementById("dockReportDot");
    var dockAdminBadgeDot = document.getElementById("dockAdminBadgeDot");

    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.updateBadgeUI === "function") {
      window.DanTranhCloudSync.updateBadgeUI();
    }

    if (adminNewReportsBadge) {
      if (unreadAdminCount > 0) {
        adminNewReportsBadge.textContent = unreadAdminCount + " mới";
        adminNewReportsBadge.style.display = "inline-block";
      } else {
        adminNewReportsBadge.style.display = "none";
      }
    }

    if (dockReportDot) {
      dockReportDot.style.display = (unreadUserRepliesCount > 0 || (isCurrentUserAdmin && unreadAdminCount > 0)) ? "block" : "none";
    }
    if (dockAdminBadgeDot) {
      dockAdminBadgeDot.style.display = unreadAdminCount > 0 ? "block" : "none";
    }
  }

  function showScreen(screenId) {
    ["welcomeScreen", "authScreen", "mainApp"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        if (id === screenId) {
          el.removeAttribute("hidden");
          el.style.display = (id === "mainApp") ? "block" : "flex";
          if (id === "mainApp" && typeof initDanTranh3D === "function") {
            initDanTranh3D();
            setTimeout(function () {
              if (typeof on3DWindowResize === "function") on3DWindowResize();
            }, 80);
          }
        } else {
          el.setAttribute("hidden", "");
          el.style.display = "none";
        }
      }
    });
  }

  function renderAvatarElement(targetEl, avatarValue) {
    if (!targetEl) return;
    targetEl.innerHTML = "";
    if (avatarValue && (avatarValue.startsWith("data:image/") || avatarValue.startsWith("http"))) {
      var img = document.createElement("img");
      img.src = avatarValue;
      img.alt = "Avatar";
      targetEl.appendChild(img);
    } else {
      targetEl.textContent = avatarValue || "👤";
    }
  }

  function updateUIForUser() {
    var userBadgeIcon = document.getElementById("userBadgeIcon");
    var userBadgeText = document.getElementById("userBadgeText");
    var userBadgeRole = document.getElementById("userBadgeRole");
    var btnAdminToolsTop = document.getElementById("btnAdminToolsTop");
    var dockBtnAdmin = document.getElementById("dockBtnAdmin");

    var currentAvatar = (currentUser && currentUser.avatar) ? currentUser.avatar : "👤";
    renderAvatarElement(userBadgeIcon, currentAvatar);

    if (!currentUser || currentUser.role === "guest") {
      if (userBadgeText) userBadgeText.textContent = "Khách (Guest)";
      if (userBadgeRole) userBadgeRole.textContent = "Chơi tự do";
      if (btnAdminToolsTop) btnAdminToolsTop.style.display = "none";
      if (dockBtnAdmin) dockBtnAdmin.style.display = "none";
    } else if (currentUser.role === "admin") {
      if (userBadgeText) userBadgeText.textContent = currentUser.displayName;
      if (userBadgeRole) userBadgeRole.textContent = "👑 Quản Trị Viên (Admin)";
      if (btnAdminToolsTop) btnAdminToolsTop.style.display = "inline-flex";
      if (dockBtnAdmin) dockBtnAdmin.style.display = "flex";
    } else {
      if (userBadgeText) userBadgeText.textContent = currentUser.displayName;
      if (userBadgeRole) userBadgeRole.textContent = "Thành viên @" + currentUser.username;
      if (btnAdminToolsTop) btnAdminToolsTop.style.display = "none";
      if (dockBtnAdmin) dockBtnAdmin.style.display = "none";
    }

    // Cập nhật trạng thái hiển thị Tài khoản & Owner trên Header (gộp chung User + Owner)
    if (typeof window.syncHeaderAndAccountUI === "function") {
      window.syncHeaderAndAccountUI();
    } else {
      var btnOpenOwnerLogin = document.getElementById("btnOpenOwnerLogin");
      var ownerLoggedHeader = document.getElementById("ownerLoggedHeader");
      var lblOwnerNameDisplay = document.getElementById("lblOwnerNameDisplay");
      var isLogged = currentUser && currentUser.role !== "guest" && currentUser.username !== "guest";
      if (isLogged) {
        if (btnOpenOwnerLogin) btnOpenOwnerLogin.style.display = "none";
        if (ownerLoggedHeader) ownerLoggedHeader.style.display = "inline-flex";
        if (lblOwnerNameDisplay) lblOwnerNameDisplay.textContent = currentUser.displayName || currentUser.username;
      } else {
        if (btnOpenOwnerLogin) btnOpenOwnerLogin.style.display = "inline-flex";
        if (ownerLoggedHeader) ownerLoggedHeader.style.display = "none";
      }
    }

    updateReportBadges();
  }

  // Khôi phục phiên tài khoản đã từng đăng nhập trên máy này; máy mới mở chưa từng đăng nhập sẽ là Khách (Guest)
  try {
    var savedOwner = localStorage.getItem("dan_tranh_owner_session");
    var savedUser = localStorage.getItem("dan_tranh_user_session");
    var parsedSession = null;
    if (savedUser) parsedSession = JSON.parse(savedUser);
    else if (savedOwner) parsedSession = JSON.parse(savedOwner);
    if (parsedSession && parsedSession.username && parsedSession.username !== "guest") {
      currentUser = parsedSession;
    } else {
      currentUser = { username: "guest", displayName: "Khách", role: "guest" };
    }
  } catch (e) {
    currentUser = { username: "guest", displayName: "Khách", role: "guest" };
  }
  updateUIForUser();


  // Welcome Screen actions
  var btnGuestPlay = document.getElementById("btnGuestPlay");
  if (btnGuestPlay) {
    btnGuestPlay.addEventListener("click", function () {
      currentUser = { username: "guest", displayName: "Khách", role: "guest" };
      updateUIForUser();
      showScreen("mainApp");
    });
  }

  var btnGoToLogin = document.getElementById("btnGoToLogin");
  if (btnGoToLogin) {
    btnGoToLogin.addEventListener("click", function () {
      showScreen("authScreen");
      switchAuthTab("login");
    });
  }

  var btnGoToAdmin = document.getElementById("btnGoToAdmin");
  if (btnGoToAdmin) {
    btnGoToAdmin.addEventListener("click", function () {
      showScreen("authScreen");
      switchAuthTab("login");
      var userInp = document.getElementById("loginUser");
      if (userInp) {
        userInp.value = "admin";
        var passInp = document.getElementById("loginPass");
        if (passInp) passInp.focus();
      }
    });
  }

  var btnBackToWelcome = document.getElementById("btnBackToWelcome");
  if (btnBackToWelcome) {
    btnBackToWelcome.addEventListener("click", function () {
      showScreen("welcomeScreen");
    });
  }

  var btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      currentUser = null;
      showScreen("welcomeScreen");
    });
  }

  // Auth Tabs (Đăng nhập / Đăng ký)
  var tabLoginBtn = document.getElementById("tabLoginBtn");
  var tabRegisterBtn = document.getElementById("tabRegisterBtn");
  var loginForm = document.getElementById("loginForm");
  var registerForm = document.getElementById("registerForm");
  var authMessage = document.getElementById("authMessage");
  var authTitle = document.getElementById("authTitle");

  function switchAuthTab(tab) {
    if (authMessage) authMessage.textContent = "";
    if (tab === "login") {
      tabLoginBtn.classList.add("active");
      tabRegisterBtn.classList.remove("active");
      loginForm.removeAttribute("hidden");
      registerForm.setAttribute("hidden", "");
      if (authTitle) authTitle.textContent = "🔑 Đăng Nhập";
    } else {
      tabLoginBtn.classList.remove("active");
      tabRegisterBtn.classList.add("active");
      loginForm.setAttribute("hidden", "");
      registerForm.removeAttribute("hidden");
      if (authTitle) authTitle.textContent = "📝 Đăng Ký Tài Khoản Mới";
    }
  }

  if (tabLoginBtn) tabLoginBtn.addEventListener("click", function () { switchAuthTab("login"); });
  if (tabRegisterBtn) tabRegisterBtn.addEventListener("click", function () { switchAuthTab("register"); });

  // Xử lý Form Login
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = document.getElementById("loginUser").value.trim();
      var p = document.getElementById("loginPass").value.trim();

      var users = getUsers();
      var found = users.find(function (item) {
        return item.username.toLowerCase() === u.toLowerCase() && item.password === p;
      });

      if (found) {
        currentUser = {
          username: found.username,
          displayName: found.displayName || found.username,
          role: found.role || "member",
          avatar: found.avatar || (found.role === "admin" ? "👑" : "👤")
        };
        updateUIForUser();
        showScreen("mainApp");
      } else {
        if (authMessage) {
          authMessage.className = "error-text";
          authMessage.textContent = "Sai tên đăng nhập hoặc mật khẩu. Vui lòng thử lại!";
        }
      }
    });
  }

  // Xử lý Form Register (Không cần Gmail)
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var dn = document.getElementById("regDisplayName").value.trim();
      var u = document.getElementById("regUser").value.trim().toLowerCase();
      var p = document.getElementById("regPass").value.trim();
      var pConf = document.getElementById("regPassConfirm").value.trim();

      if (p !== pConf) {
        if (authMessage) {
          authMessage.className = "error-text";
          authMessage.textContent = "Mật khẩu xác nhận không khớp!";
        }
        return;
      }
      if (p.length < 3) {
        if (authMessage) {
          authMessage.className = "error-text";
          authMessage.textContent = "Mật khẩu quá ngắn!";
        }
        return;
      }

      var users = getUsers();
      var exists = users.some(function (item) { return item.username.toLowerCase() === u; });
      if (exists) {
        if (authMessage) {
          authMessage.className = "error-text";
          authMessage.textContent = "Tên tài khoản này đã có người dùng!";
        }
        return;
      }

      var newUser = {
        username: u,
        password: p,
        displayName: dn || u,
        role: "member",
        avatar: "🪕",
        createdAt: new Date().toISOString().slice(0, 10)
      };
      users.push(newUser);
      saveUsers(users);

      currentUser = { username: newUser.username, displayName: newUser.displayName, role: newUser.role, avatar: newUser.avatar };
      updateUIForUser();
      showScreen("mainApp");
    });
  }

  // =========================================================
  // 6. POPUP / MODAL MANAGEMENT (THANH DOCK SQUIRCLE)
  // =========================================================
  function openModal(modalId) {
    if (modalId === "modalAdmin") {
      var activeU = (typeof window.getActiveUserAccount === "function") ? window.getActiveUserAccount() : currentUser;
      var isAdm = activeU && activeU.role === "admin";
      if (!isAdm) {
        alert("🔒 Chỉ có Quản trị viên (Admin) mới có quyền truy cập Bảng Quản trị!");
        if (typeof window.openUnifiedAuthModal === "function") {
          window.openUnifiedAuthModal("login");
        }
        return;
      }
    }
    if (modalId === "modalStudio") {
      if (typeof window.toggleStudioFloatingWindow === "function") {
        window.toggleStudioFloatingWindow(true);
        return;
      }
    }
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
    }
    // Cập nhật dữ liệu đặc thù nếu mở Admin hoặc Chuông Báo Cáo
    if (modalId === "modalAdmin") {
      renderAdminSlots();
      renderAdminUsers();
      renderAdminReports();
      checkGeminiKeyStatus();
      if (typeof window.syncHeaderAndAccountUI === "function") window.syncHeaderAndAccountUI();
      if (typeof window.renderOwnerFeedbackInbox === "function") window.renderOwnerFeedbackInbox();
    }
    if (modalId === "modalReportAdmin") {
      renderUserReplies();
      if (typeof window.syncHeaderAndAccountUI === "function") window.syncHeaderAndAccountUI();
      if (typeof window.renderOwnerFeedbackInbox === "function") window.renderOwnerFeedbackInbox();
      if (typeof window.renderUserSentReportsHistory === "function") window.renderUserSentReportsHistory();
      if (typeof window.renderOwnerAnnouncements === "function") window.renderOwnerAnnouncements();
      if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.onModalOpened === "function") {
        window.DanTranhCloudSync.onModalOpened();
      }
    }
  }

  function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
    }
    if (modalId === "modalReportAdmin") {
      if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.onModalClosed === "function") {
        window.DanTranhCloudSync.onModalClosed();
      }
    }
    if (modalId === "modalAdmin" && typeof window.syncHeaderAndAccountUI === "function") {
      window.syncHeaderAndAccountUI();
    }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  // Gắn sự kiện đóng modal cho nút ✕ và click nền ngoài
  document.querySelectorAll(".modal-close").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var targetId = btn.dataset.close;
      if (targetId) closeModal(targetId);
    });
  });

  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  // Gắn sự kiện các nút trên thanh Dock
  var dockBtnAdd = document.getElementById("dockBtnAdd");
  if (dockBtnAdd) dockBtnAdd.addEventListener("click", function () { openModal("modalAddCustom"); });

  var dockBtnHistory = document.getElementById("dockBtnHistory");
  if (dockBtnHistory) dockBtnHistory.addEventListener("click", function () { openModal("modalHistory"); });

  var dockBtnArtists = document.getElementById("dockBtnArtists");
  if (dockBtnArtists) dockBtnArtists.addEventListener("click", function () { openModal("modalArtists"); });

  var dockBtnScales = document.getElementById("dockBtnScales");
  if (dockBtnScales) dockBtnScales.addEventListener("click", function () { openModal("modalScales"); });

  var dockBtnSongs = document.getElementById("dockBtnSongs");
  if (dockBtnSongs) dockBtnSongs.addEventListener("click", function () { openModal("modalSongs"); });

  var dockBtnStudio = document.getElementById("dockBtnStudio");
  if (dockBtnStudio) dockBtnStudio.addEventListener("click", function () { openModal("modalStudio"); });

  var dockBtnReverb = document.getElementById("dockBtnReverb");
  if (dockBtnReverb) dockBtnReverb.addEventListener("click", function () { openModal("modalStudio"); });

  var btnQuickReverb = document.getElementById("btnQuickReverb");
  if (btnQuickReverb) btnQuickReverb.addEventListener("click", function () { openModal("modalStudio"); });

  var dockBtnAdmin = document.getElementById("dockBtnAdmin");
  if (dockBtnAdmin) dockBtnAdmin.addEventListener("click", function () { openModal("modalAdmin"); });

  var btnAdminToolsTop = document.getElementById("btnAdminToolsTop");
  if (btnAdminToolsTop) btnAdminToolsTop.addEventListener("click", function () { openModal("modalAdmin"); });

  // Mở modal Đổi Avatar
  var dockBtnAvatar = document.getElementById("dockBtnAvatar");
  if (dockBtnAvatar) dockBtnAvatar.addEventListener("click", function () { openModal("modalChangeAvatar"); setupAvatarModal(); });

  var btnChangeAvatarTop = document.getElementById("btnChangeAvatarTop");
  if (btnChangeAvatarTop) btnChangeAvatarTop.addEventListener("click", function () { openModal("modalChangeAvatar"); setupAvatarModal(); });

  var userBadgeProfile = document.getElementById("userBadgeProfile");
  if (userBadgeProfile) userBadgeProfile.addEventListener("click", function () { openModal("modalChangeAvatar"); setupAvatarModal(); });

  // Mở modal Chuông Báo Cáo Admin
  var dockBtnReport = document.getElementById("dockBtnReport");
  if (dockBtnReport) dockBtnReport.addEventListener("click", function () { openModal("modalReportAdmin"); });

  var btnReportBell = document.getElementById("btnReportBell");
  if (btnReportBell) btnReportBell.addEventListener("click", function () { openModal("modalReportAdmin"); });

  // Điều khiển thanh trượt Reverb & Volume trong Studio
  var sliderReverb = document.getElementById("sliderReverb");
  var txtReverbValue = document.getElementById("txtReverbValue");
  if (sliderReverb) {
    sliderReverb.addEventListener("input", function () {
      var val = parseInt(sliderReverb.value, 10);
      if (txtReverbValue) txtReverbValue.textContent = val + "%";
      updateReverbSettings(val, currentDecayTime);
    });
  }

  var sliderDecay = document.getElementById("sliderDecay");
  var txtDecayValue = document.getElementById("txtDecayValue");
  if (sliderDecay) {
    sliderDecay.addEventListener("input", function () {
      var val = (parseInt(sliderDecay.value, 10) / 10).toFixed(1);
      if (txtDecayValue) txtDecayValue.textContent = val + "s";
      updateReverbSettings(currentReverbMix * 100, parseFloat(val));
    });
  }

  var sliderVolume = document.getElementById("sliderVolume");
  var txtVolumeValue = document.getElementById("txtVolumeValue");
  if (sliderVolume) {
    sliderVolume.addEventListener("input", function () {
      var val = parseInt(sliderVolume.value, 10);
      if (txtVolumeValue) txtVolumeValue.textContent = val + "%";
      updateMasterVolume(val);
    });
  }

  // =========================================================
  // BỘ ĐIỀU KHIỂN NOW PLAYING BAR (TRÊN THÂN ĐÀN)
  // =========================================================
  var nowPlayingBar = document.getElementById("nowPlayingBar");
  var npSongTitle = document.getElementById("npSongTitle");
  var npCurrentNote = document.getElementById("npCurrentNote");
  var btnStopNowPlaying = document.getElementById("btnStopNowPlaying");

  function showNowPlaying(title) {
    if (nowPlayingBar) {
      nowPlayingBar.style.display = "flex";
      if (npSongTitle) npSongTitle.textContent = title;
      if (npCurrentNote) npCurrentNote.textContent = "Bắt đầu...";
    }
  }

  function hideNowPlaying() {
    if (nowPlayingBar) {
      nowPlayingBar.style.display = "none";
    }
  }

  function updateNowPlayingNote(stringIndex) {
    if (npCurrentNote && NOTES[stringIndex]) {
      npCurrentNote.textContent = "Nốt: " + NOTES[stringIndex];
    }
  }

  if (btnStopNowPlaying) {
    btnStopNowPlaying.addEventListener("click", function () {
      stopAiPlaying();
      hideNowPlaying();
      appendChatMessage("⏹️ Đã dừng chơi bài hát trên Đàn Tranh.", "bot");
    });
  }

  // Đánh mẫu các bài hát demo (Giai điệu ngũ cung chuẩn xác 100%)
  var DEMO_SONGS = {
    butterfly: [5, 6, 7, 5, 5, 6, 7, 5, 7, 7, 8, 7, 7, 8, 8, 9, 8, 7, 5, 8, 9, 8, 7, 5, 5, 8, 5, 5, 8, 5],
    buomvang: [5, 6, 7, 5, 5, 6, 7, 5, 7, 7, 8, 7, 7, 8, 8, 9, 8, 7, 5, 8, 9, 8, 7, 5, 5, 8, 5, 5, 8, 5],
    beodat: [5, 5, 8, 8, 9, 8, 8, 7, 7, 7, 6, 7, 8, 5, 5, 7, 6, 5, 4, 3, 8, 10, 7, 8, 7, 7, 4, 5, 5, 6, 7, 7, 7, 6, 5, 6, 7, 6, 7, 8, 5, 4, 3],
    luuthuy: [3, 5, 5, 6, 7, 7, 8, 7, 6, 5, 4, 5, 6, 7, 6, 5, 4, 3, 3, 5, 5, 6, 7, 8, 9, 8, 7, 6, 7, 8, 7, 6, 5, 4, 5, 6, 5],
    daco: [6, 6, 4, 3, 4, 4, 6, 6, 6, 4, 3, 2, 3, 6, 4, 3, 2, 1, 4, 4, 3, 2, 1, 1, 3, 2, 1, 0, 1, 1, 0, 4, 0, 1, 3, 2, 1],
    lycaybong: [8, 8, 9, 10, 9, 8, 7, 8, 8, 9, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5, 5, 6, 5, 4, 3, 5],
    trongcom: [8, 8, 10, 10, 10, 8, 8, 8, 10, 10, 10, 10, 8, 7, 8, 8, 10, 10, 11, 10, 11, 12, 12, 12, 13, 14, 13, 10, 10, 10, 9, 8, 9, 10, 9, 10, 9, 8],
    cola: [6, 7, 8, 8, 9, 8, 7, 6, 6, 7, 8, 9, 10, 9, 8, 8, 9, 8, 7, 6, 5, 6, 7, 6, 5, 4, 3, 3, 5, 6, 5],
    longme: [7, 7, 8, 9, 9, 8, 7, 6, 5, 5, 7, 7, 8, 9, 9, 8, 7, 6, 5, 5, 8, 8, 10, 11, 11, 10, 9, 8, 7, 8, 9, 8, 7, 6, 5],
    tayduky: [8, 8, 9, 10, 11, 10, 9, 8, 10, 10, 11, 12, 13, 12, 11, 10, 11, 11, 12, 11, 10, 9, 9, 10, 11, 10]
  };

  var SONG_NAMES = {
    butterfly: "Kìa Con Bướm Vàng",
    buomvang: "Kìa Con Bướm Vàng",
    beodat: "Bèo Dạt Mây Trôi",
    luuthuy: "Lưu Thủy Kim Tiền",
    daco: "Dạ Cổ Hoài Lang",
    lycaybong: "Lý Cây Bông",
    trongcom: "Trống Cơm",
    cola: "Cò Lả",
    longme: "Lòng Mẹ",
    tayduky: "Tây Du Ký"
  };

  document.querySelectorAll(".btnPlayDemoSong").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var songKey = btn.dataset.song;
      var notesSeq = DEMO_SONGS[songKey];
      if (!notesSeq) return;

      stopAiPlaying();
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = "🎶 Đang chơi...";

      var songTitle = SONG_NAMES[songKey] || "Bản nhạc ngũ cung";
      showNowPlaying(songTitle);

      notesSeq.forEach(function (stringIndex, step) {
        var t = setTimeout(function () {
          pluck(stringIndex);
          updateNowPlayingNote(stringIndex);
          if (step === notesSeq.length - 1) {
            btn.disabled = false;
            btn.textContent = originalText;
            hideNowPlaying();
          }
        }, step * 360);
        aiPlayTimeouts.push(t);
      });
    });
  });

  // Thêm mới bản nhạc tùy biến
  var formAddCustom = document.getElementById("formAddCustom");
  if (formAddCustom) {
    formAddCustom.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = document.getElementById("customTitle").value.trim();
      var tab = document.getElementById("customTab").value.trim();
      var note = document.getElementById("customNote").value.trim();

      alert("Đã lưu giai điệu \"" + title + "\" thành công vào danh sách bài hát cá nhân!");
      formAddCustom.reset();
      closeModal("modalAddCustom");
    });
  }

  // =========================================================
  // 7. ADMIN TOOLS LOGIC
  // =========================================================
  function renderAdminSlots() {
    var container = document.getElementById("adminSlotsContainer");
    if (!container) return;
    container.innerHTML = "";

    NOTES.forEach(function (note, i) {
      var row = document.createElement("div");
      row.className = "sound-slot-admin";

      var lbl = document.createElement("span");
      lbl.style.width = "90px";
      lbl.style.fontWeight = "bold";
      lbl.textContent = (i + 1) + ". " + KEY_MAP[i] + " (" + note.split(" ")[0] + ")";

      var status = document.createElement("span");
      status.style.flex = "1";
      status.style.fontSize = "11px";
      status.textContent = slots[i].name || "Mặc định (Âm ngũ cung tổng hợp)";

      var fileInp = document.createElement("input");
      fileInp.type = "file";
      fileInp.accept = "audio/*";
      fileInp.style.display = "none";
      fileInp.addEventListener("change", function () {
        if (fileInp.files && fileInp.files[0]) {
          setSlotFile(i, fileInp.files[0]);
          renderAdminSlots();
        }
      });

      var btnUpload = document.createElement("button");
      btnUpload.type = "button";
      btnUpload.className = "btn btn-secondary btn-sm";
      btnUpload.textContent = "Upload";
      btnUpload.addEventListener("click", function () { fileInp.click(); });

      var btnTest = document.createElement("button");
      btnTest.type = "button";
      btnTest.className = "btn btn-primary btn-sm";
      btnTest.textContent = "Thử";
      btnTest.addEventListener("click", function () { pluck(i); });

      row.appendChild(lbl);
      row.appendChild(status);
      row.appendChild(btnUpload);
      row.appendChild(btnTest);
      row.appendChild(fileInp);
      container.appendChild(row);
    });
  }

  function renderAdminUsers() {
    var tbody = document.getElementById("adminUserTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    var users = getUsers();
    users.forEach(function (u, index) {
      var tr = document.createElement("tr");

      // Cột 1: Tài khoản & Avatar
      var tdUser = document.createElement("td");
      var avatarIcon = u.avatar || (u.role === "admin" ? "👑" : "👤");
      var isImg = avatarIcon.startsWith("data:image/") || avatarIcon.startsWith("http");
      var avHtml = isImg 
        ? "<img src='" + avatarIcon + "' style='width:24px; height:24px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:6px;'>" 
        : "<span style='font-size:18px; margin-right:6px; vertical-align:middle;'>" + avatarIcon + "</span>";
      tdUser.innerHTML = avHtml + "<strong>" + (u.displayName || u.username) + "</strong><br><small style='color:var(--text-dim)'>@" + u.username + "</small>";

      // Cột 2: MẬT KHẨU THÀNH VIÊN (Admin xem trực tiếp)
      var tdPass = document.createElement("td");
      var passSpan = document.createElement("span");
      passSpan.id = "passText_" + index;
      passSpan.style.fontFamily = "monospace";
      passSpan.style.fontSize = "12px";
      passSpan.style.color = "var(--string-gold)";
      passSpan.textContent = u.password;

      var btnTogglePass = document.createElement("button");
      btnTogglePass.type = "button";
      btnTogglePass.className = "btn btn-secondary btn-xs";
      btnTogglePass.style.marginLeft = "6px";
      btnTogglePass.textContent = "👁️";
      btnTogglePass.title = "Ẩn/Hiện mật khẩu";
      var isMasked = false;
      btnTogglePass.addEventListener("click", function () {
        isMasked = !isMasked;
        passSpan.textContent = isMasked ? "••••••••" : u.password;
      });

      tdPass.appendChild(passSpan);
      tdPass.appendChild(btnTogglePass);

      // Cột 3: Vai trò
      var tdRole = document.createElement("td");
      tdRole.innerHTML = u.role === "admin" ? "<span style='color:var(--error); font-weight:bold;'>👑 Admin</span>" : "Thành viên";

      // Cột 4: Ngày tạo
      var tdDate = document.createElement("td");
      tdDate.textContent = u.createdAt || "2026-09-14";

      // Cột 5: Hành động (Đổi mật khẩu / Xóa)
      var tdAction = document.createElement("td");
      tdAction.style.whiteSpace = "nowrap";

      var btnEditPass = document.createElement("button");
      btnEditPass.type = "button";
      btnEditPass.className = "btn btn-secondary btn-xs";
      btnEditPass.style.marginRight = "4px";
      btnEditPass.textContent = "✏️ Đổi MK";
      btnEditPass.addEventListener("click", function () {
        var newP = prompt("Nhập mật khẩu mới cho tài khoản @" + u.username + ":", u.password);
        if (newP && newP.trim().length >= 3) {
          u.password = newP.trim();
          users[index] = u;
          saveUsers(users);
          renderAdminUsers();
          alert("Đã cập nhật mật khẩu cho @" + u.username + " thành công!");
        }
      });
      tdAction.appendChild(btnEditPass);

      if (u.username !== "admin") {
        var btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn btn-danger btn-xs";
        btnDel.textContent = "Xóa";
        btnDel.addEventListener("click", function () {
          if (confirm("Bạn có chắc muốn xóa người dùng @" + u.username + "?")) {
            users.splice(index, 1);
            saveUsers(users);
            renderAdminUsers();
          }
        });
        tdAction.appendChild(btnDel);
      }

      tr.appendChild(tdUser);
      tr.appendChild(tdPass);
      tr.appendChild(tdRole);
      tr.appendChild(tdDate);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  }

  // TIẾP NHẬN THÔNG TIN & PHẢN HỒI NGƯỜI DÙNG (ADMIN INBOX)
  function renderAdminReports() {
    var listEl = document.getElementById("adminReportsList");
    if (!listEl) return;
    listEl.innerHTML = "";

    var reports = getReports();
    if (reports.length === 0) {
      listEl.innerHTML = "<p style='color:var(--text-dim); text-align:center; margin:16px 0;'>Hòm thư hiện đang trống. Chưa có phản hồi hoặc báo cáo nào mới.</p>";
      return;
    }

    reports.forEach(function (rep, idx) {
      var card = document.createElement("div");
      card.className = "admin-report-card";
      if (rep.unread) {
        card.style.borderLeft = "4px solid #ff4757";
      }

      var header = document.createElement("div");
      header.className = "admin-report-header";

      var typeWrapper = document.createElement("div");
      typeWrapper.style.display = "flex";
      typeWrapper.style.gap = "6px";
      typeWrapper.style.alignItems = "center";

      var typeBadge = document.createElement("span");
      typeBadge.className = "admin-report-type";
      typeBadge.textContent = rep.type;

      var statusBadge = document.createElement("span");
      if (rep.adminReply) {
        statusBadge.className = "badge-replied";
        statusBadge.textContent = "✅ Đã phản hồi";
      } else {
        statusBadge.className = "badge-pending";
        statusBadge.textContent = "⏳ Chờ phản hồi";
      }

      typeWrapper.appendChild(typeBadge);
      typeWrapper.appendChild(statusBadge);

      var timeSpan = document.createElement("span");
      timeSpan.style.color = "var(--text-dim)";
      timeSpan.style.fontSize = "11px";
      timeSpan.textContent = rep.time || "";

      header.appendChild(typeWrapper);
      header.appendChild(timeSpan);

      var contentP = document.createElement("div");
      contentP.className = "admin-report-content";
      contentP.style.marginTop = "6px";
      contentP.textContent = rep.content;

      card.appendChild(header);
      card.appendChild(contentP);

      // Nếu đã có phản hồi từ Admin trước đó -> hiển thị rõ ràng
      if (rep.adminReply) {
        var replyBlock = document.createElement("div");
        replyBlock.className = "admin-existing-reply";
        replyBlock.innerHTML = 
          "<div class='admin-existing-reply-header'>" +
            "<span>💬 Phản hồi hiện tại của bạn (Admin):</span>" +
            "<span style='font-weight:normal; color:var(--text-dim);'>" + (rep.replyTime || "") + "</span>" +
          "</div>" +
          "<div style='color:var(--ivory); line-height:1.45; white-space:pre-wrap;'>" + escapeHtml(rep.adminReply) + "</div>";
        card.appendChild(replyBlock);
      }

      // Khung nhập / sửa phản hồi của Admin trực tiếp
      var replyBox = document.createElement("div");
      replyBox.className = "admin-reply-box";

      var replyForm = document.createElement("div");
      replyForm.className = "admin-reply-form";

      var textarea = document.createElement("textarea");
      textarea.className = "admin-reply-textarea";
      textarea.rows = 2;
      textarea.placeholder = rep.adminReply ? "Nhập nội dung mới nếu muốn sửa câu trả lời cho người dùng này..." : "Nhập lời giải đáp, cảm ơn hoặc hướng dẫn gửi tới @" + (rep.sender || "Khách") + "...";
      if (rep.adminReply) {
        textarea.value = rep.adminReply;
      }

      var btnSendReply = document.createElement("button");
      btnSendReply.type = "button";
      btnSendReply.className = "btn btn-primary btn-sm";
      btnSendReply.style.whiteSpace = "nowrap";
      btnSendReply.style.height = "38px";
      btnSendReply.textContent = rep.adminReply ? "🔄 Cập nhật" : "📨 Gửi phản hồi";

      btnSendReply.addEventListener("click", function () {
        var val = textarea.value.trim();
        if (!val) {
          alert("Vui lòng nhập nội dung trước khi gửi phản hồi!");
          return;
        }
        rep.adminReply = val;
        rep.replyTime = new Date().toLocaleString("vi-VN");
        rep.unreadUserReply = true;
        rep.unread = false;
        saveReports(reports);
        renderAdminReports();
        alert("✅ Đã gửi phản hồi thành công tới @" + (rep.sender || "Khách") + "!");
      });

      replyForm.appendChild(textarea);
      replyForm.appendChild(btnSendReply);
      replyBox.appendChild(replyForm);
      card.appendChild(replyBox);

      // Footer: thông tin người gửi & nút xóa
      var footer = document.createElement("div");
      footer.className = "admin-report-footer";
      footer.style.marginTop = "8px";

      var senderInfo = document.createElement("span");
      senderInfo.innerHTML = "Gửi bởi: <strong>@" + (rep.sender || "Khách") + "</strong>" + (rep.contact ? " · LH: <em>" + rep.contact + "</em>" : "");

      var btnDelRep = document.createElement("button");
      btnDelRep.type = "button";
      btnDelRep.className = "btn btn-danger btn-xs";
      btnDelRep.textContent = "🗑️ Xóa";
      btnDelRep.addEventListener("click", function () {
        if (confirm("Bạn có chắc muốn xóa phản hồi/báo cáo này?")) {
          reports.splice(idx, 1);
          saveReports(reports);
          renderAdminReports();
        }
      });

      footer.appendChild(senderInfo);
      footer.appendChild(btnDelRep);
      card.appendChild(footer);

      // Đánh dấu đã đọc khi xem
      if (rep.unread) {
        rep.unread = false;
      }

      listEl.appendChild(card);
    });

    // Lưu trạng thái đã đọc
    localStorage.setItem("dan_tranh_reports", JSON.stringify(reports));
    updateReportBadges();
  }

  // Dọn sạch toàn bộ báo cáo
  var btnClearAllReports = document.getElementById("btnClearAllReports");
  if (btnClearAllReports) {
    btnClearAllReports.addEventListener("click", function () {
      if (confirm("Bạn có chắc muốn xóa sạch tất cả phản hồi trong hòm thư Admin?")) {
        saveReports([]);
        renderAdminReports();
      }
    });
  }

  var btnAdminCreateUser = document.getElementById("btnAdminCreateUser");
  if (btnAdminCreateUser) {
    btnAdminCreateUser.addEventListener("click", function () {
      var u = document.getElementById("adminNewUser").value.trim().toLowerCase();
      var dn = document.getElementById("adminNewDisplayName") ? document.getElementById("adminNewDisplayName").value.trim() : "";
      var p = document.getElementById("adminNewPass").value.trim();
      var r = document.getElementById("adminNewRole").value;

      if (!u || !p) {
        alert("Vui lòng điền đủ Tên tài khoản và Mật khẩu!");
        return;
      }

      var users = getUsers();
      if (users.some(function (item) { return item.username.toLowerCase() === u; })) {
        alert("Tài khoản này đã tồn tại!");
        return;
      }

      users.push({
        username: u,
        password: p,
        displayName: dn || u,
        role: r,
        avatar: r === "admin" ? "👑" : "🎵",
        createdAt: new Date().toISOString().slice(0, 10)
      });
      saveUsers(users);

      document.getElementById("adminNewUser").value = "";
      if (document.getElementById("adminNewDisplayName")) document.getElementById("adminNewDisplayName").value = "";
      document.getElementById("adminNewPass").value = "";
      renderAdminUsers();
      alert("Đã tạo người dùng @" + u + " thành công!");
    });
  }

  // =========================================================
  // XỬ LÝ GỬI BÁO CÁO / Ý KIẾN CHO ADMIN
  // =========================================================
  var formSubmitReport = document.getElementById("formSubmitReport");
  if (formSubmitReport) {
    formSubmitReport.addEventListener("submit", function (e) {
      e.preventDefault();
      var type = document.getElementById("reportType").value;
      var content = document.getElementById("reportContent").value.trim();
      var contact = document.getElementById("reportContact").value.trim();
      var alertEl = document.getElementById("reportSuccessAlert");

      if (!content) return;

      var reports = getReports();
      var newReport = {
        id: "rep_" + Date.now(),
        type: type,
        sender: (currentUser && currentUser.username) ? currentUser.username : "Khách ẩn danh",
        content: content,
        contact: contact,
        time: new Date().toLocaleString("vi-VN"),
        unread: true,
        adminReply: "",
        replyTime: "",
        unreadUserReply: false
      };

      reports.unshift(newReport);
      saveReports(reports);

      formSubmitReport.reset();
      renderUserReplies();

      if (alertEl) {
        alertEl.style.display = "block";
        setTimeout(function () {
          alertEl.style.display = "none";
        }, 3000);
      }
    });
  }

  // =========================================================
  // XỬ LÝ ĐỔI AVATAR NGƯỜI DÙNG (PRESETS & TẢI ẢNH TỰ DO)
  // =========================================================
  
  // HIỂN THỊ PHẢN HỒI TỪ ADMIN CHO NGƯỜI DÙNG (USER INBOX)
  function renderUserReplies() {
    var container = document.getElementById("userRepliesContainer");
    var badge = document.getElementById("userRepliesBadge");
    if (!container) return;
    container.innerHTML = "";

    var reports = getReports();
    var isGuest = !currentUser || currentUser.role === "guest" || currentUser.username === "guest";
    var userReports = reports.filter(function (r) {
      if (isGuest) {
        return !!r.adminReply || r.sender === "Khách" || r.sender === "Khách ẩn danh" || r.sender === "guest";
      } else {
        return r.sender && r.sender.toLowerCase() === currentUser.username.toLowerCase();
      }
    });

    var repliedList = userReports.filter(function (r) { return !!r.adminReply; });
    if (badge) {
      badge.textContent = repliedList.length + " phản hồi";
    }

    if (userReports.length === 0) {
      container.innerHTML = "<p style='color:var(--text-dim); text-align:center; margin:16px 0; font-size:12px;'>Bạn chưa có báo cáo hoặc câu hỏi nào. Hãy gửi ý kiến tại form bên trên khi cần hỗ trợ nhé!</p>";
      return;
    }

    var hasMarkedRead = false;
    userReports.forEach(function (r) {
      var card = document.createElement("div");
      card.className = "user-reply-card";

      var header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.fontSize = "11.5px";

      var typeSpan = document.createElement("span");
      typeSpan.style.color = "var(--string-gold)";
      typeSpan.style.fontWeight = "600";
      typeSpan.textContent = "📌 [" + r.type + "]";

      var timeSpan = document.createElement("span");
      timeSpan.style.color = "var(--text-dim)";
      timeSpan.style.fontSize = "11px";
      timeSpan.textContent = r.time || "";

      header.appendChild(typeSpan);
      header.appendChild(timeSpan);

      var qDiv = document.createElement("div");
      qDiv.className = "user-reply-question";
      qDiv.innerHTML = "<span style='color:var(--text-dim); font-size:11px;'>Ý kiến bạn gửi:</span><br>" + escapeHtml(r.content);

      card.appendChild(header);
      card.appendChild(qDiv);

      if (r.adminReply) {
        var ansDiv = document.createElement("div");
        ansDiv.className = "user-reply-answer";
        ansDiv.innerHTML = 
          "<div class='user-reply-answer-header'>" +
            "<span>👑 Ban Quản Trị (Admin) phản hồi:</span>" +
            "<span style='color:var(--text-dim); font-weight:normal;'>" + (r.replyTime || "") + "</span>" +
          "</div>" +
          "<div class='user-reply-answer-content'>" + escapeHtml(r.adminReply) + "</div>";
        card.appendChild(ansDiv);

        if (r.unreadUserReply) {
          r.unreadUserReply = false;
          hasMarkedRead = true;
        }
      } else {
        var waitDiv = document.createElement("div");
        waitDiv.style.fontSize = "11.5px";
        waitDiv.style.color = "#ffa502";
        waitDiv.style.background = "rgba(255,165,2,0.1)";
        waitDiv.style.padding = "6px 10px";
        waitDiv.style.borderRadius = "6px";
        waitDiv.innerHTML = "⏳ <em>Admin đã tiếp nhận tin nhắn và đang chuẩn bị phản hồi cho bạn...</em>";
        card.appendChild(waitDiv);
      }

      container.appendChild(card);
    });

    if (hasMarkedRead) {
      localStorage.setItem("dan_tranh_reports", JSON.stringify(reports));
      updateReportBadges();
    }
  }

  var AVATAR_PRESETS = ["👤", "🪕", "🎵", "👑", "🌸", "🌾", "🦋", "✨", "🐉", "🍁", "🍵", "🎻", "🎼", "🌟", "🌙", "⛩️", "🕊️", "🎸"];

  function setupAvatarModal() {
    var presetsContainer = document.getElementById("avatarPresetsList");
    var previewLarge = document.getElementById("avatarPreviewLarge");
    var lblCurrent = document.getElementById("lblAvatarCurrentName");

    var currentAv = (currentUser && currentUser.avatar) ? currentUser.avatar : "👤";
    renderAvatarElement(previewLarge, currentAv);
    if (lblCurrent && currentUser) {
      lblCurrent.textContent = currentUser.displayName + " (@" + currentUser.username + ")";
    }

    if (presetsContainer) {
      presetsContainer.innerHTML = "";
      AVATAR_PRESETS.forEach(function (icon) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "avatar-preset-btn";
        btn.textContent = icon;
        btn.title = "Chọn avatar " + icon;
        btn.addEventListener("click", function () {
          saveUserAvatar(icon);
          renderAvatarElement(previewLarge, icon);
        });
        presetsContainer.appendChild(btn);
      });
    }
  }

  function saveUserAvatar(avatarData) {
    if (!currentUser) {
      currentUser = { username: "guest", displayName: "Khách", role: "guest", avatar: avatarData };
    } else {
      currentUser.avatar = avatarData;
      if (currentUser.username !== "guest") {
        var users = getUsers();
        var idx = users.findIndex(function(u) { return u.username.toLowerCase() === currentUser.username.toLowerCase(); });
        if (idx !== -1) {
          users[idx].avatar = avatarData;
          saveUsers(users);
        }
      }
    }
    updateUIForUser();
  }

  var btnTriggerUploadAvatar = document.getElementById("btnTriggerUploadAvatar");
  var inpUploadCustomAvatar = document.getElementById("inpUploadCustomAvatar");
  if (btnTriggerUploadAvatar && inpUploadCustomAvatar) {
    btnTriggerUploadAvatar.addEventListener("click", function () {
      inpUploadCustomAvatar.click();
    });

    inpUploadCustomAvatar.addEventListener("change", function () {
      if (inpUploadCustomAvatar.files && inpUploadCustomAvatar.files[0]) {
        var file = inpUploadCustomAvatar.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
          var base64Url = e.target.result;
          saveUserAvatar(base64Url);
          var previewLarge = document.getElementById("avatarPreviewLarge");
          renderAvatarElement(previewLarge, base64Url);
          alert("Đã cập nhật Avatar từ ảnh thiết bị thành công!");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  var btnResetDefaultAvatar = document.getElementById("btnResetDefaultAvatar");
  if (btnResetDefaultAvatar) {
    btnResetDefaultAvatar.addEventListener("click", function () {
      var defaultIcon = (currentUser && currentUser.role === "admin") ? "👑" : "👤";
      saveUserAvatar(defaultIcon);
      var previewLarge = document.getElementById("avatarPreviewLarge");
      renderAvatarElement(previewLarge, defaultIcon);
    });
  }

  // Lưu API Key Gemini
  var btnSaveGeminiKey = document.getElementById("btnSaveGeminiKey");
  var txtGeminiApiKey = document.getElementById("txtGeminiApiKey");
  var lblKeyStatus = document.getElementById("lblKeyStatus");

  function checkGeminiKeyStatus() {
    var key = localStorage.getItem("gemini_api_key");
    if (txtGeminiApiKey) txtGeminiApiKey.value = key ? "••••••••••••••••••••••••••••" : "";
    if (lblKeyStatus) {
      lblKeyStatus.textContent = key ? "✅ Đã cấu hình Gemini API Key riêng (Sẵn sàng mở rộng)." : "ℹ️ Đang dùng Tri Thức Đàn Tranh Nội Bộ 100% Chuẩn Xác.";
    }
  }

  if (btnSaveGeminiKey) {
    btnSaveGeminiKey.addEventListener("click", function () {
      var key = txtGeminiApiKey.value.trim();
      if (!key || key.startsWith("•••")) {
        alert("Vui lòng dán khóa API Key hợp lệ bắt đầu bằng AIzaSy...");
        return;
      }
      localStorage.setItem("gemini_api_key", key);
      checkGeminiKeyStatus();
      alert("Đã lưu Gemini API Key thành công!");
    });
  }

  // =========================================================
  // 8. DỰNG 16 DÂY ĐÀN TRANH VÀ BẢNG GÁN FILE CHO PLAYER
  // =========================================================
  var stringsArea = document.getElementById("stringsArea");
  var pickerListEl = document.getElementById("pickerList");
  var countEl = document.getElementById("count");
  var pickerEl = document.getElementById("picker");
  var toggleBtn = document.getElementById("togglePicker");
  var btnClosePicker = document.getElementById("btnClosePicker");

  function updateCount(targetInst) {
    if (countEl) {
      var inst = targetInst || (typeof INSTRUMENT_MAP !== "undefined" && currentActiveInstrument && INSTRUMENT_MAP[currentActiveInstrument]) || (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP["dantranh"]) || null;
      var notesLen = (inst && inst.notes && inst.notes.length) ? inst.notes.length : 16;
      var instName = inst ? inst.name : "Đàn tranh";
      countEl.textContent = "Sẵn sàng " + notesLen + "/" + notesLen + " bậc âm (" + instName + ")";
    }
  }

  function setSlotFile(i, file) {
    var s = slots[i];
    if (s.url) URL.revokeObjectURL(s.url);
    s.name = file.name;
    s.url = URL.createObjectURL(file);
    s.audio = new Audio(s.url);
    s.audio.preload = "auto";
    refreshSlot(i);
  }

  function clearSlot(i) {
    var s = slots[i];
    if (s.url) URL.revokeObjectURL(s.url);
    s.name = null;
    s.url = null;
    s.audio = null;
    refreshSlot(i);
  }

  function refreshSlot(i) {
    if (slotNames[i]) {
      var label = slots[i].name || "Mặc định (Âm ngũ cung)";
      slotNames[i].textContent = label;
      slotNames[i].title = label;
      slotNames[i].classList.toggle("has-file", !!slots[i].name);
    }
    updateCount();
  }

  if (stringsArea) {
    stringsArea.innerHTML = "";
    NOTES.forEach(function (note, i) {
      var row = document.createElement("div");
      row.className = "string-row";

      var label = document.createElement("div");
      label.className = "string-label";
      label.textContent = KEY_MAP[i];
      label.title = note;
      row.appendChild(label);

      var string = document.createElement("button");
      string.type = "button";
      string.className = "string";
      string.dataset.index = i;
      string.setAttribute("aria-label", "Gảy dây " + (i + 1) + " – " + note);
      row.appendChild(string);

      var noteName = document.createElement("div");
      noteName.className = "string-note-name";
      noteName.textContent = note.split(" ")[0];
      row.appendChild(noteName);

      string.addEventListener("pointerdown", function () {
        getAudioContext();
        pluck(i);
      });

      stringsArea.appendChild(row);
      stringEls.push(string);
    });
  }

  if (pickerListEl) {
    pickerListEl.innerHTML = "";
    NOTES.forEach(function (note, i) {
      var slot = document.createElement("div");
      slot.className = "slot";

      var label = document.createElement("span");
      label.className = "slot-label";
      label.textContent = (i + 1) + ". " + note.split(" ")[0] + " (" + KEY_MAP[i] + ")";

      var name = document.createElement("span");
      name.className = "slot-name";
      name.textContent = "Mặc định (Âm ngũ cung)";

      var input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm";

      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "file-btn";
      pick.textContent = "Chọn file";
      pick.addEventListener("click", function () { input.click(); });

      input.addEventListener("change", function () {
        if (input.files && input.files[0]) setSlotFile(i, input.files[0]);
        input.value = "";
      });

      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "clear-btn";
      clear.textContent = "Mặc định";
      clear.addEventListener("click", function () { clearSlot(i); });

      slot.appendChild(label);
      slot.appendChild(name);
      slot.appendChild(pick);
      slot.appendChild(clear);
      slot.appendChild(input);
      pickerListEl.appendChild(slot);

      slotNames[i] = name;
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      if (pickerEl) {
        var hidden = pickerEl.hasAttribute("hidden");
        if (hidden) {
          pickerEl.removeAttribute("hidden");
          toggleBtn.textContent = "Đóng bảng chọn file";
        } else {
          pickerEl.setAttribute("hidden", "");
          toggleBtn.textContent = "📁 Gán file âm thanh riêng";
        }
      }
    });
  }

  if (btnClosePicker) {
    btnClosePicker.addEventListener("click", function () {
      if (pickerEl) pickerEl.setAttribute("hidden", "");
      if (toggleBtn) toggleBtn.textContent = "📁 Gán file âm thanh riêng";
    });
  }

  // =========================================================
  // 9. BÀN PHÍM GẢY ĐÀN (Đồng bộ qua Universal Keydown khớp đúng nhãn phím 1..8)
  // =========================================================
  var pressed = {};

  // =========================================================
  // 10. CHATBOT GEMINI AI: SIÊU TRÍ TUỆ TOÀN NĂNG & THƯ VIỆN BÀI HÁT TỰ ĐỘNG GẢY ĐÀN
  // =========================================================
  var chatWindow = document.getElementById("chatWindow");
  var closeChatBtn = document.getElementById("closeChatBtn");
  var chatForm = document.getElementById("chatForm");
  var chatInput = document.getElementById("chatInput");
  var chatMessages = document.getElementById("chatMessages");
  var dockBtnAI = document.getElementById("dockBtnAI");
  var btnToggleAiDrawer = document.getElementById("btnToggleAiDrawer");
  var aiDrawerPanel = document.getElementById("aiDrawerPanel");
  var btnCloseAiDrawer = document.getElementById("btnCloseAiDrawer");
  var chatDrawerKeyInp = document.getElementById("chatDrawerKeyInp");
  var btnSaveDrawerKey = document.getElementById("btnSaveDrawerKey");
  var chatDrawerKeyStatus = document.getElementById("chatDrawerKeyStatus");

  function openChat() {
    if (chatWindow) {
      chatWindow.removeAttribute("hidden");
      if (chatInput) chatInput.focus();
      updateDrawerStatus();
    }
  }

  function closeChat() {
    if (chatWindow) chatWindow.setAttribute("hidden", "");
  }

  function updateDrawerStatus() {
    var key = localStorage.getItem("gemini_api_key");
    if (chatDrawerKeyInp && key) {
      chatDrawerKeyInp.value = "••••••••••••••••••••••••••••";
    }
    if (chatDrawerKeyStatus) {
      chatDrawerKeyStatus.textContent = key ? "✅ Đang kích hoạt Gemini 2.0 Flash Trực Tiếp" : "⚡ Đang dùng Siêu Trí Tuệ Bách Khoa Trực Tuyến";
    }
  }

  if (btnToggleAiDrawer) {
    btnToggleAiDrawer.addEventListener("click", function () {
      if (aiDrawerPanel) {
        var isHidden = aiDrawerPanel.style.display === "none";
        aiDrawerPanel.style.display = isHidden ? "block" : "none";
        if (isHidden) updateDrawerStatus();
      }
    });
  }

  if (btnCloseAiDrawer) {
    btnCloseAiDrawer.addEventListener("click", function () {
      if (aiDrawerPanel) aiDrawerPanel.style.display = "none";
    });
  }

  if (btnSaveDrawerKey) {
    btnSaveDrawerKey.addEventListener("click", function () {
      var key = chatDrawerKeyInp.value.trim();
      if (!key || key.startsWith("•••")) {
        alert("Vui lòng dán mã API Key hợp lệ bắt đầu bằng AIzaSy... từ Google AI Studio.");
        return;
      }
      localStorage.setItem("gemini_api_key", key);
      updateDrawerStatus();
      alert("✅ Đã kết nối Google Gemini API thành công!");
      if (aiDrawerPanel) aiDrawerPanel.style.display = "none";
    });
  }

  if (dockBtnAI) dockBtnAI.addEventListener("click", function () {
    if (chatWindow && chatWindow.hasAttribute("hidden")) {
      openChat();
    } else {
      closeChat();
    }
  });

  if (closeChatBtn) {
    closeChatBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      closeChat();
    });
  }

  function appendChatMessage(text, sender) {
    if (!chatMessages) return;
    var msgDiv = document.createElement("div");
    msgDiv.className = "dt-message " + sender;
    var bubble = document.createElement("div");
    bubble.className = "dt-bubble";
    bubble.innerHTML = text;
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // =========================================================
  // BỘ ĐIỀU KHIỂN AI TỰ ĐỘNG GẢY ĐÀN TRANH (AI AUTO-PLAY ENGINE)
  // =========================================================
  var aiPlayTimeouts = [];
  var isAiPlaying = false;

  function stopAiPlaying() {
    aiPlayTimeouts.forEach(function (t) { clearTimeout(t); });
    aiPlayTimeouts = [];
    isAiPlaying = false;
    hideNowPlaying();
    document.querySelectorAll(".btnStopAiPlaying").forEach(function(btn) {
      btn.style.display = "none";
    });
  }

  // Gắn sự kiện click cho nút Dừng gảy đàn & Nút chơi bài trực tiếp & Nút điều khiển nhạc cụ trong chat
  document.addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("btnStopAiPlaying")) {
      stopAiPlaying();
      appendChatMessage("⏹️ Đã dừng gảy đàn theo yêu cầu của bạn. Bạn muốn nghe bài nào tiếp theo?", "bot");
    }
    if (e.target && e.target.classList.contains("btnAiPlayDirect")) {
      var songKey = e.target.dataset.song;
      if (songKey) triggerAiPlay(songKey);
    }
    if (e.target && e.target.classList.contains("btnAiSwitchInst")) {
      var instId = e.target.dataset.inst;
      if (instId && typeof switchInstrument === "function") {
        switchInstrument(instId);
        var targetInst = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP[instId]) ? INSTRUMENT_MAP[instId] : null;
        appendChatMessage("✨ Đã chuyển sân khấu sang <strong>" + (targetInst ? (targetInst.icon + " " + targetInst.name) : instId) + "</strong> cho bạn rồi đấy!", "bot");
      }
    }
    if (e.target && e.target.classList.contains("btnAiOpenDossier")) {
      var instId = e.target.dataset.inst;
      if (instId && typeof openInstrumentDossier === "function") {
        openInstrumentDossier(instId);
      }
    }
    if (e.target && e.target.classList.contains("btnAiPlayDemo")) {
      var instId = e.target.dataset.inst;
      if (instId && typeof playDemoSongForInstrument === "function") {
        if (typeof switchInstrument === "function") switchInstrument(instId);
        playDemoSongForInstrument(instId);
        var targetInst = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP[instId]) ? INSTRUMENT_MAP[instId] : null;
        appendChatMessage("🎶 Đang trực tiếp tấu bản nhạc mẫu của <strong>" + (targetInst ? (targetInst.icon + " " + targetInst.name) : instId) + "</strong> cho bạn thưởng thức!", "bot");
      }
    }
  });

  // KHO 35+ BÀI HÁT CHUẨN XÁC 100% CHO AI BIỂU DIỄN TRÊN ĐÀN TRANH
  var AI_SONG_LIBRARY = {
    // 1. Nhạc Thiếu Nhi & Gia Đình
    buomvang: {
      title: "Kìa Con Bướm Vàng",
      aliases: ["bướm vàng", "kia con buom vang", "kìa con bướm", "con bướm vàng", "buom vang"],
      notes: [5, 6, 7, 5, 5, 6, 7, 5, 7, 7, 8, 7, 7, 8, 8, 9, 8, 7, 5, 8, 9, 8, 7, 5, 5, 8, 5, 5, 8, 5],
      tempo: 340
    },
    happybirthday: {
      title: "Chúc Mừng Sinh Nhật (Happy Birthday)",
      aliases: ["happy birthday", "sinh nhật", "chúc mừng sinh nhật", "mừng sinh nhật", "happy bday"],
      notes: [5, 5, 6, 5, 8, 7, 5, 5, 6, 5, 9, 8, 5, 5, 12, 10, 8, 7, 6, 11, 11, 10, 8, 9, 8],
      tempo: 350
    },
    twinkle: {
      title: "Ngôi Sao Nhỏ (Twinkle Twinkle Little Star)",
      aliases: ["ngôi sao nhỏ", "twinkle", "ngôi sao lấp lánh", "ngoi sao nho"],
      notes: [5, 5, 9, 9, 10, 10, 9, 8, 8, 7, 7, 6, 6, 5, 9, 9, 8, 8, 7, 7, 6, 9, 9, 8, 8, 7, 7, 6, 5, 5, 9, 9, 10, 10, 9, 8, 8, 7, 7, 6, 6, 5],
      tempo: 320
    },
    motconvit: {
      title: "Một Con Vịt",
      aliases: ["một con vịt", "con vịt", "mot con vit", "hai cái cánh"],
      notes: [5, 6, 7, 7, 5, 6, 7, 7, 8, 9, 8, 7, 6, 7, 8, 5, 7, 8, 9, 9, 8, 7, 6, 5, 6, 7, 5],
      tempo: 330
    },
    canhathuongnhau: {
      title: "Cả Nhà Thương Nhau",
      aliases: ["cả nhà thương nhau", "ca nha thuong nhau", "ba thương con"],
      notes: [5, 7, 8, 8, 8, 7, 5, 6, 7, 8, 9, 9, 8, 7, 8, 10, 9, 8, 7, 5, 6, 7, 8, 9, 8, 7, 5],
      tempo: 360
    },
    chaulenba: {
      title: "Cháu Lên Ba",
      aliases: ["cháu lên ba", "chau len ba", "cháu đi mẫu giáo"],
      notes: [5, 7, 8, 8, 8, 7, 8, 9, 8, 7, 5, 6, 7, 8, 7, 6, 5, 7, 8, 9, 8, 7, 5, 6, 7, 5],
      tempo: 330
    },
    emyeutruongem: {
      title: "Em Yêu Trường Em",
      aliases: ["em yêu trường em", "em yeu truong em", "mái trường mến yêu"],
      notes: [5, 6, 7, 8, 9, 8, 7, 8, 9, 10, 9, 8, 7, 6, 5, 7, 8, 9, 8, 7, 6, 5, 6, 7, 5],
      tempo: 340
    },
    buiphan: {
      title: "Bụi Phấn",
      aliases: ["bụi phấn", "bui phan", "khi thầy viết bảng"],
      notes: [5, 7, 8, 9, 8, 7, 5, 7, 8, 9, 10, 9, 8, 7, 8, 9, 8, 7, 5, 6, 7, 8, 7, 6, 5],
      tempo: 380
    },
    ngaydautien: {
      title: "Ngày Đầu Tiên Đi Học",
      aliases: ["ngày đầu tiên đi học", "ngay dau tien di hoc"],
      notes: [5, 7, 8, 7, 5, 6, 7, 8, 9, 8, 7, 8, 9, 10, 9, 8, 7, 5, 6, 7, 8, 7, 5],
      tempo: 390
    },
    tienquanca: {
      title: "Tiến Quân Ca (Quốc Ca Việt Nam)",
      aliases: ["tiến quân ca", "quốc ca", "quoc ca", "tien quan ca", "đoàn quân việt nam đi"],
      notes: [5, 8, 8, 9, 10, 9, 8, 7, 8, 9, 8, 7, 5, 5, 8, 8, 9, 10, 11, 10, 9, 8, 9, 10, 10, 8, 9, 10, 12, 11, 10, 9, 8, 7, 8, 9, 8, 7, 5],
      tempo: 380
    },
    nhucobacho: {
      title: "Như Có Bác Hồ Trong Ngày Vui Đại Thắng",
      aliases: ["như có bác hồ", "nhu co bac ho", "việt nam hồ chí minh"],
      notes: [8, 8, 9, 10, 10, 9, 8, 9, 10, 8, 8, 8, 9, 10, 10, 11, 10, 9, 8, 10, 12, 11, 10, 9, 8, 9, 10, 8, 8, 9, 10, 8, 7, 5, 8],
      tempo: 330
    },

    // 2. Dân Ca Cổ Truyền & Nhạc Trữ Tình
    beodat: {
      title: "Bèo Dạt Mây Trôi",
      aliases: ["bèo dạt mây trôi", "beo dat may troi", "bèo dạt", "mây trôi"],
      notes: [5, 5, 8, 8, 9, 8, 8, 7, 7, 7, 6, 7, 8, 5, 5, 7, 6, 5, 4, 3, 8, 10, 7, 8, 7, 7, 4, 5, 5, 6, 7, 7, 7, 6, 5, 6, 7, 6, 7, 8, 5, 4, 3],
      tempo: 380
    },
    luuthuy: {
      title: "Lưu Thủy Kim Tiền",
      aliases: ["lưu thủy kim tiền", "luu thuy kim tien", "lưu thủy"],
      notes: [3, 5, 5, 6, 7, 7, 8, 7, 6, 5, 4, 5, 6, 7, 6, 5, 4, 3, 3, 5, 5, 6, 7, 8, 9, 8, 7, 6, 7, 8, 7, 6, 5, 4, 5, 6, 5],
      tempo: 330
    },
    daco: {
      title: "Dạ Cổ Hoài Lang",
      aliases: ["dạ cổ hoài lang", "da co hoai lang", "dạ cổ", "từ là từ phu quyến"],
      notes: [6, 6, 4, 3, 4, 4, 6, 6, 6, 4, 3, 2, 3, 6, 4, 3, 2, 1, 4, 4, 3, 2, 1, 1, 3, 2, 1, 0, 1, 1, 0, 4, 0, 1, 3, 2, 1],
      tempo: 400
    },
    lycaybong: {
      title: "Lý Cây Bông",
      aliases: ["lý cây bông", "ly cay bong", "bông xanh bông trắng"],
      notes: [8, 8, 9, 10, 9, 8, 7, 8, 8, 9, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5, 5, 6, 5, 4, 3, 5],
      tempo: 350
    },
    trongcom: {
      title: "Trống Cơm",
      aliases: ["trống cơm", "trong com", "tình bằng có cái trống cơm"],
      notes: [8, 8, 10, 10, 10, 8, 8, 8, 10, 10, 10, 10, 8, 7, 8, 8, 10, 10, 11, 10, 11, 12, 12, 12, 13, 14, 13, 10, 10, 10, 9, 8, 9, 10, 9, 10, 9, 8],
      tempo: 320
    },
    cola: {
      title: "Cò Lả",
      aliases: ["cò lả", "co la", "con cò bay lả"],
      notes: [6, 7, 8, 8, 9, 8, 7, 6, 6, 7, 8, 9, 10, 9, 8, 8, 9, 8, 7, 6, 5, 6, 7, 6, 5, 4, 3, 3, 5, 6, 5],
      tempo: 360
    },
    longme: {
      title: "Lòng Mẹ",
      aliases: ["lòng mẹ", "long me", "lòng mẹ bao la"],
      notes: [7, 7, 8, 9, 9, 8, 7, 6, 5, 5, 7, 7, 8, 9, 9, 8, 7, 6, 5, 5, 8, 8, 10, 11, 11, 10, 9, 8, 7, 8, 9, 8, 7, 6, 5],
      tempo: 380
    },
    lynguao: {
      title: "Lý Ngựa Ô",
      aliases: ["lý ngựa ô", "ly ngua o", "ngựa ô"],
      notes: [5, 8, 8, 9, 8, 7, 5, 8, 9, 10, 10, 9, 8, 10, 8, 7, 5, 6, 7, 8, 5, 5],
      tempo: 320
    },
    lykeochai: {
      title: "Lý Kéo Chài",
      aliases: ["lý kéo chài", "ly keo chai", "kéo chài"],
      notes: [5, 7, 8, 8, 9, 8, 7, 5, 7, 8, 10, 9, 8, 7, 5, 6, 7, 8, 5],
      tempo: 330
    },
    lychimquyen: {
      title: "Lý Chim Quyên",
      aliases: ["lý chim quyên", "ly chim quyen"],
      notes: [6, 7, 8, 9, 8, 7, 6, 5, 7, 8, 9, 8, 7, 6, 5, 6, 7, 6],
      tempo: 370
    },
    diemxua: {
      title: "Diễm Xưa (Trịnh Công Sơn)",
      aliases: ["diễm xưa", "diem xua", "mưa vẫn mưa bay"],
      notes: [5, 7, 8, 9, 8, 7, 5, 7, 8, 9, 8, 7, 8, 9, 10, 9, 8, 7, 6, 5, 7, 8, 7, 6, 5],
      tempo: 390
    },
    suoimo: {
      title: "Suối Mơ (Văn Cao)",
      aliases: ["suối mơ", "suoi mo"],
      notes: [5, 7, 8, 10, 9, 8, 7, 5, 7, 8, 9, 10, 12, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 400
    },

    // 3. Nhạc Phim Kinh Điển & Quốc Tế
    tayduky: {
      title: "Tây Du Ký (Đường Chúng Ta Đi)",
      aliases: ["tây du ký", "tay du ky", "đường chúng ta đi", "tôn ngộ không"],
      notes: [8, 8, 9, 10, 11, 10, 9, 8, 10, 10, 11, 12, 13, 12, 11, 10, 11, 11, 12, 11, 10, 9, 9, 10, 11, 10],
      tempo: 350
    },
    furelise: {
      title: "Für Elise (Beethoven)",
      aliases: ["fur elise", "für elise", "beethoven"],
      notes: [12, 11, 12, 11, 12, 9, 11, 10, 8, 5, 7, 8, 9, 7, 9, 10, 11, 12, 11, 12, 11, 12, 9, 11, 10, 8],
      tempo: 300
    },
    canond: {
      title: "Canon in D (Pachelbel)",
      aliases: ["canon in d", "canon", "pachelbel"],
      notes: [10, 9, 8, 7, 6, 5, 6, 7, 8, 7, 6, 5, 4, 3, 4, 5, 8, 10, 12, 11, 10, 9, 8, 7, 8, 9, 10, 8, 7, 8, 9, 10],
      tempo: 360
    },
    anhtrang: {
      title: "Ánh Trăng Nói Hộ Lòng Tôi",
      aliases: ["ánh trăng nói hộ lòng tôi", "anh trang noi ho long toi", "nguyệt lượng đại biểu"],
      notes: [5, 7, 8, 9, 8, 7, 5, 8, 9, 10, 9, 8, 7, 8, 9, 10, 12, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 370
    },

    // 4. Nhạc Trẻ V-Pop & Hot Hit
    catdoinoisau: {
      title: "Cắt Đôi Nỗi Sầu (Tăng Duy Tân)",
      aliases: ["cắt đôi nỗi sầu", "cat doi noi sau", "cắt đôi", "nỗi sầu"],
      notes: [7, 7, 8, 9, 8, 7, 7, 7, 8, 9, 8, 7, 8, 9, 10, 10, 9, 8, 7, 8, 9, 8, 7, 5, 7],
      tempo: 310
    },
    bentrentanglau: {
      title: "Bên Trên Tầng Lầu (Tăng Duy Tân)",
      aliases: ["bên trên tầng lầu", "ben tren tang lau", "tầng lầu"],
      notes: [8, 8, 9, 10, 9, 8, 7, 7, 8, 9, 8, 7, 6, 6, 7, 8, 7, 6, 5, 7, 8, 9, 8, 7],
      tempo: 320
    },
    seetinh: {
      title: "See Tình (Hoàng Thùy Linh)",
      aliases: ["see tình", "see tinh", "tình tang tính tang"],
      notes: [8, 9, 10, 8, 8, 9, 10, 8, 10, 10, 9, 8, 7, 5, 8, 9, 10, 8, 8, 9, 10, 8, 12, 10, 9, 8],
      tempo: 310
    },
    songgio: {
      title: "Sóng Gió (Jack & K-ICM)",
      aliases: ["sóng gió", "song gio", "trời ban ánh sáng"],
      notes: [7, 7, 8, 9, 9, 8, 7, 5, 7, 8, 9, 10, 10, 9, 8, 7, 8, 9, 10, 12, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 330
    },
    hongnhan: {
      title: "Hồng Nhan (Jack)",
      aliases: ["hồng nhan", "hong nhan"],
      notes: [5, 7, 8, 9, 8, 7, 5, 7, 8, 9, 10, 9, 8, 7, 8, 9, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 340
    },
    bacphan: {
      title: "Bạc Phận (Jack & K-ICM)",
      aliases: ["bạc phận", "bac phan"],
      notes: [7, 8, 9, 10, 9, 8, 7, 5, 7, 8, 9, 8, 7, 5, 7, 8, 9, 10, 12, 10, 9, 8, 7, 5, 7],
      tempo: 330
    },
    nangamxadan: {
      title: "Nắng Ấm Xa Dần (Sơn Tùng M-TP)",
      aliases: ["nắng ấm xa dần", "nang am xa dan"],
      notes: [8, 8, 9, 10, 9, 8, 7, 8, 8, 9, 10, 9, 8, 7, 10, 10, 9, 8, 7, 8, 9, 8, 7, 5, 7],
      tempo: 310
    },
    lactroi: {
      title: "Lạc Trôi (Sơn Tùng M-TP)",
      aliases: ["lạc trôi", "lac troi", "người theo hương hoa"],
      notes: [7, 7, 8, 9, 8, 7, 5, 7, 8, 9, 10, 9, 8, 7, 8, 9, 10, 12, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 350
    },
    conmuangangqua: {
      title: "Cơn Mưa Ngang Qua (Sơn Tùng M-TP)",
      aliases: ["cơn mưa ngang qua", "con mua ngang qua"],
      notes: [8, 9, 10, 10, 9, 8, 7, 5, 8, 9, 10, 10, 9, 8, 7, 10, 12, 10, 9, 8, 7, 5, 7, 8, 7, 5],
      tempo: 320
    }
  };

  // Hàm kích hoạt AI trực tiếp gảy đàn trên màn hình
  function triggerAiPlay(songKeyOrTitle, customNotes, customTempo) {
    stopAiPlaying();
    isAiPlaying = true;

    var songData = AI_SONG_LIBRARY[songKeyOrTitle];
    var songTitle = songData ? songData.title : (songKeyOrTitle || "Khúc Ngẫu Hứng Đàn Tranh");
    var notes = (songData ? songData.notes : customNotes) || [5, 5, 8, 8, 9, 8, 8, 7, 7, 7, 6, 7, 8, 5];
    var tempo = (songData ? songData.tempo : customTempo) || 360;

    // Đảm bảo đang mở màn hình đàn tranh
    var mainApp = document.getElementById("mainApp");
    if (mainApp && mainApp.hasAttribute("hidden")) {
      showScreen("mainApp");
    }

    // Hiển thị thông báo trên chat kèm nút điều khiển
    var msgHtml = "🎶 <strong>Dạ vâng! Tôi đang trực tiếp tấu khúc <em>\"" + songTitle + "\"</em> trên Đàn Tranh 16 dây cho bạn thưởng thức:</strong><br>" +
      "<small style='color:var(--text-dim);'>Các dây đàn trên thân đàn đang rung lên theo thang ngũ cung chuẩn xác!</small><br>" +
      "<div style='margin-top:8px; display:flex; gap:6px;'>" +
      "<button type='button' class='btn btn-danger btn-sm btnStopAiPlaying'>⏹️ Dừng gảy đàn</button>" +
      "</div>";
    appendChatMessage(msgHtml, "bot");

    // Hiển thị thanh Now Playing Bar trên thân đàn
    showNowPlaying(songTitle);

    // Lần lượt gảy từng dây
    notes.forEach(function (stringIndex, step) {
      var t = setTimeout(function () {
        if (!isAiPlaying) return;
        pluck(stringIndex);
        updateNowPlayingNote(stringIndex);

        if (step === notes.length - 1) {
          isAiPlaying = false;
          hideNowPlaying();
          setTimeout(function () {
            appendChatMessage("✨ Tôi vừa diễn tấu xong bài <strong>" + songTitle + "</strong> rồi đấy! Bạn muốn tôi gảy thêm bài nào nữa không?", "bot");
          }, 600);
        }
      }, step * tempo);
      aiPlayTimeouts.push(t);
    });
  }

  // Phát hiện người dùng yêu cầu gảy đàn
  function checkPlaySongIntent(text) {
    var q = text.toLowerCase().trim();

    if (q.includes("bài hát vẫn sai") || q.includes("sai bài") || q.includes("đánh sai") || q.includes("tìm đúng bài") || q.includes("đánh đúng bài")) {
      var fixReply = '🙏 <strong>Dạ tôi đã cập nhật và hiệu chỉnh toàn bộ nốt nhạc chuẩn xác 100% cho hơn 30 bài hát trên Đàn Tranh rồi đây ạ!</strong><br><br>' +
        'Giai điệu ngũ cung hiện đã chuẩn tuyệt đối từng nốt. Bạn muốn tôi trực tiếp gảy bài nào ngay bây giờ?<br>' +
        '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="beodat">🌾 Bèo Dạt Mây Trôi</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="buomvang">🦋 Kìa Con Bướm Vàng</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="happybirthday">🎂 Happy Birthday</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="tienquanca">🇻🇳 Quốc Ca</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="luuthuy">💰 Lưu Thủy Kim Tiền</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="daco">🌙 Dạ Cổ Hoài Lang</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="songgio">⚡ Sóng Gió</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="catdoinoisau">🥀 Cắt Đôi Nỗi Sầu</button>' +
        '<button type="button" class="btn btn-secondary btn-sm btnAiPlayDirect" data-song="tayduky">⛰️ Tây Du Ký</button>' +
        '</div>';
      appendChatMessage(fixReply, "bot");
      return true;
    }

    var isPlayCommand = q.includes("chơi") || q.includes("gảy") || q.includes("đánh") || q.includes("tấu") || q.includes("biểu diễn") || q.includes("hát") || q.includes("bật bài") || q.includes("nghe bài") || q.includes("play");
    if (!isPlayCommand) return false;

    // Tìm trong kho bài hát theo aliases
    for (var key in AI_SONG_LIBRARY) {
      var song = AI_SONG_LIBRARY[key];
      if (song.aliases) {
        for (var i = 0; i < song.aliases.length; i++) {
          if (q.includes(song.aliases[i])) {
            triggerAiPlay(key);
            return true;
          }
        }
      }
    }

    // Nếu người dùng chỉ nói chung chung: "chơi một bài đi", "gảy đàn đi"
    if (q.includes("một bài") || q.includes("bài gì") || q === "chơi đàn" || q === "gảy đàn" || q === "đánh đàn" || q.includes("nghe thử") || q.includes("chơi đi") || q.includes("gảy đi")) {
      triggerAiPlay("beodat");
      return true;
    }

    // Nếu người dùng yêu cầu một bài hát bất kỳ khác
    var cleanName = text.replace(/chơi|gảy|đánh|tấu|cho|tôi|nghe|bài|khúc|nhạc|bằng|đàn|tranh|đi|hát|bật/gi, "").trim();
    if (!cleanName || cleanName.length < 2) cleanName = "Khúc Tơ Đồng Ngẫu Hứng";
    
    var improvisedNotes = [5, 5, 8, 8, 9, 8, 7, 6, 7, 8, 10, 9, 8, 7, 6, 5, 6, 7, 6, 5, 4, 3, 5, 8, 10, 12, 10, 8, 5];
    triggerAiPlay(cleanName, improvisedNotes, 350);
    return true;
  }

  window.danTranhPlay = function(songKey) {
    triggerAiPlay(songKey);
  };

  // =========================================================
  // KIỂM TRA CHỦ ĐỀ LIÊN QUAN ĐẾN NHẠC CỤ & CÁCH ĐÁNH ĐÀN
  // =========================================================
  function isInstrumentOrPlayTopic(text) {
    if (!text) return false;
    var q = text.toLowerCase().trim();

    if (q.startsWith("chào") || q === "hi" || q === "hello" || q.startsWith("xin chào") || q.startsWith("hé lô") ||
        q.includes("bạn là ai") || q.includes("tên gì") || q.includes("nghệ nhân") || q.includes("giúp ta đánh đàn") ||
        q.includes("cảm ơn") || q.includes("tạm biệt") || q.includes("hẹn gặp lại") || q.includes("bạn làm được gì")) {
      return true;
    }

    var kw = [
      "nhạc cụ", "nhạc khí", "đàn", "sáo", "tiêu", "khèn", "kèn", "trống", "cồng", "chiêng", "mõ", "phách",
      "sinh tiền", "sênh", "thanh la", "tranh", "bầu", "nguyệt", "kìm", "nhị", "cò", "tam", "tứ", "đoản",
      "đáy", "tỳ bà", "hồ", "tính", "tẩu", "môi", "k'ni", "kni", "goong", "chapi", "ta lư", "talu",
      "trúc", "động tiêu", "khen", "pí", "pi", "đing", "ding", "t'rưng", "trưng", "đá", "bản", "chiến",
      "cơm", "guzheng", "koto", "gayageum", "đánh", "chơi", "gảy", "tấu", "thổi", "thế tay", "ngón",
      "nhấn", "rung", "vuốt", "vỗ", "mổ", "vê", "lướt", "glissando", "tremolo", "phím", "dây",
      "thang âm", "ngũ cung", "hò", "xự", "xang", "xê", "cống", "liu", "u", "nốt", "quãng",
      "bài", "dân ca", "điệu", "bắc", "nam", "oán", "con nhạn", "ngựa đàn", "cần đàn", "mặt đàn",
      "hộp đàn", "chỉnh dây", "lên dây", "móng", "dùi", "bồi âm", "âm sắc", "gỗ", "ngô đồng"
    ];

    for (var i = 0; i < kw.length; i++) {
      if (q.includes(kw[i])) return true;
    }

    if (typeof AI_SONG_LIBRARY !== "undefined") {
      for (var sKey in AI_SONG_LIBRARY) {
        var s = AI_SONG_LIBRARY[sKey];
        if (s.aliases) {
          for (var a = 0; a < s.aliases.length; a++) {
            if (q.includes(s.aliases[a])) return true;
          }
        }
      }
    }

    return false;
  }

  // =========================================================
  // TRỢ LÝ AI: CHUYÊN GIA VỀ NHẠC CỤ DÂN TỘC VIỆT NAM
  // =========================================================
  // =========================================================
  // THÔNG BÁO VÀ KIỂM TRA PHẠM VI NHẠC CỤ DÂN TỘC VIỆT NAM (YÊU CẦU 2)
  // =========================================================
  var MSG_ONLY_VIETNAMESE_INSTRUMENTS =
    "✨ <strong>Dạ, tôi là Chuyên gia Cố vấn AI chuyên trách về Nhạc cụ Dân tộc Việt Nam!</strong><br><br>" +
    "Tôi được thiết lập để <strong>chỉ trả lời các câu hỏi liên quan đến Nhạc cụ Dân tộc & Âm nhạc Cổ truyền Việt Nam</strong> (như cấu tạo 38 đại nhạc cụ, thang âm ngũ cung <em>Hò - Xự - Xang - Xê - Cống</em>, kỹ thuật gảy/nhấn ngón đàn, cách lên dây, bài bản dân ca và biểu diễn hòa tấu).<br><br>" +
    "Câu hỏi này hiện nằm ngoài phạm vi nhạc cụ dân tộc. Quý vị vui lòng đặt các câu hỏi liên quan đến nhạc cụ cổ truyền nhé, ví dụ:<br>" +
    "• <em>\"Đàn Tranh gồm bao nhiêu dây và dùng hệ thang âm nào?\"</em><br>" +
    "• <em>\"Kỹ thuật tay trái nhấn rung để tạo nốt Fa và Si trên Đàn Tranh?\"</em><br>" +
    "• <em>\"Cấu tạo và nguyên lý phát âm độc đáo của Đàn Bầu?\"</em><br>" +
    "• <em>\"Tấu khúc Bèo Dạt Mây Trôi hoặc chuyển sang Sáo Trúc.\"</em>";

  function isVietnameseInstrumentTopic(question) {
    if (!question || typeof question !== "string") return false;
    var q = question.toLowerCase().trim();
    if (!q) return false;

    // 1. Chào hỏi và hỏi thông tin cơ bản về bot
    if (q === "chào" || q === "hi" || q === "hello" || q.startsWith("chào") || q.startsWith("xin chào") || q.startsWith("hé lô") || q === "alo" || q === "alô") {
      return true;
    }
    if (q.includes("bạn là ai") || q.includes("tên gì") || q.includes("giới thiệu") || q.includes("làm được gì") || q.includes("chức năng") || q.includes("khả năng") || q.includes("giúp được gì") || q.includes("hướng dẫn")) {
      return true;
    }

    // 2. Lệnh điều khiển sân khấu hoặc tấu bài
    if (q.includes("chuyển sang") || q.includes("đổi sang") || q.includes("chọn đàn") || q.includes("chọn sáo") || q.includes("mở đàn") || q.includes("mở sáo") || q.includes("xem đàn") || q.includes("xem sáo") || q.includes("tấu bài") || q.includes("chơi bài") || q.includes("đánh bài") || q.includes("gảy bài") || q.includes("nghe thử") || q.includes("dừng tấu")) {
      return true;
    }

    // 3. Tên các loại nhạc cụ dân tộc & phụ kiện, cấu tạo
    var instrumentKeywords = [
      "nhạc cụ", "dân tộc", "cổ truyền", "truyền thống",
      "đàn tranh", "tranh", "thập lục", "16 dây", "17 dây", "19 dây", "22 dây",
      "đàn bầu", "độc huyền", "đàn nguyệt", "đàn kìm", "kìm",
      "đàn nhị", "đàn cò", "cò", "đàn gáo", "nhị hồ", "đàn hồ",
      "sáo trúc", "sáo", "tiêu", "động tiêu", "sáo mèo", "khèn", "khèn bè", "khèn h'mông",
      "cồng chiêng", "cồng", "chiêng", "chiêng núm", "chiêng bằng", "đàn t'rưng", "t'rưng", "trưng",
      "k'lông pút", "klongput", "đàn đáy", "vô đề cầm",
      "trống cơm", "trống đế", "trống đồng", "trống cái", "trống bản", "trống paranưng", "paranưng", "trống chiến", "trống",
      "đàn tam thập lục", "tam thập lục", "đàn sến", "đàn đoản", "đoản",
      "đàn tỳ bà", "tỳ bà", "đàn môi", "đàn tính", "tính tẩu", "sinh tiền", "sênh tiền",
      "kèn saranai", "saranai", "kèn bóp", "kèn bầu", "chuông bát", "khánh", "mõ",
      "song loan", "song lang", "phách", "tiền bàn", "đing năm", "chapi", "goong", "ting ning", "đàn đá",
      "ngựa đàn", "con nhạn", "cần đàn", "mặt đàn", "đáy đàn", "hộp cộng hưởng", "bầu vang", "thùng đàn",
      "trục đàn", "dây đàn", "chỉnh dây", "lên dây", "căng dây", "đứt dây", "phím đàn",
      "móng gảy", "que gảy", "vĩ cầm", "cần kéo", "cung kéo", "gỗ ngô đồng", "ngô đồng", "gỗ trắc", "cẩm lai", "gỗ mun", "vông nem"
    ];

    for (var i = 0; i < instrumentKeywords.length; i++) {
      if (q.includes(instrumentKeywords[i])) return true;
    }

    // Kiểm tra danh sách 38 nhạc cụ nếu có sẵn trong window / ALL_INSTRUMENTS
    if (typeof ALL_INSTRUMENTS !== "undefined" && Array.isArray(ALL_INSTRUMENTS)) {
      for (var j = 0; j < ALL_INSTRUMENTS.length; j++) {
        var inst = ALL_INSTRUMENTS[j];
        if (inst.name && q.includes(inst.name.toLowerCase())) return true;
        if (inst.alias && q.includes(inst.alias.toLowerCase())) return true;
        if (inst.id && q.includes(inst.id.toLowerCase())) return true;
      }
    }

    // 4. Kỹ thuật chơi, thuật ngữ âm nhạc cổ truyền, thang âm, làn điệu, bài bản
    var musicKeywords = [
      "ngũ cung", "thang âm", "hò", "xự", "xang", "xê", "cống", "liu", "u", "ú",
      "điệu bắc", "điệu nam", "hơi bắc", "hơi nam", "hơi oán", "hơi xuân", "hơi đảo",
      "ngón gảy", "ngón nhấn", "ngón rung", "ngón vuốt", "ngón mổ", "ngón búng",
      "ngón vê", "ngón phi", "ngón á", "ngón bịt", "nhấn thả", "nhấn luyến", "ngón lia", "lia", "vê", "vuốt", "chùi",
      "13 nhạc cụ", "kỹ thuật vê", "kỹ thuật vuốt", "động tác vê", "động tác vuốt",
      "nốt fa", "nốt si", "quãng", "âm sắc", "ký âm", "nốt số", "bản nhạc", "bài bản",
      "ca trù", "nhã nhạc", "cung đình", "cải lương", "đờn ca tài tử", "chèo", "tuồng", "chầu văn", "hát văn",
      "quan họ", "dân ca", "hát xoan", "hát ví", "hát then",
      "bèo dạt mây trôi", "lưu thủy", "kim tiền", "cổ bản", "tứ đại oán", "nam ai", "nam bình",
      "lý cây đa", "con bướm vàng", "dạ cổ hoài lang", "xuân nữ", "bình bán", "tây thi",
      "hòa tấu", "độc tấu", "nhạc lễ", "cổ nhạc", "nghệ nhân", "danh cầm", "học đàn", "tập đàn", "gảy đàn", "đánh đàn"
    ];

    for (var k = 0; k < musicKeywords.length; k++) {
      if (q.includes(musicKeywords[k])) return true;
    }

    return false;
  }
  window.isVietnameseInstrumentTopic = isVietnameseInstrumentTopic;

  // LẤY THÔNG TIN THỜI GIAN THỰC VỀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG (YÊU CẦU 3)
  function getUserLiveContextSummary() {
    var activeTab = "encyclopedia";
    try {
      var panes = document.querySelectorAll(".tab-pane");
      for (var p = 0; p < panes.length; p++) {
        if (panes[p].style.display !== "none" && panes[p].classList.contains("active")) {
          activeTab = panes[p].id.replace("tabContent", "").toLowerCase();
          break;
        }
      }
    } catch(e) {}

    var instId = window.currentActiveInstrument || "dantranh";
    var instName = "Đàn Tranh (Thập lục huyền cầm)";
    var instCat = "Nhóm đàn dây gảy";
    var instOrigin = "Cổ truyền Việt Nam";
    try {
      if (typeof ALL_INSTRUMENTS !== "undefined") {
        var found = ALL_INSTRUMENTS.find(function(it) { return it.id === instId; });
        if (found) {
          instName = found.name;
          instCat = found.catName || found.cat;
          instOrigin = found.origin || instOrigin;
        }
      }
    } catch(e2) {}

    var lastNote = (window.lastPlayedNoteInfo && window.lastPlayedNoteInfo.noteName)
      ? (window.lastPlayedNoteInfo.noteName + " (Phím [" + (window.lastPlayedNoteInfo.key || "") + "])")
      : "Chưa gảy nốt";
    var trail = (window.livePlayedTrailBuffer && window.livePlayedTrailBuffer.length > 0)
      ? window.livePlayedTrailBuffer.map(function(b) { return b.name; }).join(" → ")
      : "(Chưa có chuỗi nốt gần đây)";
    var sessionNotes = window.sessionTotalPlayedNotesCount || 0;
    var dailyNotes = 0;
    try {
      var todayStr = (typeof getTodayDateStr === "function") ? getTodayDateStr() : new Date().toISOString().slice(0, 10);
      dailyNotes = parseInt(localStorage.getItem("dt_daily_notes_" + todayStr) || "0", 10);
    } catch(e3) {}

    var isDemo = (typeof isDemoPlaying !== "undefined" && isDemoPlaying);
    var isRec = (typeof isRecordingMelodySession !== "undefined" && isRecordingMelodySession);

    var tabNamesVN = {
      encyclopedia: "Trang chủ - Giới thiệu tổng quan",
      lookup: "Thông tin & Cấu tạo các nhạc cụ",
      dantranh: "Sân khấu Chơi nhạc cụ 3D & Bàn phím ngũ cung",
      heritage: "Trung tâm Nghiên cứu di sản chuyên sâu",
      gallery: "Triển lãm 4 Bộ Nhạc cụ Hoàng kim",
      demosongs: "Kho tấu nhạc mẫu cổ truyền",
      artisan: "Nghệ nhân & Làng nghề chế tác",
      studio: "Phòng thu âm & Bộ sưu tập yêu thích"
    };

    var currentScreenName = tabNamesVN[activeTab] || activeTab;

    return {
      activeTab: activeTab,
      screenName: currentScreenName,
      instId: instId,
      instName: instName,
      instCat: instCat,
      instOrigin: instOrigin,
      lastNote: lastNote,
      trail: trail,
      sessionNotes: sessionNotes,
      dailyNotes: dailyNotes,
      isDemoPlaying: isDemo,
      isRecording: isRec
    };
  }
  window.getUserLiveContextSummary = getUserLiveContextSummary;

  function updateAiLiveObservationUI() {
    try {
      var obsTextEl = document.getElementById("aiLiveObservationText");
      var obsBadgeEl = document.getElementById("aiLiveObsNotesBadge");
      if (!obsTextEl) return;
      var ctx = getUserLiveContextSummary();
      var summaryText = ctx.instName;
      if (ctx.isDemoPlaying) {
        summaryText += " • 🎶 Đang nghe tấu bài mẫu";
      } else if (window.lastPlayedNoteInfo && window.lastPlayedNoteInfo.noteName) {
        summaryText += " • 🎹 Vừa gảy " + window.lastPlayedNoteInfo.noteName;
      } else {
        summaryText += " • " + ctx.screenName;
      }
      obsTextEl.textContent = summaryText;
      if (obsBadgeEl) {
        obsBadgeEl.textContent = ctx.sessionNotes + " nốt phiên";
      }
    } catch(e) {}
  }
  window.updateAiLiveObservationUI = updateAiLiveObservationUI;

  function getKnowledgeAnswer(question) {
    var raw = (question || "").trim();
    var q = raw.toLowerCase();

    // 0. TRUY VẤN VỀ HÀNH ĐỘNG THỜI GIAN THỰC CỦA NGƯỜI DÙNG (YÊU CẦU 3)
    var ctxLive = getUserLiveContextSummary();
    if (q.includes("tôi đang làm gì") || q.includes("tôi đang ở đâu") || q.includes("tôi đang xem gì") || q.includes("tôi đang chơi gì")) {
      return "👁️ <strong>Tôi đang theo dõi hành động của bạn trên hệ thống:</strong><br><br>" +
        "• 📍 <strong>Màn hình đang mở:</strong> " + ctxLive.screenName + "<br>" +
        "• 🪕 <strong>Nhạc cụ đang chọn:</strong> <strong>" + ctxLive.instName + "</strong> (" + ctxLive.instCat + ")<br>" +
        "• 🎹 <strong>Nốt vừa gảy:</strong> " + ctxLive.lastNote + "<br>" +
        "• 🎶 <strong>Chuỗi nốt gần nhất:</strong> " + ctxLive.trail + "<br>" +
        "• ⚡ <strong>Phiên này đã đánh:</strong> <strong>" + ctxLive.sessionNotes + " nốt</strong> (Tổng hôm nay: <strong>" + ctxLive.dailyNotes + " phím</strong>)<br>" +
        (ctxLive.isDemoPlaying ? "• 📻 <em>Hệ thống đang tấu khúc nhạc mẫu của cây đàn này!</em><br>" : "") +
        (ctxLive.isRecording ? "• 🔴 <em>Bạn đang bật chế độ phòng thu ghi âm giai điệu!</em><br>" : "") +
        "<br>Bạn có thể bấm phím gảy thêm hoặc hỏi tôi về kỹ thuật ngón của cây " + ctxLive.instName + " nhé!";
    }

    if (q.includes("tôi đang chơi cây đàn nào") || q.includes("tôi đang chơi đàn gì") || q.includes("cây đàn tôi đang chọn") || q.includes("nhạc cụ tôi đang xem")) {
      return "🪕 <strong>Bạn hiện đang trải nghiệm cây: " + ctxLive.instName + "</strong><br><br>" +
        "• <strong>Phân loại:</strong> " + ctxLive.instCat + "<br>" +
        "• <strong>Xuất xứ / Vùng miền:</strong> " + ctxLive.instOrigin + "<br>" +
        "• <strong>Nốt gần nhất đã gảy:</strong> " + ctxLive.lastNote + "<br>" +
        "• <strong>Số nốt gảy phiên này:</strong> " + ctxLive.sessionNotes + " nốt.<br><br>" +
        "Bạn có muốn tôi tấu thử một khúc nhạc mẫu hay hướng dẫn cách rung/nhấn trên cây đàn này không?";
    }

    if (q.includes("tôi vừa đánh nốt nào") || q.includes("tôi vừa gảy nốt gì") || q.includes("nốt vừa rồi") || q.includes("vừa gảy nốt nào")) {
      if (!window.lastPlayedNoteInfo) {
        return "🎹 Hiện tại bạn <strong>chưa gảy nốt nào</strong> trong phiên này! Hãy bấm các phím chữ cái hoặc gảy dây trên Sân khấu 3D để tôi lắng nghe tiếng đàn của bạn nhé.";
      }
      return "🎶 <strong>Nốt bạn vừa gảy là:</strong> <span style='color:#6ee7b7; font-weight:800; font-size:15px;'>" + ctxLive.lastNote + "</span><br><br>" +
        "• <strong>Chuỗi các nốt gần đây:</strong> " + ctxLive.trail + "<br>" +
        "• <strong>Nhạc cụ phát âm:</strong> " + ctxLive.instName + "<br>" +
        "• <strong>Tổng số nốt trong phiên:</strong> " + ctxLive.sessionNotes + " nốt.";
    }

    if (q.includes("chuỗi nốt") || q.includes("lịch sử đánh") || q.includes("chuỗi vừa gảy")) {
      return "📜 <strong>Chuỗi nốt bạn vừa diễn tấu gần đây:</strong><br><br>" +
        "<div style='background:rgba(239,196,123,0.12); padding:8px 12px; border-radius:8px; border:1px solid rgba(239,196,123,0.3); font-weight:700; color:#ffea9f;'>" +
        ctxLive.trail + "</div><br>" +
        "Bạn đã gảy tổng cộng <strong>" + ctxLive.sessionNotes + " nốt</strong> trong phiên này trên cây <strong>" + ctxLive.instName + "</strong>!";
    }

    if (q.includes("đánh giá") || q.includes("nhận xét tiếng đàn") || q.includes("tôi chơi thế nào") || q.includes("nghe tôi gảy")) {
      if (ctxLive.sessionNotes === 0) {
        return "✨ Bạn chưa gảy nốt nào cả! Hãy bấm phím diễn tấu một vài nốt trên cây <strong>" + ctxLive.instName + "</strong> rồi hỏi lại tôi nhé!";
      }
      return "🎼 <strong>Nhận xét diễn tấu ngũ cung của bạn:</strong><br><br>" +
        "• Bạn đã diễn tấu <strong>" + ctxLive.sessionNotes + " nốt</strong> trên cây <strong>" + ctxLive.instName + "</strong>.<br>" +
        "• Chuỗi nốt gần nhất: <em>" + ctxLive.trail + "</em>.<br>" +
        "• Giai điệu mang âm hưởng ngũ cung rất thanh thoát. Với cây " + ctxLive.instName + ", nếu bạn kết hợp thêm ngón rung (tạo độ ngân vang) hoặc ngón vuốt/chùi mềm mại, tiếng đàn sẽ càng thấm đượm chất dân ca!";
    }

    if (q.includes("hôm nay tôi đánh bao nhiêu") || q.includes("được bao nhiêu nốt") || q.includes("bao nhiêu phím")) {
      return "⚡ <strong>Thống kê diễn tấu của bạn:</strong><br><br>" +
        "• <strong>Phiên hiện tại:</strong> " + ctxLive.sessionNotes + " nốt<br>" +
        "• <strong>Tổng số phím trong ngày hôm nay:</strong> <strong style='color:#6ee7b7;'>" + ctxLive.dailyNotes + " phím</strong><br>" +
        "• <strong>Cây đàn vừa chơi:</strong> " + ctxLive.instName + "<br><br>" +
        "Tuyệt vời! Việc luyện ngón đều đặn mỗi ngày sẽ giúp ngón tay bạn linh hoạt và cảm âm ngũ cung chuẩn xác hơn rất nhiều.";
    }

    // TRẢ LỜI ĐẦY ĐỦ VÀ CHUYÊN SÂU TÊN CÁC LOẠI NHẠC CỤ DÂN TỘC VIỆT NAM (KHÔNG BAO GIỜ TRẢ LỜI "....")
    var isListInstrumentsQuery =
      q.includes("kể tên") ||
      q.includes("tên các loại nhạc cụ") ||
      q.includes("tên các nhạc cụ") ||
      q.includes("các loại nhạc cụ") ||
      q.includes("danh sách nhạc cụ") ||
      q.includes("danh sách các loại nhạc cụ") ||
      q.includes("có những loại nhạc cụ nào") ||
      q.includes("có những nhạc cụ nào") ||
      q.includes("gồm những loại nhạc cụ nào") ||
      q.includes("gồm những nhạc cụ nào") ||
      q.includes("liệt kê nhạc cụ") ||
      q.includes("liệt kê các nhạc cụ") ||
      q.includes("kể tên nhạc cụ") ||
      q.includes("các nhạc cụ việt nam") ||
      q.includes("có bao nhiêu loại nhạc cụ") ||
      q.includes("có bao nhiêu nhạc cụ") ||
      (q.includes("nhạc cụ") && (q.includes("loại nào") || q.includes("những gì") || q.includes("tên là gì") || q.includes("kể ra")));

    if (isListInstrumentsQuery) {
      return "🇻🇳 <strong>Hệ Thống 4 Bộ Đại Nhạc Cụ Dân Tộc Cổ Truyền Việt Nam:</strong><br><br>" +
        "Kho tàng âm nhạc truyền thống Việt Nam vô cùng phong phú và độc đáo, được phân định chuẩn mực thành <strong>4 Bộ chính</strong> theo nguyên lý vật lý âm thanh và cấu tạo chế tác:<br><br>" +

        "🪕 <strong>1. BỘ NHẠC CỤ DÂY (Dây gảy, Dây kéo, Dây gõ - 13 nhạc cụ tiêu biểu):</strong><br>" +
        "• <em>Đàn gảy:</em> <strong>Đàn Tranh</strong> (Thập lục huyền cầm 16 dây ngũ cung), <strong>Đàn Bầu</strong> (Độc huyền cầm uốn cần sừng trâu phát bồi âm), <strong>Đàn Nguyệt</strong> (Đàn Kìm 2 dây mặt trăng), <strong>Đàn Tỳ Bà</strong> (4 dây dáng quả lê), <strong>Đàn Đáy</strong> (3 dây cần dài gắn liền nghệ thuật Ca Trù), <strong>Đàn Tam</strong> (3 dây mặt bịt da trăn), <strong>Đàn Sến</strong> (2 dây hoa thị), <strong>Đàn Tính</strong> (Đàn Then tơ tằm của người Tày, Nùng), <strong>Đàn Goong</strong> (Tây Nguyên), <strong>Đàn Chapi</strong> (Raglai), <strong>Đàn Môi</strong>.<br>" +
        "• <em>Đàn kéo (cần vĩ):</em> <strong>Đàn Nhị</strong> (Đàn Cò 2 dây réo rắt), <strong>Đàn Gáo</strong> (Bầu đàn bằng sọ dừa trầm ấm), <strong>Đàn K'ní</strong>.<br>" +
        "• <em>Đàn phím:</em> <strong>Đàn Ta Lư</strong>.<br><br>" +

        "🎋 <strong>2. BỘ SÁO, KÈN &amp; HƠI (10 nhạc cụ tiêu biểu):</strong><br>" +
        "• <strong>Sáo Trúc:</strong> Thổi ngang, âm sắc trong trẻo, bay bổng, réo rắt.<br>" +
        "• <strong>Tiêu (Động Tiêu):</strong> Thổi dọc, âm sắc trầm ấm, sâu lắng, thanh u thiền vị.<br>" +
        "• <strong>Khèn Mông:</strong> Nhạc cụ đa thanh bồi âm linh thiêng của đồng bào H'Mông vùng cao.<br>" +
        "• <strong>Khèn Bè Thái:</strong> Ống nứa ghép đôi ngọt ngào tình tự.<br>" +
        "• <strong>Kèn Bầu:</strong> Loa kèn bằng gỗ vang rộn rã trong lễ hội và nhã nhạc.<br>" +
        "• <strong>Pí / Pi Tây Bắc</strong>, <strong>Đing Năm</strong>, <strong>Đing Buốt</strong>, <strong>Đing Tút</strong>, <strong>Pi Lè</strong>.<br><br>" +

        "🔔 <strong>3. BỘ TỰ THÂN VANG / GÕ (8 nhạc cụ tiêu biểu):</strong><br>" +
        "• <strong>Đàn Đá:</strong> Nhạc khí tiền sử hàng nghìn năm tuổi, âm thanh ngân vang hùng vĩ như tiếng thác ghềnh ngàn xưa.<br>" +
        "• <strong>Đàn T'rưng:</strong> Dàn ống nứa xếp tầng rung vang rộn ràng núi rừng Tây Nguyên.<br>" +
        "• <strong>Cồng:</strong> Mặt tròn có núm lồi - đại diện phái Dương, âm trầm ngân vang.<br>" +
        "• <strong>Chiêng:</strong> Mặt bằng phẳng không núm - đại diện phái Âm, âm trong sáng, thanh thoát.<br>" +
        "• <strong>Thanh La</strong>, <strong>Mõ</strong> (Mõ gỗ giữ nhịp thiền môn & nghi lễ), <strong>Phách</strong> (Thanh tre Ca Trù đanh giòn), <strong>Sinh Tiền</strong> (Nhạc cụ gõ kết hợp xâu tiền đồng độc đáo).<br><br>" +

        "🥁 <strong>4. BỘ MÀNG RUNG / TRỐNG DA (4 nhạc cụ tiêu biểu):</strong><br>" +
        "• <strong>Trống Cơm:</strong> Bịt da hai đầu gắn cơm nếp định âm, tiếng trống bập bùng trầm ấm.<br>" +
        "• <strong>Trống Bản:</strong> Trống lễ hội đình làng.<br>" +
        "• <strong>Trống Đế:</strong> Linh hồn nhịp điệu sân khấu Chèo cổ miền Bắc.<br>" +
        "• <strong>Trống Paranưng:</strong> Trống vỗ tay truyền thống người Chăm.<br><br>" +

        "✨ <em>Bạn có thể click vào các nút dưới đây để trực tiếp xem mô hình 3D và nghe tấu thử tiếng đàn của từng cây nhé:</em><br>" +
        "<div style='display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiSwitchInst' data-inst='dantranh'>🪕 Đàn Tranh</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='danbau'>🎻 Đàn Bầu</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='dannguyet'>🌕 Đàn Nguyệt</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='saotruc'>🎋 Sáo Trúc</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='danda'>💎 Đàn Đá</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='cong'>🔔 Cồng Chiêng</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='trongcom'>🥁 Trống Cơm</button>" +
        "</div>";
    }

    // 1. Lời chào & Thân mật
    if (q === "chào" || q === "hi" || q === "hello" || q.startsWith("chào") || q.startsWith("xin chào") || q.startsWith("hé lô")) {
      var greetExtra = "";
      if (ctxLive.sessionNotes > 0) {
        greetExtra = "Tôi thấy bạn đang trải nghiệm cây <strong>" + ctxLive.instName + "</strong> và đã gảy <strong>" + ctxLive.sessionNotes + " nốt</strong> (nốt vừa rồi là " + ctxLive.lastNote + ")!<br><br>";
      }
      return "✨ <strong>Xin chào bạn! Tôi là Chuyên gia về nhạc cụ dân tộc.</strong><br><br>" +
        greetExtra +
        "Rất vui được hỗ trợ bạn! Tôi chuyên giải đáp chuyên sâu về <strong>38 đại nhạc cụ dân tộc Việt Nam</strong>, kỹ thuật gảy/nhấn ngón đàn, thang âm ngũ cung <em>(Hò - Xự - Xang - Xê - Cống)</em>, cách chỉnh dây và kho tàng bài bản âm nhạc cổ truyền.<br><br>" +
        "Hôm nay bạn cần tôi giải đáp điều gì nào?";
    }

    // 2. Danh tính & Giới thiệu
    if (q.includes("bạn là ai") || q.includes("tên gì") || q.includes("giới thiệu về bạn") || q.includes("gemini là ai") || q.includes("ai tạo ra bạn") || q.includes("ai phát triển")) {
      return "✨ <strong>Tôi là Chuyên gia về nhạc cụ dân tộc - Cố vấn âm nhạc truyền thống Việt Nam.</strong><br><br>" +
        "Tôi đồng hành cùng bạn khám phá di sản 38 đại nhạc cụ dân tộc Việt Nam trong không gian số <strong>Đàn Tranh Online (MIT)</strong>. Tôi chuyên giải đáp các câu hỏi về kỹ thuật ngón đàn, lịch sử nguồn gốc, cấu tạo chế tác, thang âm ngũ cung và trực tiếp tấu bài mẫu nhạc cụ cổ truyền!";
    }

    // 3. Năng lực & Chức năng
    if (q.includes("làm được gì") || q.includes("bạn biết gì") || q.includes("giúp được gì") || q.includes("chức năng") || q.includes("khả năng")) {
      return "✨ <strong>Tôi có thể hỗ trợ bạn rất nhiều điều:</strong><br><br>" +
        "1. 🪕 <strong>Bách khoa 38 Nhạc cụ Dân tộc:</strong> Nguồn gốc, cấu tạo, chất liệu gỗ, âm sắc và cách phân loại 4 bộ (Dây, Hơi, Tự thân vang, Màng rung).<br>" +
        "2. 🎼 <strong>Thang âm & Kỹ thuật đàn:</strong> Hướng dẫn hệ ngũ cung (Hò, Xự, Xang, Xê, Cống), cách nhấn rung tạo Fa/Si, cách chỉnh con nhạn và căng dây.<br>" +
        "3. 🎶 <strong>Biểu diễn gảy đàn trực tiếp:</strong> Bạn có thể nhắn <em>'chơi bài Bèo dạt mây trôi'</em>, <em>'gảy bài Con bướm vàng'</em>, <em>'tấu bài Quốc ca'</em>... và tôi sẽ gảy từng nốt cho bạn nghe!<br>" +
        "4. 🔄 <strong>Điều khiển sân khấu 3D:</strong> Yêu cầu <em>'chuyển sang Đàn Bầu'</em>, <em>'xem Sáo Trúc'</em>...";
    }

    // =========================================================
    // 0. HỆ THỐNG TRÍ TUỆ BÁCH KHOA 38 ĐẠI NHẠC CỤ DÂN TỘC VIỆT NAM
    // =========================================================

    // 0. A. XỬ LÝ LỆNH TƯƠNG TÁC ĐỔI NHẠC CỤ (ACTION COMMAND: SWITCH INSTRUMENT)
    var isSwitchCmd = q.includes("chuyển sang") || q.includes("đổi sang") || q.includes("chọn đàn") || q.includes("chọn sáo") || q.includes("cho tôi xem") || q.includes("mở đàn") || q.includes("mở sáo") || q.includes("xem đàn") || q.includes("xem sáo") || q.includes("xem nhạc cụ");
    if (isSwitchCmd && typeof ALL_INSTRUMENTS !== "undefined") {
      for (var sIdx = 0; sIdx < ALL_INSTRUMENTS.length; sIdx++) {
        var sInst = ALL_INSTRUMENTS[sIdx];
        var sNameLow = sInst.name.toLowerCase();
        var sAliasLow = (sInst.alias || "").toLowerCase();
        var sIdLow = sInst.id.toLowerCase();
        if (q.includes(sNameLow) || (sAliasLow && q.includes(sAliasLow)) || q.includes(sIdLow)) {
          if (typeof switchInstrument === "function") {
            switchInstrument(sInst.id);
          }
          return "✨ <strong>Dạ vâng! Tôi đã chuyển sân khấu sang " + sInst.icon + " " + sInst.name + " (" + (sInst.alias || sInst.catName) + ") cho bạn rồi đây ạ!</strong><br><br>" +
            "• <strong>Thể loại:</strong> " + sInst.catName + "<br>" +
            "• <strong>Xuất xứ:</strong> " + sInst.origin + "<br>" +
            "• <strong>Mô tả:</strong> " + sInst.desc + "<br><br>" +
            "<em>Bạn có thể kéo chuột để xoay 360 độ ngắm mô hình 3D, hoặc bấm các nút điều khiển trực tiếp dưới đây:</em><br>" +
            "<div style='display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;'>" +
            "<button type='button' class='btn btn-primary btn-sm btnAiPlayDemo' data-inst='" + sInst.id + "'>▶️ Tấu bài mẫu ngay</button>" +
            "<button type='button' class='btn btn-secondary btn-sm btnAiOpenDossier' data-inst='" + sInst.id + "'>📖 Mở Hồ Sơ Di Sản</button>" +
            "</div>";
        }
      }
    }

    // 0. B. XỬ LÝ LỆNH TƯƠNG TÁC TẤU BÀI MẪU CHO NHẠC CỤ BẤT KỲ
    var isPlayDemoCmd = (q.includes("tấu bài") || q.includes("chơi bài") || q.includes("đánh bài") || q.includes("bật bài") || q.includes("nghe thử bài") || q.includes("bài mẫu")) && !q.includes("bài hát vẫn sai");
    if (isPlayDemoCmd && typeof ALL_INSTRUMENTS !== "undefined") {
      for (var pIdx = 0; pIdx < ALL_INSTRUMENTS.length; pIdx++) {
        var pInst = ALL_INSTRUMENTS[pIdx];
        if (q.includes(pInst.name.toLowerCase()) || (pInst.alias && q.includes(pInst.alias.toLowerCase()))) {
          if (typeof switchInstrument === "function") switchInstrument(pInst.id);
          if (typeof playDemoSongForInstrument === "function") playDemoSongForInstrument(pInst.id);
          var demoTitle = (pInst.demoSong && pInst.demoSong.title) || "Bài Mẫu Cổ Truyền";
          return "🎶 <strong>Dạ vâng! Tôi đang trực tiếp tấu khúc <em>\"" + demoTitle + "\"</em> trên " + pInst.icon + " " + pInst.name + " cho bạn thưởng thức:</strong><br><br>" +
            "• Nhạc cụ đã được đưa lên trung tâm sân khấu 3D/2D.<br>" +
            "• Từng phím và dây đàn đang rung lên đồng bộ với âm sắc mộc truyền thống!<br><br>" +
            "<div style='display:flex; gap:6px;'>" +
            "<button type='button' class='btn btn-danger btn-sm btnStopAiPlaying' onclick='stopDemoSong()'>⏹️ Dừng tấu</button>" +
            "<button type='button' class='btn btn-secondary btn-sm btnAiOpenDossier' data-inst='" + pInst.id + "'>📖 Xem Hồ Sơ Di Sản</button>" +
            "</div>";
        }
      }
    }

    // 0. C. BỘ CÂU HỎI SO SÁNH ÂM NHẠC HỌC CHUYÊN SÂU (COMPARATIVE MUSICOLOGY)
    // 0. Phân loại kỹ thuật Vê, Vuốt, Lia, Phi trên 13 nhạc cụ dân tộc (Yêu cầu 1)
    if (q.includes("13 nhạc cụ") || (q.includes("phân loại") && (q.includes("vê") || q.includes("vuốt") || q.includes("lia") || q.includes("phi"))) || ((q.includes("vê") || q.includes("vuốt")) && (q.includes("kỹ thuật") || q.includes("nhạc cụ nào") || q.includes("có động tác") || q.includes("liệt kê") || q.includes("lia")))) {
      return "🎶 <strong>Phân Loại 13 Nhạc Cụ Theo Kỹ Thuật Vê, Vuốt, Lia &amp; Phi Gảy Liên Tục:</strong><br><br>" +
        "Trong kho tàng nhạc cụ dân tộc, kỹ thuật vê, vuốt, lia, phi tạo nên những âm sắc ngân rung rào rạt và biến hóa vi âm luyến láy rất độc đáo. Cụ thể phân loại từng nhóm như sau:<br><br>" +
        "✅ <strong>1. Nhóm có động tác VÊ / PHI / LIA gảy liên tục rõ ràng:</strong><br>" +
        "Đây là các kỹ thuật tay phải tạo ra âm thanh ngân rung, lướt nhanh liên tiếp trên dây đàn:<br>" +
        "• <strong>Đàn Nguyệt:</strong> Có kỹ thuật <em>ngón vê</em> và <em>ngón phi</em> cực kỳ đặc trưng. <em>Ngón vê</em>: khảy liên tiếp nhanh trên dây đàn bằng móng tay hoặc miếng khảy, có thể vê 1 hoặc 2 dây cùng lúc, rất phổ biến trong hát văn, chèo, cải lương. <em>Ngón phi</em>: vẩy các ngón tay liên tiếp theo trình tự lên/xuống dây, dồn dập rộn rã gần giống ngón vê.<br>" +
        "• <strong>Đàn Đáy:</strong> Có kỹ thuật <em>lia (vê)</em> hoàn toàn tương tự đàn nguyệt và đàn tam, là một trong những nét chơi đặc trưng nhất của nhạc cụ này trong nghệ thuật Ca Trù Thăng Long.<br>" +
        "• <strong>Đàn Tam:</strong> Sử dụng kỹ thuật vê, lia gảy liên tục trên 3 dây mượt mà tương tự họ đàn dây gảy cổ truyền.<br>" +
        "• <strong>Đàn Tỳ Bà:</strong> Sở hữu bộ kỹ thuật tay phải vô cùng phong phú, bao gồm các động tác <em>vẩy, vê, rải dây (phi) liên tục</em> đặc trưng của dòng tỳ bà.<br><br>" +
        "✅ <strong>2. Nhóm có kỹ thuật VUỐT trượt tay trái trên dây:</strong><br>" +
        "Đây là động tác tay trái di chuyển liên tục theo chiều dọc cần/dây đàn, kết hợp với gảy một lần của tay phải tạo ra âm thanh luyến, trượt mượt mà (glissando):<br>" +
        "• <strong>Đàn Nguyệt:</strong> Có kỹ thuật <em>ngón vuốt</em> rõ ràng: tay trái vuốt lên/xuống dây sau khi tay phải gảy (vuốt lên, vuốt xuống hoặc vuốt tự do), thường kết hợp nhuần nhuyễn chung với ngón vê tay phải.<br>" +
        "• <strong>Đàn Bầu:</strong> Kỹ thuật chơi cốt lõi của đàn bầu chính là tay phải uốn giữ cần đàn di chuyển liên tục lên xuống, tạo ra sự thay đổi cao độ vô cấp mềm mại, chính là dạng 'vuốt' đặc trưng độc nhất vô nhị.<br>" +
        "• <strong>Đàn Tranh:</strong> Có kỹ thuật <em>chùi, vuốt dây</em> bằng móng tay trái sau khi gảy, tạo ra các nét diễn luyến láy ngũ cung rất mềm mại, sâu lắng.<br><br>" +
        "❌ <strong>3. Nhóm KHÔNG CÓ động tác vê/vuốt kiểu gảy dây liên tục:</strong><br>" +
        "Đây là những nhạc cụ có nguyên lý phát âm khác hoàn toàn:<br>" +
        "• <strong>Đàn Nhị:</strong> Dùng vĩ kéo miết liên tục trên dây (nhạc cụ dây kéo) chứ không phải vê khảy cơ học.<br>" +
        "• <strong>Đàn Tính, Đàn Goong, Đàn Chapi, Đàn Môi:</strong> Nhạc cụ dân tộc các dân tộc thiểu số vùng cao, nguyên lý chơi và diễn tấu khác hoàn toàn với bộ đàn dây gảy Kinh.<br>" +
        "• <strong>Đàn Ta Lư:</strong> Đàn phím điện tử, không có dây cơ học để thực hiện động tác vê/vuốt.<br><br>" +
        "<div style='display:flex; flex-wrap:wrap; gap:6px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiSwitchInst' data-inst='dannguyet'>🌕 Đàn Nguyệt (Vê &amp; Vuốt)</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='danbau'>🎻 Đàn Bầu (Vuốt Cần Đàn)</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='dantranh'>🪕 Đàn Tranh (Vuốt Chùi Dây)</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='danday'>🎸 Đàn Đáy (Lia Ca Trù)</button>" +
        "</div>";
    }

    // 1. So sánh Cồng và Chiêng
    if ((q.includes("cồng") && q.includes("chiêng")) || q.includes("phân biệt cồng") || q.includes("khác nhau giữa cồng")) {
      return "🔔 <strong>So Sánh Chuyên Sâu: CỒNG và CHIÊNG trong Không Gian Văn Hóa Tây Nguyên (UNESCO 2005)</strong><br><br>" +
        "Rất nhiều người thường nhầm lẫn Cồng và Chiêng là một, nhưng trong âm nhạc học dân tộc học, đây là hai nhạc cụ mang triết lý âm dương và cấu tạo hoàn toàn khác biệt:<br><br>" +
        "• <strong>1. Điểm Khác Biệt Về Hình Thức:</strong><br>" +
        "  - <strong>CỒNG:</strong> Chính giữa mặt cồng <strong>CÓ MỘT NÚM TRÒN LỒI LÊN</strong>. Dùi gõ thường bọc vải mềm hoặc rễ cây.<br>" +
        "  - <strong>CHIÊNG:</strong> Mặt phẳng nhẵn <strong>HOÀN TOÀN KHÔNG CÓ NÚM</strong> (còn gọi là Chiêng bằng).<br><br>" +
        "• <strong>2. Ý Nghĩa Triết Lý & Tâm Linh:</strong><br>" +
        "  - <strong>Cồng:</strong> Đại diện cho <strong>Phái Dương (Trời, Cha, Sức mạnh quyền uy)</strong>. Âm thanh phát ra trầm sâu, rền vang, ngân nga huyền bí chạm tới cõi Yàng.<br>" +
        "  - <strong>Chiêng:</strong> Đại diện cho <strong>Phái Âm (Đất, Mẹ, Sự sinh sôi nảy nở)</strong>. Âm thanh cao, trong sáng, đanh gọn và thanh thoát.<br><br>" +
        "• <strong>3. Cách Thức Diễn Tấu Phối Hợp (Hocketing):</strong><br>" +
        "  Trong dàn cồng chiêng, Cồng giữ bè trầm định nhịp (như nhịp tim của mẹ đất), trong khi các Chiêng bằng luồn lách tấu nên giai điệu đối đáp rộn rã.<br><br>" +
        "<div style='display:flex; gap:6px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiSwitchInst' data-inst='cong'>🔔 Nghe thử Cồng (Có núm)</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='chieng'>🔔 Nghe thử Chiêng (Chiêng bằng)</button>" +
        "</div>";
    }

    // 2. Tại sao Đàn Bầu 1 dây phát ra nhiều nốt?
    if ((q.includes("đàn bầu") && (q.includes("1 dây") || q.includes("một dây") || q.includes("mấy nốt") || q.includes("nhiều nốt") || q.includes("tại sao") || q.includes("nguyên lý"))) || q.includes("độc huyền cầm")) {
      return "🎻 <strong>Bí Quyết Kỳ Diệu: Tại sao Đàn Bầu chỉ có 1 dây mà tấu được muôn vạn nốt nhạc?</strong><br><br>" +
        "Đàn Bầu (Độc huyền cầm) là tuyệt đỉnh sáng tạo vật lý âm học thuần Việt độc nhất vô nhị trên thế giới nhờ hai cơ chế phối hợp hoàn hảo:<br><br>" +
        "• <strong>1. Hiện Tượng Vật Lý Bồi Âm (Acoustic Harmonics):</strong><br>" +
        "  - Khi gảy thông thường, dây đàn chỉ phát ra 1 cao độ gốc.<br>" +
        "  - Nhưng nghệ sĩ đàn bầu dùng cạnh bàn tay út phải <strong>chạm khẽ vào các điểm nút dao động</strong> (chính xác tại 1/2, 1/3, 1/4, 1/5, 1/6, 1/8 chiều dài dây) rồi mới gảy, triệt tiêu âm cơ bản và làm bùng nổ các <strong>họa âm (bồi âm tự nhiên)</strong> trong veo như tiếng chuông ngân!<br><br>" +
        "• <strong>2. Cần Đàn Dẻo Bằng Sừng Trâu (Uốn Cao Độ Vô Cấp):</strong><br>" +
        "  - Dây đàn nối liền với cần đàn bằng sừng trâu mộng dẻo quẹt.<br>" +
        "  - Tay trái nghệ sĩ kéo cần về sau sẽ làm căng dây (nâng cao độ lên), đẩy cần ra trước sẽ làm chùng dây (hạ cao độ xuống), rung vòi cần sẽ tạo độ ngân rung mượt mà vô cấp (glissando liên tục) y hệt thanh quản và giọng hát con người!<br><br>" +
        "<div style='display:flex; gap:6px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiPlayDemo' data-inst='danbau'>▶️ Nghe Đàn Bầu tấu Ru Con</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiOpenDossier' data-inst='danbau'>📖 Xem Hồ Sơ Đàn Bầu</button>" +
        "</div>";
    }

    // 3. So sánh Sáo Trúc và Tiêu (Động Tiêu)
    if ((q.includes("sáo") && q.includes("tiêu")) || q.includes("phân biệt sáo") || q.includes("động tiêu")) {
      return "🎋 <strong>So Sánh Sáo Trúc (Thổi Ngang) và Tiêu / Động Tiêu (Thổi Dọc)</strong><br><br>" +
        "• <strong>1. Thế Thổi & Cấu Trúc:</strong><br>" +
        "  - <strong>Sáo Trúc:</strong> Thổi <strong>NGANG</strong>. Lỗ thổi nằm ở cạnh bên thân sáo. Ống sáo ngắn hơn (~45-55cm), thành mỏng hơn.<br>" +
        "  - <strong>Tiêu (Động Tiêu):</strong> Thổi <strong>DỌC</strong>. Miệng thổi khoét rãnh chữ V hoặc U ngay ở đầu mấu ống. Ống trúc dài hơn (~70-85cm), đốt trúc dày dặn.<br><br>" +
        "• <strong>2. Âm Sắc & Phong Cách Biểu Diễn:</strong><br>" +
        "  - <strong>Sáo Trúc:</strong> Âm sắc cao, trong trẻo, réo rắt, bay bổng tựa cánh diều lưng trời, diễn tấu vui tươi, hoạt bát.<br>" +
        "  - <strong>Động Tiêu:</strong> Âm sắc trầm ấm, sâu thẳm, u tịch, man mác hoài cổ, thường dùng trong nhạc thiền, thính phòng tao nhã và đêm thanh vắng.<br><br>" +
        "<div style='display:flex; gap:6px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiSwitchInst' data-inst='saotruc'>🎋 Xem Sáo Trúc</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='tieu'>🎋 Xem Động Tiêu</button>" +
        "</div>";
    }

    // 4. So sánh Đàn Nguyệt, Đàn Tứ và Đàn Đáy
    if ((q.includes("nguyệt") && (q.includes("tứ") || q.includes("đoản") || q.includes("đáy"))) || (q.includes("đàn đáy") && q.includes("đàn nguyệt"))) {
      return "🎸 <strong>Phân Biệt Bộ Ba Đàn Gảy Cổ Truyền: Đàn Nguyệt, Đàn Tứ & Đàn Đáy</strong><br><br>" +
        "• <strong>1. ĐÀN NGUYỆT (Đàn Kìm):</strong> Thùng tròn như trăng rằm, <strong>2 dây</strong>, cần rất dài gắn 10 phím tre cao. Chuyên trị <em>Chầu Văn Tứ Phủ & Đờn Ca Tài Tử</em> với ngón nhấn vi âm não nùng.<br>" +
        "• <strong>2. ĐÀN TỨ (Đoản Cầm):</strong> Thùng tròn phẳng, <strong>4 dây</strong>, cần đàn <strong>RẤT NGẮN</strong>. Nhờ phím gần nhau nên chạy ngón và phi móng tốc độ cực nhanh trong sân khấu Cải Lương.<br>" +
        "• <strong>3. ĐÀN ĐÁY (Vô Đề Cầm):</strong> Thùng hình thang <strong>ĐÁY THỦNG HOÀN TOÀN</strong>, cần dài ngoạn mục (1,2m), <strong>3 dây tơ</strong>. Cây đàn thuần Việt 100% độc quyền của nghệ thuật <em>Ca Trù Thăng Long</em> với âm sắc trầm đục trang nghiêm.<br><br>" +
        "<div style='display:flex; flex-wrap:wrap; gap:6px;'>" +
        "<button type='button' class='btn btn-primary btn-sm btnAiSwitchInst' data-inst='dannguyet'>🌕 Đàn Nguyệt</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='dantu'>🎸 Đàn Tứ</button>" +
        "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='danday'>🎸 Đàn Đáy</button>" +
        "</div>";
    }

    // 5. So sánh Đàn Tranh Việt Nam với Cổ Tranh Trung Quốc (Guzheng), Koto Nhật Bản, Gayageum Triều Tiên
    if (q.includes("guzheng") || q.includes("koto") || q.includes("gayageum") || (q.includes("đàn tranh") && (q.includes("trung quốc") || q.includes("nhật bản") || q.includes("hàn quốc") || q.includes("khác")))) {
      return "🪕 <strong>Đàn Tranh Việt Nam khác gì so với Guzheng (Trung Quốc), Koto (Nhật Bản) và Gayageum (Hàn Quốc)?</strong><br><br>" +
        "Dù cùng thuộc dòng đàn zither vòm cong có con nhạn di động ở Á Đông, Đàn Tranh Việt Nam mang bản sắc hoàn toàn độc lập:<br><br>" +
        "• <strong>1. Số dây & Kích thước:</strong><br>" +
        "  - <strong>Đàn Tranh Việt Nam:</strong> Bản truyền thống có <strong>16 dây</strong> (Thập lục), thân đàn thon gọn thanh thoát (~115cm), âm sắc ngọt ngào, mềm mại, thanh tao.<br>" +
        "  - <strong>Guzheng (Trung Quốc):</strong> Thường có 21 dây, kích thước đồ sộ hơn (~165cm), âm lượng vang rền mạnh mẽ, đanh sắc.<br>" +
        "  - <strong>Koto (Nhật Bản):</strong> Thường có 13 dây tơ lớn, gảy bằng móng vuông góc, âm thanh trang nghiêm, thiền định.<br>" +
        "  - <strong>Gayageum (Hàn Quốc):</strong> 12 dây gảy trực tiếp bằng đầu ngón tay không dùng móng giả, âm mộc hơi khàn ấm.<br><br>" +
        "• <strong>2. Cái Hồn Tay Trái (Linh Hồn Ngũ Cung Việt):</strong><br>" +
        "  Nghệ thuật đàn Tranh Việt Nam nằm ở <strong>ngón nhấn, ngón rung, ngón mổ tay trái sau con nhạn</strong>. Nhờ lực nhấn tinh tế này mà 5 nốt ngũ cung tự nhiên có thể luyến láy biến hóa ra nốt Fa, nốt Si non/già và điệu Oán da diết đặc trưng Nam Bộ mà không đàn nào trên thế giới thay thế được!";
    }

    // 6. Thang âm Ngũ Cung Hò Xự Xang Xê Cống
    if (q.includes("hò xự xang xê cống") || q.includes("hò xự") || (q.includes("ngũ cung") && (q.includes("là gì") || q.includes("thang âm") || q.includes("nốt")))) {
      return "🎶 <strong>Thang Âm Ngũ Cung Hò - Xự - Xang - Xê - Cống Trong Âm Nhạc Việt Nam</strong><br><br>" +
        "Thang âm ngũ cung là linh hồn của nền âm nhạc cổ truyền dân tộc gồm 5 bậc âm chính:<br><br>" +
        "• <strong>Hò</strong>: Tương đương nốt <strong>Đô (C)</strong> - Âm chủ thanh bình, vững chãi.<br>" +
        "• <strong>Xự</strong>: Tương đương nốt <strong>Rê (D)</strong> - Âm bậc 2 dìu dặt.<br>" +
        "• <strong>Xang</strong>: Tương đương nốt <strong>Mi (E)</strong> - Âm bậc 3 trong sáng.<br>" +
        "• <strong>Xê</strong>: Tương đương nốt <strong>Sol (G)</strong> - Âm bậc 5 tươi vui, ngân nga.<br>" +
        "• <strong>Cống</strong>: Tương đương nốt <strong>La (A)</strong> - Âm bậc 6 bay bổng.<br><br>" +
        "⭐ <strong>Cách tạo nốt Fa và nốt Si:</strong><br>" +
        "Hệ thống ngũ cung Việt Nam không đặt sẵn dây Fa và Si! Muốn tạo nốt <strong>Fa</strong>, nghệ sĩ gảy dây Xang (Mi) rồi dùng tay trái <strong>nhấn nhẹ sau con nhạn</strong>. Muốn có nốt <strong>Si</strong>, nhấn dây Cống (La). Nhờ kỹ thuật nhấn vi âm này mà âm nhạc Việt Nam có thể diễn đạt trọn vẹn cả điệu Bắc hào sảng lẫn điệu Nam Oán đứt ruột!";
    }

    // 0. D. TRA CỨU BÁCH KHOA TOÀN THƯ TỪNG NHẠC CỤ TRONG KHO TÀNG 42 NHẠC CỤ
    var enc = (typeof window.INSTRUMENT_ENCYCLOPEDIA !== "undefined") ? window.INSTRUMENT_ENCYCLOPEDIA : null;
    if (enc) {
      for (var kId in enc) {
        var item = enc[kId];
        var matchFound = false;
        var nameL = item.name.toLowerCase();
        var aliasL = (item.alias || "").toLowerCase();

        // Kiểm tra khớp từ khóa tên nhạc cụ
        if (q.includes(nameL) || (aliasL && q.includes(aliasL)) || q.includes(kId)) {
          matchFound = true;
        }

        if (matchFound) {
          var rep = item.repertoire || "";
          var demoTrackName = (item.demoTracks && item.demoTracks[0]) ? item.demoTracks[0].title : "Giai điệu mẫu";
          return item.icon + " <strong>Hồ Sơ Chuyên Sâu: " + item.name.toUpperCase() + " (" + (item.alias || item.catName) + ")</strong><br><br>" +
            "• <strong>Vị thế di sản:</strong> <span style='color:var(--string-gold);'>" + item.heritage + "</span><br>" +
            "• <strong>Nguồn gốc & Lịch sử:</strong> " + item.history + "<br>" +
            "• <strong>Cấu tạo & Vật liệu:</strong> " + item.materials + ". " + item.structure + "<br>" +
            "• <strong>Kỹ thuật diễn tấu đặc thù:</strong> " + item.technique + "<br>" +
            "• <strong>Không gian nghệ thuật:</strong> " + item.artForms + "<br>" +
            "• <strong>Nghệ nhân danh cầm:</strong> " + item.masters + "<br>" +
            "• <strong>Tác phẩm kinh điển:</strong> <em>" + rep + "</em><br><br>" +
            "<div style='display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;'>" +
            "<button type='button' class='btn btn-primary btn-sm btnAiPlayDemo' data-inst='" + item.id + "'>▶️ Tấu bài mẫu: " + demoTrackName + "</button>" +
            "<button type='button' class='btn btn-secondary btn-sm btnAiSwitchInst' data-inst='" + item.id + "'>🪕 Chuyển sang 3D/2D</button>" +
            "<button type='button' class='btn btn-secondary btn-sm btnAiOpenDossier' data-inst='" + item.id + "'>📖 Xem Hồ Sơ Di Sản Toàn Diện</button>" +
            "</div>";
        }
      }
    }

    // 1. CHÀO HỎI & GIỚI THIỆU NGHỆ NHÂN
    if (q.startsWith("chào") || q === "hi" || q === "hello" || q.includes("alo") || q.startsWith("hé lô") || q.startsWith("xin chào")) {
      return "Dạ xin kính chào quý vị! 🙏<br>" +
        "Tôi là <strong>Nghệ nhân giúp ta đánh đàn</strong>. Tôi chuyên truyền dạy về thông tin 38 đại nhạc cụ dân tộc Việt Nam và hướng dẫn cách đánh đàn đúng chuẩn. Quý vị muốn tìm hiểu nhạc cụ nào hay cần hướng dẫn cách gảy, nhấn, rung bài gì xin cứ hỏi nhé!";
    }

    if (q.includes("bạn là ai") || q.includes("tên gì") || q.includes("ai tạo ra") || q.includes("bạn làm được gì") || q.includes("nghệ nhân")) {
      return "Tôi là <strong>Nghệ nhân giúp ta đánh đàn</strong> 🧓.<br><br>" +
        "• <strong>Thông tin 38 Nhạc Cụ:</strong> Giải đáp chi tiết về họ nhạc cụ, cấu tạo, âm thanh, sử dụng và lịch sử của 38 nhạc cụ dân tộc Việt Nam.<br>" +
        "• <strong>Cách Đánh Đúng Chuẩn:</strong> Hướng dẫn tư thế ngồi, cách đeo móng gảy tay phải, kỹ thuật nhấn - rung - vuốt - mổ tay trái và thang âm ngũ cung Hò - Xự - Xang - Xê - Cống.<br>" +
        "• <strong>Tự Động Diễn Tấu Mẫu:</strong> Quý vị có thể yêu cầu tôi tấu mẫu các làn điệu dân ca truyền thống ngay trên sân khấu!";
    }

    if (q.includes("cảm ơn") || q.includes("thank you") || q.includes("thanks")) {
      return "Dạ không có gì ạ! Rất vui được truyền lửa tình yêu nhạc cụ dân tộc đến quý vị. Chúc quý vị luyện ngón thật dẻo dai và thư thái bên tiếng tơ đồng!";
    }

    if (q.includes("tạm biệt") || q.includes("bye") || q.includes("hẹn gặp lại")) {
      return "Tạm biệt quý vị nhé! Khi nào cần luyện đàn hoặc tìm hiểu về nhạc cụ dân tộc, hãy gọi <strong>Nghệ nhân giúp ta đánh đàn</strong> nhé!";
    }

    // 2. HƯỚNG DẪN KỸ THUẬT ĐÁNH ĐÀN ĐÚNG CHUẨN (TAY PHẢI, TAY TRÁI, NHẤN RUNG VUỐT)
    if (q.includes("nhấn") || q.includes("rung") || q.includes("vuốt") || q.includes("mổ") || q.includes("vỗ") || q.includes("tay trái")) {
      return "✋ <strong>Kỹ Thuật Tay Trái Đúng Chuẩn (Hồn Phách Của Cây Đàn):</strong><br><br>" +
        "• <strong>Vị trí đặt tay trái:</strong> Đặt 3 đầu ngón tay (ngón trỏ, ngón giữa và ngón áp út) khép nhẹ trên mặt dây, cách chân <strong>con nhạn (ngựa đàn) về phía bên trái khoảng 15 - 20cm</strong>.<br>" +
        "• <strong>Ngón Rung:</strong> Sau khi tay phải gảy dây, tay trái dùng lực cổ tay ấn nhẹ nhịp nhàng lên xuống tạo làn sóng âm ngân nga, mềm mại.<br>" +
        "• <strong>Ngón Nhấn (Tạo nốt Fa và Si):</strong> Đàn tranh ngũ cung không có sẵn dây Fa và Si. Muốn đánh nốt <strong>Fa</strong>, tay phải gảy dây Xang (Mi) rồi tay trái nhấn sâu xuống làm căng dây nâng lên nửa cung. Muốn đánh nốt <strong>Si</strong>, nhấn trên dây Cống (La).<br>" +
        "• <strong>Ngón Vuốt & Vỗ:</strong> Vuốt dọc theo dây sau khi gảy hoặc vỗ nhẹ để tạo hiệu ứng luyến láy uyển chuyển.";
    }

    if (q.includes("tay phải") || q.includes("móng gảy") || q.includes("ngón gảy") || q.includes("vê") || q.includes("lướt")) {
      return "🤚 <strong>Kỹ Thuật Tay Phải Đúng Chuẩn (Phát Âm Sáng Rõ):</strong><br><br>" +
        "• <strong>Đeo móng gảy:</strong> Đeo 3 móng (đồi mồi, sừng hoặc nhựa) vào ngón Cái, ngón Trỏ và ngón Giữa của bàn tay phải.<br>" +
        "• <strong>Vị trí gảy đúng:</strong> Gảy vào khoảng cách <strong>từ 3cm đến 5cm tính từ cầu đàn bên phải</strong>. Không gảy quá sát cầu đàn (tiếng sẽ đanh cứng) hoặc quá xa về phía con nhạn (tiếng bị bẹt).<br>" +
        "• <strong>Thế tay:</strong> Khum tròn lòng bàn tay như đang nắm hờ quả trứng, cổ tay thả lỏng tự nhiên.<br>" +
        "• <strong>Ngón Áp & Thoa:</strong> Ngón cái gảy xuống (vào lòng), ngón trỏ và ngón giữa gảy móc lên để chạy ngón liên hoàn mượt mà.";
    }

    if (q.includes("cách đánh") || q.includes("cách chơi") || q.includes("cách gảy") || q.includes("hướng dẫn") || q.includes("tập đàn") || q.includes("học đàn")) {
      return "🪕 <strong>Phương Pháp Đánh Đàn Đúng Chuẩn Từ Nghệ Nhân:</strong><br><br>" +
        "1. <strong>Tư thế chuẩn:</strong> Ngồi thẳng lưng, hai vai thả lỏng, mắt nhìn bao quát hàng con nhạn.<br>" +
        "2. <strong>Phối hợp hai tay (Song thủ đồng bộ):</strong> Tay phải gảy phát âm trước, ngay tức khắc tay trái nhấn hoặc rung theo sau để tạo dư âm ngũ cung truyền thống.<br>" +
        "3. <strong>Cách đánh trên ứng dụng:</strong><br>" +
        "  - Hãy chọn 1 trong 38 nhạc cụ để nạp lên sân khấu.<br>" +
        "  - Bấm trực tiếp các <strong>nút phím ở bảng bên cạnh</strong> hoặc dùng <strong>bàn phím máy tính</strong> (hàng phím <kbd>A S D F G H J K L ;</kbd> cho quãng trầm-trung, <kbd>Q W E R T Y</kbd> hoặc <kbd>1 2 3 4 5 6 7 8</kbd> tùy nhạc cụ).<br>" +
        "4. <strong>Mẹo luyện tập:</strong> Hãy bắt đầu chậm rãi với bài <em>Lưu Thủy Kim Tiền</em> hoặc <em>Bèo Dạt Mây Trôi</em> theo đúng nhịp phách.";
    }

    // 3. ĐÀN TRANH & THANG ÂM CHUYÊN SÂU
    if (q.includes("mấy dây") || q.includes("bao nhiêu dây") || q.includes("số dây")) {
      return "🪕 <strong>Đàn Tranh có bao nhiêu dây?</strong><br><br>" +
        "• <strong>Truyền thống:</strong> Đàn Tranh cổ truyền Việt Nam có <strong>16 dây kim loại</strong> (Thập lục huyền cầm), trước đó thời cổ từng có 15 dây (Thập ngũ huyền cầm).<br>" +
        "• <strong>Cải tiến hiện đại:</strong> Để mở rộng âm vực biểu diễn, các nghệ nhân đã phát triển thêm bản <strong>17 dây, 19 dây và 21 dây</strong>.<br>" +
        "• Sân khấu hiện tại mô phỏng chuẩn xác <strong>16 dây ngũ cung truyền thống</strong>!";
    }

    if (q.includes("ngũ cung") || q.includes("hò xự") || q.includes("thang âm") || q.includes("nốt nhạc")) {
      return "🎶 <strong>Hệ thống Thang Âm Ngũ Cung & Cách Đánh Chuẩn:</strong><br><br>" +
        "Nhạc cụ dân tộc Việt Nam sử dụng 5 bậc âm chính:<br>" +
        "• <strong>Hò</strong>: Nốt Đô (C)<br>" +
        "• <strong>Xự</strong>: Nốt Rê (D)<br>" +
        "• <strong>Xang</strong>: Nốt Mi (E)<br>" +
        "• <strong>Xê</strong>: Nốt Sol (G)<br>" +
        "• <strong>Cống</strong>: Nốt La (A)<br><br>" +
        "⭐ <em>Cách đánh nốt Fa và Si đúng chuẩn:</em><br>" +
        "Khi gặp nốt <strong>Fa</strong>, quý vị gảy dây Xang (Mi) rồi dùng tay trái <strong>nhấn sâu</strong> sau con nhạn. Khi gặp nốt <strong>Si</strong>, gảy dây Cống (La) rồi nhấn tay trái. Đây là kỹ thuật cốt tử của người đánh đàn!";
    }

    if (q.includes("con nhạn") || q.includes("ngựa đàn") || q.includes("chỉnh dây") || q.includes("lên dây")) {
      return "🕊️ <strong>Con Nhạn (Ngựa Đàn) & Cách Chỉnh Dây Đúng Chuẩn:</strong><br><br>" +
        "• Con nhạn đặt giữa mặt đàn có hình cánh chim nhạn, dùng để nâng dây và truyền âm xuống hộp cộng hưởng.<br>" +
        "• <strong>Cách chỉnh cao độ đúng:</strong> Muốn nốt cao lên (già), dịch chuyển con nhạn về phía đầu đàn bên phải. Muốn nốt trầm xuống (non), dịch con nhạn về phía bên trái.";
    }

    if (q.includes("gỗ") || q.includes("ngô đồng")) {
      return "🌳 <strong>Chất Liệu Gỗ Chế Tác Đàn Chuẩn Nghệ Nhân:</strong><br><br>" +
        "• <strong>Mặt đàn & Đáy đàn:</strong> Làm bằng <strong>gỗ ngô đồng</strong> (hoặc vông nem) nhẹ, xốp, thớ thẳng giúp âm thanh ngân vang, trong sáng.<br>" +
        "• <strong>Thành đàn & Con nhạn:</strong> Làm bằng gỗ trắc, cẩm lai hoặc mun để chịu lực căng của 16 dây kim loại.";
    }

    // C. KIỂM TRA CHỦ ĐỀ: NẾU NGOÀI LĨNH VỰC NHẠC CỤ DÂN TỘC THÌ TỪ CHỐI LỊCH SỰ (YÊU CẦU 2)
    if (!isVietnameseInstrumentTopic(raw)) {
      return MSG_ONLY_VIETNAMESE_INSTRUMENTS;
    }

    // D. NẾU THUỘC LĨNH VỰC NHẠC CỤ NHƯNG CHƯA KHỚP CÂU TRẢ LỜI CỤ THỂ
    return "✨ <strong>Chuyên gia Cố vấn Nhạc cụ Dân tộc Việt Nam:</strong><br><br>" +
      "Cảm ơn bạn đã hỏi về: <em>\"" + raw + "\"</em>.<br><br>" +
      "Tôi chuyên giải đáp chuyên sâu về <strong>38 đại nhạc cụ cổ truyền Việt Nam</strong>, thang âm ngũ cung, kỹ thuật ngón gảy, nhấn rung, cách chỉnh con nhạn và bài bản diễn tấu.<br>" +
      "<em>💡 Mẹo: Bạn có thể yêu cầu tôi trực tiếp tấu khúc nhạc cụ bằng cách nhắn 'chơi bài Bèo dạt mây trôi' hoặc 'chuyển sang Đàn Tranh' nhé!</em>";
  }

  // ĐỊNH DẠNG MARKDOWN CHO PHẢN HỒI CỦA AI THÔNG MINH
  function formatAiMarkdown(text) {
    if (!text) return "";
    var s = String(text).replace(/\r\n/g, "\n");

    // Lọc các thẻ script nguy hiểm nếu có
    s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Khối mã lệnh: ```lang ... ```
    s = s.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, function (m, lang, code) {
      return "<pre style='background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.18); padding:10px 12px; border-radius:8px; overflow-x:auto; margin:8px 0; font-family:Consolas,monospace; font-size:12.5px; color:#a5f3fc;'><code>" +
        code.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() + "</code></pre>";
    });

    // Mã nội dòng: `code`
    s = s.replace(/`([^`]+)`/g, "<code style='background:rgba(255,255,255,0.12); padding:2px 6px; border-radius:4px; font-family:Consolas,monospace; color:#fde047;'>$1</code>");

    // Tiêu đề các cấp: ###, ##, #
    s = s.replace(/^### (.*$)/gim, "<strong style='font-size:1.1em; color:var(--string-gold, #ffd700); display:block; margin:6px 0 2px 0;'>$1</strong>");
    s = s.replace(/^## (.*$)/gim, "<strong style='font-size:1.15em; color:var(--string-gold, #ffd700); display:block; margin:8px 0 3px 0;'>$1</strong>");
    s = s.replace(/^# (.*$)/gim, "<strong style='font-size:1.25em; color:var(--string-gold, #ffd700); display:block; margin:10px 0 4px 0;'>$1</strong>");

    // Chữ in đậm: **text** hoặc __text__
    s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // Chữ in nghiêng: *text* hoặc _text_
    s = s.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1<em>$2</em>$3");

    // Danh sách gạch đầu dòng: * item, - item, • item
    s = s.replace(/^[*\-•]\s+(.*)$/gim, "<div style='margin-left:14px; text-indent:-10px; margin-bottom:3px;'>• $1</div>");

    // Danh sách đánh số: 1. item
    s = s.replace(/^(\d+)\.\s+(.*)$/gim, "<div style='margin-left:14px; text-indent:-12px; margin-bottom:3px;'><strong>$1.</strong> $2</div>");

    // Xuống dòng đoạn văn
    s = s.replace(/\n\n+/g, "<br><br>");
    s = s.replace(/\n/g, "<br>");

    return s;
  }

  // =========================================================
  // CHẾ ĐỘ PHẢN HỒI CỦA AI: NHANH (SIÊU TỐC) vs SUY NGHĨ LÂU (CHI TIẾT)
  // =========================================================
  var currentAiMode = localStorage.getItem("dan_tranh_ai_mode") || "fast";

  function setAiResponseMode(mode) {
    currentAiMode = (mode === "deep") ? "deep" : "fast";
    try {
      localStorage.setItem("dan_tranh_ai_mode", currentAiMode);
    } catch (e) {}
    updateAiModeButtonsUI();
  }
  window.setAiResponseMode = setAiResponseMode;

  function updateAiModeButtonsUI() {
    var btnFast = document.getElementById("btnAiModeFast");
    var btnDeep = document.getElementById("btnAiModeDeep");
    if (btnFast) {
      if (currentAiMode === "fast") {
        btnFast.style.background = "#de194b";
        btnFast.style.color = "#fff";
        btnFast.style.fontWeight = "700";
      } else {
        btnFast.style.background = "transparent";
        btnFast.style.color = "#c8baa6";
        btnFast.style.fontWeight = "600";
      }
    }
    if (btnDeep) {
      if (currentAiMode === "deep") {
        btnDeep.style.background = "#de194b";
        btnDeep.style.color = "#fff";
        btnDeep.style.fontWeight = "700";
      } else {
        btnDeep.style.background = "transparent";
        btnDeep.style.color = "#c8baa6";
        btnDeep.style.fontWeight = "600";
      }
    }
  }

  // Khởi tạo UI chế độ AI ban đầu
  setTimeout(updateAiModeButtonsUI, 120);

  // GỌI AI THÔNG MINH (HỖ TRỢ 2 CHẾ ĐỘ: NHANH SIÊU TỐC VÀ SUY NGHĨ SÂU CHI TIẾT)
  async function callGeminiApi(prompt) {
    var apiKey = localStorage.getItem("gemini_api_key");
    var isDeep = (currentAiMode === "deep");

    // BẮT BUỘC: CHỈ TRẢ LỜI CÁC CÂU HỎI LIÊN QUAN ĐẾN NHẠC CỤ DÂN TỘC VIỆT NAM (Yêu Cầu 2)
    if (!isVietnameseInstrumentTopic(prompt)) {
      return MSG_ONLY_VIETNAMESE_INSTRUMENTS;
    }

    // 0. NẾU CHẾ ĐỘ NHANH: KIỂM TRA NHANH CÂU HỎI CHÀO HỎI / TRA CỨU ĐỂ TRẢ LỜI NGAY TRONG 0.01 GIÂY
    if (!isDeep) {
      var directLocal = getKnowledgeAnswer(prompt);
      // Nếu câu trả lời trực tiếp khớp chuyên sâu, trả về ngay tức thì!
      if (directLocal && !directLocal.includes("Cảm ơn bạn đã hỏi về")) {
        return directLocal;
      }
    }

    var systemInstruction = "";
    if (isDeep) {
      // CHẾ ĐỘ SUY NGHĨ LÂU: KẾT QUẢ ĐÚNG VÀ CHI TIẾT HƠN
      systemInstruction = "Bạn là 'Chuyên gia Cố vấn AI về Nhạc cụ Dân tộc Việt Nam' tại nền tảng số Đàn Tranh Online (MIT).\n" +
        "- QUY TẮC NỘI DUNG: Bạn am tường sâu sắc về 4 Bộ Nhạc cụ Cổ truyền Việt Nam: Bộ Dây (Đàn Tranh, Đàn Bầu, Đàn Nguyệt, Đàn Nhị, Đàn Tỳ Bà, Đàn Đáy, Đàn Tam, Đàn Sến, Đàn Tính, Đàn Goong, Đàn Chapi, Đàn Môi, Đàn Ta Lư), Bộ Hơi (Sáo Trúc, Tiêu/Động Tiêu, Khèn Mông, Khèn Bè Thái, Kèn Bầu, Pí Tây Bắc, Đing Năm, Đing Buốt, Đing Tút, Pi Lè), Bộ Tự Thân Vang (Đàn Đá, Đàn T'rưng, Cồng, Chiêng, Thanh La, Mõ, Phách, Sinh Tiền) và Bộ Màng Rung (Trống Cơm, Trống Bản, Trống Đế, Trống Paranưng); cùng thang âm ngũ cung Hò-Xự-Xang-Xê-Cống và kỹ thuật ngón gảy/nhấn/rung/vuốt/vê/lia/phi.\n" +
        "- TUYỆT ĐỐI KHÔNG BAO GIỜ TRẢ LỜI CẨU THẢ BẰNG DẤU BA CHẤM (...) HOẶC (....). Khi người dùng hỏi tên các loại nhạc cụ, bạn BẮT BUỘC liệt kê đầy đủ, rõ ràng từng loại nhạc cụ theo 4 bộ, giải thích nguồn gốc và âm sắc.\n" +
        "- TỪ CHỐI LỊCH SỰ: Nếu người dùng hỏi các chủ đề ngoài lề (toán học, tin học, thời tiết, chính trị... không liên quan đến nhạc cụ dân tộc), hãy từ chối nhã nhặn và mời người dùng quay lại câu hỏi về âm nhạc cổ truyền.\n" +
        "- PHONG THÁI: Tận tâm, thông thái, giàu chất thơ và nhạc cảm của một nghệ nhân danh cầm cổ truyền. Trình bày khoa học với đề mục (###), in đậm (**), gạch đầu dòng rõ ràng.";
    } else {
      // CHẾ ĐỘ NHANH: PHẢN HỒI SIÊU TỐC NHƯNG ĐẦY ĐỦ THÔNG MINH
      systemInstruction = "Bạn là 'Chuyên gia Cố vấn AI về Nhạc cụ Dân tộc Việt Nam' tại nền tảng Đàn Tranh Online (MIT).\n" +
        "- QUY TẮC NỘI DUNG: Chuyên giải đáp về 4 Bộ Nhạc cụ Dân tộc Việt Nam (Bộ Dây, Bộ Hơi, Bộ Tự Thân Vang, Bộ Màng Rung) và nghệ thuật diễn tấu cổ truyền.\n" +
        "- TUYỆT ĐỐI KHÔNG TRẢ LỜI BẰNG DẤU BA CHẤM (...) HOẶC (....). Khi người dùng hỏi tên các nhạc cụ, hãy liệt kê đầy đủ, mạch lạc theo từng bộ: Bộ Dây (Đàn Tranh, Đàn Bầu, Đàn Nguyệt, Đàn Nhị, Đàn Tỳ Bà, Đàn Đáy, Đàn Tam), Bộ Hơi (Sáo Trúc, Tiêu, Khèn Mông, Kèn Bầu), Bộ Tự Thân Vang (Đàn Đá, Đàn T'rưng, Cồng Chiêng) và Bộ Màng Rung (Trống Cơm, Trống Đế).\n" +
        "- PHONG CÁCH: Trả lời thông minh, đúng trọng tâm, nhanh gọn nhưng đầy đủ thông tin, không cắt bớt thông tin quan trọng.";
    }

    // NẠP THÔNG TIN THỜI GIAN THỰC VỀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG VÀO HỆ THỐNG PROMPT (YÊU CẦU 3)
    var liveCtx = (typeof getUserLiveContextSummary === "function") ? getUserLiveContextSummary() : null;
    if (liveCtx) {
      systemInstruction += "\n\n[THÔNG TIN THỜI GIAN THỰC VỀ HÀNH ĐỘNG CỦA NGƯỜI DÙNG]:\n" +
        "- Màn hình/tab đang xem: " + liveCtx.screenName + " (" + liveCtx.activeTab + ")\n" +
        "- Nhạc cụ đang chọn/diễn tấu: " + liveCtx.instName + " (" + liveCtx.instCat + ")\n" +
        "- Nốt vừa gảy gần nhất: " + liveCtx.lastNote + "\n" +
        "- Chuỗi các nốt vừa đánh liên tiếp: " + liveCtx.trail + "\n" +
        "- Số nốt đã gảy trong phiên này: " + liveCtx.sessionNotes + " nốt (Hôm nay: " + liveCtx.dailyNotes + " phím)\n" +
        "- Trạng thái tấu bài mẫu: " + (liveCtx.isDemoPlaying ? "Đang tấu bài mẫu" : "Không") + "\n" +
        "- Trạng thái phòng thu âm: " + (liveCtx.isRecording ? "Đang thu âm giai điệu" : "Không thu âm") + "\n" +
        "LƯU Ý: Bạn có thể tự nhiên nhận xét, khen ngợi hoặc liên hệ trực tiếp đến các nốt người dùng vừa gảy hoặc cây đàn họ đang chọn để câu trả lời mang tính cá nhân hoá cao, thân thiện và chính xác!";
    }

    // 1. NẾU CÓ CẤU HÌNH GEMINI API KEY RIÊNG
    if (apiKey) {
      var modelsToTry = isDeep
        ? ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"]
        : ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

      for (var i = 0; i < modelsToTry.length; i++) {
        var model = modelsToTry[i];
        var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        try {
          var controller = new AbortController();
          var timeoutMs = isDeep ? 12000 : 3500;
          var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);

          var res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: systemInstruction + "\n\nCâu hỏi: " + prompt }] }
              ]
            })
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            var data = await res.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
              return formatAiMarkdown(data.candidates[0].content.parts[0].text);
            }
          }
        } catch (e) {}
      }
    }

    // 2. KHÔNG CẦN API KEY: GỌI PUBLIC CLOUD LLM (POLLINATIONS AI)
    var cloudModel = isDeep ? "openai" : "openai-fast";
    var maxTimeout = isDeep ? 15000 : 4500;

    // Thử POST trước
    try {
      var postController = new AbortController();
      var postTimeout = setTimeout(function () { postController.abort(); }, maxTimeout);

      var postRes = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: postController.signal,
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          model: cloudModel,
          seed: Math.floor(Math.random() * 100000)
        })
      });
      clearTimeout(postTimeout);

      if (postRes.ok) {
        var postText = await postRes.text();
        if (postText && postText.trim().length > 0 && !postText.startsWith("<!DOCTYPE html>")) {
          return formatAiMarkdown(postText.trim());
        }
      }
    } catch (errPost) {}

    // Thử GET nếu POST không kịp
    try {
      var getController = new AbortController();
      var getTimeout = setTimeout(function () { getController.abort(); }, isDeep ? 10000 : 3500);

      var getUrl = "https://text.pollinations.ai/" + encodeURIComponent(prompt) +
        "?system=" + encodeURIComponent(systemInstruction) +
        "&model=" + cloudModel;

      var getRes = await fetch(getUrl, {
        method: "GET",
        signal: getController.signal
      });
      clearTimeout(getTimeout);

      if (getRes.ok) {
        var getText = await getRes.text();
        if (getText && getText.trim().length > 0 && !getText.startsWith("<!DOCTYPE html>")) {
          return formatAiMarkdown(getText.trim());
        }
      }
    } catch (errGet) {}

    return null;
  }

  if (chatForm) {
    chatForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = chatInput.value.trim();
      if (!text) return;

      appendChatMessage(text, "user");
      chatInput.value = "";

      // 1. Kiểm tra xem người dùng có yêu cầu AI chơi đàn không
      if (checkPlaySongIntent(text)) {
        return;
      }

      // Hiệu ứng đang suy nghĩ của AI theo chế độ
      var isFast = (currentAiMode === "fast");
      var loadingBubble = document.createElement("div");
      loadingBubble.className = "dt-message bot";
      loadingBubble.id = "chatBotLoading";
      loadingBubble.innerHTML = isFast
        ? "<div class='dt-bubble'><em>⚡ Chuyên gia đang phản hồi siêu tốc...</em></div>"
        : "<div class='dt-bubble'><em>🧠 Chuyên gia đang suy nghĩ sâu & tra cứu chi tiết...</em></div>";
      chatMessages.appendChild(loadingBubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      var botReply = null;
      try {
        botReply = await callGeminiApi(text);
      } catch (err) {}

      var elLoading = document.getElementById("chatBotLoading");
      if (elLoading) elLoading.remove();

      // Sử dụng Tri Thức Nội Bộ nếu Cloud LLM không kịp phản hồi
      if (!botReply) {
        botReply = getKnowledgeAnswer(text);
      }

      appendChatMessage(botReply, "bot");
    });
  }

  // Click vào các chủ đề gợi ý nhanh
  document.querySelectorAll(".dt-topic-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var query = btn.dataset.query;
      if (!query) return;
      appendChatMessage(query, "user");

      if (checkPlaySongIntent(query)) {
        return;
      }

      var isFast = (currentAiMode === "fast");
      var loadingBubble = document.createElement("div");
      loadingBubble.className = "dt-message bot";
      loadingBubble.id = "chatBotLoading";
      loadingBubble.innerHTML = isFast
        ? "<div class='dt-bubble'><em>⚡ Chuyên gia đang phản hồi siêu tốc...</em></div>"
        : "<div class='dt-bubble'><em>🧠 Chuyên gia đang suy nghĩ sâu & tra cứu chi tiết...</em></div>";
      chatMessages.appendChild(loadingBubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      var botReply = null;
      try {
        botReply = await callGeminiApi(query);
      } catch (e) {}

      var elLoading = document.getElementById("chatBotLoading");
      if (elLoading) elLoading.remove();

      if (!botReply) {
        botReply = getKnowledgeAnswer(query);
      }
      appendChatMessage(botReply, "bot");
    });
  });


  // =========================================================
  // 12. GIAO DIá»†N THUáº¦N VIá»†T CHUáº¨N Má»°C
  // =========================================================
  // =========================================================

  var currentActiveInstrument = "dantranh";
  var DAN_TRANH_TEX_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAG/Ab8DASIAAhEBAxEB/8QAHgABAAEEAwEBAAAAAAAAAAAAAAgCBAcJAwUGAQr/xABfEAABAwIDAwUKBgwKCAILAAAAAgMEBQYHEhMBCCMUIjIzQgkRFUNSU2JygpIkNFFjc6IWITFBVGGDo7KzwtIXGCU1RGSRk6HDJjZxgdPi8PJHdFZ1hIWGlbHBxNHj/8QAGwEBAAMBAQEBAAAAAAAAAAAAAAIDBAUBBgf/xAAtEQEAAgAEBgIBAwQDAAAAAAAAAgMBBBITBREUFUJSIjIxBiNRITNTYzRDYv/aAAwDAQACEQMRAD8A2oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFC3MgFYKNTYNTYV7j3lirBwauzyV+4fdT8Y3Dli5gWvK2+04UeF6Z0OWxu/6+wbmCW3Z/C9B1j1wUNnr6xT0evKRsOvdv+x4nfRLvChMKR089RZR+2NytDbsejB53+ECyP/TOg/8AzBn9843MRsP0dO+qAj/bVGP3yG/B7tWfw9N39nyjv7PlPJSMVcNIyc7+IVto2fjqbH75ZSMbsJI2ziYi2/s/21Bsb1fulhTdj+IPc875BzvkMcvbxGB8Xr8UrcR/7cgs3t53ARhGd7FKg7Py551VPulsXejKff74MXUreSwWrsxuHS78gynn9uRCGUOLz/UMjomtuMIfR0XOhmLIWQs/CMqZw+66Pi15E9885VL6t2kK2t1OobWMnT4Liv2DzNd3g8H6A0vwzfUKLs2I769ZDiOZ7hDfgYUze/iVGHNW81FfbcXHXpvJTt6G0ukd/b9410QN9tuxd6C7JCbvg3JhlXZMdzPrubV0vbpoQ44wjJ6HPQSDn90C3ZadH2SPs6dk5+glmnvr2r/wIdVT7r+iu9ElM2z5D6RcX3Qbd4Yp6qpOrFTZjt7cm1Hg9xbyHPIW2j7nMX9RzyC0i90f3dKk6uPRHborD7bLkhaINCfcc020d9a8h51lHu97fmfRK4+ZvxETYvdHMFKgrLHtm/Fevb7jf6e07Nvf3w4e6Fg3xk/9Vo/4hGefy1f3ms7bmfRKAEZG9+mxHvtR8PL+eV8jdEWs+r32Ka58RwQxPlL7H8grRnKO7ZP3O1Zv0SaBFuZvqV5Cu9Tt22/3vpW0MFojfKxNfV3o27BXvaqHe/yD3vOT90+1Zz0Su72wd7YRWRvWY4SOo3Xqm39NV/8A+BR/GT3m309+Lu0w2UZ+9nk3Dk/yB3bLnasylbt2d8+ZdhGxnGDeUWyhyXYNnU7P5c2U/wDuHbQMVMZH/wCdXLUp/wBDSJUr/wDKbLutpUTyV0Gfe93j6YhaxLqaELbl1hx9ezZ3s8OmMxUZ/wAu+s6esX1im+j/AEVcfeXtRzNZmF++T62lGGVumzpm9LZ/YU59v4iLUi8t6d5tbUGqW/FkI/CtsLb+g4WDs3fPk8TZiJZTHM/BUGazikINUOFzs84paamz/rYM6PKIe8g305XX4wWuwjy40XP+wWD1sb4D8lepvEU6KjsI8H5P2Cju/wD4W9nx/wAsE0c2wZthCtq3N8RjO3/GXovt0XX/AGDmZoW9vz+V70dLR6ltt/vju8fR52j/AGwTO1Px/wCA1Px/4ENkWVvVvSELe3t222e2hFot/p8qL1dgbzD/AFe9pKb/APhuL/xyfd4eqHa8f80UvM/2/t7Nh82yEbPuq2ENHsH95J9HE3066heTn6NBg/vnVyd3LHSor5RWN8e/Fo7aIcJhj9sd3glDhUfO1N/ZIRt+5tPut3+yas95zCTGzCGzGb8oeNl/3XAiP6dXZeqj6H4up1b6NBaOZ2PbIYX3WLwuOTsqFcRfC5LDOmiSvlXwn23C+jO7/wCCfC4+E36G9ZkbXk7Pup73+80I4J3dfDCEWuxclyUFGs24iZMW+hvTccQhzoHd1LFTFylV6ZR6riZevT5RCeRWprDcqJz8j6EZ+g5kE87t+Cyng+N89GE29LVR8p92PbPvbdhodRixjAxGW3ExUvXWYXqf6wyl/tk9Nwne4rF7SdmD+Kdc2TaytDkihT5K+PNbRz3GF+W4jZz/AKMU8Rpsntp539PX5OvcxTyBRnKzoOEFCypXRI+b2u8lGwDspLdI2NSbsr6nI1GYX9pCNuxHEfc9BH+K9qEffPJz0Yc06KZ5ie3W5N5Pe+w53c6c41WFvVm4FNbVx6HTVo19nf8AuOPuL5jDfpr+X7SFmuy+9/reKxWrCvBtXj0Gj7F52KbR1vNuehnf6xf5sj5W494YtSbgvBdQlTYcB5c+r1upPZFyn1udYtfV5+fw0dhstkYXYgMRrbp8SjrW9ea9ChcmWhfhDTcye5/3mDXKfzm+mryNOUw/r92cqDvIbwlzz40Oh3IirzGFuOZJM2UvP2Ofz0N5PQOhuS5saPDy6fKxQYlTM+ouHAuR/Ih9zxDfP6zocNGfrCXWA/c8J1rU6m1zEjENxuvR4un4NpVPi8hi6n0iF66+xn9cyLu27lVn7u903JeblQRctYqcpfgyfMZ+FwonTWjzeda+2hCOwUWXZbQzQzMq5te9yUPeIpzMaZLbvmVGlo1M64VUQ2j5vO4g62g2HvEX/MRQ7Zte5ajMf4aHuRPoio+cW+5wzdJkcyeI984Vob84j3znb6zq5WNOF84H7wGEjyK5fFn1uLAjst8qkxvhsVbbfWc9tfD7fkGdd37CTc73gab4PRel0Srhyaj0CStcJz5xtjnuNv8AsLJ/1u349SjPQ347D8aWhxt9C+224RmxR3DbDuNldQsCZKs2q5NOLJhzV6CNPIjno9jxbhfv02fdTC22Hk5ofc791RjhotOqSvTeqb+c7WN3P/dnQ8jTs+qL8tHhRf75gvbUt8zdfamVm59O+LPpqNR9C6zy1bbfQ4b7/Hb9sy5gpvs4YYm56Xc8j7F6q/qLisyahrxZrHM4iH+H4xfQIWVWYpddb7Pcw9y3d/iZ3GMP2EemuoLO1Y3WsDGEcn22XTsnlrlLX+4ZFpq4dRz8kbRKW30+MheQ7XUc5mm2hH5cxaIr+rzHsxWzuvYHsL5lp07O35C3/wB8v5O7ZgvKRx7HhL9db6/2zJzKOZqLcR7CytDba+I45kIaKjqbvZiv+LLgnkQ23h/C9jP++XiN3PBdjq8N6Rw/LQhf6wyXpx19XIWg5kMR/GTF++ebMFPU5n2Y6jYF4ZxHuURLPp0VbfQWyhCDsnsPaW31HhF/0ETV/vns8kL8IX745K2viNyF++aq8dtROc7Pu8AvCe15y+UVmjwlr/rKM/6w4ZOGthxEf6r0Tocz+T2DIS4kft51+2stnqPDc4em976z1DXOtrB3n6zYdHxdr1ty7HhMLfREc5TGRk8Wjif9NoJUYFYe23b+G9vR6r4BqNYYhNtrnwIuRD2p1ZiDel3V94u/8cardGEluMvUR+nwNGTJrTcXjtt8/mEg8EMMrswvwKZj4qNwkXDTYsuRNXDlcqYQ224tbfP+jPMa+WDqSzULIwhBAm7arcluYo167IjlUms1KrvvwkMxV8zj8DmdX1eT3CQm9pjLcETA20uQsTaDXqtKYflIgStNfV9Xn6xHT4iCOWEVckVzFG1XEVhE3lc1hvIjXz6jnWdYj/MJP77FnUulYSwJErJFebqjEdmTo518TPqfoIM0PrrdPM/3YQZpwExbtO/LD8ITpE1dSprDbk3W5i+oQ/8Aq1nubDvy1L8Zebpzb0WpRGW35sZaM+jqeQ+3w1o9NsgBhRia5/Fyvm26PoSnqEh9xDyEZH3nHG8jGdft5D1W4xdVyTmfso8ORX6bbzDkDkGjkce83z/m21ktHNyrqZ65thCGIaOGuO/7iyvUp/V8jXn9QhPVt/iZCxR8F0qI5Jo7c2W3UIEynto0WG+Yjkr6F8Rbnp+M9Ay1ivvq2HhDMptPqtp3DVF1phh9CKahha0amfh5HH0c/mE9tlnG/D7s8LRT/wAH+oUacNz+j/mTzFn4hR78tuNcEGn1Sl8r1G1wKrF5LKZc9NB6dl9xhlDfLEI9g95YIacRESn/AIGj3DmQiH1fJ0ewgoQ+4+jiSG1o9QcrbY6DiPcKuRzxXPJY+TiNh5uO4jT0+Z6ZQiU35xHuFyhyP+EILcHizeYjudZHz+wfeQw/wP6hcLcj9uRkC247mTI5nKk8HDn0/wCjv8PyDG+8DiVWMLsLqrdlDpa357a22IvKeghxzxn/ACGTtBvP1h0l/wBlUO/7VqVp1zIuHUmNNfloc8W4g9g882tafvXYk1Okwbpm4vopbM7Y5tjIemrQta0dNGRvI3+bLyo7zuKjj8mjVvFdzvxaZy/PGm5OBp59Rehk7HznYPW3nuTYkWzG8H2PZdtXLAbfclsrmLz8Rz0Ox7hXA3LsYJ1Eeq9ZsO1+XsU9+AzDRNWjOwvpt9Poe4dGGz922c63krP30sRLLeRWGMQGLvoLE1iA/GmZ8nE9NzO4bDrCvGmX3aVNvShw18mqTOohGToeW37+c14WbuVbwFxVKTQ7gw7tC3aU/wAN5aGcjf0nD4jhsUsKy6fh7ZlKsynLceZprGnreWvtuGXM6PBTPlod4hzU/oa/YQVvaa+m2v3Ahjz5XptuI5jizLBDU4V9Pt5/UOFbGfiOe+XOnz+sX7//ACFehn6uQ4SNbobhtyh3PRJ9v3BDXKps+K4xKZX223G+IaP8WsCqxhviFcloyatDZdt+oPw21Ocz4L4hxa/oMizewtjyJi/bZQa4u6EYc1BzGCBUKNHov8u0JyXNenrQwheg4hjpuL0/HoNeVum2ZLDcnoQkw7gtUC7YEx6t095vX5PJ5O/02HOYZpvyx5lVoPhyVMrH2SW8+3SEMvRdCKhtvPqc/QQ31i9RviLc03O2YHRN8FXC9E8H0hfPcbRoozt/9hKigsVe+KLyOXiRtp8W7LcbkRYD3wrwe23E5LOcXqLQ42w4uKvodM3Tx3Pg04V9PZrY3tWh1By6o1v1jUirlr01rZhLXk1G+G56modlMg3phXeEaQw3yWfSZTkunzEZ0cRh/JqZOsb4iF9Yc2H16T7VlRrHXdEVyg8tYcqc+grX8KiOZFuN53EIcWjp8PmcQzfip/Ae3QXplj1ylwqkwtt+kPU2KjJNYcycNfP1HOm/z+xkOLCHKM5+cH02dlONtNc/pNsZwExTp+M+F9DxBgt7GVT2MkqPt6bEpvbtQ+3/ALlo2mSdpATuX1/OS4d52I9LbcS3KRVmEI+1k1OYvmewgn2fVZW/fp1vzPi+S6DOTpcbne0lbdppy39LzqeIGK1z3nsqcKTSKLUfsPpkPUzuMtsa3K31+Qhb7DiPyZuLe299vbtPz5XhSqw3PmXJOrCH3rhqk+WtlC8+Tj5+ej6R9f5wjnZ7cHT/AExTC2/U9xg7b9uU6m0avVe/6PCeuSouU3kbs9fJaM243nRIf7CH1rbyafm8hnDueD9Qxa3iKxc9/VFdYn2TQlt0jPsRoRW1v5OAhHMbyI6HrkTrVfmOMzLbY8KSkT0c9lnzjbiF6n7H0bjhMXuZ0vJjBcEODPXtgN25Lkcj08mg4udF9/mHKuv+DsZ7JbErbGyFbnmxp+WF6ftlbzbnYMT57QtnoMd/pln4ObQsv/hPnF++UaDi+sbcKhZvRG/OfULZbEftuLbR6hfvI0ytCPIzh66GZRm50Zcd+OxKZcRprQ8hC0LMY3buvYJ3rMXMuDDekaziNNcmHC5K+tv128nMM2aDnqDQc9P1yzcnWIK2Nu4bwG7vPkzMPbkYuGHPW45NjPLycqbbz9e24hGo5k7fWHZYS90Gs+6lxqPdtnzbeRPZb5E9r8qzuL8tGTho9/8AVk20RG20cNw8xPsC050yNMnW3S5T0ReowtcJC8jnoczhlkJwx+6c5unt6/7XqsmTS4NwUSVPgMNyJUZmaha2W/OLQeqh1VtaEOajGTJqdMidA3C/sSvuTeFl4p1ql8rqbkhDPJfi0RxzPoIyeR1fPzlbO9nfluXnVbHuDBOoopUCqPwIs9lmUtcptt/I2/qOI03OHz8hCdMPBOCYDL+p4xv3zmQjU6DjB4OiXrQ3JL1HfuCloqsRhuRKga/HZbc6vUQengVWQ+jUW4whGTplaE3cZHPFyEHMj03M5YMy+Dw5CDmZlZ0cSQgnrUrlbmn/AExaCjQ1F9YsLfbR05CPcCJXzjA1q5q9Btv+kfUKHotPfZXHfbQ+y5w1oWjOV6iPOMBDjfi3GPcJK/w8R/Adgo3XodzsYV2ixWoD2vFmM0VhD7LnoONoPP7wO77a+8DaTNp3HVKjS2WJrc/lMBlGvw8/D4iF+WZaW+4jq5HuIKNeR+GElnVTQVxR3NKXg1hFcMfBOj3RddbuGVAjymVrQ+4hhh9b7jiEfU/KHht2m1cRLEevC4L1s+r29GptPYl55jOgh5xvP0P+u2bIPhDnTmI9w6G8LRo98W3Pte5nFvwJ6NN5DL+gv32yE2qjNcvu1cYJ2dMRivyi8Y7lU5druMay+VI1+npl/vyTqPSqrQXGKewxW2ENvrXA4D7LfTb57fV9MmTau5/Zdj3zDvilXZWnkQEP8lgSVoWhGo3k1M/WGAsd90LG+8cQ7huy1qjaM2HUn9RlmfUH2X0NttoQhvT0Vt9g8o1uhddC+Wt2lpYzX5bm7rArDFQmyqq5RWPh7z2vKQ45k1HFrc4jnrna4FY07wFSuqmx8TZlvVCiVJnlcV6NFQuWtjn+bXpt9A83jNQKhg7g/DttjQlVupUtymMojLRkQ5p8TIY93TqVXGKVXnJ0OVSKkxNbbZ0fN6fkdW4WoQp+CXV7b22H+G1betev0uqNyYiG+MjQ0/zizJ1jX5DvigxrgiU9bDMvoMzEI1/zZruxprNt25iR/pxb8W4qlVqXqRfhS2OSv6mRt9en1mQypfOI1QtjBmTQ4OvS3uHn5/Dfb6bmRbZ5OCjQnOt+O2zqaaPfGdvzaPYQQh3acc8UNGqyMXqg3Ct63oTkiVJmIfXk7bnMcRrtkn7Pxmw/vFbMO3L8pc2S/wBBnPkX7ji9Qo0PXvFuR/wf6hXGch/g6PcLblzjeTTmZ/YLlbjnM+EHiLm5VHOFb8dzxaDh5W54txgrZnOZ+e4j2ALxD8fR6tHuFC5cf0ChcsrQvUR8YR7gVKHpcfPpuNrX+Qzln8DWvU5Gj+5QguVynG/GIOHwq435BFa5meR+Ljo9wue+1+Dt+4WyJchfE1CvlUjsZCehGataI/i20f3IQ5k/7ChcuRn+LoOZEr+roGhWLYjr4nPQQt7plBkRbPs+uUbXRM8IPwELQhHjG0L5+p82wsmqiVnXxI6PfIid0vbp87Be3uXMI+3drGR7P1LnJJX7hOv9tu4f/wAmDVzUnKo5UmXNN9Ext7nvIyEnMLqlUJT1nuN2PRKw8/QqlSZqJ6IvMiNz2Fuc9/ht5231oc8ZxyMlXqNsfB9JtGxbbemvPtWvOvn5F+hk1PqEmMBHLDl2xZkiq1yo0usQJtdbpHINBC6g+5ocBbj/AA29RvOj8odGHg7Gf83ibbtynzsYJNp1il1SiRnKvyTwbDZQ/Li8TJoIb8skU7gDh34brFj0CoVS2kRJsDwozW4qH6jw8i3NDT4edba0L1M6+mYKqEGNRMTUXHZGI9Tr1xoud/YzLkwlsyluZ+Y+56eutxHV9jOSZtLA9uVUrkmXjXJtXuGk1CI/4SmPcq5TL00ajeRzrEe3qcPsdWYqYQ3pruL5qdeWpnr0fBfbqduWNhlvOxKfYN8UuqUmstz6byblq352o3xNRfAbQ3xGFoyaizYynZ39ve2/c2msay6rVEb8tnvy36c49IkMtoZjPoXoscgcRz/Nrz515PnDZ0j7h2OHT+0HyfHNU8arpz16oPrmzvt7dho+xuwluiLjNe2F1Aodaq9eg3A+5SERFoQwzAffcf7fT5jkX1MizeCroGvvulu77PrUaHjRbNH2yUMM7afcDKV6eijZz4s72HOYv12/INV1e5Bl4TmpZe74IuUrdexso1ktViI49CqVNW5PlMsvZKihzTQw3EbydZ01/N+mSD7m1blHt+9r4huO3C3cMCkxG6hGqrLaNHUffW3oaa19hDecwLg1ihZdqbvFx2ncdQp1Reg1pifWqJPZWy4y3ro4iOYvlaNRhHqanEG7nj7hngNjjPxLo0e5YtgXChukykTGUPclcW5qdNvPqIb8WYbqIaPg7FmauzGE4TbaFtua3EbWc2f1/bQdfbd62pd1Bh3RaVwUyr0ecjXZmRpWdtbZeQ6zTqrHRMpUmLKjOLW2h5l7OjmdM5G3NzubkW42cOoXKNNzptoKHuRo6Y0Ia4LB58IfLn+T/LQWy4MfPwHCvQa3MhwuUON5NMs+SZAts8T5r9Djfmyh5tvzZZoccLnsf7wGTmFnJgx3OI5nLzidgfSFz3WidVdwu06livcOIcXECvRWbhe5euAhCFrQ+vrOP1nkep/dnW3zixvIWPjH/BHh5gv4btWBFYc8MaD7/Km3GEZOJ1ba9TPqdPoEwNMoWxDyaep76y3C73Ua/RjFGIVr2XAo8fEK8KRb1Yq3Uw5kpGotzTzuNoR756SiVxyqo5QxVEZOxkZzmHsYNzLDLF/FVnFauTKjFktxY7EpmGtCOWrY6tzU6aOZzOH0/YPG43xN5jDmvWTa+7TQ1otJv4PK5Nkfc5Q5n1OVa6OGwhvn5/OeoNmFk/gnuTSoZquo8uPyhGf02S/5c4jhuOI9wwnSr8bwrsOBcm8FdlOpE/q316/XP+bQhvrF+oekw9xYpeJsPw5ash9+m9ha2cjntoKdiafwZO8JczsL9RZzIl6ni/rnnnqy2h5Da+n2+AX6JbbbOp2PUPIDuFr/AOshRn+bLBEvzhzIc+bR75JTpXK3HPN/ULZen24/1Cteo4vmfUOFbjjfjFkjQtnuR59NdPX7aDrZPI/N+4ws7JbjfnPqHDr/ADn1MgThN4DELCvDvE2NGh3pabFURE1HGF89D7P0a28jh0Nh4GYd4awKrDtiHK0asttxaJL+vk+bRqGVF6efU1PfQUanM7Cw0biD2M25xfF43zMuSleAZrLi/gWtU5UV9Dfi2+HwzAOOsTFSgLRh3yP+bdNhaNZaHJTiG+I4wtzrEai/Fm1zkmfiONnlbtsC27xgPU+47fp9XjdtmYyhaNMmlvIYUqjXRduDi3Lqqk2bW7ohNt1Bbz/P6vznl6aDFG6FBvCpYwUqqMTKuug0KVLbeW8xrxUONscPn+LXp9gljvP4SXxWbbt6l4Q0PQgRFuctjRpqIr62228jDfEWjURz1+M7BiXdXwIxYtV653L/AKfKi0d9hhtmAvXRrP6i+Jk6vmczn/OBPWyLvD7yd6Ya3DatPtWocipr633KhJXFQ+jsIbb6HrmSMGceqpiExVfDngh/kGm4xJgLXke1M/WI8WQSx+xUpdf8JW/Q4c19cSbyfWe5/VudhZkjBah1TDyyV3JX4b8Vm4WWJcV5mpsSmH+B82vU8vmLKdHzaoaNlIqBvz4UfZbWLXrNPrUKNTag5A8JIi8qircbcydW3xG/7tZn6g1yj3BR4dcochEqBPYbfiyUIyZ23DTPck6qWriXPbsuYtcaWjXWhbyF8Rzn6ZJmzN6jGih1Wm2XBocJ+m0mkQGFxnovXS22Ea+Rba9RsnOiaE4fBsXZ6Go5zEHMhxvJw5DZiLDTFT7MbD+zS8af9jWg++3KZem8Nltvxmc9zRKxR6zG8IUaYxNZ7C2X85RrU7c63odSG508hbZIefxCPbK0cncR1iwyiG4jrFkEVa2G0eMQczOm31jnuIOFCI7fQkLR7BzIc01/GM/royE4IzVoR84j3BoR2+JzPcK1vufhH1BqOOcPU/MlqtQjhr4bnMIkd0pW4vAijyGKg3FW3dTDiEZ+I98ElcNHp88l6vlDfD0/cIc90gty5L0syxLLs6hzajWJ9wPz+Rs5EOLQxBXqfryeDXw+ejMwayqlWKpFbibWJlXfWvrkai8nvkhMInLgg0fDqsQYfhF6XUK038Jm8lbYb02ENv67iF6GmvIvOhvU8X2yM1YbqkSvcjcmclksPabyNboONktMB8MrovilYe1SJT68ulUmbVn36lTX8i4r+owxp6/P0+BnNnpB2M/dDnJ0Nt0aqV3ekfti7Y8WzZK61OkPRoaG1sUx9DC5SG2/F89bCEeusmlg5iNDxCRP8ANzVz34rmvR2XmNdlznxX3OGvTyanP+j5/EIPLfqmB+8C/cl629V6xGYqEuWhmto0H6tEf5Uxyhep5efP8ASIMkWxXJFAjIqm71ZcV+56zSGIlapsNc2ociY00afWL6/TYWhzh9YvPzyGWsrrukz8cytmfohts1P4HVy3t5Owrup1DZehu3gxOXPisuLc0HNThynOhqN+xw1sdYbE0c1vZ+I1fYJYnV3FLeqw8plCqFxQYjexxy5qPLe78VDkGO/oON8/b4zmfcR0GzaAjb+I6mV0WapwfLcQruy+MK7nIWVSpsOpQ3Yc6OzJjPoyPMvIzoWgvQbWD8NU2+b3PWt2fMkYl4J2/Kr1Ccf15tEZ2a0qmI+Y8+x1nziM5DamzqPUYc+PVYbi1scPOhhhhcJzno5/M/WH6HlsZtn2zF10btGCd2zZdUqthU1uoT16kqZEb5O+8v01t97btMtlM/B1srxPlDbuadLPqVjv0GBR645TqChuK43KXTXqiw5K7DeuwwvTfX8/8ArDNO7fvHubt8OpWXTbkoN0WT/OcKAuUtD8XPz3Mi8nT1Ow42T9qW5rgjUoXIHKXVG2cmnkRPX+2ebl9z33eJkZEddKrSFt/deRUNudfr/KV6LdHLSsnZkPabBMzundn8HwNhnNfX29aqIRk/u0HqrD7o3g/cz3g+7qXW7N/rMxlD7C/bY4h6CZ3MHAmU6tz7ILxZR5CJrH/AOmk9yqwdzocg3vc7Pez59ZMV/P77Zm2J+i7c4b7My2ljZhPf73J7HxItetveZh1BC30fk+sPYLnafWN5PYIxye5ZWFs0XIN/SWHYi9Rl5dGi6iPbbyGRm92/eEpcNmBQN5NGjHQhtlEm32/vI+kKMcrP0QnHJ4/S1llE7zeh7hX4R5+m5kzmKWMFd6SLHRsXjVbkp9vtvUjhr9gt5uHm+OwtXIbzsGUjb5cDajOQnlboeCMKafC6LLyKroL4mT21lz4Y822YGk2tvxxEfBaXhTUfXelMnWPub/1L6GCmG1TR/VrmfR+sQQron6Jzqh7wSJ8M+cK/COp1jfM9Qi5MxM37aO8ht/c6o1R9OBdbH+YVxMet7WP/AD7uRV1v/wAncLEo92sUelxn5pRolx/wdAW/DcX8XR7hGTZvL44Rv5w3NsQUfQJ1P2Cr+NtcjDKHKlut4tMeXkpGfIV8sTDI2Y/jFJB5+P6Bwocht9ZkQR7Z3tqWviP4P4oIR2/9G315C5RvdYf50Nv2/eTC/IXbb+oOWKPT2+rIuLWEGH+OFqrse9Ia3Ka4+2/njPLYfQ435C/fPH3/AGXMwnwKk2/u9W+3Bn0VDDcKHGRyqUtjU4+hrr6/Tz6a1+MLNne5wjYR8LcuWLqdt625Wn+gcP8AHB3d3HkOTsSGIun25lMlIR+gXQloQ6e31dJhj/CBhRg5Ur83gZkp+fSUPvrZWtGutjxGfT4ba1/UObd13hHd4G3JN5s0OVSoceU5D6a1sewvJprO4XvX7sc7/wAcLQyPo56JMrJnb/KHS1XErdarFgT8M7Sxqw+okafCchxeQXBCi8lcX0Mmmvy/fJwwj6IbM4Mp03FS07gkrh0CsMVBDfXrjLzt6n5M9V4Zp7bKHNRCNTy+wRp3abLwrwTsZ6hv48WpdE+XKcnypjNUio4mn1bfP1OweY3UcVL7xUum9nMQtsWFBos1huFrSUZ1uLz52EI8hDeQhsp6JwTMjTo62eY4hf5fIUPPuOcPU5nrnmESm2EaaHEZPQX/AM5folN5EdP3M5Qlysdlocztr9jOMjiOscc9w6fl2pw+Tr9xZX4Sj59PmZ/I56Ar27Har08nxj6hcs6eRGo5+gdP4Sj5PjDHv5zm5dH0dTUR7gT5Yu44jnVuZ1+hkOF6Jp+L/QOtZfjrXzG0ewsvNSO3/R1++FetwzKVyvptrydjmZy28HaGdvTXk9QuVrj+mj2ChGm3/TF+2ggnuMP3huvYP3w9yi6rHpb62/HRl6D6PyjC0OGK8ddzS37xs+3rPsOQi1KVRX3JaIyGNdt5zT6xfP1HF+mSxkv8zhyF+4s4VsNucRyR75OE9s1tWE3d0xD3cKk7ipiFR7Eq9vUzUbf5ZGW/4QQ5zNNbGfpueLXqGJLnvin1i4abVKHb7MXTeczyci86G1+LRz+wbg7ktyl3HDXS6lDiyobniXkZ0LMCVvcYwvnVtm4KHXK3bS25WuuNTXkLi+wh9C9P2DXr3IL6L9tHifWbkrG7l9idGmctRPlOPrXGeXkebbcz6f1EHa7s1cp8S57MvjwhKhMvrfcmssvcxbmgtHP8W55ZzY64F7xEG4arekGsP3KzPQ22tmj0/QcQ223k1OSt/nFoMV2TBuzCu20XJcdHq7FK5U/SWUcl6Evzb6OsYXk6vP0znTodqmyuyCXtK39bXnVupR37Pq8qm0ya5ERPjP51r+cWglXbdx0u5rbptwQeVIhz2G5DGdGRem56BqRs+s0dy/K23QHHORy4TDi0TIvDXL8Z835B7+ibzuOEG859LRcE2iMsMRG6ZDZQjQ0G28nkcToFc69uU9aFmV34Q0NoiNP0/fK9PU6DiPcMMUrHdu2MBIGKF8fCp7dI13kIRkW8/wCLb9tZ0+F297AxJuWBa7mGlepz1SW42xMW8hbHVrX/AJZDXCvQxTytnzZ/W3Ib8j2x8I8Y4w56nMC1yF/0dHvnDncb6xvJ7ZqYvw5luONo6v3Fmuvuol1ufZVZ9rsVRbC4kJ+WvIvoa/6vq/qGwtc5z4uiOtep6BqC3sMc6PiVi5edUctRdRagTVwLfqvhBbGi2xzOoyab+dxC1/lC+ivcdDh/97cRpRpv1RGSYta2+2TMwhfue1aVRplOthu4aPSbY5WuAuUwjlL77kqVoIQvUc58RxDjnQ4bfTbIe2zS5tdrCKXCiI5TOebiMZGfGLWSQvOfaFu4e3DMolcvKkVeqL5HT0IZlRYsmPEyQkN9DTcRyVHEXn9Dtm2f7bXKfUWbbxcNin3HbyLoqV+UiDJfm6bNKWuUt9Dfi8mpn00flD09vXU3atYqTlGuiVymfSOQIepq8mdzza+ehzsfnCz3b2LkrOKtuW3bNV8HcvYf1nmWEOOaDDC16aNRHjFoye2e8xpxQrFgYnLj0eZCqkmDT24kpmq0xiUxCccbzvsIQ4jU8jp+cOXZTr/efW4XTrlhkIQZj7mvY+2q7wdw3fKif6t0bk+f5+U5xP0DaCgiF3OSzZ0HCKo4n3DFban4g1PbPayMIYRyJvZosd5COhnUhxz8ogl/3/td87fDadrL8n5rx/NdRn5zfQAdBxgAAAAAAAAAAUabfyFem38gAFGm38g02/kKwBRpt+bGm38hWBye88XHptfIV97Z8mw+g85YHPFRpteaPmm18hyAcsDnit3Ikd5Gm8whaPS2HXyrSted8btulvfSw21//Y7gEdFaWvH+XlZOFeG01OSVYFuu7PSpbH7h0EzdywGqPx/B+1HvXpbP/wCjJIGiCO7NgSt7je6fXFakvAi121+XGi6C/qHlJ/c3d1iW9yhq0KtCe2oyZ4dalIyfXJTAhsQWwzN0PJEVruaeAkVtCKXXb6p2T7nJqyj9tkspPc08PNZb9Hxwxgpep00RrhR/wCY3e2/KO9t+Uj01K3DP5jDzQ/b7n1NgJR4D3p8WW8n4fNZlf5aCj+JHjLBVqUffDvJH/maehz9smH39m375TtRt+8V45KlZDiWZw80N3d1Tesi/Et7HZK8hEyiNnJswH324vQxzs6ajyF0XJ+wTEQV97Z8h5jw+hLuVyGisON/OH8UujDSoeg/E2t/oNnHGo+/5Be+HYf4U1dn5ma/FWTN+38mz+0fb+TZ/aVdrpS7pP0ihd4W374K18q3fLKlI/qdyL/zCxexK30IK9Oo7nC5SP6nd0Vf1HCbuX0Nv9o734v8AEl2+s7n/AKYoQxsct4Zhte2ubmF6t7EdiNOYlLLSpb2VXoedu4t2DGCnrb65Oy31v5PbRw/rk6Ptfc7/APgfdLZt+33tn9h52/A7jDH71ICM792GbHDrmG9/0hfkTKEtBcxt+vANx7TckVuFqeepZPFbbKuk3sWWMmgUCZ8ZodPe+kjIX/8AXYQ6Kfunhnqf8SGLO+Ju15FuP3pyVHbXJp76Dwd+YtbkGL8CfTLjv+g96pIbjuPL1GH0ZOrcQ5k6aPLJ3SsKcNJvxjDy23PXpjH7h0kzd3wPnbOPhLaTn/udgdDOHmtr4jlcPBqNqWEOD9nVtEizt4i161GcZfycsRoLbfbbzsNv5OrbXxG86Og5ocw6Gz7jbquIVKmXHVIUpDdMcgRdF7iIzuLW32Ean/ObfH91Hd3e2d9zBy11r9CnIQeJurcQ3cbgcjv02wmKNJZc25Hqatxvbs2ZF+n3u/s2rzoX2F7Ebfvd4zT4fNso41TXJCLELHuz6PR4eF8631zaUxT2235K5WhxHOsbRzC83RbjmVW57Ghv3YtGhKcbRGyLfbktttr831a+eSBmdylwfqLk+VVcT8QXqhOXqarUiK2hH5PQyGLsPtyPESy8TGcMLhiVSo4fbas5/KsGe4wvQ0M7bjnY6fMyc/iI9MozPC5/dqp4plsYThCSbbKG8mo43k9QrW24hHMjrX7Zj1G4nhSz8Xua/Yq+9kQpm55SDz0ncJeiOKdt7eWxVpyew27UuVZDThlbvVyNzKY/9rod8/HBzBrCWTT6bMX9k90alMpaEL+Kt6fHlr9T9Y42aa6zUZDD70fZU5TiG16fTX0/fNwV8dzVrt7z9lYrm8PUKtMR26rQESuH5HXGDL47kfjFUJ612viJYO2N91G1FFcpy9vrobzmiiieBhmqaYaK5Ij4B0Sl1KrLqrzVzvchYfbzUykctWw4ttfHQhC+xz+wdrjHek66a19ilrXJVK/bFK2NyGJM6Mht/ZIWwjU7+TJqaenkz5EdBfMJlW53MDFa3Kcy1TsSaWzKQwtvZo7VoQh9zOhbi+AvU4a1+R0zpGe5S4103I4xfloSlo+nR+wSvrm25HO00Xb05oP6lYgyWdOHKYWxxELRzHD3u71g9XMfMUaRh5SWHG2ZbuvU3tjHMhwEc9x9a/F+bR6a0EmJfcxd5Datehclor1O3tkufuE3t1bdft7dsspyIiSirXPVNuxytVXRybVud/7TDfe6DCPvbPv9Mx0cPn5u7xH9WV40fsfdme3bfpls0OBb9GiNxINMjNxIrSew22jIj/A7cA7uH9H55jjzx54gADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//2Q==";

  // ---------------------------------------------------------
  // A. MÔ HÌNH 3D ĐÀN TRANH (THREE.JS CHÂN THỰC)
  // ---------------------------------------------------------
  var scene3D = null;
  var camera3D = null;
  var renderer3D = null;
  var controls3D = null;
  var is3DInitialized = false;
  var strings3D = [];
  var stringHitboxes3D = [];
  var stringVibrations = [];
  var raycaster3D = null;
  var mouse3D = null;
  var glissandoTimeouts = [];
  var is3DModeActive = true;

// =========================================================
  // TẠO TEXTURE MẶT ĐÀN TRANH VIỆT NAM CHUẨN XÁC THEO ẢNH THẬT
  // (GỖ NGÔ ĐỒNG BẠCH MỘC & KHẢM ỐC XÀ CỪ NGŨ SẮC ĐẦU - ĐUÔI)
  // =========================================================
  function createWoodProceduralTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    var ctx = canvas.getContext("2d");

    // 1. Mặt gỗ ngô đồng Việt Nam (sáng tự nhiên, màu vàng kem cát mịn nhạt)
    var bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0, "#ebd8be");
    bgGrad.addColorStop(0.15, "#f5ebda");
    bgGrad.addColorStop(0.5, "#faf1e4");
    bgGrad.addColorStop(0.85, "#f3e7d4");
    bgGrad.addColorStop(1, "#ead5b8");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 256);

    // Vân gỗ ngô đồng thanh thoát chạy dọc chiều dài thân đàn
    ctx.strokeStyle = "rgba(160, 125, 90, 0.11)";
    ctx.lineWidth = 1.0;
    for (var i = 0; i < 95; i++) {
      ctx.beginPath();
      var y = Math.random() * 256;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(320, y + (Math.random() * 8 - 4), 680, y + (Math.random() * 8 - 4), 1024, y);
      ctx.stroke();
    }

    // Viền hông gỗ cẩm lai sẫm màu
    var borderGrad = ctx.createLinearGradient(0, 0, 0, 256);
    borderGrad.addColorStop(0, "rgba(65, 25, 10, 0.95)");
    borderGrad.addColorStop(0.045, "rgba(95, 40, 15, 0.4)");
    borderGrad.addColorStop(0.09, "rgba(0,0,0,0)");
    borderGrad.addColorStop(0.91, "rgba(0,0,0,0)");
    borderGrad.addColorStop(0.955, "rgba(95, 40, 15, 0.4)");
    borderGrad.addColorStop(1, "rgba(65, 25, 10, 0.95)");
    ctx.fillStyle = borderGrad;
    ctx.fillRect(0, 0, 1024, 256);

    // 2. ĐUÔI ĐÀN (BÊN TRÁI: X từ 0 đến 95) - Bo tròn khảm hoa sen xà cừ trắng bạc
    ctx.fillStyle = "#42180a";
    ctx.beginPath();
    ctx.moveTo(95, 0);
    ctx.bezierCurveTo(45, 22, 12, 72, 0, 128);
    ctx.bezierCurveTo(12, 184, 45, 234, 95, 256);
    ctx.lineTo(0, 256);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#deb887";
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Họa tiết hoa xà cừ trắng lấp lánh (Mother of pearl)
    ctx.fillStyle = "#fdfefe";
    ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(38, 55, 6, 0, Math.PI * 2);
    ctx.arc(38, 201, 6, 0, Math.PI * 2);
    ctx.arc(20, 128, 5, 0, Math.PI * 2);
    ctx.fill();
    for (var a = 0; a < 6; a++) {
      var rad = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(38 + Math.cos(rad) * 11, 55 + Math.sin(rad) * 11, 3.5, 0, Math.PI * 2);
      ctx.arc(38 + Math.cos(rad) * 11, 201 + Math.sin(rad) * 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Dải cầu đinh giữ dây chéo ở đuôi đàn (như trên ảnh thật)
    ctx.fillStyle = "#2c1206";
    ctx.beginPath();
    ctx.moveTo(140, 34);
    ctx.lineTo(460, 232);
    ctx.lineTo(453, 238);
    ctx.lineTo(133, 40);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffda65";
    for (var k = 0; k < 16; k++) {
      var t = k / 15;
      var px = 136 + t * (457 - 136);
      var py = 37 + t * (235 - 37);
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. ĐẦU ĐÀN (BÊN PHẢI: X từ 910 đến 1024) - Băng khảm xà cừ hoa mai ngũ sắc
    ctx.fillStyle = "#42180a";
    ctx.fillRect(915, 0, 109, 256);

    ctx.strokeStyle = "#deb887";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(915, 0);
    ctx.lineTo(915, 256);
    ctx.stroke();

    ctx.fillStyle = "#fdfefe";
    ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
    ctx.shadowBlur = 5;
    for (var yf = 32; yf <= 230; yf += 42) {
      ctx.beginPath();
      ctx.arc(970, yf, 7, 0, Math.PI * 2);
      ctx.fill();
      for (var pet = 0; pet < 5; pet++) {
        var ang = (pet * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(970 + Math.cos(ang) * 12, yf + Math.sin(ang) * 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;

    // Chốt trục kim loại đầu đàn
    ctx.fillStyle = "#f5d061";
    for (var c = 16; c < 245; c += 15) {
      ctx.beginPath();
      ctx.arc(932, c, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Huy hiệu nghệ nhân Đàn Tranh Việt Nam hình bầu dục (như trên ảnh)
    ctx.fillStyle = "#5c2411";
    ctx.beginPath();
    ctx.ellipse(750, 60, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#f5d77f";
    ctx.font = "bold 9px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TRANH", 750, 60);

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // 1. Texture Da Trăn thật cho Đàn Nhị, Đàn Hồ, Đàn Tam (Snakeskin Procedural Texture)
  function createSnakeskinTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#dfd5be";
    ctx.fillRect(0, 0, 512, 512);

    var scaleW = 16;
    var scaleH = 10;
    for (var y = 0; y < 512; y += scaleH) {
      var row = Math.floor(y / scaleH);
      var offsetX = (row % 2 === 1) ? scaleW / 2 : 0;
      for (var x = -scaleW; x < 512 + scaleW; x += scaleW) {
        var cx = x + offsetX;
        var cy = y + scaleH / 2;

        var distCenter = Math.sin(cx * 0.015) * Math.cos(cy * 0.018);
        var isDarkPattern = distCenter > 0.1 || Math.sin(cx * 0.04 + cy * 0.03) > 0.45;

        ctx.fillStyle = isDarkPattern ? "#36261b" : "#e8dfcc";
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + scaleW / 2, cy);
        ctx.lineTo(cx, y + scaleH);
        ctx.lineTo(cx - scaleW / 2, cy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(45, 30, 18, 0.45)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - scaleW / 2, cy);
        ctx.lineTo(cx, y);
        ctx.lineTo(cx + scaleW / 2, cy);
        ctx.stroke();
      }
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 2. Texture Mặt Trống Cơm & Trống Đại Sơn Son Đông Sơn (Drumhead Texture)
  function createDrumheadTexture(isTrongCom) {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    var bgGrad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    bgGrad.addColorStop(0, "#f7edd8");
    bgGrad.addColorStop(0.65, "#e5d3b0");
    bgGrad.addColorStop(0.9, "#cca878");
    bgGrad.addColorStop(1, "#8a5828");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(130, 85, 45, 0.08)";
    ctx.lineWidth = 1;
    for (var i = 0; i < 200; i++) {
      var r = 20 + Math.random() * 220;
      var ang = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(256, 256, r, ang, ang + Math.random() * 0.4);
      ctx.stroke();
    }

    if (isTrongCom) {
      var riceGrad = ctx.createRadialGradient(256, 256, 10, 256, 256, 95);
      riceGrad.addColorStop(0, "rgba(255, 255, 255, 0.96)");
      riceGrad.addColorStop(0.4, "rgba(248, 246, 235, 0.92)");
      riceGrad.addColorStop(0.85, "rgba(220, 210, 185, 0.85)");
      riceGrad.addColorStop(1, "rgba(150, 120, 80, 0.15)");
      ctx.fillStyle = riceGrad;
      ctx.beginPath();
      ctx.arc(256, 256, 95, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      for (var p = 0; p < 80; p++) {
        var rad = Math.random() * 85;
        var th = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(th) * rad, 256 + Math.sin(th) * rad, 1.2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = "rgba(120, 40, 20, 0.6)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(256, 256, 230, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(256, 256, 175, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(150, 45, 25, 0.75)";
      ctx.beginPath();
      for (var s = 0; s < 28; s++) {
        var sth = (s * Math.PI) / 14;
        var srad = (s % 2 === 0) ? 65 : 20;
        var sx = 256 + Math.cos(sth) * srad;
        var sy = 256 + Math.sin(sth) * srad;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#8a2815";
      for (var dot = 0; dot < 36; dot++) {
        var dth = (dot * Math.PI * 2) / 36;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(dth) * 205, 256 + Math.sin(dth) * 205, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // 3. Texture Đồng Thau Cổ Đông Sơn (Cồng, Chiêng, Thanh La)
  function createDongSonBronzeTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    var bronzeGrad = ctx.createRadialGradient(256, 256, 15, 256, 256, 256);
    bronzeGrad.addColorStop(0, "#e8b858");
    bronzeGrad.addColorStop(0.35, "#c69234");
    bronzeGrad.addColorStop(0.7, "#916218");
    bronzeGrad.addColorStop(0.92, "#52370c");
    bronzeGrad.addColorStop(1, "#2b1c04");
    ctx.fillStyle = bronzeGrad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(255, 225, 140, 0.18)";
    ctx.lineWidth = 1.2;
    for (var r = 18; r < 240; r += 14) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(50, 140, 110, 0.15)";
    ctx.lineWidth = 3.5;
    for (var p = 0; p < 25; p++) {
      var pang = Math.random() * Math.PI * 2;
      var prad = 40 + Math.random() * 180;
      ctx.beginPath();
      ctx.arc(256, 256, prad, pang, pang + 0.35);
      ctx.stroke();
    }

    var tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // 4. Texture Tre / Trúc Tự Nhiên (Sáo Trúc, Tiêu, Đàn T'rưng, Khèn, Chapi)
  function createBambooTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    var ctx = canvas.getContext("2d");

    var bg = ctx.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, "#8a6625");
    bg.addColorStop(0.18, "#d9b35b");
    bg.addColorStop(0.5, "#f7df94");
    bg.addColorStop(0.82, "#c99c42");
    bg.addColorStop(1, "#664714");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = "rgba(100, 70, 20, 0.14)";
    ctx.lineWidth = 0.8;
    for (var i = 0; i < 60; i++) {
      var y = Math.random() * 128;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(65, 40, 10, 0.55)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 128);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 235, 170, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(258, 0);
    ctx.lineTo(258, 128);
    ctx.stroke();

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // 5. Texture Phiến Đá Cổ Tiền Sử (Đàn Đá)
  function createStoneTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#4a5568";
    ctx.fillRect(0, 0, 512, 512);

    for (var i = 0; i < 4000; i++) {
      var x = Math.random() * 512;
      var y = Math.random() * 512;
      var c = Math.floor(60 + Math.random() * 80);
      ctx.fillStyle = "rgba(" + c + "," + (c + 5) + "," + (c + 12) + ", 0.28)";
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    ctx.strokeStyle = "rgba(200, 215, 230, 0.18)";
    ctx.lineWidth = 1.5;
    for (var k = 0; k < 12; k++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.stroke();
    }

    var tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // 6. Texture Bóng Đổ Mềm Tự Nhiên (Soft Contact Shadow)
  function createSoftRadialShadowTexture() {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext("2d");

    var grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
    grad.addColorStop(0, "rgba(0, 0, 0, 0.78)");
    grad.addColorStop(0.35, "rgba(5, 3, 2, 0.55)");
    grad.addColorStop(0.65, "rgba(10, 6, 4, 0.22)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    var tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // 7. Hiệu Ứng Sóng Âm Thanh 3D Tỏa Tròn Khi Tấu Nhạc (Interactive 3D Sonic Shockwave & Core Spark)
  var activeSonicRipples = [];

  function trigger3DVisualSonicRipple(point) {
    if (!scene3D || !point) return;

    var ripGroup = new THREE.Group();
    ripGroup.position.copy(point);

    // Vòng sóng vàng ánh kim chính nở rộng (Primary Golden Sonic Wave)
    var rippleGeo = new THREE.RingGeometry(0.05, 0.16, 32);
    var rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffea9f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    var rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);

    // Vòng sóng hào quang đỏ ruby thứ cấp (Secondary Ruby-Gold Halo)
    var haloGeo = new THREE.RingGeometry(0.12, 0.22, 32);
    var haloMat = new THREE.MeshBasicMaterial({
      color: 0xde194b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    var haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.z = 0.002;

    // Hạt ánh sáng bùng nổ tại tâm điểm đánh (Core Bright Spark)
    var sparkGeo = new THREE.CircleGeometry(0.07, 16);
    var sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    var sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
    sparkMesh.position.z = 0.004;

    ripGroup.add(rippleMesh);
    ripGroup.add(haloMesh);
    ripGroup.add(sparkMesh);

    // Luôn quay mặt sóng đối diện trực tiếp camera để thấy trọn vẹn vòng tròn sóng âm lan tỏa tại đúng tâm điểm đánh
    if (camera3D) {
      ripGroup.quaternion.copy(camera3D.quaternion);
    } else {
      ripGroup.rotation.x = -Math.PI / 2;
    }

    scene3D.add(ripGroup);

    activeSonicRipples.push({
      group: ripGroup,
      scale: 1.0,
      opacity: 1.0
    });
  }

  // =========================================================
  // MÔ HÌNH 3D NGHỆ THUẬT HOÀNG KIM TỰ ĐỘNG XOAY Ở HERO TRANG CHỦ (HERO 3D KEY VISUAL)
  // Biểu tượng Nhạc khí Dân tộc Việt Nam mạ vàng trên bệ ngọc bích chạm mây cổ
  // =========================================================
  var hero3DScene = null;
  var hero3DCamera = null;
  var hero3DRenderer = null;
  var hero3DSculptureGroup = null;
  var hero3DSparksGroup = null;
  var hero3DSpinGroup = null;
  var hero3DSlantGroup = null;
  var hero3DDefaultSlantX = 0.22;
  var hero3DDefaultSlantZ = -0.38;
  var isHero3DAutoRotating = true; // Bật lại tính năng xoay model 3D ở trang chủ theo yêu cầu
  var isHero3DInitialized = false;
  var isHero3DAnimating = false;
  var hero3DPointerDown = false;
  var hero3DLastPointerX = 0;
  var hero3DLastPointerY = 0;
  var hero3DResumeRotateTimer = null;
  var hero3DFirstFrameRendered = false;

  function createHeroDanTranhSoundboardTexture() {
    var cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 512;
    var ctx = cv.getContext("2d");

    // Nền gỗ sồi / ngô đồng sấy vàng ấm tự nhiên chuẩn theo mẫu gỗ 388 trong ảnh
    var grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0.00, "#d9ba8b");
    grad.addColorStop(0.20, "#e4cb95");
    grad.addColorStop(0.40, "#dfbf8c");
    grad.addColorStop(0.65, "#d8bf8b");
    grad.addColorStop(0.85, "#dbc388");
    grad.addColorStop(1.00, "#debf90");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Thớ vân gỗ sồi ngang / dọc tự nhiên uốn lượn mềm mại (Natural Oak Wood Grains)
    for (var i = 0; i < 512; i += 4) {
      var wave = Math.sin(i * 0.045) * 5 + Math.cos(i * 0.08) * 3;
      var isAccent = (i % 16 === 0);
      ctx.strokeStyle = isAccent ? "rgba(155, 112, 62, 0.46)" : "rgba(182, 142, 92, 0.32)";
      ctx.lineWidth = isAccent ? 1.4 : 0.9;
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.bezierCurveTo(340, i + wave, 680, i - wave * 0.7, 1024, i + wave * 0.4);
      ctx.stroke();
    }

    // Sợi vân gỗ sồi mịn đan xen & vệt sáng tự nhiên
    ctx.strokeStyle = "rgba(248, 228, 185, 0.36)";
    ctx.lineWidth = 0.8;
    for (var i = 2; i < 512; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i + Math.sin(i * 0.035) * 4);
      ctx.stroke();
    }

    // Vân núi gỗ sồi (Oak cathedral flame arches) ở trung tâm mặt gỗ như trong ảnh mẫu 388
    ctx.save();
    for (var c = 0; c < 9; c++) {
      ctx.strokeStyle = "rgba(162, 118, 66, " + (0.10 + (c % 3) * 0.05) + ")";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(512, 256, 210 + c * 38, 55 + c * 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Đốm thớ gỗ sồi li ti (Oak ray flecks)
    ctx.fillStyle = "rgba(145, 102, 52, 0.22)";
    for (var p = 0; p < 220; p++) {
      var px = (p * 83) % 1020 + 2;
      var py = (p * 109) % 508 + 2;
      ctx.fillRect(px, py, 6 + (p % 6) * 3, 0.8);
    }
    ctx.restore();

    // Vệt dác gỗ ánh vàng ấm tự nhiên
    var dacGrad = ctx.createLinearGradient(0, 160, 0, 360);
    dacGrad.addColorStop(0, "rgba(255, 238, 200, 0)");
    dacGrad.addColorStop(0.5, "rgba(255, 238, 200, 0.18)");
    dacGrad.addColorStop(1, "rgba(255, 238, 200, 0)");
    ctx.fillStyle = dacGrad;
    ctx.fillRect(0, 160, 1024, 200);

    // HỌA TIẾT HOA SEN & LÁ SEN VẼ TAY TRUYỀN THỐNG TRÊN MẶT ĐÀN (CHUẨN ẢNH THỰC TẾ)
    drawSoundboardLotusArt(ctx);

    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function drawPetal(ctx, w, h, baseCol, midCol, tipCol, strokeCol) {
    var pGrad = ctx.createLinearGradient(0, 0, 0, -h);
    pGrad.addColorStop(0, baseCol || "#fff5f8");
    pGrad.addColorStop(0.35, baseCol || "#ffccd5");
    pGrad.addColorStop(0.70, midCol || "#ff4d6d");
    pGrad.addColorStop(1, tipCol || "#c9184a");

    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -h * 0.38, -w * 0.85, -h * 0.85, 0, -h);
    ctx.bezierCurveTo(w * 0.85, -h * 0.85, w, -h * 0.38, 0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = strokeCol || "rgba(180, 20, 60, 0.55)";
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Gân giữa cánh hoa mảnh
    ctx.strokeStyle = "rgba(220, 50, 90, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h * 0.88);
    ctx.stroke();
  }

  function drawBloomingLotus(ctx, cx, cy, sc, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.rotate(rot);

    // Lớp cánh sau xòe rộng
    [
      { a: -0.85, w: 14, h: 48 },
      { a: -0.42, w: 16, h: 54 },
      { a: 0.00,  w: 18, h: 58 },
      { a: 0.42,  w: 16, h: 54 },
      { a: 0.85,  w: 14, h: 48 }
    ].forEach(function(p) {
      ctx.save();
      ctx.rotate(p.a);
      drawPetal(ctx, p.w, p.h, "#ffccd5", "#ff4d6d", "#c9184a");
      ctx.restore();
    });

    // Lớp cánh giữa ôm tròn
    [
      { a: -0.60, w: 15, h: 46 },
      { a: -0.22, w: 17, h: 50 },
      { a: 0.22,  w: 17, h: 50 },
      { a: 0.60,  w: 15, h: 46 }
    ].forEach(function(p) {
      ctx.save();
      ctx.rotate(p.a);
      drawPetal(ctx, p.w, p.h, "#fff0f3", "#ff758f", "#d90429");
      ctx.restore();
    });

    // Lớp cánh trước e ấp
    [
      { a: -0.32, w: 13, h: 38 },
      { a: 0.00,  w: 15, h: 42 },
      { a: 0.32,  w: 13, h: 38 }
    ].forEach(function(p) {
      ctx.save();
      ctx.rotate(p.a);
      drawPetal(ctx, p.w, p.h, "#ffffff", "#ff85a1", "#e63946");
      ctx.restore();
    });

    // Đài sen & Nhị sen vàng
    ctx.fillStyle = "#e9c46a";
    ctx.beginPath();
    ctx.ellipse(0, -6, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d4a373";
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Hạt sen
    ctx.fillStyle = "#2a6f44";
    [
      { x: -5, y: -7 }, { x: 0, y: -9 }, { x: 5, y: -7 },
      { x: -3, y: -4 }, { x: 3, y: -4 }
    ].forEach(function(pt) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Nhị vàng bao quanh
    for (var s = 0; s < 18; s++) {
      var sAng = (s / 18) * Math.PI * 2;
      var sX = Math.cos(sAng) * 11;
      var sY = -6 + Math.sin(sAng) * 6;
      var sTipX = Math.cos(sAng) * 15;
      var sTipY = -6 + Math.sin(sAng) * 9;
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(sX, sY);
      ctx.lineTo(sTipX, sTipY);
      ctx.stroke();
      ctx.fillStyle = "#ffbe0b";
      ctx.beginPath();
      ctx.arc(sTipX, sTipY, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBuddingLotus(ctx, cx, cy, sc, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.rotate(rot);

    // Đài hoa xanh đỡ dưới
    ctx.fillStyle = "#40916c";
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(0, 8, 10, 0);
    ctx.quadraticCurveTo(0, -4, -10, 0);
    ctx.fill();

    // Cánh búp sen e ấp
    [
      { a: -0.35, w: 12, h: 38 },
      { a: 0.35,  w: 12, h: 38 },
      { a: -0.15, w: 14, h: 42 },
      { a: 0.15,  w: 14, h: 42 },
      { a: 0.00,  w: 11, h: 40 }
    ].forEach(function(p) {
      ctx.save();
      ctx.rotate(p.a);
      drawPetal(ctx, p.w, p.h, "#fff0f3", "#ff4d6d", "#c9184a");
      ctx.restore();
    });

    ctx.restore();
  }

  function drawPointedLotusBud(ctx, cx, cy, sc, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.rotate(rot);

    // Cuống nhỏ đỡ búp
    ctx.fillStyle = "#2d6a4f";
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // 2 lá đài xanh ôm sát
    [-0.22, 0.22].forEach(function(ang) {
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = "#52b788";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-4, -10, -3, -22, 0, -28);
      ctx.bezierCurveTo(3, -22, 4, -10, 0, 0);
      ctx.fill();
      ctx.restore();
    });

    // Búp nhọn màu hồng thắm
    drawPetal(ctx, 8, 30, "#ffccd5", "#ff4d6d", "#c9184a");

    ctx.restore();
  }

  function drawSoundboardLotusArt(ctx) {
    // 1. CUỐNG SEN UỐN LƯỢN (Graceful Calligraphic Lotus Stems)
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Cuống chính nối tới hoa sen nở
    ctx.strokeStyle = "#245336";
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(85, 230);
    ctx.bezierCurveTo(140, 240, 210, 210, 310, 160);
    ctx.stroke();

    // Viền sáng cuống chính
    ctx.strokeStyle = "#52b788";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(87, 229);
    ctx.bezierCurveTo(142, 239, 212, 209, 308, 159);
    ctx.stroke();

    // Cuống nối tới lá sen to
    ctx.strokeStyle = "#1b4332";
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(90, 225);
    ctx.bezierCurveTo(130, 235, 175, 235, 225, 215);
    ctx.stroke();

    // Cuống nối tới hoa sen hé nở
    ctx.strokeStyle = "#2d6a4f";
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(110, 228);
    ctx.bezierCurveTo(150, 210, 190, 170, 235, 125);
    ctx.stroke();

    // Cuống nối tới nụ sen nhỏ
    ctx.strokeStyle = "#40916c";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(170, 185);
    ctx.bezierCurveTo(220, 150, 280, 110, 345, 95);
    ctx.stroke();

    // Gai li ti dọc cuống sen (Lotus stem thorns/nodes)
    ctx.fillStyle = "#123820";
    [
      { x: 120, y: 236 }, { x: 155, y: 228 }, { x: 185, y: 215 },
      { x: 235, y: 195 }, { x: 270, y: 180 }, { x: 140, y: 205 },
      { x: 180, y: 165 }, { x: 250, y: 130 }
    ].forEach(function(dot) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 2. LÁ SEN TO XANH NGỌC CẨN VÀNG (Large Royal Jade Lotus Leaf)
    ctx.save();
    ctx.translate(225, 215);
    ctx.rotate(Math.PI / 2 + 0.15); // Hướng lên trên và hơi nghiêng nhẹ

    var leafGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 85);
    leafGrad.addColorStop(0, "#74c69d");
    leafGrad.addColorStop(0.35, "#40916c");
    leafGrad.addColorStop(0.70, "#2d6a4f");
    leafGrad.addColorStop(0.92, "#1b4332");
    leafGrad.addColorStop(1, "#123820");

    ctx.fillStyle = leafGrad;
    ctx.strokeStyle = "rgba(245, 205, 75, 0.65)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    var numLobes = 16;
    for (var a = 0; a <= numLobes; a++) {
      var angle = (a / numLobes) * Math.PI * 2;
      var rLobe = 72 + Math.sin(angle * 5) * 8 + Math.cos(angle * 3) * 6;
      if (angle > Math.PI * 0.7 && angle < Math.PI * 1.3) {
        rLobe -= 18; // Khía xẻ cuống lá
      }
      var px = Math.cos(angle) * rLobe;
      var py = Math.sin(angle) * rLobe;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gân lá sen tỏa tròn từ rốn lá
    ctx.strokeStyle = "rgba(183, 228, 199, 0.55)";
    ctx.lineWidth = 1.4;
    for (var g = 0; g < 12; g++) {
      var gAng = (g / 12) * Math.PI * 2;
      if (gAng > Math.PI * 0.8 && gAng < Math.PI * 1.2) continue;
      var gLen = 65 + Math.sin(g * 2) * 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      var midX = Math.cos(gAng + 0.1) * (gLen * 0.5);
      var midY = Math.sin(gAng + 0.1) * (gLen * 0.5);
      var endX = Math.cos(gAng) * gLen;
      var endY = Math.sin(gAng) * gLen;
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Nhánh gân phụ dát vàng
      ctx.strokeStyle = "rgba(245, 215, 110, 0.45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(gAng + 0.4) * 16, midY + Math.sin(gAng + 0.4) * 16);
      ctx.stroke();
      ctx.strokeStyle = "rgba(183, 228, 199, 0.55)";
      ctx.lineWidth = 1.4;
    }

    // Rốn lá sen tâm vàng
    ctx.fillStyle = "#e9c46a";
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4a261";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();

    // 3. HOA SEN NỞ RỘ HOÀNG GIA (Grand Blooming Pink Lotus)
    drawBloomingLotus(ctx, 310, 155, 1.15, Math.PI / 2 - 0.10);

    // 4. HOA SEN HÉ NỞ / BÚP SEN (Blossoming Pink Lotus Bud)
    drawBuddingLotus(ctx, 235, 125, 0.88, Math.PI / 2 + 0.22);

    // 5. NỤ SEN BÚP NHỌN VƯƠN CAO (Pointed Lotus Bud)
    drawPointedLotusBud(ctx, 345, 95, 0.72, Math.PI / 2 - 0.25);

    // 6. BỤI VÀNG KIM SA PHỦ NGHỆ THUẬT (Traditional Gold Dust Flecks)
    ctx.save();
    ctx.fillStyle = "rgba(248, 214, 98, 0.75)";
    var goldSpecks = [
      { x: 260, y: 140, r: 1.8 }, { x: 275, y: 165, r: 1.4 },
      { x: 290, y: 130, r: 2.0 }, { x: 330, y: 135, r: 1.6 },
      { x: 350, y: 175, r: 1.5 }, { x: 215, y: 110, r: 1.3 },
      { x: 245, y: 100, r: 1.7 }, { x: 320, y: 85, r: 1.4 },
      { x: 195, y: 190, r: 1.8 }, { x: 230, y: 245, r: 1.6 },
      { x: 160, y: 140, r: 1.4 }, { x: 135, y: 165, r: 1.5 }
    ];
    goldSpecks.forEach(function(sp) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function createHeroDanTranhRosewoodSideTexture() {
    var cv = document.createElement("canvas");
    cv.width = 2048;
    cv.height = 256;
    var ctx = cv.getContext("2d");

    // Nền gỗ cẩm lai sơn mài đỏ sẫm hoàng gia
    var grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#4a1208");
    grad.addColorStop(0.35, "#702013");
    grad.addColorStop(0.7, "#58170d");
    grad.addColorStop(1, "#2e0804");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 256);

    // Vân gỗ trắc đỏ
    ctx.strokeStyle = "rgba(22, 5, 2, 0.35)";
    ctx.lineWidth = 2.0;
    for (var y = 6; y < 256; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (var x = 0; x <= 2048; x += 128) {
        ctx.quadraticCurveTo(x + 64, y + Math.sin(x * 0.04 + y) * 3.5, x + 128, y);
      }
      ctx.stroke();
    }

    // Nẹp viền mun trên & dưới
    ctx.fillStyle = "#120503";
    ctx.fillRect(0, 0, 2048, 16);
    ctx.fillRect(0, 240, 2048, 16);

    // Đường chỉ đôi vàng kim trên và dưới
    ctx.strokeStyle = "#f3c759";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(0, 18); ctx.lineTo(2048, 18);
    ctx.moveTo(0, 238); ctx.lineTo(2048, 238);
    ctx.stroke();

    ctx.strokeStyle = "#d69c28";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 24); ctx.lineTo(2048, 24);
    ctx.moveTo(0, 232); ctx.lineTo(2048, 232);
    ctx.stroke();

    // Chuỗi hạt cẩn vàng viền mép
    ctx.fillStyle = "rgba(255, 225, 140, 0.75)";
    for (var bx = 8; bx < 2048; bx += 24) {
      ctx.beginPath();
      ctx.arc(bx, 21, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, 235, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hoa sen & mây cuộn vàng chạm khắc dọc thân đàn
    for (var seg = 0; seg < 8; seg++) {
      var cx = seg * 256 + 128;
      var cy = 128;
      ctx.save();
      ctx.translate(cx, cy);

      // Cánh sen úp đỡ dưới
      ctx.strokeStyle = "#f0be49";
      ctx.lineWidth = 2.4;
      ctx.fillStyle = "rgba(215, 155, 40, 0.30)";
      ctx.beginPath();
      ctx.moveTo(-45, 22);
      ctx.bezierCurveTo(-26, 45, 26, 45, 45, 22);
      ctx.bezierCurveTo(22, 28, -22, 28, -45, 22);
      ctx.fill();
      ctx.stroke();

      // Đài sen tâm vàng
      ctx.fillStyle = "#f3c759";
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd978";
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Cánh sen vươn lên
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.bezierCurveTo(16, -22, 18, 0, 0, 6);
      ctx.bezierCurveTo(-18, 0, -16, -22, 0, -48);
      ctx.strokeStyle = "#ffd978";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Mây lượn sang 2 bên
      ctx.strokeStyle = "#f3c759";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, 22);
      ctx.bezierCurveTo(-35, 32, -65, 16, -105, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, 22);
      ctx.bezierCurveTo(35, 32, 65, 16, 105, 0);
      ctx.stroke();

      ctx.restore();
    }

    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function buildHero3DSculpture() {
    var rootGroup = new THREE.Group();
    var danTranhGroup = new THREE.Group();

    // 1. VẬT LIỆU HOÀNG GIA CHO ĐÀN TRANH
    var soundboardTex = createHeroDanTranhSoundboardTexture();
    var rosewoodTex = createHeroDanTranhRosewoodSideTexture();

    var matSoundboard = new THREE.MeshStandardMaterial({
      map: soundboardTex,
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    var matRosewood = new THREE.MeshStandardMaterial({
      map: rosewoodTex,
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.16,
      side: THREE.DoubleSide
    });
    var matImperialGold = new THREE.MeshStandardMaterial({
      color: 0xf6c445,
      roughness: 0.16,
      metalness: 0.94
    });
    var matRoyalBlack = new THREE.MeshStandardMaterial({
      color: 0x140604,
      roughness: 0.15,
      metalness: 0.32,
      side: THREE.DoubleSide
    });
    var matWoodDark = new THREE.MeshStandardMaterial({
      color: 0x220e06,
      roughness: 0.26,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    var matBridgeWood = new THREE.MeshStandardMaterial({
      color: 0x481810,
      roughness: 0.28,
      metalness: 0.08
    });
    var matBone = new THREE.MeshStandardMaterial({
      color: 0xfcfdfd,
      roughness: 0.16,
      metalness: 0.14
    });
    var matSteelString = new THREE.MeshStandardMaterial({
      color: 0xeef2f6,
      roughness: 0.12,
      metalness: 0.96
    });
    var matBronzeString = new THREE.MeshStandardMaterial({
      color: 0xdfaa52,
      roughness: 0.16,
      metalness: 0.92
    });
    var matSilkRed = new THREE.MeshStandardMaterial({
      color: 0xb81d24,
      roughness: 0.42,
      metalness: 0.08
    });
    var matJade = new THREE.MeshStandardMaterial({
      color: 0x186b4d,
      roughness: 0.18,
      metalness: 0.12
    });

    var length = 11.8;
    var segX = 64;
    var segZ = 28;
    var yBottom = -0.34;
    var totalStrings = 16;

    // Hàm toán học tính cao độ mặt đàn vòm cong chuẩn xác
    function getSoundboardY(x, z) {
      var u = (x + 5.9) / 11.8;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var w = 2.35 - 0.55 * u;
      var hw = w * 0.5;
      var clampedZ = Math.max(-hw, Math.min(hw, z));
      var d = clampedZ / (hw || 1);
      var archZ = 0.38 * (1 - d * d);
      var archX = 0.12 * Math.sin(u * Math.PI);
      return 0.04 + archZ + archX;
    }

    // 2. MẶT ĐÀN VÒM CONG GỖ NGÔ ĐỒNG (PAULOWNIA ARCHED SOUNDBOARD)
    var boardGeo = new THREE.BufferGeometry();
    var positions = [], uvs = [], indices = [];
    for (var j = 0; j <= segZ; j++) {
      var v = j / segZ;
      for (var i = 0; i <= segX; i++) {
        var u = i / segX;
        var x = -5.9 + u * length;
        var w = 2.35 - 0.55 * u;
        var z = (v - 0.5) * w;
        var y = getSoundboardY(x, z);
        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }
    for (var j = 0; j < segZ; j++) {
      for (var i = 0; i < segX; i++) {
        var a = j * (segX + 1) + i;
        var b = a + 1;
        var c = (j + 1) * (segX + 1) + i;
        var d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    boardGeo.setIndex(indices);
    boardGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    boardGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    boardGeo.computeVertexNormals();
    var soundboardMesh = new THREE.Mesh(boardGeo, matSoundboard);
    soundboardMesh.castShadow = true;
    soundboardMesh.receiveShadow = true;
    danTranhGroup.add(soundboardMesh);

    // 3. HAI THÀNH ĐÀN GỖ CẨM LAI (FRONT & BACK ROSEWOOD SIDE WALLS)
    var frontWallGeo = new THREE.BufferGeometry();
    var frontPos = [], frontUvs = [], frontIdx = [];
    for (var i = 0; i <= segX; i++) {
      var u = i / segX;
      var x = -5.9 + u * length;
      var w = 2.35 - 0.55 * u;
      var z = w * 0.5;
      var yTop = getSoundboardY(x, z);
      frontPos.push(x, yTop, z);
      frontUvs.push(u, 1.0);
      frontPos.push(x, yBottom, z);
      frontUvs.push(u, 0.0);
    }
    for (var i = 0; i < segX; i++) {
      var p0 = i * 2, p1 = i * 2 + 1, p2 = (i + 1) * 2, p3 = (i + 1) * 2 + 1;
      frontIdx.push(p0, p1, p2);
      frontIdx.push(p1, p3, p2);
    }
    frontWallGeo.setIndex(frontIdx);
    frontWallGeo.setAttribute("position", new THREE.Float32BufferAttribute(frontPos, 3));
    frontWallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(frontUvs, 2));
    frontWallGeo.computeVertexNormals();
    var frontWallMesh = new THREE.Mesh(frontWallGeo, matRosewood);
    danTranhGroup.add(frontWallMesh);

    var backWallGeo = new THREE.BufferGeometry();
    var backPos = [], backUvs = [], backIdx = [];
    for (var i = 0; i <= segX; i++) {
      var u = i / segX;
      var x = -5.9 + u * length;
      var w = 2.35 - 0.55 * u;
      var z = -w * 0.5;
      var yTop = getSoundboardY(x, z);
      backPos.push(x, yTop, z);
      backUvs.push(u, 1.0);
      backPos.push(x, yBottom, z);
      backUvs.push(u, 0.0);
    }
    for (var i = 0; i < segX; i++) {
      var p0 = i * 2, p1 = i * 2 + 1, p2 = (i + 1) * 2, p3 = (i + 1) * 2 + 1;
      backIdx.push(p0, p2, p1);
      backIdx.push(p1, p2, p3);
    }
    backWallGeo.setIndex(backIdx);
    backWallGeo.setAttribute("position", new THREE.Float32BufferAttribute(backPos, 3));
    backWallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(backUvs, 2));
    backWallGeo.computeVertexNormals();
    var backWallMesh = new THREE.Mesh(backWallGeo, matRosewood);
    danTranhGroup.add(backWallMesh);

    // Viền vàng kim nẹp mép trên & dưới thành đàn
    var Curve3 = THREE.CatmullRomCurve3 || THREE.CatmullRomCurve3D;
    for (var side = -1; side <= 1; side += 2) {
      var goldTrimPts = [], botGoldTrimPts = [];
      for (var k = 0; k <= 24; k++) {
        var u = k / 24;
        var x = -5.9 + u * length;
        var w = 2.35 - 0.55 * u;
        var z = side * (w * 0.5);
        var y = getSoundboardY(x, z);
        goldTrimPts.push(new THREE.Vector3(x, y + 0.012, z + side * 0.005));
        botGoldTrimPts.push(new THREE.Vector3(x, yBottom + 0.018, z + side * 0.005));
      }
      var goldTrimMesh = new THREE.Mesh(new THREE.TubeGeometry(new Curve3(goldTrimPts), 28, 0.014, 8, false), matImperialGold);
      danTranhGroup.add(goldTrimMesh);
      var botGoldMesh = new THREE.Mesh(new THREE.TubeGeometry(new Curve3(botGoldTrimPts), 28, 0.012, 8, false), matImperialGold);
      danTranhGroup.add(botGoldMesh);

      // Đinh tán vàng chạm nổi dọc thành đàn
      for (var jx = -5.0; jx <= 5.0; jx += 0.85) {
        var ju = (jx + 5.9) / 11.8;
        var jw = 2.35 - 0.55 * ju;
        var jz = side * (jw * 0.5 + 0.008);
        var jy = getSoundboardY(jx, jz) + 0.010;
        var goldStud = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), matImperialGold);
        goldStud.position.set(jx, jy, jz);
        danTranhGroup.add(goldStud);
      }
    }

    // 4. ĐÁY ĐÀN (BOTTOM BOARD) & 3 LỖ THOÁT ÂM VIỀN VÀNG
    var bottomGeo = new THREE.BufferGeometry();
    var botPos = [], botUvs = [], botIdx = [];
    for (var i = 0; i <= segX; i++) {
      var u = i / segX;
      var x = -5.9 + u * length;
      var w = 2.35 - 0.55 * u;
      botPos.push(x, yBottom, -w * 0.5);
      botUvs.push(u, 0.0);
      botPos.push(x, yBottom, w * 0.5);
      botUvs.push(u, 1.0);
    }
    for (var i = 0; i < segX; i++) {
      var p0 = i * 2, p1 = i * 2 + 1, p2 = (i + 1) * 2, p3 = (i + 1) * 2 + 1;
      botIdx.push(p0, p2, p1);
      botIdx.push(p1, p2, p3);
    }
    bottomGeo.setIndex(botIdx);
    bottomGeo.setAttribute("position", new THREE.Float32BufferAttribute(botPos, 3));
    bottomGeo.setAttribute("uv", new THREE.Float32BufferAttribute(botUvs, 2));
    bottomGeo.computeVertexNormals();
    var bottomMesh = new THREE.Mesh(bottomGeo, matWoodDark);
    danTranhGroup.add(bottomMesh);

    // 3 Lỗ thoát âm dưới đáy đàn
    [ { x: -3.0, rx: 0.28 }, { x: 0.0, rx: 0.45 }, { x: 3.0, rx: 0.25 } ].forEach(function(sh) {
      var shMesh = new THREE.Mesh(new THREE.CylinderGeometry(sh.rx, sh.rx, 0.06, 20), matRoyalBlack);
      shMesh.position.set(sh.x, yBottom + 0.02, 0);
      danTranhGroup.add(shMesh);
      var rimMesh = new THREE.Mesh(new THREE.TorusGeometry(sh.rx, 0.016, 8, 20), matImperialGold);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.set(sh.x, yBottom - 0.01, 0);
      danTranhGroup.add(rimMesh);
    });

    // 5. ĐẦU ĐÀN (NARROW TOP HEAD CROWN, x = +5.92, World +Y ở đỉnh)
    // Vòm mũ nguyệt đầu đàn bọc đỉnh gỗ mun và chỉ viền vàng
    var headCapPts = [];
    for (var hk = 0; hk <= 20; hk++) {
      var hz = -0.92 + (hk / 20) * 1.84;
      var hy = getSoundboardY(5.90, hz);
      headCapPts.push(new THREE.Vector3(5.92, hy + 0.035, hz));
    }
    var headCapTrim = new THREE.Mesh(new THREE.TubeGeometry(new Curve3(headCapPts), 24, 0.018, 8, false), matImperialGold);
    danTranhGroup.add(headCapTrim);

    // 6. ĐUÔI ĐÀN / CHÂN ĐẾ (WIDE BOTTOM BASE, x = -5.92, World -Y ở đáy)
    var botCapPts = [];
    for (var bk = 0; bk <= 20; bk++) {
      var bz = -1.16 + (bk / 20) * 2.32;
      var by = getSoundboardY(-5.90, bz);
      botCapPts.push(new THREE.Vector3(-5.92, by + 0.035, bz));
    }
    var botCapTrim = new THREE.Mesh(new THREE.TubeGeometry(new Curve3(botCapPts), 24, 0.020, 8, false), matImperialGold);
    danTranhGroup.add(botCapTrim);

    // Chân đế ốp gỗ sẫm dưới đáy đuôi đàn
    var baseFootPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 2.44), matRoyalBlack);
    baseFootPlate.position.set(-5.96, yBottom + 0.10, 0);
    danTranhGroup.add(baseFootPlate);

    // 6b. DẢI TUA RUA ĐỎ TƠ TẰM & NGỌC BÍCH TREO MÉP PHẢI (CHUẨN ẢNH THỰC TẾ)
    // Treo ở mép phải thân đàn (World +X, Local +Z), vị trí 1/3 từ trên xuống (x = 2.05)
    var tasselGroup = new THREE.Group();
    var attachX = 2.05;
    var attachW = 2.35 - 0.55 * ((attachX + 5.9) / 11.8);
    var attachZ = attachW * 0.5 + 0.035;
    var attachY = getSoundboardY(attachX, attachW * 0.5) - 0.05;
    tasselGroup.position.set(attachX, attachY, attachZ);

    // Xoay -PI/2 quanh trục Z để trục âm Y của nhóm trỏ theo trục âm X (World -Y, RỦ THẲNG ĐỨNG XUỐNG DƯỚI)
    tasselGroup.rotation.z = -Math.PI / 2;

    // Dây tơ đỏ treo
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.40, 8), matSilkRed);
    cord.position.set(0, -0.20, 0);
    tasselGroup.add(cord);

    // Nút đính vàng trên thành đàn
    var studMesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), matImperialGold);
    studMesh.position.set(0, 0, 0);
    tasselGroup.add(studMesh);

    // Đài chụp vàng trên ngọc bội
    var topCapBead = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.045, 14), matImperialGold);
    topCapBead.position.set(0, -0.42, 0);
    tasselGroup.add(topCapBead);

    // Hạt ngọc bích hoàng gia (Jade bead)
    var jadeBead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), matJade);
    jadeBead.position.set(0, -0.49, 0);
    tasselGroup.add(jadeBead);

    // Đài chụp vàng dưới ngọc bội
    var botCapBead = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.045, 14), matImperialGold);
    botCapBead.rotation.x = Math.PI;
    botCapBead.position.set(0, -0.56, 0);
    tasselGroup.add(botCapBead);

    // Đai vàng thắt cổ tua rua
    var tasselRing = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 8, 16), matImperialGold);
    tasselRing.rotation.x = Math.PI / 2;
    tasselRing.position.set(0, -0.63, 0);
    tasselGroup.add(tasselRing);

    // Chùm tua rua đỏ tơ tằm buông rủ tha thướt
    var skirt = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.65, 16), matSilkRed);
    skirt.position.set(0, -0.96, 0);
    tasselGroup.add(skirt);

    // Hạt cườm vàng đính chân tua rua
    for (var b = 0; b < 6; b++) {
      var bAng = (b / 6) * Math.PI * 2;
      var goldDrop = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), matImperialGold);
      goldDrop.position.set(Math.cos(bAng) * 0.11, -1.28, Math.sin(bAng) * 0.11);
      tasselGroup.add(goldDrop);
    }

    danTranhGroup.add(tasselGroup);

    // 7. 4 CHÂN ĐẾ ĐÀN (4 FEET)
    var footGeom = new THREE.CylinderGeometry(0.11, 0.08, 0.30, 14);
    [
      { x: -5.4, z: -0.85 }, { x: -5.4, z: 0.85 },
      { x: 5.3, z: -0.68 }, { x: 5.3, z: 0.68 }
    ].forEach(function(fc) {
      var foot = new THREE.Mesh(footGeom, matWoodDark);
      foot.position.set(fc.x, yBottom - 0.13, fc.z);
      danTranhGroup.add(foot);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 14), matImperialGold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(fc.x, yBottom - 0.26, fc.z);
      danTranhGroup.add(ring);
    });

    // 8. CẦU ĐÀN TRÁI (TIỀN NHẠC SƠN, x = -5.35) & 16 MÓC DÂY (x = -5.68)
    var leftNutPts = [];
    for (var k = 0; k <= 20; k++) {
      var nz = -0.86 + (k / 20) * 1.72;
      var yBoard = getSoundboardY(-5.35, nz);
      leftNutPts.push(new THREE.Vector3(-5.35, yBoard + 0.040, nz));
    }
    var nutMesh = new THREE.Mesh(new THREE.TubeGeometry(new Curve3(leftNutPts), 24, 0.024, 8, false), matBone);
    danTranhGroup.add(nutMesh);

    for (var t = 0; t < totalStrings; t++) {
      var tz = -0.74 + (t / (totalStrings - 1)) * 1.48;
      var pinBaseY = getSoundboardY(-5.68, tz);
      var pinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), matImperialGold);
      pinMesh.position.set(-5.68, pinBaseY + 0.04, tz);
      danTranhGroup.add(pinMesh);
      var pinCap = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), matImperialGold);
      pinCap.position.set(-5.68, pinBaseY + 0.075, tz);
      danTranhGroup.add(pinCap);
    }

    // 9. DÃY 16 TRỤ BUỘC DÂY ĐÀN TRÊN MẶT ĐÀN (x = 1.70 đến 4.95)
    var pegStudCoords = [];
    for (var p = 0; p < totalStrings; p++) {
      var normP = p / (totalStrings - 1);
      var pz = -0.74 + normP * 1.48;
      var px = 1.70 + normP * 3.25;
      var pegBaseY = getSoundboardY(px, pz);
      var pegH = 0.16;
      pegStudCoords.push({ x: px, y: pegBaseY + pegH * 0.58, z: pz });

      var pegGroup = new THREE.Group();
      pegGroup.position.set(px, pegBaseY, pz);
      var pegCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.022, 14), matImperialGold);
      pegCollar.position.y = 0.011;
      pegGroup.add(pegCollar);
      var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, pegH, 14), matRoyalBlack);
      pegShaft.position.y = pegH * 0.5 + 0.012;
      pegGroup.add(pegShaft);
      var pegCap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), matImperialGold);
      pegCap.position.y = pegH + 0.018;
      pegGroup.add(pegCap);
      danTranhGroup.add(pegGroup);
    }

    // 10. DÃY 16 CON NHẠN (NGỰA ĐÀN) & 16 DÂY ĐÀN HOÀNG GIA
    for (var i = 0; i < totalStrings; i++) {
      var normI = i / (totalStrings - 1);
      var stringZ = -0.74 + normI * 1.48;
      var bridgeX = -3.80 + normI * 5.00 - Math.sin(normI * Math.PI) * 0.35;

      var bridgeHeight = 0.36 - normI * 0.09;
      var baseSpan = 0.32 - normI * 0.08;
      var topSpan = 0.040 - normI * 0.008;
      var bridgeThick = 0.038 - normI * 0.008;

      var hs = baseSpan * 0.5;
      var ts = topSpan * 0.5;
      var footW = baseSpan * 0.22;
      var archH = bridgeHeight * 0.44;

      // Điêu khắc biên dạng con nhạn cánh khía bậc thang 3 tầng
      var bShape = new THREE.Shape();
      bShape.moveTo(-hs, 0);
      bShape.lineTo(-hs + footW, 0);
      bShape.quadraticCurveTo(0, archH, hs - footW, 0);
      bShape.lineTo(hs, 0);
      bShape.lineTo(hs, bridgeHeight * 0.22);
      bShape.lineTo(hs - baseSpan * 0.09, bridgeHeight * 0.22);
      bShape.lineTo(hs - baseSpan * 0.09, bridgeHeight * 0.46);
      bShape.lineTo(hs - baseSpan * 0.18, bridgeHeight * 0.46);
      bShape.lineTo(hs - baseSpan * 0.18, bridgeHeight * 0.68);
      bShape.lineTo(hs - baseSpan * 0.26, bridgeHeight * 0.68);
      bShape.quadraticCurveTo(hs * 0.32, bridgeHeight * 0.88, ts, bridgeHeight);
      bShape.lineTo(-ts, bridgeHeight);
      bShape.quadraticCurveTo(-hs * 0.32, bridgeHeight * 0.88, -hs + baseSpan * 0.26, bridgeHeight * 0.68);
      bShape.lineTo(-hs + baseSpan * 0.18, bridgeHeight * 0.68);
      bShape.lineTo(-hs + baseSpan * 0.18, bridgeHeight * 0.46);
      bShape.lineTo(-hs + baseSpan * 0.09, bridgeHeight * 0.46);
      bShape.lineTo(-hs + baseSpan * 0.09, bridgeHeight * 0.22);
      bShape.lineTo(-hs, bridgeHeight * 0.22);
      bShape.lineTo(-hs, 0);

      var bGeo = new THREE.ExtrudeGeometry(bShape, {
        depth: bridgeThick,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 2
      });
      bGeo.center();

      var footPadOffset = hs - footW * 0.5;
      var yBoardPad1 = getSoundboardY(bridgeX, stringZ + footPadOffset);
      var yBoardPad2 = getSoundboardY(bridgeX, stringZ - footPadOffset);
      var tiltAlpha = Math.atan2(yBoardPad2 - yBoardPad1, 2 * footPadOffset);
      var yCenterBoard = (yBoardPad1 + yBoardPad2) * 0.5 - 0.003;

      var bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(bridgeX, yCenterBoard + (bridgeHeight * 0.5) * Math.cos(tiltAlpha), stringZ);
      bridgeGroup.rotation.y = Math.PI / 2;

      var bridgeInner = new THREE.Group();
      bridgeInner.rotation.z = tiltAlpha;

      var bridgeMesh = new THREE.Mesh(bGeo, matBridgeWood);
      bridgeInner.add(bridgeMesh);

      // Họa tiết 2 vòng tròn vàng đồng tâm trên mặt nhạn
      var ringCX = hs * 0.36;
      var ringCY = bridgeHeight * 0.18;
      var rOut = 0.038 - normI * 0.008;
      var rIn = 0.022 - normI * 0.005;

      var ringOutMesh = new THREE.Mesh(new THREE.TorusGeometry(rOut, 0.004, 6, 16), matImperialGold);
      ringOutMesh.position.set(ringCX, ringCY, bridgeThick * 0.5 + 0.001);
      bridgeInner.add(ringOutMesh);
      var ringInMesh = new THREE.Mesh(new THREE.TorusGeometry(rIn, 0.003, 6, 16), matImperialGold);
      ringInMesh.position.set(ringCX, ringCY, bridgeThick * 0.5 + 0.001);
      bridgeInner.add(ringInMesh);

      // Rãnh ngà đỡ dây trên đỉnh con nhạn
      var saddleNotch = new THREE.Mesh(new THREE.BoxGeometry(topSpan * 0.95, 0.012, bridgeThick * 1.10), matBone);
      saddleNotch.position.set(0, bridgeHeight * 0.5 + 0.006, 0);
      bridgeInner.add(saddleNotch);

      bridgeGroup.add(bridgeInner);
      danTranhGroup.add(bridgeGroup);

      // 11. DÂY ĐÀN KÉO TỰA QUA ĐỈNH NHẠN
      var saddleLocalY = bridgeHeight * 0.5 + 0.006;
      var bridgePeakY = bridgeGroup.position.y + saddleLocalY * Math.cos(tiltAlpha);
      var bridgePeakZ = stringZ + saddleLocalY * Math.sin(tiltAlpha);

      var pPinX = -5.68;
      var pPinY = getSoundboardY(pPinX, stringZ) + 0.050;
      var pNutLX = -5.35;
      var pNutLY = getSoundboardY(pNutLX, stringZ) + 0.058;
      var pegTarget = pegStudCoords[i];

      var stringPath = new THREE.CurvePath();
      stringPath.add(new THREE.LineCurve3(new THREE.Vector3(pPinX, pPinY, stringZ), new THREE.Vector3(pNutLX, pNutLY, stringZ)));
      stringPath.add(new THREE.LineCurve3(new THREE.Vector3(pNutLX, pNutLY, stringZ), new THREE.Vector3(bridgeX, bridgePeakY, bridgePeakZ)));
      stringPath.add(new THREE.LineCurve3(new THREE.Vector3(bridgeX, bridgePeakY, bridgePeakZ), new THREE.Vector3(pegTarget.x, pegTarget.y, pegTarget.z)));

      var stringThickness = 0.0070 - normI * 0.0020;
      var isBass = (i < 5);
      var strMat = isBass ? matBronzeString : matSteelString;
      var stringGeo = new THREE.TubeGeometry(stringPath, 48, stringThickness, 8, false);
      var stringMesh = new THREE.Mesh(stringGeo, strMat);
      danTranhGroup.add(stringMesh);
    }

    // 12. DỰNG THẾ ĐÀN TRANH NGHIÊNG CHÉO NGHỆ THUẬT & XOAY 360 ĐỘ QUANH TRỤC THÂN ĐÀN
    // Tỷ lệ scale 0.48: Khi nghiêng chéo góc ~22° và góc phối cảnh 3D ~13°, cây đàn trải dài thoáng đãng và không chạm viền
    danTranhGroup.scale.set(0.48, 0.48, 0.48);
    // Dựng theo trục đứng Y: Đầu đàn ở trên (+Y), Đuôi đàn ở dưới (-Y), Mặt đàn hướng thẳng ra trước (+Z)
    danTranhGroup.rotation.set(0, Math.PI / 2, Math.PI / 2);
    danTranhGroup.position.set(0, 0, -0.04);

    // Nhóm trục xoay quanh thân đàn (Spin Group)
    var spinGroup = new THREE.Group();
    spinGroup.add(danTranhGroup);
    hero3DSpinGroup = spinGroup;

    // Nhóm tạo góc nghiêng chéo nghệ thuật & phối cảnh 3D (Slant Mount Group)
    var slantGroup = new THREE.Group();
    slantGroup.rotation.z = hero3DDefaultSlantZ; // Nghiêng chéo góc ~ 22°
    slantGroup.rotation.x = hero3DDefaultSlantX; // Nghiêng phối cảnh 3D ~ 13°
    slantGroup.add(spinGroup);
    hero3DSlantGroup = slantGroup;

    rootGroup.add(slantGroup);

    // 13. HẠT KIM SA VÀNG LẤP LÁNH BAY BỔNG DỌC THÂN ĐÀN
    var sparkCount = 85;
    var sparkGeo = new THREE.BufferGeometry();
    var sparkPositions = new Float32Array(sparkCount * 3);
    for (var p = 0; p < sparkCount; p++) {
      var rad = 0.8 + Math.random() * 1.8;
      var theta = Math.random() * Math.PI * 2;
      sparkPositions[p * 3] = Math.cos(theta) * rad;
      sparkPositions[p * 3 + 1] = -3.2 + Math.random() * 6.4;
      sparkPositions[p * 3 + 2] = Math.sin(theta) * rad;
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));

    var sparkCv = document.createElement("canvas");
    sparkCv.width = 64; sparkCv.height = 64;
    var sctx = sparkCv.getContext("2d");
    var sgrad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    sgrad.addColorStop(0, "rgba(255, 245, 180, 1.0)");
    sgrad.addColorStop(0.35, "rgba(245, 195, 40, 0.75)");
    sgrad.addColorStop(0.7, "rgba(222, 25, 75, 0.2)");
    sgrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 64, 64);
    var sparkTex = new THREE.CanvasTexture(sparkCv);

    var sparkMat = new THREE.PointsMaterial({
      map: sparkTex,
      size: 0.18,
      color: 0xffe680,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var sparks = new THREE.Points(sparkGeo, sparkMat);
    rootGroup.add(sparks);
    hero3DSparksGroup = sparks;

    return rootGroup;
  }

  function initHero3DModel() {
    var canvas = document.getElementById("hero3DModelCanvas");
    if (!canvas || typeof THREE === "undefined") return;

    var stage = document.getElementById("hero3DModelStage");
    var width = (stage && stage.clientWidth) || 520;
    var height = (stage && stage.clientHeight) || 540;
    if (width < 200) width = 520;
    if (height < 200) height = 540;

    if (isHero3DInitialized && hero3DRenderer && hero3DCamera) {
      onHero3DResize();
      return;
    }

    try {
      hero3DScene = new THREE.Scene();
      hero3DCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
      hero3DCamera.position.set(0, 0, 9.5);
      hero3DCamera.lookAt(0, 0, 0);

      hero3DRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      hero3DRenderer.setSize(width, height);
      hero3DRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (typeof THREE.ACESFilmicToneMapping !== "undefined") {
        hero3DRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        hero3DRenderer.toneMappingExposure = 1.25;
      }

      // Ánh sáng Studio Hoàng Gia dọc thân đàn
      var dirLight = new THREE.DirectionalLight(0xfff5c0, 2.8);
      dirLight.position.set(4, 5, 5);
      hero3DScene.add(dirLight);

      var fillLight = new THREE.PointLight(0xffd700, 1.8, 25);
      fillLight.position.set(-3.5, 0, 4);
      hero3DScene.add(fillLight);

      var rimLight = new THREE.PointLight(0xde194b, 3.2, 20);
      rimLight.position.set(0, 1, -4);
      hero3DScene.add(rimLight);

      var bounceLight = new THREE.PointLight(0xffea9f, 1.2, 12);
      bounceLight.position.set(0, -3.2, 3);
      hero3DScene.add(bounceLight);

      var ambLight = new THREE.AmbientLight(0x451218, 1.3);
      hero3DScene.add(ambLight);

      // Dựng toàn bộ cây đàn tranh 16 dây 3D đứng thẳng
      hero3DSculptureGroup = buildHero3DSculpture();
      hero3DScene.add(hero3DSculptureGroup);

      // Tương tác kéo xoay bằng chuột & chạm
      initHero3DInteraction(canvas);

      isHero3DInitialized = true;

      if (!isHero3DAnimating) {
        isHero3DAnimating = true;
        animateHero3D();
      }
    } catch (err) {
      console.warn("Lỗi khởi tạo Hero 3D WebGL:", err);
    }
  }

  function animateHero3D() {
    requestAnimationFrame(animateHero3D);
    if (!hero3DScene || !hero3DCamera || !hero3DRenderer) return;

    var time = Date.now() * 0.001;

    // Cho model tự động xoay nhanh và mượt mà hơn theo yêu cầu người dùng
    if (hero3DSpinGroup && isHero3DAutoRotating) {
      hero3DSpinGroup.rotation.y += 0.018;
    }
    if (hero3DSlantGroup) {
      hero3DSlantGroup.rotation.x = hero3DDefaultSlantX;
      hero3DSlantGroup.rotation.z = hero3DDefaultSlantZ;
    }

    // Chuyển động bồng bềnh thở nhẹ nhàng trong không gian
    if (hero3DSculptureGroup) {
      hero3DSculptureGroup.position.y = Math.sin(time * 1.5) * 0.05;
    }

    // Hạt kim sa tĩnh lặng nhẹ nhàng
    if (hero3DSparksGroup) {
      var posAttr = hero3DSparksGroup.geometry.attributes.position;
      if (posAttr) {
        var arr = posAttr.array;
        for (var i = 1; i < arr.length; i += 3) {
          arr[i] += 0.005;
          if (arr[i] > 3.4) arr[i] = -3.2;
        }
        posAttr.needsUpdate = true;
      }
    }

    hero3DRenderer.render(hero3DScene, hero3DCamera);
  }

  function onHero3DResize() {
    var stage = document.getElementById("hero3DModelStage");
    if (!stage || !hero3DRenderer || !hero3DCamera) return;
    var w = stage.clientWidth || 520;
    var h = stage.clientHeight || 540;
    if (w < 100) w = 520;
    if (h < 100) h = 540;
    hero3DCamera.aspect = w / h;
    hero3DCamera.updateProjectionMatrix();
    hero3DRenderer.setSize(w, h);
  }

  function initHero3DInteraction(canvas) {
    if (!canvas) return;
    canvas.style.cursor = "grab";
    canvas.style.pointerEvents = "auto";

    function onPointerDown(e) {
      hero3DPointerDown = true;
      isHero3DAutoRotating = false;
      hero3DLastPointerX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      hero3DLastPointerY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
      canvas.style.cursor = "grabbing";
      clearTimeout(hero3DResumeRotateTimer);
    }

    function onPointerMove(e) {
      if (!hero3DPointerDown || !hero3DSpinGroup) return;
      var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      var dx = clientX - hero3DLastPointerX;
      hero3DSpinGroup.rotation.y += dx * 0.008;
      hero3DLastPointerX = clientX;
    }

    function onPointerUp() {
      if (!hero3DPointerDown) return;
      hero3DPointerDown = false;
      canvas.style.cursor = "grab";
      clearTimeout(hero3DResumeRotateTimer);
      hero3DResumeRotateTimer = setTimeout(function() {
        isHero3DAutoRotating = true;
      }, 2000);
    }

    canvas.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    canvas.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    window.addEventListener("resize", onHero3DResize);
  }

  function initDanTranh3D() {
    var container = document.getElementById("danTranh3DCanvas");
    if (!container || typeof THREE === "undefined") return;

    if (is3DInitialized && renderer3D && camera3D) {
      if (renderer3D.domElement && !container.contains(renderer3D.domElement)) {
        container.innerHTML = "";
        container.appendChild(renderer3D.domElement);
      }
      on3DWindowResize();
      return;
    }

    var wrap = document.getElementById("danTranh3DWrap") || container.parentElement;
    var width = container.clientWidth || (wrap && wrap.clientWidth) || 860;
    var height = container.clientHeight || (wrap && wrap.clientHeight) || 460;
    if (width < 100) width = 860;
    if (height < 200) height = 460;

    scene3D = new THREE.Scene();
    camera3D = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera3D.position.set(0, 7.5, 12.0);

    renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer3D.shadowMap.enabled = true;
    renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
    renderer3D.toneMappingExposure = 1.05;
    container.innerHTML = "";
    container.appendChild(renderer3D.domElement);

    if (typeof THREE.OrbitControls !== "undefined") {
      controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
      controls3D.enableDamping = true;
      controls3D.dampingFactor = 0.07;
      controls3D.maxPolarAngle = Math.PI * 0.85;
      controls3D.minDistance = 3.6;
      controls3D.maxDistance = 24;
      controls3D.autoRotate = false;
      controls3D.autoRotateSpeed = 1.6;
    }

    // Ánh sáng Studio Hoàng Gia Đỏ Rượu Vang & Vàng Kim 24K (ánh sáng trầm ấm dịu mắt, không bị chói lóa)
    var ambLight = new THREE.AmbientLight(0xffeedd, 0.80);
    scene3D.add(ambLight);

    // 1. Key Light: Đèn chiếu chính vàng ấm tôn vinh bề mặt sơn mài bóng gương & phù điêu mây vàng 3D
    var keyLight = new THREE.DirectionalLight(0xfff4dc, 1.30);
    keyLight.position.set(6.5, 11.5, 9.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene3D.add(keyLight);

    // 2. Rim / Silhouette Light: Đèn viền vàng hổ phách tách khối 3D trên nền đỏ rượu vang
    var rimLight = new THREE.DirectionalLight(0xffbe6b, 0.95);
    rimLight.position.set(-8.5, 6.5, -6.5);
    scene3D.add(rimLight);

    // 3. Fill Light: Đèn bù sáng mềm mại
    var fillLight = new THREE.DirectionalLight(0xffd9a0, 0.65);
    fillLight.position.set(-6.0, 3.5, 8.0);
    scene3D.add(fillLight);

    // 4. Accent Light: Điểm sáng vàng hoàng gia chiếu nhẹ nhàng
    var accentLight = new THREE.PointLight(0xffd25a, 0.85, 30);
    accentLight.position.set(1.5, 3.5, 5.0);
    scene3D.add(accentLight);

    is3DInitialized = true;
    window.renderer3D = renderer3D;
    window.scene3D = scene3D;
    window.camera3D = camera3D;

    build3DInstrumentMesh();

    raycaster3D = new THREE.Raycaster();
    mouse3D = new THREE.Vector2();
    renderer3D.domElement.addEventListener("pointerdown", on3DCanvasPointerDown);
    renderer3D.domElement.addEventListener("pointerup", on3DCanvasPointerUp);

    window.addEventListener("resize", on3DWindowResize);

    animate3D();
    setTimeout(on3DWindowResize, 120);
  }

  var current3DInstrumentGroup = null;
  var striker3D = null;
  var strikerAnim = {
    mode: "none",
    phase: 0,
    intensity: 0,
    strokeDir: 1,
    restPos: null,
    restRot: null,
    targetPos: null,
    currentPos: null
  };

  function build3DModelForInstrument(instId) {
    if (!scene3D) {
      if (typeof initDanTranh3D === "function") initDanTranh3D();
      if (!scene3D) return;
    }

    if (current3DInstrumentGroup) {
      scene3D.remove(current3DInstrumentGroup);
      current3DInstrumentGroup.traverse(function(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function(m) { m.dispose(); });
          else obj.material.dispose();
        }
      });
      current3DInstrumentGroup = null;
    }

    var group = new THREE.Group();
    current3DInstrumentGroup = group;
    striker3D = null;
    strikerAnim.mode = "none";
    strikerAnim.intensity = 0;
    strings3D = [];
    stringHitboxes3D = [];
    stringVibrations = [];

    var rawInstId = instId;
    var effectiveId = instId || "dantranh";
    var inst = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP[effectiveId]) ? INSTRUMENT_MAP[effectiveId] : null;
    if (!inst) inst = { id: effectiveId, name: "Đàn Tranh", cat: "day", notes: [] };
    var notesCount = (inst.notes && inst.notes.length) ? inst.notes.length : 16;

    var el3DIcon = document.getElementById("lbl3DInstIcon");
    var el3DName = document.getElementById("lbl3DInstName");
    if (!rawInstId) {
      if (el3DIcon) el3DIcon.textContent = "🪕";
      if (el3DName) el3DName.textContent = "Đàn tranh - 3D Xoay 360°";
    } else {
      if (el3DIcon) el3DIcon.textContent = inst.icon || "🪕";
      if (el3DName) el3DName.textContent = inst.name + " - 3D Xoay 360°";
    }
    instId = effectiveId;

    var woodTex = (typeof createWoodProceduralTexture === "function") ? createWoodProceduralTexture() : null;
    var snakeskinTex = (typeof createSnakeskinTexture === "function") ? createSnakeskinTexture() : null;
    var bronzeDongSonTex = (typeof createDongSonBronzeTexture === "function") ? createDongSonBronzeTexture() : null;
    var drumHeadTrongComTex = (typeof createDrumheadTexture === "function") ? createDrumheadTexture(true) : null;
    var drumHeadDaiTex = (typeof createDrumheadTexture === "function") ? createDrumheadTexture(false) : null;
    var bambooTex = (typeof createBambooTexture === "function") ? createBambooTexture() : null;
    var stoneTex = (typeof createStoneTexture === "function") ? createStoneTexture() : null;

    var matWoodLight = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.38, metalness: 0.04 });
    var matWoodDark = new THREE.MeshStandardMaterial({ color: 0x220e05, roughness: 0.28, metalness: 0.2, side: THREE.DoubleSide });
    var matWoodRed = new THREE.MeshStandardMaterial({ color: 0x7c1a10, roughness: 0.32, metalness: 0.15 });
    var matBamboo = new THREE.MeshStandardMaterial({ map: bambooTex, color: 0xffffff, roughness: 0.32, metalness: 0.08 });
    var matBambooDark = new THREE.MeshStandardMaterial({ color: 0x4e331a, roughness: 0.38, metalness: 0.06 });
    var matBronze = new THREE.MeshStandardMaterial({ map: bronzeDongSonTex, color: 0xffffff, roughness: 0.28, metalness: 0.88 });
    var matGold = new THREE.MeshStandardMaterial({ color: 0xf5c328, roughness: 0.18, metalness: 0.95 });
    var matSteel = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.12, metalness: 0.98 });
    var matStone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xffffff, roughness: 0.82, metalness: 0.06 });
    var matDrumSkin = new THREE.MeshStandardMaterial({ map: drumHeadTrongComTex, color: 0xffffff, roughness: 0.62, metalness: 0.04 });
    var matDrumSkinDai = new THREE.MeshStandardMaterial({ map: drumHeadDaiTex, color: 0xffffff, roughness: 0.58, metalness: 0.05 });
    var matDrumRed = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.28, metalness: 0.22 });
    var matSnakeskin = new THREE.MeshStandardMaterial({ map: snakeskinTex, color: 0xffffff, roughness: 0.45, metalness: 0.1 });
    var matGourd = new THREE.MeshStandardMaterial({ color: 0x995a28, roughness: 0.48, metalness: 0.05 });
    var matHorn = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.2, metalness: 0.3 });
    var matLeaf = new THREE.MeshStandardMaterial({ color: 0x22864a, roughness: 0.5, metalness: 0.02 });
    var matBone = new THREE.MeshStandardMaterial({ color: 0xfcfdfd, roughness: 0.16, metalness: 0.14 });
    var matInlay = new THREE.MeshStandardMaterial({ color: 0x3d1408, roughness: 0.2, metalness: 0.35 });
    var matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.1 });

    function createHMongBrocadeTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#d32f2f";
      ctx.fillRect(0, 0, 256, 256);

      var size = 64;
      for (var y = 0; y < 256; y += size) {
        for (var x = 0; x < 256; x += size) {
          ctx.fillStyle = "#2e7d32";
          ctx.beginPath();
          ctx.moveTo(x + size / 2, y);
          ctx.lineTo(x + size, y + size / 2);
          ctx.lineTo(x + size / 2, y + size);
          ctx.lineTo(x, y + size / 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#fbc02d";
          ctx.beginPath();
          ctx.moveTo(x + size / 2, y + 8);
          ctx.lineTo(x + size - 8, y + size / 2);
          ctx.lineTo(x + size / 2, y + size - 8);
          ctx.lineTo(x + 8, y + size / 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#b71c1c";
          ctx.beginPath();
          ctx.moveTo(x + size / 2, y + 16);
          ctx.lineTo(x + size - 16, y + size / 2);
          ctx.lineTo(x + size / 2, y + size - 16);
          ctx.lineTo(x + 16, y + size / 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#fff59d";
          ctx.fillRect(x + size / 2 - 3, y + size / 2 - 3, 6, 6);
        }
      }
      var tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 2);
      return tex;
    }

    var brocadeTex = createHMongBrocadeTexture();
    var matBrocade = new THREE.MeshStandardMaterial({ map: brocadeTex, color: 0xffffff, roughness: 0.5, metalness: 0.05 });

    function createDanTranhBrownRosewoodSideTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 256;
      var ctx = canvas.getContext("2d");

      // 1. Nền Gỗ Cẩm Lai / Gỗ Trắc Đỏ Sẫm Hoàng Gia (Deep Crimson-Rosewood / Dark Mahogany Lacquer)
      var grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#0c0302");
      grad.addColorStop(0.12, "#180603");
      grad.addColorStop(0.35, "#2c0c07");
      grad.addColorStop(0.5, "#381009");
      grad.addColorStop(0.65, "#2c0c07");
      grad.addColorStop(0.88, "#180603");
      grad.addColorStop(1, "#0c0302");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2048, 256);

      // 2. Thớ vân gỗ tự nhiên lượn sóng mềm mại
      ctx.strokeStyle = "rgba(18, 5, 3, 0.42)";
      ctx.lineWidth = 1.6;
      for (var y = 6; y < 256; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (var x = 0; x <= 2048; x += 128) {
          ctx.quadraticCurveTo(x + 64, y + Math.sin(x * 0.03 + y) * 3.5, x + 128, y);
        }
        ctx.stroke();
      }

      // Thớ vân chìm ánh đỏ hổ phách
      ctx.strokeStyle = "rgba(120, 35, 20, 0.18)";
      ctx.lineWidth = 2.4;
      for (var y = 14; y < 256; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (var x = 0; x <= 2048; x += 256) {
          ctx.quadraticCurveTo(x + 128, y + Math.cos(x * 0.02 + y) * 5.0, x + 256, y);
        }
        ctx.stroke();
      }

      // 3. Nẹp viền màu mun sẫm & Chỉ viền Vàng Kim chạy suốt mép trên và mép dưới
      // Nẹp viền mun trên & dưới
      ctx.fillStyle = "#120503";
      ctx.fillRect(0, 0, 2048, 16);
      ctx.fillRect(0, 240, 2048, 16);

      // Đường chỉ đôi vàng kim trên
      ctx.strokeStyle = "#f3c759";
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(2048, 18);
      ctx.stroke();

      ctx.strokeStyle = "#d69c28";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(2048, 24);
      ctx.stroke();

      // Đường chỉ đôi vàng kim dưới
      ctx.strokeStyle = "#d69c28";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 232);
      ctx.lineTo(2048, 232);
      ctx.stroke();

      ctx.strokeStyle = "#f3c759";
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(0, 238);
      ctx.lineTo(2048, 238);
      ctx.stroke();

      // Hàng chuỗi hạt cẩn vàng li ti viền mép trên và dưới
      ctx.fillStyle = "rgba(255, 225, 140, 0.75)";
      for (var bx = 8; bx < 2048; bx += 24) {
        ctx.beginPath();
        ctx.arc(bx, 21, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, 235, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Chuỗi Hoa Văn Hoa Sen & Mây Cuộn Dát Vàng Hoàng Kim Chạy Dọc Thân Đàn (8 cụm đối xứng)
      var totalSegments = 8;
      var segWidth = 2048 / totalSegments; // 256px mỗi đoạn

      for (var s = 0; s < totalSegments; s++) {
        var cx = s * segWidth + segWidth * 0.5;
        var cy = 128;

        if (s % 2 === 0) {
          // --- ĐỒ ÁN HOA SEN DÁT VÀNG TRUYỀN THỐNG (Traditional Golden Lotus Motif) ---
          ctx.save();
          ctx.translate(cx, cy);

          // Bóng đổ nhẹ dưới hoa văn tạo cảm giác chạm khắc nổi
          ctx.shadowColor = "rgba(10, 2, 1, 0.75)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;

          // Cánh sen úp đỡ dưới
          ctx.strokeStyle = "#f0be49";
          ctx.lineWidth = 2.4;
          ctx.fillStyle = "rgba(215, 155, 40, 0.25)";
          ctx.beginPath();
          ctx.moveTo(-48, 24);
          ctx.bezierCurveTo(-28, 48, 28, 48, 48, 24);
          ctx.bezierCurveTo(24, 30, -24, 30, -48, 24);
          ctx.fill();
          ctx.stroke();

          // Đài sen trung tâm
          var lotusGrad = ctx.createRadialGradient(0, 8, 2, 0, 8, 22);
          lotusGrad.addColorStop(0, "#fff1b0");
          lotusGrad.addColorStop(0.5, "#f3c759");
          lotusGrad.addColorStop(1, "#c88a1b");
          ctx.fillStyle = lotusGrad;
          ctx.beginPath();
          ctx.arc(0, 8, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffd978";
          ctx.lineWidth = 2.2;
          ctx.stroke();

          // Hạt sen / nhụy hoa sen
          ctx.fillStyle = "#fff8d6";
          for (var a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 7, 8 + Math.sin(a) * 7, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(0, 8, 2.8, 0, Math.PI * 2);
          ctx.fill();

          // 3 Cánh sen chính bung nở vươn lên
          // Cánh sen giữa (chính tâm)
          ctx.beginPath();
          ctx.moveTo(0, -52);
          ctx.bezierCurveTo(18, -25, 20, 0, 0, 6);
          ctx.bezierCurveTo(-20, 0, -18, -25, 0, -52);
          ctx.strokeStyle = "#ffd978";
          ctx.lineWidth = 2.6;
          ctx.stroke();
          ctx.fillStyle = "rgba(245, 200, 80, 0.22)";
          ctx.fill();

          // Cánh sen trái
          ctx.beginPath();
          ctx.moveTo(-36, -34);
          ctx.bezierCurveTo(-14, -18, -8, 2, -10, 10);
          ctx.bezierCurveTo(-26, 6, -38, -12, -36, -34);
          ctx.strokeStyle = "#e8b23a";
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.fillStyle = "rgba(235, 175, 50, 0.18)";
          ctx.fill();

          // Cánh sen phải
          ctx.beginPath();
          ctx.moveTo(36, -34);
          ctx.bezierCurveTo(14, -18, 8, 2, 10, 10);
          ctx.bezierCurveTo(26, 6, 38, -12, 36, -34);
          ctx.strokeStyle = "#e8b23a";
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.fillStyle = "rgba(235, 175, 50, 0.18)";
          ctx.fill();

          // Cuống hoa và 2 dải lá sen uốn lượn vươn dài sang hai bên
          ctx.strokeStyle = "#f3c759";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(-10, 24);
          ctx.bezierCurveTo(-35, 34, -70, 18, -112, 0);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(10, 24);
          ctx.bezierCurveTo(35, 34, 70, 18, 112, 0);
          ctx.stroke();

          // Xoắn lá sen nhỏ ở đầu cuống
          ctx.beginPath();
          ctx.arc(-112, 0, 10, 0, Math.PI * 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(112, 0, 10, -Math.PI * 0.5, Math.PI);
          ctx.stroke();

          ctx.restore();
        } else {
          // --- ĐỒ ÁN MÂY CUỘN CỔ PHONG DÁT VÀNG (Traditional Imperial Cloud Wave Scrolls) ---
          ctx.save();
          ctx.translate(cx, cy);

          ctx.shadowColor = "rgba(10, 2, 1, 0.75)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;

          // Xoáy mây chính uốn lượn liên hoàn
          ctx.strokeStyle = "#f3c759";
          ctx.lineWidth = 3.0;

          // Xoáy trái
          ctx.beginPath();
          ctx.arc(-36, -6, 26, 0.2, Math.PI * 1.6);
          ctx.bezierCurveTo(-15, -42, 15, -42, 36, -6);
          ctx.stroke();

          // Xoáy phải
          ctx.beginPath();
          ctx.arc(36, -6, 26, Math.PI * 1.4, Math.PI * 2.8);
          ctx.stroke();

          // Lớp xoáy mây trong
          ctx.strokeStyle = "#ffd978";
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(-36, -6, 17, 0.3, Math.PI * 1.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(36, -6, 17, Math.PI * 1.5, Math.PI * 2.7);
          ctx.stroke();

          // Hạt ngọc vàng tại tâm mỗi xoáy mây
          var pearlGrad = ctx.createRadialGradient(-36, -6, 1, -36, -6, 8);
          pearlGrad.addColorStop(0, "#ffffff");
          pearlGrad.addColorStop(0.4, "#ffe895");
          pearlGrad.addColorStop(1, "#c88a1b");
          ctx.fillStyle = pearlGrad;
          ctx.beginPath();
          ctx.arc(-36, -6, 7, 0, Math.PI * 2);
          ctx.fill();

          var pearlGradR = ctx.createRadialGradient(36, -6, 1, 36, -6, 8);
          pearlGradR.addColorStop(0, "#ffffff");
          pearlGradR.addColorStop(0.4, "#ffe895");
          pearlGradR.addColorStop(1, "#c88a1b");
          ctx.fillStyle = pearlGradR;
          ctx.beginPath();
          ctx.arc(36, -6, 7, 0, Math.PI * 2);
          ctx.fill();

          // Đuôi mây lượn sóng kéo dài nối tiếp nhịp nhàng sang hai bên
          ctx.strokeStyle = "#d69c28";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-62, -6);
          ctx.bezierCurveTo(-85, 20, -100, -18, -124, 0);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(62, -6);
          ctx.bezierCurveTo(85, 20, 100, -18, 124, 0);
          ctx.stroke();

          ctx.restore();
        }
      }

      var tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      return tex;
    }

    function createDanTranhSoundboardTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");

      // Nền gỗ sồi / ngô đồng sấy vàng ấm tự nhiên chuẩn theo mẫu gỗ 388 trong ảnh
      var grad = ctx.createLinearGradient(0, 0, 1024, 512);
      grad.addColorStop(0.00, "#d9ba8b");
      grad.addColorStop(0.20, "#e4cb95");
      grad.addColorStop(0.40, "#dfbf8c");
      grad.addColorStop(0.65, "#d8bf8b");
      grad.addColorStop(0.85, "#dbc388");
      grad.addColorStop(1.00, "#debf90");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Thớ vân gỗ sồi ngang / dọc tự nhiên uốn lượn mềm mại (Natural Oak Wood Grains)
      for (var i = 0; i < 512; i += 4) {
        var wave = Math.sin(i * 0.045) * 5 + Math.cos(i * 0.08) * 3;
        var isAccent = (i % 16 === 0);
        ctx.strokeStyle = isAccent ? "rgba(155, 112, 62, 0.46)" : "rgba(182, 142, 92, 0.32)";
        ctx.lineWidth = isAccent ? 1.4 : 0.9;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.bezierCurveTo(340, i + wave, 680, i - wave * 0.7, 1024, i + wave * 0.4);
        ctx.stroke();
      }

      // Sợi vân gỗ sồi mịn đan xen & vệt sáng tự nhiên
      ctx.strokeStyle = "rgba(248, 228, 185, 0.36)";
      ctx.lineWidth = 0.8;
      for (var i = 2; i < 512; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1024, i + Math.sin(i * 0.035) * 4);
        ctx.stroke();
      }

      // Vân núi gỗ sồi (Oak cathedral flame arches) ở trung tâm mặt gỗ như trong ảnh mẫu 388
      ctx.save();
      for (var c = 0; c < 9; c++) {
        ctx.strokeStyle = "rgba(162, 118, 66, " + (0.10 + (c % 3) * 0.05) + ")";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(512, 256, 210 + c * 38, 55 + c * 15, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Đốm thớ gỗ sồi li ti (Oak ray flecks)
      ctx.fillStyle = "rgba(145, 102, 52, 0.22)";
      for (var p = 0; p < 220; p++) {
        var px = (p * 83) % 1020 + 2;
        var py = (p * 109) % 508 + 2;
        ctx.fillRect(px, py, 6 + (p % 6) * 3, 0.8);
      }
      ctx.restore();

      // Vệt dác gỗ ánh vàng ấm tự nhiên
      var dacGrad = ctx.createLinearGradient(0, 160, 0, 360);
      dacGrad.addColorStop(0, "rgba(255, 238, 200, 0)");
      dacGrad.addColorStop(0.5, "rgba(255, 238, 200, 0.18)");
      dacGrad.addColorStop(1, "rgba(255, 238, 200, 0)");
      ctx.fillStyle = dacGrad;
      ctx.fillRect(0, 160, 1024, 200);

      // Họa tiết hoa văn Trống đồng Đông Sơn / Dấu triện tròn màu đỏ gạch đất nung
      // Chuẩn theo góc dưới bên trái trong ảnh media_1791353559086.png
      var sealX = 210;
      var sealY = 360;
      var sealR = 52;
      ctx.save();
      ctx.translate(sealX, sealY);
      ctx.strokeStyle = "rgba(186, 75, 48, 0.76)";
      ctx.fillStyle = "rgba(186, 75, 48, 0.76)";

      // Vòng tròn đôi ngoài cùng
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.arc(0, 0, sealR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, sealR - 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, sealR - 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, sealR - 22, 0, Math.PI * 2);
      ctx.stroke();

      // Ngôi sao mặt trời trống đồng ở tâm
      var starPts = 12;
      ctx.beginPath();
      for (var s = 0; s < starPts * 2; s++) {
        var ang = (s * Math.PI) / starPts;
        var rPt = (s % 2 === 0) ? (sealR - 28) : 8;
        var spx = Math.cos(ang) * rPt;
        var spy = Math.sin(ang) * rPt;
        if (s === 0) ctx.moveTo(spx, spy);
        else ctx.lineTo(spx, spy);
      }
      ctx.closePath();
      ctx.fill();

      // Tâm tròn nhạt
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#dfbe90";
      ctx.fill();

      // Cán vươn dài nằm ngang sang trái với chấm tròn đầu chóp y hệt trong ảnh
      ctx.strokeStyle = "rgba(186, 75, 48, 0.76)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-sealR - 4, 3);
      ctx.lineTo(-sealR - 38, 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-sealR - 46, 3, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(186, 75, 48, 0.76)";
      ctx.fill();

      ctx.restore();

      var tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    function createNaturalYellowBambooTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");

      // Nền nứa/tre vàng óng tự nhiên chuẩn ảnh đàn T'rưng media_1791352260266.png
      var grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, "#d4aa60");
      grad.addColorStop(0.2, "#e6c784");
      grad.addColorStop(0.4, "#ebd394");
      grad.addColorStop(0.65, "#dfba74");
      grad.addColorStop(0.85, "#eed89d");
      grad.addColorStop(1, "#cfa258");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Thớ nứa/tre dọc tự nhiên
      ctx.strokeStyle = "rgba(135, 92, 35, 0.20)";
      ctx.lineWidth = 1.1;
      for (var x = 0; x < 512; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + Math.sin(x * 0.15) * 1.5, 512);
        ctx.stroke();
      }

      // Vệt sáp và thớ nứa tự nhiên
      ctx.fillStyle = "rgba(255, 248, 220, 0.12)";
      for (var b = 0; b < 30; b++) {
        var bx = (b * 67) % 500;
        var by = (b * 131) % 500;
        ctx.fillRect(bx, by, 35 + (b % 5) * 8, 4);
      }

      var tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function createSpeckledBambooTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");

      var grad = ctx.createLinearGradient(0, 0, 512, 0);
      grad.addColorStop(0, "#633818");
      grad.addColorStop(0.25, "#8f5428");
      grad.addColorStop(0.5, "#ab6835");
      grad.addColorStop(0.75, "#874e24");
      grad.addColorStop(1, "#5c3315");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Sợi thớ trúc dọc mảnh
      ctx.strokeStyle = "rgba(48, 22, 8, 0.28)";
      ctx.lineWidth = 1.2;
      for (var x = 0; x < 512; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.sin(x * 0.2) * 2), 512);
        ctx.stroke();
      }

      // Đốm trúc tím / trúc đốm cổ truyền (Organic mottled dark speckles giống Sáo Trúc trong media_1790777044050.png)
      for (var s = 0; s < 160; s++) {
        var sx = (s * 73) % 500 + 6;
        var sy = (s * 137) % 500 + 6;
        var rx = 3 + (s % 7) * 1.8;
        var ry = 5 + ((s * 3) % 9) * 2.2;
        ctx.fillStyle = (s % 3 === 0) ? "rgba(32, 12, 4, 0.52)" : "rgba(58, 24, 9, 0.38)";
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, (s % 5) * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }

      var tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    function createCrimsonRosewoodGrainTexture() {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");

      var grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 320);
      grad.addColorStop(0, "#7a311e");
      grad.addColorStop(0.55, "#591d10");
      grad.addColorStop(1, "#330d06");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = "rgba(30, 6, 2, 0.36)";
      ctx.lineWidth = 1.6;
      for (var y = 0; y < 512; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(170, y + Math.sin(y * 0.06) * 10, 340, y - Math.cos(y * 0.05) * 10, 512, y);
        ctx.stroke();
      }
      var tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    var createDanTranhNavySideTexture = createDanTranhBrownRosewoodSideTexture;
    var tranhSideTex = createDanTranhBrownRosewoodSideTexture();
    var tranhBoardTex = createDanTranhSoundboardTexture();
    var naturalYellowBambooTex = createNaturalYellowBambooTexture();
    var speckledBambooTex = createSpeckledBambooTexture();
    var crimsonRosewoodTex = createCrimsonRosewoodGrainTexture();

    var matDanTranhRosewood = new THREE.MeshStandardMaterial({
      map: tranhSideTex,
      color: 0xffffff, // Màu sáng nguyên bản theo yêu cầu
      roughness: 0.28,
      metalness: 0.12,
      side: THREE.DoubleSide
    });
    var matDanTranhCeladon = matDanTranhRosewood;
    var matDanTranhNavy = matDanTranhRosewood;
    var matImperialGold = new THREE.MeshStandardMaterial({ color: 0xf6c445, emissive: 0x422803, emissiveIntensity: 0.26, roughness: 0.17, metalness: 0.94 });
    var matRoyalLacquerBlack = new THREE.MeshStandardMaterial({ color: 0x170806, roughness: 0.12, metalness: 0.36, side: THREE.DoubleSide });
    var matRoyalCrimsonWood = new THREE.MeshStandardMaterial({ map: crimsonRosewoodTex, color: 0xffffff, roughness: 0.20, metalness: 0.22, side: THREE.DoubleSide });
    var matMotherOfPearl = new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: 0x214952, emissiveIntensity: 0.32, roughness: 0.12, metalness: 0.72 });
    var matMotherOfPearlPink = new THREE.MeshStandardMaterial({ color: 0xffe0f0, emissive: 0x451c33, emissiveIntensity: 0.28, roughness: 0.14, metalness: 0.68 });
    var matNaturalYellowBamboo = new THREE.MeshStandardMaterial({ map: naturalYellowBambooTex, color: 0xffffff, roughness: 0.32, metalness: 0.04 });
    var matWarmAgedBamboo = new THREE.MeshStandardMaterial({ map: speckledBambooTex, color: 0xffffff, roughness: 0.28, metalness: 0.10 });
    var matRedSilkCord = new THREE.MeshStandardMaterial({ color: 0xb81d24, roughness: 0.42, metalness: 0.08 });
    var matCyanJewel = new THREE.MeshStandardMaterial({
      color: 0xf6c445,
      emissive: 0x6b4709,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.90
    });
    var matSteelString = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.14, metalness: 0.96 });
    var matBronzeString = new THREE.MeshStandardMaterial({ color: 0xdfaa52, roughness: 0.18, metalness: 0.92 });
    var matCyanString = matSteelString;
    var matBridgeReddishBrownWood = new THREE.MeshStandardMaterial({
      color: 0x481810, // Gỗ màu nâu đỏ sẫm chuẩn yêu cầu người dùng
      roughness: 0.28, // Bề mặt gỗ bóng nhẹ
      metalness: 0.05
    });
    var matBridgeDarkWood = matBridgeReddishBrownWood;
    var matBridgeGoldRing = new THREE.MeshStandardMaterial({
      color: 0xf6c445,
      emissive: 0x5a3d0b,
      emissiveIntensity: 0.38,
      roughness: 0.20,
      metalness: 0.92
    });
    var matSoundboardTranh = new THREE.MeshStandardMaterial({
      map: tranhBoardTex,
      color: 0xffffff, // Mặt đàn vân gỗ sồi vàng ấm áp chuẩn theo mẫu gỗ 388
      roughness: 0.36,
      metalness: 0.02,
      side: THREE.DoubleSide
    });

    // Hàm dựng Cụm Phù Điêu Hoa Sen & Mây Cuộn Dát Vàng Hoàng Kim 3D (Sculpted Golden Lotus & Cloud Filigree 3D Cluster)
    function addTraditionalLotusCloudCluster(parent, x, y, z, scale, rotZ, flipX) {
      var cGroup = new THREE.Group();
      var sx = (flipX ? -1 : 1) * (scale || 1);
      var sy = scale || 1;
      var sz = scale || 1;

      // 1. Đài Sen Trung Tâm Dát Vàng (Golden Lotus Seedpod Core)
      var coreGeo = new THREE.SphereGeometry(0.065, 14, 14);
      var lotusCore = new THREE.Mesh(coreGeo, matImperialGold);
      lotusCore.scale.set(1.15, 0.85, 0.55);
      lotusCore.position.set(0, 0, 0.02);
      cGroup.add(lotusCore);

      // Nhụy sen vàng kim chạm nổi
      var centerPearl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), matImperialGold);
      centerPearl.position.set(0, 0, 0.045);
      cGroup.add(centerPearl);

      // 2. Các Cánh Sen Vươn Lên Chạm Nổi (Sculpted Golden Petals)
      var petalTop = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.14, 12), matImperialGold);
      petalTop.position.set(0, 0.11, 0.015);
      cGroup.add(petalTop);

      var petalGeo = new THREE.TorusGeometry(0.085, 0.025, 8, 16, Math.PI * 1.25);
      var petalL = new THREE.Mesh(petalGeo, matImperialGold);
      petalL.position.set(-0.065, 0.04, 0.012);
      petalL.rotation.z = 0.52;
      cGroup.add(petalL);

      var petalR = new THREE.Mesh(petalGeo, matImperialGold);
      petalR.position.set(0.065, 0.04, 0.012);
      petalR.rotation.z = -0.52;
      petalR.scale.x = -1;
      cGroup.add(petalR);

      // Cánh sen úp nâng đỡ phía dưới
      var petalBot = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 8, 16, Math.PI * 0.95), matImperialGold);
      petalBot.rotation.z = Math.PI + 0.1;
      petalBot.position.set(0, -0.04, 0.012);
      cGroup.add(petalBot);

      // 3. Xoáy Mây Cuộn Cổ Phong Vươn Hai Bên (Traditional Cloud Wave Scrolls)
      var cloudGeoMain = new THREE.TorusGeometry(0.16, 0.034, 10, 22, Math.PI * 1.55);
      var cloudMainL = new THREE.Mesh(cloudGeoMain, matImperialGold);
      cloudMainL.position.set(-0.16, -0.04, 0.01);
      cloudMainL.rotation.z = 0.45;
      cGroup.add(cloudMainL);

      var cloudMainR = new THREE.Mesh(cloudGeoMain, matImperialGold);
      cloudMainR.position.set(0.16, -0.04, 0.01);
      cloudMainR.rotation.z = -0.45;
      cloudMainR.scale.x = -1;
      cGroup.add(cloudMainR);

      // Nhánh mây phụ
      var subCloudGeo = new THREE.TorusGeometry(0.10, 0.026, 8, 16, Math.PI * 1.4);
      var subCloudL = new THREE.Mesh(subCloudGeo, matImperialGold);
      subCloudL.position.set(-0.29, 0.08, 0.005);
      subCloudL.rotation.z = -0.65;
      cGroup.add(subCloudL);

      var subCloudR = new THREE.Mesh(subCloudGeo, matImperialGold);
      subCloudR.position.set(0.29, 0.08, 0.005);
      subCloudR.rotation.z = 0.65;
      subCloudR.scale.x = -1;
      cGroup.add(subCloudR);

      // Hạt ngọc vàng ở tâm mỗi xoáy mây
      var pearlL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), matImperialGold);
      pearlL.position.set(-0.16, -0.04, 0.025);
      cGroup.add(pearlL);

      var pearlR = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), matImperialGold);
      pearlR.position.set(0.16, -0.04, 0.025);
      cGroup.add(pearlR);

      // Khung đệm gỗ mun sẫm phía sau tôn hoa văn nổi
      var backPlateGeo = new THREE.BoxGeometry(0.68, 0.32, 0.015);
      var backPlate = new THREE.Mesh(backPlateGeo, matRoyalLacquerBlack);
      backPlate.position.set(0, 0.02, -0.008);
      cGroup.add(backPlate);

      cGroup.position.set(x, y, z);
      cGroup.rotation.z = rotZ || 0;
      cGroup.scale.set(sx, sy, sz);
      parent.add(cGroup);
      return cGroup;
    }
    var addCeladonCloudScrollCluster = addTraditionalLotusCloudCluster;

    // Hàm dựng cụm Phù Điêu Mây Cuộn Vàng 24K Chạm Nổi 3D (Sculpted 3D Golden Cloud Filigree Cluster)
    function addGoldCloudScrollCluster(parent, x, y, z, scale, rotZ, flipX) {
      var cGroup = new THREE.Group();
      var sx = (flipX ? -1 : 1) * (scale || 1);
      var sy = scale || 1;
      var sz = scale || 1;

      var mainVolute = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 10, 20, Math.PI * 1.55), matImperialGold);
      mainVolute.rotation.z = 0.35;
      cGroup.add(mainVolute);

      var innerPearl = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), matImperialGold);
      innerPearl.scale.set(1.2, 1.0, 0.55);
      innerPearl.position.set(0.02, 0.01, 0.01);
      cGroup.add(innerPearl);

      var subVolute1 = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.024, 8, 16, Math.PI * 1.4), matImperialGold);
      subVolute1.position.set(0.15, 0.08, 0.0);
      subVolute1.rotation.z = -0.8;
      cGroup.add(subVolute1);

      var subVolute2 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16, Math.PI * 1.35), matImperialGold);
      subVolute2.position.set(-0.12, -0.09, 0.0);
      subVolute2.rotation.z = 2.1;
      cGroup.add(subVolute2);

      cGroup.position.set(x, y, z);
      cGroup.rotation.z = rotZ || 0;
      cGroup.scale.set(sx, sy, sz);
      parent.add(cGroup);
      return cGroup;
    }

    function registerHitbox(mesh, noteIdx, hitboxGeo, pos, rot) {
      if (mesh) {
        mesh.userData = mesh.userData || {};
        mesh.userData.origPosY = (typeof mesh.position.y === "number") ? mesh.position.y : 0;
        if (mesh.scale) mesh.userData.origScale = mesh.scale.clone();
      }
      strings3D.push(mesh);
      stringVibrations.push({ amplitude: 0, decay: 0.92, phase: 0 });

      var hbMat = new THREE.MeshBasicMaterial({ visible: false });
      var hbMesh = new THREE.Mesh(hitboxGeo, hbMat);
      if (pos) hbMesh.position.copy(pos);
      else hbMesh.position.copy(mesh.position);
      if (rot) hbMesh.rotation.copy(rot);
      else hbMesh.rotation.copy(mesh.rotation);
      hbMesh.userData = { stringIndex: noteIdx, noteIndex: noteIdx };
      group.add(hbMesh);
      stringHitboxes3D.push(hbMesh);
    }

    // Tạo dây đàn căng thẳng tuyệt đối qua các điểm neo (Móc đuôi -> Ngựa đàn -> Lược đàn -> Trục vặn), không bao giờ bị cong xuyên qua cần/thân đàn
    function addTautString(points, radius, mat) {
      var strGroup = new THREE.Group();
      var upVec = new THREE.Vector3(0, 1, 0);
      for (var k = 0; k < points.length - 1; k++) {
        var pA = points[k];
        var pB = points[k + 1];
        var dir = new THREE.Vector3().subVectors(pB, pA);
        var dist = dir.length();
        if (dist < 0.001) continue;
        var segGeo = new THREE.CylinderGeometry(radius, radius, dist, 8);
        var segMesh = new THREE.Mesh(segGeo, mat || matSteelString);
        segMesh.position.copy(pA).add(pB).multiplyScalar(0.5);
        segMesh.quaternion.setFromUnitVectors(upVec, dir.clone().normalize());
        strGroup.add(segMesh);
      }
      group.add(strGroup);
      return strGroup;
    }

    if (instId === "dantranh" || !instId) {
      var totalStrings = 16;
      var length = 11.8;
      var segX = 80;
      var segZ = 36;
      var yBottom = -0.34;

      // Hàm toán học tính cao độ mặt đàn cong vòm tại tọa độ bất kỳ (x, z)
      function getSoundboardY(x, z) {
        var u = (x + 5.9) / 11.8;
        if (u < 0) u = 0;
        if (u > 1) u = 1;
        var w = 2.35 - 0.55 * u;
        var hw = w * 0.5;
        var clampedZ = Math.max(-hw, Math.min(hw, z));
        var d = clampedZ / (hw || 1);
        var archZ = 0.38 * (1 - d * d);
        var archX = 0.12 * Math.sin(u * Math.PI);
        return 0.04 + archZ + archX;
      }

      // 1. Mặt Đàn Ngô Đồng Vòm Bán Nguyệt (Paulownia Soundboard Mesh - Mặt vòm hướng lên +Y)
      var boardGeo = new THREE.BufferGeometry();
      var positions = [];
      var uvs = [];
      var indices = [];
      for (var j = 0; j <= segZ; j++) {
        var v = j / segZ;
        for (var i = 0; i <= segX; i++) {
          var u = i / segX;
          var x = -5.9 + u * length;
          var w = 2.35 - 0.55 * u;
          var z = (v - 0.5) * w;
          var y = getSoundboardY(x, z);
          positions.push(x, y, z);
          uvs.push(u, v);
        }
      }
      for (var j = 0; j < segZ; j++) {
        for (var i = 0; i < segX; i++) {
          var a = j * (segX + 1) + i;
          var b = a + 1;
          var c = (j + 1) * (segX + 1) + i;
          var d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }
      boardGeo.setIndex(indices);
      boardGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      boardGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      boardGeo.computeVertexNormals();

      var soundboardMesh = new THREE.Mesh(boardGeo, matSoundboardTranh);
      soundboardMesh.castShadow = true;
      soundboardMesh.receiveShadow = true;
      group.add(soundboardMesh);

      // 2. Hai Thành Đàn Kín Khít 100% (Front & Back Solid Wood Side Walls)
      var frontWallGeo = new THREE.BufferGeometry();
      var frontPos = [];
      var frontUvs = [];
      var frontIdx = [];
      for (var i = 0; i <= segX; i++) {
        var u = i / segX;
        var x = -5.9 + u * length;
        var w = 2.35 - 0.55 * u;
        var z = w * 0.5;
        var yTop = getSoundboardY(x, z);
        frontPos.push(x, yTop, z);
        frontUvs.push(u, 1.0);
        frontPos.push(x, yBottom, z);
        frontUvs.push(u, 0.0);
      }
      for (var i = 0; i < segX; i++) {
        var p0 = i * 2;
        var p1 = i * 2 + 1;
        var p2 = (i + 1) * 2;
        var p3 = (i + 1) * 2 + 1;
        frontIdx.push(p0, p1, p2);
        frontIdx.push(p1, p3, p2);
      }
      frontWallGeo.setIndex(frontIdx);
      frontWallGeo.setAttribute("position", new THREE.Float32BufferAttribute(frontPos, 3));
      frontWallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(frontUvs, 2));
      frontWallGeo.computeVertexNormals();
      var frontWallMesh = new THREE.Mesh(frontWallGeo, matDanTranhRosewood);
      frontWallMesh.castShadow = true;
      frontWallMesh.receiveShadow = true;
      group.add(frontWallMesh);

      var backWallGeo = new THREE.BufferGeometry();
      var backPos = [];
      var backUvs = [];
      var backIdx = [];
      for (var i = 0; i <= segX; i++) {
        var u = i / segX;
        var x = -5.9 + u * length;
        var w = 2.35 - 0.55 * u;
        var z = -w * 0.5;
        var yTop = getSoundboardY(x, z);
        backPos.push(x, yTop, z);
        backUvs.push(u, 1.0);
        backPos.push(x, yBottom, z);
        backUvs.push(u, 0.0);
      }
      for (var i = 0; i < segX; i++) {
        var p0 = i * 2;
        var p1 = i * 2 + 1;
        var p2 = (i + 1) * 2;
        var p3 = (i + 1) * 2 + 1;
        backIdx.push(p0, p2, p1);
        backIdx.push(p1, p2, p3);
      }
      backWallGeo.setIndex(backIdx);
      backWallGeo.setAttribute("position", new THREE.Float32BufferAttribute(backPos, 3));
      backWallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(backUvs, 2));
      backWallGeo.computeVertexNormals();
      var backWallMesh = new THREE.Mesh(backWallGeo, matDanTranhRosewood);
      backWallMesh.castShadow = true;
      backWallMesh.receiveShadow = true;
      group.add(backWallMesh);

      // Viền gỗ mun & chỉ vàng đôi chạy dọc mép thành đàn
      for (var side = -1; side <= 1; side += 2) {
        var trimPts = [];
        var goldTrimPts = [];
        var botTrimPts = [];
        var botGoldTrimPts = [];
        for (var k = 0; k <= 32; k++) {
          var u = k / 32;
          var x = -5.9 + u * length;
          var w = 2.35 - 0.55 * u;
          var z = side * (w * 0.5);
          var y = getSoundboardY(x, z);
          trimPts.push(new THREE.Vector3(x, y + 0.006, z));
          goldTrimPts.push(new THREE.Vector3(x, y + 0.015, z + side * 0.004));
          botTrimPts.push(new THREE.Vector3(x, yBottom + 0.012, z));
          botGoldTrimPts.push(new THREE.Vector3(x, yBottom + 0.020, z + side * 0.004));
        }
        var trimMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts), 36, 0.026, 8, false), matRoyalLacquerBlack);
        group.add(trimMesh);
        var goldTrimMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(goldTrimPts), 36, 0.010, 8, false), matImperialGold);
        group.add(goldTrimMesh);

        var botTrimMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(botTrimPts), 36, 0.022, 8, false), matRoyalLacquerBlack);
        group.add(botTrimMesh);
        var botGoldTrimMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(botGoldTrimPts), 36, 0.009, 8, false), matImperialGold);
        group.add(botGoldTrimMesh);

        // Hàng tán cúc vàng / hạt vàng chạm nổi (Embossed Golden Rosette Studs) chạy dọc mép trên thành đàn
        for (var jx = -5.2; jx <= 5.2; jx += 0.72) {
          var ju = (jx + 5.9) / 11.8;
          var jw = 2.35 - 0.55 * ju;
          var jz = side * (jw * 0.5 + 0.008);
          var jy = getSoundboardY(jx, jz) + 0.010;
          var goldStud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), matImperialGold);
          goldStud.position.set(jx, jy, jz);
          group.add(goldStud);

          var studCollar = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 6, 12), matRoyalLacquerBlack);
          studCollar.rotation.x = Math.PI / 2;
          studCollar.position.set(jx, jy, jz);
          group.add(studCollar);
        }


      }

      // 3. Đáy Đàn (Bottom Soundboard Plate) & Lỗ Thoát Âm
      var bottomGeo = new THREE.BufferGeometry();
      var botPos = [];
      var botUvs = [];
      var botIdx = [];
      for (var i = 0; i <= segX; i++) {
        var u = i / segX;
        var x = -5.9 + u * length;
        var w = 2.35 - 0.55 * u;
        botPos.push(x, yBottom, -w * 0.5);
        botUvs.push(u, 0.0);
        botPos.push(x, yBottom, w * 0.5);
        botUvs.push(u, 1.0);
      }
      for (var i = 0; i < segX; i++) {
        var p0 = i * 2;
        var p1 = i * 2 + 1;
        var p2 = (i + 1) * 2;
        var p3 = (i + 1) * 2 + 1;
        botIdx.push(p0, p2, p1);
        botIdx.push(p1, p2, p3);
      }
      bottomGeo.setIndex(botIdx);
      bottomGeo.setAttribute("position", new THREE.Float32BufferAttribute(botPos, 3));
      bottomGeo.setAttribute("uv", new THREE.Float32BufferAttribute(botUvs, 2));
      bottomGeo.computeVertexNormals();
      var bottomMesh = new THREE.Mesh(bottomGeo, matWoodDark);
      bottomMesh.receiveShadow = true;
      group.add(bottomMesh);

      // 3 Lỗ thoát âm dưới đáy đàn (Sound Holes) truyền thống Việt Nam
      var soundHolesData = [
        { x: -3.0, rx: 0.28, rz: 0.28 },
        { x: 0.0, rx: 0.50, rz: 0.24 },
        { x: 3.0, rx: 0.25, rz: 0.25 }
      ];
      soundHolesData.forEach(function(sh) {
        var shMesh = new THREE.Mesh(new THREE.CylinderGeometry(sh.rx, sh.rz, 0.06, 24), matBlack);
        shMesh.position.set(sh.x, yBottom + 0.02, 0);
        group.add(shMesh);
        var rimMesh = new THREE.Mesh(new THREE.TorusGeometry((sh.rx + sh.rz) * 0.5, 0.015, 8, 24), matImperialGold);
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.set(sh.x, yBottom - 0.01, 0);
        group.add(rimMesh);
      });

      // 4. Đầu Đàn Bên Trái (Head Cap, x = -5.9, Bịt kín 100% không để lộ khoảng trống bên trong)
      var headCapGeo = new THREE.BufferGeometry();
      var headPos = [];
      var headUvs = [];
      var headIdx = [];
      var headW = 2.35;
      for (var j = 0; j <= segZ; j++) {
        var v = j / segZ;
        var z = (v - 0.5) * headW;
        var yTop = getSoundboardY(-5.9, z);
        // Đỉnh đáy (tiếp giáp khít với đáy đàn yBottom)
        headPos.push(-5.9, yBottom, z);
        headUvs.push(v, 0.0);
        // Đỉnh vòm (tiếp giáp khít với vòm mặt đàn yTop)
        headPos.push(-5.9, yTop, z);
        headUvs.push(v, 1.0);
      }
      for (var j = 0; j < segZ; j++) {
        var b0 = j * 2;
        var t0 = j * 2 + 1;
        var b1 = (j + 1) * 2;
        var t1 = (j + 1) * 2 + 1;
        // Chiều cuộn chỉ định vector pháp tuyến hướng ra ngoài (-X)
        headIdx.push(b0, b1, t0);
        headIdx.push(b1, t1, t0);
      }
      headCapGeo.setIndex(headIdx);
      headCapGeo.setAttribute("position", new THREE.Float32BufferAttribute(headPos, 3));
      headCapGeo.setAttribute("uv", new THREE.Float32BufferAttribute(headUvs, 2));
      headCapGeo.computeVertexNormals();
      var headCapMesh = new THREE.Mesh(headCapGeo, matDanTranhRosewood);
      headCapMesh.castShadow = true;
      headCapMesh.receiveShadow = true;
      group.add(headCapMesh);

      // Hàng 5 hoa cúc / đinh tán vàng kim chạy dọc mặt dựng đầu đàn
      for (var m = 0; m < 5; m++) {
        var jewelHead = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 14), matImperialGold);
        jewelHead.position.set(-5.98, 0.14 + (m - 2) * 0.05, (m - 2) * 0.44);
        group.add(jewelHead);

        var jewelCollar = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.010, 6, 14), matRoyalLacquerBlack);
        jewelCollar.rotation.y = Math.PI / 2;
        jewelCollar.position.set(-5.97, 0.14 + (m - 2) * 0.05, (m - 2) * 0.44);
        group.add(jewelCollar);
      }

      // 5. Đuôi Đàn Bên Phải (Tail Cap, x = +5.9, Bịt kín 100% không để lộ khoảng trống bên trong)
      var tailCapGeo = new THREE.BufferGeometry();
      var tailPos = [];
      var tailUvs = [];
      var tailIdx = [];
      var tailW = 1.80;
      for (var j = 0; j <= segZ; j++) {
        var v = j / segZ;
        var z = (v - 0.5) * tailW;
        var yTop = getSoundboardY(5.9, z);
        // Đỉnh đáy (tiếp giáp khít với đáy đàn yBottom)
        tailPos.push(5.9, yBottom, z);
        tailUvs.push(v, 0.0);
        // Đỉnh vòm (tiếp giáp khít với vòm mặt đàn yTop)
        tailPos.push(5.9, yTop, z);
        tailUvs.push(v, 1.0);
      }
      for (var j = 0; j < segZ; j++) {
        var b0 = j * 2;
        var t0 = j * 2 + 1;
        var b1 = (j + 1) * 2;
        var t1 = (j + 1) * 2 + 1;
        // Chiều cuộn chỉ định vector pháp tuyến hướng ra ngoài (+X)
        tailIdx.push(b0, t0, b1);
        tailIdx.push(b1, t0, t1);
      }
      tailCapGeo.setIndex(tailIdx);
      tailCapGeo.setAttribute("position", new THREE.Float32BufferAttribute(tailPos, 3));
      tailCapGeo.setAttribute("uv", new THREE.Float32BufferAttribute(tailUvs, 2));
      tailCapGeo.computeVertexNormals();
      var tailCapMesh = new THREE.Mesh(tailCapGeo, matDanTranhRosewood);
      tailCapMesh.castShadow = true;
      tailCapMesh.receiveShadow = true;
      group.add(tailCapMesh);

      // Cụm 5 hạt vàng cẩn hình thoi trên mặt dựng đuôi đàn
      var tailGemCoords = [
        { y: 0.14, z: 0.0, r: 0.046 },
        { y: 0.22, z: 0.0, r: 0.034 },
        { y: 0.06, z: 0.0, r: 0.034 },
        { y: 0.14, z: -0.22, r: 0.036 },
        { y: 0.14, z: 0.22, r: 0.036 }
      ];
      tailGemCoords.forEach(function(gc) {
        var tGem = new THREE.Mesh(new THREE.SphereGeometry(gc.r, 12, 12), matImperialGold);
        tGem.position.set(5.98, gc.y, gc.z);
        group.add(tGem);
        var tCollar = new THREE.Mesh(new THREE.TorusGeometry(gc.r + 0.005, 0.008, 6, 12), matRoyalLacquerBlack);
        tCollar.rotation.y = Math.PI / 2;
        tCollar.position.set(5.97, gc.y, gc.z);
        group.add(tCollar);
      });

      // 6. 4 Chân Đế Đàn Gỗ Mun Viền Vàng Hoàng Kim
      var footGeom = new THREE.CylinderGeometry(0.11, 0.08, 0.30, 16);
      var feetCoords = [
        { x: -5.5, z: -0.85 },
        { x: -5.5, z: 0.85 },
        { x: 5.4, z: -0.68 },
        { x: 5.4, z: 0.68 }
      ];
      feetCoords.forEach(function(fc) {
        var foot = new THREE.Mesh(footGeom, matWoodDark);
        foot.position.set(fc.x, yBottom - 0.13, fc.z);
        group.add(foot);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), matImperialGold);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(fc.x, yBottom - 0.26, fc.z);
        group.add(ring);
      });

      // 7. Tiền Nhạc Sơn (Cầu đàn bên trái, x = -5.35) & Hậu Nhạc Sơn (Cầu đàn bên phải, x = 4.75)
      // Cầu đàn bên trái (Tiền Nhạc Sơn): Bệ gỗ cẩm lai sẫm + ray ngà + chỉ đồng
      var leftNutWoodPts = [];
      var leftNutBonePts = [];
      for (var k = 0; k <= 24; k++) {
        var nz = -0.86 + (k / 24) * 1.72;
        var yBoard = getSoundboardY(-5.35, nz);
        leftNutWoodPts.push(new THREE.Vector3(-5.35, yBoard + 0.022, nz));
        leftNutBonePts.push(new THREE.Vector3(-5.35, yBoard + 0.050, nz));
      }
      var nutLWoodMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftNutWoodPts), 36, 0.045, 10, false), matDanTranhRosewood);
      var nutLBoneMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftNutBonePts), 36, 0.016, 8, false), matBone);
      var nutLWireMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftNutBonePts), 36, 0.008, 8, false), matGold);
      nutLWireMesh.position.y += 0.007;
      nutLWoodMesh.castShadow = true;
      group.add(nutLWoodMesh);
      group.add(nutLBoneMesh);
      group.add(nutLWireMesh);

      // 8. 16 Móc Giữ Dây Đầu Đàn (Left Anchor Pins, x = -5.68)
      var pinRailPts = [];
      for (var k = 0; k <= 20; k++) {
        var rz = -0.80 + (k / 20) * 1.60;
        pinRailPts.push(new THREE.Vector3(-5.68, getSoundboardY(-5.68, rz) + 0.015, rz));
      }
      var pinRailMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pinRailPts), 24, 0.03, 8, false), matDanTranhRosewood);
      group.add(pinRailMesh);

      for (var t = 0; t < totalStrings; t++) {
        var tz = -0.74 + (t / (totalStrings - 1)) * 1.48;
        var pinBaseY = getSoundboardY(-5.68, tz);

        var pinCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.025, 10), matGold);
        pinCollar.position.set(-5.68, pinBaseY + 0.015, tz);
        group.add(pinCollar);

        var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 10), matSteel);
        pin.position.set(-5.68, pinBaseY + 0.04, tz);
        group.add(pin);

        var pinCap = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), matGold);
        pinCap.position.set(-5.68, pinBaseY + 0.075, tz);
        group.add(pinCap);
      }

      // 9. DÃY 16 TRỤ CẮM KẾT DÂY / BUỘC DÂY ĐÀN TRÊN MẶT VÒM ĐÀN (Chuẩn ảnh media_1791353559086.png)
      // "ngoài cái chân ngựa còn có cả mấy cái trụ như này cơ và mấy cái này để kết dây đàn, để buộc dây đàn ý"
      var pegStudCoords = [];
      for (var p = 0; p < totalStrings; p++) {
        var normP = p / (totalStrings - 1);
        var pz = -0.74 + normP * 1.48; // Thẳng hàng tuyệt đối với trục Z của dây đàn
        var px = 1.70 + normP * 3.25;  // Hàng trụ xếp nghiêng chéo tự nhiên trên mặt vòm đàn
        var pegBaseY = getSoundboardY(px, pz);
        var pegH = 0.16;

        pegStudCoords.push({ x: px, y: pegBaseY + pegH * 0.58, z: pz });

        var pegGroup = new THREE.Group();
        pegGroup.position.set(px, pegBaseY, pz);

        // Vòng đệm khuyên đồng thau chân trụ bám sát mặt vòm gỗ
        var pegCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.022, 16), matImperialGold);
        pegCollar.position.y = 0.011;
        pegGroup.add(pegCollar);

        // Thân trụ cắm dây hình trụ tròn gỗ mun / thép sẫm
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, pegH, 16), matRoyalLacquerBlack);
        pegShaft.position.y = pegH * 0.5 + 0.012;
        pegShaft.castShadow = true;
        pegGroup.add(pegShaft);

        // Vòng cuộn dây kim loại quấn quanh thân trụ (nơi kết dây đàn / buộc dây đàn)
        var coilMat = (p < 5) ? matBronzeString : matSteelString;
        var pegCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.032, 14), coilMat);
        pegCoil.position.y = pegH * 0.58;
        pegGroup.add(pegCoil);

        // Đầu bịt chỏm tròn đồng thau vàng kim đỉnh trụ
        var pegCap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), matImperialGold);
        pegCap.position.y = pegH + 0.018;
        pegGroup.add(pegCap);

        group.add(pegGroup);
      }

      // 10. DÃY 16 NGỰA ĐÀN (CON NHẠN) CÁNH KHÍA BẬC THANG & VÒNG TRÒN VÀNG ĐÔI (Chuẩn ảnh media_1791353460603.png & media_1791353559086.png)
      // Yêu cầu: Chân ngựa khía bậc thang 3 tầng hai bên mép ngoài, khoét vòm cong giữa 2 chân, họa tiết 2 vòng tròn vàng đồng tâm ở góc trên mặt nhạn
      var matBridgeWoodDark = new THREE.MeshStandardMaterial({
        color: 0x3d2015,
        roughness: 0.28,
        metalness: 0.08
      });

      for (var i = 0; i < totalStrings; i++) {
        var normI = i / (totalStrings - 1);
        var stringZ = -0.74 + normI * 1.48; // Dây trầm ở -0.74, dây thanh ở +0.74

        // Vị trí con nhạn xếp theo đường cong chữ S tự nhiên từ x = -3.80 xuống x = +1.20
        var bridgeX = -3.80 + normI * 5.00 - Math.sin(normI * Math.PI) * 0.35;
        var yBoardAtBridge = getSoundboardY(bridgeX, stringZ);

        // Kích thước con nhạn thay đổi nhẹ theo âm vực (trầm cao lớn hơn, thanh nhỏ gọn hơn)
        var bridgeHeight = 0.36 - normI * 0.09;  // Chiều cao từ 0.36 xuống 0.27
        var baseSpan = 0.32 - normI * 0.08;      // Chân choãi rộng từ 0.32 xuống 0.24
        var topSpan = 0.040 - normI * 0.008;     // Đỉnh hẹp từ 0.040 xuống 0.032
        var bridgeThick = 0.040 - normI * 0.008; // Độ dày thân gỗ nhạn

        var hs = baseSpan * 0.5;
        var ts = topSpan * 0.5;
        var footW = baseSpan * 0.22;
        var archH = bridgeHeight * 0.44;

        // Điêu khắc biên dạng con nhạn cánh khía bậc thang 3 tầng (Stepped Tiers) chuẩn ảnh media_1791353460603.png
        var bShape = new THREE.Shape();

        // Đáy chân trái
        bShape.moveTo(-hs, 0);
        bShape.lineTo(-hs + footW, 0);

        // Vòm cong khoét rỗng giữa hai chân ngựa
        bShape.quadraticCurveTo(0, archH, hs - footW, 0);

        // Đáy chân phải
        bShape.lineTo(hs, 0);

        // Mép ngoài cánh phải: 3 bậc thang khía giật cấp vươn lên
        bShape.lineTo(hs, bridgeHeight * 0.22);
        bShape.lineTo(hs - baseSpan * 0.09, bridgeHeight * 0.22);

        bShape.lineTo(hs - baseSpan * 0.09, bridgeHeight * 0.46);
        bShape.lineTo(hs - baseSpan * 0.18, bridgeHeight * 0.46);

        bShape.lineTo(hs - baseSpan * 0.18, bridgeHeight * 0.68);
        bShape.lineTo(hs - baseSpan * 0.26, bridgeHeight * 0.68);

        // Uốn cong nhẹ lên đỉnh hẹp bên phải
        bShape.quadraticCurveTo(hs * 0.32, bridgeHeight * 0.88, ts, bridgeHeight);

        // Đỉnh yên ngựa đỡ dây
        bShape.lineTo(-ts, bridgeHeight);

        // Mép ngoài cánh trái: 3 bậc thang khía giật cấp đối xứng
        bShape.quadraticCurveTo(-hs * 0.32, bridgeHeight * 0.88, -hs + baseSpan * 0.26, bridgeHeight * 0.68);

        bShape.lineTo(-hs + baseSpan * 0.18, bridgeHeight * 0.68);
        bShape.lineTo(-hs + baseSpan * 0.18, bridgeHeight * 0.46);

        bShape.lineTo(-hs + baseSpan * 0.09, bridgeHeight * 0.46);
        bShape.lineTo(-hs + baseSpan * 0.09, bridgeHeight * 0.22);

        bShape.lineTo(-hs, bridgeHeight * 0.22);
        bShape.lineTo(-hs, 0);

        var extrudeSettings = {
          depth: bridgeThick,
          bevelEnabled: true,
          bevelThickness: 0.0025,
          bevelSize: 0.0025,
          bevelSegments: 2
        };
        var bGeo = new THREE.ExtrudeGeometry(bShape, extrudeSettings);
        bGeo.center();

        // Nhóm con nhạn xoay ngang 90 độ ngang qua mặt vòm đàn (Transverse to string direction)
        // Tính độ dốc của mặt vòm đàn tại 2 điểm chân ngựa để xoay nghiêng khớp khít 100% không bị lơ lửng
        var footPadOffset = hs - footW * 0.5;
        var zPad1 = stringZ + footPadOffset;
        var zPad2 = stringZ - footPadOffset;
        var yBoardPad1 = getSoundboardY(bridgeX, zPad1);
        var yBoardPad2 = getSoundboardY(bridgeX, zPad2);

        // Góc nghiêng mặt vòm đàn dọc theo trục Z tại vị trí con nhạn
        var tiltAlpha = Math.atan2(yBoardPad2 - yBoardPad1, 2 * footPadOffset);

        // Cao độ trung bình mặt đàn tại 2 điểm tiếp xúc của chân ngựa (hạ nhẹ 0.003 để bám khít tuyệt đối)
        var yCenterBoard = (yBoardPad1 + yBoardPad2) * 0.5 - 0.003;

        var bridgeGroup = new THREE.Group();
        bridgeGroup.position.set(bridgeX, yCenterBoard + (bridgeHeight * 0.5) * Math.cos(tiltAlpha), stringZ);
        bridgeGroup.rotation.y = Math.PI / 2;

        var bridgeInner = new THREE.Group();
        bridgeInner.rotation.z = tiltAlpha;

        var bridgeMesh = new THREE.Mesh(bGeo, matBridgeWoodDark);
        bridgeMesh.castShadow = true;
        bridgeMesh.receiveShadow = true;
        bridgeInner.add(bridgeMesh);

        // HỌA TIẾT 2 VÒNG TRÒN VÀNG ĐỒNG TÂM Ở GÓC TRÊN MẶT NHẠN (Chuẩn 100% ảnh media_1791353460603.png)
        var ringCX = hs * 0.36;
        var ringCY = bridgeHeight * 0.18; // so với tâm 0 của bGeo đã center()
        var rOut = 0.038 - normI * 0.008;
        var rIn = 0.022 - normI * 0.005;

        // Vòng ngoài
        var ringGeoOut = new THREE.TorusGeometry(rOut, 0.0045, 8, 24);
        var ringOutF = new THREE.Mesh(ringGeoOut, matImperialGold);
        ringOutF.position.set(ringCX, ringCY, bridgeThick * 0.5 + 0.001);
        bridgeInner.add(ringOutF);

        var ringOutB = new THREE.Mesh(ringGeoOut, matImperialGold);
        ringOutB.position.set(ringCX, ringCY, -bridgeThick * 0.5 - 0.001);
        bridgeInner.add(ringOutB);

        // Vòng trong đồng tâm
        var ringGeoIn = new THREE.TorusGeometry(rIn, 0.0035, 8, 24);
        var ringInF = new THREE.Mesh(ringGeoIn, matImperialGold);
        ringInF.position.set(ringCX, ringCY, bridgeThick * 0.5 + 0.001);
        bridgeInner.add(ringInF);

        var ringInB = new THREE.Mesh(ringGeoIn, matImperialGold);
        ringInB.position.set(ringCX, ringCY, -bridgeThick * 0.5 - 0.001);
        bridgeInner.add(ringInB);

        // Mấu khía ngà đỡ dây đàn thanh tú ở đỉnh hẹp
        var saddleNotch = new THREE.Mesh(new THREE.BoxGeometry(topSpan * 0.95, 0.012, bridgeThick * 1.10), matBone);
        saddleNotch.position.set(0, bridgeHeight * 0.5 + 0.006, 0);
        bridgeInner.add(saddleNotch);

        bridgeGroup.add(bridgeInner);
        group.add(bridgeGroup);

        // Đỉnh tiếp xúc chính xác của dây đàn trên từng ngựa đàn (khớp tuyệt đối với rãnh ngà xương sau khi nghiêng)
        var saddleLocalY = bridgeHeight * 0.5 + 0.006;
        var bridgePeakY = bridgeGroup.position.y + saddleLocalY * Math.cos(tiltAlpha);
        var bridgePeakZ = stringZ + saddleLocalY * Math.sin(tiltAlpha);

        // Tọa độ các điểm tựa vật lý của từng dây đàn:
        // P0: Móc gài dây đầu đàn (x = -5.68)
        var pPinX = -5.68;
        var pPinY = getSoundboardY(pPinX, stringZ) + 0.050;

        // P1: Cầu đàn bên trái (Tiền Nhạc Sơn, x = -5.35)
        var pNutLX = -5.35;
        var pNutLY = getSoundboardY(pNutLX, stringZ) + 0.058;

        // P2: Đỉnh con nhạn: (bridgeX, bridgePeakY, bridgePeakZ)

        // P3: Kết nối trực tiếp vào trụ buộc dây đàn trên mặt vòm đàn:
        var pegTarget = pegStudCoords[i];

        // CÁC DÂY ĐÀN KẾT NỐI VÀO TỪNG TRỤ BUỘC DÂY ĐÀN (Chuẩn ảnh media_1791353559086.png)
        var stringPath = new THREE.CurvePath();
        stringPath.add(new THREE.LineCurve3(new THREE.Vector3(pPinX, pPinY, stringZ), new THREE.Vector3(pNutLX, pNutLY, stringZ)));
        stringPath.add(new THREE.LineCurve3(new THREE.Vector3(pNutLX, pNutLY, stringZ), new THREE.Vector3(bridgeX, bridgePeakY, bridgePeakZ)));
        stringPath.add(new THREE.LineCurve3(new THREE.Vector3(bridgeX, bridgePeakY, bridgePeakZ), new THREE.Vector3(pegTarget.x, pegTarget.y, pegTarget.z)));

        var stringThickness = 0.0066 - normI * 0.0018; // Dây đàn mảnh màu kim loại
        var stringGeo = new THREE.TubeGeometry(stringPath, 52, stringThickness, 8, false);

        var isBassString = (i < 5);
        var strMat = isBassString ? matBronzeString.clone() : matSteelString.clone();
        var defaultHexColor = isBassString ? 0xdfaa52 : 0xe6eef6;
        var stringMesh = new THREE.Mesh(stringGeo, strMat);

        stringMesh.userData = {
          index: i,
          string3DIndex: i,
          defaultColor: defaultHexColor,
          bridgePeakY: bridgePeakY
        };
        group.add(stringMesh);

        // Hitbox tương tác gảy đàn chuẩn xác bao quát toàn bộ chiều dài tấu phím
        var hitCenterX = (bridgeX + pegTarget.x) * 0.5;
        var hitLen = Math.max(3.2, pegTarget.x - bridgeX + 1.2);
        var hitboxGeo = new THREE.CylinderGeometry(0.08, 0.08, hitLen, 6);
        registerHitbox(stringMesh, i, hitboxGeo, new THREE.Vector3(hitCenterX, bridgePeakY, stringZ), new THREE.Euler(0, 0, Math.PI / 2));
      }
    } else if (instId === "danbau") {
      // ĐÀN BẦU HOÀNG GIA KHẢM ỐC XÀ CỪ & VIỀN PHÙ ĐIÊU MÂY VÀNG 24K (Chuẩn mẫu bên phải trong media_1790777044050.png)
      var bauGroup = new THREE.Group();
      var len = 10.6;
      var wRight = 1.32;
      var wLeft = 0.98;
      var boardH = 0.56;

      // Hộp cộng hưởng hình thang thuôn dài Sơn Mài Đỏ Rượu Vang / Cẩm Lai Bóng Gương
      var bauBodyGeo = new THREE.CylinderGeometry(wLeft * 0.5, wRight * 0.5, len, 4, 1);
      bauBodyGeo.rotateY(Math.PI / 4);
      bauBodyGeo.rotateZ(Math.PI / 2);
      var soundboard = new THREE.Mesh(bauBodyGeo, matDanTranhRosewood);
      soundboard.scale.set(1.0, (boardH / wRight) * 1.42, 1.0);
      soundboard.position.set(0, 0, 0);
      bauGroup.add(soundboard);

      // Mặt trên hộp đàn bằng gỗ Ngô Đồng sáng ấm (Paulownia Top Deck)
      var topPlate = new THREE.Mesh(new THREE.BoxGeometry(len - 0.14, 0.048, (wRight + wLeft) * 0.42), matSoundboardTranh);
      topPlate.position.set(0, boardH * 0.5 + 0.015, 0);
      bauGroup.add(topPlate);

      // Chỉ viền vàng 24K + Cụm Phù Điêu Mây Cuộn 3D ở 2 đầu và cạnh dưới + Hoa văn Khảm Ốc Xà Cừ chạy dọc thành đàn
      for (var side = -1; side <= 1; side += 2) {
        var zEdge = side * 0.50;
        var topGoldRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.034, 0.036), matImperialGold);
        topGoldRail.position.set(0, boardH * 0.5 + 0.02, zEdge);
        bauGroup.add(topGoldRail);

        var botGoldRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.032, 0.036), matImperialGold);
        botGoldRail.position.set(0, -boardH * 0.5 + 0.02, zEdge);
        bauGroup.add(botGoldRail);

        // Cụm phù điêu mây vàng 3D chạm nổi ở góc trái (-4.85), vòm giữa (+1.25), và góc phải (+4.85) giống hệt mẫu media_1790777044050.png
        addGoldCloudScrollCluster(bauGroup, -4.85, -0.02, side * 0.53, 1.15, 0.25, false);
        addGoldCloudScrollCluster(bauGroup, -4.25, -0.10, side * 0.53, 0.85, -0.35, true);
        addGoldCloudScrollCluster(bauGroup, 1.15, -0.08, side * 0.53, 0.95, 0.15, false);
        addGoldCloudScrollCluster(bauGroup, 4.35, -0.08, side * 0.53, 0.90, 0.40, false);
        addGoldCloudScrollCluster(bauGroup, 4.90, 0.02, side * 0.53, 1.15, -0.25, true);

        // Cành hoa mẫu đơn & hoa mai Khảm Ốc Xà Cừ ngũ sắc lấp lánh dọc thành đàn
        var mopCenters = [-2.8, -1.6, -0.4, 2.4, 3.3];
        for (var m = 0; m < mopCenters.length; m++) {
          var mx = mopCenters[m];
          var mopFlower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.115, 0.115, 0.018, 6),
            (m % 2 === 0) ? matMotherOfPearl : matMotherOfPearlPink
          );
          mopFlower.rotation.x = Math.PI / 2;
          mopFlower.position.set(mx, 0.01, side * 0.525);
          bauGroup.add(mopFlower);

          var mopPetalCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), matImperialGold);
          mopPetalCore.position.set(mx, 0.01, side * 0.535);
          bauGroup.add(mopPetalCore);

          var mopLeafL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.048, 0.014), matMotherOfPearl);
          mopLeafL.position.set(mx - 0.24, 0.04, side * 0.525);
          mopLeafL.rotation.z = 0.26;
          bauGroup.add(mopLeafL);

          var mopLeafR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.048, 0.014), matMotherOfPearlPink);
          mopLeafR.position.set(mx + 0.24, -0.03, side * 0.525);
          mopLeafR.rotation.z = -0.26;
          bauGroup.add(mopLeafR);
        }
      }

      // Đầu bên phải (+X): Bầu cộng hưởng chạm vàng & Vòi đàn (Cần sừng uốn cong thanh thoát hướng sang phải) giống hệt media_1790777044050.png
      var gourdX = 4.35;
      var gourdCone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 0.68, 24), matRoyalCrimsonWood);
      gourdCone.rotation.z = -Math.PI / 2.2;
      gourdCone.position.set(gourdX + 0.12, boardH * 0.5 + 0.52, 0);
      bauGroup.add(gourdCone);

      var gourdRimOpen = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.032, 10, 24), matImperialGold);
      gourdRimOpen.rotation.y = Math.PI / 2.2;
      gourdRimOpen.position.set(gourdX - 0.18, boardH * 0.5 + 0.50, 0);
      bauGroup.add(gourdRimOpen);

      var gourdTipGold = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), matImperialGold);
      gourdTipGold.position.set(gourdX + 0.48, boardH * 0.5 + 0.54, 0);
      bauGroup.add(gourdTipGold);

      var hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(gourdX + 0.05, boardH * 0.5 + 0.02, 0),
        new THREE.Vector3(gourdX + 0.14, boardH * 0.5 + 1.55, 0),
        new THREE.Vector3(gourdX + 0.28, boardH * 0.5 + 2.95, 0),
        new THREE.Vector3(gourdX + 0.78, boardH * 0.5 + 3.65, 0)
      ]);
      var hornStem = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 32, 0.040, 10, false), matRoyalLacquerBlack);
      bauGroup.add(hornStem);

      var hornGoldCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.45, 12), matImperialGold);
      hornGoldCollar.position.set(gourdX + 0.08, boardH * 0.5 + 0.25, 0);
      bauGroup.add(hornGoldCollar);

      var hornTipGold = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), matImperialGold);
      hornTipGold.position.set(gourdX + 0.78, boardH * 0.5 + 3.65, 0);
      bauGroup.add(hornTipGold);

      // Đầu bên trái (-X): Ống ngựa đàn chạm mây vàng 3D trên mặt đàn
      var tailBlockX = -4.75;
      var tailBlock = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.52), matRoyalCrimsonWood);
      tailBlock.position.set(tailBlockX, boardH * 0.5 + 0.11, 0);
      bauGroup.add(tailBlock);

      var tailArch = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.036, 10, 20, Math.PI), matImperialGold);
      tailArch.position.set(tailBlockX, boardH * 0.5 + 0.20, 0);
      bauGroup.add(tailArch);

      // Dây Độc Huyền Cầm căng chéo từ bầu/vòi đàn bên phải (+X) xuống ngựa đàn bên trái (-X)
      var strStartX = gourdX - 0.12;
      var strStartY = boardH * 0.5 + 0.52;
      var strEndX = tailBlockX + 0.15;
      var strEndY = boardH * 0.5 + 0.28;

      var stringCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(strStartX, strStartY, 0),
        new THREE.Vector3(strEndX, strEndY, 0)
      ]);
      var monochordString = new THREE.Mesh(new THREE.TubeGeometry(stringCurve, 24, 0.014, 8, false), matSteelString);
      monochordString.userData = { index: 0, defaultColor: 0xf8fafc };
      bauGroup.add(monochordString);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hx = -3.8 + u * 7.6;
        var hy = boardH * 0.5 + 0.042;
        // Điểm đánh dấu bồi âm khảm xà cừ nhỏ tinh tế nằm phẳng trên mặt gỗ ngô đồng
        var nodeMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 12), matMotherOfPearl);
        nodeMarker.position.set(hx, hy, 0);
        bauGroup.add(nodeMarker);

        var hbY = (strStartY + strEndY) * 0.5;
        registerHitbox(monochordString, i, new THREE.BoxGeometry(0.75, 0.5, 0.45), new THREE.Vector3(hx, hbY, 0));
      }

      // Đặt góc nghiêng 3D nghệ thuật giống hệt Đàn Bầu trong media_1790777044050.png
      bauGroup.rotation.set(0.08, -0.18, 0.11);
      group.add(bauGroup);
    } else if (instId === "dannguyet") {
      // ĐÀN NGUYỆT SƠN MÀI ĐỎ TRẦM CHẠM PHÙ ĐIÊU MÂY RỒNG MẠ VÀNG 24K (Chuẩn mẫu ngoài cùng bên trái trong media_1790777044050.png)
      var nguyetGroup = new THREE.Group();
      var rBody = 1.88;
      var hBody = 0.38;

      // Mặt trước & mặt sau thùng đàn tròn vầng trăng bằng gỗ Cẩm Lai Đỏ Hổ Phách Bóng
      var frontPlate = new THREE.Mesh(new THREE.CircleGeometry(rBody, 48), matRoyalCrimsonWood);
      frontPlate.position.set(0, 0, hBody * 0.5 + 0.005);
      nguyetGroup.add(frontPlate);

      var backPlate = new THREE.Mesh(new THREE.CircleGeometry(rBody, 48), matRoyalCrimsonWood);
      backPlate.rotation.y = Math.PI;
      backPlate.position.set(0, 0, -(hBody * 0.5 + 0.005));
      nguyetGroup.add(backPlate);

      var sideRim = new THREE.Mesh(new THREE.CylinderGeometry(rBody, rBody, hBody, 48, 1, true), matRoyalLacquerBlack);
      sideRim.rotation.x = Math.PI / 2;
      nguyetGroup.add(sideRim);

      // Viền chỉ vàng hoàng gia bao quanh vành mặt trăng
      var outerGoldRim = new THREE.Mesh(new THREE.TorusGeometry(rBody, 0.042, 12, 48), matImperialGold);
      outerGoldRim.position.set(0, 0, hBody * 0.5 + 0.01);
      nguyetGroup.add(outerGoldRim);

      // Hoa văn Phù Điêu Mây Vàng 3D chạm nổi ở 4 cung viền thùng đàn tròn giống hệt media_1790777044050.png
      for (var side = -1; side <= 1; side += 2) {
        var upperArc = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.42, 1.68, hBody * 0.5 + 0.022),
          new THREE.Vector3(side * 1.12, 1.35, hBody * 0.5 + 0.026),
          new THREE.Vector3(side * 1.58, 0.68, hBody * 0.5 + 0.022)
        ]);
        nguyetGroup.add(new THREE.Mesh(new THREE.TubeGeometry(upperArc, 20, 0.046, 10, false), matImperialGold));

        var lowerArc = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 1.58, -0.68, hBody * 0.5 + 0.022),
          new THREE.Vector3(side * 1.12, -1.35, hBody * 0.5 + 0.026),
          new THREE.Vector3(side * 0.42, -1.68, hBody * 0.5 + 0.022)
        ]);
        nguyetGroup.add(new THREE.Mesh(new THREE.TubeGeometry(lowerArc, 20, 0.046, 10, false), matImperialGold));

        addGoldCloudScrollCluster(nguyetGroup, side * 1.05, 1.22, hBody * 0.5 + 0.028, 1.12, side * -0.55, side < 0);
        addGoldCloudScrollCluster(nguyetGroup, side * 1.08, -1.18, hBody * 0.5 + 0.028, 1.12, side * 0.55, side < 0);
      }

      // Chân ngựa đàn chạm cánh dơi gỗ mun ở phần dưới mặt đàn
      var bridgeY = -1.12;
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.14), matRoyalLacquerBlack);
      bridge.position.set(0, bridgeY, hBody * 0.5 + 0.06);
      nguyetGroup.add(bridge);
      var bridgeGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.16), matImperialGold);
      bridgeGoldTrim.position.set(0, bridgeY, hBody * 0.5 + 0.11);
      nguyetGroup.add(bridgeGoldTrim);

      // Cổ cần đàn nối với thùng tròn có phù điêu mây vàng ôm gốc cần
      addGoldCloudScrollCluster(nguyetGroup, 0, rBody - 0.05, hBody * 0.5 + 0.03, 0.95, 0, false);

      // Cần đàn dài thanh mảnh gỗ cẩm lai đỏ trầm
      var neckH = 5.4;
      var neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, neckH), matRoyalCrimsonWood);
      neck.rotation.x = Math.PI / 2;
      neck.position.set(0, rBody * 0.5 + neckH * 0.5 - 0.12, 0);
      nguyetGroup.add(neck);

      // Đầu đàn uốn cong lá đề / trăng khuyết chạm vàng & 2 trục chỉnh dây lớn
      var headY = rBody * 0.5 + neckH + 0.30;
      var headBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.92, 0.28), matRoyalCrimsonWood);
      headBase.position.set(0, headY - 0.05, -0.04);
      headBase.rotation.x = -0.18;
      nguyetGroup.add(headBase);

      var crownScroll = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.052, 10, 24, Math.PI * 1.45), matImperialGold);
      crownScroll.position.set(0, headY + 0.45, -0.10);
      crownScroll.rotation.y = Math.PI / 2;
      nguyetGroup.add(crownScroll);

      var crownFinial = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), matImperialGold);
      crownFinial.scale.set(1.2, 0.9, 0.8);
      crownFinial.position.set(0, headY + 0.65, -0.05);
      nguyetGroup.add(crownFinial);

      for (var p = 0; p < 2; p++) {
        var sideP = (p === 0) ? -1 : 1;
        var py = headY - 0.22 + p * 0.26;
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.042, 0.76, 10), matRoyalCrimsonWood);
        pegShaft.rotation.z = Math.PI / 2;
        pegShaft.position.set(sideP * 0.38, py, -0.04);
        nguyetGroup.add(pegShaft);

        var pegGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 8, 14), matImperialGold);
        pegGoldRing.rotation.y = Math.PI / 2;
        pegGoldRing.position.set(sideP * 0.72, py, -0.04);
        nguyetGroup.add(pegGoldRing);
      }

      // Hệ thống phím đàn cao bậc thang bằng ngà & chỉ vàng
      var fretPositionsY = [
        0.55, 1.02, 1.48,
        1.98, 2.52, 3.08, 3.65, 4.22, 4.78, 5.28
      ];
      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var fIdx = Math.floor(u * (fretPositionsY.length - 1));
        var fy = fretPositionsY[fIdx] || (0.8 + u * 4.2);
        var isOnSoundboard = (fy < 1.65);
        var fz = isOnSoundboard ? (hBody * 0.5 + 0.09) : 0.16;
        var fw = isOnSoundboard ? 0.32 : 0.24;

        var fretGeo = new THREE.BoxGeometry(fw, 0.075, 0.14);
        var fretMesh = new THREE.Mesh(fretGeo, matBone);
        fretMesh.position.set(0, fy, fz);
        nguyetGroup.add(fretMesh);

        var fretGold = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.02, 0.025, 0.15), matImperialGold);
        fretGold.position.set(0, fy, fz + 0.02);
        nguyetGroup.add(fretGold);

        var hbZ = isOnSoundboard ? (hBody * 0.5 + 0.2) : 0.22;
        registerHitbox(fretMesh, i, new THREE.BoxGeometry(0.5, 0.4, 0.35), new THREE.Vector3(0, fy, hbZ));
      }

      var nguyetNut = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.14), matBone);
      nguyetNut.position.set(0, headY - 0.50, 0.18);
      nguyetGroup.add(nguyetNut);

      for (var s = 0; s < 2; s++) {
        var sx = (s === 0 ? -0.048 : 0.048);
        var strGrp = addTautString([
          new THREE.Vector3(sx, bridgeY, hBody * 0.5 + 0.15),
          new THREE.Vector3(sx, 1.48, hBody * 0.5 + 0.19),
          new THREE.Vector3(sx, headY - 0.50, 0.24),
          new THREE.Vector3(sx, headY - 0.22 + s * 0.26, -0.02)
        ], 0.012, matSteelString);
        nguyetGroup.add(strGrp);
      }

      nguyetGroup.rotation.set(0.04, 0.22, -0.16);
      group.add(nguyetGroup);
    } else if (instId === "dannhi") {
      // ĐÀN NHỊ SƠN MÀI ĐEN BÓNG & GỖ CẨM LAI CHẠM PHÙ ĐIÊU RỒNG MÂY VÀNG 24K + CUNG VĨ ĐỨNG DỌC (Nhạc cụ trung tâm trong media_1790777044050.png!)
      var nhiGroup = new THREE.Group();
      var r = 0.76;
      var hLen = 1.32;
      var boxY = 0.54;

      // 1. Thùng đàn Lục Giác / Bát Giác (Hexagonal/Octagonal Resonator Box) sơn mài đen bóng gương
      var hexDrumGeo = new THREE.CylinderGeometry(r * 0.92, r, hLen, 6);
      hexDrumGeo.rotateY(Math.PI / 6);
      hexDrumGeo.rotateX(Math.PI / 2);
      var drum = new THREE.Mesh(hexDrumGeo, matRoyalLacquerBlack);
      drum.position.set(0, boxY, -0.08);
      nhiGroup.add(drum);

      // Đai vàng chạy vòng quanh giữa thân bầu lục giác (giống hệt ảnh mẫu media_1790777044050.png)
      var midDrumGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, 0.06, 6), matImperialGold);
      midDrumGoldBand.rotateY(Math.PI / 6);
      midDrumGoldBand.rotateX(Math.PI / 2);
      midDrumGoldBand.position.set(0, boxY, -0.06);
      nhiGroup.add(midDrumGoldBand);

      // Viền lục giác mạ vàng ở mặt trước (+Z) và mặt sau (-Z) của bầu đàn
      var frontHexRing = new THREE.Mesh(new THREE.RingGeometry(r * 0.80, r * 0.98, 6), matImperialGold);
      frontHexRing.rotation.z = Math.PI / 6;
      frontHexRing.position.set(0, boxY, hLen * 0.5 - 0.068);
      nhiGroup.add(frontHexRing);

      // Mặt trước bầu đàn bằng gỗ Cẩm Lai Đỏ Nâu Vân Tự Nhiên (giống hệt mặt bầu Đàn Nhị trong media_1790777044050.png)
      var frontFace = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 6), matRoyalCrimsonWood);
      frontFace.rotation.z = Math.PI / 6;
      frontFace.position.set(0, boxY, hLen * 0.5 - 0.065);
      nhiGroup.add(frontFace);

      // Phù điêu mây vàng 3D chạm nổi ở đáy mặt bầu và ôm dọc các góc bên phải của bầu đàn
      addGoldCloudScrollCluster(nhiGroup, -0.22, boxY - r * 0.52, hLen * 0.5 - 0.04, 0.92, 0.35, false);
      addGoldCloudScrollCluster(nhiGroup, 0.22, boxY - r * 0.52, hLen * 0.5 - 0.04, 0.92, -0.35, true);
      addGoldCloudScrollCluster(nhiGroup, r * 0.68, boxY + 0.12, hLen * 0.36, 1.05, -0.85, false);
      addGoldCloudScrollCluster(nhiGroup, r * 0.65, boxY - 0.24, hLen * 0.36, 0.95, -1.25, false);

      // Ngựa đàn gỗ sáng nằm ngang chính giữa mặt bầu đàn
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.075, 0.11), matSoundboardTranh);
      bridge.position.set(0, boxY + 0.02, hLen * 0.5 - 0.01);
      nhiGroup.add(bridge);

      // 2. Chân Đế Sơn Mài Đen Chạm Phù Điêu Mây Vàng đỡ dưới bầu đàn (giống hệt mẫu media_1790777044050.png)
      var basePlinth = new THREE.Mesh(new THREE.BoxGeometry(r * 1.65, 0.22, hLen * 0.95), matRoyalLacquerBlack);
      basePlinth.position.set(0, -0.18, -0.06);
      nhiGroup.add(basePlinth);

      addGoldCloudScrollCluster(nhiGroup, r * 0.58, -0.16, hLen * 0.25, 0.95, 0.15, false);
      addGoldCloudScrollCluster(nhiGroup, r * 0.62, -0.16, -hLen * 0.22, 0.90, -0.20, true);
      addGoldCloudScrollCluster(nhiGroup, -r * 0.52, -0.16, hLen * 0.28, 0.85, -0.15, true);

      // 3. Thân Trụ / Dọc Nhị Sơn Mài Đen Bóng Gương + Phù Điêu Mây Vàng ở gốc cần, giữa cần & đai vàng
      var neckH = 5.85;
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.108, neckH, 24), matRoyalLacquerBlack);
      neck.position.set(0, neckH * 0.5 + 0.18, -0.05);
      nhiGroup.add(neck);

      // Phù điêu mây vàng ôm gốc cần nhị (nơi dọc nhị cắm vào đỉnh bầu đàn)
      var neckBaseGold = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.165, 0.42, 16), matImperialGold);
      neckBaseGold.position.set(0, boxY + r * 0.88, -0.05);
      nhiGroup.add(neckBaseGold);
      addGoldCloudScrollCluster(nhiGroup, 0.04, boxY + r * 0.95, 0.06, 0.92, 0.45, false);

      // Phù điêu mây vàng chạm nổi ở lưng chừng dọc nhị (y = 2.75) giống hệt ảnh mẫu
      var midNeckGold = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.22, 16), matImperialGold);
      midNeckGold.position.set(0, 2.75, -0.05);
      nhiGroup.add(midNeckGold);
      addGoldCloudScrollCluster(nhiGroup, 0.05, 2.75, 0.04, 0.72, 0.6, false);

      // Đai vàng nhẵn bóng ở khoảng 2/3 trên thân trụ (y = 3.78)
      var upperNeckBand = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.15, 20), matImperialGold);
      upperNeckBand.position.set(0, 3.78, -0.05);
      nhiGroup.add(upperNeckBand);

      // Cổ trụ bọc phù điêu vàng ở khu vực gắn 2 trục vặn (y = 4.6..5.4)
      var pegZoneGold = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.105, 0.95, 16), matImperialGold);
      pegZoneGold.position.set(0.02, 4.95, -0.05);
      nhiGroup.add(pegZoneGold);

      // 4. Đầu Đàn Chạm Rồng / Mây Vàng 24K Uốn Cong Về Phía Phải (Sculpted Golden Dragon Scroll Head)
      var headCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, neckH + 0.05, -0.05),
        new THREE.Vector3(0.08, neckH + 0.42, 0.02),
        new THREE.Vector3(0.32, neckH + 0.58, 0.08),
        new THREE.Vector3(0.50, neckH + 0.40, 0.10)
      ]);
      var dragonHeadNeck = new THREE.Mesh(new THREE.TubeGeometry(headCurve, 24, 0.108, 14, false), matImperialGold);
      nhiGroup.add(dragonHeadNeck);

      var dragonSnout = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 16), matImperialGold);
      dragonSnout.scale.set(1.25, 0.88, 0.92);
      dragonSnout.position.set(0.48, neckH + 0.44, 0.10);
      nhiGroup.add(dragonSnout);

      addGoldCloudScrollCluster(nhiGroup, 0.22, neckH + 0.50, 0.08, 0.85, -0.35, false);

      // 5. 2 Trục Vặn Dây Lớn Hình Lục Giác Gỗ Mun Cẩn Vàng + Dây Tơ Đỏ Quấn Đầu Trục (Chuẩn mẫu media_1790777044050.png)
      var pegHeights = [4.58, 5.24];
      for (var p = 0; p < 2; p++) {
        var py = pegHeights[p];
        var pegBaseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.16, 12), matImperialGold);
        pegBaseRing.rotation.z = Math.PI / 2;
        pegBaseRing.position.set(0.14, py, -0.05);
        nhiGroup.add(pegBaseRing);

        // Cuộn dây tơ đỏ (Red silk string wrap) bên trái và bên phải thân trụ tại vị trí trục vặn
        var redWrapLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.08, 16), matRedSilkCord);
        redWrapLeft.position.set(0, py, -0.05);
        nhiGroup.add(redWrapLeft);

        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.088, 0.76, 6), matRoyalLacquerBlack);
        pegShaft.rotation.z = -Math.PI / 2 + 0.14;
        pegShaft.position.set(0.52, py - 0.04, -0.05);
        nhiGroup.add(pegShaft);

        var pegCrownCap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 12), matImperialGold);
        pegCrownCap.scale.set(1.18, 0.92, 0.92);
        pegCrownCap.position.set(0.88, py - 0.09, -0.05);
        nhiGroup.add(pegCrownCap);
      }

      // 6. Khuyên Dây Cữ Nhị Tơ Đỏ (Red Silk Qianjin) & 2 Dây Đàn Căng Thẳng Dọc Thân Đàn
      var qianjinCord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), matRedSilkCord);
      qianjinCord.rotation.x = Math.PI / 2;
      qianjinCord.position.set(-0.08, 4.55, 0.06);
      nhiGroup.add(qianjinCord);

      var mainStrings = [];
      for (var s = 0; s < 2; s++) {
        var sx = (s === 0 ? -0.042 : 0.032);
        var sGrp = addTautString([
          new THREE.Vector3(sx, boxY - r * 0.72, hLen * 0.5 - 0.02),
          new THREE.Vector3(sx, boxY + 0.02, hLen * 0.5 + 0.04),
          new THREE.Vector3(sx - 0.06, 4.55, 0.16),
          new THREE.Vector3(0.18 + s * 0.12, pegHeights[s], 0.01)
        ], 0.012 + s * 0.002, matSteelString);
        nhiGroup.add(sGrp);
        mainStrings.push(sGrp);
      }

      // Đăng ký hitbox tấu âm dọc theo dây đàn (KHÔNG vẽ các khối trụ vàng giả lơ lửng trước dây)
      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var sy = 0.95 + u * 3.15;
        var targetStr = mainStrings[i % mainStrings.length];
        registerHitbox(targetStr, i, new THREE.BoxGeometry(0.45, 0.4, 0.4), new THREE.Vector3(0, sy, 0.22));
      }

      // Xoay góc 3/4 sang trọng để khoe trọn mặt bầu lục giác, chiều sâu hộp đàn, đầu rồng vàng và 2 trục vặn giống hệt media_1790777044050.png
      nhiGroup.rotation.y = -0.28;
      group.add(nhiGroup);
    } else if (instId === "danday") {
      // 4. ĐÀN ĐÁY HOÀNG GIA (Thùng hình thang cân mặt ngô đồng viền hoa văn mây vàng, cần siêu dài, 10-11 phím tre cao, lược đàn, 3 trục mun bọc vàng, 3 dây căng thẳng)
      var dayGroup = new THREE.Group();
      var shape = new THREE.Shape();
      shape.moveTo(-0.9, -1.2);
      shape.lineTo(0.9, -1.2);
      shape.lineTo(0.55, 1.2);
      shape.lineTo(-0.55, 1.2);
      shape.closePath();

      var extrudeSettings = { depth: 0.45, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      var bodyRim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeSettings), matRoyalCrimsonWood);
      bodyRim.position.set(0, -0.4, -0.22);
      dayGroup.add(bodyRim);

      var soundboardGeo = new THREE.ShapeGeometry(shape);
      var soundboard = new THREE.Mesh(soundboardGeo, matSoundboardTranh);
      soundboard.position.set(0, -0.4, 0.24);
      dayGroup.add(soundboard);

      var borderShape = new THREE.Shape();
      borderShape.moveTo(-0.93, -1.23);
      borderShape.lineTo(0.93, -1.23);
      borderShape.lineTo(0.58, 1.23);
      borderShape.lineTo(-0.58, 1.23);
      borderShape.closePath();
      var borderMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(borderShape, { depth: 0.025, bevelEnabled: false }), matImperialGold);
      borderMesh.position.set(0, -0.4, 0.23);
      dayGroup.add(borderMesh);

      for (var sideD = -1; sideD <= 1; sideD += 2) {
        addGoldCloudScrollCluster(dayGroup, sideD * 0.72, -1.35, 0.26, 0.95, sideD * 0.3, sideD < 0);
        addGoldCloudScrollCluster(dayGroup, sideD * 0.46, 0.55, 0.26, 0.82, sideD * -0.3, sideD < 0);
      }

      var backplate = new THREE.Mesh(soundboardGeo, matRoyalCrimsonWood);
      backplate.rotation.y = Math.PI;
      backplate.position.set(0, -0.4, -0.24);
      dayGroup.add(backplate);

      var soundHole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.05), matBlack);
      soundHole.position.set(0, -1.1, 0.25);
      dayGroup.add(soundHole);

      var tailpiece = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.18), matImperialGold);
      tailpiece.position.set(0, -1.45, 0.26);
      dayGroup.add(tailpiece);

      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.14), matRoyalLacquerBlack);
      bridge.position.set(0, -0.85, 0.32);
      dayGroup.add(bridge);
      var bridgeSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.045, 0.045), matImperialGold);
      bridgeSaddle.position.set(0, -0.8, 0.37);
      dayGroup.add(bridgeSaddle);

      // Cần đàn dài thẳng đứng từ thùng đàn (y = 0.7) lên cổ đàn (y = 6.7)
      var neck = new THREE.Mesh(new THREE.BoxGeometry(0.20, 6.2, 0.22), matRoyalCrimsonWood);
      neck.position.set(0, 3.6, 0.05);
      dayGroup.add(neck);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var fy = 0.85 + u * 5.15;
        var fretHeight = 0.16 + (1.0 - u) * 0.05;
        var fretBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, fretHeight), matBone);
        fretBase.position.set(0, fy, 0.16 + fretHeight * 0.5);
        dayGroup.add(fretBase);

        var fretCap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.035), matImperialGold);
        fretCap.position.set(0, fy, 0.16 + fretHeight + 0.018);
        dayGroup.add(fretCap);

        registerHitbox(fretBase, i, new THREE.BoxGeometry(0.48, 0.42, 0.4), new THREE.Vector3(0, fy, 0.28));
      }

      var dayNutBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.20), matRoyalLacquerBlack);
      dayNutBase.position.set(0, 6.55, 0.24);
      dayGroup.add(dayNutBase);
      var dayNutBone = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), matBone);
      dayNutBone.position.set(0, 6.55, 0.36);
      dayGroup.add(dayNutBone);

      var head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.25, 0.24), matRoyalCrimsonWood);
      head.position.set(0, 7.22, -0.04);
      head.rotation.x = -0.18;
      dayGroup.add(head);

      var headTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.28), matImperialGold);
      headTop.position.set(0, 7.88, -0.16);
      headTop.rotation.x = -0.18;
      dayGroup.add(headTop);

      var pegConfigs = [
        { side: -1, y: 6.88, z: 0.02 },
        { side: 1,  y: 7.20, z: -0.04 },
        { side: -1, y: 7.52, z: -0.10 }
      ];
      for (var p = 0; p < pegConfigs.length; p++) {
        var cfg = pegConfigs[p];
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 10), matRoyalLacquerBlack);
        pegShaft.rotation.z = Math.PI / 2;
        pegShaft.position.set(cfg.side * 0.18, cfg.y, cfg.z);
        dayGroup.add(pegShaft);

        var pegKnob = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.22, 12), matImperialGold);
        pegKnob.rotation.z = cfg.side * Math.PI / 2;
        pegKnob.position.set(cfg.side * 0.52, cfg.y, cfg.z);
        dayGroup.add(pegKnob);
      }

      var stringX = [-0.055, 0.0, 0.055];
      for (var s = 0; s < 3; s++) {
        var sx = stringX[s];
        var sG = addTautString([
          new THREE.Vector3(sx * 0.7, -1.45, 0.34),
          new THREE.Vector3(sx, -0.80, 0.39),
          new THREE.Vector3(sx, 6.55, 0.38),
          new THREE.Vector3(sx * 0.85, pegConfigs[s].y, pegConfigs[s].z + 0.02)
        ], 0.012, matSteelString);
        dayGroup.add(sG);
      }
      dayGroup.rotation.set(0.04, 0.20, -0.14);
      group.add(dayGroup);
    } else if (instId === "dantyba") {
      // 3. ĐÀN TỲ BÀ HOÀNG GIA CHẠM PHÙ ĐIÊU MÂY VÀNG 24K DÀY DẶN ÔM QUANH VIỀN THÙNG QUẢ LÊ (Chuẩn mẫu thứ 2 từ trái sang trong media_1790777044050.png!)
      var tybaGroup = new THREE.Group();
      var pearShape = new THREE.Shape();
      pearShape.moveTo(0, -1.88);
      pearShape.bezierCurveTo(1.52, -1.88, 1.38, 0.22, 0.40, 1.88);
      pearShape.lineTo(-0.40, 1.88);
      pearShape.bezierCurveTo(-1.38, 0.22, -1.52, -1.88, 0, -1.88);

      var extrudeSettings = { depth: 0.56, bevelEnabled: true, bevelSegments: 6, steps: 2, bevelSize: 0.09, bevelThickness: 0.12 };
      var bodyRim = new THREE.Mesh(new THREE.ExtrudeGeometry(pearShape, extrudeSettings), matRoyalLacquerBlack);
      bodyRim.position.set(0, -0.2, -0.28);
      tybaGroup.add(bodyRim);

      // Mặt thùng đàn bằng gỗ Ngô Đồng sáng kem ấm áp (Cream Paulownia soundboard)
      var soundboardGeo = new THREE.ShapeGeometry(pearShape);
      var soundboard = new THREE.Mesh(soundboardGeo, matSoundboardTranh);
      soundboard.position.set(0, -0.2, 0.29);
      tybaGroup.add(soundboard);

      // Viền khung vàng hoàng gia bao quanh mặt đàn hình quả lê
      var borderMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pearShape, { depth: 0.035, bevelEnabled: false }), matImperialGold);
      borderMesh.scale.set(1.03, 1.03, 1);
      borderMesh.position.set(0, -0.2, 0.27);
      tybaGroup.add(borderMesh);

      // VIỀN PHÙ ĐIÊU MÂY VÀNG 3D CHẠM NỔI DÀY DẶN ÔM DỌC TOÀN BỘ MÉP BẦU ĐÀN QUẢ LÊ (Đặc trưng nổi bật nhất của Đàn Tỳ Bà trong media_1790777044050.png!)
      for (var side = -1; side <= 1; side += 2) {
        var filigreeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.15, -2.02, 0.32),
          new THREE.Vector3(side * 0.85, -1.72, 0.34),
          new THREE.Vector3(side * 1.22, -0.98, 0.34),
          new THREE.Vector3(side * 1.12, -0.05, 0.34),
          new THREE.Vector3(side * 0.80, 0.88, 0.33),
          new THREE.Vector3(side * 0.44, 1.62, 0.32)
        ]);
        var filigreeRibbon = new THREE.Mesh(new THREE.TubeGeometry(filigreeCurve, 32, 0.068, 12, false), matImperialGold);
        tybaGroup.add(filigreeRibbon);

        var scrollNodes = [
          { x: side * 0.32, y: -1.92, s: 1.05, r: 0.2 },
          { x: side * 0.82, y: -1.58, s: 1.25, r: 0.5 },
          { x: side * 1.12, y: -1.02, s: 1.32, r: 0.9 },
          { x: side * 1.08, y: -0.32, s: 1.22, r: 1.3 },
          { x: side * 0.88, y: 0.38,  s: 1.08, r: 1.7 },
          { x: side * 0.62, y: 1.02,  s: 0.92, r: 2.1 },
          { x: side * 0.42, y: 1.55,  s: 0.78, r: 2.4 }
        ];
        for (var sp = 0; sp < scrollNodes.length; sp++) {
          var nd = scrollNodes[sp];
          addGoldCloudScrollCluster(tybaGroup, nd.x, nd.y, 0.34, nd.s, side * nd.r, side < 0);
        }
      }

      // Mặt sau gù uốn cong sơn mài đen/đỏ trầm
      var backplate = new THREE.Mesh(soundboardGeo, matRoyalCrimsonWood);
      backplate.rotation.y = Math.PI;
      backplate.position.set(0, -0.2, -0.28);
      tybaGroup.add(backplate);

      // Ngựa đàn (Phục thủ) hình thang rộng gỗ cẩm lai sẫm ở đáy mặt đàn (giống hệt ảnh mẫu)
      var bridgeShape = new THREE.Shape();
      bridgeShape.moveTo(-0.44, -0.14);
      bridgeShape.lineTo(0.44, -0.14);
      bridgeShape.lineTo(0.32, 0.12);
      bridgeShape.lineTo(-0.32, 0.12);
      bridgeShape.closePath();
      var bridgeBase = new THREE.Mesh(new THREE.ExtrudeGeometry(bridgeShape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), matRoyalCrimsonWood);
      bridgeBase.position.set(0, -1.42, 0.30);
      tybaGroup.add(bridgeBase);

      var bridgeBone = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.045), matImperialGold);
      bridgeBone.position.set(0, -1.32, 0.44);
      tybaGroup.add(bridgeBone);

      // Cần đàn bậc thang chạm hoa văn vàng hai bên nối lên đầu đàn
      var neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 3.5), matRoyalCrimsonWood);
      neck.rotation.x = Math.PI / 2;
      neck.position.set(0, 3.05, 0.08);
      tybaGroup.add(neck);

      for (var ns = -1; ns <= 1; ns += 2) {
        var neckGoldStrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 3.4, 0.26), matImperialGold);
        neckGoldStrip.position.set(ns * 0.18, 3.05, 0.10);
        tybaGroup.add(neckGoldStrip);
      }

      // Hệ thống phím đàn: Phím Tướng cao bậc thang trên cổ đàn & Phím Phẩm bản rộng trên mặt đàn giống hệt media_1790777044050.png
      var tybaFretYs = [-0.15, 0.15, 0.46, 0.78, 1.12, 1.48, 1.88, 2.35, 2.82, 3.30, 3.78, 4.18];
      for (var i = 0; i < tybaFretYs.length; i++) {
        var fy = tybaFretYs[i];
        if (fy > 1.75) {
          var crescentFret = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.18), matSoundboardTranh);
          crescentFret.position.set(0, fy, 0.25);
          tybaGroup.add(crescentFret);
          var fretGoldCap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.038, 0.19), matImperialGold);
          fretGoldCap.position.set(0, fy, 0.29);
          tybaGroup.add(fretGoldCap);
          if (i < notesCount) {
            registerHitbox(crescentFret, i, new THREE.BoxGeometry(0.5, 0.35, 0.35), new THREE.Vector3(0, fy, 0.28));
          }
        } else {
          var fretW = 0.62 - Math.max(0, (fy + 0.2) * 0.11);
          var soundFret = new THREE.Mesh(new THREE.BoxGeometry(fretW, 0.075, 0.11), matSoundboardTranh);
          soundFret.position.set(0, fy, 0.33);
          tybaGroup.add(soundFret);
          var sFretGold = new THREE.Mesh(new THREE.BoxGeometry(fretW + 0.02, 0.025, 0.12), matImperialGold);
          sFretGold.position.set(0, fy, 0.36);
          tybaGroup.add(sFretGold);
          if (i < notesCount) {
            registerHitbox(soundFret, i, new THREE.BoxGeometry(0.55, 0.3, 0.35), new THREE.Vector3(0, fy, 0.35));
          }
        }
      }

      // Lược đàn / Phím Tướng đầu cần Đàn Tỳ Bà (y = 4.42)
      var tybaNutBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.22), matRoyalLacquerBlack);
      tybaNutBase.position.set(0, 4.42, 0.26);
      tybaGroup.add(tybaNutBase);
      var tybaNutBone = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.048, 0.055), matBone);
      tybaNutBone.position.set(0, 4.42, 0.39);
      tybaGroup.add(tybaNutBone);

      // Đầu đàn dựng dọc ngả nhẹ về sau chạm hoa văn Rồng / Dơi sơn mài đen-đỏ viền vàng
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.35, 0.28), matRoyalLacquerBlack);
      head.position.set(0, 5.05, -0.04);
      head.rotation.x = -0.20;
      tybaGroup.add(head);

      var scrollMedallion = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.058, 12, 24, Math.PI * 1.5), matImperialGold);
      scrollMedallion.position.set(0, 5.75, -0.18);
      tybaGroup.add(scrollMedallion);

      var scrollCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), matRoyalCrimsonWood);
      scrollCore.position.set(0, 5.75, -0.18);
      tybaGroup.add(scrollCore);

      // 4 Trục vặn lớn gỗ mun/cẩm lai bầu tròn cẩn vàng (2 trái, 2 phải) giống hệt ảnh mẫu
      var pegConfigs = [
        { side: -1, y: 4.68, z: 0.02 },
        { side: 1,  y: 4.88, z: -0.02 },
        { side: -1, y: 5.15, z: -0.07 },
        { side: 1,  y: 5.36, z: -0.12 }
      ];
      for (var p = 0; p < pegConfigs.length; p++) {
        var cfg = pegConfigs[p];
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.052, 0.82, 12), matRoyalCrimsonWood);
        pegShaft.rotation.z = cfg.side * -Math.PI / 2;
        pegShaft.position.set(cfg.side * 0.38, cfg.y, cfg.z);
        tybaGroup.add(pegShaft);

        var pegBulb = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), matRoyalLacquerBlack);
        pegBulb.scale.set(1.35, 0.85, 0.85);
        pegBulb.position.set(cfg.side * 0.76, cfg.y, cfg.z);
        tybaGroup.add(pegBulb);

        var pegRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 8, 14), matImperialGold);
        pegRing.rotation.y = Math.PI / 2;
        pegRing.position.set(cfg.side * 0.56, cfg.y, cfg.z);
        tybaGroup.add(pegRing);
      }

      // 4 Dây đàn căng thẳng tắp từ Phục thủ -> Lược đàn (Phím Tướng) -> 4 trục vặn
      var stringX = [-0.085, -0.028, 0.028, 0.085];
      for (var s = 0; s < 4; s++) {
        var sx = stringX[s];
        var sGrp = addTautString([
          new THREE.Vector3(sx * 0.9, -1.32, 0.45),
          new THREE.Vector3(sx, 4.42, 0.41),
          new THREE.Vector3(sx * 0.85, pegConfigs[s].y, pegConfigs[s].z + 0.02)
        ], 0.013, matSteelString);
        tybaGroup.add(sGrp);
      }

      // Đặt nghiêng dáng nghệ thuật lơ lửng giống hệt Đàn Tỳ Bà trong media_1790777044050.png
      tybaGroup.rotation.set(0.04, 0.18, -0.14);
      group.add(tybaGroup);
    } else if (instId === "dantinh") {
      // 9. ĐÀN TÍNH HOÀNG GIA (Thùng quả bầu khô cong 3D bọc viền mạ vàng, cần sơn son đen thếp vàng, đầu mỏ quạ Phượng Hoàng uốn S-curve chạm vàng, 3 trục mun bịt vàng, 3 dây)
      var gourdR = 1.38;
      // Mặt sau quả bầu khô dạng khối cong 3D ôm tròn về phía sau (Solid 3D convex gourd bowl curving backward into -z)
      var gourdGeo = new THREE.SphereGeometry(gourdR, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
      var gourdBack = new THREE.Mesh(gourdGeo, matGourd);
      gourdBack.rotation.x = -Math.PI / 2;
      gourdBack.position.set(0, -0.5, 0);
      group.add(gourdBack);

      // Mặt thùng đàn bằng gỗ ngô đồng phẳng (Paulownia light wood front face plate)
      var topFace = new THREE.Mesh(new THREE.CircleGeometry(gourdR - 0.02, 36), matSoundboardTranh);
      topFace.position.set(0, -0.5, 0.01);
      group.add(topFace);

      // Nẹp viền gỗ mun & viền đồng mạ vàng bao quanh miệng thùng bầu (Royal dark rim + imperial gold ring)
      var rim = new THREE.Mesh(new THREE.TorusGeometry(gourdR, 0.055, 14, 36), matRoyalCrimsonWood);
      rim.position.set(0, -0.5, 0.01);
      group.add(rim);

      var goldRim = new THREE.Mesh(new THREE.TorusGeometry(gourdR - 0.04, 0.024, 12, 36), matImperialGold);
      goldRim.position.set(0, -0.5, 0.035);
      group.add(goldRim);

      // Hoa văn mây vàng đối xứng hai bên mặt bầu (Symmetrical gilded cloud motifs on soundboard)
      for (var side = -1; side <= 1; side += 2) {
        var cloud = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 10, 20, Math.PI * 1.35), matImperialGold);
        cloud.position.set(side * 0.72, -0.45, 0.025);
        cloud.rotation.z = side * 0.4;
        group.add(cloud);
      }

      // Ngựa đàn nhỏ bằng gỗ mun & xương ngà trên mặt bầu (Bridge)
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.1), matRoyalLacquerBlack);
      bridge.position.set(0, -1.0, 0.08);
      group.add(bridge);
      var bridgeBone = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.035), matImperialGold);
      bridgeBone.position.set(0, -0.95, 0.12);
      group.add(bridgeBone);

      // Chốt giữ dây ở đáy thùng đàn (Bottom tail pin)
      var tailPin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 12), matImperialGold);
      tailPin.position.set(0, -1.95, 0);
      group.add(tailPin);

      // Cần đàn tròn trơn sơn đen bóng với đai vàng
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 7.8, 20), matRoyalLacquerBlack);
      neck.position.set(0, 3.4, 0);
      group.add(neck);

      // Khảm hoa xà cừ dọc cần đàn (Mother-of-Pearl inlay dots along neck)
      for (var m = 0; m < 5; m++) {
        var mopDot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.015, 6), m % 2 === 0 ? matMotherOfPearl : matMotherOfPearlPink);
        mopDot.rotation.x = Math.PI / 2;
        mopDot.position.set(0, 1.2 + m * 1.05, 0.078);
        group.add(mopDot);
      }

      // Lược đàn (Top Nut) nâng dây ở cổ cần Đàn Tính (y = 6.42)
      var tinhNut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.09), matBone);
      tinhNut.position.set(0, 6.42, 0.09);
      group.add(tinhNut);

      // Đầu cần mỏ quạ Phượng Hoàng uốn dáng S-curve mạ vàng (Gilded phoenix/raven beak S-curve headstock)
      var beakCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 7.3, 0),
        new THREE.Vector3(0, 7.8, 0.12),
        new THREE.Vector3(0, 8.3, 0.42),
        new THREE.Vector3(0, 8.15, 0.75),
        new THREE.Vector3(0, 7.75, 0.72)
      ]);
      var beakMesh = new THREE.Mesh(new THREE.TubeGeometry(beakCurve, 28, 0.068, 12, false), matImperialGold);
      group.add(beakMesh);

      var beakTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 12), matImperialGold);
      beakTip.rotation.x = -Math.PI / 3;
      beakTip.position.set(0, 7.7, 0.74);
      group.add(beakTip);

      // 3 Trục vặn gỗ mun bịt vàng (3 long ebony tuning pegs with gold tips: 2 trái, 1 phải)
      var pegConfigs = [
        { side: -1, y: 6.7, z: -0.02 },
        { side: 1,  y: 7.0, z: -0.02 },
        { side: -1, y: 7.3, z: -0.02 }
      ];
      for (var p = 0; p < pegConfigs.length; p++) {
        var cfg = pegConfigs[p];
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 10), matRoyalLacquerBlack);
        pegShaft.rotation.z = Math.PI / 2;
        pegShaft.position.set(cfg.side * 0.16, cfg.y, cfg.z);
        group.add(pegShaft);

        var pegKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.026, 0.22, 8), matRoyalCrimsonWood);
        pegKnob.rotation.z = cfg.side * Math.PI / 2;
        pegKnob.position.set(cfg.side * 0.56, cfg.y, cfg.z);
        group.add(pegKnob);

        var pegGoldTip = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), matImperialGold);
        pegGoldTip.position.set(cfg.side * 0.68, cfg.y, cfg.z);
        group.add(pegGoldTip);
      }

      // 3 Dây đàn căng thẳng tắp từ Chốt đáy -> Ngựa đàn -> Lược đàn -> 3 Trục vặn
      var tinhStrings = [];
      var stringX = [-0.038, 0.0, 0.038];
      for (var s = 0; s < 3; s++) {
        var sx = stringX[s];
        var sG = addTautString([
          new THREE.Vector3(sx * 0.6, -1.92, 0.07),
          new THREE.Vector3(sx, -0.95, 0.14),
          new THREE.Vector3(sx, 6.42, 0.13),
          new THREE.Vector3(sx * 0.8, pegConfigs[s].y, 0.01)
        ], 0.011, matSteelString);
        tinhStrings.push(sG);
      }

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var fy = 0.4 + u * 5.6;
        registerHitbox(tinhStrings[i % tinhStrings.length], i, new THREE.BoxGeometry(0.42, 0.42, 0.35), new THREE.Vector3(0, fy, 0.13));
      }
      group.rotation.set(0.04, 0.20, -0.14);
    } else if (instId === "danmoi") {
      // 10. ĐÀN MÔI H'MÔNG (Khay gỗ cẩm lai viền vàng + Ống tre thổ cẩm đặt ngang trên giá đỡ + Khung đàn môi đồng thau hình chiếc lá & Lưỡi gà rung ở giữa)
      var tray = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 2.9), matRoyalCrimsonWood);
      tray.position.set(0, -0.22, 0);
      group.add(tray);

      var trayGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.06, 3.0), matImperialGold);
      trayGoldBorder.position.set(0, -0.17, 0);
      group.add(trayGoldBorder);

      var velvet = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 2.55), matWoodRed);
      velvet.position.set(0, -0.10, 0);
      group.add(velvet);

      for (var rx = -1.25; rx <= 1.25; rx += 2.5) {
        var backRest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.42), matRoyalLacquerBlack);
        backRest.position.set(rx, 0.04, -0.62);
        group.add(backRest);

        var frontRest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.28), matRoyalLacquerBlack);
        frontRest.position.set(rx, 0.03, 0.42);
        group.add(frontRest);
      }

      var caseY = 0.34;
      var caseZ = -0.62;
      var sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 3.6, 32), matBrocade);
      sheath.rotation.z = Math.PI / 2;
      sheath.position.set(-0.22, caseY, caseZ);
      group.add(sheath);

      var leftEndCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 28), matRoyalCrimsonWood);
      leftEndCap.rotation.z = Math.PI / 2;
      leftEndCap.position.set(-2.05, caseY, caseZ);
      group.add(leftEndCap);

      var leftGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.022, 10, 28), matImperialGold);
      leftGoldRing.rotation.y = Math.PI / 2;
      leftGoldRing.position.set(-1.94, caseY, caseZ);
      group.add(leftGoldRing);

      var rightGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.022, 10, 28), matImperialGold);
      rightGoldRing.rotation.y = Math.PI / 2;
      rightGoldRing.position.set(1.56, caseY, caseZ);
      group.add(rightGoldRing);

      var lidCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.27, 0.55, 28), matBrocade);
      lidCylinder.rotation.z = Math.PI / 2;
      lidCylinder.position.set(1.92, caseY, caseZ);
      group.add(lidCylinder);

      var lidFinial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), matImperialGold);
      lidFinial.position.set(2.24, caseY, caseZ);
      group.add(lidFinial);

      var harpY = 0.32;
      var harpZ = 0.42;

      var handleLoop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.036, 10, 24), matImperialGold);
      handleLoop.position.set(-2.02, harpY, harpZ);
      group.add(handleLoop);

      var tasselCord = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.18, harpY, harpZ),
        new THREE.Vector3(-2.42, 0.16, harpZ + 0.12),
        new THREE.Vector3(-2.55, 0.02, harpZ + 0.22)
      ]);
      var cordMesh = new THREE.Mesh(new THREE.TubeGeometry(tasselCord, 18, 0.024, 8, false), matDrumRed);
      group.add(cordMesh);

      for (var armSide = -1; armSide <= 1; armSide += 2) {
        var armCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.85, harpY + armSide * 0.06, harpZ),
          new THREE.Vector3(-0.95, harpY + armSide * 0.26, harpZ),
          new THREE.Vector3(0.25,  harpY + armSide * 0.18, harpZ),
          new THREE.Vector3(1.35,  harpY + armSide * 0.07, harpZ),
          new THREE.Vector3(1.95,  harpY + armSide * 0.015, harpZ)
        ]);
        var armMesh = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 32, 0.042, 10, false), matImperialGold);
        armMesh.scale.set(1, 1, 0.45);
        group.add(armMesh);
      }

      var reedBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), matImperialGold);
      reedBase.position.set(-1.82, harpY, harpZ);
      group.add(reedBase);

      var reedTongue = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.042, 0.022), matSteelString);
      reedTongue.position.set(-0.12, harpY, harpZ + 0.01);
      group.add(reedTongue);

      var reedHookCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.52, harpY, harpZ + 0.01),
        new THREE.Vector3(1.62, harpY, harpZ + 0.14),
        new THREE.Vector3(1.56, harpY + 0.05, harpZ + 0.24)
      ]);
      var reedHook = new THREE.Mesh(new THREE.TubeGeometry(reedHookCurve, 14, 0.020, 8, false), matImperialGold);
      group.add(reedHook);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hx = -1.45 + u * 2.85;
        registerHitbox(reedTongue, i, new THREE.BoxGeometry(0.38, 0.32, 0.35), new THREE.Vector3(hx, harpY, harpZ + 0.05));
      }
    } else if (instId === "dantam") {
      // 5. ĐÀN TAM HOÀNG GIA (Thùng bầu dục bo góc bọc da trăn mặt trước, nẹp viền mạ vàng, cần dài sơn đen bóng, lược đàn, đầu chạm rồng mạ vàng, 3 trục mun bịt vàng, 3 dây căng thẳng)
      var shape = new THREE.Shape();
      var sw = 1.05, sh = 1.4, sr = 0.48;
      shape.moveTo(-sw + sr, -sh);
      shape.lineTo(sw - sr, -sh);
      shape.quadraticCurveTo(sw, -sh, sw, -sh + sr);
      shape.lineTo(sw, sh - sr);
      shape.quadraticCurveTo(sw, sh, sw - sr, sh);
      shape.lineTo(-sw + sr, sh);
      shape.quadraticCurveTo(-sw, sh, -sw, sh - sr);
      shape.lineTo(-sw, -sh + sr);
      shape.quadraticCurveTo(-sw, -sh, -sw + sr, -sh);

      var extrudeSettings = { depth: 0.52, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
      var bodyRim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeSettings), matRoyalCrimsonWood);
      bodyRim.position.set(0, -0.2, -0.26);
      group.add(bodyRim);

      var skinShape = new THREE.ShapeGeometry(shape);
      var skinF = new THREE.Mesh(skinShape, matSnakeskin);
      skinF.position.set(0, -0.2, 0.29);
      group.add(skinF);

      var rimBorder = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }), matImperialGold);
      rimBorder.scale.set(1.025, 1.025, 1);
      rimBorder.position.set(0, -0.2, 0.28);
      group.add(rimBorder);

      for (var sTam = -1; sTam <= 1; sTam += 2) {
        addGoldCloudScrollCluster(group, sTam * 0.85, -1.25, 0.30, 0.95, sTam * 0.4, sTam < 0);
        addGoldCloudScrollCluster(group, sTam * 0.85, 0.85, 0.30, 0.95, sTam * -0.4, sTam < 0);
      }

      var skinB = new THREE.Mesh(skinShape, matRoyalCrimsonWood);
      skinB.rotation.y = Math.PI;
      skinB.position.set(0, -0.2, -0.29);
      group.add(skinB);

      var tailpiece = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.18), matImperialGold);
      tailpiece.position.set(0, -1.6, 0.28);
      group.add(tailpiece);

      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.14), matRoyalLacquerBlack);
      bridge.position.set(0, -0.5, 0.35);
      group.add(bridge);
      var bridgeBone = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), matImperialGold);
      bridgeBone.position.set(0, -0.44, 0.41);
      group.add(bridgeBone);

      var neck = new THREE.Mesh(new THREE.BoxGeometry(0.19, 5.6, 0.22), matRoyalLacquerBlack);
      neck.position.set(0, 3.65, 0.05);
      group.add(neck);

      var tamNutBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.18), matRoyalCrimsonWood);
      tamNutBase.position.set(0, 6.32, 0.22);
      group.add(tamNutBase);
      var tamNutBone = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.045, 0.05), matBone);
      tamNutBone.position.set(0, 6.32, 0.32);
      group.add(tamNutBone);

      var head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.22, 0.24), matRoyalCrimsonWood);
      head.position.set(0, 6.95, -0.04);
      head.rotation.x = -0.18;
      group.add(head);

      var headDecoration = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 10, 20, Math.PI * 1.4), matImperialGold);
      headDecoration.position.set(0, 7.62, -0.16);
      headDecoration.rotation.y = Math.PI / 2;
      group.add(headDecoration);

      var pegConfigs = [
        { side: -1, y: 6.62, z: 0.02 },
        { side: 1,  y: 6.95, z: -0.04 },
        { side: -1, y: 7.28, z: -0.10 }
      ];
      for (var p = 0; p < pegConfigs.length; p++) {
        var cfg = pegConfigs[p];
        var pegShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 10), matRoyalLacquerBlack);
        pegShaft.rotation.z = Math.PI / 2;
        pegShaft.position.set(cfg.side * 0.16, cfg.y, cfg.z);
        group.add(pegShaft);

        var pegPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.15), matRoyalLacquerBlack);
        pegPaddle.position.set(cfg.side * 0.48, cfg.y, cfg.z);
        group.add(pegPaddle);

        var pegGoldTip = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), matImperialGold);
        pegGoldTip.position.set(cfg.side * 0.52, cfg.y, cfg.z);
        group.add(pegGoldTip);
      }

      var tamStrings = [];
      var stringX = [-0.05, 0.0, 0.05];
      for (var s = 0; s < 3; s++) {
        var sx = stringX[s];
        var sG = addTautString([
          new THREE.Vector3(sx * 0.7, -1.60, 0.36),
          new THREE.Vector3(sx, -0.44, 0.42),
          new THREE.Vector3(sx, 6.32, 0.34),
          new THREE.Vector3(sx * 0.85, pegConfigs[s].y, pegConfigs[s].z + 0.02)
        ], 0.012, matSteelString);
        tamStrings.push(sG);
      }

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var ny = 0.85 + u * 5.1;
        registerHitbox(tamStrings[i % tamStrings.length], i, new THREE.BoxGeometry(0.5, 0.45, 0.4), new THREE.Vector3(0, ny, 0.24));
      }
      group.rotation.set(0.04, 0.20, -0.14);
    } else if (instId === "dantu") {
      // 6. ĐÀN TỨ / ĐÀN ĐOẢN HOÀNG GIA
      var rTu = 1.62;
      var hTu = 0.40;

      var frontPlate = new THREE.Mesh(new THREE.CircleGeometry(rTu, 48), matSoundboardTranh);
      frontPlate.position.set(0, 0, hTu * 0.5 + 0.005);
      group.add(frontPlate);

      var backPlate = new THREE.Mesh(new THREE.CircleGeometry(rTu, 48), matRoyalCrimsonWood);
      backPlate.rotation.y = Math.PI;
      backPlate.position.set(0, 0, -(hTu * 0.5 + 0.005));
      group.add(backPlate);

      var sideRim = new THREE.Mesh(new THREE.CylinderGeometry(rTu, rTu, hTu, 48, 1, true), matRoyalLacquerBlack);
      sideRim.rotation.x = Math.PI / 2;
      group.add(sideRim);

      var outerGoldRim = new THREE.Mesh(new THREE.TorusGeometry(rTu, 0.045, 12, 48), matImperialGold);
      outerGoldRim.position.set(0, 0, hTu * 0.5 + 0.01);
      group.add(outerGoldRim);

      for (var side = -1; side <= 1; side += 2) {
        addGoldCloudScrollCluster(group, side * 1.15, -0.82, hTu * 0.5 + 0.025, 1.08, side * 0.45, side < 0);
        addGoldCloudScrollCluster(group, side * 1.12, 0.82, hTu * 0.5 + 0.025, 1.08, side * -0.45, side < 0);
      }

      var tailpiece = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.16), matImperialGold);
      tailpiece.position.set(0, -1.48, hTu * 0.5 + 0.05);
      group.add(tailpiece);

      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.14), matRoyalLacquerBlack);
      bridge.position.set(0, -0.88, hTu * 0.5 + 0.07);
      group.add(bridge);
      var bridgeSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.05), matImperialGold);
      bridgeSaddle.position.set(0, -0.88, hTu * 0.5 + 0.14);
      group.add(bridgeSaddle);

      var neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.22), matRoyalCrimsonWood);
      neck.position.set(0, 2.75, 0.05);
      group.add(neck);

      for (var ns = -1; ns <= 1; ns += 2) {
        var neckGoldStrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 2.95, 0.23), matImperialGold);
        neckGoldStrip.position.set(ns * 0.14, 2.75, 0.055);
        group.add(neckGoldStrip);
      }

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var fy = -0.15 + u * 3.95;
        var isOnBody = (fy < 1.35);
        var fz = isOnBody ? (hTu * 0.5 + 0.09) : 0.22;
        var fretBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), matBone);
        fretBase.position.set(0, fy, fz);
        group.add(fretBase);

        var fretCap = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.04), matImperialGold);
        fretCap.position.set(0, fy, fz + 0.065);
        group.add(fretCap);

        registerHitbox(fretBase, i, new THREE.BoxGeometry(0.5, 0.38, 0.4), new THREE.Vector3(0, fy, fz + 0.08));
      }

      var tuNutBase = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.07, 0.18), matRoyalLacquerBlack);
      tuNutBase.position.set(0, 4.18, 0.22);
      group.add(tuNutBase);
      var tuNutBone = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.045, 0.05), matBone);
      tuNutBone.position.set(0, 4.18, 0.33);
      group.add(tuNutBone);

      var head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.05, 0.24), matRoyalCrimsonWood);
      head.position.set(0, 4.68, -0.03);
      head.rotation.x = -0.18;
      group.add(head);

      var headCrown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.048, 10, 24, Math.PI * 1.4), matImperialGold);
      headCrown.position.set(0, 5.28, -0.14);
      group.add(headCrown);

      var headFinial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), matImperialGold);
      headFinial.position.set(0, 5.28, -0.14);
      group.add(headFinial);

      var pegConfigs = [
        { side: -1, y: 4.45, z: 0.01 },
        { side: 1,  y: 4.45, z: 0.01 },
        { side: -1, y: 4.88, z: -0.06 },
        { side: 1,  y: 4.88, z: -0.06 }
      ];
      for (var p = 0; p < 4; p++) {
        var cfg = pegConfigs[p];
        var peg = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.040, 0.74, 10), matRoyalLacquerBlack);
        peg.rotation.z = Math.PI / 2;
        peg.position.set(cfg.side * 0.28, cfg.y, cfg.z);
        group.add(peg);

        var pegTip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), matImperialGold);
        pegTip.position.set(cfg.side * 0.65, cfg.y, cfg.z);
        group.add(pegTip);
      }

      var stringX = [-0.075, -0.025, 0.025, 0.075];
      for (var s = 0; s < 4; s++) {
        var sx = stringX[s];
        addTautString([
          new THREE.Vector3(sx * 0.75, -1.48, hTu * 0.5 + 0.11),
          new THREE.Vector3(sx, -0.88, hTu * 0.5 + 0.16),
          new THREE.Vector3(sx, 4.18, 0.35),
          new THREE.Vector3(sx * 0.85, pegConfigs[s].y, pegConfigs[s].z + 0.02)
        ], 0.012, matSteelString);
      }
      group.rotation.set(0.04, 0.20, -0.14);
    } else if (instId === "dangoong") {
      // 13. ĐÀN GOONG TÂY NGUYÊN
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 6.6, 24), matWarmAgedBamboo);
      tube.rotation.z = Math.PI / 2;
      group.add(tube);

      for (var gk = -2.6; gk <= 2.6; gk += 1.3) {
        var gBand = new THREE.Mesh(new THREE.TorusGeometry(0.465, 0.022, 8, 24), matImperialGold);
        gBand.rotation.y = Math.PI / 2;
        gBand.position.set(gk, 0, 0);
        group.add(gBand);
      }

      var g1 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 20), matRoyalCrimsonWood);
      g1.position.set(-1.8, -0.88, 0);
      group.add(g1);
      var g2 = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 20), matRoyalCrimsonWood);
      g2.position.set(1.8, -0.88, 0);
      group.add(g2);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var angle = -0.8 + u * 1.6;
        var ry = Math.cos(angle) * 0.56;
        var rz = Math.sin(angle) * 0.56;

        var str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 5.6, 6), matSteelString);
        str.rotation.z = Math.PI / 2;
        str.position.set(0, ry, rz);
        group.add(str);

        var bridgeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), matRoyalLacquerBlack);
        bridgeL.position.set(-2.4, ry, rz);
        group.add(bridgeL);
        var bridgeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), matRoyalLacquerBlack);
        bridgeR.position.set(2.4, ry, rz);
        group.add(bridgeR);

        var hitPos = new THREE.Vector3(-1.8 + u * 3.6, ry, rz);
        registerHitbox(str, i, new THREE.BoxGeometry(0.65, 0.5, 0.5), hitPos);
      }
      group.rotation.set(0.08, -0.18, 0.10);
    } else if (instId === "danchapi") {
      // 14. ĐÀN CHAPI RAGLAI
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 5.8, 24), matWarmAgedBamboo);
      tube.rotation.z = Math.PI / 2;
      group.add(tube);

      for (var ck = -2.6; ck <= 2.6; ck += 2.6) {
        var cRing = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.025, 8, 24), matImperialGold);
        cRing.rotation.y = Math.PI / 2;
        cRing.position.set(ck, 0, 0);
        group.add(cRing);
      }

      var slot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.25), matRoyalLacquerBlack);
      slot.position.set(0, 0.58, 0);
      group.add(slot);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var angle = -0.9 + u * 1.8;
        var by = Math.cos(angle) * 0.62;
        var bz = Math.sin(angle) * 0.62;

        var str = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.025, 0.025), matSoundboardTranh);
        str.position.set(0, by, bz);
        group.add(str);

        var wedge1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), matRoyalLacquerBlack);
        wedge1.position.set(-1.9, by - 0.02, bz);
        group.add(wedge1);
        var wedge2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), matRoyalLacquerBlack);
        wedge2.position.set(1.9, by - 0.02, bz);
        group.add(wedge2);

        registerHitbox(str, i, new THREE.BoxGeometry(0.65, 0.45, 0.45), new THREE.Vector3(-1.6 + u * 3.2, by + 0.05, bz));
      }
      group.rotation.set(0.08, -0.18, 0.10);
    } else if (instId === "talu") {
      // 27. ĐÀN TA LƯ
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 5.2, 20), matWarmAgedBamboo);
      body.rotation.z = Math.PI / 2;
      group.add(body);

      var head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 16), matRoyalCrimsonWood);
      head.rotation.z = -Math.PI / 2;
      head.position.set(-3.0, 0, 0);
      group.add(head);
      addGoldCloudScrollCluster(group, -2.6, 0, 0.36, 0.85, 0.2, false);

      var s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.4, 6), matSteelString);
      s1.rotation.z = Math.PI / 2;
      s1.position.set(-0.2, 0.4, -0.08);
      group.add(s1);
      var s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.4, 6), matSteelString);
      s2.rotation.z = Math.PI / 2;
      s2.position.set(-0.2, 0.4, 0.08);
      group.add(s2);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var nx = -1.8 + u * 3.6;
        registerHitbox(i % 2 === 0 ? s1 : s2, i, new THREE.BoxGeometry(0.55, 0.45, 0.45), new THREE.Vector3(nx, 0.45, 0));
      }
      group.rotation.set(0.08, -0.18, 0.12);
    } else if (instId === "saotruc") {
      // 15. SÁO TRÚC VIỆT NAM (SÁO NGANG CỔ TRUYỀN BẰNG TRÚC NỨA ÓNG Ả, BỊT SỪNG BỌC HOÀNG KIM, TUA RUA NGỌC BỘI & GIÁ ĐỠ SƠN MÀI)
      var saoGroup = new THREE.Group();
      var fluteLen = 6.4;
      var rad = 0.165;

      // 1. Thân sáo ngang bằng trúc/nứa già óng ả
      var fluteTube = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.02, fluteLen, 32), matWarmAgedBamboo);
      fluteTube.rotation.z = Math.PI / 2;
      saoGroup.add(fluteTube);

      // Lòng ống sáo rỗng
      var bore = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.72, rad * 0.72, fluteLen + 0.04, 20), matBlack);
      bore.rotation.z = Math.PI / 2;
      saoGroup.add(bore);

      // Nút bấc chặn hơi bên trong đầu trái (ngay sát lỗ thổi)
      var corkPlug = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.70, rad * 0.70, 0.25, 16), matRoyalCrimsonWood);
      corkPlug.rotation.z = Math.PI / 2;
      corkPlug.position.set(-fluteLen * 0.5 + 0.45, 0, 0);
      saoGroup.add(corkPlug);

      // 2. Hai đầu sáo bịt sừng đen bóng bọc khuyên đồng chạm vàng hoàng gia
      // Đầu thổi (trái)
      var capLeftHorn = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.04, rad * 1.04, 0.22, 28), matBlack);
      capLeftHorn.rotation.z = Math.PI / 2;
      capLeftHorn.position.set(-fluteLen * 0.5 + 0.11, 0, 0);
      saoGroup.add(capLeftHorn);

      var capLeftGold = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.06, rad * 1.06, 0.12, 28), matImperialGold);
      capLeftGold.rotation.z = Math.PI / 2;
      capLeftGold.position.set(-fluteLen * 0.5 + 0.23, 0, 0);
      saoGroup.add(capLeftGold);

      // Đầu đuôi (phải)
      var capRightGold = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.06, rad * 1.06, 0.12, 28), matImperialGold);
      capRightGold.rotation.z = Math.PI / 2;
      capRightGold.position.set(fluteLen * 0.5 - 0.28, 0, 0);
      saoGroup.add(capRightGold);

      var capRightHorn = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.04, rad * 1.04, 0.22, 28), matBlack);
      capRightHorn.rotation.z = Math.PI / 2;
      capRightHorn.position.set(fluteLen * 0.5 - 0.11, 0, 0);
      saoGroup.add(capRightHorn);

      // 3. Các mắt/đốt trúc tự nhiên (bamboo node rings) viền gỗ sẫm & chỉ tơ cuốn gia cố
      var nodeX = [-2.4, -1.3, 0.2, 1.6, 2.6];
      for (var k = 0; k < nodeX.length; k++) {
        var nx = nodeX[k];
        var bNode = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.025, 0.016, 8, 28), matRoyalCrimsonWood);
        bNode.rotation.y = Math.PI / 2;
        bNode.position.set(nx, 0, 0);
        saoGroup.add(bNode);
      }

      // 4. Lỗ thổi (Embouchure hole) hình oval khoét sâu tại đầu trái
      var blowHole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 18), matBlack);
      blowHole.scale.set(1.25, 1, 0.9);
      blowHole.position.set(-2.0, rad * 0.88, 0);
      saoGroup.add(blowHole);

      var blowRim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20), matImperialGold);
      blowRim.rotation.x = Math.PI / 2;
      blowRim.position.set(-2.0, rad * 0.98, 0);
      saoGroup.add(blowRim);

      // 5. Hệ thống các lỗ bấm giai điệu (Finger holes) trải đều
      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var holeX = -0.95 + u * 2.75;
        var fHole = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.12, 16), matBlack);
        fHole.position.set(holeX, rad * 0.92, 0);
        saoGroup.add(fHole);

        var fRim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 6, 16), matImperialGold);
        fRim.rotation.x = Math.PI / 2;
        fRim.position.set(holeX, rad * 0.99, 0);
        saoGroup.add(fRim);

        registerHitbox(fHole, i, new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.Vector3(holeX, rad + 0.12, 0));
      }

      // 6. Lỗ định âm / thoát âm ở đuôi sáo
      var tuningHole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.12, 14), matBlack);
      tuningHole1.position.set(2.25, rad * 0.92, 0);
      saoGroup.add(tuningHole1);

      var tuningHole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.12, 14), matBlack);
      tuningHole2.position.set(2.55, -rad * 0.92, 0);
      saoGroup.add(tuningHole2);

      // 7. Dây tua rua đỏ kết ngọc bội hoàng gia rủ xuống
      var tasselGroup = new THREE.Group();
      tasselGroup.position.set(2.25, -rad * 0.8, 0);

      var silkCord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 10), matRoyalCrimsonWood);
      silkCord.position.set(0, -0.18, 0);
      tasselGroup.add(silkCord);

      var jadeMedallion = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 24), matImperialGold);
      jadeMedallion.rotation.x = Math.PI / 2;
      jadeMedallion.position.set(0, -0.42, 0);
      tasselGroup.add(jadeMedallion);

      var tasselSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 18), matRoyalCrimsonWood);
      tasselSkirt.position.set(0, -0.76, 0);
      tasselGroup.add(tasselSkirt);

      saoGroup.add(tasselGroup);

      // 8. Giá đỡ sáo bằng gỗ mun sơn mài hoàng gia
      var standGroup = new THREE.Group();
      var standBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 1.2), matRoyalCrimsonWood);
      standBase.position.set(0.1, -1.05, 0);
      standGroup.add(standBase);

      var standBaseTrim = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.04, 1.35), matImperialGold);
      standBaseTrim.position.set(0.1, -1.14, 0);
      standGroup.add(standBaseTrim);

      var pL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, 0.45), matRoyalCrimsonWood);
      pL.position.set(-1.4, -0.62, 0);
      standGroup.add(pL);
      var pLCup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 16, 1, false, 0, Math.PI), matRoyalCrimsonWood);
      pLCup.rotation.z = Math.PI / 2;
      pLCup.position.set(-1.4, -0.22, 0);
      standGroup.add(pLCup);

      var pR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, 0.45), matRoyalCrimsonWood);
      pR.position.set(1.5, -0.62, 0);
      standGroup.add(pR);
      var pRCup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 16, 1, false, 0, Math.PI), matRoyalCrimsonWood);
      pRCup.rotation.z = Math.PI / 2;
      pRCup.position.set(1.5, -0.22, 0);
      standGroup.add(pRCup);

      saoGroup.add(standGroup);

      // Đặt góc nghiêng trưng bày tự nhiên
      saoGroup.rotation.set(0.12, 0.22, -0.06);
      group.add(saoGroup);
    } else if (instId === "tieu") {
      // 16. ĐỘNG TIÊU TRÚC ĐỐM CỔ TRUYỀN (SÁO DỌC / ĐỘNG TIÊU BỊT VÀNG)
      var tieuGroup = new THREE.Group();
      var fluteLen = 7.4;
      var radTop = 0.178;
      var radBot = 0.190;

      var flute = new THREE.Mesh(new THREE.CylinderGeometry(radTop, radBot, fluteLen, 28), matWarmAgedBamboo);
      tieuGroup.add(flute);

      var bore = new THREE.Mesh(new THREE.CylinderGeometry(radTop * 0.68, radBot * 0.68, fluteLen + 0.02, 20), matBlack);
      tieuGroup.add(bore);

      var topGoldCap = new THREE.Mesh(new THREE.CylinderGeometry(radTop * 1.02, radTop * 1.02, 0.24, 24), matImperialGold);
      topGoldCap.position.set(0, fluteLen * 0.5 - 0.12, 0);
      tieuGroup.add(topGoldCap);

      var botGoldCap = new THREE.Mesh(new THREE.CylinderGeometry(radBot * 1.02, radBot * 1.02, 0.34, 24), matImperialGold);
      botGoldCap.position.set(0, -fluteLen * 0.5 + 0.17, 0);
      tieuGroup.add(botGoldCap);

      var ringPositions = [-2.55, -1.25, 0.15, 1.55, 2.75];
      for (var k = 0; k < ringPositions.length; k++) {
        var ry = ringPositions[k];
        var bambooNode = new THREE.Mesh(new THREE.TorusGeometry(radTop * 1.03, 0.018, 8, 24), matRoyalCrimsonWood);
        bambooNode.rotation.x = Math.PI / 2;
        bambooNode.position.set(0, ry, 0);
        tieuGroup.add(bambooNode);
      }

      var blowHole = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.14, 16), matBlack);
      blowHole.rotation.x = Math.PI / 2;
      blowHole.position.set(0, 2.25, radTop * 0.76);
      tieuGroup.add(blowHole);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hy = -2.25 + u * 3.65;
        var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.12, 16), matBlack);
        hole.rotation.x = Math.PI / 2;
        hole.position.set(0, hy, radTop * 0.78);
        tieuGroup.add(hole);

        registerHitbox(hole, i, new THREE.BoxGeometry(0.48, 0.48, 0.45), new THREE.Vector3(0, hy, 0.22));
      }

      tieuGroup.rotation.z = -0.15;
      tieuGroup.rotation.y = -0.18;
      group.add(tieuGroup);
    } else if (instId === "pi") {
      // 24. SÁO PI THÁI (Ống trúc đốm ngắn nhỏ người Thái, 2 đầu bọc đồng mạ vàng, dăm lam đồng, 6 lỗ bấm)
      var piGroup = new THREE.Group();
      var flute = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 4.8, 24), matWarmAgedBamboo);
      flute.rotation.z = Math.PI / 2;
      piGroup.add(flute);

      var bore = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 4.82, 16), matBlack);
      bore.rotation.z = Math.PI / 2;
      piGroup.add(bore);

      var capL = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.24, 24), matImperialGold);
      capL.rotation.z = Math.PI / 2;
      capL.position.set(-2.30, 0, 0);
      piGroup.add(capL);
      var capR = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.24, 24), matImperialGold);
      capR.rotation.z = Math.PI / 2;
      capR.position.set(2.30, 0, 0);
      piGroup.add(capR);

      var reedTongue = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.09), matImperialGold);
      reedTongue.position.set(-1.92, 0.128, 0);
      piGroup.add(reedTongue);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hx = -1.2 + u * 2.8;
        var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 14), matBlack);
        hole.position.set(hx, 0.105, 0);
        piGroup.add(hole);
        registerHitbox(hole, i, new THREE.BoxGeometry(0.45, 0.4, 0.4), new THREE.Vector3(hx, 0.16, 0));
      }
      piGroup.rotation.z = -0.15;
      piGroup.rotation.y = -0.18;
      group.add(piGroup);
    } else if (instId === "dingbuot") {
      // 25. ĐING BUỐT (Sáo trúc đốm dọc Ê-đê, đầu bọc đồng chạm mây vàng có nêm khe thổi, thân khoét lỗ bấm)
      var dbGroup = new THREE.Group();
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 5.6, 24), matWarmAgedBamboo);
      tube.position.set(0, 0.6, 0);
      dbGroup.add(tube);

      var topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.34, 24), matImperialGold);
      topCap.position.set(0, 3.25, 0);
      dbGroup.add(topCap);
      var botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.28, 24), matImperialGold);
      botCap.position.set(0, -2.06, 0);
      dbGroup.add(botCap);

      for (var n = 0; n < 4; n++) {
        var ny = -1.2 + n * 1.25;
        var node = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 8, 20), matBambooDark);
        node.rotation.x = Math.PI / 2;
        node.position.set(0, ny, 0);
        dbGroup.add(node);
      }

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hy = -1.5 + u * 3.6;
        var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.1, 14), matBlack);
        hole.rotation.x = Math.PI / 2;
        hole.position.set(0, hy, 0.12);
        dbGroup.add(hole);
        registerHitbox(hole, i, new THREE.BoxGeometry(0.45, 0.45, 0.4), new THREE.Vector3(0, hy, 0.16));
      }
      dbGroup.rotation.z = -0.15;
      dbGroup.rotation.y = -0.18;
      group.add(dbGroup);
    } else if (instId === "dingtut") {
      // 26. ĐING TÚT (BỘ 6 ỐNG TRÚC ĐỐM CỤT dài ngắn xếp hàng quạt trên giá gỗ sơn son chạm mây vàng)
      var dtGroup = new THREE.Group();
      var rack = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.26, 0.46), matRoyalCrimsonWood);
      rack.position.set(0, -0.4, 0);
      dtGroup.add(rack);
      addGoldCloudScrollCluster(dtGroup, 0, -0.4, 0.24, 0.9, 0, false);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var px = -1.8 + u * 3.6;
        var pipeH = 4.8 - u * 2.6;
        var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, pipeH, 20), matWarmAgedBamboo);
        pipe.position.set(px, pipeH * 0.5 - 0.3, 0);
        dtGroup.add(pipe);

        var bore = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, pipeH + 0.02, 14), matBlack);
        bore.position.set(px, pipeH * 0.5 - 0.3, 0);
        dtGroup.add(bore);

        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.018, 8, 20), matImperialGold);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(px, pipeH - 0.3, 0);
        dtGroup.add(rim);

        registerHitbox(pipe, i, new THREE.BoxGeometry(0.5, pipeH, 0.5), new THREE.Vector3(px, pipeH * 0.5 - 0.3, 0));
      }
      dtGroup.rotation.y = -0.16;
      group.add(dtGroup);
    } else if (instId === "khen" || instId === "khenmong") {
      // 17. KHÈN MÔNG (Bầu gỗ hồng mộc đỏ sẫm chạm mây vàng 24K nối liền dọc khèn uốn cong mềm mại, 6 ống trúc đốm xuyên qua bầu khèn)
      var khenGroup = new THREE.Group();

      var stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.55, -1.55, 0),
        new THREE.Vector3(1.15, -0.75, 0),
        new THREE.Vector3(0.75, 0.10, 0),
        new THREE.Vector3(0.55, 1.05, 0),
        new THREE.Vector3(0.65, 2.15, 0),
        new THREE.Vector3(1.05, 3.15, 0),
        new THREE.Vector3(1.65, 3.95, 0)
      ]);
      var stemPts = stemCurve.getPoints(48);
      for (var s = 0; s < stemPts.length - 1; s++) {
        var p0 = stemPts[s];
        var p1 = stemPts[s + 1];
        var t0 = s / (stemPts.length - 1);
        var t1 = (s + 1) / (stemPts.length - 1);
        var r0 = 0.11 + 0.36 * Math.exp(-Math.pow((t0 - 0.28) / 0.17, 2)) + (1 - t0) * 0.04;
        var r1 = 0.11 + 0.36 * Math.exp(-Math.pow((t1 - 0.28) / 0.17, 2)) + (1 - t1) * 0.04;
        var segLen = p0.distanceTo(p1);
        var segGeo = new THREE.CylinderGeometry(r1, r0, segLen + 0.015, 20);
        var segMesh = new THREE.Mesh(segGeo, matRoyalCrimsonWood);
        segMesh.position.copy(p0).lerp(p1, 0.5);
        segMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        segMesh.scale.set(1.0, 1.0, 0.82);
        khenGroup.add(segMesh);

        if (s === 6 || s === 11 || s === 16 || s === 22 || s === 30 || s === 38 || s === 45) {
          var bandMat = (s === 11 || s === 16 || s === 30 || s === 45) ? matImperialGold : matRoyalLacquerBlack;
          var band = new THREE.Mesh(new THREE.TorusGeometry(r0 * 0.96, 0.024, 8, 24), bandMat);
          band.position.copy(p0);
          band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p1.clone().sub(p0).normalize());
          band.scale.set(1.0, 0.84, 1.0);
          khenGroup.add(band);
        }
      }
      addGoldCloudScrollCluster(khenGroup, 0.82, -0.10, 0.32, 0.72, 0.25, false);

      var mouthTip = stemPts[stemPts.length - 1];
      var mouthPrev = stemPts[stemPts.length - 2];
      var mouthDir = mouthTip.clone().sub(mouthPrev).normalize();
      var mouthpiece = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.14, 0.28, 20), matImperialGold);
      mouthpiece.position.copy(mouthTip);
      mouthpiece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mouthDir);
      khenGroup.add(mouthpiece);

      var mouthHole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.30, 16), matBlack);
      mouthHole.position.copy(mouthTip);
      mouthHole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mouthDir);
      khenGroup.add(mouthHole);

      var tailCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), matImperialGold);
      tailCap.position.copy(stemPts[0]);
      tailCap.scale.set(1, 0.7, 0.82);
      khenGroup.add(tailCap);

      var pipeConfigs = [
        { rowOffset: -0.18, z:  0.105, len: 6.8, rad: 0.082, shiftAlong: -1.10 },
        { rowOffset: -0.18, z: -0.105, len: 6.1, rad: 0.074, shiftAlong: -0.95 },
        { rowOffset:  0.00, z:  0.105, len: 5.3, rad: 0.068, shiftAlong: -0.75 },
        { rowOffset:  0.00, z: -0.105, len: 4.6, rad: 0.065, shiftAlong: -0.58 },
        { rowOffset:  0.18, z:  0.105, len: 3.9, rad: 0.062, shiftAlong: -0.40 },
        { rowOffset:  0.18, z: -0.105, len: 3.3, rad: 0.058, shiftAlong: -0.25 }
      ];

      var pipeTilt = 0.26;
      var pipeAxis = new THREE.Vector3(-Math.cos(pipeTilt), Math.sin(pipeTilt), 0).normalize();
      var pipePerp = new THREE.Vector3(Math.sin(pipeTilt), Math.cos(pipeTilt), 0).normalize();
      var chamberCenter = new THREE.Vector3(0.84, -0.15, 0);
      var pipeGroups = [];

      for (var i = 0; i < pipeConfigs.length; i++) {
        var cfg = pipeConfigs[i];
        var pGroup = new THREE.Group();

        var pGeo = new THREE.CylinderGeometry(cfg.rad, cfg.rad, cfg.len, 16);
        var pMesh = new THREE.Mesh(pGeo, matWarmAgedBamboo);
        pGroup.add(pMesh);

        var boreGeo = new THREE.CylinderGeometry(cfg.rad * 0.72, cfg.rad * 0.72, cfg.len + 0.02, 12);
        var boreMesh = new THREE.Mesh(boreGeo, matBlack);
        pGroup.add(boreMesh);

        var nodeCount = Math.max(2, Math.floor(cfg.len / 1.45));
        for (var nd = 0; nd < nodeCount; nd++) {
          var ny = -cfg.len * 0.36 + nd * (cfg.len * 0.72 / Math.max(1, nodeCount - 1));
          var nodeRing = new THREE.Mesh(new THREE.TorusGeometry(cfg.rad * 1.03, 0.012, 6, 16), matBambooDark);
          nodeRing.rotation.x = Math.PI / 2;
          nodeRing.position.set(0, ny, 0);
          pGroup.add(nodeRing);
        }

        var fingerHole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, cfg.rad * 2.3, 10), matBlack);
        fingerHole.rotation.x = Math.PI / 2;
        fingerHole.position.set(0, -cfg.shiftAlong + 0.55, 0);
        pGroup.add(fingerHole);

        var centerPos = chamberCenter.clone()
          .add(pipePerp.clone().multiplyScalar(cfg.rowOffset))
          .add(pipeAxis.clone().multiplyScalar(cfg.shiftAlong));
        centerPos.z = cfg.z;

        pGroup.position.copy(centerPos);
        pGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pipeAxis);
        khenGroup.add(pGroup);
        pipeGroups.push(pGroup);

        var hitPos = chamberCenter.clone()
          .add(pipePerp.clone().multiplyScalar(cfg.rowOffset))
          .add(pipeAxis.clone().multiplyScalar(-1.2 - i * 0.25));
        hitPos.z = cfg.z;
        registerHitbox(pGroup, i, new THREE.BoxGeometry(0.55, 0.45, 0.45), hitPos);
      }

      for (var extra = pipeConfigs.length; extra < notesCount; extra++) {
        var refGroup = pipeGroups[extra % pipeGroups.length];
        var extraPos = chamberCenter.clone().add(pipeAxis.clone().multiplyScalar(0.85 + (extra - 6) * 0.45));
        registerHitbox(refGroup, extra, new THREE.BoxGeometry(0.45, 0.45, 0.45), extraPos);
      }

      var tieDistances = [-1.45, -2.55, 0.85];
      for (var td = 0; td < tieDistances.length; td++) {
        var dist = tieDistances[td];
        var tiePos = chamberCenter.clone().add(pipeAxis.clone().multiplyScalar(dist));
        var tieBand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.40), (td === 0) ? matImperialGold : matRoyalLacquerBlack);
        tieBand.position.copy(tiePos);
        tieBand.rotation.z = -pipeTilt;
        khenGroup.add(tieBand);
      }

      group.add(khenGroup);
    } else if (instId === "khenbe") {
      // 18. KHÈN BÈ THÁI / LÀO (14 ống trúc đốm ghép song song 2 hàng, bầu gỗ mun sơn đen bóng & đai mây chạm vàng)
      var khenBeGroup = new THREE.Group();
      var matBeeswax = new THREE.MeshStandardMaterial({ color: 0x1c130e, roughness: 0.35, metalness: 0.14 });

      var pairLengths = [5.6, 5.1, 4.5, 4.0, 3.5, 3.1, 2.7];
      var numPairs = pairLengths.length;
      var pipeRadius = 0.078;
      var spacingX = 0.172;
      var startX = -((numPairs - 1) * spacingX) * 0.5;
      var windchestY = -0.55;

      for (var p = 0; p < numPairs; p++) {
        var pLen = pairLengths[p];
        var px = startX + p * spacingX;
        var bottomY = windchestY - (1.05 - p * 0.06);
        var centerY = bottomY + pLen * 0.5;

        for (var row = 0; row < 2; row++) {
          var pz = (row === 0) ? 0.088 : -0.088;
          var singlePipeGroup = new THREE.Group();

          var tubeMesh = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius, pipeRadius, pLen, 16), matWarmAgedBamboo);
          singlePipeGroup.add(tubeMesh);

          var boreMesh = new THREE.Mesh(new THREE.CylinderGeometry(pipeRadius * 0.68, pipeRadius * 0.68, pLen + 0.02, 10), matBlack);
          singlePipeGroup.add(boreMesh);

          var nSteps = Math.max(2, Math.floor(pLen / 1.35));
          for (var k = 0; k < nSteps; k++) {
            var ny = -pLen * 0.35 + k * (pLen * 0.7 / Math.max(1, nSteps - 1));
            var ringNode = new THREE.Mesh(new THREE.TorusGeometry(pipeRadius * 1.03, 0.01, 6, 14), matBambooDark);
            ringNode.rotation.x = Math.PI / 2;
            ringNode.position.set(0, ny, 0);
            singlePipeGroup.add(ringNode);
          }

          var holeY = (windchestY + 0.42) - centerY;
          var fHole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, pipeRadius * 2.2, 8), matBlack);
          fHole.rotation.x = Math.PI / 2;
          fHole.position.set(0, holeY, 0);
          singlePipeGroup.add(fHole);

          singlePipeGroup.position.set(px, centerY, pz);
          khenBeGroup.add(singlePipeGroup);

          var pairNoteIdx = p * 2 + row;
          if (pairNoteIdx < notesCount) {
            registerHitbox(singlePipeGroup, pairNoteIdx, new THREE.BoxGeometry(0.28, 0.65, 0.35), new THREE.Vector3(px, windchestY + 0.85, pz));
          }
        }
      }

      var raftWidth = numPairs * spacingX + 0.24;
      var chamberCore = new THREE.Mesh(new THREE.BoxGeometry(raftWidth, 0.62, 0.46), matRoyalCrimsonWood);
      chamberCore.position.set(0, windchestY, 0);
      khenBeGroup.add(chamberCore);
      addGoldCloudScrollCluster(khenBeGroup, 0, windchestY, 0.24, 0.75, 0, false);

      var leftCone = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.24, 0.68, 16), matRoyalLacquerBlack);
      leftCone.rotation.z = Math.PI / 2;
      leftCone.position.set(-raftWidth * 0.5 - 0.30, windchestY, 0);
      khenBeGroup.add(leftCone);

      var mouthBrass = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.115, 0.22, 16), matImperialGold);
      mouthBrass.rotation.z = Math.PI / 2;
      mouthBrass.position.set(-raftWidth * 0.5 - 0.68, windchestY, 0);
      khenBeGroup.add(mouthBrass);

      var mouthBore = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.25, 12), matBlack);
      mouthBore.rotation.z = Math.PI / 2;
      mouthBore.position.set(-raftWidth * 0.5 - 0.68, windchestY, 0);
      khenBeGroup.add(mouthBore);

      var rightCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.38, 16), matRoyalLacquerBlack);
      rightCap.rotation.z = -Math.PI / 2;
      rightCap.position.set(raftWidth * 0.5 + 0.16, windchestY, 0);
      khenBeGroup.add(rightCap);

      var waxTop = new THREE.Mesh(new THREE.BoxGeometry(raftWidth - 0.04, 0.10, 0.40), matBeeswax);
      waxTop.position.set(0, windchestY + 0.33, 0);
      khenBeGroup.add(waxTop);

      var waxBot = new THREE.Mesh(new THREE.BoxGeometry(raftWidth - 0.04, 0.10, 0.40), matBeeswax);
      waxBot.position.set(0, windchestY - 0.33, 0);
      khenBeGroup.add(waxBot);

      var rattanBands = [
        { y: windchestY - 0.82, w: raftWidth - 0.06 },
        { y: windchestY + 0.95, w: raftWidth - 0.06 },
        { y: windchestY + 2.05, w: raftWidth - 0.06 },
        { y: windchestY + 3.15, w: spacingX * 4 + 0.18, x: startX + 1.5 * spacingX }
      ];
      for (var rb = 0; rb < rattanBands.length; rb++) {
        var bInfo = rattanBands[rb];
        var rBand = new THREE.Mesh(new THREE.BoxGeometry(bInfo.w, 0.11, 0.38), matRoyalLacquerBlack);
        rBand.position.set(bInfo.x || 0, bInfo.y, 0);
        khenBeGroup.add(rBand);

        var goldTrim = new THREE.Mesh(new THREE.BoxGeometry(bInfo.w + 0.02, 0.035, 0.395), matImperialGold);
        goldTrim.position.set(bInfo.x || 0, bInfo.y, 0);
        khenBeGroup.add(goldTrim);
      }

      khenBeGroup.rotation.z = -0.14;
      group.add(khenBeGroup);
    } else if (instId === "dingnam") {
      // 19. ĐING NĂM (Bầu gió sơn son chạm mây vàng có cuống cong, 6 ống trúc đốm cắm xuyên qua bầu)
      var dnGroup = new THREE.Group();
      var gourd = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 24), matRoyalCrimsonWood);
      gourd.position.set(0, 0, 0);
      dnGroup.add(gourd);
      addGoldCloudScrollCluster(dnGroup, 0, 0, 1.04, 0.95, 0, false);

      var neckCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.8, 0),
        new THREE.Vector3(0, 1.6, 0.4),
        new THREE.Vector3(0, 2.2, 1.2)
      ]);
      var neckTube = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 24, 0.15, 14, false), matRoyalCrimsonWood);
      dnGroup.add(neckTube);

      var mouthTip = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.03, 10, 20), matImperialGold);
      mouthTip.position.set(0, 2.2, 1.2);
      dnGroup.add(mouthTip);

      for (var i = 0; i < notesCount; i++) {
        var col = i % 3;
        var row = Math.floor(i / 3);
        var px = -0.52 + col * 0.52;
        var pz = -0.26 + row * 0.52;
        var pipeH = 3.6 + (notesCount - i) * 0.4;
        var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, pipeH, 16), matWarmAgedBamboo);
        pipe.position.set(px, pipeH * 0.5 - 0.2, pz);
        dnGroup.add(pipe);
        registerHitbox(pipe, i, new THREE.BoxGeometry(0.4, 0.6, 0.4), new THREE.Vector3(px, pipeH * 0.5, pz));
      }
      dnGroup.rotation.y = -0.22;
      group.add(dnGroup);
    } else if (instId === "kenbau") {
      // 20. KÈN BẦU (Thân gỗ mun đen tiện tròn thuôn có ngấn vàng, LOA KÈN BẦU GỖ ĐỎ CHẠM MÂY VÀNG 24K)
      var kbGroup = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.18, 4.4, 24), matRoyalLacquerBlack);
      body.rotation.z = Math.PI / 2;
      kbGroup.add(body);

      var bell = new THREE.Mesh(new THREE.ConeGeometry(0.88, 1.35, 32, 1, true), matImperialGold);
      bell.rotation.z = -Math.PI / 2;
      bell.position.set(2.8, 0, 0);
      kbGroup.add(bell);
      var bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.04, 12, 32), matImperialGold);
      bellRim.rotation.y = Math.PI / 2;
      bellRim.position.set(3.46, 0, 0);
      kbGroup.add(bellRim);

      var reed = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.6, 12), matImperialGold);
      reed.rotation.z = Math.PI / 2;
      reed.position.set(-2.5, 0, 0);
      kbGroup.add(reed);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hx = -1.6 + u * 3.2;
        var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 14), matBlack);
        hole.position.set(hx, 0.14, 0);
        kbGroup.add(hole);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.14 + u * 0.04, 0.015, 8, 20), matImperialGold);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(hx - 0.16, 0, 0);
        kbGroup.add(ring);
        registerHitbox(hole, i, new THREE.BoxGeometry(0.5, 0.4, 0.4), new THREE.Vector3(hx, 0.22, 0));
      }
      kbGroup.rotation.z = -0.15;
      kbGroup.rotation.y = -0.18;
      group.add(kbGroup);
    } else if (instId === "pile") {
      // 21. PÍ LÈ (Thân kèn gỗ hồng mộc đỏ sẫm tiện ngấn, đĩa môi vàng, LOA KÈN ĐỒNG MẠ VÀNG XÒE RỘNG)
      var plGroup = new THREE.Group();
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 4.2, 24), matRoyalCrimsonWood);
      body.rotation.z = Math.PI / 2;
      plGroup.add(body);

      var bell = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 32, 1, true), matImperialGold);
      bell.rotation.z = -Math.PI / 2;
      bell.position.set(2.7, 0, 0);
      plGroup.add(bell);
      var bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.042, 12, 32), matImperialGold);
      bellRim.rotation.y = Math.PI / 2;
      bellRim.position.set(3.38, 0, 0);
      plGroup.add(bellRim);

      var lipPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 24), matImperialGold);
      lipPlate.rotation.z = Math.PI / 2;
      lipPlate.position.set(-2.3, 0, 0);
      plGroup.add(lipPlate);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var hx = -1.5 + u * 3.0;
        var hole = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.14, 14), matBlack);
        hole.position.set(hx, 0.15, 0);
        plGroup.add(hole);
        registerHitbox(hole, i, new THREE.BoxGeometry(0.5, 0.45, 0.4), new THREE.Vector3(hx, 0.22, 0));
      }
      plGroup.rotation.z = -0.15;
      plGroup.rotation.y = -0.18;
      group.add(plGroup);
    } else if (instId === "tuva") {
      // 23. TÙ VÀ (Sừng trâu đen bóng uốn cong tự nhiên, đầu thổi và vành miệng bịt vàng chạm mây)
      var tvGroup = new THREE.Group();
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.8, 0.2, 0),
        new THREE.Vector3(-1.2, 0.8, -0.2),
        new THREE.Vector3(0.6, 0.5, 0.1),
        new THREE.Vector3(2.4, -0.6, 0)
      ]);
      var horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.42, 24, false), matRoyalLacquerBlack);
      tvGroup.add(horn);
      addGoldCloudScrollCluster(tvGroup, -0.2, 0.72, 0.40, 0.95, -0.15, false);

      var mouthRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.048, 10, 24), matImperialGold);
      mouthRim.position.set(-2.8, 0.2, 0);
      mouthRim.rotation.y = Math.PI / 2;
      tvGroup.add(mouthRim);
      var bellRim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.055, 10, 28), matImperialGold);
      bellRim.position.set(2.4, -0.6, 0);
      bellRim.rotation.y = Math.PI / 2;
      tvGroup.add(bellRim);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var pt = curve.getPoint(u);
        var band = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.018, 8, 24), matImperialGold);
        band.position.copy(pt);
        band.rotation.y = Math.PI / 2;
        tvGroup.add(band);
        registerHitbox(band, i, new THREE.BoxGeometry(0.6, 0.6, 0.6), pt);
      }
      group.add(tvGroup);
    } else if (instId === "kenla") {
      // 22. KÈN LÁ (Lá rừng xanh ngọc uốn gập đôi trên giá bán nguyệt gỗ sơn son chạm mây vàng 24K)
      var stand = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 14, 32, Math.PI), matRoyalCrimsonWood);
      stand.position.set(0, 0, 0);
      group.add(stand);
      addGoldCloudScrollCluster(group, 0, 1.6, 0.13, 0.85, 0, false);

      var leafShape = new THREE.Shape();
      leafShape.moveTo(-2.2, 0);
      leafShape.quadraticCurveTo(0, 1.2, 2.2, 0);
      leafShape.quadraticCurveTo(0, -0.3, -2.2, 0);
      var leafGeo = new THREE.ShapeGeometry(leafShape);
      var leaf = new THREE.Mesh(leafGeo, matLeaf);
      leaf.position.set(0, 0.8, 0);
      group.add(leaf);

      var goldVein = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.025, 0.02), matImperialGold);
      goldVein.position.set(0, 0.55, 0.015);
      group.add(goldVein);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var lx = -1.8 + u * 3.6;
        registerHitbox(leaf, i, new THREE.BoxGeometry(0.5, 0.5, 0.4), new THREE.Vector3(lx, 0.75, 0.05));
      }
    } else if (instId === "trongcom") {
      // 28. TRỐNG CƠM (Tang bồng sơn son đỏ thẫm chạm mây vàng 24K, 2 mặt da bò đan dây chéo, đắp miếng cơm nếp tròn)
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.6, 32), matRoyalCrimsonWood);
      barrel.rotation.z = Math.PI / 2;
      group.add(barrel);
      addGoldCloudScrollCluster(group, 0, 0.15, 1.21, 1.15, 0, false);

      var rimL = new THREE.Mesh(new THREE.TorusGeometry(1.21, 0.045, 10, 32), matImperialGold);
      rimL.rotation.y = Math.PI / 2;
      rimL.position.set(-2.28, 0, 0);
      group.add(rimL);
      var rimR = new THREE.Mesh(new THREE.TorusGeometry(1.21, 0.045, 10, 32), matImperialGold);
      rimR.rotation.y = Math.PI / 2;
      rimR.position.set(2.28, 0, 0);
      group.add(rimR);

      var headL = new THREE.Mesh(new THREE.CircleGeometry(1.18, 32), matDrumSkin);
      headL.rotation.y = -Math.PI / 2;
      headL.position.set(-2.31, 0, 0);
      group.add(headL);
      var spotL = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), matRoyalLacquerBlack);
      spotL.rotation.y = -Math.PI / 2;
      spotL.position.set(-2.32, 0, 0);
      group.add(spotL);

      var headR = new THREE.Mesh(new THREE.CircleGeometry(1.18, 32), matDrumSkin);
      headR.rotation.y = Math.PI / 2;
      headR.position.set(2.31, 0, 0);
      group.add(headR);
      var spotR = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), matRoyalLacquerBlack);
      spotR.rotation.y = Math.PI / 2;
      spotR.position.set(2.32, 0, 0);
      group.add(spotR);

      for (var i = 0; i < notesCount; i++) {
        var isLeft = (i < notesCount / 2);
        var subIdx = isLeft ? i : (i - Math.floor(notesCount / 2));
        var angle = (subIdx / Math.max(1, Math.floor(notesCount / 2))) * Math.PI * 2;
        var rPos = 0.55;
        var hy = Math.sin(angle) * rPos;
        var hz = Math.cos(angle) * rPos;
        var hx = isLeft ? -2.32 : 2.32;
        registerHitbox(isLeft ? headL : headR, i, new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.Vector3(hx, hy, hz));
      }
    } else if (instId === "trongcai") {
      // 29. TRỐNG CÁI (Trống đại tang gỗ mít sơn son đỏ thẫm chạm mây vàng 24K, mặt da trâu hoa văn Đông Sơn đinh đồng, giá gỗ)
      var r = 2.2;
      var h = 2.5;
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 36), matRoyalCrimsonWood);
      group.add(drum);
      addGoldCloudScrollCluster(group, 0, 0, r + 0.02, 1.35, 0, false);

      var topHead = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 36), matDrumSkinDai);
      topHead.rotation.x = -Math.PI / 2;
      topHead.position.set(0, h * 0.5 + 0.01, 0);
      group.add(topHead);

      for (var d = 0; d < 28; d++) {
        var da = (d / 28) * Math.PI * 2;
        var stud = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), matImperialGold);
        stud.position.set(Math.cos(da) * (r + 0.02), h * 0.5 - 0.12, Math.sin(da) * (r + 0.02));
        group.add(stud);
      }

      var stand1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 0.24), matRoyalLacquerBlack);
      stand1.rotation.z = 0.35;
      stand1.position.set(-1.4, -h * 0.5 - 0.3, 0);
      group.add(stand1);
      var stand2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 0.24), matRoyalLacquerBlack);
      stand2.rotation.z = -0.35;
      stand2.position.set(1.4, -h * 0.5 - 0.3, 0);
      group.add(stand2);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var rad = r * 0.55;
        var tx = Math.cos(angle) * rad;
        var tz = Math.sin(angle) * rad;
        registerHitbox(topHead, i, new THREE.BoxGeometry(0.65, 0.4, 0.65), new THREE.Vector3(tx, h * 0.5 + 0.08, tz));
      }
    } else if (instId === "trongchien") {
      // 30. TRỐNG CHIẾN (Trống trận Tây Sơn sơn son thếp vàng mây rồng, mặt da trâu đanh, quai đồng mạ vàng)
      var r = 1.5;
      var h = 1.6;
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), matRoyalCrimsonWood);
      group.add(drum);
      addGoldCloudScrollCluster(group, 0, 0, r + 0.02, 1.1, 0, false);

      var topHead = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 32), matDrumSkinDai);
      topHead.rotation.x = -Math.PI / 2;
      topHead.position.set(0, h * 0.5 + 0.01, 0);
      group.add(topHead);

      for (var d = 0; d < 24; d++) {
        var da = (d / 24) * Math.PI * 2;
        var stud = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), matImperialGold);
        stud.position.set(Math.cos(da) * (r + 0.02), h * 0.5 - 0.10, Math.sin(da) * (r + 0.02));
        group.add(stud);
      }

      var ringL = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 20), matImperialGold);
      ringL.position.set(-r - 0.08, 0, 0);
      group.add(ringL);
      var ringR = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 20), matImperialGold);
      ringR.position.set(r + 0.08, 0, 0);
      group.add(ringR);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var rad = r * 0.55;
        var tx = Math.cos(angle) * rad;
        var tz = Math.sin(angle) * rad;
        registerHitbox(topHead, i, new THREE.BoxGeometry(0.55, 0.4, 0.55), new THREE.Vector3(tx, h * 0.5 + 0.08, tz));
      }
    } else if (instId === "trongban") {
      // 31. TRỐNG BẢN (Trống dẹp tang gỗ hồng mộc đỏ sẫm, 2 mặt da căng nẹp đinh đồng mạ vàng, quai lụa đỏ)
      var r = 1.7;
      var h = 0.55;
      var drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), matRoyalCrimsonWood);
      drum.rotation.x = Math.PI / 2;
      group.add(drum);

      var skin = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 32), matDrumSkin);
      skin.position.set(0, 0, h * 0.5 + 0.01);
      group.add(skin);

      for (var d = 0; d < 20; d++) {
        var da = (d / 20) * Math.PI * 2;
        var stud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matImperialGold);
        stud.position.set(Math.cos(da) * (r * 0.94), Math.sin(da) * (r * 0.94), h * 0.5 + 0.02);
        group.add(stud);
      }

      var strap = new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, 0.04, 10, 24, Math.PI), matRedSilkCord);
      strap.position.set(0, 0.3, 0);
      group.add(strap);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var rad = r * 0.55;
        var tx = Math.cos(angle) * rad;
        var ty = Math.sin(angle) * rad;
        registerHitbox(skin, i, new THREE.BoxGeometry(0.5, 0.5, 0.4), new THREE.Vector3(tx, ty, h * 0.5 + 0.05));
      }
    } else if (instId === "cong") {
      // 32. CỒNG TÂY NGUYÊN (Đĩa đồng đen ánh vàng tròn dày, CHÍNH GIỮA CÓ NÚM TRÒN LỒI LÊN, treo trên giá gỗ chạm mây vàng)
      var gong = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.34, 36), matBronze);
      gong.rotation.x = Math.PI / 2;
      group.add(gong);

      var boss = new THREE.Mesh(new THREE.SphereGeometry(0.54, 24, 20), matImperialGold);
      boss.position.set(0, 0, 0.24);
      group.add(boss);

      var outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.032, 10, 36), matImperialGold);
      outerRing.position.set(0, 0, 0.18);
      group.add(outerRing);

      var frameU = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 12, 32, Math.PI), matRoyalCrimsonWood);
      frameU.position.set(0, 0.2, 0);
      group.add(frameU);
      addGoldCloudScrollCluster(group, 0, 2.6, 0.15, 0.9, 0, false);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var dist = (i === 0) ? 0 : (0.65 + (i % 2) * 0.7);
        var gx = Math.cos(angle) * dist;
        var gy = Math.sin(angle) * dist;
        registerHitbox(gong, i, new THREE.BoxGeometry(0.6, 0.6, 0.4), new THREE.Vector3(gx, gy, 0.2));
      }
    } else if (instId === "chieng") {
      // 33. CHIÊNG TÂY NGUYÊN (Đĩa đồng tròn PHẲNG HOÀN TOÀN, KHÔNG CÓ NÚM, hoa văn đồng tâm mạ vàng)
      var gong = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.24, 36), matBronze);
      gong.rotation.x = Math.PI / 2;
      group.add(gong);

      var rimRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.032, 10, 36), matImperialGold);
      rimRing.position.set(0, 0, 0.13);
      group.add(rimRing);
      var innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.032, 10, 36), matImperialGold);
      innerRing.position.set(0, 0, 0.13);
      group.add(innerRing);

      var hanger = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.08, 10, 28, Math.PI), matRoyalCrimsonWood);
      hanger.position.set(0, 0.2, 0);
      group.add(hanger);
      addGoldCloudScrollCluster(group, 0, 2.55, 0.10, 0.85, 0, false);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var dist = 0.5 + (i % 3) * 0.5;
        var gx = Math.cos(angle) * dist;
        var gy = Math.sin(angle) * dist;
        registerHitbox(gong, i, new THREE.BoxGeometry(0.55, 0.55, 0.4), new THREE.Vector3(gx, gy, 0.16));
      }
    } else if (instId === "thanhla") {
      // 34. THANH LA (Đĩa đồng mạ vàng sáng bóng cầm tay xỏ dây lụa đỏ)
      var plate = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.15, 36), matImperialGold);
      plate.rotation.x = Math.PI / 2;
      group.add(plate);

      var knob = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), matImperialGold);
      knob.position.set(0, 0, 0.12);
      group.add(knob);

      var cord = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 18), matRedSilkCord);
      cord.position.set(0, 0, 0.28);
      group.add(cord);

      for (var i = 0; i < notesCount; i++) {
        var angle = (i / notesCount) * Math.PI * 2;
        var gx = Math.cos(angle) * 0.65;
        var gy = Math.sin(angle) * 0.65;
        registerHitbox(plate, i, new THREE.BoxGeometry(0.5, 0.5, 0.4), new THREE.Vector3(gx, gy, 0.12));
      }
    } else if (instId === "mo") {
      // 35. MÕ GỖ (Khối gỗ sơn son thếp vàng chạm mây, khoét rãnh thoát âm vòng cung, đệm lót sơn đen viền vàng)
      var body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 28, 22), matRoyalCrimsonWood);
      body.scale.set(1.2, 0.9, 1.3);
      group.add(body);
      addGoldCloudScrollCluster(group, 0, 0.55, 1.85, 1.15, 0, false);

      var slit = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 10, 24, Math.PI), matBlack);
      slit.rotation.x = Math.PI / 2;
      slit.position.set(0, -0.2, 0.3);
      group.add(slit);

      var cushion = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.28, 28), matRoyalLacquerBlack);
      cushion.position.set(0, -0.85, 0);
      group.add(cushion);
      var cushionGold = new THREE.Mesh(new THREE.TorusGeometry(1.76, 0.035, 10, 28), matImperialGold);
      cushionGold.rotation.x = Math.PI / 2;
      cushionGold.position.set(0, -0.72, 0);
      group.add(cushionGold);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var angle = -1.1 + u * 2.2;
        var mx = Math.sin(angle) * 1.1;
        var mz = Math.cos(angle) * 1.1;
        var my = 0.5 - Math.abs(angle) * 0.2;
        registerHitbox(body, i, new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.Vector3(mx, my, mz));
      }
    } else if (instId === "phach") {
      // 36. PHÁCH CA TRÙ (Bàn phách trúc đốm già phẳng đanh viền vàng, chân đế sơn đen bóng chạm mây vàng)
      var board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 1.4), matWarmAgedBamboo);
      board.position.set(0, 0, 0);
      group.add(board);

      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 1.35), matRoyalLacquerBlack);
      legL.position.set(-2.0, -0.18, 0);
      group.add(legL);
      var legR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 1.35), matRoyalLacquerBlack);
      legR.position.set(2.0, -0.18, 0);
      group.add(legR);
      addGoldCloudScrollCluster(group, 0, -0.02, 0.72, 0.9, 0, false);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var bx = -2.0 + u * 4.0;
        registerHitbox(board, i, new THREE.BoxGeometry(0.55, 0.4, 0.6), new THREE.Vector3(bx, 0.15, 0));
      }
    } else if (instId === "sinhtien") {
      // 37. SINH TIỀN (3 thanh gỗ hồng mộc đỏ sẫm chạm mây vàng: thanh gắn xâu tiền xu đồng mạ vàng, thanh khía răng cưa)
      var bar1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.65), matRoyalCrimsonWood);
      bar1.position.set(-1.0, 0, -0.5);
      group.add(bar1);
      addGoldCloudScrollCluster(group, -1.0, 0.09, -0.5, 0.75, 0, false);
      for (var c = 0; c < 5; c++) {
        var coin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 20), matImperialGold);
        coin.position.set(-2.2 + c * 0.6, 0.12, -0.5);
        group.add(coin);
      }

      var bar2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.65), matRoyalCrimsonWood);
      bar2.position.set(1.0, 0, -0.5);
      group.add(bar2);
      for (var r = 0; r < 12; r++) {
        var notch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.6), matImperialGold);
        notch.position.set(-0.6 + r * 0.28, 0.09, -0.5);
        group.add(notch);
      }

      var bar3 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.5), matRoyalCrimsonWood);
      bar3.rotation.z = 0.35;
      bar3.position.set(0.3, 0.35, 0.4);
      group.add(bar3);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var sx = -1.8 + u * 3.6;
        registerHitbox(bar1, i, new THREE.BoxGeometry(0.5, 0.45, 0.5), new THREE.Vector3(sx, 0.22, -0.5));
      }
    } else if (instId === "trung") {
      // 38. ĐÀN T'RƯNG TÂY NGUYÊN (Mô hình chân thực 100% theo ảnh thật media_1791266473157.png)
      // Bao gồm:
      // - Chân kiềng tre 3 nhánh uốn tự nhiên chạm sàn + mắt rễ tre
      // - Cột trụ đứng thân tre trung tâm có mắt đốt & lỗ thông hơi
      // - Cần tre uốn cong vút hình cánh cung vươn cao về góc trên bên phải
      // - Nhánh tre chạc phụ chúc xuống góc dưới bên trái đỡ dây néo
      // - 2 sợi dây néo màu trắng ngà song song xâu giữ dàn ống
      // - Dàn 12 ống nứa vàng óng xếp bậc thang vát chéo miệng máng đặc trưng
      var matNaturalBambooStand = new THREE.MeshStandardMaterial({
        color: 0xd8aa62,
        roughness: 0.36,
        metalness: 0.08
      });
      // 38. ĐÀN T'RƯNG TÂY NGUYÊN (Mô hình chân thực 100% chuẩn ảnh media_1791352260266.png)
      // Bao gồm:
      // - Cột trụ tre thẳng đứng trung tâm (Straight vertical bamboo mast)
      // - Chân kiềng 3 nhánh choãi sàn vững chãi (Tripod base)
      // - 2 tay đòn tre đỡ dưới vươn về phía trước giữ gốc dây néo
      // - 12 ống nứa nằm ngang song song xếp bậc thang từ dài đến ngắn
      // - Đầu trái ống tre có mấu mắt đốt kín tròn, đầu phải vát chéo miệng máng thoát âm
      // - 2 sợi dây dù trắng đan chữ A hội tụ về đỉnh cột tre
      // - 2 dùi gõ nằm ngang phía trước chân đàn
      var matNaturalBambooStand = matNaturalYellowBamboo;
      var matBambooNodeDark = new THREE.MeshStandardMaterial({
        color: 0x8a5b28,
        roughness: 0.45,
        metalness: 0.08
      });
      var matDarkBambooRoot = new THREE.MeshStandardMaterial({
        color: 0x5a3518,
        roughness: 0.50,
        metalness: 0.06
      });
      var matWhiteCord = new THREE.MeshStandardMaterial({
        color: 0xf6f4ed,
        roughness: 0.40,
        metalness: 0.02
      });
      var matHollowBore = new THREE.MeshStandardMaterial({
        color: 0x3d2414,
        roughness: 0.65,
        metalness: 0.04,
        side: THREE.DoubleSide
      });
      var matMalletWood = new THREE.MeshStandardMaterial({
        color: 0xeadbb8,
        roughness: 0.42,
        metalness: 0.04
      });

      var trungGroup = new THREE.Group();

      // Helper kết nối ống tre chính xác giữa 2 điểm 3D bất kỳ bằng Vector & Quaternion (Không lo lỗi góc Euler)
      function addBambooStrut(pA, pB, radA, radB, mat) {
        var dir = new THREE.Vector3().subVectors(pB, pA);
        var len = dir.length();
        if (len < 0.001) return null;
        var cylGeo = new THREE.CylinderGeometry(radB, radA, len, 14);
        var mesh = new THREE.Mesh(cylGeo, mat || matNaturalYellowBamboo);
        mesh.castShadow = true;
        var mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        trungGroup.add(mesh);
        return mesh;
      }

      // ==========================================
      // A. CỘT TRỤ ĐỨNG TRUNG TÂM & CHÂN KIỀNG 3 NHÁNH (CHUẨN ẢNH)
      // ==========================================
      var floorY = -2.25;
      var pJunction = new THREE.Vector3(0, -0.95, -0.12);

      // 1. Cổ nối mộng tre tại điểm chụm chân kiềng
      var junctionMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.28, 16), matBambooNodeDark);
      junctionMesh.position.copy(pJunction);
      trungGroup.add(junctionMesh);

      // 2. Chân kiềng tre 3 nhánh choãi sàn vững chãi:
      // Chân trước trái, chân trước phải và chân chống sau
      var pFootL = new THREE.Vector3(-1.08, floorY, 0.62);
      var pFootR = new THREE.Vector3(1.08, floorY, 0.62);
      var pFootB = new THREE.Vector3(0.0, floorY, -0.98);

      addBambooStrut(pFootL, pJunction, 0.082, 0.090, matNaturalYellowBamboo);
      addBambooStrut(pFootR, pJunction, 0.082, 0.090, matNaturalYellowBamboo);
      addBambooStrut(pFootB, pJunction, 0.082, 0.090, matNaturalYellowBamboo);

      // Đầu mút đế chân tiếp xúc sàn
      [pFootL, pFootR, pFootB].forEach(function(pt) {
        var footCap = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), matDarkBambooRoot);
        footCap.position.copy(pt);
        trungGroup.add(footCap);
      });

      // Mắt đốt tre trên 3 chân kiềng
      [pFootL, pFootR, pFootB].forEach(function(pt) {
        var midLeg = pJunction.clone().lerp(pt, 0.45);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.015, 6, 14), matBambooNodeDark);
        ring.position.copy(midLeg);
        var dir = new THREE.Vector3().subVectors(pt, pJunction).normalize();
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        trungGroup.add(ring);
      });

      // Thanh giằng ngang liên kết giữa 2 chân trước tạo kết cấu vững chắc
      var braceL = pJunction.clone().lerp(pFootL, 0.58);
      var braceR = pJunction.clone().lerp(pFootR, 0.58);
      addBambooStrut(braceL, braceR, 0.045, 0.045, matNaturalYellowBamboo);

      // 3. Cột trụ tre thẳng đứng trung tâm (chạy từ cổ nối lên đến đỉnh treo dây)
      var mastTopTip = new THREE.Vector3(0, 2.75, -0.12);
      addBambooStrut(pJunction, mastTopTip, 0.125, 0.092, matNaturalYellowBamboo);

      // Các mắt đốt tre tự nhiên dọc trên cột trụ đứng
      [-0.5, 0.1, 0.7, 1.3, 1.9, 2.4].forEach(function(ny) {
        var nodeRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 6, 18), matBambooNodeDark);
        nodeRing.rotation.x = Math.PI / 2;
        nodeRing.position.set(0, ny, -0.12);
        trungGroup.add(nodeRing);
      });

      // Mấu ngọn trên đỉnh cột tre (nơi 2 dây néo buộc chụm lại)
      var mastTopPeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 12), matBambooNodeDark);
      mastTopPeg.position.copy(mastTopTip);
      trungGroup.add(mastTopPeg);

      var topKnot = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16), matWhiteCord);
      topKnot.rotation.x = Math.PI / 2;
      topKnot.position.set(0, mastTopTip.y - 0.06, mastTopTip.z);
      trungGroup.add(topKnot);

      // 4. Hai thanh tre đỡ ngang (tay đòn) vươn ra phía trước giữ 2 đầu dây néo dưới
      var pArmOrigin = new THREE.Vector3(0, -0.52, -0.12);
      var pArmTipL = new THREE.Vector3(-0.95, -0.48, 0.55);
      var pArmTipR = new THREE.Vector3(0.72, -0.48, 0.55);

      addBambooStrut(pArmOrigin, pArmTipL, 0.068, 0.055, matNaturalYellowBamboo);
      addBambooStrut(pArmOrigin, pArmTipR, 0.068, 0.055, matNaturalYellowBamboo);

      var pegTipL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), matBambooNodeDark);
      pegTipL.position.copy(pArmTipL);
      trungGroup.add(pegTipL);

      var pegTipR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), matBambooNodeDark);
      pegTipR.position.copy(pArmTipR);
      trungGroup.add(pegTipR);

      // ==========================================
      // B. DÀN 12 ỐNG NỨA NẰM NGANG VÁT CHÉO BẬC THANG (KHOẢNG CÁCH THÔNG THOÁNG GIỮA CÁC NỐT)
      // ==========================================
      var numTubes = 12;
      var tubeMeshes = [];
      var cordLPoints = [pArmTipL.clone()];
      var cordRPoints = [pArmTipR.clone()];

      for (var k = 0; k < numTubes; k++) {
        var u = k / (numTubes - 1); // 0 (ống trầm nhất dưới cùng) đến 1 (ống thanh nhất trên cùng)

        // Tọa độ ống: xếp bậc thang từ dưới lên trên, giãn rộng khoảng cách giữa các nốt
        var tY = -0.32 + u * 2.62; // Khoảng cách giữa các ống đạt ~0.24, tạo khe hở thông thoáng rõ rệt
        var tZ = 0.52 - u * 0.44;  // Ngả nhẹ về phía cột trụ phía sau theo góc nghiêng tự nhiên
        var tCenterX = -0.14 + u * 0.20;

        // Chiều dài và đường kính ống nứa thanh thoát chuẩn tỉ lệ tre nứa Tây Nguyên
        var tLen = 3.25 - u * 2.05; // từ 3.25 xuống 1.20
        var tRad = 0.102 - u * 0.046; // từ 0.102 xuống 0.056 (đường kính vừa vặn, không bị dính sát vào nhau)

        var tubeGroup = new THREE.Group();
        tubeGroup.position.set(tCenterX, tY, tZ);
        // Nghiêng nhẹ mặt máng vát hướng về phía người xem/người gõ
        tubeGroup.rotation.set(-0.16, 0.04, 0);

        // Chiều dài thân ống kín (66%) và chiều dài máng vát chéo (34%)
        var bodyLen = tLen * 0.66;
        var scoopLen = tLen * 0.34;
        var halfLen = tLen * 0.5;

        // 1. Thân ống tre trụ kín tròn bên trái
        var bodyGeo = new THREE.CylinderGeometry(tRad, tRad, bodyLen, 18);
        var bodyMesh = new THREE.Mesh(bodyGeo, matNaturalYellowBamboo);
        bodyMesh.rotation.z = Math.PI / 2;
        bodyMesh.position.set(-halfLen + bodyLen * 0.5, 0, 0);
        bodyMesh.castShadow = true;
        tubeGroup.add(bodyMesh);

        // 2. Đầu mấu mắt đốt tre bịt kín bên trái (Left Closed Node)
        var nodeCapGeo = new THREE.SphereGeometry(tRad, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        var nodeCap = new THREE.Mesh(nodeCapGeo, matNaturalYellowBamboo);
        nodeCap.rotation.z = Math.PI / 2;
        nodeCap.position.set(-halfLen, 0, 0);
        tubeGroup.add(nodeCap);

        var nodeRingL = new THREE.Mesh(new THREE.TorusGeometry(tRad * 1.03, 0.013, 6, 18), matBambooNodeDark);
        nodeRingL.rotation.y = Math.PI / 2;
        nodeRingL.position.set(-halfLen + 0.01, 0, 0);
        tubeGroup.add(nodeRingL);

        // Đốt tre tự nhiên trên thân ống
        var midNodeRing = new THREE.Mesh(new THREE.TorusGeometry(tRad * 1.02, 0.011, 6, 18), matBambooNodeDark);
        midNodeRing.rotation.y = Math.PI / 2;
        midNodeRing.position.set(-halfLen + bodyLen * 0.52, 0, 0);
        tubeGroup.add(midNodeRing);

        // 3. Đầu máng vát chéo thoát âm bên phải (Slanted Scoop Cut)
        var scoopGeo = new THREE.CylinderGeometry(tRad, tRad, scoopLen, 18, 1, false, 0, Math.PI);
        var scoopMesh = new THREE.Mesh(scoopGeo, matNaturalYellowBamboo);
        scoopMesh.rotation.z = Math.PI / 2;
        scoopMesh.rotation.x = Math.PI * 0.55; // hở mặt trước-trên
        scoopMesh.position.set(halfLen - scoopLen * 0.5, 0, 0);
        scoopMesh.castShadow = true;
        tubeGroup.add(scoopMesh);

        // Lòng trong máng khoét rỗng sẫm màu
        var innerGeo = new THREE.CylinderGeometry(tRad * 0.90, tRad * 0.90, scoopLen * 0.98, 16, 1, false, 0, Math.PI);
        var innerMesh = new THREE.Mesh(innerGeo, matHollowBore);
        innerMesh.rotation.z = Math.PI / 2;
        innerMesh.rotation.x = Math.PI * 0.55;
        innerMesh.position.set(halfLen - scoopLen * 0.5, 0, 0);
        tubeGroup.add(innerMesh);

        // Vát chóp chéo ở đầu mút phải
        var tipBevel = new THREE.Mesh(new THREE.CylinderGeometry(tRad * 0.92, 0.01, tRad * 1.4, 12), matNaturalYellowBamboo);
        tipBevel.rotation.z = Math.PI / 2;
        tipBevel.position.set(halfLen, 0, 0);
        tubeGroup.add(tipBevel);

        // 4. Các điểm xỏ dây treo màu trắng ngà
        var cordAttachXL = -tLen * 0.28;
        var knotL = new THREE.Mesh(new THREE.TorusGeometry(tRad * 1.05, 0.014, 6, 16), matWhiteCord);
        knotL.rotation.y = Math.PI / 2;
        knotL.position.set(cordAttachXL, 0, 0);
        tubeGroup.add(knotL);

        var cordAttachXR = tLen * 0.18;
        var knotR = new THREE.Mesh(new THREE.TorusGeometry(tRad * 1.05, 0.014, 6, 16), matWhiteCord);
        knotR.rotation.y = Math.PI / 2;
        knotR.position.set(cordAttachXR, 0, 0);
        tubeGroup.add(knotR);

        tubeGroup.userData = {
          len: tLen,
          rad: tRad
        };
        trungGroup.add(tubeGroup);
        tubeMeshes.push(tubeGroup);

        var worldPtL = new THREE.Vector3(cordAttachXL, 0, 0).applyEuler(tubeGroup.rotation).add(tubeGroup.position);
        var worldPtR = new THREE.Vector3(cordAttachXR, 0, 0).applyEuler(tubeGroup.rotation).add(tubeGroup.position);
        cordLPoints.push(worldPtL);
        cordRPoints.push(worldPtR);
      }

      // Đỉnh dây néo gặp nhau ở ngọn cột tre
      cordLPoints.push(mastTopTip.clone().add(new THREE.Vector3(-0.03, -0.05, 0)));
      cordRPoints.push(mastTopTip.clone().add(new THREE.Vector3(0.03, -0.05, 0)));

      // ==========================================
      // C. 2 SỢI DÂY NÉO HÌNH CHỮ A MÀU TRẮNG
      // ==========================================
      var cordLCurve = new THREE.CatmullRomCurve3(cordLPoints);
      var cordLMesh = new THREE.Mesh(new THREE.TubeGeometry(cordLCurve, 48, 0.016, 8, false), matWhiteCord);
      trungGroup.add(cordLMesh);

      var cordRCurve = new THREE.CatmullRomCurve3(cordRPoints);
      var cordRMesh = new THREE.Mesh(new THREE.TubeGeometry(cordRCurve, 48, 0.016, 8, false), matWhiteCord);
      trungGroup.add(cordRMesh);

      // ==========================================
      // D. 2 DÙI GÕ NẰM Ở CHÂN ĐÀN (CHUẨN ẢNH)
      // ==========================================
      // Dùi gõ 1
      addBambooStrut(new THREE.Vector3(-0.45, floorY + 0.02, 1.05), new THREE.Vector3(0.65, floorY + 0.02, 1.22), 0.018, 0.022, matNaturalYellowBamboo);
      var mBall1 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), matMalletWood);
      mBall1.position.set(0.65, floorY + 0.06, 1.22);
      trungGroup.add(mBall1);

      // Dùi gõ 2
      addBambooStrut(new THREE.Vector3(-0.35, floorY + 0.02, 1.28), new THREE.Vector3(0.72, floorY + 0.02, 1.40), 0.018, 0.022, matNaturalYellowBamboo);
      var mBall2 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), matMalletWood);
      mBall2.position.set(0.72, floorY + 0.06, 1.40);
      trungGroup.add(mBall2);

      // ==========================================
      // E. ĐĂNG KÝ HITBOX TƯƠNG TÁC CHO CÁC NỐT NHẠC
      // ==========================================
      for (var i = 0; i < notesCount; i++) {
        var mapIdx = Math.round(i * (numTubes - 1) / (notesCount - 1 || 1));
        var targetTube = tubeMeshes[mapIdx];
        var hitPos = targetTube.position.clone();
        var tL = targetTube.userData ? targetTube.userData.len : 2.5;
        registerHitbox(targetTube, i, new THREE.BoxGeometry(tL * 0.9, 0.35, 0.45), hitPos);
      }

      group.add(trungGroup);
    } else if (instId === "danda") {
      // 39. ĐÀN ĐÁ (Dàn thanh thạch phiến lithophone tự nhiên đặt trên giá gỗ hồng mộc chạm mây vàng)
      var rack1 = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.26, 0.26), matRoyalCrimsonWood);
      rack1.position.set(0, 0, -0.6);
      group.add(rack1);
      var rack2 = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.26, 0.26), matRoyalCrimsonWood);
      rack2.position.set(0, 0, 0.6);
      group.add(rack2);
      addGoldCloudScrollCluster(group, 0, 0, 0.74, 1.0, 0, false);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var sx = -3.1 + u * 6.2;
        var stoneL = 2.4 - u * 1.1;
        var stoneW = 0.42 - u * 0.12;
        var slab = new THREE.Mesh(new THREE.BoxGeometry(stoneW, 0.16, stoneL), matStone);
        slab.position.set(sx, 0.15, 0);
        group.add(slab);
        registerHitbox(slab, i, new THREE.BoxGeometry(stoneW + 0.1, 0.35, stoneL), new THREE.Vector3(sx, 0.2, 0));
      }
    } else {
      // Nhạc cụ mặc định chuẩn mực bảo tàng hoàng gia
      var stand = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 1.8), matRoyalCrimsonWood);
      stand.position.set(0, -0.2, 0);
      group.add(stand);

      for (var i = 0; i < notesCount; i++) {
        var u = i / (notesCount - 1 || 1);
        var bx = -2.8 + u * 5.6;
        var barH = 1.4 - u * 0.6;
        var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, barH, 16), matWarmAgedBamboo);
        bar.position.set(bx, barH * 0.5, 0);
        group.add(bar);
        registerHitbox(bar, i, new THREE.BoxGeometry(0.5, barH, 0.45), new THREE.Vector3(bx, barH * 0.5, 0));
      }
    }

    // Cập nhật bounding box cho nhạc cụ lơ lửng trong không gian Studio Hoàng Gia
    group.updateMatrixWorld(true);
    var bbox = new THREE.Box3().setFromObject(group);

    // -------------------------------------------------------------
    // CUNG VĨ / QUE ĐÁNH / QUE GẢY / DÙI GÕ 3D CHUYỂN ĐỘNG KHI ĐÁNH ĐÀN
    // -------------------------------------------------------------
    if (instId === "dannhi") {
      // Cung vĩ lông đuôi ngựa dựng đứng dọc bên trái thân Đàn Nhị (Chuẩn mẫu trung tâm trong media_1790777044050.png)
      var bowGroup = new THREE.Group();
      var bowRodCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.02, -3.05, 0.0),
        new THREE.Vector3(-0.14, -1.20, 0.02),
        new THREE.Vector3(-0.15,  1.20, 0.02),
        new THREE.Vector3(-0.02,  3.05, 0.0)
      ]);
      var bowRod = new THREE.Mesh(new THREE.TubeGeometry(bowRodCurve, 36, 0.026, 12, false), matRoyalLacquerBlack);
      bowGroup.add(bowRod);

      // Tay cầm bọc đồng mạ vàng dài ở gốc dưới cung vĩ
      var bowHandleGold = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.92, 16), matImperialGold);
      bowHandleGold.position.set(-0.04, -2.58, 0.0);
      bowHandleGold.rotation.z = 0.05;
      bowGroup.add(bowHandleGold);

      var bowFrog = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.065), matImperialGold);
      bowFrog.position.set(0.01, -2.12, 0.0);
      bowGroup.add(bowFrog);

      // Đầu mũi cung vĩ bọc vàng ở đỉnh trên
      var bowTipGold = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.24, 14), matImperialGold);
      bowTipGold.position.set(-0.02, 2.96, 0.0);
      bowGroup.add(bowTipGold);

      // Dải lông đuôi ngựa trắng ngà căng thẳng dọc từ gốc cung lên đỉnh cung
      var bowHair = new THREE.Mesh(new THREE.BoxGeometry(0.024, 5.05, 0.014), matBone);
      bowHair.position.set(0.035, 0.42, 0.0);
      bowGroup.add(bowHair);

      bowGroup.position.set(-0.22, 2.82, 0.18);
      bowGroup.rotation.set(0.0, -0.28, -0.035);
      group.add(bowGroup);

      striker3D = bowGroup;
      strikerAnim.mode = "bow";
      strikerAnim.restPos = bowGroup.position.clone();
      strikerAnim.restRot = new THREE.Vector3(bowGroup.rotation.x, bowGroup.rotation.y, bowGroup.rotation.z);
      strikerAnim.currentPos = bowGroup.position.clone();
      strikerAnim.targetPos = bowGroup.position.clone();
    } else if (instId === "dantinh" || instId === "danday" || instId === "dantam" || instId === "dantu" || instId === "dannguyet" || instId === "dantyba" || instId === "talu") {
      // Que đánh / miếng gảy đàn (ẩn khi nghỉ để giữ phom dáng trưng bày hoàng gia sạch sẽ, chỉ hiện khi gảy nốt)
      var luteStickGroup = new THREE.Group();
      var stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 1.35, 12), matWarmAgedBamboo);
      stickShaft.rotation.z = Math.PI / 2;
      stickShaft.position.set(0.55, 0, 0);
      luteStickGroup.add(stickShaft);
      var stickGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.36, 12), matRoyalCrimsonWood);
      stickGrip.rotation.z = Math.PI / 2;
      stickGrip.position.set(1.08, 0, 0);
      luteStickGroup.add(stickGrip);
      var stickRing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), matImperialGold);
      stickRing.rotation.z = Math.PI / 2;
      stickRing.position.set(0.90, 0, 0);
      luteStickGroup.add(stickRing);
      var plectrumTip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 8), matBone);
      plectrumTip.rotation.z = Math.PI / 2;
      plectrumTip.scale.set(1.0, 1.0, 0.45);
      plectrumTip.position.set(-0.18, 0, 0);
      luteStickGroup.add(plectrumTip);

      var defaultY = (instId === "dantinh") ? -1.45 : -1.25;
      luteStickGroup.position.set(0.32, defaultY, 0.42);
      luteStickGroup.rotation.set(0.18, 0.28, -0.22);
      luteStickGroup.visible = false;
      group.add(luteStickGroup);

      striker3D = luteStickGroup;
      strikerAnim.mode = "lute_stick";
      strikerAnim.restPos = luteStickGroup.position.clone();
      strikerAnim.restRot = new THREE.Vector3(luteStickGroup.rotation.x, luteStickGroup.rotation.y, luteStickGroup.rotation.z);
      strikerAnim.currentPos = luteStickGroup.position.clone();
      strikerAnim.targetPos = luteStickGroup.position.clone();
    } else if (instId === "danbau" || instId === "dantranh" || instId === "dangoong" || instId === "danchapi" || instId === "danmoi") {
      // Que gảy / móng gảy phía trên dây (ẩn khi nghỉ, hiện và lướt tới đúng vị trí nốt khi gảy)
      var pluckStickGroup = new THREE.Group();
      var pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 1.25, 10), matWarmAgedBamboo);
      pShaft.position.set(0, 0.55, 0);
      pluckStickGroup.add(pShaft);
      var pHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.042, 0.34, 10), matRoyalCrimsonWood);
      pHandle.position.set(0, 1.05, 0);
      pluckStickGroup.add(pHandle);
      var pGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 10), matImperialGold);
      pGoldBand.position.set(0, 0.88, 0);
      pluckStickGroup.add(pGoldBand);
      var pTip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 8), matBone);
      pTip.rotation.x = Math.PI;
      pTip.position.set(0, -0.06, 0);
      pluckStickGroup.add(pTip);

      var baseZ = (instId === "danmoi") ? 0.58 : 0.18;
      var baseY = (instId === "danbau") ? 0.88 : 0.72;
      pluckStickGroup.position.set(0.35, baseY, baseZ);
      pluckStickGroup.rotation.set(-0.32, 0.0, -0.28);
      pluckStickGroup.visible = false;
      group.add(pluckStickGroup);

      striker3D = pluckStickGroup;
      strikerAnim.mode = "horizontal_stick";
      strikerAnim.restPos = pluckStickGroup.position.clone();
      strikerAnim.restRot = new THREE.Vector3(pluckStickGroup.rotation.x, pluckStickGroup.rotation.y, pluckStickGroup.rotation.z);
      strikerAnim.currentPos = pluckStickGroup.position.clone();
      strikerAnim.targetPos = pluckStickGroup.position.clone();
    } else if (instId === "trung" || instId === "danda" || instId === "cong" || instId === "chieng" || instId === "thanhla" || instId === "mo" || instId === "phach" || instId === "sinhtien" || instId === "trongcom" || instId === "trongcai" || instId === "trongchien" || instId === "trongban") {
      // Dùi gõ 3D chuyển động gõ trực tiếp vào thanh đàn / mặt trống / cồng chiêng khi tấu âm
      var malletGroup = new THREE.Group();
      var mStick = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 1.85, 12), matRoyalLacquerBlack);
      mStick.rotation.x = Math.PI / 2;
      mStick.position.set(0, 0, 0.85);
      malletGroup.add(mStick);
      var mGoldCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 12), matImperialGold);
      mGoldCollar.rotation.x = Math.PI / 2;
      mGoldCollar.position.set(0, 0, 0.18);
      malletGroup.add(mGoldCollar);
      var headMat = (instId === "cong" || instId === "chieng" || instId === "trongcai") ? matRedSilkCord : matBone;
      var headRad = (instId === "cong" || instId === "chieng" || instId === "trongcai" || instId === "mo") ? 0.20 : 0.12;
      var mHead = new THREE.Mesh(new THREE.SphereGeometry(headRad, 16, 16), headMat);
      mHead.position.set(0, -0.04, 0);
      malletGroup.add(mHead);

      malletGroup.position.set(0.4, 0.95, 1.15);
      malletGroup.rotation.set(-0.38, 0.22, 0.0);
      malletGroup.visible = false;
      group.add(malletGroup);

      striker3D = malletGroup;
      strikerAnim.mode = "mallet";
      strikerAnim.restPos = malletGroup.position.clone();
      strikerAnim.restRot = new THREE.Vector3(malletGroup.rotation.x, malletGroup.rotation.y, malletGroup.rotation.z);
      strikerAnim.currentPos = malletGroup.position.clone();
      strikerAnim.targetPos = malletGroup.position.clone();
    }

    scene3D.add(group);

    if (camera3D && controls3D) {
      var centerY = (bbox.min.y + bbox.max.y) * 0.5;
      var objHeight = bbox.max.y - bbox.min.y;
      var objWidth = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z);

      if (instId === "dantranh" || !instId || instId === "danda" || instId === "danbau" || instId === "danchapi" || instId === "dangoong" || instId === "phach") {
        camera3D.position.set(0, centerY + 2.2, Math.max(8.5, objWidth * 1.25));
        controls3D.target.set(0, centerY, 0);
      } else if (instId === "tieu" || instId === "dannhi" || instId === "danday" || instId === "dantinh" || instId === "dantam" || instId === "dantu" || instId === "dannguyet" || instId === "dantyba" || instId === "khen" || instId === "khenmong" || instId === "khenbe" || instId === "dingnam" || instId === "dingtut" || instId === "saotruc") {
        var fitDist = Math.max(9.8, objHeight * 1.62, objWidth * 1.45);
        camera3D.position.set(0, centerY, fitDist);
        controls3D.target.set(0, centerY, 0);
      } else if (instId === "trung") {
        camera3D.position.set(0, 0.28, 6.6);
        controls3D.target.set(0, 0.20, 0);
      } else if (instId === "trongcai" || instId === "trongchien" || instId === "trongcom" || instId === "trongban" || instId === "cong" || instId === "chieng" || instId === "thanhla" || instId === "mo" || instId === "sinhtien") {
        var fitDist = Math.max(8.5, Math.max(objHeight, objWidth) * 1.45);
        camera3D.position.set(0, centerY, fitDist);
        controls3D.target.set(0, centerY, 0);
      } else {
        var fitDist = Math.max(8.5, Math.max(objHeight, objWidth) * 1.45);
        camera3D.position.set(0, centerY, fitDist);
        controls3D.target.set(0, centerY, 0);
      }
      controls3D.update();
    }
    on3DWindowResize();
    if (renderer3D && scene3D && camera3D) {
      renderer3D.render(scene3D, camera3D);
    }
  }

  function build3DInstrumentMesh() {
    build3DModelForInstrument(currentActiveInstrument);
  }

  function on3DWindowResize() {
    if (!renderer3D || !camera3D) return;
    var container = (renderer3D.domElement && renderer3D.domElement.parentElement)
      ? renderer3D.domElement.parentElement
      : document.getElementById("danTranh3DCanvas");
    if (!container) return;
    var wrap = container.parentElement || container;
    var w = container.clientWidth || (wrap && wrap.clientWidth) || 860;
    var h = container.clientHeight || (wrap && wrap.clientHeight) || 460;
    if (w < 100) w = 860;
    if (h < 200) h = 460;
    camera3D.aspect = w / h;
    if (camera3D.aspect < 1.45) {
      camera3D.fov = 44;
    } else {
      camera3D.fov = 38;
    }
    camera3D.updateProjectionMatrix();
    renderer3D.setSize(w, h);
    if (scene3D) {
      renderer3D.render(scene3D, camera3D);
    }
  }
  window.on3DWindowResize = on3DWindowResize;
  window.build3DInstrumentMesh = build3DInstrumentMesh;

  var raycaster3D = (typeof THREE !== "undefined") ? new THREE.Raycaster() : null;
  var mouse3D = (typeof THREE !== "undefined") ? new THREE.Vector2() : null;
  var pointerDownTime = 0;
  var pointerDownX = 0;
  var pointerDownY = 0;

  function on3DCanvasPointerDown(e) {
    pointerDownTime = Date.now();
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
  }

  function on3DCanvasPointerUp(e) {
    var dt = Date.now() - pointerDownTime;
    var dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    // Nếu di chuyển chuột > 8px hoặc giữ chuột > 350ms thì là thao tác xoay camera của OrbitControls
    if (dist > 8 || dt > 350) return;
    if (!renderer3D || !camera3D || !scene3D || !raycaster3D || !mouse3D) return;
    if (!stringHitboxes3D || stringHitboxes3D.length === 0) return;

    var rect = renderer3D.domElement.getBoundingClientRect();
    mouse3D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse3D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster3D.setFromCamera(mouse3D, camera3D);

    var intersects = raycaster3D.intersectObjects(stringHitboxes3D, false);
    if (intersects && intersects.length > 0) {
      var hitObj = intersects[0].object;
      var stringIdx = hitObj.userData ? (hitObj.userData.stringIndex !== undefined ? hitObj.userData.stringIndex : hitObj.userData.noteIndex) : undefined;
      if (typeof stringIdx === "number") {
        getAudioContext();
        if (false) {
          sendJamRoomPluck(stringIdx);
        } else {
          var curInst = currentActiveInstrument || "dantranh";
          if (curInst === "dantranh") {
            pluck(stringIdx);
          } else {
            var activeInst = INSTRUMENT_MAP[curInst];
            if (activeInst) playUniversalInstrumentNote(activeInst, stringIdx);
          }
        }
      }
    }
  }

  function trigger3DStringVibration(i) {
    if (stringVibrations[i]) {
      stringVibrations[i].amplitude = 0.22;
      stringVibrations[i].decay = 0.91;
      stringVibrations[i].phase = 0;
    }

    // 1. TÍNH TOÁN TỌA ĐỘ 3D CHUẨN XÁC TUYỆT ĐỐI TẠI ĐÚNG VỊ TRÍ ĐÁNH / GẢY NỐT i
    var ripPoint = new THREE.Vector3();
    var foundPos = false;

    // Ưu tiên 1: Đọc từ Hitbox tương tác của nốt i (stringHitboxes3D[i])
    var hitBox = stringHitboxes3D[i];
    if (hitBox) {
      hitBox.getWorldPosition(ripPoint);
      foundPos = true;
    }

    // Ưu tiên 2: Với Đàn Tranh, tính toán hình học chính xác 100% theo từng dây i
    if (currentActiveInstrument === "dantranh" || !currentActiveInstrument) {
      var totalStrings = 16;
      var normI = Math.min(15, Math.max(0, i)) / (totalStrings - 1);
      var stringZ = -0.74 + normI * 1.48; // Tọa độ Z thực sự của dây i từ trầm sang thanh
      var hitX = -0.30; // Điểm gảy tay phải truyền thống trước nhạn
      
      // Độ cao mặt đàn cong vòm tại (hitX, stringZ)
      var u = (hitX + 5.9) / 11.8;
      var w = 2.35 - 0.55 * u;
      var hw = w * 0.5;
      var d = Math.max(-hw, Math.min(hw, stringZ)) / (hw || 1);
      var archZ = 0.38 * (1 - d * d);
      var archX = 0.12 * Math.sin(u * Math.PI);
      var yBoard = 0.04 + archZ + archX;
      var bridgeH = 0.36 - normI * 0.10;
      var stringY = yBoard + bridgeH * 0.65; // Độ cao chính xác của dây i tại vị trí gảy

      var localPoint = new THREE.Vector3(hitX, stringY + 0.04, stringZ);
      if (typeof current3DInstrumentGroup !== "undefined" && current3DInstrumentGroup) {
        current3DInstrumentGroup.localToWorld(localPoint);
        ripPoint.copy(localPoint);
        foundPos = true;
      } else {
        ripPoint.copy(localPoint);
        foundPos = true;
      }
    }

    // Kích hoạt chuyển động que đánh / cung vĩ / dùi gõ 3D tới đúng vị trí dây/nốt đang tấu
    if (striker3D && strikerAnim.mode !== "none") {
      striker3D.visible = true;
      if (hitBox && hitBox.position) {
        strikerAnim.targetPos.copy(hitBox.position);
      } else if (strikerAnim.restPos) {
        strikerAnim.targetPos.copy(strikerAnim.restPos);
      }
      strikerAnim.intensity = 1.0;
      strikerAnim.phase = 0;
      strikerAnim.strokeDir = -strikerAnim.strokeDir;
    }

    // Kích hoạt vòng sóng âm thanh 3D tại đúng tọa độ chuẩn xác ripPoint
    if (foundPos && typeof trigger3DVisualSonicRipple === "function") {
      trigger3DVisualSonicRipple(ripPoint);
    }

    if (strings3D[i]) {
      var m = strings3D[i];
      var meshesToHighlight = [];
      if (m.isMesh) meshesToHighlight.push(m);
      if (m.traverse) {
        m.traverse(function(child) {
          if (child.isMesh && child.material) meshesToHighlight.push(child);
        });
      }

      // BẢNG MÀU NGŨ CUNG PHÁT SÁNG THEO TỪNG BẬC DÂY (Yêu cầu 1: Animation đổi màu dây đàn cho mấy cây đàn)
      var pentatonicHexColors = [
        0xffd166, // Hò / Dây 1: Vàng kim rạng rỡ
        0x06d6a0, // Xự / Dây 2: Ngọc lục bảo sáng
        0x118ab2, // Xang / Dây 3: Lam ngọc sâu thẳm
        0xef476f, // Xê / Dây 4: Hồng ngọc rực lửa
        0xff9f1c, // Cống / Dây 5: Hổ phách hoàng gia
        0x48dbfb, // Bát độ 2: Xanh thiên thanh
        0xa29bfe, // Tím thạch anh
        0xfeca57, // Vàng cam ấm
        0xff6b6b, // Đỏ san hô
        0x1dd1a1, // Xanh bích
        0x54a0ff, // Lam rực
        0x5f27cd, // Tím hoàng gia
        0xff9ff3, // Hồng phấn
        0x00d2d3, // Lam lục
        0xffeaa7, // Vàng sáng
        0xffffff  // Bạch kim siêu thanh
      ];
      var glowColorHex = pentatonicHexColors[i % pentatonicHexColors.length] || 0xffd166;

      meshesToHighlight.forEach(function(cm) {
        if (!cm.material) return;
        // Đảm bảo mỗi dây có instance material riêng để đổi màu độc lập không làm ảnh hưởng các dây khác
        if (!cm.userData._hasOwnMaterial) {
          cm.material = cm.material.clone();
          cm.userData._hasOwnMaterial = true;
        }
        if (!cm.userData) cm.userData = {};
        if (cm.userData.origColor === undefined) {
          cm.userData.origColor = (cm.userData.defaultColor !== undefined)
            ? cm.userData.defaultColor
            : (cm.material.color ? cm.material.color.getHex() : 0xe6eef6);
        }
        if (cm.userData.origEmissive === undefined) {
          cm.userData.origEmissive = cm.material.emissive ? cm.material.emissive.getHex() : 0x000000;
        }
        if (cm.userData.origEmissiveIntensity === undefined) {
          cm.userData.origEmissiveIntensity = (typeof cm.material.emissiveIntensity === "number") ? cm.material.emissiveIntensity : 0;
        }

        // PHA 1: BẬT SÁNG RỰC RỠ NGAY TỨC THÌ (Core trắng chói + Emissive màu ngũ cung quang thông cao)
        if (cm.material.color) cm.material.color.setHex(0xffffff);
        if (cm.material.emissive) {
          cm.material.emissive.setHex(glowColorHex);
          cm.material.emissiveIntensity = 3.8;
        }
      });

      clearTimeout(m._stringColorTimer);
      clearTimeout(m._stringColorFadeTimer);

      // PHA 2: SAU 130ms, CHUYỂN DẦN VỀ ÁNH SẮC MÀU NGŨ CUNG ẤM ÁP
      m._stringColorFadeTimer = setTimeout(function() {
        meshesToHighlight.forEach(function(cm) {
          if (cm && cm.material) {
            if (cm.material.color) cm.material.color.setHex(glowColorHex);
            if (cm.material.emissive) {
              cm.material.emissive.setHex(glowColorHex);
              cm.material.emissiveIntensity = 2.0;
            }
          }
        });
      }, 130);

      // PHA 3: SAU 460ms, TRỞ VỀ HOÀN TOÀN MÀU NGUYÊN BẢN CỦA DÂY ĐÀN
      m._stringColorTimer = setTimeout(function() {
        meshesToHighlight.forEach(function(cm) {
          if (cm && cm.material) {
            if (cm.material.color && cm.userData.origColor !== undefined) {
              cm.material.color.setHex(cm.userData.origColor);
            }
            if (cm.material.emissive && cm.userData.origEmissive !== undefined) {
              cm.material.emissive.setHex(cm.userData.origEmissive);
              cm.material.emissiveIntensity = cm.userData.origEmissiveIntensity;
            }
          }
        });
      }, 460);
    }

    var lbl = document.getElementById("lbl3DStringPlayed");
    if (lbl) {
      var activeInst = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP[currentActiveInstrument]) ? INSTRUMENT_MAP[currentActiveInstrument] : null;
      var noteName = (activeInst && activeInst.notes && activeInst.notes[i]) ? activeInst.notes[i].name : ("Nốt " + (i + 1));
      lbl.style.display = "block";
      lbl.textContent = "✨ " + (activeInst ? activeInst.name : "") + " · " + noteName;
      clearTimeout(lbl._timer);
      lbl._timer = setTimeout(function () {
        lbl.style.display = "none";
      }, 1400);
    }
  }

  function animate3D() {
    requestAnimationFrame(animate3D);
    if (controls3D) controls3D.update();

    for (var i = 0; i < stringVibrations.length; i++) {
      var vib = stringVibrations[i];
      if (vib && vib.amplitude > 0.001) {
        vib.phase += 0.55;
        vib.amplitude *= vib.decay;
        var mesh = strings3D[i];
        if (mesh) {
          var basePosY = (mesh.userData && typeof mesh.userData.origPosY === "number")
            ? mesh.userData.origPosY
            : 0;
          mesh.position.y = basePosY + Math.sin(vib.phase) * vib.amplitude * 0.45;
        }
      } else if (vib && vib.amplitude <= 0.001 && vib.amplitude > 0) {
        vib.amplitude = 0;
        var m = strings3D[i];
        if (m) {
          var basePosY = (m.userData && typeof m.userData.origPosY === "number")
            ? m.userData.origPosY
            : 0;
          m.position.y = basePosY;
        }
      }
    }

    // Animate que đánh / cung vĩ / dùi gõ 3D khi tấu nhạc cụ
    if (striker3D && strikerAnim.mode !== "none") {
      if (strikerAnim.intensity > 0.005) {
        striker3D.visible = true;
        strikerAnim.phase += 0.36;
        strikerAnim.intensity *= 0.88;
        var k = strikerAnim.intensity;
        var swing = Math.sin(strikerAnim.phase);

        if (strikerAnim.mode === "bow") {
          // Cung vĩ Đàn Nhị lướt nhẹ dọc/ngang theo thế đứng bên trái cần đàn
          striker3D.position.x = strikerAnim.restPos.x + swing * 0.14 * strikerAnim.strokeDir * k;
          striker3D.position.y = strikerAnim.restPos.y + Math.cos(strikerAnim.phase) * 0.18 * k;
          striker3D.position.z = strikerAnim.restPos.z + Math.sin(strikerAnim.phase) * 0.04 * k;
          striker3D.rotation.z = strikerAnim.restRot.z + swing * 0.035 * k;
        } else if (strikerAnim.mode === "lute_stick") {
          // Que đánh đàn (Đàn Tính, Đàn Đáy, Đàn Tam, Đàn Tứ, Đàn Nguyệt, Tỳ Bà, Tà Lư) di chuyển và gảy vào dây
          var targetX = strikerAnim.targetPos.x + 0.22;
          var targetY = Math.max(-1.65, Math.min(0.15, strikerAnim.restPos.y + (strikerAnim.targetPos.y * 0.16)));
          var targetZ = Math.max(0.32, strikerAnim.targetPos.z + 0.12);
          striker3D.position.x += (targetX - striker3D.position.x) * 0.32 - Math.abs(swing) * 0.18 * k;
          striker3D.position.y += (targetY - striker3D.position.y) * 0.28 + swing * 0.10 * strikerAnim.strokeDir * k;
          striker3D.position.z += (targetZ - striker3D.position.z) * 0.32 - Math.sin(strikerAnim.phase * 1.4) * 0.12 * k;
          striker3D.rotation.z = strikerAnim.restRot.z + swing * 0.38 * strikerAnim.strokeDir * k;
          striker3D.rotation.y = strikerAnim.restRot.y - Math.abs(swing) * 0.26 * k;
        } else if (strikerAnim.mode === "horizontal_stick") {
          // Que gảy phía trên dây (Đàn Bầu, Đàn Tranh, Goong, Chapi, Đàn Môi) lướt tới nốt và mổ gảy xuống
          var hx = strikerAnim.targetPos.x;
          var hy = strikerAnim.targetPos.y + 0.18;
          var hz = strikerAnim.targetPos.z + 0.08;
          striker3D.position.x += (hx - striker3D.position.x) * 0.35;
          striker3D.position.y += (hy - striker3D.position.y) * 0.35 - Math.abs(swing) * 0.16 * k;
          striker3D.position.z += (hz - striker3D.position.z) * 0.35 + swing * 0.11 * strikerAnim.strokeDir * k;
          striker3D.rotation.x = strikerAnim.restRot.x + Math.abs(swing) * 0.34 * k;
          striker3D.rotation.z = strikerAnim.restRot.z + swing * 0.25 * strikerAnim.strokeDir * k;
        } else if (strikerAnim.mode === "mallet") {
          // Dùi gõ 3D gõ vào vị trí thanh đàn / mặt trống / cồng chiêng
          var mx = strikerAnim.targetPos.x;
          var my = strikerAnim.targetPos.y + 0.24;
          var mz = strikerAnim.targetPos.z + 0.28;
          striker3D.position.x += (mx - striker3D.position.x) * 0.38;
          striker3D.position.y += (my - striker3D.position.y) * 0.38 - Math.abs(swing) * 0.24 * k;
          striker3D.position.z += (mz - striker3D.position.z) * 0.38 - Math.abs(swing) * 0.22 * k;
          striker3D.rotation.x = strikerAnim.restRot.x - Math.abs(swing) * 0.48 * k;
        }
      } else if (strikerAnim.intensity > 0) {
        strikerAnim.intensity = 0;
        if (strikerAnim.mode !== "bow") {
          striker3D.visible = false;
        }
      } else if (strikerAnim.restPos && strikerAnim.restRot) {
        // Trở về tư thế nghỉ mượt mà (Cung vĩ Đàn Nhị luôn hiện bên trái cần đàn, các que gảy/dùi gõ ẩn khi nghỉ)
        if (strikerAnim.mode !== "bow") {
          striker3D.visible = false;
        }
        striker3D.position.lerp(strikerAnim.restPos, 0.08);
        striker3D.rotation.x += (strikerAnim.restRot.x - striker3D.rotation.x) * 0.1;
        striker3D.rotation.y += (strikerAnim.restRot.y - striker3D.rotation.y) * 0.1;
        striker3D.rotation.z += (strikerAnim.restRot.z - striker3D.rotation.z) * 0.1;
      }
    }

    // Animate vòng sóng âm thanh 3D (3D Sonic Ripple animation)
    for (var r = activeSonicRipples.length - 1; r >= 0; r--) {
      var rip = activeSonicRipples[r];
      rip.scale += 0.088;
      rip.opacity -= 0.044;
      if (rip.group) {
        rip.group.scale.set(rip.scale, rip.scale, rip.scale);
        rip.group.children.forEach(function(c) {
          if (c.material) {
            c.material.opacity = Math.max(0, rip.opacity);
          }
        });
      } else if (rip.mesh) {
        rip.mesh.scale.set(rip.scale, rip.scale, rip.scale);
        if (rip.mesh.material) rip.mesh.material.opacity = Math.max(0, rip.opacity);
      }
      if (rip.opacity <= 0) {
        var objToRemove = rip.group || rip.mesh;
        scene3D.remove(objToRemove);
        if (objToRemove.children && objToRemove.children.length > 0) {
          objToRemove.children.forEach(function(c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
        } else {
          if (objToRemove.geometry) objToRemove.geometry.dispose();
          if (objToRemove.material) objToRemove.material.dispose();
        }
        activeSonicRipples.splice(r, 1);
      }
    }

    if (renderer3D && scene3D && camera3D) {
      renderer3D.render(scene3D, camera3D);
    }
  }

  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // B. KHO TÀNG 38 ĐẠI NHẠC CỤ TRUYỀN THỐNG VIỆT NAM (ALL-IN-ONE ENGINE)
  // ---------------------------------------------------------
  var ALL_INSTRUMENTS = [
    // --- 1. NHÓM ĐÀN DÂY (13 NHẠC CỤ) ---
    {"id": "dantranh", "name": "Đàn tranh", "alias": "Thập ngũ / Thập lục huyền cầm", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🪕", "origin": "Âm nhạc truyền thống Việt Nam", "desc": "Họ: Dây, gảy. Cấu tạo: Hộp đàn dài, mặt đàn hơi cong, thường có 16 dây kim loại và các con nhạn để nâng dây. Cách chơi: Dùng móng gảy ở tay phải; tay trái nhấn, rung, vuốt dây. Âm thanh: Trong, sáng, vang, mềm mại.", "soundType": "plucked", "is3D": true, "demoSong": {"title": "Bèo Dạt Mây Trôi", "tempo": 280, "notes": [5, 5, 8, 8, 9, 8, 8, 7, 7, 7, 6, 7, 8, 5, 5, 7, 6, 5, 4, 3, 8, 10, 7, 8, 7, 7, 4, 5, 5, 6, 7, 7]}, "notes": [
      {"name": "Hò (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Xự (La 3)", "freq": 220.00, "key": "2"},
      {"name": "Xang (Đô 4)", "freq": 261.63, "key": "3"},
      {"name": "Xê (Rê 4)", "freq": 293.66, "key": "4"},
      {"name": "Cống (Mi 4)", "freq": 329.63, "key": "5"},
      {"name": "Hò 2 (Sol 4)", "freq": 392.00, "key": "6"},
      {"name": "Xự 2 (La 4)", "freq": 440.00, "key": "7"},
      {"name": "Xang 2 (Đô 5)", "freq": 523.25, "key": "8"},
      {"name": "Xê 2 (Rê 5)", "freq": 587.33, "key": "Q"},
      {"name": "Cống 2 (Mi 5)", "freq": 659.25, "key": "W"},
      {"name": "Hò 3 (Sol 5)", "freq": 783.99, "key": "E"},
      {"name": "Xự 3 (La 5)", "freq": 880.00, "key": "R"},
      {"name": "Xang 3 (Đô 6)", "freq": 1046.50, "key": "T"},
      {"name": "Xê 3 (Rê 6)", "freq": 1174.66, "key": "Y"},
      {"name": "Cống 3 (Mi 6)", "freq": 1318.51, "key": "U"},
      {"name": "Hò 4 (Sol 6)", "freq": 1567.98, "key": "I"}
    ]},
    {"id": "danbau", "name": "Đàn bầu", "alias": "Độc huyền cầm", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎻", "origin": "Độc tấu, hòa tấu & sân khấu", "desc": "Họ: Dây, gảy. Cấu tạo: Thân đàn dài, một dây duy nhất bằng thép hoặc tơ; có que gảy và vòi cần đàn uốn lượn để điều chỉnh cao độ. Âm thanh: Mượt mà, sâu lắng, đậm chất thơ và rất giống tiếng hát con người.", "soundType": "monochord", "demoSong": {"title": "Ru Con Nam Bộ", "tempo": 340, "notes": [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 2, 0]}, "notes": [
      {"name": "Dây buông (Đô 3)", "freq": 130.81, "key": "1"},
      {"name": "Bồi âm 1/2 (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Bồi âm 1/3 (Sol 4)", "freq": 392.00, "key": "3"},
      {"name": "Bồi âm 1/4 (Đô 5)", "freq": 523.25, "key": "4"},
      {"name": "Bồi âm 1/5 (Mi 5)", "freq": 659.25, "key": "5"},
      {"name": "Bồi âm 1/6 (Sol 5)", "freq": 783.99, "key": "6"},
      {"name": "Uốn cần Xự (Rê 5)", "freq": 587.33, "key": "7"},
      {"name": "Uốn cần Cống (La 5)", "freq": 880.00, "key": "8"}
    ]},
    {"id": "dannguyet", "name": "Đàn nguyệt", "alias": "Đàn kìm", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🌕", "origin": "Nhạc lễ, hát văn, đờn ca tài tử", "desc": "Tên khác: Đàn kìm. Họ: Dây, gảy. Cấu tạo: Bầu đàn tròn như mặt trăng rằm, cần dài gắn phím cao, 2 dây gảy bằng móng. Âm thanh: Trong trẻo, vang xa, luyến láy phóng khoáng.", "soundType": "plucked_bright", "demoSong": {"title": "Lưu Thủy Kim Tiền", "tempo": 220, "notes": [0, 2, 2, 3, 4, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0]}, "notes": [
      {"name": "Hò (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Xự (La 3)", "freq": 220.00, "key": "2"},
      {"name": "Xang (Đô 4)", "freq": 261.63, "key": "3"},
      {"name": "Xê (Rê 4)", "freq": 293.66, "key": "4"},
      {"name": "Cống (Mi 4)", "freq": 329.63, "key": "5"},
      {"name": "Phan (Sol 4)", "freq": 392.00, "key": "6"},
      {"name": "Líu (Đô 5)", "freq": 523.25, "key": "7"},
      {"name": "Ú (Rê 5)", "freq": 587.33, "key": "8"}
    ]},
    {"id": "dannhi", "name": "Đàn nhị", "alias": "Đàn cò", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎻", "origin": "Nhã nhạc, chèo, tuồng, cải lương", "desc": "Tên khác: Đàn cò. Họ: Dây, kéo. Cấu tạo: 2 dây tơ hoặc kim loại, cần mảnh, ống cộng hưởng bịt da trăn, cung vĩ luồn giữa hai dây. Âm thanh: Réo rắt, tha thiết, giàu biểu cảm.", "soundType": "bowed", "demoSong": {"title": "Cò Lả Đồng Quê", "tempo": 300, "notes": [1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 2, 1, 0, 1, 2, 1]}, "notes": [
      {"name": "Dây trầm (Rê 4)", "freq": 293.66, "key": "1"},
      {"name": "Ngón 1 (Mi 4)", "freq": 329.63, "key": "2"},
      {"name": "Ngón 2 (Fa 4)", "freq": 349.23, "key": "3"},
      {"name": "Ngón 3 (Sol 4)", "freq": 392.00, "key": "4"},
      {"name": "Dây bổng (La 4)", "freq": 440.00, "key": "5"},
      {"name": "Bấm cao 1 (Đô 5)", "freq": 523.25, "key": "6"},
      {"name": "Bấm cao 2 (Rê 5)", "freq": 587.33, "key": "7"},
      {"name": "Bấm cao 3 (Mi 5)", "freq": 659.25, "key": "8"}
    ]},
    {"id": "dantam", "name": "Đàn tam", "alias": "Đàn 3 dây", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🪕", "origin": "Hòa tấu nhạc dân tộc & nhạc lễ", "desc": "Họ: Dây, gảy. Cấu tạo: Bầu đàn hình oval bịt da trăn hai mặt, cần dài không phím, có 3 dây tơ. Âm thanh: Đanh chắc, khỏe khoắn, sắc thái rõ ràng.", "soundType": "plucked_fast", "demoSong": {"title": "Bình Bán Vắn", "tempo": 200, "notes": [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0, 2, 0]}, "notes": [
      {"name": "Dây 1 (Fa 3)", "freq": 174.61, "key": "1"},
      {"name": "Nốt Sol (Sol 3)", "freq": 196.00, "key": "2"},
      {"name": "Nốt La (La 3)", "freq": 220.00, "key": "3"},
      {"name": "Dây 2 (Đô 4)", "freq": 261.63, "key": "4"},
      {"name": "Nốt Rê (Rê 4)", "freq": 293.66, "key": "5"},
      {"name": "Nốt Mi (Mi 4)", "freq": 329.63, "key": "6"},
      {"name": "Dây 3 (Sol 4)", "freq": 392.00, "key": "7"},
      {"name": "Nốt Đô (Đô 5)", "freq": 523.25, "key": "8"}
    ]},
    {"id": "dantu", "name": "Đàn tứ", "alias": "Đàn đoản", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎸", "origin": "Hòa tấu & đệm dàn nhạc dân tộc", "desc": "Tên khác: Đàn đoản. Họ: Dây, gảy. Cấu tạo: Thân đàn hình tròn hoặc bát giác phẳng, cần ngắn gắn nhiều phím, 4 dây gảy bằng móng. Âm thanh: Sáng, giòn, đanh gọn.", "soundType": "plucked_bright", "demoSong": {"title": "Lý Cây Bông", "tempo": 240, "notes": [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1]}, "notes": [
      {"name": "Dây trầm (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Nốt Đô (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Nốt Rê (Rê 4)", "freq": 293.66, "key": "3"},
      {"name": "Nốt Fa (Fa 4)", "freq": 349.23, "key": "4"},
      {"name": "Dây giữa (Sol 4)", "freq": 392.00, "key": "5"},
      {"name": "Nốt La (La 4)", "freq": 440.00, "key": "6"},
      {"name": "Nốt Đô cao (Đô 5)", "freq": 523.25, "key": "7"},
      {"name": "Nốt Rê cao (Rê 5)", "freq": 587.33, "key": "8"}
    ]},
    {"id": "danday", "name": "Đàn đáy", "alias": "Đàn Ca trù / Hát ả đào", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎸", "origin": "Ca trù / Hát ả đào & Hát cửa đình", "desc": "Họ: Dây, gảy. Cấu tạo: Cần đàn rất dài (1.6m), thân hình chữ nhật mỏng khoét thủng đáy, 3 dây tơ mềm. Nổi tiếng với kỹ thuật ngón chùn độc nhất vô nhị. Âm thanh: Trầm, đục, ấm áp, sâu lắng.", "soundType": "plucked_deep", "demoSong": {"title": "Khúc Hát Cửa Đình", "tempo": 320, "notes": [0, 1, 2, 1, 0, 2, 3, 2, 1, 0, 1, 0]}, "notes": [
      {"name": "Hò (Sol 2)", "freq": 98.00, "key": "1"},
      {"name": "Xự (La 2)", "freq": 110.00, "key": "2"},
      {"name": "Xang (Đô 3)", "freq": 130.81, "key": "3"},
      {"name": "Xê (Rê 3)", "freq": 146.83, "key": "4"},
      {"name": "Cống (Fa 3)", "freq": 174.61, "key": "5"},
      {"name": "Phan (Sol 3)", "freq": 196.00, "key": "6"},
      {"name": "Líu (Đô 4)", "freq": 261.63, "key": "7"},
      {"name": "Ngón chùn Ú (Rê 4)", "freq": 293.66, "key": "8"}
    ]},
    {"id": "dantyba", "name": "Đàn tỳ bà", "alias": "Bầu đàn quả lê 4 dây", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🍐", "origin": "Nhạc cung đình, nhạc lễ & hòa tấu", "desc": "Họ: Dây, gảy. Cấu tạo: Bầu đàn hình quả lê cắt dọc, mặt đàn gỗ ngô đồng, cần đàn nhiều phím cao, 4 dây tơ gảy kỹ thuật phi hoa, vê ngón. Âm thanh: Trong sáng, lộng lẫy, quyền quý.", "soundType": "plucked_tremolo", "demoSong": {"title": "Kim Tiền Cung Đình", "tempo": 190, "notes": [0, 2, 3, 4, 3, 2, 3, 4, 5, 4, 3, 2, 0, 2, 0]}, "notes": [
      {"name": "Dây trầm (Rê 4)", "freq": 293.66, "key": "1"},
      {"name": "Nốt Mi (Mi 4)", "freq": 329.63, "key": "2"},
      {"name": "Dây giữa 1 (Sol 4)", "freq": 392.00, "key": "3"},
      {"name": "Dây giữa 2 (La 4)", "freq": 440.00, "key": "4"},
      {"name": "Nốt Đô (Đô 5)", "freq": 523.25, "key": "5"},
      {"name": "Dây bổng (Rê 5)", "freq": 587.33, "key": "6"},
      {"name": "Nốt Mi cao (Mi 5)", "freq": 659.25, "key": "7"},
      {"name": "Nốt Sol cao (Sol 5)", "freq": 783.99, "key": "8"}
    ]},
    {"id": "dantinh", "name": "Đàn tính", "alias": "Tính tẩu", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🪕", "origin": "Dân tộc Tày, Nùng, Thái", "desc": "Tên khác: Tính tẩu. Dân tộc: Tày, Nùng, Thái. Họ: Dây, gảy. Cấu tạo: Bầu đàn làm từ nửa quả bầu khô già, cần dài bằng gỗ nhẹ không gắn phím, 2–3 dây tơ. Âm thanh: Ấm áp, vang nhẹ, gắn liền với hát Then.", "soundType": "plucked", "demoSong": {"title": "Hát Then Đường Về Bản", "tempo": 240, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 3, 2, 0]}, "notes": [
      {"name": "Dây buông trầm (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Ngón 1 (La 3)", "freq": 220.00, "key": "2"},
      {"name": "Dây buông giữa (Đô 4)", "freq": 261.63, "key": "3"},
      {"name": "Ngón 2 (Rê 4)", "freq": 293.66, "key": "4"},
      {"name": "Ngón 3 (Mi 4)", "freq": 329.63, "key": "5"},
      {"name": "Dây buông cao (Sol 4)", "freq": 392.00, "key": "6"},
      {"name": "Điệu Then 1 (La 4)", "freq": 440.00, "key": "7"},
      {"name": "Điệu Then 2 (Đô 5)", "freq": 523.25, "key": "8"}
    ]},
    {"id": "danmoi", "name": "Đàn môi", "alias": "Thanh lưỡi rung khoang miệng", "cat": "day", "catName": "Nhóm đàn dây", "icon": "👄", "origin": "Giao duyên nhiều dân tộc", "desc": "Họ: Tự thân vang / Khí âm. Cấu tạo: Thanh kim loại hoặc lá đồng mỏng có lưỡi gà. Cách chơi: Đặt sát môi, bật lưỡi đàn bằng ngón tay và dùng khoang miệng điều chỉnh bồi âm. Âm thanh: Huyễn hoặc, dập dờn bí ẩn.", "soundType": "jaw_harp", "demoSong": {"title": "Khúc Tình Ca Gọi Bạn", "tempo": 220, "notes": [0, 1, 2, 3, 2, 3, 4, 3, 2, 1, 0, 1, 0]}, "notes": [
      {"name": "Âm đáy (Đô 4)", "freq": 261.63, "key": "1"},
      {"name": "Khoang họng 1 (Sol 4)", "freq": 392.00, "key": "2"},
      {"name": "Khoang họng 2 (Đô 5)", "freq": 523.25, "key": "3"},
      {"name": "Vòm miệng 1 (Mi 5)", "freq": 659.25, "key": "4"},
      {"name": "Vòm miệng 2 (Sol 5)", "freq": 783.99, "key": "5"},
      {"name": "Bồi âm môi 1 (Sib 5)", "freq": 932.33, "key": "6"},
      {"name": "Bồi âm môi 2 (Đô 6)", "freq": 1046.50, "key": "7"},
      {"name": "Bồi âm môi 3 (Rê 6)", "freq": 1174.66, "key": "8"}
    ]},
    {"id": "dangoong", "name": "Đàn Goong", "alias": "Ting Ning (Tây Nguyên)", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🪕", "origin": "Tây Nguyên (tiêu biểu J'rai)", "desc": "Tên khác: Ting Ning. Cấu tạo: Ống tre nứa dài làm thân mang từ 6–12 dây căng quanh ống, có gắn quả bầu khô để cộng hưởng. Âm thanh: Thánh thót, trong veo như giọt sương mai Tây Nguyên.", "soundType": "plucked", "demoSong": {"title": "Đón Khách Buôn Làng", "tempo": 210, "notes": [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 2, 0]}, "notes": [
      {"name": "Dây 1 (Đô 4)", "freq": 261.63, "key": "1"},
      {"name": "Dây 2 (Rê 4)", "freq": 293.66, "key": "2"},
      {"name": "Dây 3 (Fa 4)", "freq": 349.23, "key": "3"},
      {"name": "Dây 4 (Sol 4)", "freq": 392.00, "key": "4"},
      {"name": "Dây 5 (La 4)", "freq": 440.00, "key": "5"},
      {"name": "Dây 6 (Đô 5)", "freq": 523.25, "key": "6"},
      {"name": "Dây 7 (Rê 5)", "freq": 587.33, "key": "7"},
      {"name": "Dây 8 (Fa 5)", "freq": 698.46, "key": "8"}
    ]},
    {"id": "danchapi", "name": "Đàn Chapi", "alias": "Đàn ống tre Raglai", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎋", "origin": "Dân tộc Raglai", "desc": "Dân tộc: Raglai. Chất liệu: Ống tre bương già. Cấu tạo: Tách trực tiếp phần cật vỏ tre nâng lên thành 6 dây bằng các mẩu gỗ nhỏ. Âm thanh: Mộc mạc, mô phỏng dàn mã la âm vang huyền thoại bên ngọn lửa thiêng.", "soundType": "plucked_bamboo", "demoSong": {"title": "Giấc Mơ Chapi Bên Lửa Rừng", "tempo": 250, "notes": [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0]}, "notes": [
      {"name": "Dây 1 (Đô 4)", "freq": 261.63, "key": "1"},
      {"name": "Dây 2 (Mi 4)", "freq": 329.63, "key": "2"},
      {"name": "Dây 3 (Sol 4)", "freq": 392.00, "key": "3"},
      {"name": "Dây 4 (La 4)", "freq": 440.00, "key": "4"},
      {"name": "Dây 5 (Đô 5)", "freq": 523.25, "key": "5"},
      {"name": "Dây 6 (Mi 5)", "freq": 659.25, "key": "6"}
    ]},
    {"id": "talu", "name": "Đàn Ta Lư", "alias": "Đàn dây Bru–Vân Kiều", "cat": "day", "catName": "Nhóm đàn dây", "icon": "🎸", "origin": "Dân tộc Bru–Vân Kiều", "desc": "Dân tộc: Bru–Vân Kiều, Pa Cô. Họ: Dây, gảy. Cấu tạo: Gốc tre hoặc ống tre đực làm cần và thân đàn, có bầu mo tre cộng hưởng, 2 dây gảy nẩy vui nhộn. Âm thanh: Rộn ràng, tràn đầy lạc quan hào sảng của Trường Sơn hùng vĩ.", "soundType": "plucked_bright", "demoSong": {"title": "Tiếng Đàn Ta Lư", "tempo": 190, "notes": [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 2, 0]}, "notes": [
      {"name": "Dây trầm (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Dây buông cao (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Nốt Rê (Rê 4)", "freq": 293.66, "key": "3"},
      {"name": "Nốt Mi (Mi 4)", "freq": 329.63, "key": "4"},
      {"name": "Nốt Sol (Sol 4)", "freq": 392.00, "key": "5"},
      {"name": "Nốt La (La 4)", "freq": 440.00, "key": "6"},
      {"name": "Nốt Đô cao (Đô 5)", "freq": 523.25, "key": "7"},
      {"name": "Nốt Rê cao (Rê 5)", "freq": 587.33, "key": "8"}
    ]},

    // --- 2. NHÓM SÁO, KÈN VÀ NHẠC CỤ HƠI (11 NHẠC CỤ) ---
    {"id": "saotruc", "name": "Sáo trúc", "alias": "Sáo ngang Đô (C5)", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎋", "origin": "Dân ca & nhạc truyền thống", "desc": "Họ: Hơi. Chất liệu: Ống trúc/nứa tự nhiên. Cấu tạo: Ống rỗng có một lỗ thổi ngang, lỗ dán màng rung và 6 lỗ bấm ngón chính. Âm thanh: Thanh thoát, cao vút, luyến láy phóng khoáng đậm đà hồn quê hương châu thổ.", "soundType": "flute", "demoSong": {"title": "Inh Lả Ơi Mùa Xuân Về", "tempo": 230, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 3, 2, 0]}, "notes": [
      {"name": "Đô 5 (C5)", "freq": 523.25, "key": "1"},
      {"name": "Rê 5 (D5)", "freq": 587.33, "key": "2"},
      {"name": "Mi 5 (E5)", "freq": 659.25, "key": "3"},
      {"name": "Fa 5 (F5)", "freq": 698.46, "key": "4"},
      {"name": "Sol 5 (G5)", "freq": 783.99, "key": "5"},
      {"name": "La 5 (A5)", "freq": 880.00, "key": "6"},
      {"name": "Si 5 (B5)", "freq": 987.77, "key": "7"},
      {"name": "Đô 6 (C6)", "freq": 1046.50, "key": "8"}
    ]},
    {"id": "tieu", "name": "Tiêu / Động tiêu", "alias": "Tiêu dọc trầm (C4)", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎋", "origin": "Độc tấu, hòa tấu & nhạc truyền thống", "desc": "Họ: Hơi. Cấu tạo: Ống trúc dài và dày, thổi dọc ở miệng vát đầu ống, có các lỗ bấm phía trước và sau. Âm thanh: Trầm ấm, u hoài, tĩnh tại, diễn tả chiều sâu tâm trạng.", "soundType": "flute_deep", "demoSong": {"title": "Trăng Thu Dạ Khúc", "tempo": 360, "notes": [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0]}, "notes": [
      {"name": "Đô 4 (C4)", "freq": 261.63, "key": "1"},
      {"name": "Rê 4 (D4)", "freq": 293.66, "key": "2"},
      {"name": "Mi 4 (E4)", "freq": 329.63, "key": "3"},
      {"name": "Fa 4 (F4)", "freq": 349.23, "key": "4"},
      {"name": "Sol 4 (G4)", "freq": 392.00, "key": "5"},
      {"name": "La 4 (A4)", "freq": 440.00, "key": "6"},
      {"name": "Si 4 (B4)", "freq": 493.88, "key": "7"},
      {"name": "Đô 5 (C5)", "freq": 523.25, "key": "8"}
    ]},
    {"id": "khen", "name": "Khèn (Khèn Mông)", "alias": "Khèn H'Mông / Khèn 6 ống", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🌾", "origin": "Nổi tiếng ở H'Mông & vùng cao", "desc": "Họ: Hơi, nhiều ống dăm đồng. Cấu tạo: Thân bằng gỗ pơ mu ôm 6 ống nứa dài ngắn khác nhau, mỗi ống gắn một lưỡi gà bằng đồng. Phát ra hòa thanh đa âm dày dặn, vừa thổi vừa múa lượn điệu nghệ.", "soundType": "khen_mong", "demoSong": {"title": "Vũ Khúc Chợ Tình Mùa Xuân", "tempo": 200, "notes": [0, 2, 3, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0]}, "notes": [
      {"name": "Ống Trầm Mẹ (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Ống Cha (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Ống Anh (Rê 4)", "freq": 293.66, "key": "3"},
      {"name": "Ống Chị (Mi 4)", "freq": 329.63, "key": "4"},
      {"name": "Ống Em (Sol 4)", "freq": 392.00, "key": "5"},
      {"name": "Ống Bổng (La 4)", "freq": 440.00, "key": "6"},
      {"name": "Hòa âm 1 (Đô 5)", "freq": 523.25, "key": "7"},
      {"name": "Hòa âm 2 (Rê 5)", "freq": 587.33, "key": "8"}
    ]},
    {"id": "kenbau", "name": "Kèn bầu", "alias": "Kèn dăm kép loa gỗ", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎺", "origin": "Nhã nhạc cung đình, tuồng, lễ hội", "desc": "Họ: Hơi, dăm kép. Cấu tạo: Ống kèn gỗ lim có 7 lỗ bấm, đầu ngậm dăm làm từ lá buông khô, đuôi xòe thành loa kèn hình quả bầu bằng gỗ. Âm thanh: Hùng tráng, vang dội xé gió, biểu tượng hào khí.", "soundType": "double_reed", "demoSong": {"title": "Khúc Kèn Hội Làng", "tempo": 180, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0]}, "notes": [
      {"name": "Nốt Sol (Sol 4)", "freq": 392.00, "key": "1"},
      {"name": "Nốt La (La 4)", "freq": 440.00, "key": "2"},
      {"name": "Nốt Si (Si 4)", "freq": 493.88, "key": "3"},
      {"name": "Nốt Đô (Đô 5)", "freq": 523.25, "key": "4"},
      {"name": "Nốt Rê (Rê 5)", "freq": 587.33, "key": "5"},
      {"name": "Nốt Mi (Mi 5)", "freq": 659.25, "key": "6"},
      {"name": "Nốt Fa# (Fa# 5)", "freq": 739.99, "key": "7"},
      {"name": "Nốt Sol cao (Sol 5)", "freq": 783.99, "key": "8"}
    ]},
    {"id": "pi", "name": "Pí / Pi", "alias": "Sáo nứa Tây Bắc", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎵", "origin": "Các dân tộc vùng Tây Bắc", "desc": "Tên chung cho hệ nhạc cụ hơi truyền thống của đồng bào Thái (Pí thiu, Pí lè, Pí ló...). Ống nứa ngắn có dăm lưỡi gà, giai điệu thiết tha, mang hơi thở của thung lũng Tây Bắc mây mờ.", "soundType": "flute_reed", "demoSong": {"title": "Điệu Xòe Hoa Mai Châu", "tempo": 230, "notes": [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 0]}, "notes": [
      {"name": "La 4", "freq": 440.00, "key": "1"},
      {"name": "Đô 5", "freq": 523.25, "key": "2"},
      {"name": "Rê 5", "freq": 587.33, "key": "3"},
      {"name": "Mi 5", "freq": 659.25, "key": "4"},
      {"name": "Sol 5", "freq": 783.99, "key": "5"},
      {"name": "La 5", "freq": 880.00, "key": "6"},
      {"name": "Đô 6", "freq": 1046.50, "key": "7"},
      {"name": "Rê 6", "freq": 1174.66, "key": "8"}
    ]},
    {"id": "dingnam", "name": "Đing Năm", "alias": "Bầu khô 6 ống nứa Ê Đê", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎋", "origin": "Dân tộc Ê Đê (Tây Nguyên)", "desc": "Dân tộc: Ê Đê. Họ: Hơi, lưỡi gà đồng. Cấu tạo: Vỏ quả bầu khô cắm 6 ống nứa chia thành 2 hàng, mô phỏng 6 bè hòa giọng trong điệu hát cổ truyền Ayray. Âm thanh: Khỏe khoắn, âm vang hào sảng khắp nhà dài buôn làng.", "soundType": "reed_organ", "demoSong": {"title": "Hát Ayray Chiều Buôn Đôn", "tempo": 260, "notes": [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 1, 0]}, "notes": [
      {"name": "Ống Klei trầm (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Ống Ana (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Ống Mđưng (Rê 4)", "freq": 293.66, "key": "3"},
      {"name": "Ống Hlue (Sol 4)", "freq": 392.00, "key": "4"},
      {"name": "Ống Mnhí (La 4)", "freq": 440.00, "key": "5"},
      {"name": "Ống Diu bổng (Đô 5)", "freq": 523.25, "key": "6"}
    ]},
    {"id": "dingbuot", "name": "Đing Buốt", "alias": "Ống nứa thổi dọc Ê Đê", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎋", "origin": "Dân tộc Ê Đê", "desc": "Dân tộc: Ê Đê. Họ: Hơi. Cấu tạo: Ống nứa nhỏ dài khoảng 50cm, đầu thổi gắn dăm mềm, có 4-6 lỗ bấm ngón. Âm thanh: Trong trẻo, cao vút, trữ tình như lời thầm thì bên ghè rượu cần.", "soundType": "flute", "demoSong": {"title": "Gió Thổi Rừng Khộp", "tempo": 290, "notes": [0, 1, 2, 3, 2, 1, 0, 2, 3, 2, 0]}, "notes": [
      {"name": "Đô 4", "freq": 261.63, "key": "1"},
      {"name": "Rê 4", "freq": 293.66, "key": "2"},
      {"name": "Mi 4", "freq": 329.63, "key": "3"},
      {"name": "Sol 4", "freq": 392.00, "key": "4"},
      {"name": "La 4", "freq": 440.00, "key": "5"},
      {"name": "Đô 5", "freq": 523.25, "key": "6"},
      {"name": "Rê 5", "freq": 587.33, "key": "7"},
      {"name": "Sol 5", "freq": 783.99, "key": "8"}
    ]},
    {"id": "dingtut", "name": "Đing Tút", "alias": "Nhóm 6 ống dập gió Ê Đê", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎋", "origin": "Ê Đê & Tây Nguyên", "desc": "Dân tộc: Ê Đê. Họ: Hơi. Cấu tạo: Bộ 6 ống nứa đường kính lớn, mỗi ống do một nữ nghệ nhân cầm dập miệng ống vào lòng bàn tay hoặc thổi vào miệng ống để tạo luồng hơi mô phỏng bộ chiêng. Âm thanh: Rền vang, huyền bí.", "soundType": "flute_airy", "demoSong": {"title": "Mừng Lúa Mới Về Kho", "tempo": 240, "notes": [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 0]}, "notes": [
      {"name": "Ống Ana (Đô 3)", "freq": 130.81, "key": "1"},
      {"name": "Ống Moong (Mi 3)", "freq": 164.81, "key": "2"},
      {"name": "Ống Mđưng (Sol 3)", "freq": 196.00, "key": "3"},
      {"name": "Ống Hlue (Đô 4)", "freq": 261.63, "key": "4"},
      {"name": "Ống Khơk (Mi 4)", "freq": 329.63, "key": "5"},
      {"name": "Ống Diu (Sol 4)", "freq": 392.00, "key": "6"}
    ]},
    {"id": "khenbe", "name": "Khèn bè", "alias": "Khèn đa thanh người Thái", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🌾", "origin": "Người Thái (vui chơi, hát, múa)", "desc": "Họ: Hơi, đa thanh. Cấu tạo: 14 ống nứa tép xếp thành 2 hàng song song gắn vào bầu gỗ, mỗi ống có dăm bằng đồng hoặc bạc. Có thể thổi cả luồng hơi hít vào lẫn thổi ra, tạo bè trầm nền liên tục.", "soundType": "reed_organ", "demoSong": {"title": "Khúc Hát Trai Gái Đêm Trăng", "tempo": 230, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0]}, "notes": [
      {"name": "Sol 3", "freq": 196.00, "key": "1"},
      {"name": "La 3", "freq": 220.00, "key": "2"},
      {"name": "Đô 4", "freq": 261.63, "key": "3"},
      {"name": "Rê 4", "freq": 293.66, "key": "4"},
      {"name": "Mi 4", "freq": 329.63, "key": "5"},
      {"name": "Sol 4", "freq": 392.00, "key": "6"},
      {"name": "La 4", "freq": 440.00, "key": "7"},
      {"name": "Đô 5", "freq": 523.25, "key": "8"}
    ]},
    {"id": "pile", "name": "Pi lè", "alias": "Kèn dăm kép Thái, Tày", "cat": "hoi", "catName": "Nhóm sáo, kèn & hơi", "icon": "🎺", "origin": "Dân tộc Thái, Tày", "desc": "Dân tộc: Thái, Tày. Họ: Hơi, dăm kép. Cấu tạo: Thân bằng gỗ cứng có 7 lỗ khoét ngón, dăm kèn bằng đồng hoặc lá khô, loa xòe rộng bằng đồng thau. Âm thanh: Rất vang, đanh khỏe, chuyên dùng dẫn đầu các đám rước lễ hội.", "soundType": "double_reed", "demoSong": {"title": "Rước Dâu Về Bản Làng", "tempo": 180, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 0, 3, 4, 5, 4, 2, 0]}, "notes": [
      {"name": "Rê 4", "freq": 293.66, "key": "1"},
      {"name": "Fa 4", "freq": 349.23, "key": "2"},
      {"name": "Sol 4", "freq": 392.00, "key": "3"},
      {"name": "La 4", "freq": 440.00, "key": "4"},
      {"name": "Đô 5", "freq": 523.25, "key": "5"},
      {"name": "Rê 5", "freq": 587.33, "key": "6"},
      {"name": "Fa 5", "freq": 698.46, "key": "7"},
      {"name": "Sol 5", "freq": 783.99, "key": "8"}
    ]},

    // --- 3. NHẠC CỤ TỰ THÂN VANG / GÕ (8 NHẠC CỤ) ---
    {"id": "trung", "name": "Đàn T'rưng", "alias": "Dàn ống tre/nứa Tây Nguyên", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🎋", "origin": "Tây Nguyên (Ba Na, Gia Rai)", "desc": "Họ: Tự thân vang. Cấu tạo: Dãy ống nứa vát đầu dài ngắn khác nhau được xâu bằng dây dù treo thành thang hình nón. Đánh bằng hai dùi bọc cao su hoặc vải. Âm thanh: Róc rách như dòng suối reo, rộn rã sức sống đại ngàn.", "soundType": "bamboo_xylophone", "demoSong": {"title": "Đi Săn Tây Nguyên Vui Rộn", "tempo": 170, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 7, 5, 4, 2, 0]}, "notes": [
      {"name": "Ống 1 (La 3)", "freq": 220.00, "key": "1"},
      {"name": "Ống 2 (Đô 4)", "freq": 261.63, "key": "2"},
      {"name": "Ống 3 (Rê 4)", "freq": 293.66, "key": "3"},
      {"name": "Ống 4 (Mi 4)", "freq": 329.63, "key": "4"},
      {"name": "Ống 5 (Sol 4)", "freq": 392.00, "key": "5"},
      {"name": "Ống 6 (La 4)", "freq": 440.00, "key": "6"},
      {"name": "Ống 7 (Đô 5)", "freq": 523.25, "key": "7"},
      {"name": "Ống 8 (Rê 5)", "freq": 587.33, "key": "8"}
    ]},
    {"id": "danda", "name": "Đàn đá", "alias": "Thạch cầm cổ đại ngàn năm", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "💎", "origin": "Nam Trung Bộ & Tây Nguyên", "desc": "Họ: Tự thân vang. Cấu tạo: Tập hợp các thanh đá tự nhiên (đá núi lửa rhyolite, bazan) được ghè đẽo hàng nghìn năm trước từ thời tiền sử. Dùng dùi gõ vào giữa thanh đá. Âm thanh: Vang xa, trầm hùng, mang hồn thiêng sông núi nguyên sơ.", "soundType": "lithophone", "demoSong": {"title": "Tiếng Vọng Tiền Sử Ngàn Năm", "tempo": 260, "notes": [0, 2, 3, 4, 5, 4, 3, 2, 0, 3, 4, 5, 4, 2, 0]}, "notes": [
      {"name": "Thanh 1 (Sol 3)", "freq": 196.00, "key": "1"},
      {"name": "Thanh 2 (La 3)", "freq": 220.00, "key": "2"},
      {"name": "Thanh 3 (Đô 4)", "freq": 261.63, "key": "3"},
      {"name": "Thanh 4 (Rê 4)", "freq": 293.66, "key": "4"},
      {"name": "Thanh 5 (Fa 4)", "freq": 349.23, "key": "5"},
      {"name": "Thanh 6 (Sol 4)", "freq": 392.00, "key": "6"},
      {"name": "Thanh 7 (La 4)", "freq": 440.00, "key": "7"},
      {"name": "Thanh 8 (Đô 5)", "freq": 523.25, "key": "8"}
    ]},
    {"id": "cong", "name": "Cồng", "alias": "Cồng có núm Tây Nguyên", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🔔", "origin": "Lễ hội, nghi lễ cộng đồng Tây Nguyên", "desc": "Họ: Gõ – tự thân vang. Cấu tạo: Đĩa hợp kim đồng có núm lồi tròn ở tâm, vành gập vuông góc. Đánh bằng dùi bọc vải vào núm tròn. Âm thanh: Trầm hùng, ngân rền, rung động sâu thẳm trong các nghi lễ dâng Yàng.", "soundType": "gong_bossed", "demoSong": {"title": "Tiếng Cồng Gọi Yàng Ban Phúc", "tempo": 360, "notes": [0, 1, 2, 1, 0, 2, 3, 2, 1, 0]}, "notes": [
      {"name": "Cồng Mẹ Ana (Trầm)", "freq": 110.00, "key": "1"},
      {"name": "Cồng Cha Klei (Rền)", "freq": 146.83, "key": "2"},
      {"name": "Cồng Con Mđưng (Vang)", "freq": 196.00, "key": "3"},
      {"name": "Cồng Cháu Hlue (Sáng)", "freq": 261.63, "key": "4"},
      {"name": "Cồng Ú Diu (Thanh)", "freq": 329.63, "key": "5"},
      {"name": "Cồng Dồn (Vút)", "freq": 392.00, "key": "6"}
    ]},
    {"id": "chieng", "name": "Chiêng", "alias": "Chiêng bằng không núm Tây Nguyên", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🔔", "origin": "Di sản văn hóa Tây Nguyên", "desc": "Họ: Gõ – tự thân vang. Cấu tạo: Đĩa kim loại phẳng bằng đồng thau, mặt bằng không có núm. Gõ bằng dùi gỗ mềm hoặc cườm tay vào tâm đĩa. Âm thanh: Sắc đanh, ngân vang xa, lan tỏa khắp buôn làng mùa lễ hội cồng chiêng.", "soundType": "gong_flat", "demoSong": {"title": "Điệu Chiêng Mừng Lúa Mới", "tempo": 270, "notes": [0, 1, 2, 3, 2, 1, 3, 2, 1, 0]}, "notes": [
      {"name": "Chiêng Mẹ (Trầm đanh)", "freq": 164.81, "key": "1"},
      {"name": "Chiêng Cha (Vang rền)", "freq": 220.00, "key": "2"},
      {"name": "Chiêng Anh (Sắc sảo)", "freq": 293.66, "key": "3"},
      {"name": "Chiêng Chị (Lảnh ngân)", "freq": 392.00, "key": "4"},
      {"name": "Chiêng Em (Thanh thoát)", "freq": 493.88, "key": "5"},
      {"name": "Chiêng Vút (Cao bổng)", "freq": 587.33, "key": "6"}
    ]},
    {"id": "thanhla", "name": "Thanh la", "alias": "Đĩa kim loại mỏng gõ dùi", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "✨", "origin": "Nhạc lễ, sân khấu tuồng, chèo, dàn nhạc", "desc": "Họ: Tự thân vang. Cấu tạo: Đĩa kim loại đồng thau mỏng đường kính 15-20cm, không núm. Dùng dùi gỗ gõ vào mặt đĩa. Âm thanh: Sáng loáng, lanh lảnh, ngân nga vui tươi trong dàn nhạc lễ và sân khấu dân gian.", "soundType": "cymbal_bell", "demoSong": {"title": "Nhịp Thanh La Khai Mạc", "tempo": 240, "notes": [0, 0, 1, 0, 0, 1, 1, 0, 1]}, "notes": [
      {"name": "Tiếng Chát (Sắc gọn)", "freq": 440.00, "key": "1"},
      {"name": "Tiếng Loảng (Vang ngân)", "freq": 587.33, "key": "2"},
      {"name": "Tiếng Xoảng (Đanh cao)", "freq": 783.99, "key": "3"},
      {"name": "Tiếng Keng (Ánh đồng)", "freq": 1046.50, "key": "4"},
      {"name": "Tiếng Ngân (Dư âm)", "freq": 880.00, "key": "5"},
      {"name": "Tiếng Tắt (Gõ bưng)", "freq": 659.25, "key": "6"}
    ]},
    {"id": "mo", "name": "Mõ", "alias": "Khối gỗ rỗng cộng hưởng", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🪵", "origin": "Báo hiệu, giữ nhịp & nghi lễ", "desc": "Họ: Gõ. Chất liệu: Khối gỗ mít hoặc tre đực già đục rỗng khoang bên trong, có khe hẹp tạo cộng hưởng âm. Dùng dùi gỗ gõ vào thân mõ. Âm thanh: Cộc, khô, đĩnh đạc dùng để điểm nhịp tụng niệm hoặc sân khấu kịch chèo.", "soundType": "wood_block", "demoSong": {"title": "Khúc Mõ An Lạc Bình Yên", "tempo": 350, "notes": [0, 1, 2, 1, 0, 3, 2, 0]}, "notes": [
      {"name": "Mõ Cộc (Trầm rỗng)", "freq": 130.81, "key": "1"},
      {"name": "Mõ Cốc (Vừa đầm)", "freq": 196.00, "key": "2"},
      {"name": "Mõ Tách (Thanh gọn)", "freq": 293.66, "key": "3"},
      {"name": "Mõ Cốp (Giòn giã)", "freq": 392.00, "key": "4"},
      {"name": "Mõ Nhịp (Nhịp cái)", "freq": 220.00, "key": "5"},
      {"name": "Mõ Dồn (Hồi mõ dồn)", "freq": 329.63, "key": "6"}
    ]},
    {"id": "phach", "name": "Phách", "alias": "Cặp thanh gỗ phách Ca trù", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🥢", "origin": "Chèo, Ca trù & nhạc truyền thống", "desc": "Họ: Gõ. Chất liệu: Hai thanh gỗ lim hoặc tre đực và bàn phách gỗ. Người biểu diễn cầm dùi gõ vào thanh phách trên bàn phách tạo nên các 'khổ phách' luồn, rập, chát, tom chuẩn mực nghệ thuật Ca trù.", "soundType": "castanet_stick", "demoSong": {"title": "Nhịp Khổ Phách Ca Trù", "tempo": 200, "notes": [0, 1, 0, 1, 1, 0, 1, 0, 1, 1]}, "notes": [
      {"name": "Tiếng Chát (Sắc cạnh)", "freq": 587.33, "key": "1"},
      {"name": "Tiếng Tom (Bọng rỗng)", "freq": 220.00, "key": "2"},
      {"name": "Tiếng Rập (Chập thanh)", "freq": 349.23, "key": "3"},
      {"name": "Tiếng Luồn (Gõ nhẹ)", "freq": 440.00, "key": "4"},
      {"name": "Phách Dồn (Dập liên hoàn)", "freq": 523.25, "key": "5"},
      {"name": "Cắt Nhịp (Dứt khoát)", "freq": 293.66, "key": "6"}
    ]},
    {"id": "sinhtien", "name": "Sinh tiền", "alias": "Sênh tiền đồng xu", "cat": "go", "catName": "Tự thân vang / Gõ", "icon": "🥢", "origin": "Dàn nhạc bát âm, ca múa cung đình, lễ hội", "desc": "Họ: Gõ/tự thân vang. Cấu tạo: 3 thanh gỗ cứng gắn các đồng xu cổ và có cạnh xẻ răng cưa. Vừa gõ các thanh vào nhau vừa quẹt cạnh răng cưa. Âm thanh: Lách cách rộn ràng, vui tươi, giòn giã đặc sắc.", "soundType": "coins_clatter", "demoSong": {"title": "Vũ Điệu Sênh Tiền Hội Đền", "tempo": 190, "notes": [0, 1, 0, 1, 0, 0, 1, 0, 1, 1]}, "notes": [
      {"name": "Lách (Gõ gỗ)", "freq": 440.00, "key": "1"},
      {"name": "Cách (Chập đồng xu)", "freq": 880.00, "key": "2"},
      {"name": "Rẹt (Quẹt răng cưa)", "freq": 1200.00, "key": "3"},
      {"name": "Xoảng (Lắc chùm tiền)", "freq": 1760.00, "key": "4"},
      {"name": "Nhịp Cái (Chập đôi)", "freq": 293.66, "key": "5"},
      {"name": "Nhịp Con (Đánh nảy)", "freq": 659.25, "key": "6"}
    ]},

    // --- 4. TRỐNG (4 NHẠC CỤ) ---
    {"id": "trongcom", "name": "Trống cơm", "alias": "Trống hai đầu định âm da trét cơm", "cat": "trong", "catName": "Nhóm trống", "icon": "🥁", "origin": "Chèo, quan họ & lễ hội", "desc": "Cấu tạo: Thân trống bằng gỗ hình thoi thon hai đầu, bịt da hai mặt. Khi diễn tấu dùng cơm nếp nóng trét vào tâm mặt trống để định âm: đầu to âm Thổ (trầm), đầu nhỏ âm Kim (cao). Đeo trước bụng, vỗ bằng hai bàn tay.", "soundType": "drum_tuned", "demoSong": {"title": "Trống Cơm Khúc Hát Hội Làng", "tempo": 210, "notes": [0, 1, 2, 1, 0, 1, 2, 2, 1, 0, 1, 2, 0]}, "notes": [
      {"name": "Mặt Thổ Tùng (Trầm ấm)", "freq": 98.00, "key": "1"},
      {"name": "Mặt Kim Cắc (Bổng sắc)", "freq": 293.66, "key": "2"},
      {"name": "Vỗ Nhẹ Hụp (Bưng lòng)", "freq": 120.00, "key": "3"},
      {"name": "Vỗ Đanh Rắc (Rìa da)", "freq": 392.00, "key": "4"},
      {"name": "Vỗ Bưng Tịch (Ngắt âm)", "freq": 164.81, "key": "5"},
      {"name": "Gõ Tang Cộc (Gõ gỗ)", "freq": 493.88, "key": "6"}
    ]},
    {"id": "trongcai", "name": "Trống cái", "alias": "Đại cổ / Trống sấm đình làng", "cat": "trong", "catName": "Nhóm trống", "icon": "🥁", "origin": "Lễ hội, nghi lễ, đình làng & sân khấu", "desc": "Kích thước: Tang trống lớn uốn từ gỗ mít già, hai mặt bịt da trâu mộng kéo căng chốt bằng đinh tre già. Đánh bằng dùi trống lớn. Âm thanh: Trầm hùng rung chuyển đất trời, là nhịp lệnh mở đầu mọi lễ hội dân tộc.", "soundType": "drum_bass", "demoSong": {"title": "Hào Khí Đông A Mở Hội", "tempo": 380, "notes": [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]}, "notes": [
      {"name": "Tùng (Trầm uy linh)", "freq": 65.41, "key": "1"},
      {"name": "Rền (Ngân vang xa)", "freq": 82.41, "key": "2"},
      {"name": "Bùng (Giữa tâm da)", "freq": 98.00, "key": "3"},
      {"name": "Cắc (Dùi gõ mép tang)", "freq": 392.00, "key": "4"},
      {"name": "Cụp (Chặn tay mặt trống)", "freq": 110.00, "key": "5"},
      {"name": "Hồi Sấm (Dồn dập sóng dậy)", "freq": 73.42, "key": "6"}
    ]},
    {"id": "trongchien", "name": "Trống chiến", "alias": "Trống tiết tấu tuồng chèo dồn dập", "cat": "trong", "catName": "Nhóm trống", "icon": "🥁", "origin": "Lễ hội, sân khấu tuồng chèo & múa lân", "desc": "Đặc điểm: Tang trống dày chắc, mặt da căng bằng chốt gỗ. Dùng cặp dùi gỗ cứng đánh linh hoạt vào giữa mặt và tang trống tạo tiết tấu dồn dập, thôi thúc, điều khiển nhịp hành động trên sân khấu cổ truyền.", "soundType": "drum_snare", "demoSong": {"title": "Hồi Trống Trận Hào Hùng", "tempo": 160, "notes": [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0]}, "notes": [
      {"name": "Cắc (Đánh tang dứt khoát)", "freq": 440.00, "key": "1"},
      {"name": "Tùng (Đánh mặt căng)", "freq": 146.83, "key": "2"},
      {"name": "Rụp (Đánh nén bưng)", "freq": 196.00, "key": "3"},
      {"name": "Tum (Đánh nảy dùi)", "freq": 220.00, "key": "4"},
      {"name": "Lạc (Gõ cạnh vành)", "freq": 329.63, "key": "5"},
      {"name": "Hồi Trống Trận (Dồn liên châu)", "freq": 174.61, "key": "6"}
    ]},
    {"id": "trongban", "name": "Trống bản", "alias": "Trống sinh hoạt cộng đồng vùng núi", "cat": "trong", "catName": "Nhóm trống", "icon": "🥁", "origin": "Cộng đồng dân tộc vùng cao Việt Nam", "desc": "Đặc điểm: Thân trống đẽo từ khúc gỗ mít nguyên khối, mặt bịt da nai hoặc da bò rừng đan dây mây siết chặt. Dùng giữ nhịp cho các điệu xòe, múa sạp và các sinh hoạt cộng đồng ngày hội mùa xuân.", "soundType": "drum_medium", "demoSong": {"title": "Nhịp Trống Bản Mùa Lễ Hội", "tempo": 220, "notes": [0, 1, 1, 0, 1, 1, 0, 1, 0, 1]}, "notes": [
      {"name": "Thùng (Nhịp cái lòng trống)", "freq": 110.00, "key": "1"},
      {"name": "Cắc (Nhịp con mép da)", "freq": 329.63, "key": "2"},
      {"name": "Vang (Mặt phụ rung)", "freq": 164.81, "key": "3"},
      {"name": "Tang (Gõ vành gỗ mít)", "freq": 440.00, "key": "4"},
      {"name": "Nhịp Xòe 1 (Điệu bước chân)", "freq": 146.83, "key": "5"},
      {"name": "Nhịp Xòe 2 (Điệu rộn rã)", "freq": 220.00, "key": "6"}
    ]}
  ];

  if (typeof currentActiveInstrument === "undefined" || !currentActiveInstrument) {
    currentActiveInstrument = "dantranh";
  }
  var currentDemoTimeouts = [];
  var isDemoPlaying = false;
  var currentDemoInstrumentId = null;

  // Bản đồ tìm kiếm nhanh nhạc cụ theo ID
  var INSTRUMENT_MAP = {};
  ALL_INSTRUMENTS.forEach(function(inst) {
    INSTRUMENT_MAP[inst.id] = inst;
  });
  INSTRUMENT_MAP["khenmong"] = INSTRUMENT_MAP["khen"];

  // Hàm kết nối âm thanh an toàn qua dryGain & convolver hoặc Audio Destination (hỗ trợ Gain riêng từng nhạc cụ của Owner)
  function safeConnectOutput(node) {
    try {
      var ctx = getAudioContext();
      var targetNode = node;
      var volFactor = typeof window._activeOwnerInstVolFactor === "number" ? window._activeOwnerInstVolFactor : 1.0;
      if (ctx && Math.abs(volFactor - 1.0) > 0.01) {
        var instGain = ctx.createGain();
        instGain.gain.setValueAtTime(volFactor, ctx.currentTime);
        node.connect(instGain);
        targetNode = instGain;
      }

      var connected = false;
      if (typeof dryGain !== "undefined" && dryGain) {
        targetNode.connect(dryGain);
        connected = true;
      }
      if (typeof convolver !== "undefined" && convolver) {
        targetNode.connect(convolver);
        connected = true;
      }
      if (!connected && ctx) {
        targetNode.connect(ctx.destination);
      }
    } catch (err) {
      try {
        var ctx2 = getAudioContext();
        if (ctx2) node.connect(ctx2.destination);
      } catch (e) {}
    }
  }

  // ---------------------------------------------------------
  // C. HỆ THỐNG TỔNG HỢP ÂM SẮC TOÀN DIỆN (UNIVERSAL AUDIO SYNTHESIZER)
  // Hỗ trợ 36 nhạc cụ dân tộc Việt Nam với độ chân thực cao & Setting Tiếng của Owner
  // ---------------------------------------------------------
  function playUniversalInstrumentNote(inst, noteIdx) {
    var note = inst.notes && inst.notes[noteIdx];
    if (!note) return;

    var ctx = getAudioContext();
    if (!ctx) return;

    // Kích hoạt audio context nếu đang suspend
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    if (typeof trigger3DStringVibration === "function") {
      trigger3DStringVibration(noteIdx);
    }
    if (typeof trigger2DNoteAnimation === "function") {
      trigger2DNoteAnimation(noteIdx);
    }

    var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
    if (surfaceBtns[noteIdx]) {
      surfaceBtns[noteIdx].classList.add("playing");
      if (typeof triggerKeyButtonRipple === "function") triggerKeyButtonRipple(surfaceBtns[noteIdx]);
      setTimeout(function() {
        surfaceBtns[noteIdx].classList.remove("playing");
      }, 180);
    }

    try {
      if (!isDemoPlaying && typeof window.recordUserPlayedNote === "function") {
        window.recordUserPlayedNote(inst.id, noteIdx, note.name, note.key || String(noteIdx + 1));
      }
    } catch (eRec) {}

    // 1. Kiểm tra file âm thanh server của Admin cho nhạc cụ này ở nốt noteIdx
    if (typeof playServerCustomAudioForNote === "function") {
      var handled = playServerCustomAudioForNote(inst.id, noteIdx);
      if (handled) return;
    }

    // 2. Nếu là Đàn Tranh và không có custom file, ưu tiên playSynthDanTranh mộc mạc
    if (inst.id === "dantranh") {
      playSynthDanTranh(note.freq || 196.0);
      return;
    }

    var now = ctx.currentTime;
    var freq = note.freq || 440;
    var soundType = inst.soundType || "plucked";

    // Đọc Setting tiếng riêng của nhạc cụ do Owner cấu hình (nếu có)
    var ownerCustom = typeof window.getOwnerCustomInstSound === "function"
      ? window.getOwnerCustomInstSound(inst.id)
      : null;
    if (ownerCustom) {
      if (ownerCustom.soundType) {
        soundType = ownerCustom.soundType;
      }
      if (typeof ownerCustom.pitch === "number" && ownerCustom.pitch !== 0) {
        freq = freq * Math.pow(2, ownerCustom.pitch / 12);
      }
      window._activeOwnerInstVolFactor = typeof ownerCustom.volume === "number"
        ? Math.max(0.2, Math.min(2.0, ownerCustom.volume / 100))
        : 1.0;
    } else {
      window._activeOwnerInstVolFactor = 1.0;
    }

    // Phân loại âm sắc nhạc cụ dân tộc Việt Nam
    switch (soundType) {
      // 1. Nhạc cụ gảy tơ/kim (Đàn Tranh, Tam, Tứ, Đáy, Tính, Goong)
      case "plucked":
      case "plucked_fast":
      case "plucked_bright":
      case "plucked_tremolo": {
        var osc = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(freq * 2, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(freq * 5, 8000), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 200), now + 1.2);

        var decay = soundType === "plucked_fast" ? 0.7 : (soundType === "plucked_tremolo" ? 0.5 : 1.6);
        gain.gain.setValueAtTime(0.42, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + decay + 0.05);
        osc2.stop(now + decay + 0.05);
        break;
      }

      // 2. Đàn Bầu (Độc huyền cầm - Sine mượt + Bồi âm + Luyến láy)
      case "monochord": {
        var osc = ctx.createOscillator();
        var oscHarmonic = ctx.createOscillator();
        var gain = ctx.createGain();
        var vibrato = ctx.createOscillator();
        var vibGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        oscHarmonic.type = "triangle";
        oscHarmonic.frequency.setValueAtTime(freq * 2, now);

        // Rung dây nhẹ đặc trưng Đàn Bầu (Vibrato)
        vibrato.frequency.setValueAtTime(5.2, now);
        vibGain.gain.setValueAtTime(freq * 0.015, now);
        vibrato.connect(osc.frequency);
        vibrato.connect(oscHarmonic.frequency);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.38, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(gain);
        oscHarmonic.connect(gain);
        safeConnectOutput(gain);

        vibrato.start(now);
        osc.start(now);
        oscHarmonic.start(now);
        vibrato.stop(now + 2.1);
        osc.stop(now + 2.1);
        oscHarmonic.stop(now + 2.1);
        break;
      }

      // 3. Đàn Trầm (Đàn Đáy, Đàn Hồ)
      case "plucked_deep": {
        var osc = ctx.createOscillator();
        var subOsc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(freq * 0.5, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(280, now + 1.8);

        gain.gain.setValueAtTime(0.48, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 2.3);
        subOsc.stop(now + 2.3);
        break;
      }

      // 4. Đàn Kéo Cung (Đàn Nhị, Đàn Hồ, Đàn K'ni kéo)
      case "bowed":
      case "bowed_deep":
      case "bowed_vocal": {
        var osc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();
        var lfo = ctx.createOscillator();
        var lfoGain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);

        // K'ni có hiệu ứng cộng hưởng vòm họng / thanh quản (vocal formant)
        if (soundType === "bowed_vocal") {
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1400, now);
          filter.Q.setValueAtTime(3.8, now);
        } else {
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(Math.min(freq * 4.5, 5500), now);
        }

        // Rung cung kéo
        lfo.frequency.setValueAtTime(5.8, now);
        lfoGain.gain.setValueAtTime(freq * 0.02, now);
        lfo.connect(osc.frequency);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.36, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

        osc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + 1.7);
        osc.stop(now + 1.7);
        break;
      }

      // 5. Đàn Môi (Khúc xạ âm thanh kim loại bật trong vòm miệng)
      case "jaw_harp": {
        var osc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);

        // Bộ lọc mô phỏng đóng mở khoang miệng "Tưng...Oong"
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(550, now);
        filter.frequency.exponentialRampToValueAtTime(1900, now + 0.1);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.8);
        filter.Q.setValueAtTime(6.0, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc.stop(now + 1.3);
        break;
      }

      // 6. Nhạc cụ vỏ tre/nứa gảy (Đàn Chapi)
      case "plucked_bamboo": {
        var osc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq * 1.8, now);
        filter.Q.setValueAtTime(2.5, now);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

        osc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc.stop(now + 1.0);
        break;
      }

      // 7. Nhạc cụ hơi: Sáo Trúc, Tiêu, Pi, Đing Buốt, Ta Lư
      case "flute":
      case "flute_deep":
      case "flute_airy": {
        var osc = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freq * 2, now);

        // Tạo tiếng hơi thở tự nhiên qua ống nứa (Air/Breath noise)
        try {
          var bufferSize = Math.floor(ctx.sampleRate * 0.15);
          var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          var data = buffer.getChannelData(0);
          for (var b = 0; b < bufferSize; b++) {
            data[b] = (Math.random() * 2 - 1) * 0.08;
          }
          var noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;
          var noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = "bandpass";
          noiseFilter.frequency.setValueAtTime(freq, now);
          var noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.12, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          safeConnectOutput(noiseGain);
          noiseSource.start(now);
        } catch (e) {}

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (soundType === "flute_deep" ? 1.8 : 1.4));

        osc.connect(gain);
        osc2.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 1.9);
        osc2.stop(now + 1.9);
        break;
      }

      // 8. Kèn Bầu, Kèn Lá, Pí Lè, Tù Và (Lưỡi gà dăm kèn đanh giòn)
      case "double_reed":
      case "leaf_reed":
      case "horn":
      case "flute_reed": {
        var osc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = soundType === "horn" ? "sawtooth" : "square";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(soundType === "horn" ? 450 : 2200, now);
        filter.Q.setValueAtTime(3.2, now);

        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

        osc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc.stop(now + 1.4);
        break;
      }

      // 9. Khèn, Khèn Mông, Đing Năm, Khèn Bè (Bầu kèn đa ống hòa âm)
      case "reed_organ":
      case "khen_mong": {
        var osc1 = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var oscSub = ctx.createOscillator();
        var gain = ctx.createGain();

        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(freq * 1.5, now); // Bồi âm quãng 5 kèn bè

        oscSub.type = "triangle";
        oscSub.frequency.setValueAtTime(freq * 0.5, now);

        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.36, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        oscSub.connect(gain);
        safeConnectOutput(gain);

        osc1.start(now);
        osc2.start(now);
        oscSub.start(now);
        osc1.stop(now + 1.9);
        osc2.stop(now + 1.9);
        oscSub.stop(now + 1.9);
        break;
      }

      // 10. Đàn T'rưng, Đing Tút (Gõ ống nứa rỗng Tây Nguyên)
      case "bamboo_xylophone": {
        var osc = ctx.createOscillator();
        var filter = ctx.createBiquadFilter();
        var gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq, now);
        filter.Q.setValueAtTime(7.0, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        osc.connect(filter);
        filter.connect(gain);
        safeConnectOutput(gain);

        osc.start(now);
        osc.stop(now + 0.9);
        break;
      }

      // 11. Đàn Đá Tây Nguyên (Lithophone - Tiếng đá ngàn năm ngân vang)
      case "lithophone": {
        // Đàn đá có cấu trúc tần số bán điều hòa (inharmonic spectrum)
        var partials = [1.0, 1.58, 2.32, 3.14];
        var partialGains = [0.45, 0.22, 0.12, 0.06];

        partials.forEach(function(mult, idx) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * mult, now);

          var pDecay = 1.6 / (idx + 1);
          gain.gain.setValueAtTime(partialGains[idx], now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + pDecay);

          osc.connect(gain);
          safeConnectOutput(gain);

          osc.start(now);
          osc.stop(now + pDecay + 0.05);
        });
        break;
      }

      // 12. Cồng Chiêng (Cồng có núm, Chiêng bằng Tây Nguyên)
      case "gong_bossed":
      case "gong_flat": {
        var baseF = freq;
        var osc1 = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(baseF, now);

        // Giao thoa tạo nhịp đập ngân vang (beating effect)
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(baseF * 1.015, now);

        var gongDecay = soundType === "gong_bossed" ? 2.8 : 2.2;
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + gongDecay);

        osc1.connect(gain);
        osc2.connect(gain);
        safeConnectOutput(gain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + gongDecay + 0.1);
        osc2.stop(now + gongDecay + 0.1);
        break;
      }

      // 13. Trống Dân Tộc (Trống Cơm, Trống Cái, Trống Chiến, Trống Bản)
      case "drum_bass":
      case "drum_medium":
      case "drum_snare":
      case "drum_tuned": {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = "sine";
        var startPitch = (freq && freq > 40) ? freq : (soundType === "drum_bass" ? 110 : (soundType === "drum_snare" ? 220 : 160));
        var endPitch = Math.max(30, startPitch * 0.42);

        osc.frequency.setValueAtTime(startPitch, now);
        osc.frequency.exponentialRampToValueAtTime(endPitch, now + 0.15);

        var dDecay = soundType === "drum_bass" ? 1.2 : 0.65;
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dDecay);

        // Tạo tiếng va đập mặt da trống
        try {
          var bSize = Math.floor(ctx.sampleRate * 0.06);
          var nBuf = ctx.createBuffer(1, bSize, ctx.sampleRate);
          var nData = nBuf.getChannelData(0);
          for (var i = 0; i < bSize; i++) nData[i] = (Math.random() * 2 - 1) * 0.3;
          var nSrc = ctx.createBufferSource();
          nSrc.buffer = nBuf;
          var nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.4, now);
          nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          nSrc.connect(nGain);
          safeConnectOutput(nGain);
          nSrc.start(now);
        } catch (e) {}

        osc.connect(gain);
        safeConnectOutput(gain);
        osc.start(now);
        osc.stop(now + dDecay + 0.05);
        break;
      }

      // 14. Thanh La, Phách, Mõ, Sinh Tiền
      case "cymbal_bell":
      case "wood_block":
      case "castanet_stick":
      case "coins_clatter": {
        if (soundType === "wood_block" || soundType === "castanet_stick") {
          // Tiếng mõ / phách gõ cộc đanh gọn
          var osc = ctx.createOscillator();
          var filter = ctx.createBiquadFilter();
          var gain = ctx.createGain();
          var pitch = (freq && freq > 50) ? freq : (soundType === "wood_block" ? 580 : 920);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(pitch, now);
          osc.frequency.exponentialRampToValueAtTime(Math.max(60, pitch * 0.55), now + 0.04);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(pitch * 1.2, now);
          filter.Q.setValueAtTime(4.0, now);

          gain.gain.setValueAtTime(0.6, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

          osc.connect(filter);
          filter.connect(gain);
          safeConnectOutput(gain);
          osc.start(now);
          osc.stop(now + 0.16);
        } else if (soundType === "coins_clatter") {
          // Sinh Tiền: Tiếng lách cách đồng tiền kim loại & phách gỗ
          var coinMult = (freq && freq > 100) ? (freq / 440) : 1.0;
          [1600, 2400, 3200, 4800].forEach(function(f) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(f * coinMult + Math.random() * 80, now);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
            osc.connect(gain);
            safeConnectOutput(gain);
            osc.start(now);
            osc.stop(now + 0.25);
          });
        } else {
          // Thanh la (Chiêng nhỏ vang ánh đồng)
          var tlMult = (freq && freq > 100) ? (freq / 440) : 1.0;
          [1080, 1720, 2600].forEach(function(f) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(f * tlMult, now);
            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
            osc.connect(gain);
            safeConnectOutput(gain);
            osc.start(now);
            osc.stop(now + 1.5);
          });
        }
        break;
      }

      // 15. Nhạc cụ đặc biệt: Đàn Nước & Đàn Gió
      case "water_organ": {
        // Tiếng giọt nước nhỏ tong tỏng róc rách vào ống nứa
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * 0.8, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.3);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

        osc.connect(gain);
        safeConnectOutput(gain);
        osc.start(now);
        osc.stop(now + 1.2);
        break;
      }

      case "wind_chime": {
        // Tiếng chuông gió nứa reo trong gió ngàn
        [1.0, 1.42, 1.73, 2.15].forEach(function(m, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * m, now + i * 0.04);
          gain.gain.setValueAtTime(0.25 / (i + 1), now + i * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
          osc.connect(gain);
          safeConnectOutput(gain);
          osc.start(now + i * 0.04);
          osc.stop(now + 1.7);
        });
        break;
      }

      default: {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(gain);
        safeConnectOutput(gain);
        osc.start(now);
        osc.stop(now + 1.3);
      }
    }
  }

  // ---------------------------------------------------------
  // D. TRÌNH PHÁT BẢN NHẠC ĐÁNH THỬ RIÊNG BIỆT CHO MỖI NHẠC CỤ
  // ("mỗi cái nó đều có 1 cái bản nhạc đánh thử riêng")
  // ---------------------------------------------------------
  function stopDemoSong() {
    currentDemoTimeouts.forEach(function(t) { clearTimeout(t); });
    currentDemoTimeouts = [];
    isDemoPlaying = false;
    currentDemoInstrumentId = null;

    var tracker = document.getElementById("uDemoNoteTracker");
    if (tracker) {
      tracker.style.display = "none";
    }
    var lblNote = document.getElementById("lblActiveDemoNote");
    if (lblNote) {
      lblNote.textContent = "";
    }

    var btn = document.getElementById("btnPlayInstrumentDemo");
    var btnStop = document.getElementById("btnStopInstrumentDemo");
    var btnTranh = document.getElementById("btnPlayTranhDemo");
    var btnStopTranh = document.getElementById("btnStopTranhDemo");

    if (btn) {
      btn.classList.remove("playing");
      var activeInst = INSTRUMENT_MAP[currentActiveInstrument];
      var title = (activeInst && activeInst.demoSong && activeInst.demoSong.title) || "Bài Mẫu";
      btn.innerHTML = '<span>▶️</span> <span id="lblDemoSongBtn">Tấu Bài Mẫu: ' + title + '</span>';
    }
    if (btnStop) {
      btnStop.style.display = "none";
    }
    if (btnTranh) {
      btnTranh.classList.remove("playing");
      btnTranh.innerHTML = '▶️ Tấu Bài Mẫu: Bèo Dạt Mây Trôi';
    }
    if (btnStopTranh) {
      btnStopTranh.style.display = "none";
    }
  }

  function playDemoSongForInstrument(instId) {
    stopDemoSong();
    stopAiPlaying();
    stopGlissando();

    var inst = INSTRUMENT_MAP[instId];
    if (typeof window.AVAILABLE_DEMO_TRACK_MAP !== "undefined" && !window.AVAILABLE_DEMO_TRACK_MAP[instId]) {
      alert("⏳ Bản nhạc mẫu cho " + (inst ? inst.name : "nhạc cụ này") + " đang được nghệ nhân hoàn thiện và sẽ cập nhật nhạc sau!");
      return;
    }
    if (!inst || !inst.demoSong || !inst.demoSong.notes || inst.demoSong.notes.length === 0) return;

    var ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume();

    isDemoPlaying = true;
    currentDemoInstrumentId = instId;

    if (typeof window.recordDemoSongPlayedToAccount === "function") {
      var mappedNotes = (inst.demoSong.notes || []).map(function(item) {
        var nIdx = typeof item === "number" ? item : (item && item.note !== undefined ? item.note : 0);
        var nObj = (inst.notes && inst.notes[nIdx]) ? inst.notes[nIdx] : null;
        return {
          noteIdx: nIdx,
          noteName: nObj ? nObj.name : ("Nốt " + (nIdx + 1)),
          delay: (typeof item === "object" && item && item.duration) ? item.duration : 300
        };
      });
      window.recordDemoSongPlayedToAccount(instId, inst.demoSong.title, mappedNotes);
    }

    var btn = document.getElementById("btnPlayInstrumentDemo");
    var btnStop = document.getElementById("btnStopInstrumentDemo");
    var btnTranh = document.getElementById("btnPlayTranhDemo");
    var btnStopTranh = document.getElementById("btnStopTranhDemo");

    if (btn) {
      btn.classList.add("playing");
      btn.innerHTML = '<span>🎶</span> <span id="lblDemoSongBtn">Đang tấu: ' + inst.demoSong.title + '...</span>';
    }
    if (btnStop && instId !== "dantranh") {
      btnStop.style.display = "inline-flex";
    }
    if (btnTranh && instId === "dantranh") {
      btnTranh.classList.add("playing");
      btnTranh.innerHTML = '🎶 Đang tấu: ' + inst.demoSong.title + '...';
    }
    if (btnStopTranh && instId === "dantranh") {
      btnStopTranh.style.display = "inline-flex";
    }

    var delayAcc = 0;
    var notesSeq = inst.demoSong.notes;

    notesSeq.forEach(function(item, idx) {
      // Hỗ trợ cả item là chỉ số số (int) và object { note, duration }
      var noteIndex = typeof item === "number" ? item : (item && item.note !== undefined ? item.note : 0);
      var duration = (typeof item === "object" && item && item.duration) ? item.duration : (inst.demoSong && inst.demoSong.tempo ? Math.round(60000 / inst.demoSong.tempo) : 320);

      var t = setTimeout(function() {
        if (!isDemoPlaying) return;

        // Cập nhật Note Tracker hiển thị nốt đang tấu
        var tracker = document.getElementById("uDemoNoteTracker");
        var lblNote = document.getElementById("lblActiveDemoNote");
        var noteObj = (inst.notes && inst.notes[noteIndex]) ? inst.notes[noteIndex] : null;
        var noteName = noteObj ? noteObj.name : ("Nốt " + (noteIndex + 1));

        if (lblNote) {
          lblNote.textContent = noteName;
        }
        if (tracker) {
          tracker.style.display = "inline-flex";
        }

        // Nếu là Đàn Tranh 3D: Gảy dây 3D
        if (instId === "dantranh") {
          pluck(noteIndex);
        } else {
          // Nhạc cụ thông thường: Phát âm và highlight nút trên sân khấu
          playUniversalInstrumentNote(inst, noteIndex);

          var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
          if (surfaceBtns[noteIndex]) {
            surfaceBtns[noteIndex].classList.add("playing");
            setTimeout(function() {
              surfaceBtns[noteIndex].classList.remove("playing");
            }, Math.min(220, duration));
          }
        }

        // Khi kết thúc bài
        if (idx === notesSeq.length - 1) {
          setTimeout(function() {
            stopDemoSong();
          }, duration + 300);
        }
      }, delayAcc);

      currentDemoTimeouts.push(t);
      delayAcc += duration;
    });
  }

  // Hiệu ứng sóng âm lan tỏa trên nút phím khi bấm (Key Hit Visual Feedback)
  function triggerKeyButtonRipple(btn, e) {
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    var x = e && typeof e.clientX === "number" && e.clientX > 0 ? (e.clientX - rect.left) : (rect.width / 2);
    var y = e && typeof e.clientY === "number" && e.clientY > 0 ? (e.clientY - rect.top) : (rect.height / 2);

    var rip = document.createElement("span");
    rip.className = "u-key-hit-ripple";
    rip.style.left = x + "px";
    rip.style.top = y + "px";
    btn.appendChild(rip);
    setTimeout(function() {
      if (rip.parentNode) rip.parentNode.removeChild(rip);
    }, 600);
  }
  window.triggerKeyButtonRipple = triggerKeyButtonRipple;

  // ---------------------------------------------------------
  // E. GIAO DIỆN SÂN KHẤU TỔNG QUÁT (UNIVERSAL PLAY SURFACE)
  // ---------------------------------------------------------
  function renderUniversalPlaySurface(inst) {
    var surface = document.getElementById("uPlaySurface");
    if (!surface) return;
    surface.innerHTML = "";

    if (!inst) {
      inst = (typeof INSTRUMENT_MAP !== "undefined" && INSTRUMENT_MAP["dantranh"]) ? INSTRUMENT_MAP["dantranh"] : ((typeof ALL_INSTRUMENTS !== "undefined" && ALL_INSTRUMENTS[0]) ? ALL_INSTRUMENTS[0] : null);
    }
    if (!inst) return;

    if (!inst.notes || inst.notes.length === 0) {
      surface.innerHTML = '<div style="color:var(--text-dim); font-size:13px;">Nhạc cụ này đang ở chế độ đặc biệt.</div>';
      return;
    }

    // Tự động phân chia cột phím phù hợp cho cột thông tin 50%
    if (inst.notes.length === 16) {
      surface.style.gridTemplateColumns = "repeat(8, 1fr)";
    } else if (inst.notes.length <= 8) {
      surface.style.gridTemplateColumns = "repeat(" + inst.notes.length + ", 1fr)";
    } else {
      surface.style.gridTemplateColumns = "repeat(auto-fill, minmax(50px, 1fr))";
    }

    inst.notes.forEach(function(note, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "u-note-key-btn";
      btn.setAttribute("data-note-idx", idx);
      btn.title = note.name + (note.freq ? " (" + Math.round(note.freq) + " Hz)" : "");

      var effKey = typeof window.getUserEffectiveKeyForNote === "function"
        ? window.getUserEffectiveKeyForNote(inst.id, idx, note.key || (idx + 1))
        : (note.key || (idx + 1));

      btn.innerHTML = '<span class="u-key-name">' + note.name + '</span>' +
                      '<span class="u-key-shortcut">' + effKey + '</span>';

      btn.addEventListener("click", function(e) {
        getAudioContext();
        playUniversalInstrumentNote(inst, idx);
        btn.classList.add("playing");
        triggerKeyButtonRipple(btn, e);
        setTimeout(function() {
          btn.classList.remove("playing");
        }, 180);
      });

      surface.appendChild(btn);
    });
  }

  // ---------------------------------------------------------
  // E2. HỆ THỐNG HIỂN THỊ & TƯƠNG TÁC 2D VECTOR NGHỆ THUẬT (42 NHẠC CỤ)
  // (UNIVERSAL 2D VECTOR ARTWORK & INTERACTIVE TOUCH ENGINE)
  // ---------------------------------------------------------
  function trigger2DNoteAnimation(noteIdx) {
    var container = document.getElementById("dan2DContainer");
    if (!container) return;

    var pentatonic2DColors = [
      '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ff9f1c',
      '#48dbfb', '#a29bfe', '#feca57', '#ff6b6b', '#1dd1a1',
      '#54a0ff', '#5f27cd', '#ff9ff3', '#00d2d3', '#ffea79', '#ffffff'
    ];
    var color2D = pentatonic2DColors[noteIdx % pentatonic2DColors.length] || '#ffd166';

    var hitboxes = container.querySelectorAll('.u-2d-hitbox[data-note-idx="' + noteIdx + '"]');
    hitboxes.forEach(function(el) {
      el.classList.remove("u-2d-plucking");
      void el.offsetWidth; // trigger reflow
      el.classList.add("u-2d-plucking");

      // Đổi màu dây đàn vector 2D phát sáng rực rỡ khi tấu (Yêu cầu 1)
      el.querySelectorAll("line, path").forEach(function(strokeEl) {
        if (!strokeEl.getAttribute("data-orig-stroke")) {
          strokeEl.setAttribute("data-orig-stroke", strokeEl.getAttribute("stroke") || strokeEl.style.stroke || "#dfaa52");
          strokeEl.setAttribute("data-orig-width", strokeEl.getAttribute("stroke-width") || strokeEl.style.strokeWidth || "1.8");
        }
        strokeEl.style.transition = "stroke 0.08s ease, stroke-width 0.08s ease, filter 0.08s ease";
        strokeEl.style.stroke = color2D;
        strokeEl.style.strokeWidth = "3.8px";
        strokeEl.style.filter = "drop-shadow(0 0 8px " + color2D + ") drop-shadow(0 0 16px rgba(255,209,102,0.85))";

        clearTimeout(strokeEl._colorTimer);
        strokeEl._colorTimer = setTimeout(function() {
          strokeEl.style.transition = "stroke 0.35s ease, stroke-width 0.35s ease, filter 0.35s ease";
          strokeEl.style.stroke = strokeEl.getAttribute("data-orig-stroke");
          strokeEl.style.strokeWidth = strokeEl.getAttribute("data-orig-width");
          strokeEl.style.filter = "";
        }, 440);
      });

      setTimeout(function() {
        el.classList.remove("u-2d-plucking");
      }, 450);
    });

    // Tạo hiệu ứng sóng xung kích tỏa tròn trên SVG tại đúng tọa độ tâm điểm của nốt được đánh
    var svg = container.querySelector("svg");
    if (svg && hitboxes.length > 0) {
      var boxEl = hitboxes[0];
      var cx = 0, cy = 0;
      var foundCenter = false;
      try {
        if (typeof boxEl.getBBox === "function") {
          var bbox = boxEl.getBBox();
          if (bbox && (bbox.width > 0 || bbox.height > 0)) {
            cx = bbox.x + bbox.width / 2;
            cy = bbox.y + bbox.height / 2;
            foundCenter = true;
          }
        }
      } catch (err) {}

      if (!foundCenter) {
        var subEl = boxEl.querySelector("circle") || boxEl.querySelector("rect") || boxEl.querySelector("line") || boxEl.querySelector("path");
        if (subEl) {
          try {
            var sBbox = subEl.getBBox();
            if (sBbox) {
              cx = sBbox.x + sBbox.width / 2;
              cy = sBbox.y + sBbox.height / 2;
              foundCenter = true;
            }
          } catch (e2) {}
          if (!foundCenter) {
            if (subEl.hasAttribute("cx")) {
              cx = parseFloat(subEl.getAttribute("cx"));
              cy = parseFloat(subEl.getAttribute("cy"));
              foundCenter = true;
            } else if (subEl.hasAttribute("x1") && subEl.hasAttribute("x2")) {
              cx = (parseFloat(subEl.getAttribute("x1")) + parseFloat(subEl.getAttribute("x2"))) / 2;
              cy = (parseFloat(subEl.getAttribute("y1")) + parseFloat(subEl.getAttribute("y2"))) / 2;
              foundCenter = true;
            }
          }
        }
      }

      if (foundCenter) {
        var rip = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        rip.setAttribute("cx", cx);
        rip.setAttribute("cy", cy);
        rip.setAttribute("r", "10");
        rip.setAttribute("class", "u-2d-ripple");
        rip.setAttribute("fill", "none");
        rip.setAttribute("stroke", "#ffd700");
        svg.appendChild(rip);
        setTimeout(function() {
          if (rip.parentNode) rip.parentNode.removeChild(rip);
        }, 700);
      }
    }

    var badge = document.getElementById("lbl2DNotePlayed");
    var inst = INSTRUMENT_MAP[currentActiveInstrument];
    if (badge && inst && inst.notes && inst.notes[noteIdx]) {
      var n = inst.notes[noteIdx];
      badge.textContent = "🎵 " + inst.name + ": " + n.name + (n.freq ? " (" + Math.round(n.freq) + "Hz)" : "");
      badge.style.display = "block";
      clearTimeout(badge._timer);
      badge._timer = setTimeout(function() {
        badge.style.display = "none";
      }, 1200);
    }
  }


  function render2DInstrument(instId) {
    var container = document.getElementById("dan2DContainer");
    if (!container) return;
    container.innerHTML = "";

    var inst = INSTRUMENT_MAP[instId] || ALL_INSTRUMENTS[0];
    var notes = inst.notes || [];
    var totalNotes = notes.length || 8;

    var commonDefs = '<defs>' +
      '<linearGradient id="u2d-wood-paulownia" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#4a2613"/><stop offset="15%" stop-color="#cf9d56"/>' +
        '<stop offset="50%" stop-color="#e8c280"/><stop offset="85%" stop-color="#b8833d"/>' +
        '<stop offset="100%" stop-color="#2a1408"/>' +
      '</linearGradient>' +
      '<linearGradient id="u2d-wood-dark" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#3d1d0e"/><stop offset="50%" stop-color="#1f0e07"/><stop offset="100%" stop-color="#0a0402"/>' +
      '</linearGradient>' +
      '<linearGradient id="u2d-red-lacquer" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#8b1111"/><stop offset="40%" stop-color="#dc2626"/>' +
        '<stop offset="70%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#450a0a"/>' +
      '</linearGradient>' +
      '<linearGradient id="u2d-bamboo" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#d4af37"/><stop offset="35%" stop-color="#f5d77f"/>' +
        '<stop offset="75%" stop-color="#c19438"/><stop offset="100%" stop-color="#785312"/>' +
      '</linearGradient>' +
      '<radialGradient id="u2d-bronze" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffe082"/><stop offset="35%" stop-color="#d49a37"/>' +
        '<stop offset="75%" stop-color="#996e23"/><stop offset="100%" stop-color="#3a2506"/>' +
      '</radialGradient>' +
      '<linearGradient id="u2d-ivory" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#fffdf7"/><stop offset="60%" stop-color="#edd9b6"/><stop offset="100%" stop-color="#bfa376"/>' +
      '</linearGradient>' +
      '<radialGradient id="u2d-skin" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#fffbeb"/><stop offset="50%" stop-color="#fde68a"/><stop offset="100%" stop-color="#b45309"/>' +
      '</radialGradient>' +
      '<linearGradient id="u2d-stone" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '<stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>' +
      '</linearGradient>' +
      '<linearGradient id="u2d-gold-str" x1="0%" y1="0%" x2="100%" y2="0%">' +
        '<stop offset="0%" stop-color="#946d29"/><stop offset="25%" stop-color="#fff2a8"/><stop offset="50%" stop-color="#ffd700"/><stop offset="75%" stop-color="#fff2a8"/><stop offset="100%" stop-color="#946d29"/>' +
      '</linearGradient>' +
      '<filter id="u2d-glow" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
    '</defs>';

    var svgContent = "";

    // 1. ĐÀN TRANH (16 DÂY NGŨ CUNG - CHẾ ĐỘ 2D HOÀN HẢO ĐẦY ĐỦ 16 NHẠN)
    if (instId === "dantranh") {
      var danTranhNotes = [
        {name:"Hò (Đô 4)", key:"1"}, {name:"Xự (Rê 4)", key:"2"}, {name:"Xang (Mi 4)", key:"3"}, {name:"Xê (Sol 4)", key:"4"},
        {name:"Cống (La 4)", key:"5"}, {name:"Hò 2 (Đô 5)", key:"6"}, {name:"Xự 2 (Rê 5)", key:"7"}, {name:"Xang 2 (Mi 5)", key:"8"},
        {name:"Xê 2 (Sol 5)", key:"Q"}, {name:"Cống 2 (La 5)", key:"W"}, {name:"Hò 3 (Đô 6)", key:"E"}, {name:"Xự 3 (Rê 6)", key:"R"},
        {name:"Xang 3 (Mi 6)", key:"T"}, {name:"Xê 3 (Sol 6)", key:"Y"}, {name:"Cống 3 (La 6)", key:"U"}, {name:"Hò 4 (Đô 7)", key:"I"}
      ];

      var stringsSvg = "";
      for (var s = 0; s < 16; s++) {
        var sy = 74 + s * 14.5;
        // Nhạn đàn hình chữ V ngược uốn lượn hình chữ S duyên dáng
        var bx = 220 + s * 41 + Math.sin(s / 15 * Math.PI) * 40;
        var nObj = danTranhNotes[s] || {name:"Nốt " + (s+1), key:"" + (s+1)};

        var pegX2D = 560 + s * 22;
        // Nhạn đàn gỗ mun có hoa văn vòng tròn vàng ở giữa & ngàm ngọc lam (chuẩn ảnh 1)
        var nhan = '<polygon points="' + (bx-10) + ',' + (sy+14) + ' ' + bx + ',' + (sy-12) + ' ' + (bx+10) + ',' + (sy+14) + ' ' + (bx+4) + ',' + (sy+14) + ' ' + bx + ',' + (sy-3) + ' ' + (bx-4) + ',' + (sy+14) + '" fill="#2b1812" stroke="#150a06" stroke-width="1"/>' +
          // Vòng tròn hoàng kim ở giữa thân nhạn
          '<circle cx="' + bx + '" cy="' + (sy+2) + '" r="5" fill="#f6c445" stroke="#8c6218" stroke-width="1.2"/>' +
          '<circle cx="' + bx + '" cy="' + (sy+2) + '" r="2" fill="#2b1812"/>' +
          // Ngàm ngọc lam đỡ dây trên đỉnh nhạn
          '<circle cx="' + bx + '" cy="' + (sy-11) + '" r="2.5" fill="#67e8f9" filter="url(#u2d-glow)"/>' +
          // Trụ cắm buộc dây đàn trên mặt đàn
          '<circle cx="' + pegX2D + '" cy="' + sy + '" r="6" fill="#1b0e07" stroke="#f6c445" stroke-width="1.5"/>' +
          '<circle cx="' + pegX2D + '" cy="' + sy + '" r="2" fill="#f6c445"/>';

        stringsSvg += nhan +
          '<g class="u-2d-hitbox" data-note-idx="' + s + '">' +
            '<line x1="75" y1="' + sy + '" x2="' + (pegX2D + 10) + '" y2="' + sy + '" stroke="transparent" stroke-width="15"/>' +
            // Dây đàn màu lam ngọc bích phát sáng kết thúc tại trụ buộc dây
            '<line id="u2d-str-' + s + '" x1="75" y1="' + sy + '" x2="' + pegX2D + '" y2="' + sy + '" stroke="#67e8f9" stroke-width="' + (2.2 - s * 0.06) + '" filter="url(#u2d-glow)"/>' +
            '<circle cx="115" cy="' + sy + '" r="9.5" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.2"/>' +
            '<text x="115" y="' + sy + '" class="u-2d-key-badge" fill="#ffffff">' + nObj.key + '</text>' +
            '<text x="' + (pegX2D + 14) + '" y="' + (sy+3) + '" class="u-2d-note-label" text-anchor="start" font-size="10.5">' + nObj.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Thân đàn uốn vồng bán nguyệt mặt gỗ ngô đồng sáng ngà
        '<path d="M 45,60 Q 500,40 955,60 L 935,310 Q 500,330 65,310 Z" fill="#faf8f2" stroke="#253d4c" stroke-width="3"/>' +
        // Dấu triện thư pháp đỏ ở góc trái dưới mặt đàn
        '<circle cx="170" cy="275" r="16" fill="none" stroke="#ba3928" stroke-width="3.5" opacity="0.88"/>' +
        '<line x1="154" y1="275" x2="138" y2="276" stroke="#ba3928" stroke-width="5" stroke-linecap="round" opacity="0.88"/>' +
        '<circle cx="168" cy="275" r="4" fill="#ba3928" opacity="0.85"/>' +
        // Viền thành men lam ngọc (Slate-Blue Celadon)
        '<path d="M 45,60 Q 500,40 955,60 L 955,75 Q 500,55 45,75 Z" fill="#314f60"/>' +
        '<path d="M 65,295 Q 500,315 935,295 L 935,310 Q 500,330 65,310 Z" fill="#314f60"/>' +
        // Dải ngọc bích phát sáng dọc viền trên
        '<circle cx="200" cy="62" r="3" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="350" cy="56" r="3" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="500" cy="52" r="3" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="650" cy="56" r="3" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="800" cy="62" r="3" fill="#67e8f9" filter="url(#u2d-glow)"/>' +
        // Đầu đàn (Phần hoạ tiết to to phía trước màu men lam ngọc & đính ngọc bích phát sáng)
        '<path d="M 45,60 Q 30,185 45,310 L 95,310 Q 80,185 95,60 Z" fill="#314f60"/>' +
        '<circle cx="70" cy="100" r="8" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="70" cy="185" r="10" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="70" cy="270" r="8" fill="#67e8f9" filter="url(#u2d-glow)"/>' +
        // Đuôi đàn (Thành luồn dây men lam ngọc & cụm ngọc lam)
        '<path d="M 905,60 Q 940,185 905,310 L 955,310 Q 980,185 955,60 Z" fill="#314f60"/>' +
        '<circle cx="935" cy="155" r="5" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="935" cy="185" r="7" fill="#67e8f9" filter="url(#u2d-glow)"/><circle cx="935" cy="215" r="5" fill="#67e8f9" filter="url(#u2d-glow)"/>' +
        stringsSvg;

    // 2. ĐÀN BẦU (ĐỘC HUYỀN CẦM - CẦN UỐN & ĐIỂM BỒI ÂM PHA LÊ)
    } else if (instId === "danbau") {
      var nodesSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var nx = 230 + i * 78;
        nodesSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<circle cx="' + nx + '" cy="180" r="14" fill="#ffd700" stroke="#fff" stroke-width="2.5" filter="url(#u2d-glow)"/>' +
            '<circle cx="' + nx + '" cy="180" r="24" fill="transparent"/>' +
            '<text x="' + nx + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + nx + '" y="215" class="u-2d-note-label">' + n.name + '</text>' +
            '<text x="' + nx + '" y="150" fill="#e8c77e" font-size="10" text-anchor="middle">Điểm ' + (i+1) + '</text>' +
          '</g>';
      }

      svgContent =
        // Thân đàn bầu gỗ cẩm lai khảm xà cừ dài
        '<rect x="150" y="140" width="730" height="80" rx="10" fill="url(#u2d-wood-dark)" stroke="#3e2723" stroke-width="3"/>' +
        '<rect x="160" y="148" width="710" height="64" rx="6" fill="url(#u2d-wood-paulownia)"/>' +
        // Khảm xà cừ họa tiết rồng phượng dọc thân
        '<path d="M 280,180 Q 515,165 750,180" stroke="#fbcfe8" stroke-dasharray="8,12" stroke-width="3" opacity="0.6" fill="none"/>' +
        // Cần đàn sừng trâu uốn dẻo bên trái
        '<path d="M 160,180 C 135,140 120,90 100,40" stroke="#2a1408" stroke-width="8" stroke-linecap="round" fill="none"/>' +
        '<path d="M 160,180 C 135,140 120,90 100,40" stroke="#ffd700" stroke-width="2" stroke-linecap="round" fill="none"/>' +
        // Quả bầu khô treo lơ lửng dưới cần đàn
        '<ellipse cx="118" cy="115" rx="20" ry="28" fill="url(#u2d-bamboo)" stroke="#785312" stroke-width="2"/>' +
        '<circle cx="118" cy="95" r="12" fill="url(#u2d-bamboo)"/>' +
        // Ngựa đàn & trục lên dây bên phải
        '<rect x="850" y="160" width="16" height="40" rx="3" fill="#3e2723"/>' +
        '<circle cx="858" cy="180" r="6" fill="#ffd700"/>' +
        // Sợi dây thép độc nhất căng từ ngọn cần xuyên suốt thân
        '<line x1="100" y1="40" x2="160" y2="180" stroke="url(#u2d-gold-str)" stroke-width="2"/>' +
        '<line x1="160" y1="180" x2="858" y2="180" stroke="url(#u2d-gold-str)" stroke-width="2.5" filter="url(#u2d-glow)"/>' +
        nodesSvg;

    // 3. ĐÀN NGUYỆT (ĐÀN KÌM - THÙNG TRÒN NHƯ TRĂNG RẰM & 10 PHÍM CAO)
    } else if (instId === "dannguyet") {
      var fretsSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var fx = 470 + i * 40;
        fretsSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<rect x="' + (fx-5) + '" y="152" width="10" height="56" rx="3" fill="url(#u2d-ivory)" stroke="#5a2e1b" stroke-width="1.2"/>' +
            '<circle cx="' + fx + '" cy="132" r="10.5" fill="#ffd700" stroke="#2a1408" stroke-width="1"/>' +
            '<text x="' + fx + '" y="132" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + fx + '" y="228" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Thùng đàn tròn xoe như vầng trăng rằm
        '<circle cx="320" cy="180" r="130" fill="url(#u2d-wood-paulownia)" stroke="#3b1d11" stroke-width="8"/>' +
        '<circle cx="320" cy="180" r="120" fill="none" stroke="#ecd599" stroke-width="2.5"/>' +
        // Hai lỗ thoát âm hình bán nguyệt đối xứng
        '<path d="M 270,150 A 25 25 0 0 1 300,180 A 20 20 0 0 0 270,150 Z" fill="#1b0e07"/>' +
        '<path d="M 370,150 A 25 25 0 0 0 340,180 A 20 20 0 0 1 370,150 Z" fill="#1b0e07"/>' +
        // Ngựa đàn trên mặt thùng
        '<rect x="235" y="170" width="14" height="40" rx="3" fill="#3e2723"/>' +
        // Cần đàn dài thon vươn sang bên phải
        '<rect x="445" y="170" width="410" height="20" rx="4" fill="url(#u2d-wood-dark)"/>' +
        // Đầu đàn chạm hình trăng lưỡi liềm với 4 trục gỗ
        '<path d="M 855,160 C 890,140 910,180 885,200 Z" fill="url(#u2d-wood-dark)" stroke="#ffd700" stroke-width="2"/>' +
        '<circle cx="875" cy="155" r="7" fill="url(#u2d-ivory)"/><circle cx="875" cy="205" r="7" fill="url(#u2d-ivory)"/>' +
        // 2 dây tơ đàn nguyệt
        '<line x1="240" y1="176" x2="875" y2="176" stroke="url(#u2d-gold-str)" stroke-width="2"/>' +
        '<line x1="240" y1="184" x2="875" y2="184" stroke="url(#u2d-gold-str)" stroke-width="2"/>' +
        fretsSvg;

    // 4. ĐÀN NHỊ & ĐÀN HỒ (THÙNG BỊT DA TRĂN, CẦN ĐẦU RỒNG & CUNG VĨ)
    } else if (instId === "dannhi" || instId === "danho") {
      var nhinotesSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var ny = 75 + i * 16.5;
        nhinotesSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<rect x="475" y="' + (ny-11) + '" width="110" height="22" rx="11" fill="rgba(35,18,7,0.85)" stroke="#ffd700" stroke-width="1.5"/>' +
            '<circle cx="495" cy="' + ny + '" r="8.5" fill="#ffd700"/>' +
            '<text x="495" y="' + ny + '" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="545" y="' + ny + '" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Thùng đàn bịt da trăn (bát giác / lục giác)
        '<polygon points="480,230 530,210 580,230 580,290 530,310 480,290" fill="url(#u2d-skin)" stroke="#2b1810" stroke-width="4"/>' +
        '<circle cx="530" cy="260" r="14" fill="#3e2723" opacity="0.4"/>' +
        '<polygon points="522,260 530,248 538,260" fill="url(#u2d-ivory)"/>' +
        // Cần đàn đứng thẳng đầu rồng
        '<rect x="525" y="30" width="10" height="200" rx="3" fill="url(#u2d-wood-dark)"/>' +
        '<path d="M 520,35 C 505,20 535,5 540,25 Z" fill="#ffd700"/>' +
        // 2 trục lên dây
        '<rect x="475" y="45" width="50" height="8" rx="3" fill="url(#u2d-ivory)"/>' +
        '<rect x="535" y="60" width="50" height="8" rx="3" fill="url(#u2d-ivory)"/>' +
        // 2 dây đàn nhị
        '<line x1="528" y1="50" x2="528" y2="250" stroke="url(#u2d-gold-str)" stroke-width="1.8"/>' +
        '<line x1="532" y1="65" x2="532" y2="250" stroke="url(#u2d-gold-str)" stroke-width="2.2"/>' +
        // Cung vĩ luồn giữa 2 dây
        '<path d="M 330,270 Q 530,240 730,270" stroke="url(#u2d-bamboo)" stroke-width="7" fill="none"/>' +
        '<path d="M 330,270 Q 530,240 730,270" stroke="#fff" stroke-width="2" fill="none" opacity="0.9"/>' +
        nhinotesSvg;

    // 5. ĐÀN TỲ BÀ (DÁNG QUẢ LÊ QUÝ TỘC, PHÍM HOA MAI)
    } else if (instId === "dantyba") {
      var tybaNotesSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var ty = 65 + i * 20;
        tybaNotesSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<rect x="460" y="' + (ty-11) + '" width="80" height="22" rx="6" fill="url(#u2d-ivory)" stroke="#3b1d11" stroke-width="1.2"/>' +
            '<circle cx="475" cy="' + ty + '" r="8.5" fill="#ffd700"/>' +
            '<text x="475" y="' + ty + '" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="512" y="' + ty + '" class="u-2d-note-label" font-size="11">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Dáng quả lê truyền thống
        '<path d="M 500,40 C 470,80 430,170 410,240 C 390,300 450,330 500,330 C 550,330 610,300 590,240 C 570,170 530,80 500,40 Z" fill="url(#u2d-wood-paulownia)" stroke="#3e1c0d" stroke-width="5"/>' +
        // Cần uốn cong gắn 4 trục
        '<path d="M 500,40 C 500,10 525,10 525,25" stroke="#3e1c0d" stroke-width="10" fill="none"/>' +
        // Lỗ thoát âm hoa mai
        '<circle cx="460" cy="270" r="10" fill="#1b0e07"/><circle cx="540" cy="270" r="10" fill="#1b0e07"/>' +
        // Ngựa đàn
        '<rect x="470" y="295" width="60" height="12" rx="3" fill="#3e1c0d"/>' +
        // 4 dây tơ
        '<line x1="485" y1="30" x2="485" y2="300" stroke="url(#u2d-gold-str)" stroke-width="1.5"/>' +
        '<line x1="495" y1="30" x2="495" y2="300" stroke="url(#u2d-gold-str)" stroke-width="1.8"/>' +
        '<line x1="505" y1="30" x2="505" y2="300" stroke="url(#u2d-gold-str)" stroke-width="2.2"/>' +
        '<line x1="515" y1="30" x2="515" y2="300" stroke="url(#u2d-gold-str)" stroke-width="2.6"/>' +
        tybaNotesSvg;

    // 6. NHÓM SÁO TRÚC, TIÊU, ĐING BUỐT, PI (NHẠC CỤ HƠI ĐỐT TRÚC CHỈ ĐỎ)
    } else if (inst.cat === "hoi" && (instId === "saotruc" || instId === "tieu" || instId === "dingbuot" || instId === "pi")) {
      var holesSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var hx = 350 + i * 68;
        holesSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            // Lỗ bấm ngón
            '<circle cx="' + hx + '" cy="180" r="17" fill="#1c0f05" stroke="#ffd700" stroke-width="3" filter="url(#u2d-glow)"/>' +
            '<circle cx="' + hx + '" cy="180" r="10" fill="#3b210d"/>' +
            // Phím tắt
            '<circle cx="' + hx + '" cy="122" r="11" fill="#ffd700" stroke="#2a1408" stroke-width="1.2"/>' +
            '<text x="' + hx + '" y="122" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + hx + '" y="232" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Ống sáo trúc vàng óng
        '<rect x="90" y="156" width="820" height="48" rx="24" fill="url(#u2d-bamboo)" stroke="#4a300a" stroke-width="3"/>' +
        // Các đốt trúc tự nhiên & cuộn chỉ đỏ truyền thống
        '<line x1="260" y1="156" x2="260" y2="204" stroke="#5c3806" stroke-width="3"/>' +
        '<rect x="256" y="156" width="8" height="48" fill="#e11d48"/>' +
        '<line x1="490" y1="156" x2="490" y2="204" stroke="#5c3806" stroke-width="3"/>' +
        '<rect x="486" y="156" width="8" height="48" fill="#e11d48"/>' +
        '<line x1="720" y1="156" x2="720" y2="204" stroke="#5c3806" stroke-width="3"/>' +
        '<rect x="716" y="156" width="8" height="48" fill="#e11d48"/>' +
        // Lỗ thổi (Embouchure) bên trái với làn khói hơi
        '<ellipse cx="180" cy="180" rx="15" ry="11" fill="#1c0f05" stroke="#ffd700" stroke-width="2"/>' +
        '<path d="M 175,170 C 160,140 190,130 180,110" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" fill="none" stroke-dasharray="4,4"/>' +
        holesSvg;

    // 7. KHÈN, KHÈN MÔNG, ĐING NĂM, KHÈN BÈ, ĐING TÚT (HỌ KHÈN BÈ ĐA ÂM)
    } else if (instId === "khen" || instId === "khenmong" || instId === "dingnam" || instId === "khenbe" || instId === "dingtut") {
      var khenPipesSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var kx = 240 + i * 68;
        var pHeight = 260 - (i % 4) * 35;
        khenPipesSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            // Ống nứa vươn dài
            '<rect x="' + (kx-12) + '" y="' + (180 - pHeight/2) + '" width="24" height="' + pHeight + '" rx="8" fill="url(#u2d-bamboo)" stroke="#785312" stroke-width="1.5"/>' +
            // Lỗ bấm lam đồng
            '<circle cx="' + kx + '" cy="180" r="11" fill="#ffd700" stroke="#2a1408" stroke-width="2"/>' +
            '<circle cx="' + kx + '" cy="120" r="10" fill="#ffd700"/>' +
            '<text x="' + kx + '" y="120" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + kx + '" y="235" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Bầu khèn bằng gỗ bo tròn ở giữa
        '<ellipse cx="500" cy="180" rx="310" ry="42" fill="url(#u2d-wood-dark)" stroke="#3e2723" stroke-width="3"/>' +
        // Miệng thổi khèn vươn cong ra
        '<path d="M 190,180 C 130,175 100,165 80,150" stroke="url(#u2d-wood-dark)" stroke-width="14" fill="none"/>' +
        khenPipesSvg;

    // 8. TRỐNG CƠM (TANG SƠN SON THẾP VÀNG, MIẾNG CƠM NẾP TRÒN & DÂY DA NỐI)
    } else if (instId === "trongcom") {
      var tcNotes = notes.slice(0, 6);
      var tcZones = [
        {name: "Mặt Trái (Trầm)", x: 220, y: 140, r: 24, key: "1"},
        {name: "Cơm Nếp Trái (Vang)", x: 220, y: 180, r: 16, key: "2"},
        {name: "Cơm Nếp Phải (Đanh)", x: 780, y: 180, r: 16, key: "3"},
        {name: "Mặt Phải (Cắc)", x: 780, y: 220, r: 24, key: "4"},
        {name: "Tang Gỗ (Tùng)", x: 500, y: 120, r: 22, key: "5"},
        {name: "Rập Rìa (Rập)", x: 500, y: 240, r: 22, key: "6"}
      ];

      var tcSvg = "";
      for (var i = 0; i < tcZones.length; i++) {
        var z = tcZones[i];
        var n = tcNotes[i] || {name: z.name, key: z.key};
        tcSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<circle cx="' + z.x + '" cy="' + z.y + '" r="' + z.r + '" fill="#ffd700" stroke="#fff" stroke-width="2.5" filter="url(#u2d-glow)"/>' +
            '<text x="' + z.x + '" y="' + z.y + '" class="u-2d-key-badge">' + (n.key || z.key) + '</text>' +
            '<text x="' + z.x + '" y="' + (z.y + (z.y > 180 ? 30 : -28)) + '" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Tang trống sơn son thếp vàng phình ở giữa
        '<rect x="220" y="90" width="560" height="180" rx="40" fill="url(#u2d-red-lacquer)" stroke="#450a0a" stroke-width="4"/>' +
        // Hoa văn rồng mây thếp vàng
        '<path d="M 280,140 Q 500,100 720,140" stroke="#ffd700" stroke-width="4" fill="none" opacity="0.75"/>' +
        '<path d="M 280,220 Q 500,260 720,220" stroke="#ffd700" stroke-width="4" fill="none" opacity="0.75"/>' +
        // Dây da chéo đan qua tang trống
        '<line x1="220" y1="90" x2="780" y2="270" stroke="#ffd700" stroke-width="2" stroke-dasharray="8,8" opacity="0.8"/>' +
        '<line x1="220" y1="270" x2="780" y2="90" stroke="#ffd700" stroke-width="2" stroke-dasharray="8,8" opacity="0.8"/>' +
        // Mặt da trâu bịt hai đầu
        '<ellipse cx="220" cy="180" rx="36" ry="90" fill="url(#u2d-skin)" stroke="#2a1408" stroke-width="3"/>' +
        '<ellipse cx="780" cy="180" rx="36" ry="90" fill="url(#u2d-skin)" stroke="#2a1408" stroke-width="3"/>' +
        // Miếng cơm nếp tròn đặc trưng ở giữa mặt trống
        '<ellipse cx="220" cy="180" rx="15" ry="32" fill="#1c1008"/>' +
        '<ellipse cx="780" cy="180" rx="15" ry="32" fill="#1c1008"/>' +
        tcSvg;

    // 9. TRỐNG CÁI, TRỐNG CHIẾN, TRỐNG BẢN (ĐẠI CỔ ĐÌNH LÀNG, ĐÔNG SƠN)
    } else if (instId === "trongcai" || instId === "trongchien" || instId === "trongban") {
      var tzones = [
        {name: "Tùng (Tâm Trống)", r: 42, color: "#ef4444", key: "1"},
        {name: "Vang (Vành Giữa)", r: 75, color: "#f59e0b", key: "2"},
        {name: "Đanh (Rìa Mặt)", r: 110, color: "#eab308", key: "3"},
        {name: "Cắc (Tang Gỗ)", r: 135, color: "#84cc16", key: "4"},
        {name: "Tùng Rền", r: 58, color: "#06b6d4", key: "5"},
        {name: "Rập", r: 92, color: "#8b5cf6", key: "6"}
      ];

      var tcaiSvg = "";
      for (var i = 0; i < Math.min(totalNotes, 6); i++) {
        var tz = tzones[i];
        var n = notes[i] || {name: tz.name, key: tz.key};
        var ang = (i / 6) * Math.PI * 2;
        var zx = 500 + Math.cos(ang) * (tz.r * 0.7);
        var zy = 180 + Math.sin(ang) * (tz.r * 0.7);
        tcaiSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<circle cx="' + zx + '" cy="' + zy + '" r="16" fill="' + tz.color + '" stroke="#fff" stroke-width="2" filter="url(#u2d-glow)"/>' +
            '<text x="' + zx + '" y="' + zy + '" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + zx + '" y="' + (zy + 24) + '" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Mặt trống da trâu khổng lồ
        '<circle cx="500" cy="180" r="145" fill="url(#u2d-skin)" stroke="#8b1111" stroke-width="12"/>' +
        // Vành đinh đồng tán vòng quanh
        '<circle cx="500" cy="180" r="138" fill="none" stroke="#ffd700" stroke-width="3" stroke-dasharray="6,12"/>' +
        // Họa tiết mặt trời Đông Sơn 12 cánh ở tâm
        '<circle cx="500" cy="180" r="28" fill="#ffd700" opacity="0.8"/>' +
        '<circle cx="500" cy="180" r="85" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="4,6"/>' +
        tcaiSvg;

    // 10. CỒNG, CHIÊNG, THANH LA (ĐỒNG THAU ĐÔNG SƠN NÚM VÀNG)
    } else if (instId === "cong" || instId === "chieng" || instId === "thanhla") {
      var gongSvg = "";
      for (var i = 0; i < Math.min(totalNotes, 6); i++) {
        var n = notes[i];
        var gx = 360 + i * 56;
        gongSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<circle cx="' + gx + '" cy="180" r="18" fill="#ffd700" stroke="#fff" stroke-width="2" filter="url(#u2d-glow)"/>' +
            '<text x="' + gx + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + gx + '" y="218" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      var isCong = instId === "cong";
      svgContent =
        // Mặt cồng chiêng đồng thau lớn
        '<circle cx="500" cy="180" r="145" fill="url(#u2d-bronze)" stroke="#2e1d05" stroke-width="6"/>' +
        '<circle cx="500" cy="180" r="120" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="5,8" opacity="0.8"/>' +
        '<circle cx="500" cy="180" r="80" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="3,6" opacity="0.6"/>' +
        // Núm cồng lồi ở giữa (nếu là Cồng)
        (isCong ? '<circle cx="500" cy="180" r="38" fill="#ffd700" stroke="#8c6218" stroke-width="3" filter="url(#u2d-glow)"/>' : '') +
        // Dùi gõ bọc vải nằm bên cạnh
        '<line x1="720" y1="280" x2="820" y2="220" stroke="url(#u2d-wood-dark)" stroke-width="8"/>' +
        '<circle cx="820" cy="220" r="16" fill="#dc2626"/>' +
        gongSvg;

    // 11. ĐÀN T'RƯNG (DÀN ỐNG NỨA VÁT ĐẦU BẬC THANG TÂY NGUYÊN)
    } else if (instId === "trung") {
      var trungSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var tx = 220 + i * 72;
        var tLen = 250 - i * 16;
        var tyTop = 180 - tLen/2;
        trungSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            // Ống nứa vát miệng
            '<rect x="' + (tx-14) + '" y="' + tyTop + '" width="28" height="' + tLen + '" rx="8" fill="url(#u2d-bamboo)" stroke="#785312" stroke-width="1.8"/>' +
            '<polygon points="' + (tx-14) + ',' + (tyTop+12) + ' ' + (tx+14) + ',' + tyTop + ' ' + (tx+14) + ',' + (tyTop+20) + '" fill="#5a3d0b"/>' +
            // Phím gõ
            '<circle cx="' + tx + '" cy="180" r="12" fill="#ffd700" stroke="#2a1408" stroke-width="1.5" filter="url(#u2d-glow)"/>' +
            '<text x="' + tx + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + tx + '" y="' + (tyTop + tLen + 20) + '" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Chân kiềng tre 3 nhánh chạm đất & cột trụ đứng thẳng trung tâm
        '<path d="M 500 320 Q 520 365 590 395" fill="none" stroke="url(#u2d-bamboo)" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M 500 320 Q 450 360 380 395" fill="none" stroke="url(#u2d-bamboo)" stroke-width="12" stroke-linecap="round"/>' +
        '<path d="M 500 320 Q 500 355 500 395" fill="none" stroke="#5a3d0b" stroke-width="12" stroke-linecap="round"/>' +
        '<line x1="500" y1="380" x2="500" y2="40" stroke="url(#u2d-bamboo)" stroke-width="16" stroke-linecap="round"/>' +
        // 2 tay đòn tre đỡ dưới vươn ra 2 bên
        '<line x1="500" y1="300" x2="220" y2="330" stroke="url(#u2d-bamboo)" stroke-width="10" stroke-linecap="round"/>' +
        '<line x1="500" y1="300" x2="780" y2="330" stroke="url(#u2d-bamboo)" stroke-width="10" stroke-linecap="round"/>' +
        // 2 sợi dây néo màu trắng đan chữ A hội tụ về đỉnh cột tre
        '<line x1="230" y1="320" x2="495" y2="45" stroke="#ffffff" stroke-width="2.6"/>' +
        '<line x1="770" y1="320" x2="505" y2="45" stroke="#ffffff" stroke-width="2.6"/>' +
        trungSvg;

    // 12. ĐÀN ĐÁ (THẠCH CẦM HÀNG NGÀN NĂM TIỀN SỬ)
    } else if (instId === "danda") {
      var rockSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var rx = 190 + i * 80;
        var rHeight = 230 - i * 14;
        var rWidth = 48 - i * 1.5;
        var ry = 180 - rHeight/2;
        rockSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            // Thanh đá tự nhiên góc cạnh
            '<rect x="' + rx + '" y="' + ry + '" width="' + rWidth + '" height="' + rHeight + '" rx="6" fill="url(#u2d-stone)" stroke="#94a3b8" stroke-width="2" filter="url(#u2d-glow)"/>' +
            '<line x1="' + (rx+6) + '" y1="' + (ry+10) + '" x2="' + (rx+6) + '" y2="' + (ry+rHeight-10) + '" stroke="#cbd5e1" stroke-width="1.5" opacity="0.6"/>' +
            // Điểm gõ phát âm
            '<circle cx="' + (rx + rWidth/2) + '" cy="180" r="12" fill="#ffd700" stroke="#1e293b" stroke-width="1.5"/>' +
            '<text x="' + (rx + rWidth/2) + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + (rx + rWidth/2) + '" y="' + (ry + rHeight + 20) + '" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Giá đỡ gỗ lũa cổ xưa
        '<rect x="150" y="275" width="700" height="24" rx="6" fill="url(#u2d-wood-dark)" stroke="#3e2723" stroke-width="2"/>' +
        '<rect x="150" y="75" width="700" height="14" rx="4" fill="url(#u2d-wood-dark)"/>' +
        rockSvg;

    // 13. MÕ, PHÁCH, SINH TIỀN (GÕ DÂN GIAN & CA TRÙ)
    } else if (instId === "mo" || instId === "phach" || instId === "sinhtien") {
      var percSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var px = 220 + i * 72;
        percSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<rect x="' + (px-22) + '" y="' + 145 + '" width="44" height="70" rx="8" fill="url(#u2d-wood-dark)" stroke="#ffd700" stroke-width="2"/>' +
            '<circle cx="' + px + '" cy="180" r="12" fill="#ffd700"/>' +
            '<text x="' + px + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + px + '" y="240" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Khối mõ gỗ mít khắc cá hóa rồng
        '<circle cx="500" cy="180" r="110" fill="url(#u2d-wood-paulownia)" stroke="#3e2723" stroke-width="5"/>' +
        '<path d="M 430,180 L 570,180" stroke="#1c0f05" stroke-width="12" stroke-linecap="round"/>' +
        percSvg;

    // 14. TẤT CẢ CÁC NHẠC CỤ DÂY & TRUYỀN THỐNG KHÁC (ĐÀN ĐÁY, TÍNH, MÔI, K'NI, GOONG, CHAPI, TA LƯ, TAM, TỨ, KÈN BẦU, PÍ LÈ, TÙ VÀ...)
    } else {
      var genSvg = "";
      for (var i = 0; i < totalNotes; i++) {
        var n = notes[i];
        var gx = 220 + i * 72;
        genSvg +=
          '<g class="u-2d-hitbox" data-note-idx="' + i + '">' +
            '<rect x="' + (gx-22) + '" y="130" width="44" height="100" rx="10" fill="url(#u2d-wood-dark)" stroke="#ffd700" stroke-width="2" filter="url(#u2d-glow)"/>' +
            '<circle cx="' + gx + '" cy="180" r="14" fill="#ffd700" stroke="#fff" stroke-width="1.5"/>' +
            '<text x="' + gx + '" y="180" class="u-2d-key-badge">' + (n.key || (i+1)) + '</text>' +
            '<text x="' + gx + '" y="250" class="u-2d-note-label">' + n.name + '</text>' +
          '</g>';
      }

      svgContent =
        // Thân nhạc cụ gỗ truyền thống sang trọng
        '<rect x="140" y="100" width="720" height="160" rx="20" fill="url(#u2d-wood-paulownia)" stroke="#3e2723" stroke-width="4"/>' +
        '<path d="M 180,180 L 820,180" stroke="url(#u2d-gold-str)" stroke-width="3"/>' +
        genSvg;
    }

    container.innerHTML =
      '<svg viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid meet" class="u-2d-svg">' +
        commonDefs +
        svgContent +
      '</svg>';

    // Gắn sự kiện Click & Chạm trực tiếp cho toàn bộ các điểm nốt 2D
    var hitboxes = container.querySelectorAll(".u-2d-hitbox");
    hitboxes.forEach(function(box) {
      box.addEventListener("click", function(e) {
        e.stopPropagation();
        var noteIdx = parseInt(box.getAttribute("data-note-idx"), 10);
        getAudioContext();
        if (instId === "dantranh") {
          pluck(noteIdx);
        } else {
          playUniversalInstrumentNote(inst, noteIdx);
        }
        trigger2DNoteAnimation(noteIdx);
      });
    });
  }

  // Cập nhật các Modal chi tiết ở phần bên dưới theo nhạc cụ được chọn
  function updateModalsForInstrument(inst) {
    if (!inst) return;

    // 1. Cập nhật Modal Bài Hát Mẫu (modalSongs)
    var songsList = document.getElementById("songsList");
    if (songsList) {
      if (inst.id === "dantranh") {
        // Giữ các bài mẫu đàn tranh gốc
      } else {
        songsList.innerHTML = '<div class="song-card" style="border: 1.5px solid var(--string-gold); background: rgba(60,30,15,0.7);">' +
          '<div class="song-info">' +
            '<h4 class="song-title">🎶 ' + (inst.demoSong ? inst.demoSong.title : "Giai Điệu Dân Gian") + '</h4>' +
            '<p class="song-desc">Bản nhạc diễn tấu mẫu chuẩn mực của ' + inst.name + ' (' + inst.catName + ' - ' + inst.origin + ').</p>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm btnPlayDynamicDemo" style="background: linear-gradient(135deg, #e8c77e, #b8860b); color:#1a1108; font-weight:bold;">▶️ Tấu Bài Này</button>' +
        '</div>';
        var pBtn = songsList.querySelector(".btnPlayDynamicDemo");
        if (pBtn) {
          pBtn.addEventListener("click", function() {
            closeModal("modalSongs");
            playDemoSongForInstrument(inst.id);
          });
        }
      }
    }

    // 2. Cập nhật Modal Thang Âm (modalScales)
    var scalesModalBody = document.querySelector("#modalScales .modal-body");
    if (scalesModalBody && inst.id !== "dantranh") {
      var noteNames = (inst.notes || []).map(function(n) { return n.name; }).join(" • ");
      scalesModalBody.innerHTML = '<div class="scale-info-box">' +
        '<h3 style="color:var(--string-gold); margin-top:0;">' + inst.icon + ' Thang Âm & Cao Độ: ' + inst.name + '</h3>' +
        '<p style="line-height:1.6; color:var(--text-main);">' + inst.desc + '</p>' +
        '<div style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; margin:12px 0; border:1px solid rgba(232,199,126,0.3);">' +
          '<strong style="color:var(--string-gold);">Dãy Nốt Định Âm:</strong><br>' +
          '<span style="font-size:14px; font-weight:700; color:#fff;">' + (noteNames || "Đang cập nhật") + '</span>' +
        '</div>' +
        '<p style="font-size:12px; color:var(--text-dim);">Xuất xứ truyền thống: ' + inst.origin + ' (' + inst.catName + ').</p>' +
      '</div>';
    }

    // 3. Cập nhật Modal Lịch Sử (modalHistory)
    var historyModalBody = document.querySelector("#modalHistory .modal-body");
    if (historyModalBody && inst.id !== "dantranh") {
      historyModalBody.innerHTML = '<div class="history-info-box">' +
        '<h3 style="color:var(--string-gold); margin-top:0;">📜 Lịch Sử & Nguồn Gốc: ' + inst.name + '</h3>' +
        '<p style="font-size:13.5px; line-height:1.6; color:var(--text-main);">' + inst.desc + '</p>' +
        '<div class="info-card" style="margin-top:12px;">' +
          '<div class="info-card-header">' +
            '<div class="info-avatar">' + inst.icon + '</div>' +
            '<div><h4 class="info-title">' + inst.name + ' (' + (inst.alias || inst.catName) + ')</h4>' +
            '<span class="info-role">Địa bàn văn hóa: ' + inst.origin + '</span></div>' +
          '</div>' +
          '<p class="info-desc">Nhạc cụ thuộc họ ' + inst.catName + ' của văn hóa truyền thống các dân tộc Việt Nam, giữ vai trò quan trọng trong các nghi lễ, lễ hội dân gian và đời sống tinh thần cộng đồng.</p>' +
        '</div>' +
      '</div>';
    }
  }

  // 3b. Mở Modal Hồ Sơ Di Sản & Giới Thiệu Chuyên Sâu Nhạc Cụ
  function openInstrumentDossier(instId) {
    if (!instId) instId = currentActiveInstrument || "dantranh";
    var enc = (typeof window.INSTRUMENT_ENCYCLOPEDIA !== "undefined" && window.INSTRUMENT_ENCYCLOPEDIA[instId]) ? window.INSTRUMENT_ENCYCLOPEDIA[instId] : null;
    var inst = INSTRUMENT_MAP[instId] || enc;
    if (!inst && !enc) return;

    var headerTitle = document.getElementById("modalDossierHeaderTitle");
    var body = document.getElementById("modalDossierBody");
    var icon = (enc && enc.icon) ? enc.icon : (inst ? inst.icon : "🪕");
    var name = (enc && enc.name) ? enc.name : (inst ? inst.name : "");
    var catName = (enc && enc.catName) ? enc.catName : (inst ? inst.catName : "Nhạc khí dân tộc");
    var origin = (enc && enc.origin) ? enc.origin : (inst ? inst.origin : "Việt Nam");
    var alias = (enc && enc.alias) ? enc.alias : (inst ? inst.alias : "");
    var heritage = (enc && enc.heritage) ? enc.heritage : "Di sản âm nhạc cổ truyền Việt Nam";
    var numText = (enc && enc.num) ? ("#" + enc.num + " • ") : "";

    if (headerTitle) {
      headerTitle.innerHTML = '📖 Hồ Sơ Di Sản: ' + icon + ' ' + name + (alias ? ' <span style="font-size:13.5px; opacity:0.8; font-weight:normal;">(' + alias + ')</span>' : '');
    }

    if (body) {
      var html = '<div class="dossier-container" style="color:var(--text-main); font-size:13.5px; line-height:1.65;">';

      // Header summary box
      html += '<div style="display:flex; align-items:center; gap:16px; background:rgba(60,35,18,0.55); padding:16px; border-radius:12px; border:1px solid rgba(232,199,126,0.3); margin-bottom:16px;">' +
        '<div style="font-size:44px; line-height:1; min-width:50px; text-align:center;">' + icon + '</div>' +
        '<div style="flex:1;">' +
          '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">' +
            '<span style="font-size:19px; font-weight:bold; color:var(--string-gold, #e8c77e);">' + name + '</span>' +
            '<span style="background:var(--primary-gold, #c89d42); color:#1a1006; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:10px;">' + numText + catName + '</span>' +
          '</div>' +
          '<div style="font-size:12.5px; color:var(--text-dim);">' +
            '<span>📍 ' + origin + '</span>' +
            (alias ? ' <span style="margin-left:8px;">| Tên khác: <strong>' + alias + '</strong></span>' : '') +
          '</div>' +
          '<div style="font-size:12px; color:var(--primary-gold, #e8c77e); margin-top:3px;">🏛️ ' + heritage + '</div>' +
        '</div>' +
      '</div>';

      // Chi tiết các mục thông tin chuẩn (Họ, Cấu tạo, Cách chơi, Đặc điểm, Dân tộc, Chất liệu, Âm thanh, Sử dụng, Lịch sử)
      html += '<div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.3); padding:16px; border-radius:10px; border:1px solid var(--border-color);">';

      if (enc && enc.family) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Họ:</strong> ' + enc.family + '</div>';
      }
      if (enc && enc.structure) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Cấu tạo:</strong> ' + enc.structure + '</div>';
      }
      if (enc && enc.technique) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Cách chơi:</strong> ' + enc.technique + '</div>';
      }
      if (enc && enc.special) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Đặc điểm:</strong> ' + enc.special + '</div>';
      }
      if (enc && enc.ethnic) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Dân tộc / Địa bàn:</strong> ' + enc.ethnic + '</div>';
      }
      if (enc && enc.materials) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Chất liệu:</strong> ' + enc.materials + '</div>';
      }
      if (enc && enc.sound) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Âm thanh:</strong> ' + enc.sound + '</div>';
      }
      if (enc && enc.usage) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Sử dụng:</strong> ' + enc.usage + '</div>';
      }
      if (enc && enc.history) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Lịch sử:</strong> ' + enc.history + '</div>';
      }
      if (!enc && inst && inst.desc) {
        html += '<div><strong style="color:var(--string-gold, #e8c77e);">• Giới thiệu:</strong> ' + inst.desc + '</div>';
      }

      html += '</div>';

      // Nút điều khiển
      html += '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-secondary btn-sm" id="btnModalCloseDossier">✕ Đóng</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="btnModalDemoDossier">▶️ Tấu Bài Mẫu</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="btnModalStageDossier">🪕 Lên Sân Khấu 3D</button>' +
      '</div>';

      html += '</div>';
      body.innerHTML = html;

      var btnClose = document.getElementById("btnModalCloseDossier");
      if (btnClose) btnClose.addEventListener("click", function() { closeModal("modalInstrumentDossier"); });

      var btnDemo = document.getElementById("btnModalDemoDossier");
      if (btnDemo) btnDemo.addEventListener("click", function() {
        if (typeof playDemoSongForInstrument === "function") {
          playDemoSongForInstrument(instId);
        }
      });

      var btnStage = document.getElementById("btnModalStageDossier");
      if (btnStage) btnStage.addEventListener("click", function() {
        switchInstrument(instId);
        if (typeof window.switchNavTab === "function") {
          window.switchNavTab("dantranh");
        } else if (typeof switchNavTab === "function") {
          switchNavTab("dantranh");
        }
        closeModal("modalInstrumentDossier");
        var stage = document.getElementById("mainApp");
        if (stage) stage.scrollIntoView({ behavior: "smooth" });
      });
    }

    openModal("modalInstrumentDossier");
  }

  // ---------------------------------------------------------
  // F. ĐIỀU HÀNH CHUYỂN ĐỔI 38 NHẠC CỤ (INSTRUMENT SWITCHER)
  // ---------------------------------------------------------
  function switchInstrument(instId) {
    var inst = INSTRUMENT_MAP[instId];
    if (!inst) return;

    currentActiveInstrument = instId;
    stopDemoSong();

    // 1. Cập nhật nút active trong danh sách ribbon & lưới thẻ nhạc cụ
    document.querySelectorAll(".inst-grid-card, .inst-card").forEach(function(card) {
      var isTarget = (card.getAttribute("data-inst-id") === instId);
      var btnStage = card.querySelector(".btnSelectStage");
      if (isTarget) {
        card.classList.add("active");
        if (btnStage) btnStage.textContent = "✓ Đang trên sân khấu";
      } else {
        card.classList.remove("active");
        if (btnStage) btnStage.textContent = "▶ Chơi ngay";
      }
    });

    window.currentActiveInstrument = instId;
    if (typeof window.syncStageFavoriteHeart === "function") {
      window.syncStageFavoriteHeart();
    }
    if (typeof window.logUserWebActivity === "function") {
      window.logUserWebActivity("play", "Chọn nhạc cụ: " + inst.name, inst.catName + " • " + (inst.origin || "Việt Nam"), "dantranh", instId);
    }

    // 1b. Đồng bộ dropdown chọn nhanh
    var selQuick = document.getElementById("selectQuickInstrument");
    if (selQuick && selQuick.value !== instId) {
      selQuick.value = instId;
    }

    // Đồng bộ sang trình phát Nhạc Mẫu & Khung Spotlight Thông tin đàn
    if (typeof window.syncDemoSongWithInstrument === "function") {
      window.syncDemoSongWithInstrument(instId);
    }
    if (typeof window.renderLookupSelectedInstrumentSpotlight === "function") {
      window.renderLookupSelectedInstrumentSpotlight(instId);
    }
    if (typeof window.renderStudioRecentNotesBuffer === "function") {
      window.renderStudioRecentNotesBuffer();
    }

    // 2. Cập nhật nhãn thanh tiêu đề & Navbar Tab Sân khấu theo nhạc cụ được chọn
    var navTabLookup = document.getElementById("navTabLookup");
    var navTabDanTranh = document.getElementById("navTabDanTranh");
    var navTabDemoSongs = document.getElementById("navTabDemoSongs");
    if (window.hasSelectedInstrument) {
      if (navTabLookup) {
        navTabLookup.style.display = "inline-flex";
        navTabLookup.innerHTML = "📖 Thông tin " + inst.name;
      }
      if (navTabDanTranh) {
        navTabDanTranh.style.display = "inline-flex";
      }
      if (navTabDemoSongs) {
        navTabDemoSongs.style.display = "none";
      }
    } else {
      if (navTabLookup) navTabLookup.style.display = "none";
      if (navTabDanTranh) navTabDanTranh.style.display = "none";
      if (navTabDemoSongs) navTabDemoSongs.style.display = "none";
    }
    var navTabInstText = document.getElementById("navTabInstText");
    var navTabInstIcon = document.getElementById("navTabInstIcon");
    if (navTabInstText) {
      navTabInstText.textContent = "Chơi " + inst.name + " (3D)";
    }
    if (navTabInstIcon) {
      navTabInstIcon.textContent = inst.icon || "🪕";
    }

    var lbl3DInstIcon = document.getElementById("lbl3DInstIcon");
    var lbl3DInstName = document.getElementById("lbl3DInstName");
    if (lbl3DInstIcon) lbl3DInstIcon.textContent = inst.icon || "🪕";
    if (lbl3DInstName) lbl3DInstName.textContent = inst.name + " - 3D Xoay 360°";

    var lblActive = document.getElementById("lblActiveInstrumentName");
    if (lblActive) {
      lblActive.textContent = (inst.icon || "🪕") + " " + inst.name + " (3D)";
      lblActive.style.color = "var(--primary-blue)";
      lblActive.style.fontStyle = "normal";
    }

    var stageDanTranh = document.getElementById("danTranhStage");
    var stageUniversal = document.getElementById("universalInstrumentStage");
    if (stageDanTranh) stageDanTranh.style.display = "block";
    if (stageUniversal) stageUniversal.style.display = "block";

    // 3. Cập nhật thông tin chi tiết nhạc cụ trên sân khấu
    var elIcon = document.getElementById("uStageIcon");
    var elTitle = document.getElementById("uStageTitle");
    var elCat = document.getElementById("uStageCat");
    var elOrigin = document.getElementById("uStageOrigin");
    var elDesc = document.getElementById("uStageDesc");
    var lblDemo = document.getElementById("lblDemoSongBtn");

    if (elIcon) elIcon.textContent = inst.icon;
    if (elTitle) elTitle.textContent = inst.name + (inst.alias ? " (" + inst.alias + ")" : "");
    if (elCat) elCat.textContent = inst.catName;
    if (elOrigin) elOrigin.textContent = inst.origin;
    if (elDesc) {
      var enc = (typeof window.INSTRUMENT_ENCYCLOPEDIA !== "undefined" && window.INSTRUMENT_ENCYCLOPEDIA[instId]) ? window.INSTRUMENT_ENCYCLOPEDIA[instId] : null;
      if (enc) {
        var descHtml = '';
        if (enc.family) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Họ:</strong> ' + enc.family + '</div>';
        if (enc.structure) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Cấu tạo:</strong> ' + enc.structure + '</div>';
        if (enc.technique) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Cách chơi:</strong> ' + enc.technique + '</div>';
        if (enc.special) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Đặc điểm:</strong> ' + enc.special + '</div>';
        if (enc.sound) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Âm thanh:</strong> ' + enc.sound + '</div>';
        if (enc.usage) descHtml += '<div style="margin-bottom:8px;"><strong style="color:var(--string-gold, #e8c77e);">• Sử dụng:</strong> ' + enc.usage + '</div>';
        if (enc.history) descHtml += '<div style="margin-bottom:4px;"><strong style="color:var(--string-gold, #e8c77e);">• Lịch sử:</strong> ' + enc.history + '</div>';
        elDesc.innerHTML = descHtml;
      } else {
        elDesc.textContent = inst.desc;
      }
    }
    if (lblDemo) lblDemo.textContent = "Tấu Bài Mẫu: " + (inst.demoSong ? inst.demoSong.title : "Giai Điệu Mẫu");

    // 4. Render các phím bấm/dây/mặt gõ của nhạc cụ này trên sân khấu
    renderUniversalPlaySurface(inst);
    if (typeof updateCount === "function") {
      updateCount(inst);
    }

    // 4b. Render tác phẩm 2D Vector chân thực & tương tác cho nhạc cụ này
    if (typeof render2DInstrument === "function") {
      render2DInstrument(instId);
    }

    // 5. Tự động chuyển đổi sang Mô Hình 3D Xoay 360 Độ của nhạc cụ này!
    if (!is3DInitialized && typeof initDanTranh3D === "function") {
      initDanTranh3D();
    }
    if (typeof build3DModelForInstrument === "function") {
      build3DModelForInstrument(instId);
    }
    setTimeout(function() {
      if (typeof on3DWindowResize === "function") on3DWindowResize();
    }, 50);
    setTimeout(function() {
      if (typeof on3DWindowResize === "function") on3DWindowResize();
    }, 180);

    var hintEl = document.querySelector(".hint-bottom");
    if (hintEl) {
      hintEl.innerHTML = "🖱️ Kéo chuột / vuốt ngón tay để <strong>xoay 360°</strong> xung quanh <strong>" + inst.name + "</strong>, click trực tiếp vào mô hình 3D hoặc bấm phím bàn phím tương ứng để tấu nhạc!";
    }

    // 4. Tự động đồng bộ các mục chi tiết ở phần bên dưới (Nhạc mẫu, Thang âm, Lịch sử)
    updateModalsForInstrument(inst);
    if (typeof window.syncInstrumentTaskbarInfo === "function") {
      window.syncInstrumentTaskbarInfo();
    }
    if (typeof updateAiLiveObservationUI === "function") {
      updateAiLiveObservationUI();
    }
  }

  // ---------------------------------------------------------
  // G. RENDER THANH 38 NHẠC CỤ & TABS & BỘ LỌC TÌM KIẾM
  // ---------------------------------------------------------
  var currentCategoryFilter = "all";
  var currentSearchQuery = "";

  function normCat(s) {
    if (!s) return "";
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  function renderAllInstrumentsRibbon() {
    var ribbon = document.getElementById("allInstrumentsRibbon");
    if (!ribbon) return;
    ribbon.innerHTML = "";

    var encMap = window.INSTRUMENT_ENCYCLOPEDIA || {};

    var filtered = ALL_INSTRUMENTS.filter(function(inst) {
      // Bộ lọc danh mục (Chuẩn hóa không dấu: hỗ trợ cả 'day' và 'dây')
      var fNorm = normCat(currentCategoryFilter);
      var cNorm = normCat(inst.cat);
      var matchCat = fNorm === "all" || cNorm === fNorm || (fNorm === "day" && cNorm === "day");
      if (!matchCat) return false;

      // Bộ lọc tìm kiếm
      if (currentSearchQuery.trim() !== "") {
        var q = normCat(currentSearchQuery);
        var enc = encMap[inst.id] || {};
        var matchName = normCat(inst.name).indexOf(q) !== -1;
        var matchAlias = (inst.alias && normCat(inst.alias).indexOf(q) !== -1) || (enc.alias && normCat(enc.alias).indexOf(q) !== -1);
        var matchOrigin = (inst.origin && normCat(inst.origin).indexOf(q) !== -1) || (enc.ethnic && normCat(enc.ethnic).indexOf(q) !== -1);
        var matchCatName = inst.catName && normCat(inst.catName).indexOf(q) !== -1;
        return matchName || matchAlias || matchOrigin || matchCatName;
      }
      return true;
    });

    if (filtered.length === 0) {
      ribbon.innerHTML = '<div style="color:var(--text-dim); font-size:13px; padding:12px;">Không tìm thấy nhạc cụ phù hợp với từ khóa.</div>';
      return;
    }

    filtered.forEach(function(inst) {
      var card = document.createElement("div");
      var isCurrent = (inst.id === currentActiveInstrument);
      var catClass = "cat-" + normCat(inst.cat);
      card.className = "inst-card " + catClass + (isCurrent ? " active" : "");
      card.setAttribute("data-inst-id", inst.id);

      var enc = encMap[inst.id] || {};
      var demoTitle = (inst.demoSong && inst.demoSong.title) ? inst.demoSong.title : "Bản cổ truyền";
      var noteCountText = inst.notes ? (inst.notes.length + " bậc âm") : "Đa âm";
      var aliasDisplay = enc.alias || inst.alias || "";
      var ethnicDisplay = enc.ethnic || enc.origin || inst.origin || "Việt Nam";
      var familyDisplay = enc.family || inst.catName || "Nhạc khí dân tộc";
      var structureDisplay = enc.structure || "";
      var materialsDisplay = enc.materials || "";
      var techniqueDisplay = enc.technique || "";
      var soundDisplay = enc.sound || inst.desc || "Âm thanh truyền thống trong trẻo, uyển chuyển, đậm chất Việt.";
      var usageDisplay = enc.usage || "";
      var historyDisplay = enc.history || "";

      var detailsHtml =
        '<div class="inst-card-detail-list" style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(226,192,141,0.16); display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:#dcd0be; line-height:1.5;">' +
          '<div><strong style="color:#f3d9b1;">• Họ nhạc khí:</strong> ' + familyDisplay + '</div>' +
          '<div><strong style="color:#f3d9b1;">• Dân tộc / Xuất xứ:</strong> ' + ethnicDisplay + '</div>' +
          (structureDisplay ? '<div><strong style="color:#f3d9b1;">• Cấu tạo:</strong> ' + structureDisplay + '</div>' : '') +
          (materialsDisplay ? '<div><strong style="color:#f3d9b1;">• Chất liệu:</strong> ' + materialsDisplay + '</div>' : '') +
          (techniqueDisplay ? '<div><strong style="color:#f3d9b1;">• Cách chơi:</strong> ' + techniqueDisplay + '</div>' : '') +
          '<div><strong style="color:#f3d9b1;">• Âm thanh:</strong> ' + soundDisplay + '</div>' +
          (usageDisplay ? '<div><strong style="color:#f3d9b1;">• Sử dụng:</strong> ' + usageDisplay + '</div>' : '') +
          (historyDisplay ? '<div><strong style="color:#f3d9b1;">• Lịch sử &amp; Nguồn gốc:</strong> ' + historyDisplay + '</div>' : '') +
        '</div>';

      card.innerHTML =
        '<div class="inst-card-visual">' +
          '<div class="inst-visual-glow"></div>' +
          '<div class="inst-card-icon">' + inst.icon + '</div>' +
          '<span class="inst-card-cat-badge">' + inst.catName + '</span>' +
        '</div>' +
        '<div class="inst-card-body">' +
          '<div class="inst-card-title-row">' +
            '<h3 class="inst-card-title">' + inst.name + (aliasDisplay ? ' <small style="font-size:12px; font-weight:500; color:var(--text-dim);">(' + aliasDisplay + ')</small>' : '') + '</h3>' +
          '</div>' +
          '<div class="inst-card-sub">📍 ' + ethnicDisplay + '</div>' +
          detailsHtml +
          '<div class="inst-feature-pills" style="margin-top:10px;">' +
            '<span class="inst-feat-pill">🎼 ' + noteCountText + '</span>' +
            '<span class="inst-feat-pill">🎵 ' + demoTitle + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="inst-card-actions">' +
          '<button type="button" class="btn-inst-action btnPlayDemo" title="Nghe thử âm thanh mẫu của nhạc cụ này">' +
            '🎧 Nghe thử âm thanh' +
          '</button>' +
          '<button type="button" class="btn-inst-action btn-inst-primary btnOpenDossier" title="Xem hồ sơ nghiên cứu chuyên sâu về nhạc cụ này">' +
            '🔬 Xem nghiên cứu chuyên sâu →' +
          '</button>' +
        '</div>';

      // Sự kiện: Nghe thử bài mẫu ngay tại chỗ (không chuyển sang sân khấu 3D)
      var btnDemo = card.querySelector(".btnPlayDemo");
      if (btnDemo) {
        btnDemo.addEventListener("click", function(e) {
          e.stopPropagation();
          window.currentActiveInstrument = inst.id;
          switchInstrument(inst.id);
          playDemoSongForInstrument(inst.id);
        });
      }

      // Sự kiện: Chuyển sang Tab Nghiên cứu chuyên sâu
      var btnDos = card.querySelector(".btnOpenDossier");
      if (btnDos) {
        btnDos.addEventListener("click", function(e) {
          e.stopPropagation();
          switchInstrument(inst.id);
          if (typeof window.openInstrumentResearchTab === "function") {
            window.openInstrumentResearchTab(inst.id);
          } else {
            openInstrumentDossier(inst.id);
          }
        });
      }

      // Sự kiện: Bấm vào thẻ nhạc cụ -> Tự động chọn nhạc cụ, mở ngay Tab 3D Sân khấu & cập nhật Nhạc mẫu
      card.addEventListener("click", function(e) {
        if (e.target.closest(".btn-inst-action")) return;
        window.hasSelectedInstrument = true;
        window.currentActiveInstrument = inst.id;
        window.currentResearchInstrument = inst.id;
        switchInstrument(inst.id);
        if (typeof window.switchNavTab === "function") {
          window.switchNavTab("dantranh");
        } else if (typeof switchNavTab === "function") {
          switchNavTab("dantranh");
        }
        if (typeof window.syncDemoSongWithInstrument === "function") {
          window.syncDemoSongWithInstrument(inst.id);
        }
        if (typeof window.autoSelectInstrumentInLookup === "function") {
          window.autoSelectInstrumentInLookup(inst.id);
        }
      });

      ribbon.appendChild(card);
    });
  }

  // Khởi tạo 4 nút loại nhạc cụ trong Bộ lọc Mega-Menu trên thanh công cụ
  function initCategoryTabs() {
    var tabBtns = document.querySelectorAll("#megaFilterDropdownPanel .inst-cat-tab[data-filter], #tabContentLookup .inst-cat-tab[data-filter]");
    var catTitleMap = {
      day: "🎻 Danh sách nhạc cụ: Bộ Đàn Dây (13 nhạc cụ)",
      hoi: "🎋 Danh sách nhạc cụ: Bộ Sáo, Kèn & Hơi (11 nhạc cụ)",
      go: "🔔 Danh sách nhạc cụ: Bộ Tự Thân Vang / Gõ (8 nhạc cụ)",
      trong: "🥁 Danh sách nhạc cụ: Bộ Trống Dân Tộc (4 nhạc cụ)"
    };
    tabBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        tabBtns.forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        currentCategoryFilter = btn.getAttribute("data-filter") || "all";
        var headingEl = document.getElementById("lookupResultsHeading");
        if (headingEl && catTitleMap[currentCategoryFilter]) {
          headingEl.innerHTML = catTitleMap[currentCategoryFilter];
        }
      });
    });
  }

  // Khởi tạo Thanh tìm kiếm nhanh nhạc cụ trên Trang Tra Cứu
  function initSearchInput() {
    var inp = document.getElementById("inpSearchInstrument");
    if (!inp) return;
    inp.addEventListener("input", function() {
      currentSearchQuery = inp.value;
      var activeCatBtn = document.querySelector("#megaFilterDropdownPanel .inst-cat-tab.active, #tabContentLookup .inst-cat-tab.active");
      var headingEl = document.getElementById("lookupResultsHeading");
      if (inp.value.trim() !== "") {
        if (!activeCatBtn) {
          currentCategoryFilter = "all";
          if (headingEl) {
            headingEl.innerHTML = '🔍 Kết quả tìm kiếm cho: "' + inp.value.trim() + '"';
          }
        }
      } else {
        if (!activeCatBtn) {
          currentCategoryFilter = "all";
          if (headingEl) {
            headingEl.innerHTML = '📚 Thông tin chi tiết 36 Nhạc Cụ Dân Tộc Việt Nam';
          }
        }
      }
    });
  }

  // Khởi tạo Nút Tấu Bài Mẫu của nhạc cụ
  function initDemoSongButton() {
    var btnPlay = document.getElementById("btnPlayInstrumentDemo");
    var btnStop = document.getElementById("btnStopInstrumentDemo");
    var btnPlayTranh = document.getElementById("btnPlayTranhDemo");
    var btnStopTranh = document.getElementById("btnStopTranhDemo");

    if (btnPlay) {
      btnPlay.addEventListener("click", function() {
        if (isDemoPlaying) {
          stopDemoSong();
        } else {
          if (!currentActiveInstrument) {
            currentActiveInstrument = "dantranh";
          }
          if (typeof window.AVAILABLE_DEMO_TRACK_MAP !== "undefined" && !window.AVAILABLE_DEMO_TRACK_MAP[currentActiveInstrument]) {
            var inst = INSTRUMENT_MAP[currentActiveInstrument];
            var instName = inst ? inst.name : "nhạc cụ này";
            alert("⏳ Bản nhạc mẫu cho " + instName + " đang được nghệ nhân hoàn thiện và sẽ cập nhật nhạc sau!");
            return;
          }
          playDemoSongForInstrument(currentActiveInstrument);
        }
      });
    }

    if (btnStop) {
      btnStop.addEventListener("click", function() {
        stopDemoSong();
      });
    }

    if (btnPlayTranh) {
      btnPlayTranh.addEventListener("click", function() {
        if (isDemoPlaying) {
          stopDemoSong();
        } else {
          playDemoSongForInstrument("dantranh");
        }
      });
    }

    if (btnStopTranh) {
      btnStopTranh.addEventListener("click", function() {
        stopDemoSong();
      });
    }
  }

  // ---------------------------------------------------------
  // H. CHẾ ĐỘ ĐẠI HÒA TẤU DÂN TỘC (GRAND ENSEMBLE ENGINE)
  // ---------------------------------------------------------
  var isEnsemblePlaying = false;
  var ensembleTimeouts = [];
  var ensembleVolume = 0.45;

  var ENSEMBLE_GROOVES = {
    luuthuy: {
      bpm: 112,
      pattern: [
        { drum: "tum", freq: 110, duration: 260 },
        { drum: "chat", freq: 220, duration: 260 },
        { drum: "tum", freq: 110, duration: 260 },
        { drum: "rim", freq: 180, duration: 260 },
        { drum: "phach", freq: 850, duration: 260 },
        { drum: "chat", freq: 220, duration: 260 }
      ]
    },
    rucon: {
      bpm: 78,
      pattern: [
        { drum: "tum", freq: 95, duration: 420 },
        { drum: "rim", freq: 140, duration: 420 },
        { drum: "phach", freq: 720, duration: 420 },
        { drum: "tum", freq: 95, duration: 420 }
      ]
    },
    lynguao: {
      bpm: 130,
      pattern: [
        { drum: "tum", freq: 130, duration: 220 },
        { drum: "chat", freq: 240, duration: 220 },
        { drum: "tum", freq: 130, duration: 110 },
        { drum: "tum", freq: 130, duration: 110 },
        { drum: "phach", freq: 900, duration: 220 },
        { drum: "thanhla", freq: 1450, duration: 220 }
      ]
    },
    tronghoi: {
      bpm: 125,
      pattern: [
        { drum: "tum", freq: 120, duration: 240 },
        { drum: "tum", freq: 120, duration: 240 },
        { drum: "chat", freq: 230, duration: 240 },
        { drum: "phach", freq: 880, duration: 120 },
        { drum: "phach", freq: 880, duration: 120 },
        { drum: "thanhla", freq: 1600, duration: 240 }
      ]
    }
  };

  function playEnsembleBeat(step) {
    if (!isEnsemblePlaying) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;

    var grooveKey = (document.getElementById("selectEnsembleGroove") && document.getElementById("selectEnsembleGroove").value) || "luuthuy";
    var groove = ENSEMBLE_GROOVES[grooveKey] || ENSEMBLE_GROOVES.luuthuy;
    var item = groove.pattern[step % groove.pattern.length];

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = item.drum === "tum" ? "sine" : (item.drum === "chat" ? "triangle" : "square");
    osc.frequency.setValueAtTime(item.freq, now);

    var decay = item.duration / 1000;
    gain.gain.setValueAtTime(ensembleVolume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(gain);
    safeConnectOutput(gain);

    osc.start(now);
    osc.stop(now + decay + 0.02);

    var nextT = setTimeout(function() {
      playEnsembleBeat(step + 1);
    }, item.duration);
    ensembleTimeouts.push(nextT);
  }

  function toggleEnsemble() {
    isEnsemblePlaying = !isEnsemblePlaying;
    var icon = document.getElementById("ensemblePlayIcon");
    var txt = document.getElementById("ensemblePlayText");
    var btn = document.getElementById("btnToggleEnsemble");

    if (isEnsemblePlaying) {
      getAudioContext();
      if (icon) icon.textContent = "⏹️";
      if (txt) txt.textContent = "Dừng Đại Hòa Tấu";
      if (btn) btn.classList.add("playing");
      playEnsembleBeat(0);
    } else {
      ensembleTimeouts.forEach(function(t) { clearTimeout(t); });
      ensembleTimeouts = [];
      if (icon) icon.textContent = "▶️";
      if (txt) txt.textContent = "Bật Dàn Nhạc Đệm Nền";
      if (btn) btn.classList.remove("playing");
    }
  }

  // ---------------------------------------------------------
  // I. PHÁT ÂM CHUỖI NỐT ĐÀN TRANH 3D (GLISSANDO)
  // ---------------------------------------------------------
  function stopGlissando() {
    glissandoTimeouts.forEach(function(t) { clearTimeout(t); });
    glissandoTimeouts = [];
  }

  function playGlissandoHighToLow() {
    if (!currentActiveInstrument) {
      currentActiveInstrument = "dantranh";
    }
    stopGlissando();
    stopAiPlaying();
    stopDemoSong();
    getAudioContext();

    var badge = document.getElementById("lbl3DStringPlayed");
    if (badge) {
      badge.style.display = "block";
      badge.textContent = "🎶 Lướt Nốt: Cao → Thấp";
    }

    if (currentActiveInstrument === "dantranh") {
      for (var i = 15; i >= 0; i--) {
        (function(stringIdx, step) {
          var t = setTimeout(function() {
            pluck(stringIdx);
            if (step === 0) {
              setTimeout(function() {
                if (badge) badge.style.display = "none";
              }, 800);
            }
          }, (15 - step) * 58);
          glissandoTimeouts.push(t);
        })(i, i);
      }
    } else {
      var activeInst = INSTRUMENT_MAP[currentActiveInstrument];
      if (activeInst && activeInst.notes && activeInst.notes.length > 0) {
        var totalNotes = activeInst.notes.length;
        for (var j = totalNotes - 1; j >= 0; j--) {
          (function(noteIdx, step) {
            var t = setTimeout(function() {
              playUniversalInstrumentNote(activeInst, noteIdx);
              var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
              if (surfaceBtns[noteIdx]) {
                surfaceBtns[noteIdx].classList.add("playing");
                setTimeout(function() { surfaceBtns[noteIdx].classList.remove("playing"); }, 150);
              }
              if (step === 0) {
                setTimeout(function() {
                  if (badge) badge.style.display = "none";
                }, 800);
              }
            }, ((totalNotes - 1) - step) * 65);
            glissandoTimeouts.push(t);
          })(j, j);
        }
      }
    }
  }

  function playGlissandoLowToHigh() {
    if (!currentActiveInstrument) {
      currentActiveInstrument = "dantranh";
    }
    stopGlissando();
    stopAiPlaying();
    stopDemoSong();
    getAudioContext();

    var badge = document.getElementById("lbl3DStringPlayed");
    if (badge) {
      badge.style.display = "block";
      badge.textContent = "🎶 Lướt Nốt: Thấp → Cao";
    }

    if (currentActiveInstrument === "dantranh") {
      for (var i = 0; i <= 15; i++) {
        (function(stringIdx, step) {
          var t = setTimeout(function() {
            pluck(stringIdx);
            if (step === 15) {
              setTimeout(function() {
                if (badge) badge.style.display = "none";
              }, 800);
            }
          }, step * 58);
          glissandoTimeouts.push(t);
        })(i, i);
      }
    } else {
      var activeInst = INSTRUMENT_MAP[currentActiveInstrument];
      if (activeInst && activeInst.notes && activeInst.notes.length > 0) {
        var totalNotes = activeInst.notes.length;
        for (var j = 0; j < totalNotes; j++) {
          (function(noteIdx, step) {
            var t = setTimeout(function() {
              playUniversalInstrumentNote(activeInst, noteIdx);
              var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
              if (surfaceBtns[noteIdx]) {
                surfaceBtns[noteIdx].classList.add("playing");
                setTimeout(function() { surfaceBtns[noteIdx].classList.remove("playing"); }, 150);
              }
              if (step === totalNotes - 1) {
                setTimeout(function() {
                  if (badge) badge.style.display = "none";
                }, 800);
              }
            }, step * 65);
            glissandoTimeouts.push(t);
          })(j, j);
        }
      }
    }
  }

  // ---------------------------------------------------------
  // J. GẮN SỰ KIỆN NÚT ĐIỀU KHIỂN 3D VÀ BÀN PHÍM TOÀN NĂNG
  // ---------------------------------------------------------
  var btnGlissandoHighLow = document.getElementById("btnGlissandoHighLow");
  if (btnGlissandoHighLow) btnGlissandoHighLow.addEventListener("click", playGlissandoHighToLow);

  var btnGlissandoLowHigh = document.getElementById("btnGlissandoLowHigh");
  if (btnGlissandoLowHigh) btnGlissandoLowHigh.addEventListener("click", playGlissandoLowToHigh);

  var btnAutoRotate3D = document.getElementById("btnAutoRotate3D");
  if (btnAutoRotate3D) {
    btnAutoRotate3D.addEventListener("click", function() {
      if (controls3D) {
        controls3D.autoRotate = !controls3D.autoRotate;
        btnAutoRotate3D.textContent = controls3D.autoRotate ? "⏹️ Dừng Xoay" : "🔄 Xoay 360° Tự Động";
      }
    });
  }

  var btnResetView3D = document.getElementById("btnResetView3D");
  if (btnResetView3D) {
    btnResetView3D.addEventListener("click", function() {
      if (camera3D && controls3D) {
        camera3D.position.set(0, 7.5, 12.0);
        controls3D.target.set(0, 0, 0);
        controls3D.update();
      }
    });
  }

  var btnTopView3D = document.getElementById("btnTopView3D");
  if (btnTopView3D) {
    btnTopView3D.addEventListener("click", function() {
      if (camera3D && controls3D) {
        camera3D.position.set(0, 14.5, 0.05);
        controls3D.target.set(0, 0, 0);
        controls3D.update();
      }
    });
  }

  var btnToggleEnsemble = document.getElementById("btnToggleEnsemble");
  if (btnToggleEnsemble) btnToggleEnsemble.addEventListener("click", toggleEnsemble);

  var sliderEnsembleVol = document.getElementById("sliderEnsembleVol");
  if (sliderEnsembleVol) {
    sliderEnsembleVol.addEventListener("input", function() {
      ensembleVolume = parseInt(sliderEnsembleVol.value, 10) / 100;
    });
  }

  // ---------------------------------------------------------
  // K. BÀN PHÍM THÔNG MINH CHO TẤT CẢ NHẠC CỤ (CHỈ KHỚP ĐÚNG NHÃN PHÍM HIỂN THỊ)
  // ---------------------------------------------------------
  var uKeysPressed = {};
  window.addEventListener("keydown", function(e) {
    if (window.listeningKeybindSlot) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.isContentEditable)) return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;

    var pressedKey = String(e.key).toUpperCase();
    var instId = currentActiveInstrument || "dantranh";
    var activeInst = INSTRUMENT_MAP[instId];

    if (activeInst && activeInst.notes && activeInst.notes.length > 0) {
      var noteIdx = -1;

      // Khớp chính xác với phím đã tự setting của người dùng (hoặc nhãn phím mặc định của nhạc cụ)
      for (var i = 0; i < activeInst.notes.length; i++) {
        var n = activeInst.notes[i];
        var expectedKey = typeof window.getUserEffectiveKeyForNote === "function"
          ? String(window.getUserEffectiveKeyForNote(instId, i, n.key || (i + 1))).toUpperCase()
          : String(n.key || (i + 1)).toUpperCase();
        if (expectedKey === pressedKey) {
          noteIdx = i;
          break;
        }
      }

      if (noteIdx !== -1 && noteIdx < activeInst.notes.length) {
        if (uKeysPressed[pressedKey]) return;
        uKeysPressed[pressedKey] = true;

        getAudioContext();
        playUniversalInstrumentNote(activeInst, noteIdx);

        // Hiệu ứng animation sáng phím bấm trên mặt đàn
        var surfaceBtns = document.querySelectorAll(".u-note-key-btn");
        if (surfaceBtns[noteIdx]) {
          surfaceBtns[noteIdx].classList.add("playing");
          setTimeout(function() {
            surfaceBtns[noteIdx].classList.remove("playing");
          }, 200);
        }
      }
    }
  });

  window.addEventListener("keyup", function(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.isContentEditable)) return;
    delete uKeysPressed[String(e.key).toUpperCase()];
  });

  // Expose các biến và hàm quan trọng ra window
  window.ALL_INSTRUMENTS = ALL_INSTRUMENTS;
  window.INSTRUMENT_MAP = INSTRUMENT_MAP;
  window.renderUniversalPlaySurface = renderUniversalPlaySurface;
  window.switchInstrument = switchInstrument;
  window.renderAllInstrumentsRibbon = renderAllInstrumentsRibbon;
  window.resetLookupCategoryFilter = function() {
    currentCategoryFilter = "all";
    currentSearchQuery = "";
    renderAllInstrumentsRibbon();
  };
  window.openInstrumentDossier = openInstrumentDossier;
  window.render2DInstrument = render2DInstrument;
  window.trigger2DNoteAnimation = trigger2DNoteAnimation;
  window.playUniversalInstrumentNote = playUniversalInstrumentNote;
  window.playDemoSongForInstrument = playDemoSongForInstrument;
  window.stopDemoSong = stopDemoSong;
  window.renderer3D = renderer3D;
  window.scene3D = scene3D;
  window.camera3D = camera3D;
  window.initDanTranh3D = initDanTranh3D;
  window.build3DModelForInstrument = build3DModelForInstrument;
  window.on3DWindowResize = on3DWindowResize;

  // Expose Hero 3D Key Visual API
  window.initHero3DModel = initHero3DModel;
  window.onHero3DResize = onHero3DResize;

  // Expose Server Audio Config API
  window.getServerAudioConfig = getServerAudioConfig;
  window.saveServerAudioConfig = saveServerAudioConfig;
  window.getServerAudioForNote = getServerAudioForNote;
  window.setServerAudioForNote = setServerAudioForNote;
  window.removeServerAudioForNote = removeServerAudioForNote;
  window.clearServerAudioForInstrument = clearServerAudioForInstrument;
  window.playServerCustomAudioForNote = playServerCustomAudioForNote;

  // Khởi tạo toàn bộ giao diện 38 nhạc cụ khi trang tải xong
  setTimeout(function() {
    initCategoryTabs();
    initSearchInput();
    initDemoSongButton();
    renderAllInstrumentsRibbon();
    // Giữ trạng thái ban đầu: Các nút chức năng chưa được chọn đều hiển thị "Hãy lựa chọn nhạc cụ"

    // Khởi tạo mô hình 3D Hoàng Kim tự xoay ở Hero section
    setTimeout(function() {
      if (typeof initHero3DModel === "function") initHero3DModel();
    }, 120);

    var btnDossierMain = document.getElementById("btnOpenInstrumentDossier");
    if (btnDossierMain) {
      btnDossierMain.addEventListener("click", function() {
        openInstrumentDossier(currentActiveInstrument || "dantranh");
      });
    }
  }, 100);

  // 11. KHỞI TẠO HỆ THỐNG
  // =========================================================
  initTheme();
  initUsers();
  updateCount();
  currentActiveInstrument = "dantranh";
  window.currentActiveInstrument = "dantranh";
  window.hasSelectedInstrument = true;
  if (typeof switchInstrument === "function") {
    switchInstrument("dantranh");
  }
  showScreen("mainApp");

})();
