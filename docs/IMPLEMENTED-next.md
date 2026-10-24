# Thực hiện PLAN-next

Đã xây và kiểm tra trên nhánh `save/learners-lam-avatar`. Mọi server thử dùng
`PORT=8791 XIAOYA_DATA_DIR=/tmp/misu-test`, không dùng dữ liệu học thật.

## Đã làm

- Mẫu câu bỏ qua ký hiệu A/B/V, giữ thứ tự và số lần các phần chữ Hán. Đã xác
  định thêm lỗi giải thích bằng tiếng Trung từ đầu ra thật và sửa prompt/feedback.
  Ba bài HSK1–2, 3–4, 5–6 qua kiểm tra cấu trúc với qwen3.5:4b.
- Thi tuần/tháng có ngân hàng theo người học, lịch đến hạn, phần từ, lỗi cũ,
  thanh điệu, nhiệm vụ chuyển tình huống và câu hỏi mở theo rubric. Lưu kết quả,
  điểm từng phần, so lần trước và lịch sử. Sai từ đưa về ôn sớm, lỗi tăng ưu tiên.
- Nhiệm vụ giao tiếp tối đa 4 lượt, gợi ý được ghi nhận. Kết quả mục tiêu phải
  có bằng chứng từ lời người học. Có nhiệm vụ ở tổng kết bài và thử lại trong bài thi.
- Kiểm tra hệ thống lần đầu và mở lại từ Cài đặt: runtime/model, ghi thử 3 giây,
  âm lượng/nghe lại, nhận dạng local, thử TTS có thông báo dự phòng, hội thoại mẫu.
- Phản hồi thanh điệu thận trọng và ghi chú biểu đồ chưa căn từng chữ.
- Bộ nạp bài đã duyệt ưu tiên `data/lessons-reviewed/`, rồi `lessons/reviewed/`;
  yêu cầu đúng level, thông tin người duyệt và kiểm tra cấu trúc.
- 10 bản nháp Misu tự soạn cộng 3 bài thử model trong `lessons/drafts/`.
  Không có bài nào được tuyên bố đã được người có chuyên môn duyệt.
- CONTRIBUTING, hai issue template, tải động hai renderer avatar, kết quả đo thô.
- GIF 30 giây từ thao tác thật bằng bàn phím: nhập câu → phản hồi/sửa lỗi → ôn từ, avatar hoạt hình mẫu.
- Sửa giọng macOS dự phòng dùng cùng bộ tìm ffmpeg với phần chấm thanh; kiểm tra thật tạo được MP3 khi Edge lỗi.
- Sửa chú thích quyền riêng tư cũ trong Cài đặt cho khớp dữ liệu đồng bộ server.

## Kiểm chứng

- 40 test qua; TypeScript và build qua. Bundle chính khoảng 653 KB trước gzip;
  renderer avatar thành các chunk chỉ tải khi dùng.
- UI thật: thiết lập lần đầu, mở lại Cài đặt, thi thiếu dữ liệu, thi có dữ liệu
  giả lập, bỏ qua thanh điệu chưa chấm, lưu lịch sử. Không thu giọng người thật.
- API thật với qwen3.5:4b: tạo tình huống, chấm 2 mục tiêu có dẫn chứng,
  chấm câu hỏi mở; payload sai bị trả 400.
- Sửa câu: 0/22 sửa nhầm; phát hiện 17/18; sửa khớp 16/18.
- Tingting: chữ rời đúng 35/40; từ hai chữ đúng 25/29 chữ chấm được, 3 chưa chấm.
  Đây là TTS và giọng dùng chỉnh ngưỡng, không đại diện người học thật.

## Phần cần tiếp tục ngoài kiểm tra tự động

- Người có chuyên môn duyệt các bản nháp: model từng dịch sai nghĩa từ thân
  thuộc dù qua validator. Validator chỉ kiểm tra cấu trúc, không bảo đảm sư phạm.
- Tình huống mới do model sinh có thể lệch vai hoặc mục tiêu; cần thử thực địa,
  prompt đã nhấn mạnh giữ cơ hội hoàn thành mọi mục tiêu. Câu mở đầu dùng lời chào cố định để không nói nhầm lời người học hoặc lộ đáp án.
- Chưa kiểm chứng cài đặt trên máy sạch khác. CI hiện có sẵn; kiểm tra hiện tại
  dùng dependencies đã cài trên máy. Không gắn nhãn phát hành.
- Chưa quay bản demo giọng nói thật 30–60 giây. Không giả lập số đo giọng người.
- Vạch âm tiết và phát lại từng đoạn thuộc phần “về sau” của PLAN-next.
