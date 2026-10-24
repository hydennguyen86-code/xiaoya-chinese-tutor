# Kết quả triển khai nghe – nói

## Mục 4 — Nhiều tốc độ và nghe trước khi xem chữ

- Ba tốc độ 0.7 / 0.85 / 1.0, lưu lựa chọn dùng chung. Nút nghe chậm dùng riêng 0.7×, không đổi lựa chọn mặc định.
- Truyền tốc độ đến Edge, macOS say và speechSynthesis; cache phân biệt tốc độ. Giọng clone chưa hỗ trợ tốc độ được chuyển sang Edge khi nghe chậm, có lý do trả về rõ ràng.
- Bổ sung nghe chậm cho lời thoại, mẫu câu, ví dụ và các phần luyện nghe/nói. Nút trong bài nghe giữ giới hạn lượt nghe.
- Nhập vai mặc định giấu lời trợ lý và bản dịch, có nút hiện chữ và tùy chọn tắt; câu của người học vẫn hiện.
- Kiểm chứng bằng dữ liệu tạm và avatar mẫu: typecheck, 67 test backend/lib + 4 test component, build và kiểm tra allowlist dist đều đạt.
- Thử Edge thật với câu tự soạn “你好，今天我们一起练习中文。”: 0.7× = 4824 ms; 0.85× = 3960 ms; 1× = 3384 ms. Không lưu âm thanh vào repo.
- Trình duyệt: xác nhận lời nhập vai ban đầu bị giấu và bấm mở hiển thị cả chữ Hán lẫn nghĩa. Chưa thử Windows thật, chưa đo trải nghiệm người học; kiểm thử say và giọng trình duyệt thật ở từng tốc độ chưa hoàn tất.
