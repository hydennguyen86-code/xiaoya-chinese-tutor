# 米苏 · Misu — luyện nói tiếng Trung với avatar 3D, chạy trên máy của bạn

*A Chinese speaking tutor for Vietnamese learners: a 3D avatar you talk to, a
local LLM that replies at your HSK level and corrects your sentences, local
speech-to-text, tone checking, and a daily guided lesson. Local mode runs on your computer; optional online voices and a user-configured
OpenAI-compatible model API send the relevant text to those services. The interface is in
Vietnamese.*

Misu là bạn luyện nói tiếng Trung cho người Việt: bạn nói (hoặc gõ), avatar trả
lời bằng tiếng Trung có pinyin và bản dịch tiếng Việt, sửa câu sai, ghi lại từ
mới để ôn, và mỗi ngày có sẵn một bài học theo lộ trình để khỏi phải tự chọn học gì.

![Demo nhập câu, nhận phản hồi và ôn từ](docs/media/demo-keyboard.gif)

*Demo thao tác bằng bàn phím (30 giây, dữ liệu giả lập, avatar hoạt hình mẫu).
Chưa phải bản quay luyện nói bằng micro.*

## Học ngay: HSK 1 và HSK 5 ứng dụng

Có sẵn **48 buổi cố định**, 12 chủ đề × 2 buổi cho mỗi lộ trình, kèm **4 bài
kiểm tra chặng** tự soạn. Mở **Bài hôm nay → Lộ trình học**, chọn HSK 1 hoặc
HSK 5. Trong phần Hội thoại nhập vai có bài nghe, chọn đáp án rồi mở bản chép
lời/giải thích; tiếp theo là nhắc lại/kể lại, đọc và trả lời theo nhiệm vụ.
Nội dung cố định không cần model soạn lại; nhập vai tương tác vẫn cần model.

- [Tài liệu HSK 1 thực tế](lessons/courses/HSK1-GUIDE.md): khoảng 25 phút/buổi.
- [Tài liệu HSK 5 thực tế](lessons/courses/HSK5-GUIDE.md): khoảng 30 phút/buổi.
- [Nguồn dạng thi và giới hạn](lessons/courses/EXAM-ALIGNMENT.md).

Đây là giai đoạn thực hành đầu tiên, AI biên soạn và rà soát, **chưa có giáo viên
duyệt**. Không tuyên bố bao phủ toàn bộ HSK hoặc quy đổi điểm mini thành điểm
thi. Phần nói HSK 1 là mở rộng giao tiếp, không gọi là phần thi nói chính thức.

## Kiểm tra và chuẩn bị

Lần mở đầu có màn hình kiểm tra model, ghi thử micro, nhận dạng local, nghe TTS
và hội thoại mẫu. Mở lại từ **Cài đặt → Kiểm tra hệ thống và micro**.

Nút **Kiểm tra** cạnh **Bài hôm nay** cho phép thi tuần/tháng và xem lịch sử.
Bài tuần đến hạn sau 7 ngày hoặc 3 buổi mới; bài tháng sau 30 ngày. Đề lấy từ
các từ, lỗi và bài đã học của từng người. Thiếu dữ liệu thì đề ngắn hơn.
Nhiệm vụ giao tiếp dùng bối cảnh mới; xin gợi ý được ghi riêng. Điểm AI và
thanh điệu chỉ là ước lượng, không phải chứng chỉ HSK. Phần không chấm được
không tính điểm; các lần có đề khác nhau không hoàn toàn tương đương.

## Tính năng

- **Avatar nói chuyện**: avatar 3D (TalkingHead, cử động môi theo tiếng nói)
  hoặc avatar LAM dựng từ ảnh thật (Gaussian splatting, chạy ngay trong trình
  duyệt).
- **Trả lời theo trình độ**: HSK 1–2 câu rất ngắn, chậm; HSK 5–6 nói tự nhiên,
  dài hơn. Mô hình chạy cục bộ qua Ollama hoặc LM Studio.
- **Sửa câu**: luật cố định cho các lỗi người Việt hay mắc (lượng từ, 比…很,
  没…了, trật tự trạng ngữ nơi chốn/thời gian, 一点儿) cộng với mô hình, có bộ
  lọc để không "sửa" những câu vốn đã đúng.
