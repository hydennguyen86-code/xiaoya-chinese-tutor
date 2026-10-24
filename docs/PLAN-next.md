# Kế hoạch tiếp theo (bàn giao)

Nhánh: `save/learners-lam-avatar`. Chạy thử luôn trên server riêng với dữ liệu tạm, **không dùng `data/` thật**:
`PORT=8791 XIAOYA_DATA_DIR=/tmp/misu-test node server/index.mjs`. Kiểm tra trước khi commit: `npm run typecheck && npm test && npm run build`.
Không commit ảnh hay avatar cá nhân (`mom*`, `personal*`, `data/`). Không chép nội dung sách 《体验汉语口语》, chỉ dùng mục lục.

## 0. Việc đang dở (chưa commit)

- `scripts/setup-whisper.sh`: đã ghim whisper.cpp commit `231638a…`. Đã thử: tải về được.
- `server/lessonContent.mjs`: đã siết kiểm tra nội dung bài.
  - `isVi` đòi dấu tiếng Việt khi câu dài hơn 2 từ.
  - Ví dụ phải chứa đúng từ hoặc mẫu câu đang dạy.
  - Buổi 1 bắt buộc có đủ từ và mẫu câu của mục lục.
  - Nhập vai phải có nhiệm vụ; các bản dịch phải là tiếng Việt.
  - Cache có thêm trình độ và mã băm của mục lục (`CONTENT_VERSION`).
  - Nếu bài hỏng, gửi lỗi ngược lại cho model và cho thử tối đa 3 lần.
  - Test ở `server/lessonContent.test.mjs`: 5 test đều qua.
  - **Kết quả thử thật lần đầu**: bài HSK1-2 (`tam-so-cap` bài 2) bị từ chối sau 3 lần với lỗi "không có mẫu câu hợp lệ" (mất 63 giây). Hai bài còn lại chưa chạy xong vì server thử bị tắt giữa chừng.
  - **Phải sửa trước**:
    - Luật mẫu câu đang quá chặt: câu ví dụ phải chứa mọi phần cố định của mẫu câu. Nên in ra đầu ra thô của model để xem nó viết mẫu câu thế nào (ví dụ "……的时候" hay "A 跟 B 一起……"). Sau đó nới luật, chẳng hạn chỉ đòi phần chữ Hán dài nhất, bỏ qua A/B/V.
    - Hoặc chỉ loại mẫu câu hỏng, không loại cả bài khi còn ít nhất 1 mẫu câu đúng.
    - Rồi chạy lại 3 bài (HSK1-2, 3-4, 5-6) bằng qwen3.5:4b.
- `eval/record.mjs`: hai file `eval/corrections.mjs` và `eval/tones.mjs` giờ lưu kết quả thô vào `eval/results/` (ngày chạy, commit, model hoặc giọng). **Còn phải làm**: chạy cả hai bộ đo một lần rồi commit kết quả.

## 1. Thi tuần và thi tháng (ưu tiên cao nhất, người dùng yêu cầu)

- **Dữ liệu**: lưu ở `xiaoya.assess.v1:<learnerId>` (tự đồng bộ vào `data/` qua serverStore):
  `{ history: [{ kind: 'week'|'month', date, score, parts: {...}, canDo: [...] }] }`.
- **Lịch thi**:
  - Thi tuần đến hạn 7 ngày sau lần trước, hoặc sau ít nhất 3 buổi học.
  - Thi tháng đến hạn sau 30 ngày.
  - Nút "Kiểm tra" đặt cạnh nút "Bài hôm nay" (`.lesson-launch` trong `src/App.tsx`), sáng lên khi đến hạn.
- **Thi tuần (khoảng 6 phút)** — câu hỏi lấy từ chính dữ liệu học của người đó (`src/lib/learning.ts`: `dueWords`, `topMistakes`, vocab của các bài trong tuần):
  - Khoảng 6 câu: hiện nghĩa tiếng Việt, người học nói từ tiếng Trung.
  - 2 câu: lỗi cũ, người học nói lại cho đúng.
  - 2 câu đọc từ có chấm thanh điệu: dùng `listen({ pronounce })` và `ToneFeedback`.
  - 1 nhiệm vụ giao tiếp (xem mục 2).
- **Thi tháng (khoảng 15 phút)**:
  - 15 từ trong tháng, 4 lỗi cũ, 4 câu đọc có chấm thanh điệu.
  - 2 nhiệm vụ giao tiếp ở **tình huống mới**, khác với lúc học: kiểm tra xem người học có dùng được kiến thức ở chỗ khác không.
  - 1 câu hỏi mở, model chấm theo thang (trôi chảy, chính xác, độ phức tạp). Ghi rõ đây là ước lượng.
- **Sau khi thi**:
  - Hiện điểm từng phần và so với lần trước.
  - Câu sai được đưa vào ôn sớm: `reviewWord(p, word, false)`; lỗi được tăng ưu tiên.
  - Có màn hình lịch sử điểm theo thời gian.
- **Code**:
  - Logic thuần (`planWeekly`, `planMonthly`, `isDue`, `score`) đặt trong `src/lib/assessment.ts`, kèm test `src/lib/assessment.test.ts`.
  - Giao diện ở `src/components/Assessment.tsx`. Tái dùng `MicButton`, `Han`, `ToneFeedback` và cách `ask/read` trong `DailyLesson.tsx` (có thể tách ra file dùng chung).

