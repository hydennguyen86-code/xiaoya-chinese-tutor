# Kế hoạch tiếp theo, đợt 2 (bàn giao cho Codex)

Nhánh `save/learners-lam-avatar`. Các luật cũ vẫn áp dụng:
- Thử bằng `PORT=8791 XIAOYA_DATA_DIR=/tmp/misu-test node server/index.mjs`, không dùng `data/` thật.
- Không push.
- Không commit ảnh hay avatar làm từ người thật.
- Không chép nội dung sách.

Kiểm tra trước mỗi commit: `npm run typecheck && npm test && npm run build`.

## 0. BẮT BUỘC LÀM TRƯỚC: GIF demo có thể lộ avatar cá nhân

`docs/media/demo-keyboard.gif` (commit `4ee7042`) có thể đang hiện avatar cá nhân.
- Avatar trong GIF có tóc giống `brunette.glb` nhưng **không đeo kính và khác mặt**. Rất có thể đó là `public/avatars/personal.glb`, bản đã sửa theo ảnh người thật.
- Lý do: server luôn ưu tiên `personal*` khi file đó có trong `public/avatars/`, kể cả khi dùng thư mục dữ liệu tạm.

Cần làm:
1. **Thêm biến môi trường `XIAOYA_SAMPLE_AVATARS=1`** để `findAvatar` trong `server/index.mjs` bỏ qua `personal*` và chỉ dùng `brunette.glb` / `lam-sample.zip`. Ghi biến này vào README (phần Tuỳ chỉnh) và CONTRIBUTING (khi quay demo hoặc chụp màn hình).
2. **Xoá GIF khỏi lịch sử các commit chưa push.** Dùng `git filter-branch --index-filter 'git rm --cached --ignore-unmatch docs/media/demo-keyboard.gif' 841d68b..HEAD`, hoặc rebase lại hai commit `4ee7042` và `fd59f85`. Sau đó kiểm tra `git log --all -- docs/media/demo-keyboard.gif` không còn kết quả nào, ngoài các ref sao lưu `refs/original/`. Xoá các ref đó đi.
3. **Quay lại GIF bằng avatar mẫu** (`XIAOYA_SAMPLE_AVATARS=1`) và **tự xem từng khung hình** trước khi commit. Avatar mẫu 3D có đeo kính; LAM mẫu là `lam-sample.zip`.
4. **Thêm kiểm tra trong CI** (`.github/workflows/ci.yml`): build thất bại nếu repo chứa file có tên `mom*`, `personal*` hoặc ảnh/GLB/ZIP lạ ngoài danh sách cho phép (`brunette.glb`, `lam-sample.zip`, `favicon.svg`, các file trong `docs/media/`).

## 1. Định dạng lại code mới cho dễ đọc

Các file mới viết dồn nhiều lệnh trên một dòng:
- `Assessment.tsx`: 26 dòng dài hơn 160 ký tự.
- `SetupCheck.tsx`: 18 dòng.
- `CommunicationTask.tsx`, `src/lib/assessment.ts`, `server/assessment.mjs`: vài dòng mỗi file.

Người đóng góp trên GitHub sẽ khó đọc. Cần làm:
- Viết lại theo đúng phong cách các file cũ (như `DailyLesson.tsx`): mỗi prop hay mỗi state một dòng, tách hàm con, đặt tên rõ.
- Thêm Prettier (`printWidth: 140`, `singleQuote`) với script `npm run format` và `format:check`, chạy `format:check` trong CI. Chỉ format các file mới và các file sửa trong đợt này, để diff không phình to.

## 2. Thử với người học thật (quan trọng nhất về chất lượng)

Mọi số đo hiện có đều dùng giọng máy. Cần làm:
- **Màn hình ghi bộ đo cá nhân**:
  - Mỗi người học đọc 40 chữ và 16 từ trong `eval/tones.mjs`.
  - Bản ghi lưu trong `data/eval-recordings/<learner>/` (không commit).
  - Có thể tự đánh dấu "mình đọc đúng thanh" hoặc nhờ người giỏi nghe lại và gắn nhãn.
- **Mở rộng `eval/tones.mjs`** để chạy được trên thư mục bản ghi có nhãn (`--recordings=<dir>`), in ma trận nhầm lẫn và lưu vào `eval/results/` dưới dạng số tổng hợp, không kèm audio.
- **Chỉnh ngưỡng**: dựa trên số liệu thật này chỉnh ngưỡng `classifyIsolated`. Giữ test cũ và báo cáo trước/sau trong README.

## 3. Thanh điệu: vạch âm tiết và phát lại

- `analyseTones` trả thêm ranh giới âm tiết (mốc thời gian, lấy từ `segment()`), cho cả từ và câu. Câu dài cũng chia được theo số chữ.
- `ToneFeedback`:
  - Vẽ vạch dọc chia từng chữ trên biểu đồ, ghi chữ Hán dưới mỗi đoạn.
  - Bấm vào một chữ thì phát lại đúng đoạn đó của người học, cùng đoạn tương ứng của giọng mẫu. Client giữ blob đã ghi để phát lại.
- Có test cho phần trả ranh giới.

## 4. Kiểm tra cài đặt trên máy sạch

- **Script `scripts/smoke-test.sh`**: clone repo vào thư mục tạm, `npm ci`, build, chạy server bằng `XIAOYA_SAMPLE_AVATARS=1` và dữ liệu tạm. Sau đó gọi `/api/status`, `/api/syllabus`, `/api/tts`, kiểm tra avatar mẫu tải được, rồi dọn sạch.
- **Thêm vào CI** một job Linux chạy phần không cần Ollama.
- **Ghi vào README** các bước người dùng đã thử thật trên máy macOS khác (người dùng sẽ tự làm), kèm danh sách lỗi thường gặp: thiếu ffmpeg, thiếu cmake, Ollama chưa chạy, micro bị chặn.

## 5. Quy trình duyệt bài

- **Công cụ duyệt**: script `npm run review:lesson -- <file>` in bài nháp dạng dễ đọc (từ, nghĩa, ví dụ, pinyin, mẫu câu, nhập vai).
- **Duyệt xong**: người duyệt điền `reviewedBy`, `reviewedAt`, `notes` rồi chuyển file sang `lessons/reviewed/`. Validator từ chối file thiếu các trường này. Phần validator đã có, chỉ cần kiểm tra lại.
- **Ghi chú trong `lessons/README.md`**: bài nháp **chưa** được duyệt. Có danh sách lỗi đã biết, ví dụ model từng dịch sai nghĩa từ quen thuộc.
- **Hiển thị trong app**: bài "Đã duyệt" có nhãn riêng; bài nháp ghi "Bài do AI soạn, chưa được giáo viên duyệt".

## 6. Phát hành

Làm sau khi xong các mục 0–4:
- Cập nhật README: số đo mới nhất (đọc từ `eval/results/`), kèm ảnh chụp màn hình dùng avatar mẫu.
- Thêm `CHANGELOG.md` cho bản `v0.1.0`.
- Không tự tạo tag hay release, không push. Người dùng sẽ tự làm.
- Ghi lại các việc đã làm vào `docs/IMPLEMENTED-next-2.md`, kèm những gì chưa kiểm chứng được.
