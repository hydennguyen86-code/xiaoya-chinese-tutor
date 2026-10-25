# Changelog

## v0.1.0 — Chưa phát hành

Bản dự kiến, chưa tạo tag/release và chưa push. Cần bộ ghi âm người học thật
có nhãn và kiểm tra cài đặt trên máy macOS thứ hai trước khi kết luận sẵn sàng.

- Hai lộ trình HSK 1/HSK 5 thực tế: 48 buổi tự soạn, nghe hiểu, nói, kiểm tra chặng và hướng dẫn học. Chưa được giáo viên duyệt, không phải đề thi chính thức.
- Kiểm tra tuần/tháng theo lịch sử từng người học, mục tiêu giao tiếp và kiểm tra thiết lập.
- Bộ thu 40 chữ/16 từ, nghe lại, gắn nhãn self/expert, đánh giá bản ghi local với kết quả tổng hợp.
- Mốc âm tiết ước lượng cho từ/câu, biểu đồ chia chữ và phát lại bản ghi rồi đoạn giọng mẫu.
- Công cụ review:lesson, metadata reviewedBy/reviewedAt/notes bắt buộc cho bài đã duyệt, nhãn rõ trong app.
- Chế độ avatar mẫu, thay GIF cũ và loại khỏi lịch sử nhánh, kiểm tra allowlist asset trong CI.
- Prettier có phạm vi, smoke-test từ clone sạch, job Linux và hướng dẫn xử lý lỗi cài đặt.

Ngưỡng chấm thanh giữ nguyên. Số TTS cũ không thay thế đánh giá giọng người thật.
- Cập nhật bản vá body-parser trong lockfile sau cảnh báo DoS của npm audit.

## 2026-10-25 — Học liệu và phản hồi phát âm

- Thêm 30 bài giao tiếp HSK1–6, giữ 48 buổi thực tế cũ; nhãn AI soạn, chưa duyệt.
- Nghe của bài: 198 câu dictation/48 đoạn shadowing, giữ pinyin và biến điệu.
- Nhãn sửa kết quả thanh lưu riêng; Cài đặt có số mẫu. Import bản thu tại chỗ; chưa đủ nhãn 56 mục nên không chỉnh ngưỡng.
- Tra kVietnamese theo chữ và mẹo AI riêng, không khẳng định âm Hán Việt chuẩn theo ngữ cảnh.
- Giữ sửa ngữ pháp Claude; dọn gợi ý chồng, PCM dùng chung, lý do thiếu fluency, lịch ôn và vòng đời audio. Phát lại giới hạn 5 lượt/20 MB RAM.
- README có định vị riêng tư/ảnh mẫu; Git chặn audio riêng, build kiểm dist.
- Smoke clone sạch qua build/API/khóa học/avatar mẫu/TTS. Chưa thử Windows thật, phần cứng hay thẩm định sư phạm.
