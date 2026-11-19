/**
 * VIDEO_HDNC.JS - HỆ THỐNG QUẢN LÝ & LƯU TRỮ VIDEO DÀNH CHO ADMIN
 * Website: Đàn Tranh Online & 38 Đại Nhạc Cụ Dân Tộc Việt Nam
 * 
 * Chức năng:
 * - Admin chủ động chọn & tải video từ máy tính (MP4, WebM, MOV)
 * - Tự động trích xuất ảnh thumbnail từ video bằng Canvas hoặc tải ảnh đại diện riêng
 * - Tiến trình tải lên (Progress Bar 0% -> 100%) trực quan, hỗ trợ video dung lượng lớn
 * - Phân loại 5 danh mục chuẩn: Sử dụng, Kỹ thuật chơi, Thực hành, Biểu diễn, Giới thiệu
 * - Chọn nhạc cụ tương ứng từ kho 38 nhạc cụ dân tộc Việt Nam
 * - Lưu trữ vĩnh viễn trên Server & Database & Cloud Relay đa thiết bị
 * - Phân quyền chặt chẽ (Chỉ Admin / Owner có quyền Tải lên, Chỉnh sửa, Xóa video)
 * - Tạm thời ẩn giao diện hiển thị video công khai ngoài sân khấu
 */

