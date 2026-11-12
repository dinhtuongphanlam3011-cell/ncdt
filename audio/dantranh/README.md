# HƯỚNG DẪN CẤU HÌNH & BỔ SUNG FILE ÂM THANH ĐÀN TRANH (16 DÂY / 17-21 DÂY)

Hệ thống âm thanh của website **Đàn Tranh Online** đã được cấu hình sẵn sàng để tiếp nhận các tệp âm thanh thực tế (`.mp3`, `.wav`, `.ogg`) cho từng dây đàn của Đàn Tranh.

---

## 1. QUY TẮC ĐẶT TÊN TỆP ÂM THANH
Bạn có thể đặt tên tệp theo một trong hai cách chuẩn hóa dưới đây:

### Cách A: Đặt theo chỉ số dây (Khuyên dùng)
- `string_0.mp3` : Dây số 1 (Nốt Hò - D3 / 146.8 Hz)
- `string_1.mp3` : Dây số 2 (Nốt Xự - E3 / 164.8 Hz)
- `string_2.mp3` : Dây số 3 (Nốt Xang - G3 / 196.0 Hz)
- `string_3.mp3` : Dây số 4 (Nốt Xê - A3 / 220.0 Hz)
- `string_4.mp3` : Dây số 5 (Nốt Cống - B3 / 246.9 Hz)
- `string_5.mp3` : Dây số 6 (Nốt Líu - D4 / 293.7 Hz)
- `string_6.mp3` : Dây số 7 (Nốt Xự - E4 / 329.6 Hz)
- `string_7.mp3` : Dây số 8 (Nốt Xang - G4 / 392.0 Hz)
- `string_8.mp3` : Dây số 9 (Nốt Xê - A4 / 440.0 Hz)
- `string_9.mp3` : Dây số 10 (Nốt Cống - B4 / 493.9 Hz)
- `string_10.mp3`: Dây số 11 (Nốt Líu - D5 / 587.3 Hz)
- `string_11.mp3`: Dây số 12 (Nốt Xự - E5 / 659.3 Hz)
- `string_12.mp3`: Dây số 13 (Nốt Xang - G5 / 784.0 Hz)
- `string_13.mp3`: Dây số 14 (Nốt Xê - A5 / 880.0 Hz)
- `string_14.mp3`: Dây số 15 (Nốt Cống - B5 / 987.8 Hz)
- `string_15.mp3`: Dây số 16 (Nốt Líu - D6 / 1174.7 Hz)

### Cách B: Đặt theo tên nốt quốc tế
- `D3.mp3`, `E3.mp3`, `G3.mp3`, `A3.mp3`, `B3.mp3`
- `D4.mp3`, `E4.mp3`, `G4.mp3`, `A4.mp3`, `B4.mp3`
- `D5.mp3`, `E5.mp3`, `G5.mp3`, `A5.mp3`, `B5.mp3`
- `D6.mp3`

---

## 2. CƠ CHẾ HOẠT ĐỘNG
1. **Ưu tiên mẫu âm thanh thực**: Khi có file trong thư mục `audio/dantranh/` hoặc được Admin gán qua giao diện Server Audio, hệ thống sẽ phát âm thanh mộc tự nhiên từ file âm thanh này.
2. **Dự phòng thông minh (Fallback)**: Nếu một dây nào chưa có file, hệ thống tự động tổng hợp âm mộc ngũ cung (Physical Modeling Synth) qua Web Audio API, bảo đảm không bao giờ bị gián đoạn hay mất tiếng.
3. **Hiệu ứng Không gian (Acoustic Reverb)**: File âm thanh được định tuyến qua Convolver Reverb thính phòng và Master Gain Stereo tự nhiên.
4. **Đồng bộ đa thiết bị**: Cấu hình âm thanh lưu trên Server Cloud Relay, đồng bộ tức thời đến tất cả các máy tính và điện thoại.
