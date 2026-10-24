# Đóng góp cho Misu

Cài Node.js 24, `npm ci`. Kiểm tra trước khi gửi PR:

```sh
npm run typecheck
npm test
npm run build
```

Chạy server thử với dữ liệu riêng, không dùng hồ sơ thật:

```sh
PORT=8791 XIAOYA_DATA_DIR=/tmp/misu-test XIAOYA_SAMPLE_AVATARS=1 node server/index.mjs
```

Khi chụp màn hình hoặc quay demo, bắt buộc đặt `XIAOYA_SAMPLE_AVATARS=1`.
Server chỉ chọn `brunette.glb` (avatar đeo kính) hoặc `lam-sample.zip`.
Dùng hồ sơ giả, kiểm tra từng khung hình trước khi thêm vào `docs/media/`.
Chạy `node scripts/check-public-assets.mjs`; kiểm tra tự động không thay thế việc xem ảnh.

## Đóng góp bài học

Chỉ dùng nội dung tự soạn; không chép hoặc viết lại hội thoại, bài tập của sách.
Mục lục mẫu: `docs/syllabus.example.json`. Có thể thêm bản nháp vào
`lessons/drafts/`. Mỗi bài theo cấu trúc `LessonContent` trong `src/lib/lessonApi.ts`.
Ghi rõ trình độ, mục tiêu, nguồn do bạn tự soạn và trạng thái chưa duyệt.

Chỉ khi có người đủ năng lực tiếng Trung kiểm tra nội dung, pinyin, bản dịch,
độ khó và mục tiêu giao tiếp, mới chuyển bài sang `lessons/reviewed/` với tên
`<volumeId>-<lessonNo>-d<day>.json`, `level`, `reviewed: true`,
`reviewedBy: "Tên người duyệt"`, `reviewedAt: "YYYY-MM-DD"`,
`notes: "Đã kiểm tra những gì, đã sửa những gì"`.
Chạy `npm run review:lesson -- <file>` để đọc đủ từ, nghĩa, pinyin, mẫu câu,
nhập vai, bài nghe/nói; sau khi điền metadata chạy lại với `--check`.
Cấu trúc cũ `review: { reviewer, date }` cần được người duyệt bổ sung metadata
mới, không tự động nâng trạng thái.
Mã tập/bài phải khớp mục lục. Có thể nạp bài cá nhân tương tự ở
`data/lessons-reviewed/`. Hệ thống ưu tiên bài đã duyệt có đúng trình độ và
qua kiểm tra cấu trúc. Không gắn nhãn đã duyệt cho nội dung chỉ được AI kiểm tra.

## Đo chất lượng

Trên server thử đang chạy, có Ollama và model tương ứng:

```sh
node eval/corrections.mjs qwen3.5:4b http://127.0.0.1:8791
node eval/tones.mjs http://127.0.0.1:8791 --say=Tingting
node eval/lessons.mjs http://127.0.0.1:8791
```

Giọng `--say` chỉ có trên macOS. Dùng `--voice=<Edge voice>` trên nền tảng khác.
Kết quả ở `eval/results/` lưu thời điểm, commit, cấu hình và số đo. Ghi rõ nếu
ngưỡng được chỉnh dựa trên bộ thử; không coi kết quả TTS là độ chính xác trên
người thật. Không đưa dữ liệu người học, ảnh, giọng cá nhân hoặc nội dung sách
vào PR. Mẫu báo lỗi trong GitHub Issues giúp tái hiện lỗi AI và bài học.