(function (window) {
  'use strict';

  var STORAGE_KEY = 'dan_tranh_hdnc_videos_v1';
  var DB_NAME = 'DanTranhVideoDB_v1';
  var DB_VERSION = 1;
  var STORE_NAME = 'videos';

  // =========================================================================
  // 1. DANH MỤC PHÂN LOẠI VIDEO CHUẨN THEO YÊU CẦU MỚI
  // =========================================================================
  var ADMIN_VIDEO_CATEGORIES = [
    { id: 'all', name: 'Tất cả danh mục', icon: '🌐' },
    { id: 'usage', name: 'Hướng dẫn sử dụng', icon: '🛠️' },
    { id: 'technique', name: 'Hướng dẫn kỹ thuật chơi', icon: '✨' },
    { id: 'practice', name: 'Hướng dẫn thực hành', icon: '🎯' },
    { id: 'performance', name: 'Biểu diễn nhạc cụ', icon: '🎭' },
    { id: 'intro', name: 'Giới thiệu nhạc cụ', icon: '📖' }
  ];

  // =========================================================================
  // 2. DANH SÁCH 12 VIDEO THỰC TẾ TRÊN SERVER VỚI THỜI LƯỢNG CHUẨN XÁC
  // (Đã trích xuất chính xác từ các tệp MP4 gốc trong thư mục video_hdnc)
  // =========================================================================
  var DEFAULT_HDNC_VIDEOS = [
    {
      id: 'vid_dantranh_1',
      title: 'Hướng Dẫn Tư Thế Ngồi, Móng Gảy & Kỹ Thuật Ngón Á - Vê - Rung Đàn Tranh',
      filename: 'Đàn tranh.mp4',
      videoUrl: 'video_hdnc/Đàn tranh.mp4',
      thumbnailUrl: '',
      instrumentId: 'dantranh',
      instrumentName: 'Đàn Tranh',
      instrumentIcon: '🪕',
      category: 'technique',
      categoryName: 'Hướng dẫn kỹ thuật chơi',
      description: 'Chi tiết thế ngồi chuẩn, cách cố định móng đồi mồi bàn tay phải, tư thế tay trái bấm nhạn và thực hành 3 kỹ thuật cốt lõi: ngón Á (lướt dây), ngón Vê (tremolo) và ngón Rung tạo hồn cho thang âm ngũ cung.',
      duration: '02:22',
      fileSize: '65.3 MB',
      views: 1420,
      uploadDate: '2026-11-01',
      isPreset: true
    },
    {
      id: 'vid_danbau_1',
      title: 'Hướng Dẫn Kỹ Thuật Gảy Bồi Âm & Rung Cần Tạo Âm Điệu Đàn Bầu',
      filename: 'Đàn bầu.mp4',
      videoUrl: 'video_hdnc/Đàn bầu.mp4',
      thumbnailUrl: '',
      instrumentId: 'danbau',
      instrumentName: 'Đàn Bầu',
      instrumentIcon: '🎻',
      category: 'technique',
      categoryName: 'Hướng dẫn kỹ thuật chơi',
      description: 'Kỹ thuật chạm cườm tay bồi âm trên các nút chia chiều dài dây (1/2, 1/3, 1/4, 1/5) kết hợp tay trái nắn, lắc cần đàn tạo ra các nốt luyến láy như tiếng người than thở.',
      duration: '03:04',
      fileSize: '58.8 MB',
      views: 980,
      uploadDate: '2026-11-02',
      isPreset: true
    },
    {
      id: 'vid_dannguyet_1',
      title: 'Hướng Dẫn Thế Bấm Phím Cao, Ngón Mổ & Nhấn Dây Đàn Nguyệt',
      filename: 'Đàn nguyệt.mp4',
      videoUrl: 'video_hdnc/Đàn nguyệt.mp4',
      thumbnailUrl: '',
      instrumentId: 'dannguyet',
      instrumentName: 'Đàn Nguyệt',
      instrumentIcon: '🌕',
      category: 'technique',
      categoryName: 'Hướng dẫn kỹ thuật chơi',
      description: 'Cách ôm đàn nguyệt chuẩn, phương pháp dùng lực ngón tay trái nhấn chùng, nhấn căng trên các phím đàn cao và kỹ thuật gảy ngón mổ, ngón vê điêu luyện trong điệu Chầu Văn.',
      duration: '02:43',
      fileSize: '291.9 MB',
      views: 1250,
      uploadDate: '2026-11-03',
      isPreset: true
    },
    {
      id: 'vid_dantiba_1',
      title: 'Hướng Dẫn Kỹ Thuật Phi, Luân Chỉ & Vuốt Dây Đàn Tì Bà',
      filename: 'Đàn tì bà.mp4',
      videoUrl: 'video_hdnc/Đàn tì bà.mp4',
      thumbnailUrl: '',
      instrumentId: 'dantiba',
      instrumentName: 'Đàn Tì Bà',
      instrumentIcon: '🪕',
      category: 'technique',
      categoryName: 'Hướng dẫn kỹ thuật chơi',
      description: 'Luyện tập ngón Luân Chỉ (vê xoay vòng 5 đầu ngón tay), kỹ thuật Phi (gõ mạnh móng vào dây) và ngón Vuốt tạo âm sắc cổ kính, lộng lẫy chốn cung đình.',
      duration: '02:27',
      fileSize: '67.8 MB',
      views: 860,
      uploadDate: '2026-11-03',
      isPreset: true
    },
    {
      id: 'vid_saotruc_1',
      title: 'Hướng Dẫn Kỹ Thuật Rung Hơi, Vuốt Ngón & Đổi Quãng Sáo Trúc',
      filename: 'Sáo trúc.mp4',
      videoUrl: 'video_hdnc/Sáo trúc.mp4',
      thumbnailUrl: '',
      instrumentId: 'saotruc',
      instrumentName: 'Sáo Trúc & Tiêu',
      instrumentIcon: '🎋',
      category: 'practice',
      categoryName: 'Hướng dẫn thực hành',
      description: 'Khẩu hình đặt môi trên lỗ thổi, cách ém hơi cơ hoành, kỹ thuật rung bụng và vuốt ngón nửa lỗ để diễn tấu các giai điệu dân ca trong trẻo, mượt mà.',
      duration: '02:55',
      fileSize: '124.6 MB',
      views: 2100,
      uploadDate: '2026-11-04',
      isPreset: true
    },
    {
      id: 'vid_saotieu_1',
      title: 'Hướng Dẫn Kỹ Thuật Thổi Sáo Tiêu & Định Âm Lỗ Bấm Bát Khổng',
      filename: 'Sáo tiêu.mp4',
      videoUrl: 'video_hdnc/Sáo tiêu.mp4',
      thumbnailUrl: '',
      instrumentId: 'saotruc',
      instrumentName: 'Sáo Tiêu',
      instrumentIcon: '🎋',
      category: 'usage',
      categoryName: 'Hướng dẫn sử dụng',
      description: 'Phương pháp định vị thế cầm tiêu dọc, cách vát môi khép kín miệng thổi và điều tiết luồng hơi chậm, sâu để tạo âm sắc trầm ấm, thanh u hoài cổ.',
      duration: '02:32',
      fileSize: '68.9 MB',
      views: 740,
      uploadDate: '2026-11-04',
      isPreset: true
    },
    {
      id: 'vid_kenbausapa_1',
      title: 'Giới Thiệu & Hướng Dẫn Diễn Tấu Kèn Bầu Sa Pa',
      filename: 'Kèn bầu Sapa.mp4',
      videoUrl: 'video_hdnc/Kèn bầu Sapa.mp4',
      thumbnailUrl: '',
      instrumentId: 'kenbau',
      instrumentName: 'Kèn Bầu',
      instrumentIcon: '📯',
      category: 'intro',
      categoryName: 'Giới thiệu nhạc cụ',
      description: 'Khám phá cấu tạo quả bầu khô gắn ống tiêu nứa của người Mông Sa Pa, kỹ thuật ngậm lam đồng và nghệ thuật diễn xướng làn điệu dân ca vùng cao.',
      duration: '00:46',
      fileSize: '20.6 MB',
      views: 630,
      uploadDate: '2026-11-05',
      isPreset: true
    },
    {
      id: 'vid_kenmong_1',
      title: 'Hướng Dẫn Thổi & Nghệ Thuật Diễn Tấu Kèn Mông Vùng Cao',
      filename: 'Kèn mông.mp4',
      videoUrl: 'video_hdnc/Kèn mông.mp4',
      thumbnailUrl: '',
      instrumentId: 'kenmong',
      instrumentName: 'Kèn Mông',
      instrumentIcon: '📯',
      category: 'performance',
      categoryName: 'Biểu diễn nhạc cụ',
      description: 'Kỹ thuật lấy hơi đa luồng qua 6 ống trúc ghép thân gỗ, cách đảo nhịp chân kết hợp điệu múa khèn truyền thống trong các dịp lễ hội mừng xuân.',
      duration: '02:31',
      fileSize: '113.8 MB',
      views: 1100,
      uploadDate: '2026-11-05',
      isPreset: true
    },
    {
      id: 'vid_dantam_1',
      title: 'Hướng Dẫn Thế Bấm & Ngón Gảy Móng Gảy Đàn Tam',
      filename: 'Đàn tam.mp4',
      videoUrl: 'video_hdnc/Đàn tam.mp4',
      thumbnailUrl: '',
      instrumentId: 'dantam',
      instrumentName: 'Đàn Tam',
      instrumentIcon: '🪕',
      category: 'technique',
      categoryName: 'Hướng dẫn kỹ thuật chơi',
      description: 'Cầm móng nhựa hoặc sừng, thế tay trái lướt trên cần đàn không phím và kỹ thuật ngón bịt, ngón gảy tạo âm điệu rộn ràng, dứt khoát.',
      duration: '02:34',
      fileSize: '69.5 MB',
      views: 520,
      uploadDate: '2026-11-06',
      isPreset: true
    },
    {
      id: 'vid_danchapi_1',
      title: 'Giới Thiệu Cấu Tạo & Hướng Dẫn Chơi Đàn Chapi Raglai',
      filename: 'Đàn chapi.mp4',
      videoUrl: 'video_hdnc/Đàn chapi.mp4',
      thumbnailUrl: '',
      instrumentId: 'chapi',
      instrumentName: 'Đàn Chapi',
      instrumentIcon: '🎋',
      category: 'intro',
      categoryName: 'Giới thiệu nhạc cụ',
      description: 'Tìm hiểu huyền thoại cây đàn Chapi của người Raglai, cách tách lớp vỏ tre làm dây đàn và kỹ thuật gõ gảy nhịp nhàng thanh thoát mang âm hưởng núi rừng.',
      duration: '01:00',
      fileSize: '45.1 MB',
      views: 1850,
      uploadDate: '2026-11-06',
      isPreset: true
    },
    {
      id: 'vid_dangoong_1',
      title: 'Tìm Hiểu Cấu Tạo & Hướng Dẫn Gảy Đàn Goong Tây Nguyên',
      filename: 'Đàn goong.mp4',
      videoUrl: 'video_hdnc/Đàn goong.mp4',
      thumbnailUrl: '',
      instrumentId: 'dangoong',
      instrumentName: 'Đàn Goong',
      instrumentIcon: '🪕',
      category: 'intro',
      categoryName: 'Giới thiệu nhạc cụ',
      description: 'Cấu tạo ống nứa cắm quả bầu cộng hưởng âm thanh của các dân tộc Ba Na, Gia Rai; hướng dẫn sử dụng 10 đầu ngón tay luân phiên gảy các dây âm sắc độc đáo.',
      duration: '00:42',
      fileSize: '31.4 MB',
      views: 670,
      uploadDate: '2026-11-07',
      isPreset: true
    },
    {
      id: 'vid_danmoi_1',
      title: 'Hướng Dẫn Cách Cầm, Gảy & Tạo Khoang Âm Đàn Môi',
      filename: 'Đàn môi.mp4',
      videoUrl: 'video_hdnc/Đàn môi.mp4',
      thumbnailUrl: '',
      instrumentId: 'danmoi',
      instrumentName: 'Đàn Môi',
      instrumentIcon: '👄',
      category: 'usage',
      categoryName: 'Hướng dẫn sử dụng',
      description: 'Kỹ thuật đặt vành đàn sát vành môi không chạm răng, cách dùng ngón tay bật lá đồng nhịp nhàng và biến đổi khẩu hình tạo ra những thanh âm huyền ảo.',
      duration: '00:47',
      fileSize: '35.6 MB',
      views: 890,
      uploadDate: '2026-11-07',
      isPreset: true
    }
  ];

  // Danh mục nhạc cụ chuẩn 38 cây đàn để Admin gán video
  var ALL_INSTRUMENTS_REF = [
    { id: 'dantranh', name: 'Đàn Tranh', icon: '🪕' },
    { id: 'danbau', name: 'Đàn Bầu', icon: '🎻' },
    { id: 'dannguyet', name: 'Đàn Nguyệt', icon: '🌕' },
    { id: 'dannhi', name: 'Đàn Nhị', icon: '🎻' },
    { id: 'dantam', name: 'Đàn Tam', icon: '🪕' },
    { id: 'dantu', name: 'Đàn Tứ', icon: '🪕' },
    { id: 'danday', name: 'Đàn Đáy', icon: '🎸' },
    { id: 'dantiba', name: 'Đàn Tì Bà', icon: '🪕' },
    { id: 'danho', name: 'Đàn Hồ', icon: '🎻' },
    { id: 'dantinh', name: 'Đàn Tính', icon: '🎸' },
    { id: 'danmoi', name: 'Đàn Môi', icon: '👄' },
    { id: 'dankni', name: 'Đàn K\'ní', icon: '🎻' },
    { id: 'dangoong', name: 'Đàn Goong', icon: '🪕' },
    { id: 'chapi', name: 'Đàn Chapi', icon: '🎋' },
    { id: 'saotruc', name: 'Sáo Trúc & Tiêu', icon: '🎋' },
    { id: 'khen', name: 'Khèn Bè', icon: '📯' },
    { id: 'kenbau', name: 'Kèn Bầu', icon: '📯' },
    { id: 'kenmong', name: 'Kèn Mông', icon: '📯' },
    { id: 'kenla', name: 'Kèn Lá', icon: '🍃' },
    { id: 'tuva', name: 'Tù Và', icon: '📯' },
    { id: 'pi', name: 'Pí', icon: '🎋' },
    { id: 'trongcom', name: 'Trống Cơm', icon: '🥁' },
    { id: 'trongcai', name: 'Trống Cái', icon: '🥁' },
    { id: 'trongchien', name: 'Trống Chiến', icon: '🥁' },
    { id: 'trongban', name: 'Trống Bản', icon: '🥁' },
    { id: 'congchieng', name: 'Cồng Chiêng', icon: '🔔' },
    { id: 'thanhla', name: 'Thanh La', icon: '🔔' },
    { id: 'mo', name: 'Mõ Gỗ', icon: '🪵' },
    { id: 'phach', name: 'Phách', icon: '🥢' },
    { id: 'sinhtien', name: 'Sinh Tiền', icon: '🪙' },
    { id: 'trung', name: "Đàn T'rưng", icon: '🪵' },
    { id: 'klongput', name: 'Đàn Klông Pút', icon: '🎋' },
    { id: 'danda', name: 'Đàn Đá', icon: '🪨' },
    { id: 'dannuoc', name: 'Đàn Nước', icon: '💧' }
  ];

  // Danh sách nhạc cụ dùng để gán video: ưu tiên đúng danh sách (id) của sân khấu Chơi nhạc cụ
  // để video đăng cho nhạc cụ nào thì hiện đúng ở nhạc cụ đó.
  function getInstrumentRefList() {
    var stageList = window.ALL_38_INST_LIST;
    if (Array.isArray(stageList) && stageList.length) {
      return stageList.map(function (i) {
        return { id: i.id, name: i.name, icon: i.icon || '🪕' };
      });
    }
    return ALL_INSTRUMENTS_REF;
  }

  // =========================================================================
  // 3. BỘ LƯU TRỮ VĨNH VIỄN INDEXEDDB CHO VIDEO DUNG LƯỢNG LỚN (UP TO 500MB+)
  // =========================================================================
  function openVideoIndexedDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = function (e) {
          resolve(e.target.result);
        };
        req.onerror = function (e) {
          console.warn('[IndexedDB] Không thể mở cơ sở dữ liệu video:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[IndexedDB] Lỗi khởi tạo:', err);
        resolve(null);
      }
    });
  }

  function storeVideoBlob(id, fileBlob) {
    return new Promise(function (resolve) {
      openVideoIndexedDB().then(function (db) {
        if (!db) {
          resolve(false);
          return;
        }
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          var req = store.put({ id: id, blob: fileBlob, updatedAt: Date.now() });
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { resolve(false); };
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function getVideoBlob(id) {
    return new Promise(function (resolve) {
      openVideoIndexedDB().then(function (db) {
        if (!db) { resolve(null); return; }
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var req = store.get(id);
          req.onsuccess = function (e) {
            var item = e.target.result;
            resolve(item ? item.blob : null);
          };
          req.onerror = function () { resolve(null); };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  function deleteVideoBlob(id) {
    return new Promise(function (resolve) {
      openVideoIndexedDB().then(function (db) {
        if (!db) { resolve(true); return; }
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          var req = store.delete(id);
          req.onsuccess = function () { resolve(true); };
          req.onerror = function () { resolve(false); };
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  // =========================================================================
  // 4. KIỂM TRA PHÂN QUYỀN ADMIN CHẶT CHẼ TRÊN FRONTEND & DATA LAYER
  // =========================================================================
  function checkAdminPermission() {
    var u = (typeof window.getActiveUserAccount === 'function') ? window.getActiveUserAccount() : null;
    if (!u || u.username === 'guest' || u.role === 'guest') return false;
    var uname = (u.username || '').toLowerCase().trim();
    return u.role === 'admin' || u.isSubAdmin === true || uname === 'admin' || uname === 'owner';
  }

  // =========================================================================
  // 5. QUẢN LÝ DỮ LIỆU METADATA VIDEO (DATABASE & CLOUD RELAY)
  // =========================================================================
  function getAllAdminVideos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(function (v) { return v && v.id && !v.isPreset; });
        }
      }
    } catch (e) {}

    return [];
  }

  function saveAllAdminVideos(list) {
    if (!Array.isArray(list)) return Promise.resolve({ ok: false, error: 'Invalid list' });
    var cleanList = list.filter(function (v) { return v && v.id && !v.isPreset; });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
    } catch (e) {
      console.warn('[VideoManager] Không thể lưu vào localStorage:', e);
    }

    // Đẩy lên Server Cloud Relay để đồng bộ tất cả các thiết bị khác
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.syncHdncVideosToCloud === 'function') {
      return Promise.resolve(window.DanTranhCloudSync.syncHdncVideosToCloud(cleanList));
    }
    return Promise.resolve({ ok: false, error: 'Chưa nạp CloudSync' });
  }

  // =========================================================================
  // 6. TRẠNG THÁI BỘ LỌC CỦA ADMIN VIDEO MANAGER
  // =========================================================================
  var adminFilterInst = 'all';
  var adminFilterCat = 'all';
  var adminSearchQuery = '';

  // =========================================================================
  // 7. RENDER BẢNG QUẢN LÝ VIDEO DÀNH RIÊNG CHO ADMIN (#wpViewVideos)
  // =========================================================================
  function renderAdminVideoTable() {
    var tableBody = document.getElementById('wpAdminVideoTableBody');
    if (!tableBody) return;

    populateInstrumentSelect('adminFilterInstSelect');
    populateInstrumentSelect('adminUploadInstSelect');

    var allVideos = getAllAdminVideos();

    // 1. Cập nhật thẻ thống kê tổng quan
    var elTotalCount = document.getElementById('adminStatTotalVideos');
    var elInstCount = document.getElementById('adminStatInstCount');
    var elTotalSize = document.getElementById('adminStatTotalSize');

    if (elTotalCount) elTotalCount.textContent = allVideos.length;

    var uniqueInsts = {};
    var totalMb = 0;
    allVideos.forEach(function (v) {
      if (v.instrumentId) uniqueInsts[v.instrumentId] = true;
      var sz = String(v.fileSize || '');
      var num = parseFloat(sz);
      if (!isNaN(num) && isFinite(num)) {
        totalMb += (sz.indexOf('GB') !== -1) ? (num * 1024) : num;
      }
    });
    if (elInstCount) elInstCount.textContent = Object.keys(uniqueInsts).length + ' / ' + getInstrumentRefList().length;

    if (elTotalSize) {
      elTotalSize.textContent = totalMb >= 1024 ? ((totalMb / 1024).toFixed(2) + ' GB') : (totalMb.toFixed(1).replace(/\.0$/, '') + ' MB');
    }

    // Cập nhật badge trên menu sidebar nếu có
    var badgeMenu = document.getElementById('wpMenuVideosBadge');
    if (badgeMenu) badgeMenu.textContent = allVideos.length;

    // 2. Lọc danh sách theo lựa chọn của Admin
    var filtered = allVideos.filter(function (v) {
      if (adminFilterInst !== 'all' && v.instrumentId !== adminFilterInst) return false;
      if (adminFilterCat !== 'all' && v.category !== adminFilterCat) return false;
      if (adminSearchQuery) {
        var q = adminSearchQuery.toLowerCase().trim();
        var matchTitle = (v.title || '').toLowerCase().indexOf(q) !== -1;
        var matchDesc = (v.description || '').toLowerCase().indexOf(q) !== -1;
        var matchInst = (v.instrumentName || '').toLowerCase().indexOf(q) !== -1;
        if (!matchTitle && !matchDesc && !matchInst) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = [
        '<tr>',
        '  <td colspan="7" style="text-align: center; padding: 48px 20px; color: #a89a88;">',
        '    <div style="font-size: 32px; margin-bottom: 8px;">🎬</div>',
        '    <div style="font-weight: 700; color: #ffea9f; font-size: 15px;">' + (allVideos.length === 0 ? 'Chưa có video nào được đăng tải' : 'Chưa có video nào phù hợp với bộ lọc') + '</div>',
        '    <div style="font-size: 12.5px; margin-top: 4px;">Nhấn nút <strong>"➕ Thêm Video Mới"</strong> phía trên để đăng video cho từng nhạc cụ.</div>',
        '  </td>',
        '</tr>'
      ].join('');
      return;
    }

    var html = filtered.map(function (v, idx) {
      var catClass = 'admin-badge-cat-' + (v.category || 'usage');
      var catObj = ADMIN_VIDEO_CATEGORIES.find(function (c) { return c.id === v.category; });
      var catName = catObj ? (catObj.icon + ' ' + catObj.name) : (v.categoryName || 'Hướng dẫn');

      var isRemoteUrl = v.videoUrl && /^https?:\/\//i.test(v.videoUrl);
      var storageLabel = isRemoteUrl
        ? '<span class="admin-source-badge cloud">🌐 Link Cloud URL</span>'
        : (v.cloudVideoRef
          ? '<span class="admin-source-badge server">☁️ Đã đồng bộ Cloud</span>'
          : '<span class="admin-source-badge cloud">💾 Lưu cục bộ</span>');

      var thumbHtml = v.thumbnailUrl 
        ? '<img class="admin-table-thumb-img" src="' + escapeHtml(v.thumbnailUrl) + '" alt="' + escapeHtml(v.title) + '" />'
        : '<div class="admin-table-thumb-placeholder"><span>' + (v.instrumentIcon || '🪕') + '</span></div>';

      return [
        '<tr data-video-id="' + v.id + '">',
        '  <td style="width: 50px; text-align: center; color: #a1a1aa; font-size: 13px; font-weight: 600;">' + (idx + 1) + '</td>',
        '  <td style="width: 120px; text-align: center;">',
        '    <div class="admin-table-thumb-wrap" onclick="openAdminVideoPreview(\'' + v.id + '\')" title="Nhấn để xem thử video">' +
               thumbHtml +
        '      <div class="admin-thumb-play-icon">▶</div>',
        '    </div>',
        '  </td>',
        '  <td style="vertical-align: top; padding: 12px 16px;">',
        '    <!-- TÊN Ở TRÊN -->',
        '    <div class="admin-table-title" onclick="openAdminVideoPreview(\'' + v.id + '\')" title="' + escapeHtml(v.title) + '">' +
               escapeHtml(v.title) +
        '    </div>',
        '    <!-- THÔNG TIN Ở DƯỚI -->',
        (v.description ? '    <div class="admin-table-desc">' + escapeHtml(v.description) + '</div>' : ''),
        '    <div class="admin-table-info-meta-row">',
        '      <span class="admin-inst-badge">' + (v.instrumentIcon || '🪕') + ' ' + escapeHtml(v.instrumentName || 'Nhạc cụ') + '</span>',
        '      <span class="admin-cat-badge ' + catClass + '">' + catName + '</span>',
        '      <span class="admin-meta-tag">⏱️ <strong>' + (v.duration || '--:--') + '</strong></span>',
        '      <span class="admin-meta-tag">💾 ' + (v.fileSize || 'HD MP4') + '</span>',
        '      <span class="admin-meta-tag admin-meta-tag-file">' + storageLabel + ' (<code>' + escapeHtml(v.filename || 'video.mp4') + '</code>)</span>',
        '    </div>',
        '  </td>',
        '  <td style="width: 180px; text-align: right; vertical-align: middle;">',
        '    <div class="admin-actions-flex" style="justify-content: flex-end;">',
        '      <button type="button" class="admin-tbl-btn preview" onclick="openAdminVideoPreview(\'' + v.id + '\')" title="Xem thử video">' +
        '        ▶ Xem',
        '      </button>',
        '      <button type="button" class="admin-tbl-btn edit" onclick="openAdminVideoUploadModal(\'' + v.id + '\')" title="Chỉnh sửa thông tin / phân loại video">' +
        '        ✏️ Sửa',
        '      </button>',
        '      <button type="button" class="admin-tbl-btn delete" onclick="deleteAdminVideo(\'' + v.id + '\')" title="Xóa video khỏi hệ thống">' +
        '        🗑️ Xóa',
        '      </button>',
        '    </div>',
        '  </td>',
        '</tr>'
      ].join('');
    }).join('');

    tableBody.innerHTML = html;
  }

  // =========================================================================
  // 8. TỰ ĐỘNG CHỤP KHUNG HÌNH (THUMBNAIL AUTO-CAPTURE BẰNG CANVAS)
  // =========================================================================
  function captureVideoThumbnail(videoElement) {
    try {
      var canvas = document.createElement('canvas');
      var w = videoElement.videoWidth || 320;
      var h = videoElement.videoHeight || 180;
      canvas.width = Math.min(320, w);
      canvas.height = Math.round(canvas.width * (h / w)) || 180;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.62);
    } catch (e) {
      console.warn('Không thể chụp thumbnail từ video canvas:', e);
      return '';
    }
  }

  function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    return m ? m[1] : null;
  }

  function extractGoogleDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    var m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]+)/i);
    return m ? m[1] : null;
  }

  function handleAdminVideoUrlChanged(rawUrl) {
    var url = String(rawUrl || '').trim();
    if (!url) return;
    var ytId = extractYouTubeId(url);
    var previewWrap = document.getElementById('adminUploadPreviewWrap');
    var thumbImg = document.getElementById('adminUploadThumbImg');
    var durationText = document.getElementById('adminUploadDurationText');

    if (ytId) {
      var ytThumb = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
      if (!currentCapturedThumbDataUrl) {
        currentCapturedThumbDataUrl = ytThumb;
        if (thumbImg) thumbImg.src = ytThumb;
        if (previewWrap) previewWrap.style.display = 'flex';
      }
      if (durationText) {
        durationText.innerHTML = '🎬 <strong>Video YouTube</strong> • Tự động lấy thumbnail';
      }
    } else if (extractGoogleDriveFileId(url)) {
      if (durationText) {
        durationText.innerHTML = '📁 <strong>Google Drive Video</strong> • Phát trực tuyến đa thiết bị';
      }
    } else if (/^https?:\/\//i.test(url)) {
      if (durationText) {
        durationText.innerHTML = '🌐 <strong>Link Video trực tiếp</strong> • Đồng bộ đa thiết bị';
      }
    }
  }

  function formatDurationSeconds(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec) || sec <= 0) return '00:00';
    var total = Math.floor(sec);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) {
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatFileSizeBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    var mb = bytes / (1024 * 1024);
    if (mb >= 1000) {
      return (mb / 1024).toFixed(2) + ' GB';
    }
    return mb.toFixed(1) + ' MB';
  }

  // =========================================================================
  // 9. MODAL QUẢN LÝ TẢI LÊN & CHỈNH SỬA VIDEO DÀNH RIÊNG CHO ADMIN
  // =========================================================================
  var currentEditingId = null;
  var currentSelectedFile = null;
  var currentCapturedThumbDataUrl = '';
  var currentSelectedDuration = '';

  function openAdminVideoUploadModal(videoIdToEdit) {
    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin / Owner) mới có quyền truy cập chức năng này!');
      return;
    }

    currentEditingId = videoIdToEdit || null;
    currentSelectedFile = null;
    currentCapturedThumbDataUrl = '';
    currentSelectedDuration = '';

    var overlay = document.getElementById('modalAdminVideoUpload');
    var heading = document.getElementById('adminUploadModalTitle');
    var subtitle = document.getElementById('adminUploadModalSubtitle');
    var form = document.getElementById('formAdminVideoUpload');
    var progressWrap = document.getElementById('adminUploadProgressWrap');
    var previewWrap = document.getElementById('adminUploadPreviewWrap');
    var dropzoneText = document.getElementById('adminDropzoneText');
    var dropzoneSub = document.getElementById('adminDropzoneSub');
    var dropzoneLabel = document.getElementById('adminVideoDropzoneLabel');
    var durationText = document.getElementById('adminUploadDurationText');

    if (!overlay) return;

    if (form) form.reset();
    if (progressWrap) progressWrap.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'none';

    // Điền danh sách 38 nhạc cụ vào Select nếu chưa có
    populateInstrumentSelect('adminUploadInstSelect');

    if (currentEditingId) {
      var videos = getAllAdminVideos();
      var item = videos.find(function (v) { return v.id === currentEditingId; });
      if (item) {
        if (heading) heading.innerHTML = '<span>✏️</span> <span>Chỉnh Sửa Thông Tin Video Hướng Dẫn</span>';
        if (subtitle) subtitle.textContent = 'Cập nhật tiêu đề, nhạc cụ tương ứng, danh mục và ảnh đại diện';
        if (dropzoneLabel) dropzoneLabel.innerHTML = '<span>🎥</span> <span>Thay thế tệp video (Tùy chọn):</span>';
        if (dropzoneText) dropzoneText.innerHTML = '📁 <strong>Video đang dùng:</strong> <span style="color:#6ee7b7; font-weight:700;">' + escapeHtml(item.filename || (item.title + '.mp4')) + '</span>';
        if (dropzoneSub) dropzoneSub.textContent = 'Nhấn vào đây nếu bạn muốn chọn tệp video mới từ máy để thay thế (không bắt buộc)';

        document.getElementById('adminUploadTitle').value = item.title || '';
        document.getElementById('adminUploadDesc').value = item.description || '';
        document.getElementById('adminUploadInstSelect').value = normalizeInstrumentId(item.instrumentId || 'dantranh');
        document.getElementById('adminUploadCategorySelect').value = item.category || 'usage';
        var urlInpEdit = document.getElementById('adminUploadVideoUrl');
        if (urlInpEdit) {
          urlInpEdit.value = (item.videoUrl && /^https?:\/\//i.test(item.videoUrl)) ? item.videoUrl : '';
        }

        if (item.thumbnailUrl) {
          currentCapturedThumbDataUrl = item.thumbnailUrl;
          var imgEl = document.getElementById('adminUploadThumbImg');
          if (imgEl) imgEl.src = item.thumbnailUrl;
          if (previewWrap) previewWrap.style.display = 'flex';
        }
        if (durationText) {
          durationText.innerHTML = '⏱️ Thời lượng: <strong>' + (item.duration || '--:--') + '</strong> • 💾 Dung lượng: <strong>' + (item.fileSize || 'HD MP4') + '</strong>';
        }

        var btnSubmit = document.getElementById('btnAdminSubmitUploadText');
        if (btnSubmit) btnSubmit.textContent = '💾 Lưu Thay Đổi';
      }
    } else {
      if (heading) heading.innerHTML = '<span>➕</span> <span>Tải Lên Video Hướng Dẫn Mới</span>';
      if (subtitle) subtitle.textContent = 'Hỗ trợ video MP4, WebM, MOV; tự động trích xuất ảnh đại diện và phân loại theo 38 nhạc cụ';
      if (dropzoneLabel) dropzoneLabel.innerHTML = '<span>🎥</span> <span>Tệp Video Từ Máy Tính:</span>';
      if (dropzoneText) dropzoneText.textContent = 'Kéo thả tệp video vào đây hoặc nhấn để chọn (MP4, WebM, MOV)';
      if (dropzoneSub) dropzoneSub.textContent = 'Hệ thống hỗ trợ tệp dung lượng lớn, tự động chụp thumbnail & phân loại nhạc cụ';
      if (durationText) durationText.textContent = 'Thời lượng: Đang tính...';

      var btnSubmit = document.getElementById('btnAdminSubmitUploadText');
      if (btnSubmit) btnSubmit.textContent = '🚀 Bắt Đầu Tải Lên & Lưu Trữ';

      // Mặc định chọn cây đàn người dùng đang xem nếu có
      var urlInpNew = document.getElementById('adminUploadVideoUrl');
      if (urlInpNew) urlInpNew.value = '';
      var curInst = normalizeInstrumentId(window.currentActiveInstrument || 'dantranh');
      var selInst = document.getElementById('adminUploadInstSelect');
      if (selInst && curInst) selInst.value = curInst;
    }

    overlay.classList.add('open');
  }

  function closeAdminVideoUploadModal() {
    var overlay = document.getElementById('modalAdminVideoUpload');
    if (overlay) overlay.classList.remove('open');
    currentEditingId = null;
    currentSelectedFile = null;
  }

  function populateInstrumentSelect(selectElementId) {
    var sel = document.getElementById(selectElementId);
    if (!sel) return;

    var prevVal = sel.value;
    var optionsHtml = getInstrumentRefList().map(function (item) {
      return '<option value="' + item.id + '">' + item.icon + ' ' + item.name + '</option>';
    }).join('');

    // Ô lọc ở bảng quản trị cần giữ lựa chọn "Tất cả nhạc cụ"
    if (selectElementId === 'adminFilterInstSelect') {
      optionsHtml = '<option value="all">🌐 Tất cả nhạc cụ</option>' + optionsHtml;
    }
    sel.innerHTML = optionsHtml;
    if (prevVal) sel.value = prevVal;
  }

  // Xử lý khi Admin chọn tệp video từ máy tính
  function handleAdminVideoFileChosen(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var ext = file.name.split('.').pop().toLowerCase();
    var validExts = ['mp4', 'webm', 'mov', 'm4v'];
    if (validExts.indexOf(ext) === -1) {
      alert('⚠️ Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp video MP4, WebM hoặc MOV.');
      event.target.value = '';
      return;
    }

    currentSelectedFile = file;

    // Cập nhật nhãn dropzone
    var dropzoneText = document.getElementById('adminDropzoneText');
    if (dropzoneText) {
      dropzoneText.innerHTML = '✅ Đã chọn: <strong>' + escapeHtml(file.name) + '</strong> (' + formatFileSizeBytes(file.size) + ')';
    }

    // Tự động gợi ý tiêu đề nếu ô tiêu đề còn trống
    var titleInp = document.getElementById('adminUploadTitle');
    if (titleInp && !titleInp.value.trim()) {
      var clean = file.name.replace(/\.[^/.]+$/, '');
      titleInp.value = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    // Tự động nhận diện nhạc cụ từ tên tệp nếu có
    var instSelect = document.getElementById('adminUploadInstSelect');
    if (instSelect) {
      var fn = file.name.toLowerCase();
      var instRefList = getInstrumentRefList();
      for (var i = 0; i < instRefList.length; i++) {
        var inst = instRefList[i];
        var cleanName = inst.name.toLowerCase().replace('đàn ', '').replace('sáo ', '').replace('kèn ', '');
        if (fn.indexOf(cleanName) !== -1 || fn.indexOf(inst.id) !== -1) {
          instSelect.value = inst.id;
          break;
        }
      }
    }

    // Tự động tạo ảnh đại diện snapshot và trích xuất độ dài từ video
    var previewWrap = document.getElementById('adminUploadPreviewWrap');
    var thumbImg = document.getElementById('adminUploadThumbImg');
    var durationMeta = document.getElementById('adminUploadDurationText');

    var tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    var objUrl = URL.createObjectURL(file);
    tempVideo.src = objUrl;

    tempVideo.onloadedmetadata = function () {
      var sec = tempVideo.duration;
      if (sec && isFinite(sec) && sec > 0) {
        var durStr = formatDurationSeconds(sec);
        currentSelectedDuration = durStr;
        if (durationMeta) {
          durationMeta.textContent = 'Thời lượng: ' + durStr + ' • Kích thước: ' + formatFileSizeBytes(file.size);
        }
        tempVideo.currentTime = Math.min(1.0, sec / 2);
      } else {
        if (durationMeta) {
          durationMeta.textContent = 'Thời lượng: Đang đọc • Kích thước: ' + formatFileSizeBytes(file.size);
        }
        tempVideo.currentTime = 0.5;
      }
    };

    tempVideo.onseeked = function () {
      var snap = captureVideoThumbnail(tempVideo);
      if (snap) {
        currentCapturedThumbDataUrl = snap;
        if (thumbImg) thumbImg.src = snap;
        if (previewWrap) previewWrap.style.display = 'flex';
      }
      URL.revokeObjectURL(objUrl);
    };
  }

  // Xử lý khi Admin chọn ảnh thumbnail riêng từ máy (tự nén <= 320px để đồng bộ Cloud nhanh)
  function handleAdminCustomThumbnailChosen(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      var rawDataUrl = e.target.result;
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          var w = img.naturalWidth || 320;
          var h = img.naturalHeight || 180;
          canvas.width = Math.min(320, w);
          canvas.height = Math.round(canvas.width * (h / w)) || 180;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          currentCapturedThumbDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        } catch (err) {
          currentCapturedThumbDataUrl = rawDataUrl;
        }
        var thumbImg = document.getElementById('adminUploadThumbImg');
        if (thumbImg) thumbImg.src = currentCapturedThumbDataUrl;
        var previewWrap = document.getElementById('adminUploadPreviewWrap');
        if (previewWrap) previewWrap.style.display = 'flex';
      };
      img.onerror = function () {
        currentCapturedThumbDataUrl = rawDataUrl;
        var thumbImg = document.getElementById('adminUploadThumbImg');
        if (thumbImg) thumbImg.src = currentCapturedThumbDataUrl;
        var previewWrap = document.getElementById('adminUploadPreviewWrap');
        if (previewWrap) previewWrap.style.display = 'flex';
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  }

  var MAX_CLOUD_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB cho phép đồng bộ file nhị phân trực tiếp qua Cloud Relay

  function uploadFileToIndexedDbAndCloud(recordId, file, progressBar, progressPct, progressStatus) {
    return storeVideoBlob(recordId, file).then(function () {
      if (file.size <= MAX_CLOUD_VIDEO_BYTES && window.DanTranhCloudSync && typeof window.DanTranhCloudSync.uploadBlobToCloudChunks === 'function') {
        updateProgressUI(progressBar, progressPct, progressStatus, 10, 'Đang đẩy video lên máy chủ Cloud để phát trên mọi máy (0%)...');
        return window.DanTranhCloudSync.uploadBlobToCloudChunks(file, function (pct) {
          var scaled = Math.min(95, Math.max(10, Math.round(10 + pct * 0.85)));
          updateProgressUI(progressBar, progressPct, progressStatus, scaled, 'Đang tải video lên máy chủ Cloud (' + pct + '%)...');
        }).then(function (cloudRes) {
          updateProgressUI(progressBar, progressPct, progressStatus, 98, 'Đang hoàn tất đồng bộ danh sách lên Cloud...');
          return cloudRes;
        });
      }
      return null;
    });
  }

  // Thực thi tải lên & lưu trữ video với Progress Bar
  function handleAdminSubmitUpload(event) {
    if (event) event.preventDefault();

    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin / Quản trị viên phụ) mới có quyền tải lên video!');
      return;
    }

    var title = (document.getElementById('adminUploadTitle').value || '').trim();
    var desc = (document.getElementById('adminUploadDesc').value || '').trim();
    var instId = document.getElementById('adminUploadInstSelect').value;
    var catId = document.getElementById('adminUploadCategorySelect').value;
    var urlInpEl = document.getElementById('adminUploadVideoUrl');
    var videoUrlInpVal = urlInpEl ? (urlInpEl.value || '').trim() : '';

    if (!title) {
      alert('⚠️ Vui lòng nhập tiêu đề cho video hướng dẫn!');
      return;
    }

    if (!currentEditingId && !currentSelectedFile && !videoUrlInpVal) {
      alert('⚠️ Vui lòng chọn tệp video từ máy tính hoặc dán Link Video trực tiếp!');
      return;
    }

    var instObj = getInstrumentRefList().find(function (i) { return i.id === instId; }) || { id: 'dantranh', name: 'Đàn Tranh', icon: '🪕' };
    var catObj = ADMIN_VIDEO_CATEGORIES.find(function (c) { return c.id === catId; }) || { id: 'usage', name: 'Hướng dẫn sử dụng' };

    var progressWrap = document.getElementById('adminUploadProgressWrap');
    var progressBar = document.getElementById('adminUploadProgressBar');
    var progressStatus = document.getElementById('adminUploadProgressStatus');
    var progressPct = document.getElementById('adminUploadProgressPct');
    var btnSubmit = document.getElementById('btnAdminSubmitUpload');

    if (progressWrap) progressWrap.style.display = 'block';
    if (btnSubmit) btnSubmit.disabled = true;

    var videos = getAllAdminVideos();
    var ytId = videoUrlInpVal ? extractYouTubeId(videoUrlInpVal) : null;
    var driveId = videoUrlInpVal ? extractGoogleDriveFileId(videoUrlInpVal) : null;

    if (currentEditingId) {
      // 1. Chỉnh sửa video hiện có
      var target = videos.find(function (v) { return v.id === currentEditingId; });
      if (target) {
        target.title = title;
        target.description = desc;
        target.instrumentId = instId;
        target.instrumentName = instObj.name;
        target.instrumentIcon = instObj.icon;
        target.category = catId;
        target.categoryName = catObj.name;
        if (currentCapturedThumbDataUrl) {
          target.thumbnailUrl = currentCapturedThumbDataUrl;
          target.thumbnailChunkRef = '';
        }

        if (currentSelectedFile) {
          var editFile = currentSelectedFile;
          runUploadSimulation(editFile, function (progress) {
            updateProgressUI(progressBar, progressPct, progressStatus, Math.min(20, Math.round(progress * 0.2)), 'Đang kiểm tra tệp video (' + formatFileSizeBytes(editFile.size) + ')...');
          }, function () {
            uploadFileToIndexedDbAndCloud(target.id, editFile, progressBar, progressPct, progressStatus).then(function (cloudRes) {
              target.filename = editFile.name;
              target.fileSize = formatFileSizeBytes(editFile.size);
              target.videoUrl = 'indexeddb://' + target.id;
              target.cloudVideoRef = (cloudRes && cloudRes.ref) ? cloudRes.ref : '';
              target.isPreset = false;
              target.cloudSynced = false;
              if (currentSelectedDuration) target.duration = currentSelectedDuration;

              var note = (editFile.size > MAX_CLOUD_VIDEO_BYTES)
                ? '⚠️ Video > 15MB đã cập nhật trên máy và đồng bộ tiêu đề lên Cloud (muốn phát mọi máy vui lòng dán link YouTube/Drive).'
                : ((target.cloudVideoRef) ? '✓ Đã cập nhật và đồng bộ video lên Cloud Server thành công!' : '⚠️ Không đẩy được tệp lên Cloud Relay; đã lưu cục bộ.');
              finishSaveAndRefresh(videos, note);
            });
          });
        } else if (videoUrlInpVal) {
          target.videoUrl = videoUrlInpVal;
          target.cloudVideoRef = '';
          target.filename = ytId ? 'YouTube Video' : (driveId ? 'Google Drive Video' : 'Link URL');
          target.fileSize = 'Trực tuyến (URL)';
          if (ytId && !target.thumbnailUrl) {
            target.thumbnailUrl = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
          }
          target.cloudSynced = false;
          updateProgressUI(progressBar, progressPct, progressStatus, 95, 'Đang đồng bộ liên kết lên Cloud Server...');
          finishSaveAndRefresh(videos, '✓ Đã cập nhật liên kết video & đồng bộ đa thiết bị!');
        } else {
          target.cloudSynced = false;
          updateProgressUI(progressBar, progressPct, progressStatus, 95, 'Đang đồng bộ thông tin lên Cloud Server...');
          finishSaveAndRefresh(videos, '✓ Đã cập nhật thông tin video thành công!');
        }
      }
    } else if (currentSelectedFile) {
      // 2A. Thêm video mới từ tệp máy tính
      var newId = 'vid_admin_' + Date.now();
      var file = currentSelectedFile;

      runUploadSimulation(file, function (progress) {
        updateProgressUI(progressBar, progressPct, progressStatus, Math.min(20, Math.round(progress * 0.2)), 'Đang chuẩn bị tải video (' + formatFileSizeBytes(file.size) + ')...');
      }, function () {
        uploadFileToIndexedDbAndCloud(newId, file, progressBar, progressPct, progressStatus).then(function (cloudRes) {
          var newRecord = {
            id: newId,
            title: title,
            description: desc,
            filename: file.name,
            videoUrl: 'indexeddb://' + newId,
            cloudVideoRef: (cloudRes && cloudRes.ref) ? cloudRes.ref : '',
            thumbnailUrl: currentCapturedThumbDataUrl,
            instrumentId: instId,
            instrumentName: instObj.name,
            instrumentIcon: instObj.icon,
            category: catId,
            categoryName: catObj.name,
            duration: currentSelectedDuration || '--:--',
            fileSize: formatFileSizeBytes(file.size),
            views: 1,
            uploadDate: new Date().toISOString().slice(0, 10),
            isPreset: false,
            cloudSynced: false
          };

          videos.unshift(newRecord);
          var note = (file.size > MAX_CLOUD_VIDEO_BYTES)
            ? '⚠️ Tệp > 15MB đã lưu cục bộ và đồng bộ thẻ video lên Cloud (dán thêm Link URL để phát trên máy khác).'
            : (newRecord.cloudVideoRef ? '✓ Đã tải lên và đồng bộ video lên Cloud Server thành công!' : '⚠️ Không đẩy được tệp lên Cloud Relay; đã lưu cục bộ.');
          finishSaveAndRefresh(videos, note);
        });
      });
    } else {
      // 2B. Thêm video mới từ Link URL (YouTube / Google Drive / MP4 URL)
      var newUrlId = 'vid_admin_' + Date.now();
      var autoThumb = currentCapturedThumbDataUrl || (ytId ? ('https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg') : '');
      var newUrlRecord = {
        id: newUrlId,
        title: title,
        description: desc,
        filename: ytId ? 'YouTube Video' : (driveId ? 'Google Drive Video' : 'Link Video'),
        videoUrl: videoUrlInpVal,
        cloudVideoRef: '',
        thumbnailUrl: autoThumb,
        instrumentId: instId,
        instrumentName: instObj.name,
        instrumentIcon: instObj.icon,
        category: catId,
        categoryName: catObj.name,
        duration: currentSelectedDuration || (ytId ? 'YouTube' : 'Online'),
        fileSize: 'Trực tuyến (URL)',
        views: 1,
        uploadDate: new Date().toISOString().slice(0, 10),
        isPreset: false,
        cloudSynced: false
      };
      videos.unshift(newUrlRecord);
      updateProgressUI(progressBar, progressPct, progressStatus, 90, 'Đang đồng bộ liên kết lên Cloud Server...');
      finishSaveAndRefresh(videos, '✓ Đã đăng video trực tuyến và đồng bộ đa thiết bị!');
    }
  }

  function updateProgressUI(bar, pctLabel, statusLabel, pct, text) {
    if (bar) bar.style.width = pct + '%';
    if (pctLabel) pctLabel.textContent = pct + '%';
    if (statusLabel) statusLabel.textContent = text;
  }

  function runUploadSimulation(file, onProgress, onComplete) {
    // Đọc tệp thật bằng FileReader để bảo đảm tính tương thích và kiểm tra file
    var reader = new FileReader();
    reader.onprogress = function (e) {
      if (e.lengthComputable) {
        var pct = Math.min(95, Math.round((e.loaded / e.total) * 95));
        onProgress(pct);
      }
    };
    reader.onload = function () {
      onProgress(100);
      setTimeout(onComplete, 180);
    };
    reader.onerror = function () {
      alert('❌ Đã xảy ra lỗi khi đọc tệp video. Vui lòng thử lại với tệp khác.');
      var btnSubmit = document.getElementById('btnAdminSubmitUpload');
      if (btnSubmit) btnSubmit.disabled = false;
      var progressWrap = document.getElementById('adminUploadProgressWrap');
      if (progressWrap) progressWrap.style.display = 'none';
    };
    // Đọc 1 phần nhỏ hoặc toàn bộ blob để verify tệp an toàn
    var slice = file.slice(0, Math.min(file.size, 5 * 1024 * 1024));
    reader.readAsArrayBuffer(slice);
  }

  function finishSaveAndRefresh(videosList, successMessage) {
    var progressBar = document.getElementById('adminUploadProgressBar');
    var progressPct = document.getElementById('adminUploadProgressPct');
    var progressStatus = document.getElementById('adminUploadProgressStatus');

    saveAllAdminVideos(videosList).then(function (syncRes) {
      updateProgressUI(progressBar, progressPct, progressStatus, 100, (syncRes && syncRes.ok === false) ? 'Đã lưu cục bộ (lỗi đồng bộ Cloud)' : 'Hoàn tất đồng bộ Cloud!');
      setTimeout(function () {
        closeAdminVideoUploadModal();
        renderAdminVideoTable();
        renderPublicInstrumentVideos();

        var btnSubmit = document.getElementById('btnAdminSubmitUpload');
        if (btnSubmit) btnSubmit.disabled = false;

        if (syncRes && syncRes.ok === false) {
          var errMsg = '⚠️ Video đã lưu trên máy nhưng đồng bộ lên máy chủ Cloud Relay thất bại' + (syncRes.error ? (': ' + syncRes.error) : '.') + '\n\nBạn có thể mở mục Cloud & Realtime → Đồng bộ ngay để thử đẩy lại.';
          alert(errMsg);
        } else if (typeof window.showActionToast === 'function') {
          window.showActionToast(successMessage);
        } else {
          alert(successMessage);
        }
      }, 250);
    });
  }

  // Xóa video (lưu vào danh sách đã xóa để đồng bộ xóa trên mọi máy)
  function deleteAdminVideo(videoId) {
    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin / Quản trị viên phụ) mới có quyền xóa video!');
      return;
    }

    var videos = getAllAdminVideos();
    var target = videos.find(function (v) { return v.id === videoId; });
    if (!target) return;

    if (!confirm('Bạn có chắc chắn muốn xóa video:\n"' + target.title + '"\nkhỏi hệ thống quản trị và Server không?')) {
      return;
    }

    try {
      var delIds = JSON.parse(localStorage.getItem('dan_tranh_hdnc_deleted_ids_v1') || '[]') || [];
      if (delIds.indexOf(videoId) === -1) {
        delIds.push(videoId);
        localStorage.setItem('dan_tranh_hdnc_deleted_ids_v1', JSON.stringify(delIds));
      }
    } catch (e) {}

    deleteVideoBlob(videoId).then(function () {
      var filtered = videos.filter(function (v) { return v.id !== videoId; });
      saveAllAdminVideos(filtered).then(function () {
        renderAdminVideoTable();
        renderPublicInstrumentVideos();

        if (typeof window.showActionToast === 'function') {
          window.showActionToast('✓ Đã xóa video và đồng bộ lên Cloud!');
        }
      });
    });
  }

  // Tự động đồng bộ các video Admin đã đăng trước đây (khi còn lưu cục bộ chưa đẩy được lên Cloud)
  function autoSyncUnsyncedLocalVideosToCloud() {
    if (!window.DanTranhCloudSync || typeof window.DanTranhCloudSync.syncHdncVideosToCloud !== 'function') return;
    var localVids = getAllAdminVideos();
    if (!localVids.length) return;

    var dirty = localVids.some(function (v) {
      return v && (!v.cloudSynced || (v.videoUrl && v.videoUrl.indexOf('indexeddb://') === 0 && !v.cloudVideoRef));
    });
    if (!dirty) return;

    var chain = Promise.resolve();
    localVids.forEach(function (v) {
      if (!v) return;
      if (v.videoUrl && v.videoUrl.indexOf('indexeddb://') === 0 && !v.cloudVideoRef && typeof window.DanTranhCloudSync.uploadBlobToCloudChunks === 'function') {
        var blobId = v.videoUrl.replace('indexeddb://', '');
        chain = chain.then(function () {
          return getVideoBlob(blobId).then(function (blob) {
            if (blob && blob.size <= MAX_CLOUD_VIDEO_BYTES) {
              return window.DanTranhCloudSync.uploadBlobToCloudChunks(blob).then(function (res) {
                if (res && res.ref) v.cloudVideoRef = res.ref;
              });
            }
          });
        });
      }
    });

    chain.then(function () {
      saveAllAdminVideos(localVids).then(function (syncRes) {
        if (syncRes && syncRes.ok) {
          renderAdminVideoTable();
          renderPublicInstrumentVideos();
        }
      });
    });
  }

  // =========================================================================
  // 10. PREVIEW PLAYER DÀNH CHO ADMIN & NGƯỜI DÙNG (HỖ TRỢ YOUTUBE / DRIVE / CLOUD CHUNKS)
  // =========================================================================
  function resetPreviewPlayersState() {
    var player = document.getElementById('adminPreviewVideoPlayer');
    var iframeEl = document.getElementById('adminPreviewIframePlayer');
    var loader = document.getElementById('adminPreviewCloudLoader');
    var loaderBar = document.getElementById('adminPreviewCloudLoaderBar');
    var loaderText = document.getElementById('adminPreviewCloudLoaderText');

    if (player) {
      player.pause();
      player.src = '';
      player.style.display = 'block';
    }
    if (iframeEl) {
      iframeEl.src = 'about:blank';
      iframeEl.style.display = 'none';
    }
    if (loader) loader.style.display = 'none';
    if (loaderBar) loaderBar.style.width = '0%';
    if (loaderText) loaderText.textContent = 'Đang tải video từ Cloud Server...';
  }

  function openAdminVideoPreview(videoId) {
    var videos = getAllAdminVideos();
    var video = videos.find(function (v) { return v.id === videoId; });
    if (!video) return;

    var overlay = document.getElementById('modalAdminVideoPreview');
    var player = document.getElementById('adminPreviewVideoPlayer');
    var iframeEl = document.getElementById('adminPreviewIframePlayer');
    var loader = document.getElementById('adminPreviewCloudLoader');
    var loaderBar = document.getElementById('adminPreviewCloudLoaderBar');
    var loaderText = document.getElementById('adminPreviewCloudLoaderText');
    var titleEl = document.getElementById('adminPreviewTitle');
    var subtitleEl = document.getElementById('adminPreviewSubtitle');
    var badgeInstEl = document.getElementById('adminPreviewInstBadge');
    var badgeCatEl = document.getElementById('adminPreviewCatBadge');
    var durationEl = document.getElementById('adminPreviewDurationBadge');
    var storageEl = document.getElementById('adminPreviewStorageBadge');
    var descEl = document.getElementById('adminPreviewDesc');

    if (!overlay || !player) return;

    resetPreviewPlayersState();

    // TÊN Ở TRÊN (Title on top in modal header)
    if (titleEl) {
      titleEl.textContent = video.title || 'Xem Thử Video';
      titleEl.title = video.title || '';
    }
    if (subtitleEl) {
      subtitleEl.textContent = (video.instrumentName ? ('Nhạc cụ: ' + video.instrumentName + ' • ') : '') + (video.categoryName || 'Video Hướng Dẫn Diễn Tấu');
    }

    var ytId = video.videoUrl ? extractYouTubeId(video.videoUrl) : null;
    var driveId = video.videoUrl ? extractGoogleDriveFileId(video.videoUrl) : null;

    // THÔNG TIN Ở DƯỚI (Information underneath video player)
    if (badgeInstEl) {
      badgeInstEl.innerHTML = (video.instrumentIcon || '🪕') + ' ' + (video.instrumentName || 'Nhạc cụ');
    }
    if (badgeCatEl) {
      badgeCatEl.textContent = video.categoryName || 'Hướng dẫn';
      badgeCatEl.className = 'admin-cat-badge admin-badge-cat-' + (video.category || 'usage');
    }
    if (durationEl) {
      durationEl.innerHTML = '⏱️ <strong>' + (video.duration || '--:--') + '</strong>' + (video.fileSize ? (' • 💾 ' + video.fileSize) : '');
    }
    if (storageEl) {
      if (ytId) storageEl.innerHTML = '🌐 YouTube';
      else if (driveId) storageEl.innerHTML = '📁 Google Drive';
      else if (video.cloudVideoRef) storageEl.innerHTML = '☁️ Cloud Server';
      else if (video.videoUrl && /^https?:\/\//i.test(video.videoUrl)) storageEl.innerHTML = '🌐 Cloud URL';
      else storageEl.innerHTML = '💾 Lưu cục bộ';
    }
    if (descEl) {
      descEl.textContent = video.description || 'Chưa có mô tả chi tiết cho video này.';
    }

    if (ytId && iframeEl) {
      player.style.display = 'none';
      iframeEl.style.display = 'block';
      iframeEl.src = 'https://www.youtube.com/embed/' + encodeURIComponent(ytId) + '?autoplay=1&rel=0';
      overlay.classList.add('open');
      return;
    }

    if (driveId && iframeEl) {
      player.style.display = 'none';
      iframeEl.style.display = 'block';
      iframeEl.src = 'https://drive.google.com/file/d/' + encodeURIComponent(driveId) + '/preview';
      overlay.classList.add('open');
      return;
    }

    if (video.videoUrl && video.videoUrl.indexOf('indexeddb://') === 0) {
      var blobId = video.videoUrl.replace('indexeddb://', '');
      overlay.classList.add('open');
      getVideoBlob(blobId).then(function (blob) {
        if (blob) {
          player.src = URL.createObjectURL(blob);
          player.load();
          try { player.play().catch(function () {}); } catch (e) {}
          return;
        }
        // Không có trong IndexedDB máy hiện tại (mở từ máy khác) -> tải từ Cloud Relay nếu có cloudVideoRef
        if (video.cloudVideoRef && window.DanTranhCloudSync && typeof window.DanTranhCloudSync.downloadBlobFromCloudChunks === 'function') {
          if (loader) loader.style.display = 'flex';
          if (loaderText) loaderText.textContent = '⏳ Đang tải video từ Cloud Server (0%)...';
          window.DanTranhCloudSync.downloadBlobFromCloudChunks(video.cloudVideoRef, function (pct) {
            if (loaderBar) loaderBar.style.width = pct + '%';
            if (loaderText) loaderText.textContent = '⏳ Đang tải video từ Cloud Server (' + pct + '%)...';
          }).then(function (downloadedBlob) {
            if (downloadedBlob) {
              storeVideoBlob(blobId, downloadedBlob);
              if (loader) loader.style.display = 'none';
              player.src = URL.createObjectURL(downloadedBlob);
              player.load();
              try { player.play().catch(function () {}); } catch (e) {}
            } else {
              if (loaderText) loaderText.textContent = '⚠️ Lỗi tải video từ Cloud Server. Vui lòng thử lại sau.';
            }
          });
        } else {
          if (loader) loader.style.display = 'flex';
          if (loaderText) loaderText.textContent = '⚠️ Video này (>15MB) hiện chỉ lưu trên máy Admin gốc hoặc chưa được gắn Link URL phát trực tuyến.';
        }
      });
    } else if (video.videoUrl) {
      var url = video.videoUrl;
      if (url.indexOf('%') === -1) url = encodeURI(url);
      player.src = url;
      player.load();
      overlay.classList.add('open');
      try { player.play().catch(function () {}); } catch (e) {}
    }
  }

  function closeAdminVideoPreview() {
    var overlay = document.getElementById('modalAdminVideoPreview');
    resetPreviewPlayersState();
    if (overlay) overlay.classList.remove('open');
  }

  // =========================================================================
  // 11. BỘ LỌC BẢNG QUẢN TRỊ ADMIN (FILTER ACTIONS)
  // =========================================================================
  function filterAdminVideosByInstrument(instId) {
    adminFilterInst = instId || 'all';
    renderAdminVideoTable();
  }

  function filterAdminVideosByCategory(catId) {
    adminFilterCat = catId || 'all';
    renderAdminVideoTable();
  }

  function searchAdminVideos(query) {
    adminSearchQuery = String(query || '').trim();
    renderAdminVideoTable();
  }

  function resetAdminVideoFilters() {
    adminFilterInst = 'all';
    adminFilterCat = 'all';
    adminSearchQuery = '';

    var selInst = document.getElementById('adminFilterInstSelect');
    if (selInst) selInst.value = 'all';

    var selCat = document.getElementById('adminFilterCatSelect');
    if (selCat) selCat.value = 'all';

    var inp = document.getElementById('adminSearchInput');
    if (inp) inp.value = '';

    renderAdminVideoTable();
  }

  // =========================================================================
  // 11B. KHO VIDEO TRONG TAB CHƠI NHẠC CỤ (#sectionHdncTutorials)
  // Chỉ hiện video ĐÃ ĐĂNG (Admin thêm ở Video Manager) của đúng nhạc cụ đang chọn.
  // Nhạc cụ chưa có video nào được đăng -> hiện thông báo "đang cố gắng thêm video".
  // =========================================================================
  var INSTRUMENT_ID_ALIASES = { dantiba: 'dantyba', chapi: 'danchapi' };

  function normalizeInstrumentId(id) {
    var key = String(id || '').trim();
    return INSTRUMENT_ID_ALIASES[key] || key;
  }

  function getInstrumentMeta(instId) {
    var id = normalizeInstrumentId(instId);
    var found = getInstrumentRefList().find(function (i) { return i.id === id; });
    return found || { id: id, name: 'Nhạc cụ', icon: '🪕' };
  }

  function getPublishedVideosForInstrument(instId) {
    var id = normalizeInstrumentId(instId);
    return getAllAdminVideos().filter(function (v) {
      if (v.isPreset) return false; // Video mẫu có sẵn trong danh sách nhưng chưa được đăng
      return normalizeInstrumentId(v.instrumentId) === id;
    });
  }

  function renderPublicInstrumentVideos(instIdArg) {
    var grid = document.getElementById('hdncVideoGrid');
    if (!grid) return;

    var uploadBtn = document.getElementById('btnPublicHdncUpload');
    if (uploadBtn) {
      uploadBtn.style.display = checkAdminPermission() ? 'inline-flex' : 'none';
    }

    var activeId = normalizeInstrumentId(instIdArg || window.currentActiveInstrument || 'dantranh');
    var meta = getInstrumentMeta(activeId);
    var videos = getPublishedVideosForInstrument(activeId);

    var titleEl = document.getElementById('hdncSectionTitle');
    if (titleEl) titleEl.textContent = 'VIDEO HƯỚNG DẪN • ' + String(meta.name).toUpperCase();
    var subEl = document.getElementById('hdncSectionSubtitle');
    if (subEl) {
      subEl.textContent = videos.length
        ? (videos.length + ' video hướng dẫn & diễn tấu của ' + meta.name)
        : ('Video hướng dẫn & diễn tấu của ' + meta.name);
    }

    if (videos.length === 0) {
      grid.innerHTML = [
        '<div style="grid-column: 1 / -1; text-align: center; padding: 44px 20px; background: rgba(0, 0, 0, 0.28); border: 1px dashed rgba(239, 196, 123, 0.3); border-radius: 16px; color: #d8cbb8;">',
        '  <div style="font-size: 36px; margin-bottom: 10px;">🎬</div>',
        '  <div style="font-size: 15.5px; font-weight: 700; color: #ffea9f; line-height: 1.5;">Đội ngũ tôi đang cố gắng thêm vid của nhạc cụ này nhanh nhất có thể</div>',
        '</div>'
      ].join('');
      return;
    }

    grid.innerHTML = videos.map(function (v) {
      var catObj = ADMIN_VIDEO_CATEGORIES.find(function (c) { return c.id === v.category; });
      var catName = catObj ? catObj.name : (v.categoryName || 'Hướng dẫn');
      var instLabel = v.instrumentName || meta.name;
      var iconLabel = v.instrumentIcon || meta.icon;

      var mediaHtml = '';
      var ytThumbId = v.videoUrl ? extractYouTubeId(v.videoUrl) : null;
      var effectiveThumb = v.thumbnailUrl || (ytThumbId ? ('https://img.youtube.com/vi/' + ytThumbId + '/hqdefault.jpg') : '');
      if (effectiveThumb) {
        mediaHtml = '<img class="hdnc-yt-thumb-media" src="' + escapeHtml(effectiveThumb) + '" alt="' + escapeHtml(v.title) + '" style="opacity: 0; transition: opacity 0.25s ease;" onload="this.style.opacity=\'1\'" onerror="this.style.display=\'none\'" />';
      } else if (v.videoUrl && v.videoUrl.indexOf('indexeddb://') !== 0 && !ytThumbId && !extractGoogleDriveFileId(v.videoUrl)) {
        var safeUrl = (v.videoUrl.indexOf('%') === -1) ? encodeURI(v.videoUrl) : v.videoUrl;
        mediaHtml = '<video class="hdnc-yt-thumb-media" src="' + escapeHtml(safeUrl) + '" preload="metadata" muted playsinline style="opacity: 0; transition: opacity 0.25s ease;" onloadeddata="try{this.currentTime=Math.min(1.5,(this.duration||3)*0.25);}catch(e){this.style.opacity=\'1\';}" onseeked="this.style.opacity=\'1\'" onerror="this.style.display=\'none\'"></video>';
      }

      return [
        '<article class="hdnc-yt-card" onclick="openAdminVideoPreview(\'' + escapeHtml(v.id) + '\')" title="' + escapeHtml(v.title) + '">',
        '  <div class="hdnc-yt-thumb-frame">',
        '    <div class="hdnc-yt-fallback-art">',
        '      <div class="hdnc-yt-fallback-left">',
        '        <div class="hdnc-yt-fallback-brand"><span>🎵 HERITUNE</span> <span>•</span> <span>VIDEO</span></div>',
        '        <div class="hdnc-yt-fallback-heading">' + escapeHtml(instLabel) + '</div>',
        '        <div class="hdnc-yt-fallback-tags">',
        '          <span class="hdnc-yt-fallback-tag">' + escapeHtml(iconLabel) + ' ' + escapeHtml(instLabel) + '</span>',
        '          <span class="hdnc-yt-fallback-tag">' + escapeHtml(catName) + '</span>',
        '        </div>',
        '      </div>',
        '      <div class="hdnc-yt-fallback-right">',
        '        <span class="hdnc-yt-fallback-icon">' + escapeHtml(iconLabel) + '</span>',
        '      </div>',
        '    </div>',
             mediaHtml,
        '    <div class="hdnc-yt-play-hover"><div class="hdnc-yt-play-circle">▶</div></div>',
        '    <span class="hdnc-yt-duration-badge">' + escapeHtml(v.duration || '--:--') + '</span>',
        '  </div>',
        '  <div class="hdnc-yt-card-info">',
        '    <div class="hdnc-yt-card-title">' + escapeHtml(v.title) + '</div>',
        '    <div class="hdnc-yt-card-meta">',
        '      <span>' + escapeHtml(iconLabel) + ' ' + escapeHtml(instLabel) + '</span>',
        '      <span>•</span>',
        '      <span>' + escapeHtml(catName) + '</span>',
        '    </div>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function scrollToHdncSection() {
    renderPublicInstrumentVideos();
    var section = document.getElementById('sectionHdncTutorials');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function syncHdncWithCurrentStageInstrument() {
    scrollToHdncSection();
  }

  // =========================================================================
  // 12. KHỞI TẠO VÀ XUẤT CÁC HÀM TOÀN CỤC
  // =========================================================================
  function initAdminVideos() {
    // Điền dữ liệu vào các thẻ chọn bộ lọc nếu có
    populateInstrumentSelect('adminFilterInstSelect');
    populateInstrumentSelect('adminUploadInstSelect');

    renderAdminVideoTable();
    renderPublicInstrumentVideos();

    // Đẩy tự động các video cục bộ cũ (nếu có) lên Cloud Relay để máy khác nhìn thấy ngay
    setTimeout(autoSyncUnsyncedLocalVideosToCloud, 1200);

    // Lắng nghe phím ESC để đóng Modal
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAdminVideoUploadModal();
        closeAdminVideoPreview();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminVideos);
  } else {
    initAdminVideos();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Xuất API toàn cục
  window.DanTranhAdminVideos = {
    getAllVideos: getAllAdminVideos,
    saveAllVideos: saveAllAdminVideos,
    renderAdminVideoTable: renderAdminVideoTable,
    renderPublicInstrumentVideos: renderPublicInstrumentVideos,
    openUploadModal: openAdminVideoUploadModal,
    closeUploadModal: closeAdminVideoUploadModal,
    openPreview: openAdminVideoPreview,
    closePreview: closeAdminVideoPreview,
    handleFileChosen: handleAdminVideoFileChosen,
    handleCustomThumbnailChosen: handleAdminCustomThumbnailChosen,
    handleSubmitUpload: handleAdminSubmitUpload,
    deleteVideo: deleteAdminVideo,
    filterByInstrument: filterAdminVideosByInstrument,
    filterByCategory: filterAdminVideosByCategory,
    search: searchAdminVideos,
    resetFilters: resetAdminVideoFilters,
    syncUnsyncedToCloud: autoSyncUnsyncedLocalVideosToCloud,
    checkAdminPermission: checkAdminPermission
  };

  // Expose convenient global helpers for inline HTML event handlers
  window.openAdminVideoUploadModal = openAdminVideoUploadModal;
  window.closeAdminVideoUploadModal = closeAdminVideoUploadModal;
  window.openAdminVideoPreview = openAdminVideoPreview;
  window.closeAdminVideoPreview = closeAdminVideoPreview;
  window.handleAdminVideoFileChosen = handleAdminVideoFileChosen;
  window.handleAdminCustomThumbnailChosen = handleAdminCustomThumbnailChosen;
  window.handleAdminVideoUrlChanged = handleAdminVideoUrlChanged;
  window.handleAdminSubmitUpload = handleAdminSubmitUpload;
  window.deleteAdminVideo = deleteAdminVideo;
  window.filterAdminVideosByInstrument = filterAdminVideosByInstrument;
  window.filterAdminVideosByCategory = filterAdminVideosByCategory;
  window.searchAdminVideos = searchAdminVideos;
  window.resetAdminVideoFilters = resetAdminVideoFilters;

  window.renderPublicInstrumentVideos = renderPublicInstrumentVideos;
  window.syncHdncWithCurrentStageInstrument = syncHdncWithCurrentStageInstrument;
  window.scrollToHdncSection = scrollToHdncSection;
  window.openHdncUploadModal = openAdminVideoUploadModal;

  // Giữ lại các hook cũ để không gây lỗi nếu có code gọi DanTranhVideoHdnc
  window.DanTranhVideoHdnc = {
    getAllVideos: getAllAdminVideos,
    renderGrid: renderPublicInstrumentVideos
  };

})(window);
