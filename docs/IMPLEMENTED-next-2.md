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

Kết quả mục 4: clone local từ commit `905133f` trên máy hiện tại, chạy
`SMOKE_REQUIRE_TTS=1 bash scripts/smoke-test.sh` thành công: npm ci, build,
status, syllabus, brunette.glb, lam-sample.zip, TTS tạo được audio.
Runtime đi kèm Codex (Node/npm), không phải máy macOS thứ hai. Linux job
đã viết nhưng chưa chạy trên GitHub vì không push. Build còn cảnh báo bundle >500 KB.

## 5 — duyệt bài

`npm run review:lesson -- <file>` in từ/nghĩa/pinyin/ví dụ/mẫu câu/nhập vai,
cả nghe/nói và checkpoint nếu có. `--check` bắt buộc reviewedBy/reviewedAt/notes
và reviewed:true. Loader dùng cùng validator; metadata review cũ phải được
người duyệt bổ sung. Test từ chối thiếu trường/ngày sai. Không bài thật nào
được tự gắn nhãn đã duyệt. UI phân biệt đã duyệt và bài AI chưa được giáo viên duyệt.

## 6 — chuẩn bị, chưa đủ điều kiện phát hành

README chỉ giữ số đo có file trong eval/results; bỏ bảng bốn giọng không có
file lưu, không tạo số đo mới. Có GIF avatar mẫu đã xem từng khung.
CHANGELOG v0.1.0 để trạng thái chưa phát hành. Không tạo tag/release/push.
Mục 2 còn cần người thật ghi và gắn nhãn; mục 4 còn cần máy macOS thứ hai.
Đây là phần cần người dùng thực hiện, không thể thay bằng audio giả hoặc tự
xác nhận đã kiểm chứng. Ngưỡng chưa chỉnh, chưa có số trước/sau mới.

Bổ sung khi kiểm tra cài đặt: npm audit báo body-parser bản cũ có cảnh báo
DoS mức high. Đã cập nhật bản vá tương thích trong lockfile; audit sau cập
nhật báo 0 lỗ hổng. Không thay ngưỡng chấm hay model.
