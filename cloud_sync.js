/**
 * ============================================================================
 * DanTranhCloudSync - HỆ THỐNG ĐỒNG BỘ CLOUD, REALTIME & QUẢN LÝ DỮ LIỆU TẬP TRUNG
 * ============================================================================
 * Đồng bộ dữ liệu tập trung trên Server Cloud Relay đa thiết bị:
 * 1. Hòm thư Admin (Admin Mailbox / Báo cáo & Lời nhắn người dùng - Phản hồi)
 * 2. Hệ thống Thông báo hệ thống (Announcements & Trạng thái đã đọc riêng từng tài khoản)
 * 3. Diễn đàn thảo luận (Forum Posts, Comments, Upvotes, Attachments)
 * 4. Tài khoản người dùng (Registered Users) & Cấu hình âm thanh nhạc cụ
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Endpoint Cloud Relay trung tâm chính thức phục vụ đồng bộ đa máy tính & thiết bị
  var DEFAULT_RELAY_ENDPOINT = 'https://extendsclass.com/api/json-storage/bin/caeeabe';

  // Các khóa lưu trữ cục bộ (Local / Shared Cache)
  var STORAGE_KEYS = {
    ANNOUNCEMENTS: 'dan_tranh_announcements',
    ANNOUNCEMENT_READS: 'dan_tranh_announcement_reads',
    REPORTS: 'dan_tranh_reports',
    FORUM_POSTS: 'mit_forum_real_posts_v5',
    FORUM_POSTS_ALT: 'dan_tranh_forum_posts',
    FORUM_DELETED: 'mit_forum_deleted_post_ids',
    FORUM_BANNED: 'mit_forum_banned_users_v1',
    HDNC_VIDEOS: 'dan_tranh_hdnc_videos_v1',
    HDNC_DELETED: 'dan_tranh_hdnc_deleted_ids_v1',
    SERVER_AUDIO: 'dan_tranh_server_audio_config',
    CLOUD_CONFIG: 'dan_tranh_cloud_config',
    USER_SESSION: 'dan_tranh_user_session',
    USERS: 'dan_tranh_users'
  };

  var EXTENDS_BIN_CREATE_URL = 'https://extendsclass.com/api/json-storage/bin';
  var EXTENDS_CHUNK_SIZE = 22000;
  var _childBinCache = {};
  var _resolvingMediaRefs = {};
  var _cloudHealth = {
    lastOkAt: 0,
    lastError: null,
    lastErrorAt: 0
  };

  // Kênh BroadcastChannel đồng bộ tức thì giữa các Tab/Cửa sổ cùng trình duyệt (<10ms)
  var syncBus = null;
  try {
    if (typeof window.BroadcastChannel === 'function') {
      syncBus = new BroadcastChannel('dan_tranh_cloud_sync_bus');
    }
  } catch (e) {
    console.warn('[CloudSync] BroadcastChannel không khả dụng:', e);
  }

  // Khởi tạo IndexedDB lưu trữ âm thanh nhị phân (tránh quá tải quota 5MB của localStorage)
  var idbPromise = null;
  function getIDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      var req = window.indexedDB.open('DanTranhAudioDB', 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs', { keyPath: 'id' });
        }
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function () {
        resolve(null);
      };
    });
    return idbPromise;
  }

  function saveBlobToIDB(id, blob, meta) {
    return getIDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('audio_blobs', 'readwrite');
          var store = tx.objectStore('audio_blobs');
          store.put({ id: id, blob: blob, meta: meta, updatedAt: Date.now() });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (err) {
          resolve(false);
        }
      });
    });
  }

  function getBlobFromIDB(id) {
    return getIDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('audio_blobs', 'readonly');
          var store = tx.objectStore('audio_blobs');
          var req = store.get(id);
          req.onsuccess = function (e) {
            resolve(e.target.result ? e.target.result.blob : null);
          };
          req.onerror = function () { resolve(null); };
        } catch (err) {
          resolve(null);
        }
      });
    });
  }

  // ============================================================================
  // CẤU HÌNH CLOUD & CLOUD ADAPTERS (Supabase / Firebase / Cloud Relay)
  // ============================================================================
  function getCloudConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.CLOUD_CONFIG);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (!parsed.relayEndpoint) {
          parsed.relayEndpoint = DEFAULT_RELAY_ENDPOINT;
        }
        return parsed;
      }
    } catch (e) {}
    return {
      provider: 'relay', // 'relay' | 'supabase' | 'firebase'
      relayEndpoint: DEFAULT_RELAY_ENDPOINT,
      supabaseUrl: '',
      supabaseAnonKey: '',
      supabaseBucket: 'dan_tranh_audio',
      firebaseDbUrl: '',
      firebaseApiKey: '',
      firebaseStorageBucket: '',
      lastSyncTimestamp: 0
    };
  }

  function saveCloudConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEYS.CLOUD_CONFIG, JSON.stringify(cfg));
    } catch (e) {}
  }

  // ============================================================================
  // LẤY THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP
  // ============================================================================
  function getCurrentUsername() {
    try {
      if (typeof window.getActiveUserAccount === 'function') {
        var u = window.getActiveUserAccount();
        if (u && u.username) return String(u.username).trim().toLowerCase();
      }
      var raw = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.username) return String(parsed.username).trim().toLowerCase();
      }
    } catch (e) {}
    return 'guest';
  }

  // ============================================================================
  // QUẢN LÝ THÔNG BÁO (ANNOUNCEMENTS) & TRẠNG THÁI ĐÃ ĐỌC (PER-USER READ STATE)
  // ============================================================================

  // Danh sách thông báo mặc định hệ thống ban đầu
  var DEFAULT_ANNOUNCEMENTS = [
    {
      id: 1730000001000,
      title: 'Chào mừng bạn đến với Không Gian Âm Nhạc Truyền Thống Heritune!',
      content: 'Hệ thống đã hỗ trợ tương tác 36 nhạc cụ truyền thống Việt Nam, mô hình 3D, âm thanh nốt mộc và chế độ tùy chỉnh âm thanh dây đàn theo chuẩn phòng thu.',
      body: 'Hệ thống đã hỗ trợ tương tác 36 nhạc cụ truyền thống Việt Nam, mô hình 3D, âm thanh nốt mộc và chế độ tùy chỉnh âm thanh dây đàn theo chuẩn phòng thu.',
      tag: 'update',
      tagLabel: '🚀 Cập nhật hệ thống',
      time: '04/11/2026 09:00',
      date: '04/11/2026',
      author: 'Admin (Ban Quản Trị)',
      createdAt: 1730000001000
    }
  ];

  function getStoredAnnouncements() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_ANNOUNCEMENTS.slice();
  }

  function saveStoredAnnouncements(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch (e) {}
  }

  // Đọc bảng trạng thái đọc của người dùng: { username: [id1, id2, ...] }
  function getStoredReadsMap() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENT_READS);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  }

  function saveStoredReadsMap(map) {
    try {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENT_READS, JSON.stringify(map));
    } catch (e) {}
  }

  // Lấy số lượng thông báo chưa đọc cho một tài khoản cụ thể
  function getUnreadAnnouncementsCount(username) {
    var u = (username || getCurrentUsername() || 'guest').toLowerCase();
    var list = getStoredAnnouncements();
    var readsMap = getStoredReadsMap();
    var userReadList = readsMap[u] || [];

    // Chuyển sang dạng Set chuỗi hoặc số để so sánh chính xác
    var readIdSet = new Set(userReadList.map(function (id) { return String(id); }));

    var unreadCount = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && item.id) {
        if (!readIdSet.has(String(item.id))) {
          unreadCount++;
        }
      }
    }
    return unreadCount;
  }

  // Đánh dấu tất cả thông báo hiện có là đã đọc cho tài khoản đang đăng nhập
  function markAllAnnouncementsAsRead(username) {
    var u = (username || getCurrentUsername() || 'guest').toLowerCase();
    var list = getStoredAnnouncements();
    var readsMap = getStoredReadsMap();
    var currentReads = readsMap[u] || [];
    var readIdSet = new Set(currentReads.map(function (id) { return String(id); }));

    list.forEach(function (item) {
      if (item && item.id) {
        readIdSet.add(String(item.id));
      }
    });

    readsMap[u] = Array.from(readIdSet);
    saveStoredReadsMap(readsMap);

    // Phát tín hiệu đồng bộ cho các tab khác và cập nhật badge
    broadcastSyncMessage({
      type: 'READS_UPDATED',
      username: u,
      reads: readsMap[u]
    });

    // Cập nhật giao diện badge ngay lập tức
    updateNotificationBadgeUI();

    // Đẩy trạng thái đọc lên Cloud để đồng bộ sang các thiết bị khác của tài khoản này
    syncReadsToCloud(u, readsMap[u]);
  }

  // Cập nhật số màu đỏ trên biểu tượng chuông thông báo (#bellBadgeCount)
  function updateNotificationBadgeUI() {
    var count = getUnreadAnnouncementsCount();
    var bell = document.getElementById('bellBadgeCount');
    var dockDot = document.getElementById('dockReportDot');

    if (bell) {
      if (count > 0) {
        bell.textContent = count > 99 ? '99+' : String(count);
        bell.style.display = 'inline-flex';
        bell.style.alignItems = 'center';
        bell.style.justifyContent = 'center';
        bell.style.backgroundColor = '#e03131'; // Màu đỏ nổi bật chuẩn MXH
        bell.style.color = '#ffffff';
        bell.style.fontWeight = '800';
        bell.style.fontSize = '11.5px';
        bell.style.padding = '0 6px';
        bell.style.minWidth = '19px';
        bell.style.height = '19px';
        bell.style.borderRadius = '999px';
        bell.style.boxShadow = '0 2px 6px rgba(224, 49, 49, 0.6)';
        bell.style.lineHeight = '1';
        bell.setAttribute('title', 'Bạn có ' + count + ' thông báo mới chưa đọc');
      } else {
        bell.textContent = '0';
        bell.style.display = 'none';
        bell.removeAttribute('title');
      }
    }

    if (dockDot) {
      dockDot.style.display = count > 0 ? 'block' : 'none';
    }

    var notifCountEl = document.getElementById('notifAnnounceBadgeCount');
    if (notifCountEl) {
      var allList = getStoredAnnouncements();
      notifCountEl.textContent = allList.length;
    }
  }

  // Thêm một thông báo mới (chỉ Admin)
  function postNewAnnouncement(announcementData) {
    var curUser = getCurrentUsername();
    var list = getStoredAnnouncements();

    var now = new Date();
    var timeStr = (now.getDate() < 10 ? '0' + now.getDate() : now.getDate()) + '/' +
                  ((now.getMonth() + 1) < 10 ? '0' + (now.getMonth() + 1) : (now.getMonth() + 1)) + '/' +
                  now.getFullYear() + ' ' +
                  (now.getHours() < 10 ? '0' + now.getHours() : now.getHours()) + ':' +
                  (now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes());

    var tagMap = {
      new: '🎉 Mới nhất',
      update: '🚀 Cập nhật hệ thống',
      song: '🎼 Nhạc mẫu mới',
      note: '💌 Lời nhắn Admin',
      event: '🎪 Sự kiện cộng đồng'
    };

    var newPost = {
      id: announcementData.id || Date.now(),
      title: announcementData.title || 'Thông báo hệ thống',
      content: announcementData.content || announcementData.body || '',
      body: announcementData.content || announcementData.body || '',
      tag: announcementData.tag || 'new',
      tagLabel: tagMap[announcementData.tag] || '📢 Thông báo',
      time: announcementData.time || timeStr,
      date: announcementData.date || timeStr.split(' ')[0],
      author: announcementData.author || 'Quản trị viên (Admin)',
      createdAt: announcementData.createdAt || Date.now()
    };

    list.unshift(newPost);
    saveStoredAnnouncements(list);

    // Tự động đánh dấu đã đọc cho chính Admin vừa đăng để Admin không bị hiện số chưa đọc
    var readsMap = getStoredReadsMap();
    var authorU = (announcementData.authorUsername || (curUser === 'admin' || curUser === 'owner' ? curUser : 'admin')).toLowerCase();
    if (authorU && authorU !== 'guest') {
      var adminReads = new Set(readsMap[authorU] || []);
      adminReads.add(String(newPost.id));
      readsMap[authorU] = Array.from(adminReads);
      saveStoredReadsMap(readsMap);
    }

    // Phát tin nhắn qua Bus cho mọi Tab
    broadcastSyncMessage({
      type: 'NEW_ANNOUNCEMENT',
      announcement: newPost
    });

    // Cập nhật giao diện
    updateNotificationBadgeUI();
    if (typeof window.renderOwnerAnnouncements === 'function') {
      window.renderOwnerAnnouncements();
    }
    if (typeof window.renderWpAnnouncementsList === 'function') {
      window.renderWpAnnouncementsList();
    }

    // Đẩy lên Cloud server
    syncAnnouncementsToCloud(list);

    return newPost;
  }

  // Xóa thông báo (chỉ Admin)
  function deleteAnnouncement(id) {
    var list = getStoredAnnouncements();
    list = list.filter(function (item) { return String(item.id) !== String(id); });
    saveStoredAnnouncements(list);

    broadcastSyncMessage({
      type: 'DELETE_ANNOUNCEMENT',
      id: id
    });

    updateNotificationBadgeUI();
    if (typeof window.renderOwnerAnnouncements === 'function') {
      window.renderOwnerAnnouncements();
    }
    if (typeof window.renderWpAnnouncementsList === 'function') {
      window.renderWpAnnouncementsList();
    }

    syncAnnouncementsToCloud(list);
  }

  // ============================================================================
  // ĐỒNG BỘ ÂM THANH SERVER (SERVER AUDIO CONFIGURATION & AUDIO STORAGE)
  // ============================================================================
  var _audioConfigCache = null;
  var _audioPool = {};

  function getServerAudioConfig() {
    if (_audioConfigCache) return _audioConfigCache;
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.SERVER_AUDIO);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          _audioConfigCache = parsed;
          return _audioConfigCache;
        }
      }
    } catch (e) {}
    _audioConfigCache = {};
    return _audioConfigCache;
  }

  function saveServerAudioConfig(cfg) {
    if (cfg) _audioConfigCache = cfg;
    var toSave = _audioConfigCache || {};
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_AUDIO, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[CloudSync] Lỗi lưu cấu hình âm thanh vào localStorage:', e);
    }
    broadcastSyncMessage({
      type: 'AUDIO_CONFIG_UPDATED',
      config: toSave
    });
    syncAudioConfigToCloud(toSave);
  }

  function getServerAudioForNote(instId, noteIdx) {
    var cfg = getServerAudioConfig();
    var instCfg = cfg[instId];
    if (instCfg && instCfg.strings && instCfg.strings[noteIdx]) {
      return instCfg.strings[noteIdx];
    }
    return null;
  }

  function setServerAudioForNote(instId, noteIdx, data) {
    var cfg = getServerAudioConfig();
    if (!cfg[instId]) cfg[instId] = { strings: {} };
    if (!cfg[instId].strings) cfg[instId].strings = {};

    var cur = cfg[instId].strings[noteIdx] || {};
    cfg[instId].strings[noteIdx] = Object.assign(cur, data, { updatedAt: Date.now() });

    var poolKey = instId + '_' + noteIdx;
    if (_audioPool[poolKey]) {
      delete _audioPool[poolKey];
    }
    saveServerAudioConfig();
  }

  function removeServerAudioForNote(instId, noteIdx) {
    var cfg = getServerAudioConfig();
    if (cfg[instId] && cfg[instId].strings && cfg[instId].strings[noteIdx]) {
      delete cfg[instId].strings[noteIdx];
      var poolKey = instId + '_' + noteIdx;
      if (_audioPool[poolKey]) {
        delete _audioPool[poolKey];
      }
      saveServerAudioConfig();
    }
  }

  function clearServerAudioForInstrument(instId) {
    var cfg = getServerAudioConfig();
    if (cfg[instId]) {
      delete cfg[instId];
      saveServerAudioConfig();
    }
    Object.keys(_audioPool).forEach(function (k) {
      if (k.indexOf(instId + '_') === 0) delete _audioPool[k];
    });
  }

  // ============================================================================
  // ÂM THANH MẶC ĐỊNH TRÊN SERVER CHO ĐÀN TRANH (thư mục audio/dantranh/)
  // Tệp string_{i}.mp3 ứng với dây số i+1 (string_0 = dây 1 ... string_15 = dây 16).
  // Chỉ dùng khi Admin CHƯA gán file riêng cho dây đó. Dây nào chưa có file
  // (tải lỗi / 404) sẽ tự động quay về âm tổng hợp như cũ.
  // ============================================================================
  var BUILTIN_AUDIO_DIR = { dantranh: 'audio/dantranh/' };
  var BUILTIN_AUDIO_COUNT = { dantranh: 16 };
  var _builtinAudio = {}; // key -> { audio, ok: true|false|null }

  function preloadBuiltinAudio(instId) {
    var dir = BUILTIN_AUDIO_DIR[instId];
    var count = BUILTIN_AUDIO_COUNT[instId] || 0;
    if (!dir || typeof Audio === 'undefined') return;
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var key = instId + '_' + idx;
        if (_builtinAudio[key]) return;
        var entry = { audio: null, ok: null };
        _builtinAudio[key] = entry;
        try {
          var a = new Audio();
          a.preload = 'auto';
          a.addEventListener('canplaythrough', function () { entry.ok = true; }, { once: true });
          a.addEventListener('loadeddata', function () { entry.ok = true; }, { once: true });
          a.addEventListener('error', function () { entry.ok = false; }, { once: true });
          a.src = dir + 'string_' + idx + '.mp3';
          a.load();
          entry.audio = a;
        } catch (e) {
          entry.ok = false;
        }
      })(i);
    }
  }

  function playBuiltinAudioForNote(instId, noteIdx) {
    if (!BUILTIN_AUDIO_DIR[instId]) return false;
    preloadBuiltinAudio(instId);
    var entry = _builtinAudio[instId + '_' + noteIdx];
    if (!entry || entry.ok !== true || !entry.audio) return false;
    try {
      var masterVol = typeof window.currentMasterVol === 'number' ? window.currentMasterVol : 0.85;
      var instVol = typeof window._activeOwnerInstVolFactor === 'number' ? window._activeOwnerInstVolFactor : 1.0;
      // Dây đang ngân thì dùng bản sao để các lần gảy liên tiếp không cắt ngang nhau
      var a = (entry.audio.paused || entry.audio.ended) ? entry.audio : entry.audio.cloneNode(true);
      a.volume = Math.max(0, Math.min(1.0, masterVol * instVol));
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (err) {
      return false;
    }
  }

  // Nạp sẵn âm thanh đàn tranh ngay khi trang tải
  try { preloadBuiltinAudio('dantranh'); } catch (e) {}

  // Phát file âm thanh tùy chỉnh server cho nốt
  function playServerCustomAudioForNote(instId, noteIdx) {
    var noteCustom = getServerAudioForNote(instId, noteIdx);
    if (!noteCustom || !noteCustom.fileUrl) return playBuiltinAudioForNote(instId, noteIdx);

    try {
      var poolKey = instId + '_' + noteIdx;
      var poolEntry = _audioPool[poolKey];
      if (!poolEntry || poolEntry.url !== noteCustom.fileUrl) {
        var a = new Audio(noteCustom.fileUrl);
        a.preload = 'auto';
        poolEntry = { url: noteCustom.fileUrl, audio: a };
        _audioPool[poolKey] = poolEntry;
      }

      var noteVol = typeof noteCustom.volume === 'number' ? noteCustom.volume / 100 : 1.0;
      var masterVol = typeof window.currentMasterVol === 'number' ? window.currentMasterVol : 0.85;
      var instVol = typeof window._activeOwnerInstVolFactor === 'number' ? window._activeOwnerInstVolFactor : 1.0;

      poolEntry.audio.volume = Math.max(0, Math.min(1.0, noteVol * masterVol * instVol));

      var pitchOffset = typeof noteCustom.pitch === 'number' ? noteCustom.pitch : 0;
      if (pitchOffset !== 0) {
        poolEntry.audio.playbackRate = Math.max(0.25, Math.min(4.0, Math.pow(2, pitchOffset / 12)));
      } else {
        poolEntry.audio.playbackRate = 1.0;
      }

      poolEntry.audio.currentTime = 0;
      var p = poolEntry.audio.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (err) {
      console.warn('[CloudSync] Lỗi phát âm thanh tùy chỉnh server:', err);
      return false;
    }
  }

  // Upload file âm thanh: Tải file lên Cloud Storage (hoặc lưu vào IndexedDB + Cloud Sync)
  function uploadAudioFileForNote(instId, noteIdx, file, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Chưa chọn file âm thanh'));
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl = e.target.result;
        var blobKey = instId + '_' + noteIdx;

        // Lưu vào IndexedDB để cache cục bộ an toàn không bị giới hạn 5MB
        saveBlobToIDB(blobKey, file, { fileName: file.name, instId: instId, noteIdx: noteIdx });

        // Cập nhật cấu hình âm thanh
        setServerAudioForNote(instId, noteIdx, {
          fileName: file.name,
          fileUrl: dataUrl,
          fileSize: file.size,
          mimeType: file.type || 'audio/mpeg'
        });

        // Đẩy lên Cloud Storage nếu có cấu hình
        tryUploadToCloudStorage(instId, noteIdx, file).then(function (cloudUrl) {
          if (cloudUrl) {
            setServerAudioForNote(instId, noteIdx, {
              fileName: file.name,
              fileUrl: cloudUrl
            });
          }
        });

        resolve({
          fileName: file.name,
          fileUrl: dataUrl
        });
      };

      reader.onerror = function (err) {
        reject(err);
      };

      reader.readAsDataURL(file);
    });
  }

  // Upload lên Cloud Storage (Supabase Storage / Firebase Storage / Cloud Relay)
  function tryUploadToCloudStorage(instId, noteIdx, file) {
    return new Promise(function (resolve) {
      var cfg = getCloudConfig();

      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        try {
          var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          var path = instId + '/note_' + noteIdx + '_' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          client.storage.from(cfg.supabaseBucket || 'dan_tranh_audio').upload(path, file, {
            cacheControl: '3600',
            upsert: true
          }).then(function (res) {
            if (res.data && res.data.path) {
              var publicRes = client.storage.from(cfg.supabaseBucket || 'dan_tranh_audio').getPublicUrl(path);
              if (publicRes.data && publicRes.data.publicUrl) {
                resolve(publicRes.data.publicUrl);
                return;
              }
            }
            resolve(null);
          }).catch(function () {
            resolve(null);
          });
          return;
        } catch (e) {
          resolve(null);
          return;
        }
      }

      if (window.firebase && window.firebase.storage && cfg.firebaseStorageBucket) {
        try {
          var storageRef = window.firebase.storage().ref();
          var audioRef = storageRef.child('audio/' + instId + '/note_' + noteIdx + '_' + file.name);
          audioRef.put(file).then(function (snapshot) {
            return snapshot.ref.getDownloadURL();
          }).then(function (downloadURL) {
            resolve(downloadURL);
          }).catch(function () {
            resolve(null);
          });
          return;
        } catch (e) {
          resolve(null);
          return;
        }
      }

      resolve(null);
    });
  }

  // ============================================================================
  // ĐỒNG BỘ THỜI GIAN THỰC (REALTIME & PERIODIC HEARTBEAT POLLING TICKER)
  // ============================================================================

  // Gửi tin nhắn qua BroadcastChannel (Đồng bộ tức thì đa tab trên cùng máy)
  function broadcastSyncMessage(msg) {
    if (!msg) return;
    try {
      if (syncBus) {
        syncBus.postMessage(msg);
      }
    } catch (e) {}
  }

  // Lắng nghe tin nhắn từ BroadcastChannel
  if (syncBus) {
    syncBus.onmessage = function (e) {
      var data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'NEW_ANNOUNCEMENT' || data.type === 'DELETE_ANNOUNCEMENT') {
        updateNotificationBadgeUI();
        if (typeof window.renderOwnerAnnouncements === 'function') window.renderOwnerAnnouncements();
        if (typeof window.renderWpAnnouncementsList === 'function') window.renderWpAnnouncementsList();
      } else if (data.type === 'READS_UPDATED') {
        if (data.username === getCurrentUsername()) {
          updateNotificationBadgeUI();
        }
      } else if (data.type === 'AUDIO_CONFIG_UPDATED') {
        _audioConfigCache = data.config;
        _audioPool = {};
        if (typeof window.renderOwnerInstStringsAudioTable === 'function') {
          var targetId = window.currentOwnerSelectedInstId || 'dantranh';
          window.renderOwnerInstStringsAudioTable(targetId);
        }
      } else if (data.type === 'FEEDBACK_REPORTS_UPDATED' || data.type === 'FEEDBACK_REPLY_SYNC') {
        if (typeof window.syncOwnerHeaderFeedbackBadge === 'function') window.syncOwnerHeaderFeedbackBadge();
        if (typeof window.renderOwnerFeedbackInbox === 'function') window.renderOwnerFeedbackInbox();
        if (typeof window.renderUserReplies === 'function') window.renderUserReplies();
        if (typeof window.renderUserSentReportsHistory === 'function') window.renderUserSentReportsHistory();
        if (typeof window.updateReportBadges === 'function') window.updateReportBadges();
      } else if (data.type === 'FORUM_POSTS_UPDATED') {
        if (typeof window.renderRedditFeed === 'function') window.renderRedditFeed();
        if (typeof window.renderRedditRecentPosts === 'function') window.renderRedditRecentPosts();
        if (typeof window.renderRedditHistoryTab === 'function') window.renderRedditHistoryTab();
        if (typeof window.updateForumRealStats === 'function') window.updateForumRealStats();
      } else if (data.type === 'USERS_UPDATED') {
        if (typeof window.renderWpUsersList === 'function') window.renderWpUsersList();
      } else if (data.type === 'HDNC_VIDEOS_UPDATED') {
        if (window.DanTranhAdminVideos && typeof window.DanTranhAdminVideos.renderAdminVideoTable === 'function') {
          window.DanTranhAdminVideos.renderAdminVideoTable();
        }
        if (window.DanTranhAdminVideos && typeof window.DanTranhAdminVideos.renderAdminVideoTable === 'function') {
          window.DanTranhAdminVideos.renderAdminVideoTable();
        }
        if (window.DanTranhVideoHdnc && typeof window.DanTranhVideoHdnc.renderGrid === 'function') {
          window.DanTranhVideoHdnc.renderGrid();
        }
      }
    };
  }

  // Lắng nghe sự kiện storage (hỗ trợ các trình duyệt không có BroadcastChannel)
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEYS.ANNOUNCEMENTS || e.key === STORAGE_KEYS.ANNOUNCEMENT_READS) {
      updateNotificationBadgeUI();
      if (typeof window.renderOwnerAnnouncements === 'function') window.renderOwnerAnnouncements();
      if (typeof window.renderWpAnnouncementsList === 'function') window.renderWpAnnouncementsList();
    } else if (e.key === STORAGE_KEYS.SERVER_AUDIO) {
      _audioConfigCache = null;
      _audioPool = {};
      if (typeof window.renderOwnerInstStringsAudioTable === 'function') {
        var targetId = window.currentOwnerSelectedInstId || 'dantranh';
        window.renderOwnerInstStringsAudioTable(targetId);
      }
    } else if (e.key === STORAGE_KEYS.REPORTS) {
      if (typeof window.syncOwnerHeaderFeedbackBadge === 'function') window.syncOwnerHeaderFeedbackBadge();
      if (typeof window.renderOwnerFeedbackInbox === 'function') window.renderOwnerFeedbackInbox();
      if (typeof window.renderUserReplies === 'function') window.renderUserReplies();
      if (typeof window.renderUserSentReportsHistory === 'function') window.renderUserSentReportsHistory();
      if (typeof window.updateReportBadges === 'function') window.updateReportBadges();
    } else if (e.key === STORAGE_KEYS.FORUM_POSTS || e.key === STORAGE_KEYS.FORUM_POSTS_ALT) {
      if (typeof window.renderRedditFeed === 'function') window.renderRedditFeed();
      if (typeof window.renderRedditRecentPosts === 'function') window.renderRedditRecentPosts();
      if (typeof window.renderRedditHistoryTab === 'function') window.renderRedditHistoryTab();
      if (typeof window.updateForumRealStats === 'function') window.updateForumRealStats();
    } else if (e.key === STORAGE_KEYS.USERS) {
      if (typeof window.renderWpUsersList === 'function') window.renderWpUsersList();
    }
  });

  // ============================================================================
  // CƠ CHẾ TICKER ĐỒNG BỘ ĐỊNH KỲ VỚI SERVER / CLOUD (PERIODIC SYNC TICKER)
  // ============================================================================
  var syncIntervalId = null;
  var isSyncing = false;

  function startPeriodicSyncTicker(intervalMs) {
    if (syncIntervalId) clearInterval(syncIntervalId);
    var interval = intervalMs || 3500; // Mặc định kiểm tra mỗi 3.5 giây

    syncIntervalId = setInterval(function () {
      triggerCloudHeartbeatSync();
    }, interval);
  }

  function triggerCloudHeartbeatSync() {
    if (isSyncing) return Promise.resolve(false);
    isSyncing = true;

    return fetchCloudUpdates().then(function (hasChanges) {
      isSyncing = false;
      return hasChanges;
    }).catch(function () {
      isSyncing = false;
      return false;
    });
  }

  // Trích xuất JSON hợp lệ từ chuỗi phản hồi (loại bỏ mã HTML thừa nếu có từ Cloud Relay)
  function extractCleanJson(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch (e) {}

    var first = trimmed.indexOf('{');
    if (first === -1) return null;

    var depth = 0;
    var inString = false;
    var escape = false;
    for (var i = first; i < trimmed.length; i++) {
      var c = trimmed.charAt(i);
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c === '{') {
          depth++;
        } else if (c === '}') {
          depth--;
          if (depth === 0) {
            var candidate = trimmed.substring(first, i + 1);
            try {
              return JSON.parse(candidate);
            } catch (err) {
              return null;
            }
          }
        }
      }
    }
    return null;
  }

  // ============================================================================
  // MULTI-BIN CHUNKED CLOUD STORAGE (VƯỢT GIỚI HẠN 32KB CỦA EXTENDSCLASS)
  // ============================================================================
  function getChildBinUrl(binId) {
    return EXTENDS_BIN_CREATE_URL + '/' + encodeURIComponent(String(binId || '').trim());
  }

  function createExtendsChildBin(payloadObj, attempt) {
    var tryNum = attempt || 0;
    var bodyStr = '';
    try {
      bodyStr = JSON.stringify(payloadObj);
    } catch (e) {
      return Promise.resolve(null);
    }

    return fetch(EXTENDS_BIN_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (raw) {
        var parsed = extractCleanJson(raw);
        if (parsed && parsed.id) {
          _childBinCache[parsed.id] = payloadObj;
          if (!payloadObj.isChunk && bodyStr.length < 18000) {
            try { localStorage.setItem('dt_extbin_' + parsed.id, bodyStr); } catch (eLs) {}
          }
          return String(parsed.id);
        }
        return null;
      })
      .catch(function (err) {
        if (tryNum < 2) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(createExtendsChildBin(payloadObj, tryNum + 1));
            }, 350 * (tryNum + 1));
          });
        }
        console.warn('[CloudSync] createExtendsChildBin failed:', err && err.message ? err.message : err);
        return null;
      });
  }

  function fetchExtendsChildBin(binId, attempt) {
    var id = String(binId || '').trim();
    if (!id) return Promise.resolve(null);
    if (_childBinCache[id]) return Promise.resolve(_childBinCache[id]);

    try {
      var cachedRaw = localStorage.getItem('dt_extbin_' + id);
      if (cachedRaw) {
        var cachedParsed = JSON.parse(cachedRaw);
        if (cachedParsed) {
          _childBinCache[id] = cachedParsed;
          return Promise.resolve(cachedParsed);
        }
      }
    } catch (eLs) {}

    var tryNum = attempt || 0;
    var url = getChildBinUrl(id) + '?_t=' + Date.now();
    return fetch(url, { method: 'GET', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (raw) {
        var parsed = extractCleanJson(raw);
        if (parsed && parsed.data && typeof parsed.data === 'string') {
          var inner = extractCleanJson(parsed.data);
          if (inner) parsed = inner;
        }
        if (parsed) {
          _childBinCache[id] = parsed;
          if (!parsed.isChunk) {
            try {
              var serialized = JSON.stringify(parsed);
              if (serialized.length < 18000) localStorage.setItem('dt_extbin_' + id, serialized);
            } catch (eCache) {}
          }
          return parsed;
        }
        return null;
      })
      .catch(function (err) {
        if (tryNum < 2) {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(fetchExtendsChildBin(id, tryNum + 1));
            }, 350 * (tryNum + 1));
          });
        }
        console.warn('[CloudSync] fetchExtendsChildBin failed:', id, err && err.message ? err.message : err);
        return null;
      });
  }

  function uploadStringToCloudChunks(strData, onProgress) {
    if (!strData || typeof strData !== 'string') return Promise.resolve(null);
    if (strData.indexOf('extchunks://') === 0) return Promise.resolve(strData);

    var chunks = [];
    for (var i = 0; i < strData.length; i += EXTENDS_CHUNK_SIZE) {
      chunks.push(strData.substring(i, i + EXTENDS_CHUNK_SIZE));
    }
    var isSingleSmall = (chunks.length === 1 && strData.length < 18000);
    var ids = new Array(chunks.length);
    var completed = 0;
    var failed = false;

    function runBatch(startIdx) {
      if (failed || startIdx >= chunks.length) {
        if (failed) return Promise.resolve(null);
        return Promise.resolve('extchunks://' + ids.join(','));
      }
      var endIdx = Math.min(chunks.length, startIdx + 3);
      var promises = [];
      for (var j = startIdx; j < endIdx; j++) {
        (function (idx) {
          promises.push(
            createExtendsChildBin({ c: chunks[idx], isChunk: !isSingleSmall }).then(function (id) {
              if (!id) {
                failed = true;
              } else {
                ids[idx] = id;
                completed++;
                if (typeof onProgress === 'function') {
                  onProgress(Math.round((completed / chunks.length) * 100));
                }
              }
            })
          );
        })(j);
      }
      return Promise.all(promises).then(function () {
        return runBatch(endIdx);
      });
    }

    return runBatch(0);
  }

  function downloadStringFromCloudChunks(refStr, onProgress) {
    if (!refStr || typeof refStr !== 'string') return Promise.resolve(null);
    if (refStr.indexOf('extchunks://') !== 0) return Promise.resolve(refStr);

    var binIds = refStr.slice(12).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (binIds.length === 0) return Promise.resolve(null);

    var parts = new Array(binIds.length);
    var completed = 0;
    var failed = false;

    function runBatch(startIdx) {
      if (failed || startIdx >= binIds.length) {
        if (failed) return Promise.resolve(null);
        return Promise.resolve(parts.join(''));
      }
      var endIdx = Math.min(binIds.length, startIdx + 4);
      var promises = [];
      for (var j = startIdx; j < endIdx; j++) {
        (function (idx) {
          promises.push(
            fetchExtendsChildBin(binIds[idx]).then(function (obj) {
              if (!obj || typeof obj.c !== 'string') {
                failed = true;
              } else {
                parts[idx] = obj.c;
                completed++;
                if (typeof onProgress === 'function') {
                  onProgress(Math.round((completed / binIds.length) * 100));
                }
              }
            })
          );
        })(j);
      }
      return Promise.all(promises).then(function () {
        return runBatch(endIdx);
      });
    }

    return runBatch(0);
  }

  function uploadBlobToCloudChunks(blob, onProgress) {
    return new Promise(function (resolve) {
      if (!blob) {
        resolve(null);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl = e && e.target ? e.target.result : null;
        if (!dataUrl || typeof dataUrl !== 'string') {
          resolve(null);
          return;
        }
        uploadStringToCloudChunks(dataUrl, onProgress).then(function (ref) {
          if (!ref) {
            resolve(null);
            return;
          }
          resolve({
            ref: ref,
            mimeType: blob.type || 'video/mp4'
          });
        });
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    try {
      var commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return null;
      var header = dataUrl.substring(0, commaIdx);
      var b64 = dataUrl.substring(commaIdx + 1);
      var mimeMatch = header.match(/data:([^;]+);/i);
      var mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : 'video/mp4';
      var binStr = atob(b64);
      var len = binStr.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    } catch (e) {
      return null;
    }
  }

  function downloadBlobFromCloudChunks(refStr, onProgress) {
    return downloadStringFromCloudChunks(refStr, onProgress).then(function (dataUrl) {
      if (!dataUrl) return null;
      return dataUrlToBlob(dataUrl);
    });
  }

  // Kéo dữ liệu mới nhất từ Cloud (Hòm thư Admin, Thông báo, Diễn đàn, Users, Âm thanh)
  function fetchCloudUpdates() {
    return new Promise(function (resolve) {
      var cfg = getCloudConfig();

      // 1. Firebase Realtime Database
      if (cfg.firebaseDbUrl && window.firebase && window.firebase.database) {
        try {
          var db = window.firebase.database();
          db.ref('dan_tranh_cloud').once('value').then(function (snapshot) {
            var data = snapshot.val();
            if (data) {
              var changed = applyCloudPayload(data);
              resolve(changed);
            } else {
              resolve(false);
            }
          }).catch(function () {
            resolve(false);
          });
          return;
        } catch (e) {
          resolve(false);
          return;
        }
      }

      // 2. Supabase
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        try {
          var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          client.from('dan_tranh_cloud').select('*').limit(1).then(function (res) {
            if (res.data && res.data[0]) {
              var changed = applyCloudPayload(res.data[0]);
              resolve(changed);
            } else {
              resolve(false);
            }
          }).catch(function () {
            resolve(false);
          });
          return;
        } catch (e) {
          resolve(false);
          return;
        }
      }

      // 3. Cloud Relay Endpoint tự động (Mặc định ExtendsClass JSON Storage, bỏ qua cache 2h)
      var endpoint = cfg.relayEndpoint || DEFAULT_RELAY_ENDPOINT;
      if (endpoint) {
        var sep = endpoint.indexOf('?') === -1 ? '?' : '&';
        var fetchUrl = endpoint + sep + '_t=' + Date.now();
        fetch(fetchUrl, { method: 'GET', cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .then(function (rawText) {
            var payload = extractCleanJson(rawText);
            if (!payload) {
              _cloudHealth.lastError = 'Dữ liệu máy chủ Cloud Relay không hợp lệ';
              _cloudHealth.lastErrorAt = Date.now();
              resolve(false);
              return;
            }
            if (payload.data && typeof payload.data === 'string') {
              var inner = extractCleanJson(payload.data);
              if (inner) payload = inner;
            }
            _cloudHealth.lastOkAt = Date.now();
            _cloudHealth.lastError = null;
            var changed = applyCloudPayload(payload);
            resolve(changed);
          })
          .catch(function (err) {
            _cloudHealth.lastError = (err && err.message) ? err.message : 'Lỗi kết nối Cloud Relay';
            _cloudHealth.lastErrorAt = Date.now();
            resolve(false);
          });
        return;
      }

      resolve(false);
    });
  }

  // Áp dụng dữ liệu từ Cloud vào bộ nhớ và LocalStorage
  function applyCloudPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    var changed = false;

    // A. Cập nhật thông báo hệ thống (Announcements)
    if (Array.isArray(payload.announcements)) {
      var localAnn = getStoredAnnouncements();
      var annMap = {};
      localAnn.forEach(function (item) { if (item && item.id) annMap[String(item.id)] = item; });
      var annChanged = false;

      payload.announcements.forEach(function (cloudItem) {
        if (!cloudItem || !cloudItem.id) return;
        var k = String(cloudItem.id);
        if (!annMap[k]) {
          annMap[k] = cloudItem;
          annChanged = true;
        }
      });

      if (annChanged || localAnn.length !== Object.keys(annMap).length) {
        var mergedAnn = Object.values(annMap).sort(function (a, b) {
          return (b.createdAt || b.id || 0) - (a.createdAt || a.id || 0);
        });
        saveStoredAnnouncements(mergedAnn);
        changed = true;
        updateNotificationBadgeUI();
        if (typeof window.renderOwnerAnnouncements === 'function') window.renderOwnerAnnouncements();
        if (typeof window.renderWpAnnouncementsList === 'function') window.renderWpAnnouncementsList();
      }
    }

    // B. Cập nhật trạng thái đọc của từng người dùng (Per-user read state)
    if (payload.announcement_reads && typeof payload.announcement_reads === 'object') {
      var localReads = getStoredReadsMap();
      var readsChanged = false;
      var curUser = getCurrentUsername();

      Object.keys(payload.announcement_reads).forEach(function (u) {
        var cloudArr = Array.isArray(payload.announcement_reads[u]) ? payload.announcement_reads[u] : [];
        var localArr = Array.isArray(localReads[u]) ? localReads[u] : [];
        var mergedSet = new Set(localArr.concat(cloudArr).map(function (id) { return String(id); }));
        if (mergedSet.size !== localArr.length) {
          localReads[u] = Array.from(mergedSet);
          readsChanged = true;
        }
      });

      if (readsChanged) {
        saveStoredReadsMap(localReads);
        changed = true;
        updateNotificationBadgeUI();
      }
    }

    // C. Cập nhật hòm thư Admin (Reports / Feedback & Phản hồi)
    if (Array.isArray(payload.reports)) {
      var localRepRaw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      var localReports = [];
      try { localReports = JSON.parse(localRepRaw) || []; } catch (e) {}
      var repMap = {};
      localReports.forEach(function (r) { if (r && r.id) repMap[String(r.id)] = r; });
      var repChanged = false;

      payload.reports.forEach(function (cloudR) {
        if (!cloudR || !cloudR.id) return;
        var k = String(cloudR.id);
        if (!repMap[k]) {
          repMap[k] = cloudR;
          repChanged = true;
        } else {
          var curR = repMap[k];
          // Đồng bộ nội dung phản hồi của Admin nếu Cloud có phản hồi mới hơn
          if (cloudR.adminReply && cloudR.adminReply !== curR.adminReply) {
            curR.adminReply = cloudR.adminReply;
            curR.replyTime = cloudR.replyTime || curR.replyTime;
            curR.unreadUserReply = (cloudR.unreadUserReply !== undefined) ? cloudR.unreadUserReply : true;
            repChanged = true;
          }
          if (cloudR.unread !== curR.unread) {
            curR.unread = cloudR.unread;
            repChanged = true;
          }
        }
      });

      if (repChanged || localReports.length !== Object.keys(repMap).length) {
        var mergedReports = Object.values(repMap).sort(function (a, b) {
          return String(b.time || '').localeCompare(String(a.time || ''));
        });
        localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(mergedReports));
        changed = true;
        if (typeof window.updateReportBadges === 'function') window.updateReportBadges();
        if (typeof window.syncOwnerHeaderFeedbackBadge === 'function') window.syncOwnerHeaderFeedbackBadge();
        if (typeof window.renderOwnerFeedbackInbox === 'function') window.renderOwnerFeedbackInbox();
        if (typeof window.renderUserReplies === 'function') window.renderUserReplies();
        if (typeof window.renderUserSentReportsHistory === 'function') window.renderUserSentReportsHistory();
      }
    }

    // D. Cập nhật Diễn đàn (Forum Posts, Comments, Upvotes, Deleted IDs & Banned Users)
    var forumDeletedIds = [];
    try { forumDeletedIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORUM_DELETED) || '[]') || []; } catch (e) {}
    if (Array.isArray(payload.forum_deleted_ids) && payload.forum_deleted_ids.length) {
      var delMapChanged = false;
      payload.forum_deleted_ids.forEach(function (did) {
        if (did && forumDeletedIds.indexOf(did) === -1) {
          forumDeletedIds.push(did);
          delMapChanged = true;
        }
      });
      if (delMapChanged) {
        try { localStorage.setItem(STORAGE_KEYS.FORUM_DELETED, JSON.stringify(forumDeletedIds)); } catch (e) {}
        changed = true;
      }
    }
    var forumDelSet = {};
    forumDeletedIds.forEach(function (did) { if (did) forumDelSet[String(did)] = true; });

    if (Array.isArray(payload.forum_banned_users)) {
      var localBanned = [];
      try { localBanned = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORUM_BANNED) || '[]') || []; } catch (e) {}
      var bannedNormSet = {};
      localBanned.forEach(function (b) { if (b) bannedNormSet[String(b).trim().toLowerCase()] = true; });
      var banChanged = false;
      payload.forum_banned_users.forEach(function (cb) {
        var norm = String(cb || '').trim().toLowerCase();
        if (norm && !bannedNormSet[norm]) {
          localBanned.push(norm);
          bannedNormSet[norm] = true;
          banChanged = true;
        }
      });
      if (banChanged) {
        try { localStorage.setItem(STORAGE_KEYS.FORUM_BANNED, JSON.stringify(localBanned)); } catch (e) {}
        changed = true;
      }
    }

    if (Array.isArray(payload.forum_posts)) {
      var localPosts = [];
      var localPostsRaw = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS) || localStorage.getItem(STORAGE_KEYS.FORUM_POSTS_ALT);
      try { localPosts = JSON.parse(localPostsRaw) || []; } catch (e) {}
      if (!Array.isArray(localPosts)) localPosts = [];

      var postMap = {};
      localPosts.forEach(function (p) {
        if (p && p.id && !forumDelSet[String(p.id)]) postMap[String(p.id)] = p;
      });
      var postChanged = (localPosts.length !== Object.keys(postMap).length);
      var mediaRefsToResolve = [];

      payload.forum_posts.forEach(function (cloudP) {
        if (!cloudP || !cloudP.id || forumDelSet[String(cloudP.id)]) return;
        var k = String(cloudP.id);
        if (!postMap[k]) {
          var cloned = Object.assign({}, cloudP);
          if (cloned.attachment) cloned.attachment = Object.assign({}, cloned.attachment);
          postMap[k] = cloned;
          postChanged = true;
        } else {
          var curP = postMap[k];
          var cloudCmts = Array.isArray(cloudP.comments) ? cloudP.comments : [];
          var curCmts = Array.isArray(curP.comments) ? curP.comments : [];
          if (cloudCmts.length > 0) {
            var cmtMap = {};
            curCmts.forEach(function (c) { if (c && c.id) cmtMap[String(c.id)] = c; });
            var cAdded = false;
            cloudCmts.forEach(function (cc) {
              if (cc && cc.id && !cmtMap[String(cc.id)]) {
                curCmts.push(cc);
                cmtMap[String(cc.id)] = cc;
                cAdded = true;
              }
            });
            if (cAdded) {
              curP.comments = curCmts;
              postChanged = true;
            }
          }
          if (cloudP.upvotes !== undefined && cloudP.upvotes > (curP.upvotes || 0)) {
            curP.upvotes = cloudP.upvotes;
            postChanged = true;
          }
          if (!curP.image && cloudP.image) {
            curP.image = cloudP.image;
            postChanged = true;
          }
          if (!curP.attachment && cloudP.attachment) {
            curP.attachment = Object.assign({}, cloudP.attachment);
            postChanged = true;
          }
        }

        var targetP = postMap[k];
        if (targetP.image && String(targetP.image).indexOf('extchunks://') === 0) {
          mediaRefsToResolve.push({ postId: k, field: 'image', ref: targetP.image });
        }
        if (targetP.attachment && targetP.attachment.dataUrl && String(targetP.attachment.dataUrl).indexOf('extchunks://') === 0) {
          mediaRefsToResolve.push({ postId: k, field: 'attachment', ref: targetP.attachment.dataUrl });
        }
      });

      if (postChanged) {
        var mergedPosts = Object.values(postMap).sort(function (a, b) {
          return (b.timestamp || 0) - (a.timestamp || 0);
        });
        try {
          localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(mergedPosts));
          localStorage.setItem(STORAGE_KEYS.FORUM_POSTS_ALT, JSON.stringify(mergedPosts));
        } catch (e) {}
        changed = true;
        if (typeof window.renderRedditFeed === 'function') window.renderRedditFeed();
        if (typeof window.renderRedditRecentPosts === 'function') window.renderRedditRecentPosts();
        if (typeof window.renderRedditHistoryTab === 'function') window.renderRedditHistoryTab();
        if (typeof window.updateForumRealStats === 'function') window.updateForumRealStats();
      }

      if (mediaRefsToResolve.length > 0) {
        mediaRefsToResolve.forEach(function (job) {
          var lockKey = 'post_' + job.postId + '_' + job.field + '_' + job.ref;
          if (_resolvingMediaRefs[lockKey]) return;
          _resolvingMediaRefs[lockKey] = true;
          downloadStringFromCloudChunks(job.ref).then(function (resolvedData) {
            delete _resolvingMediaRefs[lockKey];
            if (!resolvedData) return;
            try {
              var curRaw = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS) || localStorage.getItem(STORAGE_KEYS.FORUM_POSTS_ALT);
              var arr = JSON.parse(curRaw || '[]') || [];
              var updatedAny = false;
              arr.forEach(function (p) {
                if (p && String(p.id) === job.postId) {
                  if (job.field === 'image') {
                    p.imageChunkRef = job.ref;
                    p.image = resolvedData;
                    updatedAny = true;
                  } else if (job.field === 'attachment' && p.attachment) {
                    p.attachment.dataChunkRef = job.ref;
                    p.attachment.dataUrl = resolvedData;
                    updatedAny = true;
                  }
                }
              });
              if (updatedAny) {
                localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(arr));
                localStorage.setItem(STORAGE_KEYS.FORUM_POSTS_ALT, JSON.stringify(arr));
                if (typeof window.renderRedditFeed === 'function') window.renderRedditFeed();
              }
            } catch (eHydrate) {}
          });
        });
      }
    }

    // E. Cập nhật danh sách người dùng đăng ký (Registered Users)
    if (Array.isArray(payload.users)) {
      var localUsersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
      var localUsers = [];
      try { localUsers = JSON.parse(localUsersRaw) || []; } catch (e) {}
      var userMap = {};
      localUsers.forEach(function (u) { if (u && u.username) userMap[u.username.toLowerCase()] = u; });
      var userChanged = false;

      payload.users.forEach(function (cloudU) {
        if (!cloudU || !cloudU.username) return;
        var k = cloudU.username.toLowerCase();
        if (!userMap[k]) {
          userMap[k] = cloudU;
          userChanged = true;
        }
      });

      if (userChanged || localUsers.length !== Object.keys(userMap).length) {
        var mergedUsers = Object.values(userMap);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mergedUsers));
        changed = true;
        if (typeof window.renderWpUsersList === 'function') window.renderWpUsersList();
      }
    }

    // F. Cập nhật cấu hình âm thanh Server
    if (payload.server_audio && typeof payload.server_audio === 'object') {
      var localAudio = getServerAudioConfig();
      if (JSON.stringify(localAudio) !== JSON.stringify(payload.server_audio)) {
        _audioConfigCache = payload.server_audio;
        _audioPool = {};
        try {
          localStorage.setItem(STORAGE_KEYS.SERVER_AUDIO, JSON.stringify(payload.server_audio));
        } catch (e) {}
        changed = true;
      }
    }

    // G. Cập nhật Video Hướng Dẫn Nhạc Cụ (HDNC Videos & Deleted IDs)
    var hdncDeletedIds = [];
    try { hdncDeletedIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_DELETED) || '[]') || []; } catch (e) {}
    if (Array.isArray(payload.hdnc_deleted_ids) && payload.hdnc_deleted_ids.length) {
      var hdncDelChanged = false;
      payload.hdnc_deleted_ids.forEach(function (did) {
        if (did && hdncDeletedIds.indexOf(did) === -1) {
          hdncDeletedIds.push(did);
          hdncDelChanged = true;
        }
      });
      if (hdncDelChanged) {
        try { localStorage.setItem(STORAGE_KEYS.HDNC_DELETED, JSON.stringify(hdncDeletedIds)); } catch (e) {}
        changed = true;
      }
    }
    var hdncDelSet = {};
    hdncDeletedIds.forEach(function (did) { if (did) hdncDelSet[String(did)] = true; });

    if (Array.isArray(payload.hdnc_videos)) {
      var rawLocalVideos = [];
      try { rawLocalVideos = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_VIDEOS) || '[]') || []; } catch (e) {}
      if (!Array.isArray(rawLocalVideos)) rawLocalVideos = [];

      var localMap = {};
      rawLocalVideos.forEach(function (v) {
        if (v && v.id && !v.isPreset && !hdncDelSet[String(v.id)]) {
          localMap[v.id] = v;
        }
      });

      var mergedVidMap = {};
      var thumbRefsToResolve = [];

      payload.hdnc_videos.forEach(function (cloudV) {
        if (!cloudV || !cloudV.id || cloudV.isPreset || hdncDelSet[String(cloudV.id)]) return;
        var prev = localMap[cloudV.id];
        var nextItem = Object.assign({}, cloudV, { isPreset: false, cloudSynced: true });
        if (prev && prev.thumbnailUrl && !nextItem.thumbnailUrl) {
          nextItem.thumbnailUrl = prev.thumbnailUrl;
        }
        mergedVidMap[nextItem.id] = nextItem;
        if (!nextItem.thumbnailUrl && nextItem.thumbnailChunkRef && String(nextItem.thumbnailChunkRef).indexOf('extchunks://') === 0) {
          thumbRefsToResolve.push({ id: nextItem.id, ref: nextItem.thumbnailChunkRef });
        }
      });

      // Giữ lại các video mới tải cục bộ chưa kịp đẩy lên Cloud (chưa có cờ cloudSynced)
      Object.keys(localMap).forEach(function (lid) {
        if (!mergedVidMap[lid] && !localMap[lid].cloudSynced) {
          mergedVidMap[lid] = localMap[lid];
        }
      });

      var mergedVids = Object.values(mergedVidMap);
      var cleanLocalVids = Object.values(localMap);
      var needsSave = (JSON.stringify(cleanLocalVids) !== JSON.stringify(mergedVids)) || (rawLocalVideos.length !== cleanLocalVids.length);

      if (needsSave) {
        try {
          localStorage.setItem(STORAGE_KEYS.HDNC_VIDEOS, JSON.stringify(mergedVids));
        } catch (e) {}
        changed = true;
        if (window.DanTranhAdminVideos && typeof window.DanTranhAdminVideos.renderAdminVideoTable === 'function') {
          window.DanTranhAdminVideos.renderAdminVideoTable();
        }
        if (window.DanTranhVideoHdnc && typeof window.DanTranhVideoHdnc.renderGrid === 'function') {
          window.DanTranhVideoHdnc.renderGrid();
        }
      }

      if (thumbRefsToResolve.length > 0) {
        thumbRefsToResolve.forEach(function (job) {
          var lockKey = 'vthumb_' + job.id + '_' + job.ref;
          if (_resolvingMediaRefs[lockKey]) return;
          _resolvingMediaRefs[lockKey] = true;
          downloadStringFromCloudChunks(job.ref).then(function (dataUrl) {
            delete _resolvingMediaRefs[lockKey];
            if (!dataUrl) return;
            try {
              var arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_VIDEOS) || '[]') || [];
              var updatedAny = false;
              arr.forEach(function (v) {
                if (v && v.id === job.id && !v.thumbnailUrl) {
                  v.thumbnailUrl = dataUrl;
                  updatedAny = true;
                }
              });
              if (updatedAny) {
                localStorage.setItem(STORAGE_KEYS.HDNC_VIDEOS, JSON.stringify(arr));
                if (window.DanTranhAdminVideos && typeof window.DanTranhAdminVideos.renderAdminVideoTable === 'function') {
                  window.DanTranhAdminVideos.renderAdminVideoTable();
                }
                if (window.DanTranhVideoHdnc && typeof window.DanTranhVideoHdnc.renderGrid === 'function') {
                  window.DanTranhVideoHdnc.renderGrid();
                }
              }
            } catch (eThumb) {}
          });
        });
      }
    }

    return changed;
  }

  // ============================================================================
  // CÁC HÀM ĐẨY DỮ LIỆU LÊN SERVER CLOUD TẬP TRUNG
  // ============================================================================

  // Đẩy thông báo lên Cloud
  function syncAnnouncementsToCloud(announcementsList) {
    return pushPartialToCloud({ announcements: announcementsList, updatedAt: Date.now() });
  }

  // Đẩy trạng thái đọc lên Cloud
  function syncReadsToCloud(username, readList) {
    var readsMap = getStoredReadsMap();
    readsMap[username] = readList;
    return pushPartialToCloud({ announcement_reads: readsMap, updatedAt: Date.now() });
  }

  // Đẩy hòm thư Admin (reports) lên Cloud
  function syncReportsToCloud(reportsList) {
    return pushPartialToCloud({ reports: reportsList, updatedAt: Date.now() });
  }

  // Đẩy danh sách video hướng dẫn lên Cloud (tách thumbnail lớn sang child bin để không vượt 32KB)
  function syncHdncVideosToCloud(videosList) {
    if (!Array.isArray(videosList)) return Promise.resolve({ ok: false, error: 'Invalid list' });

    var deletedIds = [];
    try { deletedIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_DELETED) || '[]') || []; } catch (e) {}
    var delSet = {};
    deletedIds.forEach(function (d) { if (d) delSet[String(d)] = true; });

    var activeVideos = videosList.filter(function (v) {
      return v && v.id && !v.isPreset && !delSet[String(v.id)];
    });

    var chunkTasks = activeVideos.map(function (v) {
      var clone = Object.assign({}, v, { isPreset: false, cloudSynced: true });
      var thumb = clone.thumbnailUrl || '';
      var isHttpUrl = thumb.indexOf('http://') === 0 || thumb.indexOf('https://') === 0;

      if (thumb && !isHttpUrl && thumb.length > 3500) {
        if (clone.thumbnailChunkRef && String(clone.thumbnailChunkRef).indexOf('extchunks://') === 0) {
          clone.thumbnailUrl = '';
          return Promise.resolve(clone);
        }
        return uploadStringToCloudChunks(thumb).then(function (ref) {
          if (ref) {
            clone.thumbnailChunkRef = ref;
            v.thumbnailChunkRef = ref;
          }
          clone.thumbnailUrl = '';
          return clone;
        });
      }
      return Promise.resolve(clone);
    });

    return Promise.all(chunkTasks).then(function (cloudClones) {
      return pushPartialToCloud({
        hdnc_videos: cloudClones,
        hdnc_deleted_ids: deletedIds.slice(-100),
        updatedAt: Date.now()
      }).then(function (res) {
        if (res && res.ok) {
          try {
            var curLocal = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_VIDEOS) || '[]') || [];
            var cloneMap = {};
            cloudClones.forEach(function (c) { cloneMap[c.id] = c; });
            curLocal.forEach(function (lv) {
              if (lv && cloneMap[lv.id]) {
                lv.cloudSynced = true;
                if (cloneMap[lv.id].thumbnailChunkRef) {
                  lv.thumbnailChunkRef = cloneMap[lv.id].thumbnailChunkRef;
                }
              }
            });
            localStorage.setItem(STORAGE_KEYS.HDNC_VIDEOS, JSON.stringify(curLocal));
          } catch (eMark) {}
        }
        broadcastSyncMessage({ type: 'HDNC_VIDEOS_UPDATED', timestamp: Date.now() });
        return res;
      });
    });
  }

  // Đẩy bài viết diễn đàn lên Cloud (chỉ bài người dùng tạo / tương tác thật + tách ảnh/tệp lớn sang child bin)
  function syncForumPostsToCloud(postsList) {
    if (!Array.isArray(postsList)) return Promise.resolve({ ok: false, error: 'Invalid posts' });

    var deletedIds = [];
    try { deletedIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORUM_DELETED) || '[]') || []; } catch (e) {}
    var bannedUsers = [];
    try { bannedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORUM_BANNED) || '[]') || []; } catch (e) {}

    var realPosts = postsList.filter(function (p) {
      if (!p || !p.id) return false;
      var idStr = String(p.id);
      if (idStr.indexOf('post_seed_') !== 0 || p.isUserCreated) return true;
      var hasUserComment = Array.isArray(p.comments) && p.comments.some(function (c) {
        return c && String(c.id || '').indexOf('cmt_') === 0;
      });
      return hasUserComment || (p.myVote !== undefined && p.myVote !== 0);
    });

    var offloadTasks = realPosts.map(function (p) {
      var clone = Object.assign({}, p);
      if (p.attachment) clone.attachment = Object.assign({}, p.attachment);
      var subTasks = [];

      if (clone.image && String(clone.image).length > 3500 && String(clone.image).indexOf('extchunks://') !== 0) {
        if (clone.imageChunkRef && String(clone.imageChunkRef).indexOf('extchunks://') === 0) {
          clone.image = clone.imageChunkRef;
        } else {
          subTasks.push(
            uploadStringToCloudChunks(clone.image).then(function (ref) {
              if (ref) {
                clone.imageChunkRef = ref;
                clone.image = ref;
                p.imageChunkRef = ref;
              } else {
                clone.image = null;
              }
            })
          );
        }
      }

      if (clone.attachment && clone.attachment.dataUrl && String(clone.attachment.dataUrl).length > 3500 && String(clone.attachment.dataUrl).indexOf('extchunks://') !== 0) {
        if (clone.attachment.dataChunkRef && String(clone.attachment.dataChunkRef).indexOf('extchunks://') === 0) {
          clone.attachment.dataUrl = clone.attachment.dataChunkRef;
        } else {
          subTasks.push(
            uploadStringToCloudChunks(clone.attachment.dataUrl).then(function (ref) {
              if (ref) {
                clone.attachment.dataChunkRef = ref;
                clone.attachment.dataUrl = ref;
                if (p.attachment) p.attachment.dataChunkRef = ref;
              } else {
                clone.attachment.dataUrl = '';
              }
            })
          );
        }
      }

      return Promise.all(subTasks).then(function () { return clone; });
    });

    return Promise.all(offloadTasks).then(function (sanitizedPosts) {
      var resPromise = pushPartialToCloud({
        forum_posts: sanitizedPosts,
        forum_deleted_ids: deletedIds.slice(-150),
        forum_banned_users: bannedUsers,
        updatedAt: Date.now()
      });
      broadcastSyncMessage({ type: 'FORUM_POSTS_UPDATED', timestamp: Date.now() });
      return resPromise;
    });
  }

  // Đẩy danh sách người dùng đăng ký lên Cloud
  function syncUsersToCloud(usersList) {
    return pushPartialToCloud({ users: usersList, updatedAt: Date.now() });
  }

  // Đẩy cấu hình âm thanh lên Cloud
  function syncAudioConfigToCloud(audioConfig) {
    return pushPartialToCloud({ server_audio: audioConfig, updatedAt: Date.now() });
  }

  // Đẩy một phần dữ liệu lên Cloud qua PATCH (kèm GET + merge + PUT fallback an toàn, không ghi đè mất dữ liệu)
  function pushPartialToCloud(partialData) {
    var cfg = getCloudConfig();

    // Thông báo tức thì qua BroadcastChannel tới các Tab/Cửa sổ khác cùng trình duyệt
    broadcastSyncMessage({ type: 'CLOUD_PUSH', data: partialData, timestamp: Date.now() });

    // 1. Firebase
    if (cfg.firebaseDbUrl && window.firebase && window.firebase.database) {
      try {
        window.firebase.database().ref('dan_tranh_cloud').update(partialData);
        return Promise.resolve({ ok: true, provider: 'firebase' });
      } catch (e) {
        return Promise.resolve({ ok: false, error: e && e.message });
      }
    }

    // 2. Supabase
    if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
      try {
        var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        return client.from('dan_tranh_cloud').upsert([Object.assign({ id: 1 }, partialData)]).then(function (res) {
          return { ok: !res.error, error: res.error && res.error.message };
        });
      } catch (e) {
        return Promise.resolve({ ok: false, error: e && e.message });
      }
    }

    // 3. Relay Endpoint tự động (ExtendsClass JSON Storage)
    var endpoint = cfg.relayEndpoint || DEFAULT_RELAY_ENDPOINT;
    if (endpoint) {
      var payloadStr = '';
      try {
        payloadStr = JSON.stringify(partialData);
      } catch (eSer) {
        return Promise.resolve({ ok: false, error: 'Serialize error' });
      }

      return fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/merge-patch+json' },
        body: payloadStr
      })
        .then(function (res) {
          if (res.ok) {
            return res.text().then(function (txt) {
              var parsed = extractCleanJson(txt);
              if (parsed && typeof parsed.status === 'number' && parsed.status !== 0) {
                throw new Error('Relay returned status ' + parsed.status);
              }
              _cloudHealth.lastOkAt = Date.now();
              _cloudHealth.lastError = null;
              return { ok: true, status: res.status };
            });
          }
          if (res.status === 413) {
            var msg413 = 'HTTP 413 Payload Too Large (' + payloadStr.length + ' bytes)';
            _cloudHealth.lastError = msg413;
            _cloudHealth.lastErrorAt = Date.now();
            console.warn('[CloudSync]', msg413);
            return { ok: false, status: 413, error: msg413 };
          }
          // Fallback: GET bản mới nhất -> merge -> PUT (không bao giờ ghi đè bằng partialData đơn lẻ)
          var sep = endpoint.indexOf('?') === -1 ? '?' : '&';
          return fetch(endpoint + sep + '_t=' + Date.now(), { method: 'GET', cache: 'no-store' })
            .then(function (r) { return r.ok ? r.text() : ''; })
            .then(function (raw) {
              var existing = extractCleanJson(raw);
              if (existing && existing.data && typeof existing.data === 'string') {
                existing = extractCleanJson(existing.data) || existing;
              }
              var merged = Object.assign({}, (existing && typeof existing === 'object') ? existing : {}, partialData);
              return fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged)
              }).then(function (putRes) {
                if (!putRes.ok) throw new Error('HTTP ' + putRes.status);
                _cloudHealth.lastOkAt = Date.now();
                _cloudHealth.lastError = null;
                return { ok: true, status: putRes.status };
              });
            });
        })
        .catch(function (err) {
          var errMsg = (err && err.message) ? err.message : 'Lỗi kết nối máy chủ Cloud Relay';
          _cloudHealth.lastError = errMsg;
          _cloudHealth.lastErrorAt = Date.now();
          console.warn('[CloudSync] pushPartialToCloud failed:', errMsg);
          return { ok: false, error: errMsg };
        });
    }

    return Promise.resolve({ ok: false, error: 'Chưa cấu hình Cloud Relay' });
  }

  function pushAllLocalDataToCloud() {
    var videosList = [];
    try {
      var vRaw = JSON.parse(localStorage.getItem(STORAGE_KEYS.HDNC_VIDEOS) || '[]') || [];
      if (Array.isArray(vRaw)) videosList = vRaw.filter(function (v) { return v && !v.isPreset; });
    } catch (e) {}

    var postsList = [];
    try {
      var pRaw = JSON.parse(localStorage.getItem(STORAGE_KEYS.FORUM_POSTS) || localStorage.getItem(STORAGE_KEYS.FORUM_POSTS_ALT) || '[]') || [];
      if (Array.isArray(pRaw)) postsList = pRaw;
    } catch (e) {}

    var usersList = null;
    try {
      var uRaw = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || 'null');
      if (Array.isArray(uRaw) && uRaw.length > 0) usersList = uRaw;
    } catch (e) {}

    var annList = getStoredAnnouncements();
    var chain = Promise.resolve({ ok: true });

    chain = chain.then(function (prev) {
      return syncHdncVideosToCloud(videosList).then(function (r) {
        return { ok: prev.ok && (!r || r.ok !== false), videoRes: r };
      });
    });

    chain = chain.then(function (prev) {
      return syncForumPostsToCloud(postsList).then(function (r) {
        return { ok: prev.ok && (!r || r.ok !== false), videoRes: prev.videoRes, forumRes: r };
      });
    });

    chain = chain.then(function (prev) {
      var basePatch = { announcements: annList, updatedAt: Date.now() };
      if (usersList) basePatch.users = usersList;
      return pushPartialToCloud(basePatch).then(function (r) {
        return { ok: prev.ok && (!r || r.ok !== false), videoRes: prev.videoRes, forumRes: prev.forumRes, baseRes: r };
      });
    });

    return chain;
  }

  function getCloudHealth() {
    return Object.assign({}, _cloudHealth);
  }

  // ============================================================================
  // XỬ LÝ SỰ KIỆN KHI MỞ VÀ ĐÓNG MODAL THÔNG BÁO (YÊU CẦU 2 & 3)
  // ============================================================================
  function onNotificationModalOpened() {
    if (typeof window.renderOwnerAnnouncements === 'function') {
      window.renderOwnerAnnouncements();
    }
    window._isViewingNotificationModal = true;
  }

  function onNotificationModalClosed() {
    window._isViewingNotificationModal = false;
    var curUser = getCurrentUsername();
    markAllAnnouncementsAsRead(curUser);
  }

  // ============================================================================
  // XUẤT ĐỐI TƯỢNG TOÀN CỤC DanTranhCloudSync
  // ============================================================================
  window.DanTranhCloudSync = {
    // Thông báo & Trạng thái đọc
    getAnnouncements: getStoredAnnouncements,
    postAnnouncement: postNewAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    getUnreadCount: getUnreadAnnouncementsCount,
    markAllAsRead: markAllAnnouncementsAsRead,
    updateBadgeUI: updateNotificationBadgeUI,
    onModalOpened: onNotificationModalOpened,
    onModalClosed: onNotificationModalClosed,

    // Hòm thư Admin & Góp ý
    syncReportsToCloud: syncReportsToCloud,

    // Diễn đàn
    syncForumPostsToCloud: syncForumPostsToCloud,

    // Video Hướng Dẫn
    syncHdncVideosToCloud: syncHdncVideosToCloud,

    // Người dùng
    syncUsersToCloud: syncUsersToCloud,

    // Âm thanh Server
    getAudioConfig: getServerAudioConfig,
    saveAudioConfig: saveServerAudioConfig,
    getAudioForNote: getServerAudioForNote,
    setAudioForNote: setServerAudioForNote,
    removeAudioForNote: removeServerAudioForNote,
    clearAudioForInstrument: clearServerAudioForInstrument,
    playCustomAudioForNote: playServerCustomAudioForNote,
    uploadAudioFile: uploadAudioFileForNote,

    // Cấu hình Cloud & Ticker
    getCloudConfig: getCloudConfig,
    saveCloudConfig: saveCloudConfig,
    startSyncTicker: startPeriodicSyncTicker,
    triggerSyncNow: triggerCloudHeartbeatSync,
    pushAllLocalDataToCloud: pushAllLocalDataToCloud,
    getCloudHealth: getCloudHealth,
    uploadStringToCloudChunks: uploadStringToCloudChunks,
    downloadStringFromCloudChunks: downloadStringFromCloudChunks,
    uploadBlobToCloudChunks: uploadBlobToCloudChunks,
    downloadBlobFromCloudChunks: downloadBlobFromCloudChunks,
    getCurrentUsername: getCurrentUsername
  };

  // Tự động kích hoạt khi tải trang
  function initCloudSync() {
    updateNotificationBadgeUI();
    triggerCloudHeartbeatSync(); // Đồng bộ ngay khi tải trang
    startPeriodicSyncTicker(3500); // Vòng lặp đồng bộ 3.5s

    // Kích hoạt đồng bộ ngay khi người dùng quay lại tab trình duyệt hoặc online
    window.addEventListener('focus', function () {
      triggerCloudHeartbeatSync();
    });
    window.addEventListener('online', function () {
      triggerCloudHeartbeatSync();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloudSync);
  } else {
    initCloudSync();
  }

})(window);
