# Kết quả triển khai nghe – nói

## Mục 4 — Nhiều tốc độ và nghe trước khi xem chữ

- Ba tốc độ 0.7 / 0.85 / 1.0, lưu lựa chọn dùng chung. Nút nghe chậm dùng riêng 0.7×, không đổi lựa chọn mặc định.
- Truyền tốc độ đến Edge, macOS say và speechSynthesis; cache phân biệt tốc độ. Giọng clone chưa hỗ trợ tốc độ được chuyển sang Edge khi nghe chậm, có lý do trả về rõ ràng.
- Bổ sung nghe chậm cho lời thoại, mẫu câu, ví dụ và các phần luyện nghe/nói. Nút trong bài nghe giữ giới hạn lượt nghe.
- Nhập vai mặc định giấu lời trợ lý và bản dịch, có nút hiện chữ và tùy chọn tắt; câu của người học vẫn hiện.
- Kiểm chứng bằng dữ liệu tạm và avatar mẫu: typecheck, 67 test backend/lib + 4 test component, build và kiểm tra allowlist dist đều đạt.
- Thử Edge thật với câu tự soạn “你好，今天我们一起练习中文。”: 0.7× = 4824 ms; 0.85× = 3960 ms; 1× = 3384 ms. Không lưu âm thanh vào repo.
- Trình duyệt: xác nhận lời nhập vai ban đầu bị giấu và bấm mở hiển thị cả chữ Hán lẫn nghĩa. Chưa thử Windows thật, chưa đo trải nghiệm người học; kiểm thử say và giọng trình duyệt thật ở từng tốc độ chưa hoàn tất.

## Mục 5 — Phần mềm sẵn sàng; còn chờ bộ giọng thật

- Bộ nhập `npm run corpus:import`: đọc streaming `validated.tsv`, chọn câu ngắn zh-CN đã được cộng đồng bỏ phiếu, giữ version/URL/CC0, bỏ trường định danh người nói. Không tự gán HSK hay nhãn duyệt.
- Âm thanh ở `XIAOYA_DATA_DIR/listening-corpus`, Git ignore cả khi đổi folder dữ liệu. API danh sách và audio đi qua bảo vệ LAN; chỉ phục vụ ID trong manifest, từ chối symlink/path traversal, không đưa vào dist.
- Trong bài nghe có mục giọng cộng đồng: tải audio khi bấm, tốc độ theo mục 4, nghe chậm, nghe chép chữ Hán hoặc pinyin cách âm tiết, so khác biệt bằng edit distance. Khi chưa nhập có hướng dẫn rõ ràng, không thay giọng máy rồi gọi là giọng người thật.
- Hướng dẫn tải chính thức: `docs/COMMON-VOICE.md`; NOTICE bổ sung nguồn và giấy phép. Người dùng cần tự đăng nhập/xem điều khoản Mozilla Data Collective. Không tải từ mirror không rõ nguồn, không đưa API key vào chat.
- Kiểm chứng: 69 test backend/lib + 4 component, typecheck, build/dist đạt; fixture giả chỉ kiểm tra nhập/lọc/API/alignment, không phải giọng người thật.
- **Chưa hoàn tất kiểm chứng mục 5**: chưa được cung cấp đường dẫn Common Voice tải hợp lệ; chưa phát mp3 Common Voice thật, chưa kiểm tra nhiều người nói và độ phù hợp nội dung. Chờ người dùng cung cấp thư mục zh-CN có `validated.tsv`/`clips` cùng version/URL để thử trong dữ liệu tạm. Mục 6–12 chưa thực hiện trong đợt này, để giữ thứ tự sau khi xác nhận bước 5. Mục 12 cần người học và người gắn nhãn thật; không được thay bằng fixture.


## Mục 5 — Cập nhật theo bộ Beijing Chinese người dùng cung cấp

Phần này thay thế cách sao chép audio và trạng thái chờ dữ liệu của bản trước.

