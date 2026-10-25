# Common Voice: chỉ đọc dữ liệu ngoài repo

Bộ Common Voice 26.0 Beijing Chinese do người dùng cung cấp có giấy phép CC0 kèm điều kiện truy cập không đăng lại/chia sẻ lại. App giữ âm thanh ở nguyên vị trí người dùng tải; không sao chép, không đưa vào Git/dist, không phát cho máy khác qua LAN. Không tự tải hay tự chấp nhận điều khoản. Người dùng chịu trách nhiệm chọn bản tải hợp lệ từ Mozilla.

## Cấu hình

Thư mục nguồn phải chứa `clips/*.mp3` và `validated.tsv`, hoặc ba file `train.tsv`, `dev.tsv`, `test.tsv`. Không cần chuyển đổi hay hợp nhất TSV. Cột bắt buộc: `path`, `sentence`, `up_votes`, `down_votes`; nếu có `locale`, chỉ chấp nhận zh-CN hoặc zh-CN-beijing.

Lập **catalog tham chiếu**, không nhập audio:

```sh
XIAOYA_DATA_DIR=/tmp/misu-cv-test XIAOYA_SAMPLE_AVATARS=1 \
  npm run corpus:import -- --source /absolute/download/zh-CN-beijing \
  --version cv-26.0-zh-CN-beijing --limit 200
```

`--url` có thể bổ sung URL trang dataset trên Mozilla Data Collective khi biết chính xác; không tự đoán URL. Version là thông tin người dùng cung cấp, không được công cụ tự xác thực.

Khởi động app với **cùng thư mục nguồn và thư mục dữ liệu**:

```sh
XIAOYA_DATA_DIR=/tmp/misu-cv-test XIAOYA_SAMPLE_AVATARS=1 \
  XIAOYA_COMMON_VOICE_DIR=/absolute/download/zh-CN-beijing npm start
```

Mở Bài hôm nay → Nghe hiểu và luyện nói → Giọng cộng đồng Common Voice. Audio được đọc trực tiếp từ nguồn khi bấm nghe. Có tốc độ 0.7/0.85/1×, nghe chậm, nghe chép chữ Hán hoặc pinyin cách âm tiết. Chữ chỉ hiện sau đối chiếu. Không có dữ liệu thì hiện hướng dẫn, không dùng giọng máy giả làm người thật.

Catalog schema 3 chỉ giữ ID, tên file, câu, version, nguồn nếu có, giấy phép, sentence_id, level, meaningVi, focus và nhãn AI trong `XIAOYA_DATA_DIR/listening-corpus/manifest.json`. Không giữ client_id, tuổi, giới tính, accents, đường dẫn tuyệt đối hoặc audio. Dấu băm thư mục nguồn giúp tránh vô tình phát file của nguồn khác. Đổi vị trí nguồn thì lập lại catalog. Bỏ biến `XIAOYA_COMMON_VOICE_DIR` để tắt nguồn. Manifest cũ có audio sao chép từ bản công cụ trước không được đọc nữa; app không tự xóa các file cũ.

## Chọn câu theo DeepSeek

`lessons/listening/cv-curated.json` là danh sách 154 sentence_id do DeepSeek soạn, nhãn **AI soạn, chưa duyệt**. Mỗi mục chỉ có sentence_id/level/meaningVi/focus; không có audio, client_id, tên file hay đường dẫn. Đây là phân bậc biên tập ước lượng, không phải xác nhận HSK chính thức.

Bộ nhập nối sentence_id với TSV gốc; chỉ nhận bản ghi zh-CN/zh-CN-beijing có ít nhất 2 phiếu thuận, không phiếu chống và file có thật, an toàn. Không dùng bộ lọc từ vựng 17 câu cũ nữa. Thiếu bất kỳ ID nào trong danh sách hoặc thiếu file đạt chất lượng thì báo lỗi, giữ catalog cũ; không tự tìm câu thay thế. Mặc định lấy tối đa 200 câu để đủ 154 mục. Trên UI chọn bậc nghe, câu/nghĩa/focus hiện sau nộp nghe chép.

Kiểm tra metadata trong `npm test` không yêu cầu kho audio. Để kiểm tra lại liên kết TSV thật (chỉ đọc):

```sh
XIAOYA_COMMON_VOICE_DIR=/absolute/download/zh-CN-beijing \
  node scripts/listening-checks/cv-curated.check.mjs
```

## Kiểm chứng 25/10/2026

Đã chạy checker DeepSeek trong repo với thư mục nguồn thật: 154 ID/câu duy nhất hợp lệ. Bộ nhập quét đủ 2.860 dòng, nối đủ 154 câu: HSK1-2 45, HSK3-4 58, HSK5-6 51 (bậc do AI ước lượng). Metadata không gán giáo viên duyệt. Catalog schema 2 của bộ lọc cũ không được phục vụ; chạy lại lệnh catalog, không xóa audio cũ nếu người dùng có dữ liệu cũ.

Giấy phép/điều khoản ghi nhận theo người dùng; không tái phân phối audio. Chưa có giáo viên duyệt hoặc đo hiệu quả học trên người thật. Không dùng bộ nghe này làm bằng chứng cho độ chính xác chấm thanh điệu người học Việt.
