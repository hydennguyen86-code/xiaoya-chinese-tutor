# Common Voice: chỉ đọc dữ liệu ngoài repo

Bộ Common Voice 26.0 Beijing Chinese do người dùng cung cấp có giấy phép CC0 kèm điều kiện truy cập không đăng lại/chia sẻ lại. App giữ âm thanh ở nguyên vị trí người dùng tải; không sao chép, không đưa vào Git/dist, không phát cho máy khác qua LAN. Không tự tải hay tự chấp nhận điều khoản. Người dùng chịu trách nhiệm chọn bản tải hợp lệ từ Mozilla.

## Cấu hình

Thư mục nguồn phải chứa `clips/*.mp3` và `validated.tsv`, hoặc ba file `train.tsv`, `dev.tsv`, `test.tsv`. Không cần chuyển đổi hay hợp nhất TSV. Cột bắt buộc: `path`, `sentence`, `up_votes`, `down_votes`; nếu có `locale`, chỉ chấp nhận zh-CN hoặc zh-CN-beijing.

Lập **catalog tham chiếu**, không nhập audio:

```sh
XIAOYA_DATA_DIR=/tmp/misu-cv-test XIAOYA_SAMPLE_AVATARS=1 \
  npm run corpus:import -- --source /absolute/download/zh-CN-beijing \
  --version cv-26.0-zh-CN-beijing --limit 50
```

`--url` có thể bổ sung URL trang dataset trên Mozilla Data Collective khi biết chính xác; không tự đoán URL. Version là thông tin người dùng cung cấp, không được công cụ tự xác thực.

Khởi động app với **cùng thư mục nguồn và thư mục dữ liệu**:

```sh
XIAOYA_DATA_DIR=/tmp/misu-cv-test XIAOYA_SAMPLE_AVATARS=1 \
  XIAOYA_COMMON_VOICE_DIR=/absolute/download/zh-CN-beijing npm start
```

Mở Bài hôm nay → Nghe hiểu và luyện nói → Giọng cộng đồng Common Voice. Audio được đọc trực tiếp từ nguồn khi bấm nghe. Có tốc độ 0.7/0.85/1×, nghe chậm, nghe chép chữ Hán hoặc pinyin cách âm tiết. Chữ chỉ hiện sau đối chiếu. Không có dữ liệu thì hiện hướng dẫn, không dùng giọng máy giả làm người thật.

Catalog schema 2 chỉ giữ ID, tên file, câu, version, nguồn nếu có, giấy phép và cơ sở lọc trong `XIAOYA_DATA_DIR/listening-corpus/manifest.json`. Không giữ client_id, tuổi, giới tính, accents, đường dẫn tuyệt đối hoặc audio. Dấu băm thư mục nguồn giúp tránh vô tình phát file của nguồn khác. Đổi vị trí nguồn thì lập lại catalog. Bỏ biến `XIAOYA_COMMON_VOICE_DIR` để tắt nguồn. Manifest cũ có audio sao chép từ bản công cụ trước không được đọc nữa; app không tự xóa các file cũ.

## Lọc câu

- Quét hết các split; bỏ trùng câu; yêu cầu ít nhất 2 phiếu thuận, 0 phiếu chống.
- Chỉ câu 2–24 chữ Hán, không số/chữ Latin; câu ngắn tối đa 16 chữ được ưu tiên.
- Cần dấu hiệu hội thoại hoặc sinh hoạt. Loại mẫu tiểu sử, địa danh hành chính, định nghĩa, khoa học/kỹ thuật, chính trị và các nhóm bách khoa thường gặp.
- So khớp từ dài nhất với vốn từ `vocab` của các bài HSK1/HSK5 hiện có và danh sách từ thông dụng tự biên soạn trong `server/listeningDifficulty.mjs`. Chỉ giữ câu không còn chữ ngoài vốn từ này.
- Hai nhãn **Câu ngắn, từ quen / Câu mở rộng** là gợi ý của app, **không tương đương HSK1/HSK5 chính thức**. Bộ lọc không phải bộ nhận dạng tên riêng hoàn chỉnh hay kiểm duyệt sư phạm; vẫn có câu cần ngữ cảnh. Chưa có giáo viên duyệt.

## Kiểm chứng 25/10/2026

Bộ Beijing Chinese trên máy: 2.860 dòng, giữ 17 câu, loại 2.843 do nội dung/độ khó; không có dòng bị loại do phiếu hay thiếu file trong 17 câu. Cả 17 MP3 đã giải mã bằng ffmpeg sang null, không tạo audio mới. Trong dữ liệu app tạm không có MP3. Kiểm tra API dùng byte của nguồn ngoài repo; test còn kiểm tra symlink, sai nguồn, split, lọc và từ chối máy LAN.

Chưa xác thực lại giấy phép/điều khoản trên trang tải; ghi nhận theo thông tin người dùng. Chưa đo hiệu quả học trên người thật hay được giáo viên xác nhận phân loại. Không dùng bộ nghe này làm bằng chứng cho độ chính xác chấm thanh điệu của người học Việt.
