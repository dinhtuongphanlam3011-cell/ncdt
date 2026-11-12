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

      // 3. Cloud Relay Endpoint tự động (Mặc định ExtendsClass JSON Storage)
      var endpoint = cfg.relayEndpoint || DEFAULT_RELAY_ENDPOINT;
      if (endpoint) {
        fetch(endpoint, { method: 'GET', cache: 'no-cache' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .then(function (rawText) {
            var payload = extractCleanJson(rawText);
            if (!payload) {
              resolve(false);
              return;
            }
            if (payload.data && typeof payload.data === 'string') {
              var inner = extractCleanJson(payload.data);
              if (inner) payload = inner;
            }
            var changed = applyCloudPayload(payload);
            resolve(changed);
          })
          .catch(function (err) {
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

    // D. Cập nhật Diễn đàn (Forum Posts, Comments, Upvotes)
    if (Array.isArray(payload.forum_posts)) {
      var localPosts = [];
      if (typeof window.getAllRedditPosts === 'function') {
        try { localPosts = window.getAllRedditPosts(); } catch (e) {}
      }
      if (!localPosts || localPosts.length === 0) {
        var localPostsRaw = localStorage.getItem(STORAGE_KEYS.FORUM_POSTS) || localStorage.getItem(STORAGE_KEYS.FORUM_POSTS_ALT);
        try { localPosts = JSON.parse(localPostsRaw) || []; } catch (e) {}
      }
      var postMap = {};
      localPosts.forEach(function (p) { if (p && p.id) postMap[String(p.id)] = p; });
      var postChanged = false;

      payload.forum_posts.forEach(function (cloudP) {
        if (!cloudP || !cloudP.id) return;
        var k = String(cloudP.id);
        if (!postMap[k]) {
          postMap[k] = cloudP;
          postChanged = true;
        } else {
          var curP = postMap[k];
          var cloudCmts = Array.isArray(cloudP.comments) ? cloudP.comments : [];
          var curCmts = Array.isArray(curP.comments) ? curP.comments : [];
          if (cloudCmts.length > curCmts.length) {
            curP.comments = cloudCmts;
            postChanged = true;
          }
          if (cloudP.upvotes !== undefined && cloudP.upvotes !== curP.upvotes) {
            curP.upvotes = Math.max(curP.upvotes || 0, cloudP.upvotes);
            postChanged = true;
          }
        }
      });

      if (postChanged || localPosts.length !== Object.keys(postMap).length) {
        var mergedPosts = Object.values(postMap).sort(function (a, b) {
          return (b.timestamp || 0) - (a.timestamp || 0);
        });
        localStorage.setItem(STORAGE_KEYS.FORUM_POSTS, JSON.stringify(mergedPosts));
        localStorage.setItem(STORAGE_KEYS.FORUM_POSTS_ALT, JSON.stringify(mergedPosts));
        changed = true;
        if (typeof window.renderRedditFeed === 'function') window.renderRedditFeed();
        if (typeof window.renderRedditRecentPosts === 'function') window.renderRedditRecentPosts();
        if (typeof window.renderRedditHistoryTab === 'function') window.renderRedditHistoryTab();
        if (typeof window.updateForumRealStats === 'function') window.updateForumRealStats();
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

    // G. Cập nhật Video Hướng Dẫn Nhạc Cụ (HDNC Videos)
    if (Array.isArray(payload.hdnc_videos)) {
      var localVideosRaw = localStorage.getItem('dan_tranh_hdnc_videos_v1');
      var localVideos = [];
      try { localVideos = JSON.parse(localVideosRaw) || []; } catch (e) {}
      var vidMap = {};
      localVideos.forEach(function (v) { if (v && v.id) vidMap[v.id] = v; });
      var vidChanged = false;

      payload.hdnc_videos.forEach(function (cloudV) {
        if (!cloudV || !cloudV.id) return;
        if (!vidMap[cloudV.id] || JSON.stringify(vidMap[cloudV.id]) !== JSON.stringify(cloudV)) {
          vidMap[cloudV.id] = cloudV;
          vidChanged = true;
        }
      });

      if (vidChanged) {
        var mergedVids = Object.values(vidMap);
        localStorage.setItem('dan_tranh_hdnc_videos_v1', JSON.stringify(mergedVids));
        changed = true;
        if (window.DanTranhAdminVideos && typeof window.DanTranhAdminVideos.renderAdminVideoTable === 'function') {
          window.DanTranhAdminVideos.renderAdminVideoTable();
        }
        if (window.DanTranhVideoHdnc && typeof window.DanTranhVideoHdnc.renderGrid === 'function') {
          window.DanTranhVideoHdnc.renderGrid();
        }
      }
    }

    return changed;
  }

  // ============================================================================
  // CÁC HÀM ĐẨY DỮ LIỆU LÊN SERVER CLOUD TẬP TRUNG
  // ============================================================================

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

  // Đẩy hòm thư Admin (reports) lên Cloud
  function syncReportsToCloud(reportsList) {
    pushPartialToCloud({ reports: reportsList, updatedAt: Date.now() });
  }

  // Đẩy danh sách video hướng dẫn lên Cloud
  function syncHdncVideosToCloud(videosList) {
    if (!Array.isArray(videosList)) return;
    pushPartialToCloud({ hdnc_videos: videosList, updatedAt: Date.now() });
    broadcastSyncMessage({ type: 'HDNC_VIDEOS_UPDATED', timestamp: Date.now() });
  }

  // Đẩy bài viết diễn đàn lên Cloud
  function syncForumPostsToCloud(postsList) {
    if (!Array.isArray(postsList)) return;
    // Lọc các bài viết người dùng tạo hoặc có tương tác để payload gọn nhẹ và đồng bộ tức thì
    var userPosts = postsList.filter(function (p) {
      if (!p) return false;
      return p.isUserCreated || !String(p.id).startsWith('post_seed_') || (Array.isArray(p.comments) && p.comments.length > 0) || (p.upvotes && p.upvotes > 0);
    });
    var toSync = userPosts.length > 0 ? userPosts : postsList.slice(0, 10);
    pushPartialToCloud({ forum_posts: toSync, updatedAt: Date.now() });
    broadcastSyncMessage({ type: 'FORUM_POSTS_UPDATED', timestamp: Date.now() });
  }

  // Đẩy danh sách người dùng đăng ký lên Cloud
  function syncUsersToCloud(usersList) {
    pushPartialToCloud({ users: usersList, updatedAt: Date.now() });
  }

  // Đẩy cấu hình âm thanh lên Cloud
  function syncAudioConfigToCloud(audioConfig) {
    pushPartialToCloud({ server_audio: audioConfig, updatedAt: Date.now() });
  }

  // Đẩy một phần dữ liệu lên Cloud qua PATCH hoặc PUT
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

    // 3. Relay Endpoint tự động (ExtendsClass JSON Storage)
    var endpoint = cfg.relayEndpoint || DEFAULT_RELAY_ENDPOINT;
    if (endpoint) {
      try {
        fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partialData)
        }).catch(function () {
          // Thử lại bằng POST / PUT nếu PATCH không khả dụng
          fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partialData)
          }).catch(function () {});
        });
      } catch (e) {}
    }

    // Thông báo tức thì qua BroadcastChannel tới các Tab/Cửa sổ khác cùng trình duyệt
    broadcastSyncMessage({ type: 'CLOUD_PUSH', data: partialData, timestamp: Date.now() });
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
