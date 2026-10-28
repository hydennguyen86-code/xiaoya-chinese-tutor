# Bốn lộ trình nghe–nói thực tế

- Nhập môn Pinyin: 10 chủ đề × 1 buổi, khoảng 15 phút/buổi (thanh điệu, phụ âm,
  vận mẫu, biến điệu, thanh nhẹ, cặp dễ nhầm).
- [HSK 1: 12 chủ đề × 2 buổi](HSK1-GUIDE.md), khoảng 25 phút/buổi.
- HSK 3: 12 chủ đề × 2 buổi, khoảng 25 phút/buổi (tình huống đời thường: hỏi đường,
  gọi món, mua sắm, gọi điện, ốm, ngân hàng, xem phòng, khách sạn…).
- [HSK 5: 12 chủ đề × 2 buổi](HSK5-GUIDE.md), khoảng 30 phút/buổi.
- [Dạng thi tham khảo, nguồn chính thức và giới hạn](EXAM-ALIGNMENT.md).
- [Bảng đối chiếu từ vựng và ngữ pháp HSK theo từng cấp](HSK-COVERAGE.md) — do
  `node scripts/hsk-coverage.mjs` sinh ra, chỉ so trùng hình thức với danh sách mức
  của bên thứ ba, không chứng nhận đạt cấp.

Mỗi buổi có từ/cụm, pinyin, ví dụ và dịch, mẫu câu, bản nghe riêng, câu hỏi và
đáp án giải thích, nhiệm vụ nói và chuyển tình huống. Cuối bài 6 và 12 có đề
mini tự soạn. Buổi 2 không dùng lại bản nghe của buổi 1.

Trong app: **Bài hôm nay → Lộ trình học → Nhập môn Pinyin / HSK 1 / HSK 3 / HSK 5**.
Trình độ HSK1–2 mặc định mở Nhập môn Pinyin, HSK3–4 mặc định mở HSK 3; ai đang học
dở bài nào thì app đưa về đúng bài đó, không bị dịch chuyển. Có thể chọn
bài để xem trước. Phần **Hội thoại nhập vai** chứa bài nghe và luyện nói;
bản chép lời/đáp án nghe chỉ hiện sau khi nộp. Để làm đúng năng lực, nghe trước
khi trả lời; bộ đề là tài liệu mở nên không phải hệ thống thi có chống gian lận.

App mặc định nạp `syllabus.json` và các bài cố định ở thư mục này khi không có
mục lục riêng trong `data/syllabus/tiyan-hanyu-kouyu.json`. Không ghi đè dữ liệu
người học. Bài đã được người thật duyệt trong thư mục reviewed vẫn được ưu tiên.
Nếu tự dùng mục lục riêng, app giữ nguyên mục lục đó thay vì thay bằng khóa này.

Lộ trình độc lập: học hết Nhập môn Pinyin hoặc HSK 1 không tự nhảy sang khóa sau;
hết HSK 1 cũng không tự sang HSK 5. Có thể đổi lộ trình
và quay lại vị trí từng khóa. Phần nghe/câu hỏi cố định không cần LLM; nhận dạng
mic, TTS và nhập vai có yêu cầu riêng theo README gốc.

Trạng thái: **AI biên soạn và rà soát, chưa có giáo viên duyệt**. Đây là giai
đoạn thực hành đầu tiên, không phải toàn bộ khóa bảo đảm đạt chứng chỉ HSK.