- App chỉ đọc nguồn ngoài repo do `XIAOYA_COMMON_VOICE_DIR` cấu hình; catalog schema 2 không chứa audio/đường dẫn tuyệt đối. Không đọc manifest cũ đã copy audio; không xóa dữ liệu cũ.
- Hỗ trợ train/dev/test.tsv, locale tùy chọn; không sửa nguồn. Không tự đoán URL hay xác nhận lại điều khoản: ghi nhận version/CC0/không chia sẻ lại theo người dùng.
- API Common Voice chỉ cho loopback, chặn client LAN kể cả đã đăng nhập. Chỉ ID thuộc catalog cùng nguồn, từ chối symlink, sai nguồn và tên file bất hợp lệ.
- Lọc câu ngắn/đời thường, loại mẫu bách khoa và chữ ngoài vốn từ bài HSK1/HSK5 của app + từ thông dụng; không gắn nhãn trình độ HSK chính thức. Quét đủ 2.860 dòng: chọn 17, loại 2.843 do nội dung/độ khó. Bộ lọc bảo thủ; chưa là duyệt sư phạm và có thể bỏ sót câu tốt.
- Thử thực trên thư mục người dùng, dữ liệu app ở /tmp, avatar mẫu: 17/17 MP3 giải mã sang null bằng ffmpeg; không ghi audio vào data tạm hoặc repo. Test gồm split/dedup/filter/no-copy/source-binding/symlink/API/LAN.
- Chưa thử Windows thật, chưa được giáo viên duyệt câu và chưa đo hiệu quả với người học. Không thay ngưỡng chấm hay cách cắt âm tiết.

- Kiểm tra cuối: typecheck, 71 test backend/lib + 4 component (75 tổng), build và allowlist dist đều đạt. API trả đúng byte gốc cho 17/17 clip, không lộ tên file nguồn trong danh sách công khai. Trình duyệt phát hết một MP3 thật ở 0.7× (readyState 4, không lỗi), gõ pinyin và mở đối chiếu đúng. Chưa nghe/đánh giá thủ công toàn bộ 17 câu.

## Mục 1 — Luyện tai thanh điệu

- Chép duy nhất JSON thanh điệu và checker cấu trúc (không có script tác giả). 154 mục, giữ nhãn AI soạn, chưa duyệt; checker pinyin/biến điệu của DeepSeek chạy như test trong repo. Bốn mục uncertain được loại khỏi bài chấm, không tự sửa nội dung.
- Nghe rồi chọn thanh, gồm âm tiết/từ đôi; khóa trả lời đến lúc audio bắt đầu. Chấp nhận đúng các acceptTones đã khai báo; baseTone/baseTones giữ làm lời giải, không ghi đè biến điệu bằng pinyin tự suy.
- Ma trận nhầm thanh theo người học nhận cả lỗi nghe và các báo cáo nói có kết quả chấm rõ. Chọn có trọng số ưu tiên nhầm lẫn, vẫn có phần khám phá và tránh lặp câu ngay trước. Không tính chữ chưa chấm được thành lỗi.
- Typecheck, test và build được chạy trước commit. Chưa thu âm người thật hoặc xác nhận TTS đọc đúng từng câu; thuật toán chấm thanh không đổi. Không gắn nhãn giáo viên duyệt.

## Mục 2 — Cặp âm dễ lẫn

- Chép JSON + checker DeepSeek, 12 nhóm âm, giữ nhãn AI soạn, chưa duyệt. Checker kiểm tra cả tính cặp tối thiểu và pinyin; các mục uncertain không đưa vào phần chấm.
- Nghe rồi chọn pinyin A/B, phát âm mẫu tổng hợp, có nghe chậm và giải thích khẩu hình sau trả lời. Không gọi STT để quyết định đáp án. Lịch sử nhầm theo người học được giữ riêng để ôn phát âm ở mục 7.
- Typecheck/test/build đạt trước commit; chưa được người dạy xác nhận độ chính xác từng giọng mẫu hoặc mẹo khẩu hình.

## Mục 3 — Nghe chép DeepSeek và câu buổi học

- 180 câu JSON DeepSeek, giữ nhãn AI soạn, chưa duyệt; checker kiểm tra cấu trúc/pinyin/biến điệu chạy trong test repo. Không chép script tác giả.
- Nghe cả câu hoặc từng cụm ngắt theo dấu câu, nhập chữ Hán hoặc pinyin cách âm tiết. Edit-distance tránh lỗi thiếu một chữ kéo sai cả phần sau. Hiện chữ/âm/nghĩa sau nộp. Nhập không dấu được chấp nhận; có dấu/số thanh thì kiểm tra các chuỗi acceptTones, giữ baseTones để giải thích.
- Có lựa chọn câu ví dụ của chính buổi học và câu mở đầu nhập vai. Cách đọc câu hiện có dùng metadata pinyin của bài, hoặc pinyin-pro cho câu mở đầu; không ghi đè pinyin DeepSeek.
- Typecheck/test/build trước commit; chưa được giáo viên duyệt hoặc kiểm tra từng câu TTS thật.
