# Kế hoạch đợt 3: để nhiều người Việt học tiếng Trung dùng được

Hiện trạng ngày 2026-10-24, nhánh `save/learners-lam-avatar`, commit `c17f84b`:
- 54 test qua, build qua.
- GIF demo dùng avatar mẫu.
- Lịch sử commit không còn GIF cũ.

Luật cũ vẫn giữ:
- Thử bằng `XIAOYA_DATA_DIR` tạm và `XIAOYA_SAMPLE_AVATARS=1`.
- Không push.
- Không đưa ảnh hay giọng người thật vào repo.
- Không chép sách.
- Không tự gắn nhãn "đã duyệt".

Rào cản lớn nhất bây giờ không nằm ở tính năng mà ở **chỗ chạy được**. App hiện cần macOS, Node 24, Ollama và máy đủ mạnh. Trong khi đó, phần lớn người Việt học tiếng Trung dùng **laptop Windows cấu hình vừa phải** hoặc **điện thoại**. Vì vậy các việc được xếp theo mức độ mở rộng số người dùng được.

## A. Chạy được trên máy của số đông (ưu tiên 1)

1. **Sửa giọng đọc Edge.** Hiện lỗi `Unexpected server response: 200` dù `msedge-tts` đã ở bản mới nhất (2.1.0). Có thể Microsoft đã đổi cách xác thực (`Sec-MS-GEC`).
   - Tìm nguyên nhân thật; tự cài phần xác thực hoặc đổi sang thư viện còn chạy được.
   - Viết test gọi thật nhưng tách khỏi CI.
   - Giọng Edge là giọng chính trên mọi hệ điều hành. Đang hỏng thì máy Windows/Linux **không có giọng nào**, vì giọng dự phòng `say` chỉ có trên macOS.
2. **Thêm giọng dự phòng cho mọi hệ điều hành**:
   - Phía trình duyệt: dùng `speechSynthesis` với giọng `zh-CN` (Chrome, Edge, Android đều có), kèm thông báo nguồn giọng.
   - Về sau có thể thêm TTS offline chạy được mọi nơi (ví dụ sherpa-onnx), nhớ kiểm tra giấy phép model.
3. **Hỗ trợ Windows**:
   - Viết `scripts/setup-whisper.ps1`: tải bản whisper.cpp dựng sẵn cho Windows ở đúng phiên bản đã ghim, cùng model; ffmpeg qua `winget`.
   - `server/stt.mjs` và `mediaTools.mjs` phải nhận đường dẫn `.exe`.
   - Rà mọi chỗ ngầm định macOS: `say`, `~/.local/bin`, đường dẫn kiểu POSIX.
   - CI chạy ma trận `ubuntu`, `windows`, `macos`.
4. **Tạo file khởi động bấm-đúp**: `start-windows.bat` và `start-mac.command`. File này:
   - kiểm tra Node, `npm ci` lần đầu, build;
   - kiểm tra Ollama, gợi ý `ollama pull` đúng model;
   - mở trình duyệt.

   Thông báo lỗi bằng tiếng Việt, kèm link hướng dẫn.
5. **Hỗ trợ máy yếu hoặc không có GPU**:
   - Thêm nhà cung cấp kiểu "OpenAI-compatible" (người dùng tự nhập URL và API key của mình, ví dụ OpenRouter, Groq, Gemini qua cổng tương thích, DeepSeek). Hiện cảnh báo rõ: câu nói của người học sẽ gửi lên dịch vụ đó. Key lưu trong thư mục dữ liệu, không bao giờ trả về trình duyệt và không ghi vào log.
   - Màn hình kiểm tra hệ thống gợi ý model theo RAM.
   - Phải đo lại sửa câu (`eval:corrections`) cho từng model trước khi ghi model đó vào README.
6. **Dùng trên điện thoại cùng mạng Wi-Fi**:
   - Chế độ `HOST=0.0.0.0` có HTTPS tự ký (micro trên điện thoại chỉ chạy qua HTTPS), có mã PIN, và mã QR trong Cài đặt để mở trên điện thoại.
   - Mặc định vẫn chỉ cho chính máy mở (`127.0.0.1`).
   - Thêm manifest PWA để "cài" lên màn hình chính.
   - Kiểm tra giao diện ở độ rộng 375px.

## B. Giá trị riêng cho người Việt (ưu tiên 2)

7. **Âm Hán Việt cho mỗi từ** (ví dụ 学习 → học tập), cộng **cảnh báo "bẫy Hán Việt"** khi nghĩa tiếng Trung khác nghĩa thường hiểu (爱人, 东西, 新闻, 告诉, 工作…).
   - Dữ liệu chữ lấy từ trường `kVietnamese` của Unicode Unihan (giấy phép Unicode, dùng được). Ghi nguồn trong NOTICE.
   - Chữ có nhiều âm thì hiện tất cả hoặc đánh dấu chưa chắc. Danh sách bẫy thì tự soạn, gắn nhãn chưa duyệt.
   - Hiện trong thẻ từ, mục ôn tập và sổ từ.