## 2. Nhiệm vụ giao tiếp ("mình làm được gì?")

- **Đề bài**: một nhiệm vụ bằng tiếng Việt lấy từ `roleplay.goals` của các bài đã học. Ví dụ: "Gọi một món, hỏi giá, yêu cầu ít cay". Khi làm bài **không hiện câu mẫu**.
- **Hội thoại**: avatar đóng vai, người học trả lời tối đa khoảng 4 lượt. Dùng `streamChat` với `scenario`, giống `RoleplaySection` trong `DailyLesson.tsx`. Có nút "Gợi ý": hiện một mẫu câu và ghi lại là đã dùng gợi ý.
- **Chấm**: endpoint mới `POST /api/assess-task` trong `server/index.mjs`, nhận `{goals, learnerTurns, provider, model}`. Model trả về theo JSON schema (giống cách `collectCorrections` gọi model), mỗi mục tiêu một kết quả `{ status: 'done'|'partly'|'missing', evidence }`.
- **Kết quả**: mỗi mục tiêu được xếp vào 3 mức: **Tự làm được** / **Làm được khi có gợi ý** / **Cần luyện lại**.
- **Thêm vào bài hằng ngày**: phần "Tổng kết" của `DailyLesson.tsx` có thêm một nhiệm vụ ngắn.
- **Thử lại**: sau 3–5 ngày, thi tuần thử lại nhiệm vụ đó bằng một tình huống khác.
- **Test**: chuẩn hoá kết quả model trả về (thiếu trường, sai giá trị thì coi là "missing").

## 3. Màn hình kiểm tra hệ thống (lần chạy đầu)

- `src/components/SetupCheck.tsx`, mở lần đầu hoặc từ phần Cài đặt. Có 5 bước:
  1. Ollama hoặc LM Studio đã chạy chưa, model nào có sẵn (lấy từ `/api/status` → `providers`).
  2. Micro: xin quyền, hiện thanh âm lượng, ghi thử 3 giây.
  3. Nhận dạng giọng nói chạy trên máy hay qua trình duyệt (`localStt`). Nếu chưa có thì hướng dẫn chạy `npm run setup:whisper`.
  4. Nghe thử một câu (TTS). Báo nếu đang dùng giọng dự phòng của macOS.
  5. Nút "Thử hội thoại mẫu", rồi "Bắt đầu bài đầu tiên".
- Mỗi bước có trạng thái đạt / chưa đạt, kèm cách sửa bằng tiếng Việt.

## 4. Phát âm: trình bày thận trọng hơn

- **Lời khen** trong `src/components/ToneFeedback.tsx`: đổi "Thanh điệu chuẩn rồi!" thành "Lần này Misu nghe các thanh khớp với mẫu."
- **Ghi chú chung**: chấm tự động mới được thử trên giọng máy, nên xem là gợi ý.
- **Biểu đồ**: ghi rõ hai đường được kéo về cùng độ dài, chưa căn theo từng chữ, nên đọc nhanh hay chậm khác nhau cũng làm đường lệch.
- **Về sau**:
  - Thêm vạch chia âm tiết: dùng `segment()` trong `server/tones.mjs` và trả về ranh giới.
  - Thêm nút phát lại từng đoạn.
- **README**:
  - Đổi câu "Mô hình lớn hơn sẽ tốt hơn" thành "Mô hình khác cần được đo riêng bằng cùng bộ thử".
  - Dẫn tới `eval/results/`.

## 5. Bộ bài chuẩn được duyệt (cần người giỏi tiếng Trung)

- **Cách nạp**: nếu có file `data/lessons-reviewed/<volumeId>-<lessonNo>-d<day>.json` thì `getLessonContent` dùng file đó trước khi gọi AI, và đánh dấu `reviewed: true` để giao diện ghi "Đã duyệt".
- **Tạo bản nháp**: soạn sẵn 10–14 bài bằng AI rồi đưa người có chuyên môn duyệt. **Đừng ghi "đã duyệt" khi chưa có người duyệt thật.**
- **Mã nguồn mở**: bộ bài tự soạn (không chép sách) có thể đặt trong `lessons/` để commit, cho người mới clone xem ngay chất lượng nội dung.

## 6. Việc nhỏ cho GitHub

- **Tài liệu đóng góp**:
  - `CONTRIBUTING.md`: cách đóng góp bài học và cách chạy bộ đo.
  - `.github/ISSUE_TEMPLATE/`: hai mẫu "AI sửa sai" và "Bài học có lỗi".
- **Tải avatar khi cần**: dùng `import()` động cho `@met4citizen/talkinghead` và `@myned-ai/gsplat-flame-avatar-renderer` trong `src/components/AvatarStage.tsx`. Bundle hiện khoảng 2,4 MB trước nén.
- **GIF demo** 30–60 giây ở đầu README, quay bằng **avatar mẫu** (không dùng mặt người thật): nói → phản hồi → sửa lỗi → ôn.
- **Thử cài trên máy sạch** trước khi gắn nhãn phát hành. CI (typecheck, test, build) đã có trong `.github/workflows/ci.yml`.
