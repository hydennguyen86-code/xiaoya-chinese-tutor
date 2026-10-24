# Bài học tự soạn

`drafts/` là bài AI soạn **chưa được người có chuyên môn duyệt**. Bản nháp không
tự động được dùng làm bài đã duyệt. `reviewed/` chỉ chứa bài đã có người duyệt
và thông tin người duyệt/ngày duyệt. Hiện chưa tuyên bố có bài đã duyệt.

Xem [hướng dẫn đóng góp](../CONTRIBUTING.md) để nạp bài. Không chép nội dung sách.

Bộ `misu-original` có 10 bản nháp tự soạn, mỗi bài 8 từ, một mẫu câu và nhiệm vụ.
Chúng là điểm xuất phát để người có chuyên môn duyệt, chưa phải khóa học hoàn chỉnh.
`drafts/syllabus.json` là mục lục tương ứng, cũng chưa duyệt. Những file mang mã
`tam-*` là đầu ra thử trực tiếp qwen3.5:4b; có thể chứa lỗi dịch nghĩa dù qua kiểm
tra cấu trúc, không dùng làm đáp án chuẩn.

Khóa đang dùng trong app: [hai lộ trình nghe–nói cố định](courses/README.md).
Các file `drafts/` vẫn là bản thử cũ để tham khảo, không thay thế bộ bài mới.
## Duyệt một bài

```sh
npm run review:lesson -- lessons/courses/hsk1-practical-1-d1.json
# Sau khi người có chuyên môn sửa và điền đủ metadata:
npm run review:lesson -- /duong-dan/ban-da-duyet.json --check
```

Người duyệt kiểm tra nghĩa theo ngữ cảnh, pinyin/thanh nhẹ/biến điệu, bản dịch,
độ tự nhiên, độ khó, đáp án nghe và mục tiêu nhập vai. Công cụ chỉ kiểm tra
cấu trúc; pinyin tự tính không bảo đảm xử lý đúng mọi từ đa âm.
Điền `reviewed: true`, `level`, `reviewedBy`, `reviewedAt` (YYYY-MM-DD hoặc ISO
UTC), `notes` không rỗng mô tả phần đã kiểm tra và sửa, rồi đặt tên
`<volumeId>-<lessonNo>-d<day>.json` trong `lessons/reviewed/`.
Validator không nhận metadata cũ `review: {reviewer, date}` nếu thiếu các trường
mới. Không tự điền tên giáo viên, ngày duyệt hoặc đánh dấu đã duyệt bằng AI.
App luôn ghi rõ “Bài do AI soạn, chưa được giáo viên duyệt” cho bài chưa duyệt.

Lỗi đã thấy trong các bản nháp thử model (giữ nguyên làm bằng chứng, không làm đáp án chuẩn):

- `亲戚` từng bị dịch thành “họ hàng xa”; nghĩa đúng là “họ hàng”, không chỉ người họ xa.
- `攀比` từng bị dịch thành “soi mó, so sánh với người khác để tự ti”; cần hiểu là so bì, đua đòi hơn thua, không mặc định tự ti.
- Qua kiểm tra cấu trúc không có nghĩa đã đúng ngữ nghĩa. Xem `docs/REVIEW-learning-materials.md`.
