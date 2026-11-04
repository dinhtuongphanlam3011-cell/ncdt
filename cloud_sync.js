/**
 * ============================================================================
 * DanTranhCloudSync - HỆ THỐNG ĐỒNG BỘ CLOUD, REALTIME & QUẢN LÝ THÔNG BÁO, ÂM THANH
 * ============================================================================
 * Giải quyết triệt để 3 yêu cầu hệ thống:
 * 1. Đồng bộ file âm thanh dùng chung giữa tất cả người dùng và thiết bị
 * 2. Hệ thống đếm thông báo chưa đọc chuẩn xác (Gắn riêng với từng tài khoản,
 *    đồng bộ đa thiết bị, tự reset khi đọc và tự tăng số đỏ khi có thông báo mới)
 * 3. Phân phối thông báo từ Admin theo thời gian thực (Realtime / Polling Ticker)
 *    mà không cần tải lại trang.
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Các khóa lưu trữ cục bộ (Local / Shared Cache)
  var STORAGE_KEYS = {
    ANNOUNCEMENTS: 'dan_tranh_announcements',
    ANNOUNCEMENT_READS: 'dan_tranh_announcement_reads',
    SERVER_AUDIO: 'dan_tranh_server_audio_config',
    CLOUD_CONFIG: 'dan_tranh_cloud_config',
    USER_SESSION: 'dan_tranh_user_session',
    USERS: 'dan_tranh_users'
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
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      provider: 'relay', // 'relay' | 'supabase' | 'firebase'
      relayEndpoint: '', // URL cloud relay nếu tự dựng
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
      body: announcementData.content || announcementData.body || '', // Đồng bộ cả 2 trường
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

  // Phát file âm thanh tùy chỉnh server cho nốt
  function playServerCustomAudioForNote(instId, noteIdx) {
    var noteCustom = getServerAudioForNote(instId, noteIdx);
    if (!noteCustom || !noteCustom.fileUrl) return false;

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

      // 1. Nếu có Supabase cấu hình:
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

      // 2. Nếu có Firebase Storage:
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

      // Mặc định trả về null để sử dụng URL nội bộ đã đồng bộ
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

      if (data.type === 'NEW_ANNOUNCEMENT') {
        // Cập nhật danh sách thông báo và cập nhật số đỏ ngay lập tức
        updateNotificationBadgeUI();
        if (typeof window.renderOwnerAnnouncements === 'function') {
          window.renderOwnerAnnouncements();
        }
        if (typeof window.renderWpAnnouncementsList === 'function') {
          window.renderWpAnnouncementsList();
        }
      } else if (data.type === 'DELETE_ANNOUNCEMENT') {
        updateNotificationBadgeUI();
        if (typeof window.renderOwnerAnnouncements === 'function') {
          window.renderOwnerAnnouncements();
        }
        if (typeof window.renderWpAnnouncementsList === 'function') {
          window.renderWpAnnouncementsList();
        }
      } else if (data.type === 'READS_UPDATED') {
        // Nếu cùng tài khoản ở tab khác đọc xong, tắt số đỏ ở tab này luôn
        if (data.username === getCurrentUsername()) {
          updateNotificationBadgeUI();
        }
      } else if (data.type === 'AUDIO_CONFIG_UPDATED') {
        _audioConfigCache = data.config;
        _audioPool = {}; // Xóa audio pool cũ để nạp URL mới
        if (typeof window.renderOwnerInstStringsAudioTable === 'function') {
          var targetId = window.currentOwnerSelectedInstId || 'dantranh';
          window.renderOwnerInstStringsAudioTable(targetId);
        }
      }
    };
  }

  // Lắng nghe sự kiện storage (hỗ trợ các trình duyệt không có BroadcastChannel)
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEYS.ANNOUNCEMENTS || e.key === STORAGE_KEYS.ANNOUNCEMENT_READS) {
      updateNotificationBadgeUI();
      if (typeof window.renderOwnerAnnouncements === 'function') {
        window.renderOwnerAnnouncements();
      }
      if (typeof window.renderWpAnnouncementsList === 'function') {
        window.renderWpAnnouncementsList();
      }
    } else if (e.key === STORAGE_KEYS.SERVER_AUDIO) {
      _audioConfigCache = null;
      _audioPool = {};
      if (typeof window.renderOwnerInstStringsAudioTable === 'function') {
        var targetId = window.currentOwnerSelectedInstId || 'dantranh';
        window.renderOwnerInstStringsAudioTable(targetId);
      }
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
    if (isSyncing) return;
    isSyncing = true;

    fetchCloudUpdates().then(function (hasChanges) {
      isSyncing = false;
      if (hasChanges) {
        updateNotificationBadgeUI();
        if (typeof window.renderOwnerAnnouncements === 'function') {
          window.renderOwnerAnnouncements();
        }
        if (typeof window.renderWpAnnouncementsList === 'function') {
          window.renderWpAnnouncementsList();
        }
        if (typeof window.renderOwnerInstStringsAudioTable === 'function') {
          var targetId = window.currentOwnerSelectedInstId || 'dantranh';
          window.renderOwnerInstStringsAudioTable(targetId);
        }
      }
    }).catch(function () {
      isSyncing = false;
    });
  }

  // Kéo dữ liệu mới nhất từ Cloud (Thông báo, Trạng thái đọc, Cấu hình âm thanh)
  function fetchCloudUpdates() {
    return new Promise(function (resolve) {
      var cfg = getCloudConfig();

      // 1. Nếu kết nối Firebase Realtime Database
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

      // 2. Nếu kết nối Supabase
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

      // 3. Nếu kết nối Cloud Relay Endpoint tự động
      if (cfg.relayEndpoint) {
        fetch(cfg.relayEndpoint, { method: 'GET', cache: 'no-cache' })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var changed = applyCloudPayload(data);
            resolve(changed);
          })
          .catch(function () {
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

    // A. Cập nhật thông báo
    if (Array.isArray(payload.announcements)) {
      var localAnn = getStoredAnnouncements();
      if (JSON.stringify(localAnn) !== JSON.stringify(payload.announcements)) {
        saveStoredAnnouncements(payload.announcements);
        changed = true;
      }
    }

    // B. Cập nhật trạng thái đọc của người dùng
    if (payload.announcement_reads && typeof payload.announcement_reads === 'object') {
      var localReads = getStoredReadsMap();
      var mergedReads = Object.assign({}, localReads, payload.announcement_reads);
      if (JSON.stringify(localReads) !== JSON.stringify(mergedReads)) {
        saveStoredReadsMap(mergedReads);
        changed = true;
      }
    }

    // C. Cập nhật cấu hình âm thanh Server
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

    return changed;
  }

  // Đẩy thông báo lên Cloud
  function syncAnnouncementsToCloud(announcementsList) {
    pushPartialToCloud({ announcements: announcementsList, updatedAt: Date.now() });
  }

  // Đẩy trạng thái đọc lên Cloud
  function syncReadsToCloud(username, readList) {
    var readsMap = getStoredReadsMap();
    readsMap[username] = readList;
    pushPartialToCloud({ announcement_reads: readsMap, updatedAt: Date.now() });
  }

  // Đẩy cấu hình âm thanh lên Cloud
  function syncAudioConfigToCloud(audioConfig) {
    pushPartialToCloud({ server_audio: audioConfig, updatedAt: Date.now() });
  }

  // Đẩy một phần dữ liệu lên Cloud
  function pushPartialToCloud(partialData) {
    var cfg = getCloudConfig();

    // 1. Firebase
    if (cfg.firebaseDbUrl && window.firebase && window.firebase.database) {
      try {
        window.firebase.database().ref('dan_tranh_cloud').update(partialData);
      } catch (e) {}
      return;
    }

    // 2. Supabase
    if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
      try {
        var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        client.from('dan_tranh_cloud').upsert([Object.assign({ id: 1 }, partialData)]);
      } catch (e) {}
      return;
    }

    // 3. Relay Endpoint
    if (cfg.relayEndpoint) {
      try {
        fetch(cfg.relayEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partialData)
        }).catch(function () {});
      } catch (e) {}
    }
  }

  // ============================================================================
  // XỬ LÝ SỰ KIỆN KHI MỞ VÀ ĐÓNG MODAL THÔNG BÁO (YÊU CẦU 2 & 3)
  // ============================================================================
  // Khi mở bảng thông báo: hiển thị thông báo, nhận diện đã đọc
  function onNotificationModalOpened() {
    if (typeof window.renderOwnerAnnouncements === 'function') {
      window.renderOwnerAnnouncements();
    }
    // Ghi nhớ rằng người dùng đang mở xem bảng thông báo
    window._isViewingNotificationModal = true;
  }

  // Khi đóng bảng thông báo: Đánh dấu TẤT CẢ các thông báo hiển thị là ĐÃ ĐỌC
  // Tự động xóa/reset số màu đỏ trên chuông về 0 ngay lập tức!
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
    getCurrentUsername: getCurrentUsername
  };

  // Tự động kích hoạt khi tài liệu sẵn sàng
  function initCloudSync() {
    updateNotificationBadgeUI();
    startPeriodicSyncTicker(3500); // Bắt đầu vòng lặp đồng bộ 3.5s
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloudSync);
  } else {
    initCloudSync();
  }

})(window);
