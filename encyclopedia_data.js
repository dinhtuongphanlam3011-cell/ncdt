/* encyclopedia_data.js - BÁCH KHOA TOÀN THƯ DI SẢN 42 ĐẠI NHẠC CỤ DÂN TỘC VIỆT NAM
   Biên soạn chuẩn mực âm nhạc học dân tộc, di sản UNESCO & kỹ thuật diễn tấu cổ truyền
*/

(function () {
  "use strict";

  var ENCYCLOPEDIA = {
    // ---------------------------------------------------------
    // 1. NHẠC CỤ DÂY (CHORDOPHONES) - 14 NHẠC CỤ
    // ---------------------------------------------------------
    dantranh: {
      id: "dantranh",
      name: "Đàn Tranh",
      alias: "Đàn Thập Lục (16 Dây Ngũ Cung)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🪕",
      heritage: "Di sản Nhã Nhạc Cung Đình Huế (UNESCO 2003) & Đờn Ca Tài Tử Nam Bộ (UNESCO 2013)",
      origin: "Xuất hiện rực rỡ từ thời Lý-Trần, thế kỷ XIII-XIV, định hình chuẩn mực trong Cung đình Huế và thính phòng cả ba miền.",
      history: "Đàn Tranh có nguồn gốc bản địa hóa từ dòng đàn zither phương Đông nhưng qua bàn tay các nghệ nhân Đại Việt đã mang cấu trúc con nhạn linh hoạt và thang âm ngũ cung đặc trưng Việt Nam. Thời xưa đàn có 16 dây (Thập lục), sau được cải tiến 17, 19, 21 dây.",
      materials: "Mặt đàn và đáy đàn bằng gỗ ngô đồng xốp nhẹ để cộng hưởng thoát âm trong trẻo; thành đàn và đầu đàn bằng gỗ trắc, mun hoặc cẩm lai cẩn xà cừ tinh xảo; 16 con nhạn bằng gỗ trắc hoặc xương; dây thép mạ niken dẻo dai.",
      structure: "Thân đàn dài 110-120cm, dạng hộp rỗng hình thang hẹp dần về đầu đàn, mặt đàn vòm cong hình bán nguyệt tượng trưng cho vòm trời. 16 con nhạn di động đỡ dây, đáy có 2 lỗ thoát âm trăng khuyết và chữ Thọ.",
      technique: "Tay phải đeo móng đồi mồi gảy ngón thoa, lướt ngón (glissando), á âm, song thanh, phi móng (tremolo). Tay trái ấn, nhấn, rung, mổ, vỗ sau con nhạn tạo nốt luyến, nốt Fa và Si biến hóa theo điệu Bắc, Nam, Oán da diết.",
      keySkills: ["Gảy móng đồi mồi", "Nhấn sau nhạn", "Rung ngân điệu Oán", "Lướt ngón ngũ cung", "Phi móng tremolo"],
      artForms: "Nhã nhạc Cung đình Huế, Đờn ca tài tử Nam Bộ, Cải lương, Ca Huế, Hát Chèo, Hòa tấu thính phòng.",
      masters: "GS.TS Trần Văn Khê, NSND Nguyễn Vĩnh Bảo, NSƯT Phạm Thúy Hoan, NSƯT Hải Phượng, NSND Phương Bảo.",
      repertoire: "Lưu Thủy Kim Tiền, Bèo Dạt Mây Trôi, Dạ Cổ Hoài Lang, Tứ Đại Oán, Bình Bán Vắn, Nam Xuân, Nam Ai.",
      demoTracks: [
        { key: "luuthuy", title: "Lưu Thủy Kim Tiền (Rộn ràng Cung đình)", tempo: 240, notes: [0, 2, 2, 3, 4, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 7, 5, 4, 2, 0] },
        { key: "beodat", title: "Bèo Dạt Mây Trôi (Dân ca Bắc Bộ)", tempo: 280, notes: [5, 5, 8, 8, 9, 8, 8, 7, 7, 7, 6, 7, 8, 5, 5, 7, 6, 5, 4, 3, 8, 10, 7, 8, 7, 7, 4, 5, 5, 6, 7, 7] },
        { key: "daco", title: "Dạ Cổ Hoài Lang (Vọng cổ Phương Nam)", tempo: 340, notes: [5, 6, 7, 8, 7, 6, 5, 7, 8, 9, 8, 7, 6, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5] },
        { key: "rucon", title: "Ru Con Nam Bộ (Dịu dàng tha thiết)", tempo: 360, notes: [5, 7, 8, 9, 8, 7, 5, 6, 7, 8, 7, 6, 5, 7, 8, 9, 10, 9, 8, 7, 5] }
      ]
    },

    danbau: {
      id: "danbau",
      name: "Đàn Bầu",
      alias: "Độc Huyền Cầm (1 Dây Bồi Âm)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎻",
      heritage: "Nhạc khí độc nhất vô nhị trên thế giới - Biểu tượng tâm hồn Việt Nam",
      origin: "Hình thành từ châu thổ sông Hồng cổ kính, gắn bó ngàn đời cùng người dân cày, nghệ nhân hát xẩm và âm nhạc tài tử.",
      history: "Câu ca 'Đàn bầu ai gảy nấy nghe, Làm thân con gái chớ nghe đàn bầu' phản ánh âm sắc nỉ non, quyến rũ đến mê hoặc. Là nhạc cụ duy nhất trên thế giới chỉ có 1 dây nhưng tấu được muôn vàn cao độ nhờ hiện tượng vật lý bồi âm kết hợp uốn cần đàn.",
      materials: "Hộp đàn bằng thân tre già hoặc gỗ ngô đồng, gỗ trắc; cần đàn (vòi đàn) chuốt từ sừng trâu mộng dẻo dai hoặc cật tre già; quả bầu cộng hưởng bằng vỏ quả bầu khô hoặc gỗ tiện hình trái bầu; 1 sợi dây sắt duy nhất.",
      structure: "Thân đàn dài khoảng 100-110cm đáy phẳng mặt vòm. Dây sắt căng từ trục lên dây ở đuôi, chạy dọc suốt thân đàn, luồn qua cuống bầu và cột vào cần đàn linh hoạt. Hoàn toàn không có phím bấm.",
      technique: "Tay phải cầm que gảy (tăm đàn) chạm nhẹ cạnh bàn tay út vào các điểm nút bồi âm (1/2, 1/3, 1/4, 1/5, 1/6) tạo âm bồi thanh thoát. Tay trái uốn cần đàn về phía trước (hạ cao độ) hoặc kéo về phía sau (nâng cao độ), rung vòi đàn tạo tiếng nấc nỉ non như tiếng người nói, tiếng khóc, tiếng ru.",
      keySkills: ["Gảy điểm bồi âm", "Uốn cần sừng trâu", "Rung vòi tạo vi âm", "Vuốt luyến liệng nốt", "Ngón nấc nghẹn ngào"],
      artForms: "Hát Xẩm, Chèo, Ca Huế, Đờn ca tài tử, Thơ ngâm, Hòa tấu giao hưởng dân tộc.",
      masters: "NSND Vũ Tuấn Đức, NSƯT Đức Dũng, NSND Thanh Tâm, NSƯT Bùi Lệ Chi, NSND Hoàng Anh Tú.",
      repertoire: "Ru Con Nam Bộ, Cò Lả, Lòng Mẹ, Tiếng Đàn Bầu, Khúc Hát Quê Hương, Thoang Thoảng Hương Nhài.",
      demoTracks: [
        { key: "rucon", title: "Ru Con Nam Bộ (Tiếng Lòng Mẫu Tử)", tempo: 340, notes: [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 2, 0] },
        { key: "cola", title: "Cò Lả Đồng Quê (Dân ca Bắc Bộ)", tempo: 300, notes: [1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 2, 1, 0, 1, 2, 1] },
        { key: "longme", title: "Lòng Mẹ Bến Tre (Da diết sâu lắng)", tempo: 360, notes: [0, 2, 3, 4, 3, 2, 1, 2, 3, 2, 0, 1, 2, 1, 0] }
      ]
    },

    dannguyet: {
      id: "dannguyet",
      name: "Đàn Nguyệt",
      alias: "Đàn Kìm (Nguyệt Cầm Phím Cao)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🌕",
      heritage: "Linh hồn của Chầu Văn Bắc Bộ & Đệ nhất nhạc cụ Đờn Ca Tài Tử (UNESCO)",
      origin: "Xuất hiện từ thế kỷ XI thời Lý, thùng tròn như vầng trăng rằm, giữ vai trò chỉ huy giai điệu trong nhiều dàn nhạc truyền thống.",
      history: "Người miền Nam gọi là Đàn Kìm, người miền Bắc gọi là Đàn Nguyệt. Phím đàn gắn rất cao tạo khoảng trống lớn giữa dây và cần đàn, cho phép người nghệ sĩ nhấn sâu tạo ra những nốt chùng, nốt lướt và vi âm vô cùng độc đáo.",
      materials: "Thùng đàn bằng gỗ ngô đồng cộng hưởng ấm; thành thùng bằng gỗ trắc, cẩm lai; cần đàn bằng gỗ trắc cứng; 10-11 phím đàn bằng tre già; 2 dây đàn trước kia bằng tơ tằm nay bằng nilon.",
      structure: "Thùng đàn tròn dẹp đường kính ~38cm, thành cao ~7cm. Cần đàn rất dài (~100cm) thanh mảnh gắn các phím tre cao vút không theo thang âm bình quân phương Tây mà theo hệ ngũ cung dân tộc.",
      technique: "Gảy bằng móng nhựa/đồi mồi: ngón nhấn, ngón chùng, ngón day, ngón giật, ngón phi, ngón ngắt. Khả năng nhấn phím cao tạo nên điệu Nam Oán, điệu Bắc đĩnh đạc và điệu Chầu Văn huyền bí mê đắm.",
      keySkills: ["Nhấn phím cao vi âm", "Gảy móng đĩnh đạc", "Phi móng Chầu Văn", "Vuốt nốt điệu Oán", "Chặn ngón đảo phách"],
      artForms: "Hát Văn (Chầu Văn Tứ Phủ), Đờn ca tài tử Nam Bộ, Cải lương, Hát Chèo, Tuồng cổ, Nhã nhạc.",
      masters: "Nghệ nhân Bùi Huệ, NSND Xuân Hoạch, Nghệ nhân Văn Vĩ, NSND Hai Thơm, NSND Ba Tu.",
      repertoire: "Lưu Thủy Kim Tiền, Văn Dâng Hoa, Văn Cô Bơ, Bình Bán Vắn, Phú Lục, Tây Thi, Cổ Bản.",
      demoTracks: [
        { key: "luuthuy", title: "Lưu Thủy Kim Tiền (Điệu Cổ Đĩnh Đạc)", tempo: 220, notes: [0, 2, 2, 3, 4, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0] },
        { key: "hatvan", title: "Khúc Hát Văn Dâng Hoa Cửa Mẫu", tempo: 200, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 7, 5, 4, 2, 0, 2, 0] },
        { key: "binhban", title: "Bình Bán Vắn Tài Tử Phương Nam", tempo: 230, notes: [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0] }
      ]
    },

    dannhi: {
      id: "dannhi",
      name: "Đàn Nhị",
      alias: "Đàn Cò (2 Dây Cung Vĩ Luồn)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎻",
      heritage: "Cây đàn vĩ cung phổ biến nhất trong âm nhạc truyền thống cả ba miền",
      origin: "Có lịch sử hàng ngàn năm, là nhạc cụ nòng cốt trong dàn phường bát âm, chèo, tuồng, cải lương và nhã nhạc.",
      history: "Miền Bắc gọi là Đàn Nhị (2 dây), miền Nam gọi là Đàn Cò (do dáng đàn thanh mảnh tựa cánh cò). Cung vĩ luồn cố định giữa 2 dây không thể tháo rời, tạo nên sự liền mạch kỳ diệu trong từng nét kéo vuốt.",
      materials: "Ống đàn (bát nhị) bằng gỗ trắc, cẩm lai bịt da trăn gấm hoặc da kỳ đà; cần đàn bằng gỗ cứng; cung vĩ bằng tre uốn cong căng lông đuôi ngựa trắng; 2 dây tơ hoặc thép.",
      structure: "Ống cộng hưởng hình ống tròn hoặc lục giác dài ~13cm, đường kính ~9cm bịt da trăn một mặt. Cần đàn cắm xuyên qua bát nhị. Trên cần có cữ đàn (dây buộc cữ âm) định độ cao âm vực.",
      technique: "Kéo và đẩy cung vĩ (cung liền, cung ngắt, cung giật, cung rung), tay trái bấm ngón trên dây (ngón vuốt, ngón miết, ngón nẩy, ngón rung, ngón bồi âm) mô phỏng tiếng khóc than, cười vui, chim hót.",
      keySkills: ["Kéo cung vĩ luồn", "Miết ngón da trăn", "Rung vuốt nỉ non", "Cung ngắt staccato", "Âm bồi thanh mảnh"],
      artForms: "Hát Chèo, Tuồng, Cải Lương, Hát Xẩm, Ca Trù, Nhạc lễ tang ma, Đờn ca tài tử.",
      masters: "NSND Trần Bảng, NSƯT Thế Dân, NSND Xuân Hoạch, NSƯT Đào Văn Trung.",
      repertoire: "Cò Lả, Kể Chuyện Ngày Mùa, Tình Quê Hương, Vọng Ngày Xanh, Khúc Hát Người Mèo.",
      demoTracks: [
        { key: "cola", title: "Cò Lả Đồng Quê (Nỉ non da diết)", tempo: 300, notes: [1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 2, 1, 0, 1, 2, 1] },
        { key: "xuanve", title: "Xuân Về Bản Mèo (Rộn rã nương đồi)", tempo: 220, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0] }
      ]
    },

    dantam: {
      id: "dantam",
      name: "Đàn Tam",
      alias: "Tam Huyền Cầm (3 Dây Bịt Da Trăn 2 Mặt)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🪕",
      heritage: "Nhạc cụ giữ phách tiết tấu rộn ràng trong Chèo, Tuồng và Nhã Nhạc",
      origin: "Xuất hiện lâu đời trong các ban nhạc dân gian cổ truyền Việt Nam, đặc biệt thịnh hành trong nghệ thuật sân khấu Chèo và Tuồng.",
      history: "Đàn Tam có 3 dây, thùng đàn bịt da trăn cả hai mặt trước và sau nên âm thanh phát ra có độ đanh giòn, vang xa và nẩy hạt, rất thích hợp diễn tấu các tiết tấu nhanh, hoạt bát.",
      materials: "Hộp đàn bằng gỗ tiện tròn bịt da trăn mốc 2 mặt; cần đàn bằng gỗ mun hoặc trắc không gắn phím; 3 dây bằng tơ hoặc nilon.",
      structure: "Thùng đàn tròn dẹt, thành gỗ dày. Cần đàn dài nhẵn bóng không có phím bấm, đầu cần đàn uốn lượn hình con sò hoặc đuôi phượng.",
      technique: "Gảy bằng móng nhựa: ngón gảy nhanh, ngón vê liên hoàn, ngón chèn nhịp, ngón vuốt không phím tạo cao độ linh hoạt.",
      keySkills: ["Gảy nẩy hạt đanh", "Vê liên hoàn 3 dây", "Vuốt cần không phím", "Giữ nhịp sân khấu"],
      artForms: "Sân khấu Chèo, Tuồng Bình Định, Nhã nhạc Cung đình Huế, Ca kịch dân tộc.",
      masters: "Các nhạc công bậc thầy Nhà hát Chèo Việt Nam và Nhà hát Tuồng Đào Tấn.",
      repertoire: "Bình Bán Vắn Tuồng Cổ, Múa Kiếm Tây Sơn, Điệu Hề Chèo.",
      demoTracks: [
        { key: "binhban", title: "Bình Bán Vắn Tuồng Cổ", tempo: 200, notes: [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 0, 2, 0] }
      ]
    },

    dantu: {
      id: "dantu",
      name: "Đàn Tứ",
      alias: "Đoản Cầm (Đàn 4 Dây Cần Ngắn)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎸",
      heritage: "Cây đàn giữ bè giai điệu rộn rã trong Cải Lương và Đờn Ca Tài Tử",
      origin: "Được ưa chuộng bậc nhất tại Nam Bộ và các dàn nhạc sân khấu truyền thống thế kỷ XX.",
      history: "Khác với đàn Nguyệt có cần rất dài, Đàn Tứ có cần ngắn nên gọi là Đoản Cầm. Nhờ cần ngắn, các phím đàn nằm gần nhau giúp nghệ nhân chạy ngón cực nhanh, phi móng rộn ràng.",
      materials: "Thùng gỗ ngô đồng, thành gỗ trắc; cần ngắn gắn 10 phím tre; 4 dây đàn bằng tơ tằm hoặc hợp kim/nilon lên theo từng cặp quãng 5.",
      structure: "Thùng tròn phẳng, đường kính ~35cm. Cần đàn ngắn khoảng 40cm có gắn 10 phím bấm. 4 trục lên dây ở đầu đàn.",
      technique: "Gảy móng, ngón phi, ngón lượn, ngón chọi, chạy ngón tốc độ cao (bravura) tạo khí thế phấn chấn trong lớp kịch gay cấn.",
      keySkills: ["Chạy ngón tốc độ cao", "Phi móng rộn ràng", "Bấm phím kép 4 dây", "Nhấn nhá sân khấu"],
      artForms: "Cải Lương, Đờn ca tài tử, Hòa tấu ca kịch dân tộc.",
      masters: "Nghệ sĩ Tư Huyện, NSND Huỳnh Khải, các danh cầm Cải Lương Nam Bộ.",
      repertoire: "Lý Cây Bông, Khúc Ca Khải Hoàn, Ngựa Ô Bắc, Kim Tiền Huế.",
      demoTracks: [
        { key: "lycaybong", title: "Lý Cây Bông (Rộn ràng tươi sáng)", tempo: 240, notes: [1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1] }
      ]
    },

    danday: {
      id: "danday",
      name: "Đàn Đáy",
      alias: "Vô Đề Cầm (Cần Dài Đáy Thủng Độc Nhất)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎸",
      heritage: "Cây đàn linh hồn của Di sản Ca Trù Thăng Long (UNESCO 2009)",
      origin: "Nhạc khí thuần Việt 100%, do người Việt sáng tạo hoàn toàn vào khoảng thế kỷ XV thời Hậu Lê.",
      history: "Đàn Đáy là một kiệt tác sáng tạo không lai tạp bất kỳ nền văn hóa nào: cần đàn dài nhất trong các loại đàn, thùng đàn khoét rỗng đáy (đáy thủng), âm sắc trầm đục, trang nghiêm, u hoài và triết lý.",
      materials: "Mặt đàn bằng gỗ ngô đồng mộc không sơn; thùng đàn hình thang bằng gỗ trắc/gỗ mít; cần tre hoặc gỗ trắc dài 1,2 mét gắn 10-12 phím tre cao; 3 dây bằng tơ tằm se tết kỹ.",
      structure: "Thân đàn hình thang cân, đáy nhỏ ở trên, đáy lớn ở dưới bỏ trống hoàn toàn. Cần đàn dài ngoạn mục gắn các phím bấm rất cao.",
      technique: "Kép đàn (người đánh đàn đáy) dùng móng gảy bằng tre hoặc sừng: ngón gảy, ngón bấm, ngón chùng, ngón day, ngón vê tạo âm trầm ấm, nâng đỡ giọng hát đào nương và tiếng phách giòn giã.",
      keySkills: ["Bấm phím cần dài", "Gảy ngón trầm u hoài", "Nhấn chùng Ca Trù", "Hòa phách đào nương"],
      artForms: "Ca Trù (Hát Cửa Đình, Hát Nhà Tơ, Hát Ca Quán), Hát Văn truyền thống.",
      masters: "Nghệ nhân dân gian Đinh Khắc Ban, Nghệ nhân Nguyễn Phú Đễ, NSƯT Nguyễn Văn Khuê.",
      repertoire: "Khúc Hát Cửa Đình, Thét Nhạc, Bắc Phản, Tỳ Bà Hành, Gửi Thư.",
      demoTracks: [
        { key: "cuadinh", title: "Khúc Hát Cửa Đình (Ca Trù Thăng Long)", tempo: 320, notes: [0, 1, 2, 1, 0, 2, 3, 2, 1, 0, 1, 0] }
      ]
    },

    dantyba: {
      id: "dantyba",
      name: "Đàn Tỳ Bà",
      alias: "Tỳ Bà Trái Lê (4 Dây Quý Tộc)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🍐",
      heritage: "Nhạc khí quý tộc trong Nhã Nhạc Cung Đình Huế (UNESCO)",
      origin: "Có mặt trong cung đình Đại Việt từ thời Lý, Trần, đạt đỉnh cao nghệ thuật dưới triều Nguyễn tại Cố đô Huế.",
      history: "Dáng đàn tựa nửa quả lê cắt dọc, 4 dây tơ tượng trưng cho 4 mùa (Xuân - Hạ - Thu - Đông). Tiếng đàn Tỳ Bà thanh tao, quý phái, khi dồn dập như mưa rào, khi róc rách như ngọc rơi mâm vàng.",
      materials: "Gỗ ngô đồng nguyên khối khoét rỗng tạo mặt vòm; cần và đầu đàn bằng gỗ trắc khảm ngọc/xà cừ hình đuôi phượng; 4 dây đàn bằng tơ tằm thượng hạng hoặc nilon cao cấp.",
      structure: "Dài ~95cm, thân đàn phình to phần dưới và thuôn nhọn về đầu. Có nhiều phím gỗ trên mặt và cần đàn tạo thang âm rộng và chuẩn xác.",
      technique: "Phi móng 5 ngón tay (ngón Tỳ - đẩy ra, ngón Bà - kéo vào), vê móng liên hoàn (tremolo), ngón vuốt, ngón chặn tạo âm thanh lóng lánh như hạt châu sa.",
      keySkills: ["Phi móng 5 ngón", "Vê ngọc rơi mâm vàng", "Ám âm quý tộc", "Chạy ngón Cung đình"],
      artForms: "Nhã nhạc Cung đình Huế, Đại nhạc, Tiểu nhạc, Thính phòng cung đình, Ca Huế.",
      masters: "Nghệ nhân Tỳ Bà Cung đình Huế, NSƯT Vũ Mai Phương, NSƯT Diệu Thảo.",
      repertoire: "Kim Tiền Huế, Phú Lục, Cổ Bản, Tứ Đại Cảnh, Thập Thủ Liên Hoàn.",
      demoTracks: [
        { key: "kimtien", title: "Kim Tiền Cung Đình Huế (Thanh tao quý phái)", tempo: 190, notes: [0, 2, 3, 4, 3, 2, 3, 4, 5, 4, 3, 2, 0, 2, 0] }
      ]
    },

    danho: {
      id: "danho",
      name: "Đàn Hồ",
      alias: "Nhị Trầm Đại Cỡ (Bè Trầm Dân Tộc)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎻",
      heritage: "Nhạc khí giữ bè trầm ấm áp trong các dàn nhạc dân tộc Việt Nam",
      origin: "Phát triển cùng họ với Đàn Nhị, định hình kích thước lớn để đảm nhiệm dải tần số thấp ấm áp.",
      history: "Đàn Hồ có bát nhị to gấp đôi đàn Nhị thông thường, mặt bịt da trăn dày hoặc gỗ thông mỏng, phát ra âm thanh trầm hùng, sâu thẳm làm nền vững chắc cho cả dàn nhạc.",
      materials: "Hộp cộng hưởng bằng gỗ cẩm lai/trắc cỡ đại bịt da trăn già; cần gỗ dày; cung vĩ to căng nhiều lông đuôi ngựa; 2 dây kim loại bọc lụa âm trầm.",
      structure: "Cần dài ~90cm, bát đàn đường kính ~14-16cm. Cung vĩ luồn giữa hai dây định âm thấp hơn đàn nhị một quãng 8.",
      technique: "Kéo vĩ chậm rãi, miết ngón sâu, ngân rung trầm ấm gợi tả không gian bao la, chiều sâu nội tâm và sự trang trọng.",
      keySkills: ["Kéo vĩ bè trầm", "Rung sâu dải bass", "Miết nốt da trăn già", "Giữ nền hòa âm"],
      artForms: "Dàn nhạc dân tộc tổng hợp, Cải lương, Tuồng cổ, Nhã nhạc, Phim ảnh truyền hình.",
      masters: "Các nghệ sĩ bè trầm Học viện Âm nhạc Quốc gia Việt Nam.",
      repertoire: "Dạ Khúc Chiều Quê, Tiếng Rừng Tây Bắc, Lời Ru Của Rừng.",
      demoTracks: [
        { key: "dakhuc", title: "Dạ Khúc Chiều Quê (Trầm ấm sâu lắng)", tempo: 350, notes: [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0] }
      ]
    },

    dantinh: {
      id: "dantinh",
      name: "Đàn Tính",
      alias: "Tính Tẩu (Bầu Bầu Hát Then Di Sản UNESCO)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🪕",
      heritage: "Linh hồn Thực hành Then của người Tày, Nùng, Thái (UNESCO 2019)",
      origin: "Đại ngàn Tây Bắc và Đông Bắc Việt Nam (Cao Bằng, Lạng Sơn, Tuyên Quang, Hà Giang).",
      history: "Đàn Tính gắn liền với truyền thuyết Then - cây cầu nối giữa con người và thế giới thần linh Mường Trời. Tiếng đàn thanh thoát, mộc mạc như tiếng suối ngàn ru giấc ngủ buôn bản.",
      materials: "Bầu đàn làm bằng nửa quả bầu già khô tròn trịa; mặt đàn bằng gỗ vông nem xốp nhẹ; cần đàn bằng gỗ dâu hoặc gỗ dổi dài thon; dây đàn trước kia se bằng tơ tằm nay dùng dây cước.",
      structure: "Bầu tròn đường kính ~20-25cm khoét lỗ thoát âm nhỏ ở mặt sau. Cần đàn dài ~80-100cm thanh mảnh không có phím bấm. Có 2 hoặc 3 dây đàn.",
      technique: "Gảy bằng ngón trỏ tay phải (hoặc móng gảy sừng non), tay trái bấm vuốt trên cần đàn. Vừa gảy vừa xóc chùm chuông đồng lắc (chùm xóc nhạc) ở chân tạo nhịp điệu rộn ràng.",
      keySkills: ["Gảy ngón trỏ mộc mạc", "Vuốt cần tre Then", "Kết hợp chuông lắc xóc", "Dẫn đường linh thiêng"],
      artForms: "Nghi lễ Hát Then, Lễ hội Lồng Tồng (Xuống đồng), Hát Then giao duyên.",
      masters: "Nghệ nhân Nhân dân Hoàng Triều, NSND Nông Thị Lũy, Nghệ nhân Nông Văn Coóng.",
      repertoire: "Đường Về Bản, Lời Cầu Mùa Then Khảm Hải, Mùa Hoa Ban Nở.",
      demoTracks: [
        { key: "hatthen", title: "Hát Then Đường Về Bản Làng", tempo: 240, notes: [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 3, 2, 0] }
      ]
    },

    danmoi: {
      id: "danmoi",
      name: "Đàn Môi",
      alias: "Nhạc Cụ Môi Rung Miệng (Jew's Harp Việt Nam)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "👄",
      heritage: "Nhạc cụ tỏ tình thầm kín độc đáo của đồng bào H'Mông và vùng cao",
      origin: "Miền núi phía Bắc và Tây Nguyên.",
      history: "Nhỏ bé nằm gọn trong bao trúc trang trí hoa văn thổ cẩm, Đàn Môi là lời thì thầm tâm sự của các chàng trai cô gái người Mông trong đêm trăng chợ tình.",
      materials: "Rèn thủ công từ một lá đồng thau mỏng dát mỏng hoặc cật tre già dẻo dai.",
      structure: "Gồm một lá đồng nhỏ dài 6-8cm, chính giữa rạch lưỡi gà mỏng linh hoạt, đựng trong ống trúc nhỏ cài chỉ ngũ sắc.",
      technique: "Áp nhẹ đàn vào hai cánh môi (không chạm răng), tay phải dùng ngón trỏ bật nhẹ vào đầu lưỡi gà, dùng khoang miệng và hơi thở làm hộp cộng hưởng biến hóa nguyên âm (A, O, U, I).",
      keySkills: ["Bật lưỡi đồng tinh vi", "Cộng hưởng khoang miệng", "Điều hơi tỏ tình", "Mô phỏng tiếng nói"],
      artForms: "Chợ tình mùa xuân, Giao duyên tâm tình bên bờ rào đá, Lễ hội vùng cao.",
      masters: "Các nghệ nhân người H'Mông tại Đồng Văn, Mèo Vạc (Hà Giang).",
      repertoire: "Khúc Tình Ca Gọi Bạn, Lời Thì Thầm Bên Suối.",
      demoTracks: [
        { key: "goiban", title: "Khúc Tình Ca Gọi Bạn Đêm Trăng", tempo: 220, notes: [0, 1, 2, 3, 2, 3, 4, 3, 2, 1, 0, 1, 0] }
      ]
    },

    dankni: {
      id: "dankni",
      name: "Đàn K'ni",
      alias: "Đàn Vĩ Miệng Jarai (Biết Hát Tiếng Người)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎻",
      heritage: "Nhạc khí kéo vĩ kỳ lạ nhất của núi rừng Tây Nguyên",
      origin: "Dân tộc Gia Rai, Ba Na, Xơ Đăng vùng Tây Nguyên.",
      history: "Đàn K'ni nổi tiếng với biệt danh 'cây đàn biết nói tiếng người'. Âm thanh từ dây đàn được truyền qua một sợi chỉ vào chiếc màng ngậm trong miệng nghệ nhân, biến khoang miệng thành loa phát âm.",
      materials: "Thân đàn bằng một ống nứa hoặc tre thẳng; cần đàn có các phím sáp ong; dây bằng kim loại hoặc gân thú; cung vĩ bằng tre và lông ngựa.",
      structure: "Ống tre dài ~60cm, một đầu cắm trục lên dây. Điểm đặc biệt: có một sợi chỉ nhỏ nối từ ngựa đàn lên chiếc vảy con tê tê hoặc màng nhựa ngậm giữa hai hàm răng.",
      technique: "Tay phải kéo vĩ, tay trái bấm phím sáp ong, miệng người chơi ngậm màng rung và cử động khẩu hình uốn lời để đàn phát âm rõ từng lời ca như tiếng người hát.",
      keySkills: ["Truyền âm sợi chỉ", "Khẩu hình tạo tiếng hát", "Bấm phím sáp ong", "Kéo vĩ rừng già"],
      artForms: "Hát kể sử thi Đam San, Ot Ndrông, Sinh hoạt nhà rông bên bếp lửa.",
      masters: "Nghệ nhân Nay Phin, NSƯT Rơ Chăm Tih.",
      repertoire: "Lời Kể Rừng Già, Tiếng Đàn Bên Bếp Lửa Nhà Rông.",
      demoTracks: [
        { key: "runggia", title: "Lời Kể Rừng Già Đại Ngàn", tempo: 330, notes: [0, 1, 2, 1, 0, 2, 3, 2, 1, 0] }
      ]
    },

    dangoong: {
      id: "dangoong",
      name: "Đàn Goong",
      alias: "Đàn Ống Tre Đa Dây Ê Đê",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🪕",
      heritage: "Cây đàn ống tre mộc mạc đậm chất sử thi Tây Nguyên",
      origin: "Dân tộc Ê Đê, M'Nông, Gia Rai vùng đất đỏ bazan.",
      history: "Tiếng đàn Goong giòn giã, lách cách vui tai như tiếng suối chảy đá reo, thường được các chàng trai gảy trong những đêm canh nương rẫy hay đón khách quý vào buôn.",
      materials: "Một đoạn ống nứa già to; quả bầu khô cắt đáy làm hộp tăng âm; nhiều sợi dây thép mảnh căng quanh chu vi ống.",
      structure: "Ống nứa dài khoảng 70cm, đường kính 8cm. Các dây kim loại căng dọc thân ống, mỗi dây tựa lên một mẩu gỗ nhỏ làm ngựa đàn. Đầu ống cắm xuyên qua quả bầu khô.",
      technique: "Hai tay ôm đàn, dùng các đầu ngón tay gảy đồng thời nhiều dây tạo nên bè giai điệu và bè đệm hòa quyện nhịp nhàng.",
      keySkills: ["Gảy hai tay đa bè", "Cộng hưởng quả bầu", "Điểm nhịp nương rẫy"],
      artForms: "Đón khách buôn làng, Lễ cúng thần lúa, Sinh hoạt cộng đồng nhà sàn.",
      masters: "Các già làng nghệ nhân buôn Ma Thuột, Đắk Lắk.",
      repertoire: "Đón Khách Buôn Làng, Giai Điệu Mừng Lúa Mới.",
      demoTracks: [
        { key: "donkhach", title: "Đón Khách Buôn Làng Rộn Rã", tempo: 210, notes: [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 2, 0] }
      ]
    },

    danchapi: {
      id: "danchapi",
      name: "Đàn Chapi",
      alias: "Huyền Thoại Chapi Raglai (Giấc Mơ Chapi)",
      cat: "day",
      catName: "Nhạc cụ dây",
      icon: "🎋",
      heritage: "Biểu tượng cuộc sống no ấm, thanh bình của người Raglai",
      origin: "Dân tộc Raglai tỉnh Ninh Thuận và Khánh Hòa.",
      history: "Nhạc sĩ Trần Tiến đã viết nên ca khúc bất hủ 'Giấc Mơ Chapi': 'Ở nơi ấy họ đang sống không mùa đông, không mùa nắng mưa, có tiếng Chapi xua tan nỗi buồn...'. Là cây đàn tách dây trực tiếp từ thân tre vô cùng độc đáo.",
      materials: "Một lóng ống tre lồ ô đực bánh tẻ tròn đều, không mối mọt, vỏ óng vàng.",
      structure: "Nghệ nhân dùng dao sắc khéo léo bẩy từng sợi cật tre mỏng trên thân ống làm dây đàn (khoảng 8-12 dây), chèn các mẩu tre làm ngựa đàn định cao độ.",
      technique: "Hai tay bế đàn áp vào bụng, dùng ngón tay gảy nhịp nhàng, bụng người chơi đóng vai trò làm buồng cộng hưởng điều chỉnh sắc thái.",
      keySkills: ["Bật cật tre làm dây", "Cộng hưởng thành bụng", "Giai điệu thanh bình"],
      artForms: "Lễ ăn đầu lúa mới, Lễ bỏ mả, Sinh hoạt nương rẫy thanh bình.",
      masters: "Nghệ nhân Chamaléa Âu (người Raglai huyện Bác Ái, Ninh Thuận).",
      repertoire: "Giấc Mơ Chapi Bên Lửa Rừng, Điệu Hát Mừng Mùa Rẫy.",
      demoTracks: [
        { key: "chapi", title: "Giấc Mơ Chapi Bên Lửa Rừng", tempo: 250, notes: [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0] }
      ]
    },

    // ---------------------------------------------------------
    // 2. NHẠC CỤ HƠI (AEROPHONES) - 13 NHẠC CỤ
    // ---------------------------------------------------------
    saotruc: {
      id: "saotruc",
      name: "Sáo Trúc",
      alias: "Sáo Nứa Dân Gian (6 Lỗ Bấm)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎋",
      heritage: "Biểu tượng thanh âm đồng quê bờ tre đồng lúa Việt Nam",
      origin: "Đồng bằng sông Hồng và khắp các làng quê ba miền đất nước.",
      history: "Gắn liền với hình ảnh chú bé chăn trâu thổi sáo trên lưng trâu, cánh diều vi vu lưng trời. Sáo trúc là nhạc khí hơi có âm sắc trong trẻo, bay bổng và gợi cảm bậc nhất.",
      materials: "Ống trúc già đanh hoặc nứa tép tự nhiên đều lòng, thành mỏng vừa phải, phơi khô kiệt.",
      structure: "Ống dài 45-55cm, một đầu bịt mấu tre làm nút chặn. Có 1 lỗ thổi hình bầu dục, 6 lỗ bấm khoét thẳng hàng và các lỗ định âm/treo ngọc ở đuôi sáo.",
      technique: "Thổi hơi qua mép lỗ thổi, điều chỉnh luồng hơi (cường độ, góc độ). Tay bấm ngón: ngón rung, ngón vuốt, ngón láy, ngón phi, ngón đập tạo âm thanh mượt mà như ngọn gió mát lành.",
      keySkills: ["Thổi luồng hơi mép", "Vuốt ngón mượt mà", "Rung hơi vi vút", "Láy nốt điệu nghệ"],
      artForms: "Độc tấu dân gian, Hòa tấu thính phòng, Nhạc Chèo, Hát Văn, Sân khấu múa rối nước.",
      masters: "NSND Đinh Thìn, NSƯT Bùi Công Thơm, NSƯT Tiến Dũng, NSƯT Đức Liên.",
      repertoire: "Inh Lả Ơi, Tiếng Sáo Bản Mèo, Bèo Dạt Mây Trôi, Trăng Thu Dạ Khúc, Tình Ca Quê Hương.",
      demoTracks: [
        { key: "inhlaoi", title: "Inh Lả Ơi Mùa Xuân Về (Tây Bắc)", tempo: 230, notes: [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 3, 2, 0] },
        { key: "tiengsao", title: "Tiếng Sáo Trăng Khuya Đồng Nội", tempo: 280, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 7, 5, 4, 2, 0] }
      ]
    },

    tieu: {
      id: "tieu",
      name: "Tiêu (Động Tiêu)",
      alias: "Tiêu Trúc Hun Thổi Dọc (Thiền Nhạc)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎋",
      heritage: "Nhạc khí thính phòng tao nhã, thanh tịnh cõi thiền",
      origin: "Cổ nhạc cung đình, thiền viện và âm nhạc bác học truyền thống.",
      history: "Khác với sáo trúc thổi ngang, Tiêu được thổi dọc ở miệng ống có vết khoét chữ V hoặc chữ U. Âm thanh của Tiêu trầm ấm, u tịch, huyền ảo, gợi cảm giác siêu thoát và tĩnh tại.",
      materials: "Trúc già nhiều năm tuổi, thường hun khói nâu bóng (trúc hun) hoặc trúc rễ dày dặn.",
      structure: "Ống trúc dài ~70-80cm, đường kính lớn hơn sáo. Đầu trên có mấu kín khoét rãnh thổi dọc; có 6 lỗ bấm trước và 1 lỗ bấm ngón cái ở sau.",
      technique: "Thổi hơi dọc êm dịu, lấy hơi sâu từ bụng (đan điền), ngón bấm chậm rãi, rung hơi nhẹ nhàng đưa tâm trí về trạng thái tĩnh tại an lạc.",
      keySkills: ["Thổi dọc chữ V", "Lấy hơi đan điền", "Rung trầm u tịch", "Âm hưởng thiền tịnh"],
      artForms: "Cổ nhạc thính phòng, Thiền nhạc, Ca trù thính âm, Nhã nhạc Cung đình Huế.",
      masters: "Các danh sĩ, nghệ nhân thính phòng thâm nho đất Thăng Long và Cố đô Huế.",
      repertoire: "Trăng Thu Dạ Khúc, Khúc Tiêu Chiều Vắng, Dạ Tĩnh Tùng Phong.",
      demoTracks: [
        { key: "trangthu", title: "Trăng Thu Dạ Khúc (Thanh tịnh an lạc)", tempo: 360, notes: [0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0] }
      ]
    },

    khen: {
      id: "khen",
      name: "Khèn",
      alias: "Khèn Bè Dân Gian (Đa Thanh Tây Bắc)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🌾",
      heritage: "Nhạc khí đa thanh độc đáo của miền núi phía Bắc",
      origin: "Các dân tộc vùng Tây Bắc và Đông Bắc Việt Nam.",
      history: "Khèn là nhạc cụ hơi đa âm gồm nhiều ống nứa lồng vào một bầu gỗ. Vừa thổi vừa hít đều phát ra âm thanh, tạo nên bè trầm ấm đệm cho giai điệu vút cao.",
      materials: "Ống nứa tép thẳng đều; bầu khèn bằng gỗ thớ mịn; lam đồng (lưỡi gà) bằng đồng dát mỏng.",
      structure: "Gồm 6 đến 14 ống nứa cắm xuyên qua một bầu gỗ thon. Trong mỗi ống gắn một lam đồng tinh vi.",
      technique: "Hít và thổi luồng hơi liên tục, bấm các lỗ ngón trên thân ống để phát ra các hợp âm đa tầng hòa quyện.",
      keySkills: ["Thổi hít liên hoàn", "Bấm hợp âm đa thanh", "Luyến láy miền núi"],
      artForms: "Lễ hội mùa lúa, Đám cưới bản làng, Múa khèn tập thể.",
      masters: "Các nghệ nhân vùng cao Điện Biên, Sơn La, Lào Cai.",
      repertoire: "Khúc Khèn Gọi Mùa Lúa, Mừng Lúa Đầy Sân.",
      demoTracks: [
        { key: "khenmua", title: "Khúc Khèn Gọi Mùa Lúa Về Bản", tempo: 220, notes: [0, 2, 3, 4, 3, 2, 0, 2, 4, 5, 4, 2, 0] }
      ]
    },

    kenbau: {
      id: "kenbau",
      name: "Kèn Bầu",
      alias: "Kèn Loa Bóp (Dăm Kép Lễ Hội)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎺",
      heritage: "Chỉ huy âm lượng trong Đại Nhạc Cung Đình Huế và Lễ Hội Dân Gian",
      origin: "Xuất hiện trong các đám rước, tế lễ cung đình và hội làng khắp đất nước.",
      history: "Âm thanh của Kèn Bầu chói lọi, vang dội xa hàng cây số, giữ vai trò dẫn dắt các đám rước thần, đám hội náo nức và các màn giao đấu trên sân khấu Tuồng cổ.",
      materials: "Dăm kèn kép bằng lá thốt nốt khô; thân kèn bằng gỗ tiện hình nón rỗng; loa kèn (bầu kèn) bằng gỗ hoặc vỏ đồng uốn xòe rộng.",
      structure: "Dài khoảng 40-50cm, gồm 3 phần tháo lắp: dăm kèn cắm vào dĩ đồng, thân kèn có 7 lỗ bấm, và loa kèn loe to ở đáy.",
      technique: "Kỹ thuật ngậm dăm thổi hơi liên tục (vừa thổi vừa lấy hơi bằng mũi - xuyến hơi), tạo luồng âm vang dội không bao giờ đứt quãng.",
      keySkills: ["Xuyến hơi mũi miệng liên tục", "Ngậm dăm kép thốt nốt", "Thổi vang dội lễ hội"],
      artForms: "Nhã nhạc Cung đình Huế (Đại Nhạc), Tuồng cổ Bình Định, Hội làng Đền Hùng.",
      masters: "Các nghệ nhân nhã nhạc cung đình và gánh hát Tuồng cổ.",
      repertoire: "Xuất Quân Lễ Hội Đền Hùng, Bài Hạ Cung Đình, Pháo Nổ Mừng Xuân.",
      demoTracks: [
        { key: "xuatquan", title: "Xuất Quân Lễ Hội Đền Hùng Hào Sảng", tempo: 180, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0] }
      ]
    },

    kenla: {
      id: "kenla",
      name: "Kèn Lá",
      alias: "Lá Rừng Tỏ Tình Vút Đỉnh Trời",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🍃",
      heritage: "Tuyệt đỉnh sáng tạo từ thiên nhiên của các dân tộc vùng cao",
      origin: "Đại ngàn Hoàng Liên Sơn, Tây Bắc và Tây Nguyên.",
      history: "Không cần đục đẽo hay chế tác công phu, chỉ cần ngắt một chiếc lá rừng bánh tẻ bên suối, qua bờ môi tài hoa của chàng trai vùng cao đã biến thành tiếng kèn lanh lảnh vang dội muôn vách núi.",
      materials: "Lá cây rừng tươi, mép không răng cưa, phiến lá dai và phẳng (thường là lá ổi rừng, lá bưởi, lá đa lông).",
      structure: "Gấp đôi mép lá dọc theo sống lá hoặc cuộn tròn nhẹ làm gờ rung.",
      technique: "Ngậm mép lá giữa hai bờ môi, dùng luồng hơi thở ép qua khe lá kết hợp lực môi và ngón tay kéo căng phiến lá để tạo cao độ cao vút.",
      keySkills: ["Ngậm mép lá tạo rung", "Điều chỉnh lực môi vi âm", "Lanh lảnh đỉnh mây"],
      artForms: "Hò hẹn tỏ tình bên nương rẫy, Chợ tình Tây Bắc, Tín hiệu giao tiếp giữa hai sườn núi.",
      masters: "Đồng bào các dân tộc H'Mông, Dao, Mường, Thái.",
      repertoire: "Lời Tỏ Tình Bên Bờ Suối, Em Đẹp Như Hoa Ban.",
      demoTracks: [
        { key: "totinh", title: "Lời Tỏ Tình Bên Bờ Suối Trong", tempo: 240, notes: [0, 1, 2, 3, 4, 3, 2, 1, 3, 4, 5, 4, 2, 0] }
      ]
    },

    tuva: {
      id: "tuva",
      name: "Tù Và",
      alias: "Tù Và Sừng Trâu (Hiệu Lệnh Ngàn Xưa)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🐚",
      heritage: "Tiếng gọi lịch sử mở hội, báo tiệp và tập hợp cộng đồng",
      origin: "Thời Hùng Vương dựng nước cho đến các làng bản miền núi và đồng bằng.",
      history: "Tiếng tù và trầm hùng, vang dội như sấm rền ngàn xưa, từng xua đuổi thú dữ, thúc giục đoàn quân Tây Sơn thần tốc và hiệu triệu nhân dân trong các kỳ hội làng đại lễ.",
      materials: "Sừng trâu mộng to khỏe, già bóng hoặc vỏ ốc biển đại dương khổng lồ.",
      structure: "Đầu nhọn sừng trâu được cưa bớt và khoét một lỗ thổi tròn vừa vặn môi; lòng sừng được nạo nhẵn rỗng hoàn toàn.",
      technique: "Mím chặt môi thổi luồng hơi cực mạnh tạo độ rung môi vào lỗ thổi, áp dụng kỹ thuật ngắt hơi dứt khoát tạo tiếng hú trầm vang rền trời đất.",
      keySkills: ["Rung môi áp lực cao", "Hiệu lệnh vang dội", "Âm trầm hùng tráng"],
      artForms: "Hội nghị Diên Hồng, Lễ hội Cồng Chiêng Tây Nguyên, Khai hội đình làng.",
      masters: "Các già làng Tây Nguyên và nghệ nhân lễ hội cổ truyền.",
      repertoire: "Tiếng Gọi Đại Ngàn Báo Tiệp, Hồi Hùng Khí Đông A.",
      demoTracks: [
        { key: "baotiep", title: "Tiếng Gọi Đại Ngàn Báo Tiệp Hùng Tráng", tempo: 400, notes: [0, 1, 2, 1, 0, 2, 3, 2, 0] }
      ]
    },

    pi: {
      id: "pi",
      name: "Pi",
      alias: "Sáo Pi Thái (Pi Thiu, Pi Pặp, Pi Đôi)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎵",
      heritage: "Thanh âm ngọt ngào trong điệu múa Xòe Thái (UNESCO 2021)",
      origin: "Dân tộc Thái vùng Mường Lò (Yên Bái), Mường Then (Điện Biên).",
      history: "Chiếc sáo Pi mộc mạc làm bằng nứa tép có lưỡi gà cật tre là tiếng lòng ngọt lịm của những đêm hội xòe hoa, uống rượu cần và tỏ tình mùa hoa ban.",
      materials: "Ống nứa tép mỏng, lam cật tre già dẻo dai.",
      structure: "Ống dài chừng 25-35cm, đầu gắn lam dăm nứa, thân có 4-6 lỗ bấm.",
      technique: "Thổi ngậm trọn lưỡi gà vào khoang miệng, ngón bấm nhanh nhẹn luyến láy dìu dặt theo từng nhịp xòe đung đưa.",
      keySkills: ["Ngậm dăm cật tre", "Luyến láy ngọt ngào", "Dẫn nhịp điệu Xòe hoa"],
      artForms: "Múa Xòe Thái Tây Bắc, Đêm hội Then Mường Lò, Hát khắp Thái.",
      masters: "Các nghệ nhân ưu tú dân tộc Thái tỉnh Điện Biên và Sơn La.",
      repertoire: "Điệu Xòe Hoa Mai Châu, Khắp Mường Then Mùa Xuân.",
      demoTracks: [
        { key: "xoehoa", title: "Điệu Xòe Hoa Mai Châu Náo Nức", tempo: 230, notes: [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 0] }
      ]
    },

    khenmong: {
      id: "khenmong",
      name: "Khèn Mông",
      alias: "Linh Hồn Người Mông Trên Mỏm Đá Mèo Vạc",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🌾",
      heritage: "Di sản văn hóa phi vật thể quốc gia - Biểu tượng bất diệt người H'Mông",
      origin: "Cao nguyên đá Đồng Văn, Mèo Vạc (Hà Giang), Sa Pa (Lào Cai).",
      history: "Cây khèn gắn bó suốt cuộc đời người đàn ông H'Mông từ khi sinh ra, tỏ tình, lấy vợ đến khi về cõi vĩnh hằng. Nghệ nhân vừa thổi khèn vừa múa nhào lộn, quay tít điệu nghệ trên chợ tình.",
      materials: "6 ống trúc đực có độ dày khác nhau cắm vào một bầu gỗ thông thon dài; lam đồng (lưỡi gà) bằng đồng mạ dẻo dai.",
      structure: "Bầu khèn dài thon chuốt nhẵn quấn dây vỏ cây. 6 ống trúc dài ngắn xếp hai hàng xuyên qua bầu khèn.",
      technique: "Vừa hít vừa thổi liên tục để dòng khí không ngắt quãng; kết hợp vũ điệu bước chân nhún nhảy, lộn nhào, quay tròn 360 độ trên mặt đất.",
      keySkills: ["Thổi hít tuần hoàn", "Vũ điệu nhào lộn xoay tròn", "Hòa âm đa tầng", "Tỏ tình mùa xuân"],
      artForms: "Chợ tình Sa Pa, Khâu Vai, Lễ Gầu Tào, Tang lễ phong tục H'Mông.",
      masters: "Nghệ nhân Mua Sính Thào, NSƯT Vàng A Chỉnh.",
      repertoire: "Vũ Khúc Chợ Tình Mùa Xuân, Khèn Gọi Bạn Lên Nương.",
      demoTracks: [
        { key: "vukhuc", title: "Vũ Khúc Chợ Tình Mùa Xuân Sa Pa", tempo: 200, notes: [0, 2, 3, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0] }
      ]
    },

    dingnam: {
      id: "dingnam",
      name: "Đing Năm",
      alias: "Khèn Bầu 6 Ống Ê Đê",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎋",
      heritage: "Linh hồn giai điệu dân ca Ayray nồng nàn của người Ê Đê",
      origin: "Buôn làng người Ê Đê, Gia Rai vùng đất đỏ Đắk Lắk.",
      history: "Đing Năm là tiếng lòng tha thiết của các chàng trai Ê Đê gửi đến người yêu bên ô cửa sổ nhà dài. Tiếng đing năm da diết, mượt mà hòa cùng làn điệu dân ca Ayray say đắm.",
      materials: "Một quả bầu khô tròn; 6 ống nứa dài ngắn khác nhau cắm hai hàng; lam lưỡi gà bằng cật nứa hoặc đồng.",
      structure: "Quả bầu già giữ nguyên cuống làm núm thổi. 6 ống nứa cắm xuyên qua bầu, dán kín bằng sáp ong ruồi rừng không hở khí.",
      technique: "Thổi hơi vào cuống bầu, dùng các đầu ngón tay bấm bịt lỗ trên các ống nứa để tạo các bè hòa âm da diết.",
      keySkills: ["Thổi cuống quả bầu", "Dán kín sáp ong rừng", "Làn điệu Ayray say đắm"],
      artForms: "Hát Ayray buôn làng, Lễ cúng thần rừng, Đêm lửa trại nhà dài.",
      masters: "Các nghệ nhân già làng Buôn Đôn, Đắk Lắk.",
      repertoire: "Hát Ayray Chiều Buôn Đôn, Lời Hẹn Dưới Bóng Kơ-nia.",
      demoTracks: [
        { key: "ayray", title: "Hát Ayray Chiều Buôn Đôn Tha Thiết", tempo: 260, notes: [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 1, 0] }
      ]
    },

    dingbuot: {
      id: "dingbuot",
      name: "Đing Buốt",
      alias: "Sáo Nứa Dọc Lưỡi Gà Tây Nguyên",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎋",
      heritage: "Nhạc khí độc tấu trữ tình của đồng bào Gia Rai, Ba Na",
      origin: "Vùng đất Kon Tum, Gia Lai đại ngàn Trường Sơn.",
      history: "Cây sáo nứa dài thổi dọc với âm sắc rủ rỉ, thì thầm như lời tâm sự đôi lứa bên ánh lửa bập bùng giữa rừng khộp đại ngàn mùa rụng lá.",
      materials: "Ống nứa dài thanh mảnh, cật nứa sắc sảo làm lưỡi gà.",
      structure: "Ống nứa dài ~60-70cm, đầu thổi có lưỡi gà cật nứa ngậm trong miệng, thân có 3-4 lỗ bấm âm vực ngũ cung.",
      technique: "Ngậm đầu sáo thổi hơi êm ả, rung ngón tay trên lỗ thoát khí tạo tiếng rủ rỉ sâu lắng như làn gió mát ban đêm.",
      keySkills: ["Thổi ngậm lưỡi gà", "Rủ rỉ tâm tình", "Ngũ cung đại ngàn"],
      artForms: "Tâm sự bên bếp lửa nhà rông, Canh rẫy đêm trăng, Hẹn hò đôi lứa.",
      masters: "Nghệ nhân dân gian Pleiku, Gia Lai.",
      repertoire: "Gió Thổi Rừng Khộp Mùa Khô, Tiếng Suối Đêm Trăng.",
      demoTracks: [
        { key: "rungkhop", title: "Gió Thổi Rừng Khộp Mùa Khô Rủ Rỉ", tempo: 290, notes: [0, 1, 2, 3, 2, 1, 0, 2, 3, 2, 0] }
      ]
    },

    dingtut: {
      id: "dingtut",
      name: "Đing Tút",
      alias: "Ống Hơi Nữ Tây Nguyên (Múa Bước Xoang)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎋",
      heritage: "Nhạc khí độc đáo chỉ dành riêng cho phụ nữ Gia Rai, Ba Na",
      origin: "Tây Nguyên (Gia Lai, Kon Tum).",
      history: "Tốp nữ nghệ nhân gồm 6 cô gái, mỗi người cầm một ống nứa dài ngắn khác nhau, vừa thổi mép ống vừa nhún nhảy đong đưa thân mình trong vòng xoang mừng mùa lúa mới.",
      materials: "Bộ 6 ống nứa rỗng một đầu, đáy kín giữ nguyên mấu tre tự nhiên.",
      structure: "Bộ 6 ống có độ dài từ 40cm đến 100cm tương ứng với 6 cao độ chuẩn mực ngũ cung. Hoàn toàn không có lỗ bấm.",
      technique: "Mỗi người phụ trách 1 ống, ghé miệng vào mép ống thổi phù phù từng nhịp chính xác kết hợp chuyển động thân hình dẻo dai theo nhịp chiêng.",
      keySkills: ["Thổi mép ống hơi", "Phối hợp 6 người hocketing", "Đong đưa thân hình múa xoang"],
      artForms: "Lễ Mừng Lúa Mới Về Kho, Lễ Đâm Trâu, Hội làng buôn rực rỡ.",
      masters: "Đội nữ nghệ nhân cồng chiêng Đing Tút làng Plei Ơi.",
      repertoire: "Mừng Lúa Mới Về Kho, Lời Tạ Ơn Thần Lúa Yàng.",
      demoTracks: [
        { key: "munglua", title: "Mừng Lúa Mới Về Kho (Đong đưa nhịp điệu)", tempo: 240, notes: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 0] }
      ]
    },

    talu: {
      id: "talu",
      name: "Ta Lư",
      alias: "Tiếng Đàn Ta Lư Anh Dũng Chiến Khu",
      cat: "hoi",
      catName: "Nhạc cụ truyền thống",
      icon: "🎸",
      heritage: "Cây đàn đi vào lịch sử kháng chiến và thơ ca cách mạng Việt Nam",
      origin: "Dân tộc Vân Kiều, Pa Cô vùng dãy núi Trường Sơn hùng vĩ (Quảng Trị, Thừa Thiên Huế).",
      history: "Gắn liền với ca khúc bất hủ 'Tiếng Đàn Ta Lư' của nhạc sĩ Huy Thục: 'Đi giữa Trường Sơn nghe tiếng đàn Ta Lư...'. Cây đàn 2 dây mộc mạc đã tiếp thêm sức mạnh cho bộ đội đánh giặc giữ rừng.",
      materials: "Hộp đàn bằng ống tre già hoặc gỗ rừng; cần đàn bằng tre; 2 dây đàn bằng gân thú hoặc thép mảnh.",
      structure: "Thân đàn dài chừng 80cm thanh thoát, phím đàn bằng sáp ong gắn mẩu tre định âm ngũ cung vui tươi, trong sáng.",
      technique: "Gảy móng gảy tre liên tục, bấm phím tạo giai điệu rộn ràng, hào sảng, lạc quan yêu đời giữa bão đạn mưa bom.",
      keySkills: ["Gảy móng rộn ràng", "Bấm phím sáp ong", "Giai điệu hào sảng Trường Sơn"],
      artForms: "Sinh hoạt văn nghệ chiến khu, Lễ hội Ada của người Pa Cô, Giao duyên bản làng.",
      masters: "Nghệ nhân ưu tú Kray Sức, NSƯT Kan Lịch.",
      repertoire: "Tiếng Đàn Ta Lư Anh Dũng, Tình Ca Người Pa Cô.",
      demoTracks: [
        { key: "talu", title: "Tiếng Đàn Ta Lư Hào Khí Trường Sơn", tempo: 190, notes: [0, 2, 3, 4, 3, 2, 0, 3, 4, 5, 4, 3, 2, 0] }
      ]
    },

    pile: {
      id: "pile",
      name: "Pí Lè",
      alias: "Kèn Đám Cưới Tày Nùng (Loa Đồng Rước Dâu)",
      cat: "hoi",
      catName: "Nhạc cụ hơi",
      icon: "🎺",
      heritage: "Thanh âm hỷ sự náo nức rộn rã non cao miền biên viễn",
      origin: "Dân tộc Tày, Nùng, Dao vùng Cao Bằng, Lạng Sơn, Hà Giang.",
      history: "Đám cưới của đồng bào Tày, Nùng không thể thiếu tiếng kèn Pí Lè. Tiếng kèn mở đường dẫn đoàn rước dâu qua từng con suối, đèo dốc báo tin vui cho cả mường bản chung vui.",
      materials: "Dăm kèn bằng rơm rạ nếp nương; thân bằng gỗ tiện hình nón; loa kèn bằng đồng sáng chói.",
      structure: "Dài khoảng 50cm, có 7 lỗ bấm bên trên và 1 lỗ bấm bên dưới. Loa đồng loe rộng giúp khuếch đại âm vang khắp thung lũng.",
      technique: "Kỹ thuật lấy hơi vòng (circular breathing) giữ hơi thổi liên tục không ngừng, luyến ngón nhanh, uốn nốt rộn rã tưng bừng.",
      keySkills: ["Lấy hơi vòng liên tục", "Thổi loa đồng náo nức", "Uốn nốt rước dâu"],
      artForms: "Lễ cưới truyền thống, Đón dâu qua bản, Lễ hội Lồng Tồng.",
      masters: "Các nghệ nhân kèn Pí Lè trứ danh xứ Lạng.",
      repertoire: "Rước Dâu Về Bản Làng, Khúc Vui Mừng Hỷ Sự.",
      demoTracks: [
        { key: "ruocdau", title: "Rước Dâu Về Bản Làng Xứ Lạng", tempo: 180, notes: [0, 2, 3, 4, 5, 4, 3, 2, 0, 3, 4, 5, 4, 2, 0] }
      ]
    },

    // ---------------------------------------------------------
    // 3. NHẠC CỤ GÕ (IDIOPHONES & MEMBRANOPHONES) - 12 NHẠC CỤ
    // ---------------------------------------------------------
    trongcom: {
      id: "trongcom",
      name: "Trống Cơm",
      alias: "Trống Bịt Cơm Nếp (Bập Bùng Quan Họ)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥁",
      heritage: "Di sản Dân ca Quan họ Bắc Ninh (UNESCO 2009) & Âm nhạc cổ truyền",
      origin: "Đồng bằng Bắc Bộ, gắn bó mật thiết với các canh hát Quan họ và chèo cổ.",
      history: "Tên gọi 'Trống Cơm' bắt nguồn từ tập tục nghệ nhân trước khi biểu diễn phải lấy cơm nếp nóng dẻo nắn thành một miếng tròn gắn chặt vào giữa mặt trống để định âm, tạo tiếng 'Bập - Bùng' trầm đục ấm áp hòa cùng tiếng chát giòn tan.",
      materials: "Tang trống tiện từ khúc gỗ mít nguyên khối thon ở hai đầu; hai mặt bịt da trâu non hoặc da bò mịn; cơm nếp chín dẻo để chỉnh cao độ.",
      structure: "Dài ~55-60cm, dáng thon tròn ở giữa phình to. Dây da hoặc dây mây đan giằng chéo quanh thân để tăng giảm độ căng của mặt trống.",
      technique: "Đeo trống ngang trước bụng bằng dây vải đỏ: tay phải vỗ cả bàn tay hoặc ngón tay vào mặt cơm nếp (tạo âm trầm 'Bùm - Bùng'), tay trái vỗ mép mặt trống không dán cơm (tạo âm đanh 'Cắc - Chát').",
      keySkills: ["Dán cơm nếp định âm", "Đánh hai tay âm sắc tương phản", "Bập bùng nhịp Quan họ"],
      artForms: "Dân ca Quan họ Bắc Ninh, Hát Chèo, Nhã nhạc Cung đình Huế, Múa dân gian.",
      masters: "Các nghệ nhân quan họ làng Diềm, danh cầm gõ Nhà hát Chèo.",
      repertoire: "Trống Cơm Khúc Hát Hội Làng, Khách Đến Chơi Nhà, Giã Bạn.",
      demoTracks: [
        { key: "trongcom", title: "Trống Cơm Khúc Hát Hội Làng Dân Gian", tempo: 210, notes: [0, 1, 2, 1, 0, 1, 2, 2, 1, 0, 1, 2, 0] }
      ]
    },

    trongcai: {
      id: "trongcai",
      name: "Trống Cái",
      alias: "Đại Cổ Đình Làng (Trống Trâu Mộng)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥁",
      heritage: "Linh vật giữ nhịp linh thiêng đình đền chùa miếu Việt Nam",
      origin: "Hệ thống đình đền, chùa chiền và lễ hội đại lễ toàn quốc.",
      history: "Tiếng Trống Cái trầm hùng vang xa hàng chục dặm, mở đầu mọi kỳ đại lễ quốc gia, gióng lên hồi chuông cảnh tỉnh nhân tâm và khởi động khí thế non sông đất Việt.",
      materials: "Tang trống ghép từ các thanh gỗ mít già lõi đỏ uốn khum khít khao; hai mặt bịt da trâu đực cổ đại căng chốt bằng đinh tre già.",
      structure: "Đường kính mặt trống từ 80cm đến trên 1,5 mét; thân dài hơn 1 mét đặt trên giá đỡ gỗ sơn son thếp vàng chạm trổ rồng phượng.",
      technique: "Dùng dùi gỗ mít đầu tròn đánh vào giữa tâm mặt trống (âm 'Tùng' rền vang) hoặc đánh vào viền mép tang trống (âm 'Rập - Cắc' sắc nhọn).",
      keySkills: ["Đánh tâm rền vang", "Gõ tang trống giục giã", "Đại cổ phong ba"],
      artForms: "Đại lễ Đền Hùng, Hội Gióng (UNESCO), Hội Lim, Tế lễ đình làng.",
      masters: "Các bậc bô lão nghệ nhân làng trống Đọi Tam (Hà Nam).",
      repertoire: "Hào Khí Đông A Mở Hội, Hồi Trống Đại Lễ Thăng Long.",
      demoTracks: [
        { key: "haokhi", title: "Hào Khí Đông A Mở Hội Rền Vang", tempo: 380, notes: [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1] }
      ]
    },

    trongchien: {
      id: "trongchien",
      name: "Trống Chiến",
      alias: "Trống Trận Tây Sơn (Trống Võ Bình Định)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥁",
      heritage: "Hào khí võ trận Quang Trung Nguyễn Huệ lẫy lừng non sông",
      origin: "Đất võ Bình Định, Tây Sơn và nghệ thuật Tuồng cổ truyền thống.",
      history: "Dàn Trống Trận Tây Sơn (thường gồm 12 chiếc tượng trưng 12 con giáp) từng theo chân Hoàng đế Quang Trung xuất trận đánh tan 29 vạn quân Mãn Thanh, giục giã bước chân thần tốc của nghĩa quân.",
      materials: "Tang gỗ mít dày đặc chịu lực chấn động cực lớn; mặt da bò tót hoặc da trâu già đanh; dùi gỗ lim đặc.",
      structure: "Mặt trống đường kính ~40cm, tang trống thấp nhưng rất dày và chắc chắn.",
      technique: "Nghệ nhân múa hai dùi trống thoăn thoắt liên hoàn (đánh điểm tâm, gõ tang, đảo phách) tạo tiết tấu dồn dập nghẹt thở như vạn mã phi bờ cõi.",
      keySkills: ["Liên hoàn dùi đôi thần tốc", "Đánh tang đảo phách võ trận", "Thần tốc xung trận"],
      artForms: "Võ cổ truyền Bình Định, Lễ hội Đống Đa, Sân khấu Tuồng Đào Tấn.",
      masters: "Các võ sư, danh thủ trống trận bảo tàng Quang Trung (Tây Sơn, Bình Định).",
      repertoire: "Hồi Trống Trận Quang Trung Thần Tốc, Xuất Trận Bình Định.",
      demoTracks: [
        { key: "trongtran", title: "Hồi Trống Trận Quang Trung Thần Tốc", tempo: 160, notes: [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0] }
      ]
    },

    trongban: {
      id: "trongban",
      name: "Trống Bản",
      alias: "Trống Dẹp Múa Xoang Tây Nguyên",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥁",
      heritage: "Nhịp đập rộn ràng đêm lửa trại nhà rông Tây Nguyên",
      origin: "Các dân tộc Tây Nguyên (Ba Na, Gia Rai, Xơ Đăng).",
      history: "Trống Bản có tang rất mỏng dẹp, đeo trước ngực người nghệ sĩ dẫn đầu đoàn múa xoang, dẫn dắt bước chân nhịp nhàng của các thiếu nữ quanh đống lửa.",
      materials: "Tang gỗ xoan hoặc mít mỏng nhẹ; mặt da nai hoặc da hoẵng mềm mại.",
      structure: "Đường kính mặt trống ~45cm nhưng bề dày tang chỉ khoảng 10-15cm, cực kỳ cơ động khi di chuyển nhảy múa.",
      technique: "Đeo dây trước bụng, một tay cầm dùi bọc da gõ nhịp điệu dập dồn, một tay đè mặt trống tạo tiếng ngắt âm độc đáo.",
      keySkills: ["Đánh di động múa xoang", "Bịt ngắt âm mặt da", "Dẫn bước đêm lửa"],
      artForms: "Lễ Đâm Trâu mừng chiến thắng, Lễ Bỏ Mả (Pơ Thi), Hội cồng chiêng.",
      masters: "Các nghệ nhân buôn làng Kon Tum, Gia Lai.",
      repertoire: "Nhịp Xoang Đêm Lễ Đâm Trâu, Khúc Vui Buôn Làng.",
      demoTracks: [
        { key: "xoang", title: "Nhịp Xoang Đêm Lễ Đâm Trâu Bập Bùng", tempo: 220, notes: [0, 1, 1, 0, 1, 1, 0, 1, 0, 1] }
      ]
    },

    cong: {
      id: "cong",
      name: "Cồng",
      alias: "Cồng Có Núm Trầm Rền (Đại Diện Phái Dương / Cha)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🔔",
      heritage: "Không gian Văn hóa Cồng Chiêng Tây Nguyên (Kiệt tác UNESCO 2005)",
      origin: "Toàn vùng cao nguyên Tây Nguyên (Gia Lai, Đắk Lắk, Kon Tum, Lâm Đồng, Đắk Nông).",
      history: "Cồng chiêng là tài sản quý giá nhất của mỗi gia đình, dòng họ người Tây Nguyên. Cồng là loại nhạc khí bằng đồng CÓ NÚM tròn lồi ở tâm, biểu tượng cho Trời, Cha, Phái Dương và các đấng thần linh quyền uy.",
      materials: "Đúc thủ công từ hợp kim đồng thau pha thiếc và bạc theo tỷ lệ bí truyền của các nghệ nhân.",
      structure: "Hình tròn, ở chính giữa mặt có một núm lồi tròn nổi lên, thành cồng cụp vuông góc về phía sau. Đường kính từ 30cm đến cả mét.",
      technique: "Dùng dùi gỗ bọc vải mềm hoặc gốc rễ cây đánh chuẩn xác vào giữa núm tròn tạo tiếng 'Boong' trầm sâu, rền vang, ngân nga huyền bí chạm thấu cõi Yàng.",
      keySkills: ["Gõ tâm núm đồng", "Dùi bọc vải ngân vang", "Đối thoại cùng Chiêng bằng"],
      artForms: "Không gian văn hóa cồng chiêng Tây Nguyên, Lễ cúng cơm mới, Lễ cầu mưa.",
      masters: "Các già làng, nghệ nhân chỉnh chiêng bậc thầy Tây Nguyên.",
      repertoire: "Tiếng Cồng Gọi Yàng Ban Phúc, Lễ Đón Khách Vào Nhà Rông.",
      demoTracks: [
        { key: "goiyang", title: "Tiếng Cồng Gọi Yàng Ban Phúc Thấu Trời", tempo: 360, notes: [0, 1, 2, 1, 0, 2, 3, 2, 1, 0] }
      ]
    },

    chieng: {
      id: "chieng",
      name: "Chiêng",
      alias: "Chiêng Bằng Thanh Thoát (Đại Diện Phái Âm / Mẹ)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🔔",
      heritage: "Không gian Văn hóa Cồng Chiêng Tây Nguyên (UNESCO) & Chiêng Mường",
      origin: "Tây Nguyên và vùng người Mường tỉnh Hòa Bình, Thanh Hóa.",
      history: "Trái ngược với Cồng có núm, Chiêng là nhạc cụ MẶT PHẲNG NHẴN không có núm, biểu tượng cho Đất, Mẹ, Phái Âm và sự sinh sôi nảy nở. Âm thanh của Chiêng cao, vang xa, rộn rã đối đáp nhịp nhàng với Cồng.",
      materials: "Hợp kim đồng thau rèn dát mỏng hơn cồng để âm thanh ngân cao sáng.",
      structure: "Mặt phẳng nhẵn như chiếc đĩa lớn, vành mép uốn cụp ra sau. Bộ chiêng Mường gồm 12 chiếc tượng trưng cho 12 tháng trong năm.",
      technique: "Dùng dùi gỗ bọc da hoặc lòng bàn tay vỗ/chặn trên mặt chiêng để tạo các âm sắc đa dạng: âm ngân vang, âm đanh sắc, âm nghẹn ngào.",
      keySkills: ["Đánh chiêng bằng thanh thoát", "Bịt bàn tay ngắt tiếng", "Hòa tấu bè đối đáp"],
      artForms: "Dàn chiêng Mường Đập Nước, Hội Cồng Chiêng Tây Nguyên, Khai hạ Mường Bi.",
      masters: "Nghệ nhân ưu tú Đinh Thị Phượng (Hòa Bình), các nghệ nhân chiêng Jrai.",
      repertoire: "Điệu Chiêng Mừng Lúa Mới, Khúc Chiêng Mường Trầm Bổng.",
      demoTracks: [
        { key: "mungluamoi", title: "Điệu Chiêng Mừng Lúa Mới Rộn Rã", tempo: 270, notes: [0, 1, 2, 3, 2, 1, 3, 2, 1, 0] }
      ]
    },

    thanhla: {
      id: "thanhla",
      name: "Thanh La",
      alias: "Chiêng Đồng Cầm Tay (Phát Phách Lễ Hội)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "✨",
      heritage: "Nhạc khí giữ phách đanh thép trong Phường Bát Âm và Hội Làng",
      origin: "Đồng bằng sông Hồng và khắp các lễ hội truyền thống miền Bắc.",
      history: "Thanh la là đĩa đồng nhỏ cầm tay, tiếng kêu đanh gọn 'Coong - Beng' xua tan tà khí, đánh thức không gian mở đầu cho các canh hát, nghi lễ rước kiệu.",
      materials: "Đúc bằng đồng thau nguyên chất có độ dày đồng đều.",
      structure: "Hình chiếc đĩa sâu lòng, đường kính ~15-20cm, có xỏ dây quai để cầm ngón tay treo lơ lửng.",
      technique: "Tay trái cầm quai treo lơ lửng, tay phải cầm dùi gỗ cứng gõ vào mặt trong hoặc ngoài đĩa đồng tạo tiếng vang dòn đanh sắc.",
      keySkills: ["Gõ đĩa đồng phát phách", "Treo lơ lửng tự do", "Giữ nhịp bát âm"],
      artForms: "Phường bát âm, Tế lễ đình làng, Hát Chèo cổ, Múa sư tử lân rồng.",
      masters: "Các nhạc công ban nhạc cổ truyền Bắc Bộ.",
      repertoire: "Nhịp Thanh La Khai Mạc, Điệu Múa Lân Khai Hội.",
      demoTracks: [
        { key: "khaimac", title: "Nhịp Thanh La Khai Mạc Đanh Gọn", tempo: 240, notes: [0, 0, 1, 0, 0, 1, 1, 0, 1] }
      ]
    },

    mo: {
      id: "mo",
      name: "Mõ",
      alias: "Mõ Gỗ Mít (Thanh Tịnh Định Tâm)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🔔",
      heritage: "Âm thanh bình yên thanh tịnh của chùa chiền và đình làng Việt Nam",
      origin: "Chùa chiền Phật giáo và sinh hoạt công cộng nông thôn ngàn đời.",
      history: "Tiếng mõ 'Cộc - Cốc' khoan thai định tâm trong tiếng tụng kinh cửa Phật, hay tiếng mõ làng rộn rã gọi dân đắp đê, họp làng đầu đình đã trở thành một phần tâm thức người Việt.",
      materials: "Khúc gỗ mít già khoét rỗng hoặc củ tre già khô đanh.",
      structure: "Hình cá hóa rồng hoặc quả đào khoét rỗng ruột, có khe hẹp để âm thanh thoát ra cộng hưởng trầm đục ấm cúng.",
      technique: "Cầm dùi gỗ đầu bọc cao su hoặc da gõ đều đặn, giữ nhịp khoan thai, tịnh độ.",
      keySkills: ["Gõ nhịp định tâm", "Cộng hưởng khe rỗng", "Thanh tịnh an nhiên"],
      artForms: "Khóa lễ chùa Phật giáo, Tụng kinh niệm Phật, Hội làng truyền thống.",
      masters: "Các bậc thiền sư và nghệ nhân dân gian.",
      repertoire: "Khúc Mõ An Lạc Bình Yên, Nhịp Mõ Đêm Trăng Thanh Tịnh.",
      demoTracks: [
        { key: "anlac", title: "Khúc Mõ An Lạc Bình Yên Cửa Phật", tempo: 350, notes: [0, 0, 0, 0, 0, 0, 0, 0] }
      ]
    },

    phach: {
      id: "phach",
      name: "Phách",
      alias: "Phách Tre Ca Trù (Nhịp Phách Đào Nương)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥢",
      heritage: "Chuẩn mực nhịp điệu của Nghệ thuật Ca Trù (Di sản Thế giới UNESCO)",
      origin: "Vùng đất Thăng Long - Hà Nội và châu thổ Bắc Bộ.",
      history: "Trong Ca Trù, đào nương vừa hát vừa tự tay gõ phách. Bàn phách tre tuy đơn sơ nhưng qua đôi tay ngọc ngà đã tấu nên hệ thống khổ phách vô cùng phức tạp, tinh vi, là linh hồn định hình cấu trúc Ca Trù.",
      materials: "Bàn phách bằng thanh tre già đực; hai que gõ bằng gỗ trắc (1 que chẻ đôi, 1 que tròn).",
      structure: "Bàn phách dài ~30cm đặt trên gối nệm nhỏ hoặc hai đầu dây kê. Hai que gõ tay phải tay trái khác biệt về âm sắc.",
      technique: "Tay cầm 2 que gõ: tay phải cầm lá phách đôi (tiếng Chát), tay trái cầm que đơn (tiếng Tum). Đánh các khổ phách kinh điển: Phách Luồn, Phách Rải, Khổ Xiết, Khổ Đều.",
      keySkills: ["Đánh tiếng Chát - Tum", "Gõ khổ phách Ca Trù", "Vừa hát vừa gõ điêu luyện"],
      artForms: "Ca Trù (Hát Cửa Đình, Hát Nhà Tơ, Thưởng ẩm Ca Quán), Hát Chèo.",
      masters: "NSND Quách Thị Hồ, Nghệ nhân Nguyễn Thị Chúc, Nghệ nhân Phó Thị Kim Đức.",
      repertoire: "Nhịp Khổ Phách Ca Trù Thăng Long, Tỳ Bà Hành, Hát Mở Cửa Đình.",
      demoTracks: [
        { key: "khophach", title: "Nhịp Khổ Phách Ca Trù Thăng Long Tinh Tế", tempo: 200, notes: [0, 1, 0, 1, 1, 0, 1, 0, 1, 1] }
      ]
    },

    sinhtien: {
      id: "sinhtien",
      name: "Sinh Tiền",
      alias: "Sênh Tiền Múa Hội (Tiếng Tiền Kêu Lách Cách)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🥢",
      heritage: "Nhạc khí kết hợp vũ điệu độc đáo bậc nhất của múa dân gian Việt Nam",
      origin: "Nhã nhạc Cung đình Huế và các lễ hội dân gian Bắc Bộ.",
      history: "Sinh Tiền vừa là nhạc cụ gõ nhịp vừa là đạo cụ múa cực kỳ sinh động. Tiếng đập của gỗ hòa cùng tiếng xủng xoảng lách cách của đồng tiền cổ và tiếng quẹt răng cưa giòn giã làm bừng sáng mọi lễ hội.",
      materials: "Ba thanh gỗ trắc cứng chạm trổ tinh xảo; các xâu đồng tiền xu cổ bằng đồng thau.",
      structure: "Gồm 3 lá gỗ nối nhau bằng dây da: hai lá ghép đôi có gắn các xâu đồng tiền cổ có thể chuyển động tự do; một lá có răng cưa ở cạnh bên.",
      technique: "Hai tay cầm sênh vừa gõ hai lá vào nhau (tiếng cộc), vừa lắc cổ tay làm tiền xu va chạm (tiếng lách cách), vừa quẹt cạnh lá vào sống răng cưa (tiếng xoẹt) kết hợp động tác múa xoay điệu nghệ.",
      keySkills: ["Gõ va đập 3 lá", "Lắc đồng xu tiền cổ", "Quẹt sóng răng cưa xoẹt", "Múa sênh tiền hoa lệ"],
      artForms: "Múa Sênh Tiền cung đình Huế, Lễ hội Đền Hùng, Múa dân gian Bắc Bộ.",
      masters: "Các nghệ sĩ múa Cung đình Huế và Đoàn múa Dân gian Quốc gia.",
      repertoire: "Vũ Điệu Sênh Tiền Hội Đền, Vũ Khúc Cung Đình Hoa Lệ.",
      demoTracks: [
        { key: "vudieusenhtien", title: "Vũ Điệu Sênh Tiền Hội Đền Rực Rỡ", tempo: 190, notes: [0, 1, 0, 1, 0, 0, 1, 0, 1, 1] }
      ]
    },

    trung: {
      id: "trung",
      name: "Đàn T'rưng",
      alias: "Dàn Ống Nứa Đại Ngàn (Thác Đổ Suối Reo)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "🎋",
      heritage: "Nhạc khí gõ tre nứa nổi tiếng thế giới của đồng bào Tây Nguyên",
      origin: "Dân tộc Ba Na, Gia Rai, Xơ Đăng vùng đại ngàn Tây Nguyên.",
      history: "Đàn T'rưng mô phỏng âm thanh dòng suối chảy róc rách, tiếng chim rừng hót líu lo và tiếng gió ngàn xào xạc. Ngày xưa chỉ được đánh trên nương rẫy để xua đuổi muông thú và mừng mùa lúa.",
      materials: "Các ống nứa già vát đầu chéo nhẵn bóng; dây dù hoặc dây mây liên kết; giá đỡ bằng tre dẻo dai; 2 dùi gõ bọc cao su tự nhiên.",
      structure: "Gồm hàng chục ống nứa có độ dài ngắn, đường kính khác nhau xếp thành bậc thang từ lớn (âm trầm) đến nhỏ (âm cao).",
      technique: "Hai tay cầm hai que gõ gõ thoăn thoắt trên mặt ống nứa: kỹ thuật gõ đôi, gõ đảo, vê liên hoàn róc rách như dòng thác trắng xóa tuôn chảy.",
      keySkills: ["Gõ dùi cao su nẩy hạt", "Vê liên hoàn suối reo", "Chạy ngón bậc thang ngũ cung"],
      artForms: "Hòa tấu giao hưởng dân tộc, Biểu diễn văn hóa quốc tế, Lễ hội buôn làng.",
      masters: "NSƯT Bùi Lệ Chi, NSND Rơ Chăm Phiang, Nghệ nhân Nay Phin.",
      repertoire: "Đi Săn Buôn Đôn, Mùa Hái Quả Tây Nguyên, Tiếng Đàn T'rưng Hát Lưng Trời.",
      demoTracks: [
        { key: "disan", title: "Đi Săn Buôn Đôn (Thác Đổ Suối Reo)", tempo: 170, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 7, 5, 4, 2, 0] },
        { key: "mua", title: "Mừng Mùa Lúa Mới Tây Nguyên Vui Say", tempo: 190, notes: [0, 1, 2, 3, 4, 3, 2, 1, 4, 5, 4, 2, 0] }
      ]
    },

    danda: {
      id: "danda",
      name: "Đàn Đá",
      alias: "Thạch Cầm Tiền Sử 3000 Năm (Tiếng Vọng Đại Ngàn)",
      cat: "go",
      catName: "Nhạc cụ gõ",
      icon: "💎",
      heritage: "Nhạc cụ cổ xưa bậc nhất nhân loại - Bảo vật Quốc gia Việt Nam",
      origin: "Các di chỉ khảo cổ học Bình Đa (Đồng Nai), Ndut Lieng Krak (Đắk Nông), Khánh Sơn (Khánh Hòa).",
      history: "Được phát hiện có niên đại trên 3.000 năm từ thời tiền sử đồ đá. Người xưa đã biết chọn những phiến đá dung nham núi lửa có thớ mịn gõ vào phát ra thanh âm trong trẻo kỳ vĩ, chứng minh người Việt cổ đã có tư duy âm nhạc đỉnh cao từ ngàn xưa.",
      materials: "Các thanh đá tự nhiên nguồn gốc đá sừng silic hoặc đá dung nham núi lửa cổ đại gõ kêu như chuông đồng.",
      structure: "Bộ gồm từ 10 đến 20 thanh đá dài ngắn dày mỏng khác nhau, kê trên giá đỡ trải vải hoặc mút xốp.",
      technique: "Dùng dùi gỗ cứng hoặc dùi bọc da gõ vào điểm nút của phiến đá. Âm thanh vang xa, trong trẻo, trầm hùng và uy nghiêm khôn cùng.",
      keySkills: ["Gõ phiến đá tiền sử", "Âm vang chuông đá đại ngàn", "Cộng hưởng kỳ vĩ thiên nhiên"],
      artForms: "Đại lễ Quốc gia, Biểu diễn nhạc cổ điển dân tộc, Festival Di sản Thế giới.",
      masters: "Các nhà khảo cổ học và nghệ nhân phục dựng âm nhạc tiền sử Việt Nam.",
      repertoire: "Tiếng Vọng Tiền Sử Ngàn Năm, Hào Khí Đất Trời Đại Ngàn.",
      demoTracks: [
        { key: "tiensu", title: "Tiếng Vọng Tiền Sử Ngàn Năm Kỳ Vĩ", tempo: 260, notes: [0, 2, 3, 4, 5, 4, 3, 2, 0, 3, 4, 5, 4, 2, 0] }
      ]
    },

    // ---------------------------------------------------------
    // 4. NHẠC CỤ ĐẶC BIỆT (SPECIAL & NATURE PHENOMENAL) - 3 NHẠC CỤ
    // ---------------------------------------------------------
    dannuoc: {
      id: "dannuoc",
      name: "Đàn Nước",
      alias: "Thủy Cầm Dòng Suối Pơ Lang (Nhạc Suối Tự Nhiên)",
      cat: "dacbiet",
      catName: "Nhạc cụ đặc biệt",
      icon: "💧",
      heritage: "Sự hòa hợp tuyệt mỹ giữa trí tuệ con người và mẹ thiên nhiên hoang dã",
      origin: "Vùng rừng núi của đồng bào Raglai, Ba Na, Gia Rai.",
      history: "Người vùng cao đã khéo léo chế ngự dòng chảy của suối ngàn: nước chảy vào máng nứa bập bùng nâng gõ vào các phiến đá và ống tre tạo thành khúc nhạc róc rách ngày đêm không nghỉ để xua đuổi thú dữ và xoa dịu lòng người.",
      materials: "Máng nứa dẫn nước rừng, ống tre lồ ô, các phiến đá cuội tự nhiên và dây rừng chằng buộc.",
      structure: "Hệ thống máng cân bằng chuyển động tự động nhờ trọng lực của nước suối đổ đầy rồi vơi, làm chuyển động các búa gõ.",
      technique: "Vận hành hoàn toàn bằng cơ học tự nhiên của dòng nước chảy, con người chỉ cần căn chỉnh lượng nước và độ nghiêng máng.",
      keySkills: ["Chế ngự lực nước suối", "Cơ học tự nhiên hoang dã", "Nhạc khúc ngày đêm bất tận"],
      artForms: "Bảo vệ mùa màng rẫy nương, Nghi lễ tạ ơn Thần Nước (Yàng Ia).",
      masters: "Các nghệ nhân vùng cao Raglai huyện Bác Ái.",
      repertoire: "Khúc Suối Reo Rừng Pơ Lang, Khúc Hát Thần Nước Róc Rách.",
      demoTracks: [
        { key: "suoireo", title: "Khúc Suối Reo Rừng Pơ Lang Róc Rách", tempo: 280, notes: [0, 1, 2, 3, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0] }
      ]
    },

    dangio: {
      id: "dangio",
      name: "Đàn Gió",
      alias: "Phong Cầm Đỉnh Núi (Thanh Âm Của Gió Ngàn)",
      cat: "dacbiet",
      catName: "Nhạc cụ đặc biệt",
      icon: "🎐",
      heritage: "Bản hòa tấu của trời đất và gió ngàn miền sơn cước",
      origin: "Các đỉnh núi cao lộng gió vùng Tây Bắc và Tây Nguyên.",
      history: "Những ống nứa và phiến đá được nghệ nhân treo lơ lửng trên ngọn cây cổ thụ đỉnh đèo. Khi từng cơn gió rừng thổi qua, chúng va chạm vào nhau tấu lên khúc nhạc huyền bí, hư ảo giữa mây trời.",
      materials: "Ống nứa vát rỗng ruột, các phiến đá mỏng dây mây treo chắc chắn.",
      structure: "Treo tỏa tròn đón gió từ 4 phương 8 hướng, có cánh đón gió bằng vỏ bương nhẹ.",
      technique: "Gió ngàn điều khiển ngẫu hứng tự nhiên, tạo nên những chuỗi âm thanh ngân vang thanh khiết thoát tục.",
      keySkills: ["Đón ngọn gió đại ngàn", "Va chạm ngẫu hứng thiên nhiên", "Hư ảo mây trời"],
      artForms: "Cảnh báo gió bão, Trấn giữ linh hồn bản làng trên đỉnh đèo cao.",
      masters: "Các bậc cao niên vùng rẻo cao Tây Bắc.",
      repertoire: "Gió Ngàn Reo Ca Đỉnh Trời, Lời Thì Thầm Của Mây.",
      demoTracks: [
        { key: "giongan", title: "Gió Ngàn Reo Ca Đỉnh Trời Hư Ảo", tempo: 320, notes: [0, 2, 3, 4, 5, 4, 3, 2, 0, 2, 3, 2, 0] }
      ]
    },

    khenbe: {
      id: "khenbe",
      name: "Khèn Bè",
      alias: "Đa Âm Khèn Bè Thái Lào (Hòa Âm Bè Đôi)",
      cat: "dacbiet",
      catName: "Nhạc cụ đặc biệt",
      icon: "🌾",
      heritage: "Di sản âm nhạc hòa bè tuyệt mỹ của đồng bào Thái, Lào Tây Bắc",
      origin: "Vùng đồng bào dân tộc Thái, Lào tỉnh Điện Biên, Sơn La, Lai Châu.",
      history: "Khèn Bè là đỉnh cao chế tác nhạc khí đa âm: các ống nứa xếp thành hai hàng bè song song, mỗi ống gắn một lam đồng quý giá. Khi nghệ sĩ thổi, cả một dàn hòa âm bè trầm và bè bổng cất lên say đắm lòng người.",
      materials: "14 ống nứa tép tuyển chọn thẳng tắp xếp thành hai bè đều chằn chặn; bầu gỗ khảm tinh vi; 14 lam đồng nguyên chất.",
      structure: "Hai hàng ống song song cắm vào bầu gỗ thon. Dài từ 60cm đến 1,2 mét. Các lỗ bấm nằm đối xứng tiện lợi cho cả 10 ngón tay.",
      technique: "Thổi hít liên hoàn, phối hợp 10 đầu ngón tay bấm hợp âm đa thanh phong phú, vừa tấu giai điệu vừa giữ bè trầm rì rầm bên chum rượu cần.",
      keySkills: ["10 ngón bấm hợp âm bè đôi", "Thổi hít tuần hoàn đa âm", "Say đắm men rượu cần"],
      artForms: "Hội Hạn Khuống, Uống rượu cần đón xuân, Lễ hội Té Nước Bunpimay.",
      masters: "Nghệ nhân Lò Văn Pâng, các nghệ nhân kèn bè Mường Then.",
      repertoire: "Khúc Hát Trai Gái Đêm Trăng Mường Lò, Men Rượu Cần Say Lòng.",
      demoTracks: [
        { key: "traigai", title: "Khúc Hát Trai Gái Đêm Trăng Mường Lò", tempo: 230, notes: [0, 2, 3, 4, 5, 4, 3, 2, 4, 5, 6, 5, 4, 2, 0] }
      ]
    }
  };

  // Expose ra window để mọi script đều truy cập được
  window.INSTRUMENT_ENCYCLOPEDIA = ENCYCLOPEDIA;

})();
