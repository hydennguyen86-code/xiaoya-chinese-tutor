# Changelog

## 2026-10-30 — Bản tạm

- Thêm mục “Model cloud qua API” trong Cài đặt: nút điền sẵn VietAPI (https://api.vietapi.tech/v1 · gemini-4-argon), link lấy key/nạp credit, nút Kiểm tra kết nối. Key chỉ lưu trên máy chủ.
- Chia việc theo model: trò chuyện, phân tích điểm yếu và chấm bài mặc định đi cloud; model máy (7B) lo việc nhẹ như soạn bài tự sinh. Bắt lỗi ngay khi nói mặc định không gọi cloud (bộ luật lỗi hay gặp + model máy nếu có); ghi âm vẫn lưu để phân tích sau. Có thể bật/tắt từng việc. Máy không chạy model nào thì các việc khác tự chuyển sang cloud.
- API cloud trả lời dạng streaming để gia sư nói sớm hơn; nới max_tokens cho model có suy luận; báo lỗi rõ: sai key, hết credit, sai mã model, quá giới hạn, dịch vụ lỗi.
- Thêm trạng thái cloud API: chấm xanh/vàng/đỏ, nút Ping miễn phí (GET /models), tự ping khi mở Cài đặt và mỗi 5 phút; nút “Thử trả lời 1 câu”.
- Dùng trên điện thoại qua Tailscale Serve: server chấp nhận tên máy *.ts.net khai báo trong XIAOYA_PROXY_HOSTS (chỉ khi yêu cầu đi qua loopback).
- Bản phân tích điểm yếu mới nhất được đưa vào cách dạy hằng ngày (trọng tâm, từ trọng tâm, lỗi phát âm hay nhầm); gia sư chủ động tạo tình huống để luyện lại đúng chỗ hay sai.
- Phân tích bằng cloud đọc nhiều dữ liệu hơn: câu gốc của người học, lỗi phát âm/thanh điệu, và so với bản phân tích trước để thấy điểm nào đã giảm, điểm nào còn lặp. Lưu 12 bản phân tích gần nhất (trước là 4).
- Tải trang nhanh hơn trên điện thoại: server nén gzip file JS/CSS/mô hình 3D (JS 1,2 MB → 0,4 MB, avatar 4,6 MB → 2,7 MB) và cho file có mã băm lưu cache 1 năm, nên các lần mở sau gần như không tải lại. Không cần cài thêm thư viện.
- Lỗi từ API cloud giờ kèm lý do ngắn do dịch vụ trả về (đã che key và chuỗi giống khoá; lỗi sai key không trích lại nội dung).
- Đổi cách chia việc: trò chuyện và chấm bài mặc định dùng model máy (nhanh, miễn phí), model cloud chỉ phân tích lại dữ liệu đã lưu. Áp dụng một lần cho trình duyệt đã lưu cách chia cũ; vẫn bật lại từng việc được trong Cài đặt.
- Tab Phân tích có 3 biểu đồ tính từ dữ liệu đã lưu (không cần gọi AI): lỗi mỗi 10 lượt nói trong 14 ngày (so tuần này với tuần trước), lỗi hay gặp theo nhóm, và điểm yếu lặp lại qua các bản phân tích. Có xem dạng bảng và chi tiết khi rê/chạm.
- API báo “không có channel khả dụng” giờ hiện đúng là model tạm không có nguồn phục vụ, thay vì nói sai URL.

## 2026-10-27 — Bản tạm

- Thêm Bảng động lực dùng dữ liệu từng học viên: lượt trò chuyện, chuỗi ngày, buổi hoàn thành và XP; phân biệt hồ sơ trùng tên, không xếp hạng trình độ.
- Thẻ từ thanh nhẹ như 吗 chấp nhận tạm thời chữ nhận dạng có cùng âm tiết, đồng thời nói rõ máy chưa xác nhận được thanh nhẹ. Bài đọc câu giữ cách so sánh riêng; thông báo lỗi âm thanh vẫn được hiển thị.
- Bổ sung 10 bộ nghe cho lộ trình Nhập môn Pinyin, đưa tổng số bộ nghe theo bài lên 82; học liệu do AI soạn và chưa có giáo viên duyệt.
- Thêm hồ sơ giới tính người học và lựa chọn giáo viên Tiểu Nhã hoặc Misu; đồng bộ tên, giọng và ngữ cảnh hội thoại theo lựa chọn, cùng các chỉnh sửa giao diện học.
- Nhận dạng chữ và khẩu hình chỉ là hỗ trợ luyện tập. Việc chấm thanh nhẹ và chất lượng nhận dạng từ giọng người học thực tế vẫn cần được kiểm tra thêm.

## 2026-10-26 — Bản tạm

- Giảm biên độ há miệng của avatar LAM; âm lượng không còn ép mở môi ở âm khép. Phân biệt khẩu hình a, i, u, ü và các phụ âm tiếng Trung theo pinyin. Khẩu hình vẫn dùng mốc TTS/ước lượng, chưa phải đồng bộ phoneme chính xác.
- Thêm lộ trình nhập môn Pinyin (10 buổi) và HSK 3 thực tế (24 buổi), nâng tổng số buổi đóng gói lên 82; giữ vị trí học đã lưu. Thêm 34 bộ nghe dictation/shadowing cho hai khoá mới (24 HSK 3, 10 Pinyin), tổng 82 bộ/416 id. Học liệu AI soạn, chưa có giáo viên duyệt.
- Thêm giọng nam Yunjian và Yunxi, chọn giọng Edge theo giới tính khuôn mặt; giữ nguyên giọng nhân bản khi đã chọn.
- Phản hồi thanh điệu không chấm sai những âm đo chưa đủ chắc; làm rõ trạng thái chưa chấm trong giao diện.

## v0.1.0 — Chưa phát hành

Bản dự kiến, chưa tạo tag/release. Cần bộ ghi âm người học thật
có nhãn và kiểm tra cài đặt trên máy macOS thứ hai trước khi kết luận sẵn sàng.

- Bốn lộ trình Nhập môn Pinyin, HSK 1, HSK 3 và HSK 5: 82 buổi tự soạn, nghe hiểu, nói, kiểm tra chặng và hướng dẫn học. Chưa được giáo viên duyệt, không phải đề thi chính thức.
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

### Rà soát vòng 2

- Giữ L1/T3/T4 của Claude. Bổ sung kiểm calibration, incomplete/badCut, coverage dùng được và cổng đủ 56 mục; tách nguồn self/peer/expert.
- Phản hồi gắn mục/bản thu và cập nhật theo người nghe; server tự tính phần máy. Có xuất ZIP/xoá bộ thu theo hồ sơ.
- Fallback STT khi ffmpeg lỗi, lý do fluency rõ và sửa grammar theo vị trí thật.
- Chọn rõ 30 bài giao tiếp, giữ mặc định cũ; metadata nguồn qua patch idempotent. Có README tiếng Anh.
- Audit grammar tách exact/partial; nhãn peer tại chỗ vẫn chỉ 55/56 nên không chỉnh ngưỡng. Chưa xác minh chuyên môn nhãn hay Windows/điện thoại thật.