- **Nhận dạng giọng nói cục bộ** bằng whisper.cpp: giọng bạn không rời khỏi máy.
- **Chấm thanh điệu**: đọc một từ, Misu chỉ ra chữ nào sai thanh và cách sửa;
  đọc một câu, Misu vẽ đường cao độ của bạn cạnh giọng mẫu.
- **Bài hôm nay**: ôn từ và lỗi cũ của chính bạn → từ mới → mẫu câu →
  đóng vai → nói tự do → tổng kết. Mặc định dùng hai lộ trình Misu tự soạn; có thể dùng mục lục
  sách riêng (xem phần [Mục lục sách](#mục-lục-sách)).
- **Nhiều người học** trên một máy, mỗi người có trình độ, lịch sử và từ ôn
  riêng.
- **Dữ liệu nằm trong thư mục `data/`** (mỗi mục một file JSON, sao lưu mỗi ngày,
  giữ 14 ngày), không phụ thuộc bộ nhớ trình duyệt.

## Cài đặt

Cần **Node.js 24** và npm. Đã thử trên macOS Apple Silicon; đường dẫn Windows/Linux
và CI ba hệ điều hành đã được bổ sung, **chưa thử trên Windows thật**.
Bài học cố định không cần Ollama/GPU. Trò chuyện và sửa câu cần Ollama/LM Studio
hoặc API do bạn tự cấu hình trong Cài đặt. ffmpeg cần cho Whisper/chấm thanh;
`brew install ffmpeg` trên Mac, `winget install --id Gyan.FFmpeg --exact` trên Windows.
Giọng Edge cần mạng, có giọng trình duyệt dự phòng nếu máy đã cài đúng ngôn ngữ.

```bash
git clone https://github.com/hydennguyen86-code/xiaoya-chinese-tutor.git
```

```bash
cd xiaoya-chinese-tutor && npm ci
```

Nếu dùng model local đã được đo trong repo (xem số đo phía dưới):

```bash
ollama pull qwen3.5:4b
```

Máy ít RAM có thể bắt đầu bằng bài cố định hoặc dùng API tuỳ chọn. Màn hình
**Kiểm tra hệ thống** đọc RAM máy chủ để gợi ý; RAM không bảo đảm tốc độ CPU/GPU.

Sau khi tải mã nguồn, có thể bấm đúp **start-windows.bat** hoặc
**start-mac.command**. Launcher kiểm tra Node, chạy `npm ci` lần đầu/khi lockfile
đổi, build, kiểm tra Ollama và mở trình duyệt. Mặc định chỉ mở trên máy này.
Launcher cần quyền chạy file; nếu macOS chặn file tải xuống, hãy kiểm tra nguồn
và dùng lệnh terminal bên dưới, không vô hiệu hoá bảo vệ của hệ điều hành.

Nhận dạng giọng nói cục bộ (không bắt buộc; cần git, cmake; tải về khoảng 466 MB):

```bash
npm run setup:whisper
```

Windows x64 dùng PowerShell, không cần tự build C++:

```powershell
npm run setup:whisper:windows
# Nếu chưa có ffmpeg và muốn cài qua winget:
powershell -NoProfile -File scripts/setup-whisper.ps1 -InstallFfmpeg
```

Script ghim whisper.cpp **v1.7.6** (cùng commit với script Mac/Linux), kiểm tra
SHA256 ZIP/model trước khi dùng. Các file tải về nằm trong `vendor/`, `models/`
đã được Git bỏ qua. Có thể chọn `-Size base` rồi đặt `WHISPER_MODEL` như script
hướng dẫn; `WHISPER_BIN`, `FFMPEG_PATH`, `FFPROBE_PATH` nhận đường dẫn `.exe`
có khoảng trắng. Windows ARM64 và cài đặt Windows thật chưa được xác minh.
Nếu thiếu DLL Visual C++, dùng liên kết Microsoft được script in ra.

Chạy:

```bash
npm run build && npm start
```

Mở <http://127.0.0.1:8787>. Khi phát triển dùng `npm run dev` (Vite ở cổng 5173).

Không có whisper.cpp thì micro dùng nhận dạng giọng nói của trình duyệt (Chrome
gửi âm thanh lên máy chủ Google) và không chấm được thanh điệu.

### Tuỳ chỉnh

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT`, `HOST` | `8787`, `127.0.0.1` | địa chỉ server |
| `XIAOYA_DATA_DIR` | `./data` | nơi lưu dữ liệu người học |
| `XIAOYA_SAMPLE_AVATARS` | tắt | đặt `1` để chỉ dùng avatar mẫu khi thử hoặc quay demo |
| `OLLAMA_URL`, `LMSTUDIO_URL` | cổng mặc định | máy chủ mô hình |
| `WHISPER_BIN`, `WHISPER_MODEL`, `WHISPER_PORT` | `vendor/…`, `models/ggml-small.bin`, `8178` | whisper.cpp |
| `VOICE_CLONE_URL`, `VOICE_CLONE_VI_URL` | cổng `8766`, `8767` | dịch vụ giọng clone tự chạy (không bắt buộc), xem [docs/voice-clone.md](docs/voice-clone.md) |
| `FFMPEG_PATH`, `FFPROBE_PATH` | tự tìm trong thư mục cài phổ biến hoặc PATH | công cụ âm thanh |

### Avatar của riêng bạn

- Avatar 3D: đặt file `.glb` (Ready Player Me hoặc tương thích, có blendshape
  ARKit + viseme) ở `public/avatars/personal.glb`.
- Avatar LAM từ ảnh: dựng bằng [LAM](https://github.com/aigc3d/LAM) (bản demo
  online hoặc máy có GPU), rồi đặt file `.zip` ở `public/avatars/personal-lam.zip`.
- Hoặc chọn file ngay trong phần Cài đặt của ứng dụng.

Các file `personal*` đã nằm trong `.gitignore`, không bị đưa lên git. Chỉ dùng ảnh
của người đã đồng ý.

### Mục lục sách

Repo **không** chứa nội dung sách. Để lịch học đi theo đúng bài của
《体验汉语口语》, tự gõ mục lục (tên bài, số trang, chủ đề) vào
`data/syllabus/tiyan-hanyu-kouyu.json` theo mẫu [docs/syllabus.example.json](docs/syllabus.example.json).
Chưa có file này thì Misu dùng hai lộ trình HSK 1/HSK 5 cố định trong
`lessons/courses/`. Với mục lục riêng không có bài cố định, model cục bộ tự
soạn nội dung. App không thay đổi mục lục riêng đã có.

## Độ chính xác: đo được bao nhiêu

Các bộ đo nằm trong `eval/` và chạy lại được trên máy bạn. Kết quả thô được lưu ở [eval/results/](eval/results/).
Số sửa câu đối chiếu được trong [kết quả qwen3.5:4b](eval/results/corrections-qwen3.5_4b-2026-10-24.json).
[Đo sinh bài ba trình độ](eval/results/lessons-qwen3.5_4b-2026-10-24.json) chỉ xác nhận phản hồi và cấu trúc, không chứng nhận nội dung.

**Sửa câu** (`npm run eval:corrections`, qwen3.5:4b, 40 câu): 0/22 câu đúng bị
sửa nhầm; 17/18 câu sai được phát hiện, 16/18 sửa đúng như đáp án. Bộ câu nhỏ và
gồm đúng những loại lỗi mà luật đã viết cho, nên với lỗi khác (chọn từ, ngữ
pháp hiếm) phần sửa vẫn do mô hình 4B quyết định và có lúc sai. Mô hình khác cần được đo riêng bằng cùng bộ thử.

**Thanh điệu**: bản ghi có thể đối chiếu mới nhất là
[Tingting ngày 24/10/2026](eval/results/tones-macOS_Tingting-2026-10-24.json),
commit `841d68b`, working tree lúc đo còn thay đổi. Giọng tổng hợp macOS,
ngưỡng từng được chỉnh trên chính giọng Tingting nên không phải kiểm định độc lập.

| Giọng có file kết quả | Chữ đọc riêng | Chữ trong từ hai chữ |
|---|---|---|
| Tingting | 35/40 đúng, 0 chưa chấm | 25/29 chữ chấm được đúng; 3/32 chưa chấm |

Các số của Flo/Reed/Grandpa/Shelley từng ghi ở đây không có file kết quả
kèm theo trong repo, nên đã bỏ khỏi bảng có thể kiểm chứng. Chưa chạy lại bộ
TTS sau thay đổi giao diện/mốc âm tiết; ngưỡng `classifyIsolated` giữ nguyên.

Đây là giọng máy đọc chuẩn, chưa phải người học thật: độ chính xác trên giọng người
(nhất là người mới học, đọc ngập ngừng) hiện chưa được đo. Vì thế Misu chỉ chấm đúng/sai
từng chữ khi đọc từ 1–2 chữ, còn với câu dài thì chỉ vẽ đường cao độ để bạn tự
so, và báo "chưa chấm được" thay vì đoán khi không rõ. Thanh 1 và thanh 3 đọc
riêng chỉ khác nhau ở độ cao, nên Misu cần nghe bạn nói vài câu trước để biết
giọng bạn cao thấp thế nào.

## Quyền riêng tư

- Với Ollama/LM Studio, câu trả lời và sửa lỗi chạy trên máy. Whisper và chấm thanh
  chạy trên máy. Mặc định server chỉ nghe ở `127.0.0.1`; LAN là chế độ bật riêng.
- Với API tuỳ chọn, bản chép lời, hội thoại và dữ liệu học liên quan gửi tới URL
  bạn đã đồng ý. API model không nhận audio gốc; dịch vụ có thể tính phí.
- **Giọng đọc Edge** (mặc định) gửi *chữ* của câu trả lời lên dịch vụ của
  Microsoft để đọc. Khi lỗi, Mac thử `say`, rồi dùng `speechSynthesis` của trình
  duyệt trên các hệ điều hành nếu có giọng đúng ngôn ngữ. Một số giọng trình duyệt
  dùng mạng; app hiển thị nguồn giọng, không hứa tất cả đều offline.
- **Nhận dạng giọng nói của trình duyệt** (chỉ khi không có whisper.cpp) gửi âm
  thanh lên nhà cung cấp trình duyệt.
- Dữ liệu người học nằm trong `data/` (đã có trong `.gitignore`).

## Phát triển

```bash
npm run typecheck && npm test
```

- `src/`: React + Vite (giao diện, avatar, bài học).
- `server/`: Express (mô hình, giọng đọc, nhận dạng giọng nói, chấm thanh điệu,
  lưu dữ liệu).
- `eval/`: bộ đo sửa câu và thanh điệu.

## Giấy phép

Mã gốc của app: MIT ([LICENSE](LICENSE)); riêng module chuyển đổi GEC v2
`server/edgeGec.mjs` dùng LGPLv3 và được giữ dưới dạng source riêng có thể thay thế.
Avatar mẫu và các thư viện có giấy phép
riêng, trong đó avatar `brunette.glb` chỉ dùng phi thương mại. Xem
[NOTICE.md](NOTICE.md).

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Bài AI soạn chưa duyệt ở [lessons/](lessons/).

### Thu bộ đo giọng thật

Trong **Kiểm tra → Ghi bộ đo giọng cá nhân**, đọc 40 chữ và 16 từ, nghe lại,
điền tên người gắn nhãn và chọn tự đánh giá hoặc người giỏi nghe. Có thể gắn
thanh thực sự nghe được cho từng chữ; `0` nghĩa là không rõ. Ghi lại sẽ xoá
nhãn cũ của mục đó để tránh dùng nhãn cho nhầm audio. Bản ghi ở
`$XIAOYA_DATA_DIR/eval-recordings/<learner>/`, mặc định dưới `data/` đã được Git bỏ qua.

```sh
npm run eval:tones -- --recordings=data/eval-recordings/<learner>
```

Lệnh chạy trực tiếp trên máy, cần ffmpeg; không cần Ollama hay mạng.
`eval/results/` chỉ nhận số tổng hợp, không có audio, tên người gắn nhãn hoặc
đường dẫn hồ sơ. Ma trận so với nhãn người nghe, tách tự đánh giá/người nghe
khác; khoảng giọng được lấy từ cùng bộ ghi nên chưa phải kiểm định độc lập.
**Chưa có bộ giọng thật được gắn nhãn. Chưa chỉnh ngưỡng thanh điệu.**
Không có số trước/sau mới để báo cáo; các số TTS bên trên vẫn là mốc tham khảo.

### Kiểm tra bản cài sạch và máy macOS khác

```sh
bash scripts/smoke-test.sh
# Bắt buộc tạo được giọng đọc, nếu máy có đủ TTS:
SMOKE_REQUIRE_TTS=1 bash scripts/smoke-test.sh
```

Script clone bản **đã commit** vào thư mục tạm, `npm ci`, build, chạy bằng avatar
mẫu và dữ liệu tạm, kiểm tra status, mục lục, hai avatar và TTS rồi dọn sạch.
Mặc định dùng cổng 8791; dừng server thử cũ trước, hoặc đặt `SMOKE_PORT`.
Linux CI không cần Ollama. Nếu TTS không khả dụng, lượt thường xác nhận
phản hồi lỗi và báo rõ chưa xác minh tạo audio; lượt `SMOKE_REQUIRE_TTS=1` thất bại.

**Chưa thử trên máy macOS thứ hai.** Khi bạn có máy khác: cài Node 24 và Git,
clone repo, chạy script trên; sau đó `npm ci`, `npm run build`, chạy
`XIAOYA_SAMPLE_AVATARS=1 XIAOYA_DATA_DIR=/tmp/misu-test npm start`.
Mở app, tạo người học thử, vào HSK 1/HSK 5 và kiểm tra nghe; cài Whisper nếu
muốn thử thu âm/chấm thanh. Ghi lại phiên bản macOS, Node, CPU, lệnh chạy,
kết quả và lỗi vào `docs/IMPLEMENTED-next-2.md`. Đây là hướng dẫn cần thử,
không phải biên bản đã thử thành công.

- Thiếu **ffmpeg**: cài `brew install ffmpeg`, hoặc đặt `FFMPEG_PATH` và `FFPROBE_PATH` tới binary thật.
- Thiếu **cmake** khi cài Whisper: `brew install cmake`, rồi chạy lại `npm run setup:whisper`.
- **Ollama chưa chạy**: mở Ollama, tải model và kiểm tra `ollama list`; bài tự soạn vẫn mở được khi chưa có model.
- **Micro bị chặn**: cho phép micro trong quyền của trình duyệt và macOS; dùng localhost, kiểm tra thiết bị đầu vào. Không đổi ngưỡng để che lỗi thu âm.

### Giọng đọc và phép thử Edge thật

Phần tương thích GEC v2 thay URL/token v1 của `msedge-tts` 2.1.0 theo
[upstream Edge TTS](https://github.com/rany2/edge-tts/issues/490). Phép thử này
chỉ đọc câu tự soạn, đòi kết quả `provider=edge`, không nhận giọng Mac thay thế:

```sh
npm run test:edge:live
```

Lệnh có mạng, được tách khỏi `npm test`/CI. Khi dùng giọng trình duyệt,
[giọng có sẵn tuỳ thiết bị](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices):
thêm gói giọng Trung `zh-CN` (hoặc Việt `vi-VN`) trong hệ điều hành rồi mở lại
trình duyệt. App không lấy giọng Anh thay cho Trung. Nếu tự đọc bị trình duyệt
chặn, bấm **Nghe** để thử lại. Giọng dự phòng không có audio để khớp khẩu hình
hoặc tạo đoạn mẫu chấm cao độ trên server.

### API cho máy yếu

Trong **Cài đặt → Máy yếu · dùng API của bạn**, nhập URL cổng Chat Completions
(gồm `/v1` hoặc đường dẫn tương ứng), mã model và key. Cổng cần hỗ trợ JSON-object
response. Chọn ô đồng ý gửi dữ liệu rồi bấm lưu; đổi URL sẽ yêu cầu đồng ý lại.
Phản hồi API được đọc trọn trước khi hiện, không bảo đảm có token xuất hiện ngay.
Chưa có model API bên ngoài nào được đo trong repo hoặc được khuyến nghị về chất lượng.

Key nằm trong `$XIAOYA_DATA_DIR/private/provider.json`, không thuộc dữ liệu
`xiaoya.*` đồng bộ trình duyệt. API cấu hình không trả key, lỗi upstream không
được phản chiếu nguyên văn. Cấu hình/xoá key chỉ thực hiện từ localhost của máy
chủ; thiết bị LAN có PIN không có quyền cấu hình. File key dựa vào quyền truy cập
hệ điều hành, không được mã hoá thành một kho bí mật riêng. Không đưa thư mục dữ
liệu vào Git. Xoá bằng nút **Xoá API/key**.

Muốn đo model bạn đã cấu hình, lệnh sau có thể tính phí theo dịch vụ. Chỉ ghi
số đo có file kết quả thực tế vào README:

```sh
EVAL_PROVIDER=compatible npm run eval:corrections -- MODEL_ID_DA_CAU_HINH http://127.0.0.1:8791
```

### Điện thoại cùng Wi-Fi: HTTPS + PIN

Mặc định vẫn là localhost. Chỉ khi muốn chia sẻ cho thiết bị tin cậy, khởi động
chế độ LAN. Thiết bị có PIN được đọc/sửa toàn bộ dữ liệu học dùng chung; đây
không phải hệ thống tài khoản tách biệt cho từng người.

macOS/Linux, với dữ liệu thử và avatar mẫu:

```sh
HOST=0.0.0.0 PORT=8791 XIAOYA_DATA_DIR=/tmp/misu-lan-test XIAOYA_SAMPLE_AVATARS=1 npm start
```

Windows PowerShell:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '8791'
$env:XIAOYA_DATA_DIR = Join-Path $env:TEMP 'misu-lan-test'
$env:XIAOYA_SAMPLE_AVATARS = '1'
npm start
```

- Server dùng HTTPS tự ký; chứng chỉ và private key ở thư mục dữ liệu `private/`.
  Mở `https://localhost:8791` trên máy chủ sau khi thiết lập tin cậy đúng cách.
  Chỉ chuyển **chứng chỉ công khai**, không chuyển `lan-key.pem` sang điện thoại.
- Trong Cài đặt có địa chỉ IP, QR **không chứa PIN**, PIN và dấu vân tay chứng chỉ.
  Đối chiếu dấu vân tay trên máy chủ; thiết lập tin cậy bằng cài đặt chứng chỉ
  của thiết bị hoặc dùng chứng chỉ đã được tin cậy cho IP đó. Không tắt kiểm tra
  TLS hay chỉ dựa vào thao tác bỏ qua cảnh báo của trình duyệt.
- Nếu nền tảng không tin cậy chứng chỉ tự ký này cho micro/PWA, cung cấp cả
  `XIAOYA_TLS_CERT` và `XIAOYA_TLS_KEY` là đường dẫn chứng chỉ/key đã chuẩn bị,
  còn hạn và có IP Wi-Fi trong SAN. Chứng chỉ không được coi là tin cậy tự động
  chỉ vì có HTTPS. [Micro cần secure context](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- Điện thoại cùng Wi-Fi quét QR, nhập PIN. Session dùng cookie Secure/HttpOnly,
  tối đa 12 giờ; khởi động lại server thu hồi session. Sai 8 lần khoá 10 phút.
  Có thể đặt `XIAOYA_LAN_PIN` 6–10 chữ số; mặc định tạo mới mỗi lần chạy.
- Chỉ cho app qua firewall trên mạng riêng, không mở port router ra Internet.
  Khi IP thay đổi, kiểm tra lại địa chỉ/chứng chỉ. Dừng server để tắt chia sẻ.
- Có manifest PWA, có thể dùng “Thêm vào màn hình chính” nếu trình duyệt đáp ứng
  [điều kiện cài đặt](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
  Service worker không cache API/audio/dữ liệu người học; app vẫn cần server.

Đã kiểm tra UI ở 375px và luồng HTTPS/PIN bằng client thử; **chưa xác minh micro,
trust chứng chỉ hay cài PWA trên Android/iPhone thật**. Không coi kiểm tra giả lập
là kiểm tra thiết bị thật.