8. **Luyện phát âm theo lỗi người Việt hay mắc**:
   - Các cặp dễ lẫn: zh/ch/sh/r với z/c/s, j/q/x, ü, an/ang, en/eng, in/ing, uan/uang; thanh 2 và thanh 3; biến điệu 3-3.
   - Bài **nghe rồi chọn** (không phụ thuộc độ chính xác của bộ nhận dạng), sau đó ghi âm để so.
   - Ghi chú so sánh với thanh tiếng Việt, nói rõ chỉ là gần đúng.
9. **Bài kiểm tra xếp lớp lúc mới vào**:
   - Khoảng 10 phút, dùng lại phần thi tuần/tháng, để tự đề xuất trình độ thay vì bắt người học tự chọn.
   - Có lối "mới bắt đầu" dẫn vào phần nhập môn pinyin và thanh điệu (bản rà soát đã chỉ ra phần này còn thiếu).
10. **Chữ phồn thể và chế độ Đài Loan**:
    - Bật/tắt giản thể ↔ phồn thể; có thể hiện chú âm.
    - Chọn giọng TTS `zh-TW`; ghi chú các từ khác giữa Đài Loan và Đại lục.
    - Nhiều người Việt học để đi làm hoặc du học ở Đài Loan.
11. **Lộ trình theo mục đích**: tiếng Trung đi làm công xưởng, bán hàng hoặc nhập hàng (Taobao/1688), du lịch, du học/HSK.
    - Dùng chung cơ chế khoá học `lessons/courses/`.
    - Nội dung tự soạn, ghi rõ chưa duyệt.
12. **Viết chữ Hán** (tuỳ chọn): thứ tự nét bằng `hanzi-writer` (MIT). Dữ liệu nét có giấy phép riêng (makemeahanzi dùng Arphic): kiểm tra trước khi đưa vào, hoặc cho tải về khi cần.
13. **Ôn tập và tiến độ**:
    - Cân nhắc chuyển từ hộp Leitner sang FSRS (`ts-fsrs`, MIT); giữ chuyển đổi dữ liệu cũ.
    - Hiện "đã học X/Y từ HSK n" dựa trên danh sách từ HSK có giấy phép mở (ghi nguồn).

## C. Chất lượng nội dung (liên tục, cần người)

14. **Sửa các lỗi trong `docs/REVIEW-learning-materials.md`** trước khi gọi là giáo trình: nghĩa sai như 哥哥/姐姐, 攀比, 榜样; thiếu buổi 2; thiếu nhập môn pinyin.
15. **Kênh nhận góp ý của giáo viên tiếng Trung người Việt**:
    - Mẫu issue "Đề nghị duyệt bài".
    - Nút **"Báo lỗi bài này"** ngay trong app, chép sẵn JSON của bài để dán vào issue. Không tự gửi gì ra ngoài.

## D. Lan toả và vận hành

16. **Phát hành**:
    - File zip cho Windows và macOS (mã nguồn đã build và file khởi động) trong GitHub Release.
    - Trang giới thiệu GitHub Pages bằng tiếng Việt, có video demo dùng avatar mẫu.
    - Thêm topic cho repo.
    - Cân nhắc đổi tên repo `xiaoya-chinese-tutor` → `misu` cho khớp thương hiệu.
17. **Xuất/nhập dữ liệu người học** thành một file `.zip`, để chuyển máy hoặc sao lưu.
18. **Dọn trước khi push**:
    - Xoá ref `refs/codex/turn-diffs/...` (`git update-ref -d`).
    - Không push nhánh `deepseek/wip-tones-asr`.
    - Chỉ push nhánh chính, không dùng `--mirror`.

Ghi kết quả vào `docs/IMPLEMENTED-next-3.md`, nói rõ phần nào chưa kiểm chứng được. Ví dụ: chưa thử trên Windows thật, chưa có người thật dùng.

## E. Sửa theo rà soát của DeepSeek (đã kiểm chứng ngày 24/10)

Làm ngay sau phần A, trước phần B.

19. **Commit phần A đang làm dở.** `lanAccess`, `remoteProvider`, `edgeGec`, `start.mjs`, `licenses/`, PWA… đều đang nằm ngoài git. Chạy đủ kiểm tra rồi commit theo từng mục.
20. **Giấy phép:**
    - `server/edgeGec.mjs` ghi LGPL-3.0 (port từ edge-tts). Có hai cách xử lý:
      - **Cách a:** giữ nó là một module riêng theo LGPL. README và NOTICE ghi rõ "mã nguồn MIT, trừ `server/edgeGec.mjs` (LGPL-3.0)"; `licenses/` được commit.
      - **Cách b:** viết lại độc lập từ mô tả giao thức, không nhìn mã edge-tts, rồi để MIT.

      Ghi lựa chọn và lý do vào NOTICE.
    - README nói rõ: avatar mẫu `brunette.glb` là CC BY-NC, nên **bản phân phối kèm avatar này chỉ dùng phi thương mại**.
