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
