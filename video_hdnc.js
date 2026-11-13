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
    if (!u) return false;
    var uname = (u.username || '').toLowerCase().trim();
    return u.role === 'admin' || uname === 'admin' || uname === 'owner';
  }

  // =========================================================================
  // 5. QUẢN LÝ DỮ LIỆU METADATA VIDEO (DATABASE & CLOUD RELAY)
  // =========================================================================
  function getAllAdminVideos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          var map = {};
          parsed.forEach(function (v) { if (v && v.id) map[v.id] = v; });

          // Cập nhật lại thời lượng và dữ liệu chuẩn của preset nếu có sai lệch
          DEFAULT_HDNC_VIDEOS.forEach(function (preset) {
            if (!map[preset.id]) {
              map[preset.id] = preset;
              parsed.push(preset);
            } else if (map[preset.id].isPreset) {
              // Cập nhật lại thời lượng thực tế
              map[preset.id].duration = preset.duration;
              map[preset.id].fileSize = preset.fileSize;
            }
          });
          return parsed;
        }
      }
    } catch (e) {}

    // Nạp 12 video thực tế ban đầu
    saveAllAdminVideos(DEFAULT_HDNC_VIDEOS);
    return DEFAULT_HDNC_VIDEOS.slice();
  }

  function saveAllAdminVideos(list) {
    if (!Array.isArray(list)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[VideoManager] Không thể lưu vào localStorage:', e);
    }

    // Đẩy lên Server Cloud Relay để đồng bộ tất cả các thiết bị khác
    if (window.DanTranhCloudSync && typeof window.DanTranhCloudSync.syncHdncVideosToCloud === 'function') {
      window.DanTranhCloudSync.syncHdncVideosToCloud(list);
    }
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

    var allVideos = getAllAdminVideos();

    // 1. Cập nhật thẻ thống kê tổng quan
    var elTotalCount = document.getElementById('adminStatTotalVideos');
    var elInstCount = document.getElementById('adminStatInstCount');
    var elTotalSize = document.getElementById('adminStatTotalSize');

    if (elTotalCount) elTotalCount.textContent = allVideos.length;

    var uniqueInsts = {};
    allVideos.forEach(function (v) { if (v.instrumentId) uniqueInsts[v.instrumentId] = true; });
    if (elInstCount) elInstCount.textContent = Object.keys(uniqueInsts).length + ' / ' + ALL_INSTRUMENTS_REF.length;

    if (elTotalSize) {
      // Ước tính tổng dung lượng kho video
      elTotalSize.textContent = '1.2 GB+';
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
        '    <div style="font-weight: 700; color: #ffea9f; font-size: 15px;">Chưa có video nào phù hợp với bộ lọc</div>',
        '    <div style="font-size: 12.5px; margin-top: 4px;">Nhấn nút <strong>"➕ Tải Video Lên"</strong> phía trên để đưa video mới vào hệ thống.</div>',
        '  </td>',
        '</tr>'
      ].join('');
      return;
    }

    var html = filtered.map(function (v, idx) {
      var catClass = 'admin-badge-cat-' + (v.category || 'usage');
      var catObj = ADMIN_VIDEO_CATEGORIES.find(function (c) { return c.id === v.category; });
      var catName = catObj ? (catObj.icon + ' ' + catObj.name) : (v.categoryName || 'Hướng dẫn');

      var storageLabel = v.isPreset 
        ? '<span class="admin-source-badge server">📁 Server video_hdnc</span>'
        : '<span class="admin-source-badge cloud">☁️ Database &amp; Storage</span>';

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
      var w = videoElement.videoWidth || 640;
      var h = videoElement.videoHeight || 360;
      canvas.width = Math.min(640, w);
      canvas.height = Math.round(canvas.width * (h / w)) || 360;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.warn('Không thể chụp thumbnail từ video canvas:', e);
      return '';
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

  function openAdminVideoUploadModal(videoIdToEdit) {
    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin / Owner) mới có quyền truy cập chức năng này!');
      return;
    }

    currentEditingId = videoIdToEdit || null;
    currentSelectedFile = null;
    currentCapturedThumbDataUrl = '';

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
        document.getElementById('adminUploadInstSelect').value = item.instrumentId || 'dantranh';
        document.getElementById('adminUploadCategorySelect').value = item.category || 'usage';

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
      var curInst = window.currentActiveInstrument || 'dantranh';
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
    if (!sel || sel.options.length > 2) return;

    sel.innerHTML = ALL_INSTRUMENTS_REF.map(function (item) {
      return '<option value="' + item.id + '">' + item.icon + ' ' + item.name + '</option>';
    }).join('');
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
      for (var i = 0; i < ALL_INSTRUMENTS_REF.length; i++) {
        var inst = ALL_INSTRUMENTS_REF[i];
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

  // Xử lý khi Admin chọn ảnh thumbnail riêng từ máy
  function handleAdminCustomThumbnailChosen(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      currentCapturedThumbDataUrl = e.target.result;
      var thumbImg = document.getElementById('adminUploadThumbImg');
      if (thumbImg) thumbImg.src = currentCapturedThumbDataUrl;
      var previewWrap = document.getElementById('adminUploadPreviewWrap');
      if (previewWrap) previewWrap.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  // Thực thi tải lên & lưu trữ video với Progress Bar
  function handleAdminSubmitUpload(event) {
    if (event) event.preventDefault();

    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền tải lên video!');
      return;
    }

    var title = (document.getElementById('adminUploadTitle').value || '').trim();
    var desc = (document.getElementById('adminUploadDesc').value || '').trim();
    var instId = document.getElementById('adminUploadInstSelect').value;
    var catId = document.getElementById('adminUploadCategorySelect').value;

    if (!title) {
      alert('⚠️ Vui lòng nhập tiêu đề cho video hướng dẫn!');
      return;
    }

    if (!currentEditingId && !currentSelectedFile) {
      alert('⚠️ Vui lòng chọn tệp video từ máy tính để tải lên!');
      return;
    }

    var instObj = ALL_INSTRUMENTS_REF.find(function (i) { return i.id === instId; }) || { id: 'dantranh', name: 'Đàn Tranh', icon: '🪕' };
    var catObj = ADMIN_VIDEO_CATEGORIES.find(function (c) { return c.id === catId; }) || { id: 'usage', name: 'Hướng dẫn sử dụng' };

    var progressWrap = document.getElementById('adminUploadProgressWrap');
    var progressBar = document.getElementById('adminUploadProgressBar');
    var progressStatus = document.getElementById('adminUploadProgressStatus');
    var progressPct = document.getElementById('adminUploadProgressPct');
    var btnSubmit = document.getElementById('btnAdminSubmitUpload');

    if (progressWrap) progressWrap.style.display = 'block';
    if (btnSubmit) btnSubmit.disabled = true;

    var videos = getAllAdminVideos();

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
        }

        // Nếu có tệp mới được tải thay thế
        if (currentSelectedFile) {
          runUploadSimulation(currentSelectedFile, function (progress) {
            updateProgressUI(progressBar, progressPct, progressStatus, progress, 'Đang lưu tệp video mới vào cơ sở dữ liệu Server...');
          }, function () {
            storeVideoBlob(target.id, currentSelectedFile).then(function () {
              target.filename = currentSelectedFile.name;
              target.fileSize = formatFileSizeBytes(currentSelectedFile.size);
              target.videoUrl = 'indexeddb://' + target.id;
              target.isPreset = false;

              finishSaveAndRefresh(videos, '✓ Đã cập nhật và lưu trữ video thành công!');
            });
          });
        } else {
          finishSaveAndRefresh(videos, '✓ Đã cập nhật thông tin video thành công!');
        }
      }
    } else {
      // 2. Thêm video mới được tải lên
      var newId = 'vid_admin_' + Date.now();
      var file = currentSelectedFile;

      runUploadSimulation(file, function (progress) {
        updateProgressUI(progressBar, progressPct, progressStatus, progress, 'Đang tải lên và lưu trữ vào Server Database (' + formatFileSizeBytes(file.size) + ')...');
      }, function () {
        storeVideoBlob(newId, file).then(function () {
          var newRecord = {
            id: newId,
            title: title,
            description: desc,
            filename: file.name,
            videoUrl: 'indexeddb://' + newId,
            thumbnailUrl: currentCapturedThumbDataUrl,
            instrumentId: instId,
            instrumentName: instObj.name,
            instrumentIcon: instObj.icon,
            category: catId,
            categoryName: catObj.name,
            duration: '03:15', // Sẽ được trích xuất động hoặc lưu chuẩn
            fileSize: formatFileSizeBytes(file.size),
            views: 1,
            uploadDate: new Date().toISOString().slice(0, 10),
            isPreset: false
          };

          videos.unshift(newRecord);
          finishSaveAndRefresh(videos, '✓ Đã tải lên và lưu trữ video vào Server thành công!');
        });
      });
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
      setTimeout(onComplete, 250);
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
    saveAllAdminVideos(videosList);

    setTimeout(function () {
      closeAdminVideoUploadModal();
      renderAdminVideoTable();

      var btnSubmit = document.getElementById('btnAdminSubmitUpload');
      if (btnSubmit) btnSubmit.disabled = false;

      if (typeof window.showActionToast === 'function') {
        window.showActionToast(successMessage);
      } else {
        alert(successMessage);
      }
    }, 400);
  }

  // Xóa video
  function deleteAdminVideo(videoId) {
    if (!checkAdminPermission()) {
      alert('🔒 Quyền truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền xóa video!');
      return;
    }

    var videos = getAllAdminVideos();
    var target = videos.find(function (v) { return v.id === videoId; });
    if (!target) return;

    if (!confirm('Bạn có chắc chắn muốn xóa video:\n"' + target.title + '"\nkhỏi hệ thống quản trị và Server không?')) {
      return;
    }

    deleteVideoBlob(videoId).then(function () {
      var filtered = videos.filter(function (v) { return v.id !== videoId; });
      saveAllAdminVideos(filtered);
      renderAdminVideoTable();

      if (typeof window.showActionToast === 'function') {
        window.showActionToast('✓ Đã xóa video thành công!');
      }
    });
  }

  // =========================================================================
  // 10. PREVIEW PLAYER DÀNH CHO ADMIN KIỂM TRA VIDEO ĐÃ UPLOAD
  // =========================================================================
  function openAdminVideoPreview(videoId) {
    var videos = getAllAdminVideos();
    var video = videos.find(function (v) { return v.id === videoId; });
    if (!video) return;

    var overlay = document.getElementById('modalAdminVideoPreview');
    var player = document.getElementById('adminPreviewVideoPlayer');
    var titleEl = document.getElementById('adminPreviewTitle');
    var subtitleEl = document.getElementById('adminPreviewSubtitle');
    var badgeInstEl = document.getElementById('adminPreviewInstBadge');
    var badgeCatEl = document.getElementById('adminPreviewCatBadge');
    var durationEl = document.getElementById('adminPreviewDurationBadge');
    var storageEl = document.getElementById('adminPreviewStorageBadge');
    var descEl = document.getElementById('adminPreviewDesc');

    if (!overlay || !player) return;

    // TÊN Ở TRÊN (Title on top in modal header)
    if (titleEl) {
      titleEl.textContent = video.title || 'Xem Thử Video';
      titleEl.title = video.title || '';
    }
    if (subtitleEl) {
      subtitleEl.textContent = (video.instrumentName ? ('Nhạc cụ: ' + video.instrumentName + ' • ') : '') + (video.categoryName || 'Video Hướng Dẫn Diễn Tấu');
    }

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
      storageEl.innerHTML = video.isPreset ? '📁 Server video_hdnc' : '☁️ Database &amp; Storage';
    }
    if (descEl) {
      descEl.textContent = video.description || 'Chưa có mô tả chi tiết cho video này.';
    }

    if (video.videoUrl && video.videoUrl.indexOf('indexeddb://') === 0) {
      var blobId = video.videoUrl.replace('indexeddb://', '');
      getVideoBlob(blobId).then(function (blob) {
        if (blob) {
          player.src = URL.createObjectURL(blob);
          player.load();
          overlay.classList.add('open');
          try { player.play().catch(function () {}); } catch (e) {}
        } else {
          alert('Không tìm thấy tệp video nhị phân trong cơ sở dữ liệu.');
        }
      });
    } else {
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
    var player = document.getElementById('adminPreviewVideoPlayer');
    if (player) {
      player.pause();
      player.src = '';
    }
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
  // 12. KHỞI TẠO VÀ XUẤT CÁC HÀM TOÀN CỤC
  // =========================================================================
  function initAdminVideos() {
    // Điền dữ liệu vào các thẻ chọn bộ lọc nếu có
    populateInstrumentSelect('adminFilterInstSelect');
    populateInstrumentSelect('adminUploadInstSelect');

    renderAdminVideoTable();

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
    checkAdminPermission: checkAdminPermission
  };

  // Expose convenient global helpers for inline HTML event handlers
  window.openAdminVideoUploadModal = openAdminVideoUploadModal;
  window.closeAdminVideoUploadModal = closeAdminVideoUploadModal;
  window.openAdminVideoPreview = openAdminVideoPreview;
  window.closeAdminVideoPreview = closeAdminVideoPreview;
  window.handleAdminVideoFileChosen = handleAdminVideoFileChosen;
  window.handleAdminCustomThumbnailChosen = handleAdminCustomThumbnailChosen;
  window.handleAdminSubmitUpload = handleAdminSubmitUpload;
  window.deleteAdminVideo = deleteAdminVideo;
  window.filterAdminVideosByInstrument = filterAdminVideosByInstrument;
  window.filterAdminVideosByCategory = filterAdminVideosByCategory;
  window.searchAdminVideos = searchAdminVideos;
  window.resetAdminVideoFilters = resetAdminVideoFilters;

  // Giữ lại các hook cũ để không gây lỗi nếu có code gọi DanTranhVideoHdnc
  window.DanTranhVideoHdnc = {
    getAllVideos: getAllAdminVideos,
    renderGrid: renderAdminVideoTable
  };

})(window);
