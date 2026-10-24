# Giọng cộng đồng cho luyện nghe

Common Voice Scripted Speech zh-CN là các bản ghi cộng đồng, CC0-1.0.
Không coi nhãn locale là bằng chứng tất cả người nói đều là bản ngữ hoặc có cùng giọng.
Không dùng các bản ghi này để đánh giá độ chính xác chấm phát âm người Việt.

## Tải khi cần

1. Chọn bản **Common Voice Scripted Speech zh-CN** trên [Mozilla Data Collective](https://mozilladatacollective.com/).
2. Người dùng đăng nhập, xem giấy phép và tự chấp nhận các điều khoản tải nếu đồng ý. Không chia sẻ API key vào chat hay commit vào repo. [API chính thức](https://mozilladatacollective.com/api-reference/docs) cần Bearer key cho tải có xác thực; công cụ này không tự chấp nhận điều khoản và không dùng bản mirror không rõ nguồn.
3. Tải và giải nén ngoài repo. Cần thư mục zh-CN chứa `validated.tsv` và `clips/`. Các bản phát hành có thể rất lớn; app không tự tải toàn bộ khi khởi động.
4. Nhập tối đa 50 câu ngắn mặc định; thay URL và version bằng đúng bản đã tải:

```sh
XIAOYA_DATA_DIR=/tmp/misu-cv-test npm run corpus:import -- \
  --source /absolute/download/zh-CN \
  --version cv-VERSION \
  --url https://mozilladatacollective.com/datasets/DATASET_ID \
  --limit 50
```

Chạy app với cùng `XIAOYA_DATA_DIR` và `XIAOYA_SAMPLE_AVATARS=1` để kiểm tra. Mở buổi học → Nghe hiểu và luyện nói → Giọng cộng đồng Common Voice. Có nghe, nghe chậm, chép chữ Hán hoặc pinyin cách từng âm tiết, so chỗ khác sau khi nộp. Bản ghi chỉ được yêu cầu khi bấm nghe; không có thì hiện hướng dẫn, không giả thành giọng người thật.

Bộ nhập chọn locale zh-CN, 2–40 chữ Hán, ít nhất 2 phiếu thuận, không phiếu chống, bỏ trùng câu; các bộ lọc này **không phải duyệt sư phạm**. Chưa gán trình độ HSK hay nghĩa tiếng Việt. Nội dung cộng đồng cần người dùng nghe và chọn tiếp để phù hợp trình độ.

Âm thanh và manifest nằm trong `XIAOYA_DATA_DIR/listening-corpus`, bị Git ignore kể cả khi dùng thư mục dữ liệu khác trong repo. Không lưu client_id, tuổi, giới tính, giọng địa phương hay đường dẫn gốc của người đóng góp. Import lại thay danh sách; file cũ vẫn giữ để tránh tự xóa dữ liệu. Không đưa folder này vào bản phát hành. Dist chỉ cho phép avatar mẫu và tài nguyên build.

## Giới hạn kiểm chứng

Test chỉ dùng file giả tạm để kiểm tra nhập, lọc, bảo vệ đường dẫn và phục vụ API. Chưa có bản tải Common Voice thật trong phiên này: chưa xác nhận phát/giải mã mp3 thực, độ phù hợp câu, nhiều giọng hoặc kết quả học. Phần tải và thử dữ liệu thật đang chờ đường dẫn bộ dữ liệu từ người dùng.
