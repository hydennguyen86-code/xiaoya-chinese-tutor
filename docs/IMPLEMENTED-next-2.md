# Thực hiện PLAN-next-2

Ngày 2026-10-24. Không push, không tag, không release.

## 0 — xử lý trước tiên

- Viết lại hai commit local để loại GIF cũ, giữ các thay đổi giáo trình đang làm.
  `git log --all -- docs/media/demo-keyboard.gif` rỗng trước khi thêm GIF thay thế.
  Không tạo refs/original. Commit cũ không còn được nhánh hiện tại tham chiếu;
  object/reflog local có thể còn cho tới khi Git tự dọn, không được đẩy lên remote.
- `XIAOYA_SAMPLE_AVATARS=1` chỉ chọn brunette.glb/lam-sample.zip, có hướng dẫn README/CONTRIBUTING.
- Quay mới ba khung bằng hồ sơ giả trên cổng 8791, dữ liệu /tmp/misu-test;
  xem cả ba khung GIF sau mã hoá: đều là avatar mẫu đeo kính.
- CI kiểm tra allowlist asset, từ chối tên mom*/personal* kể cả trong docs/media.
  Ảnh trong docs/media vẫn cần người xem thủ công.

## 1 — định dạng

Prettier printWidth 140, singleQuote, scripts format/format:check và CI.
Phạm vi file liệt kê trong scripts/format.mjs, không format lại toàn repo hay bộ JSON bài học.

## 2 — bộ đo người thật

Đã có giao diện 56 mục, lưu audio riêng theo người học trong thư mục dữ liệu,
nghe lại và gắn nhãn self/expert có tên người đánh giá. Ghi lại làm mất nhãn cũ.
CLI --recordings chỉ lưu ma trận và số tổng hợp, tách nguồn nhãn.
Chưa thu âm người thật; chưa có kết quả người thật; không sửa classifyIsolated.
Khoảng giọng dùng cùng bộ ghi, không được gọi đây là kiểm định độc lập.

## 3 — mốc và phát lại

Từ/câu trả timestamp từ segment(), biểu đồ chia chữ, client giữ blob trong bộ
nhớ để phát đoạn người học rồi giọng mẫu. Mốc là ước lượng năng lượng, không
phải forced alignment; nếu đọc thiếu chữ có thể cắt lệch. Test WAV nhân tạo
kiểm tra số mốc, thứ tự, giới hạn thời gian, không đo chất lượng trên người thật.

## 4 — cài sạch

Script clone tạm, npm ci/build, status/syllabus/avatar/TTS và dọn sạch;
CI Linux không đòi model. Chế độ TTS thường báo rõ nếu chỉ kiểm tra được lỗi;
SMOKE_REQUIRE_TTS=1 bắt buộc có audio. Chưa chạy trên máy macOS thứ hai.
Kết quả chạy local sẽ bổ sung sau khi clone bản commit.