21. **Đưa avatar cá nhân ra khỏi `public/`:**
    - Đọc avatar riêng từ `data/avatars/` (đã bị git bỏ qua) qua một route của server, thay vì `public/avatars/personal*`. Nhờ vậy `vite build` không bao giờ chép chúng vào `dist/`.
    - Tự chuyển file cũ (`public/avatars/personal*`) sang chỗ mới **bằng cách copy**, không xoá file gốc của người dùng.
    - Thêm một bước kiểm tra sau build: `dist/` không được có file nào ngoài danh sách cho phép.
    - Ghi trong README: không nén gửi nguyên thư mục `dist/` cũ. Các file `mom*` hiện có trong `dist/avatars/` là bản build cũ: báo người dùng tự xoá hoặc build lại. Không tự xoá file của họ trong `public/`.
22. **[ĐÃ LÀM — Claude, 25/10, chưa commit]** Bỏ phụ thuộc vào thư mục `../AI-Chinese-Teacher`:
    - Đã bỏ `voice`/`voice:vi` và đường dẫn tới thư mục kia trong `server/stt.mjs`; thêm `docs/voice-clone.md`.
    - `setup-whisper.sh` tự thử bộ SDK macOS cũ hơn khi bản mới nhất lỗi.
    - Đã build whisper vào `vendor/`, chép model vào `models/`.
    - Codex chỉ cần commit cùng phần A.

    Chi tiết ban đầu:
    - Bỏ script `voice`/`voice:vi` đang `cd ../AI-Chinese-Teacher`. Thay bằng biến `VOICE_CLONE_URL` và tài liệu hướng dẫn chạy dịch vụ clone giọng riêng.
    - Bỏ đường dẫn mặc định tới thư mục anh em trong `server/stt.mjs`. Chỉ dùng `vendor/` và `models/` hoặc biến môi trường.
    - Thông báo cho người dùng: cần chạy `npm run setup:whisper` một lần trước khi xoá thư mục kia.
23. **Mang luật ngữ pháp của DeepSeek sang** (`../AI-Chinese-Teacher/server/grammarRules.mjs`: thêm luật cho 过 sau động từ, bổ ngữ kết quả, 是…的, 没 trước 把, 被, phó từ đứng trước động từ, và nhiều lượng từ hơn):
    - Mỗi luật phải kèm **test câu đúng trông giống câu sai**. Ví dụ luật 过 có thể sửa nhầm 我昨天去朋友家过生日 / 过年 / 过周末. Phó từ: 我也去.
    - Thêm câu vào `eval/corrections.json` rồi chạy `npm run eval:corrections`. Chỉ nhận luật nếu số câu đúng bị sửa nhầm vẫn bằng 0. Lưu kết quả vào `eval/results/`.
24. **Test cho các phần chưa có test:** `server/index.mjs` (các route chính, dùng supertest hoặc `fetch` vào server thật trên cổng tạm), `stt`/`tts`/`llm` (giả lập backend), cùng vài component chính.

## F. Định vị theo khảo sát thị trường (25/10)

Hướng đi: **app luyện nói tiếng Trung riêng tư cho người Việt**, gồm hội thoại mở, sửa lỗi bằng luật cho người Việt và chấm thanh điệu có số đo công khai, chạy trên máy, miễn phí. Không đua làm "app học hoàn chỉnh" với HelloChinese.

25. **README**:
    - Mở đầu bằng câu định vị ở trên.
    - Thêm bảng so sánh trung thực với các nhóm app khác (app khoá học, gia sư AI trên mạng, app chuyên phát âm, app từ điển/ôn từ): nêu cả chỗ Misu thua (chưa có app điện thoại thật, chưa có giọng người bản ngữ, chưa viết chữ, nội dung chưa được duyệt).
    - Không ghi số liệu của đối thủ nếu chưa kiểm chứng được nguồn.
26. **Giọng người bản ngữ thật cho phần nghe**:
    - Lấy một tập nhỏ câu từ Mozilla Common Voice zh-CN (giấy phép CC0), chọn câu ngắn ở cấp độ phù hợp, kèm chữ.
    - Script tải về khi cần, **không commit audio**.
    - Dùng cho bài nghe có bản chép và cho bài chọn cặp âm dễ lẫn (mục B8).
    - Ghi nguồn trong NOTICE.
27. **Bằng chứng trên người thật** (cần người dùng): ba người học trong nhà dùng màn hình ghi bộ đo có sẵn; nhờ người nói tiếng Trung tốt gắn nhãn. Sau đó công bố số đo vào `eval/results/` và README, kể cả khi số thấp.
28. **Thử nghiệm chấm thanh điệu bằng mạng neural** (chỉ làm sau khi có dữ liệu người thật ở mục 27, để so công bằng với cách chấm hiện tại):
    - Tìm model mở, chạy được trên máy (ví dụ dựa trên wav2vec2).
    - Kiểm tra giấy phép, kích thước, tốc độ.
    - Chỉ thay cách chấm hiện tại nếu đo trên người thật thấy tốt hơn.
29. **Luyện đề**: chỉ soạn câu hỏi tự viết theo dạng HSK/HSKK; không chép đề chính thức.
