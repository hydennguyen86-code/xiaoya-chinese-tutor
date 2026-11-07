# Bộ chấm thanh điệu bằng mô hình (tuỳ chọn)

Mặc định Misu chấm thanh bằng **bộ luật hình dạng cao độ** trong `server/tones.mjs`:
chỉ chấm từ 1–2 chữ, câu dài chỉ vẽ đường cao độ. Thư mục này thêm một **dịch vụ
Python** chấm từng âm tiết bằng mô hình học máy, kể cả trong câu dài. Khi dịch vụ
chạy, server tự dùng nó (`server/toneModel.mjs`); khi không, mọi thứ như cũ.

Cách làm theo hướng của các nghiên cứu mở: Tone.me (MIT) tinh chỉnh wav2vec2 trên
từng âm tiết cắt từ AISHELL-3; Tonara dùng đường cao độ pYIN + MLP nhỏ. Ở đây gộp
hai góc nhìn:

- **wav2vec2 tiếng Trung** `TencentGameMate/chinese-wav2vec2-base` (WenetSpeech
  10k giờ, MIT) chạy cả câu, lấy lớp ẩn số 8 (lớp mang thông tin thanh điệu rõ
  nhất theo khảo sát từng lớp của Shih & Hsu 2024), gộp trung bình + độ lệch
  trên các khung của âm tiết → vector có ngữ cảnh.
- **Cao độ pYIN** quy về semitone so với trung vị câu, lấy mẫu 16 điểm + 14 số
  mô tả dáng (dốc, cong, biên độ, vị trí điểm thấp, tỉ lệ hữu thanh, độ dài) + vị
  trí trong từ.
- **MLP nhỏ** (LayerNorm → 256 → 64 → 5 lớp: thanh 1–4 và thanh nhẹ) trên hai
  vector nối lại (`tone/weights/tone-mlp.pt`, ~1,7 MB) và một MLP chỉ cao độ
  (`tone-mlp-pitch.pt`, ~0,1 MB); dịch vụ lấy trung bình xác suất của hai bộ
  (`TONE_ENSEMBLE=both,pitch`), vì trên bản thu người học thật cặp này khớp người
  nghe tốt hơn từng bộ riêng.

Server quyết định dùng kết quả thế nào (`mergeVerdict` trong `server/toneModel.mjs`):
chắc dưới `TONE_MIN_CONFIDENCE` (0,6) thì báo "—" (chưa chấm); từ 1–2 chữ còn đối
chiếu với bộ luật, hai bên trái nhau mà mô hình chưa chắc trên `TONE_OVERRIDE_CONFIDENCE`
(0,8) thì cũng để trống. Thanh nhẹ chỉ được xác nhận, không bao giờ bị chấm sai.

## Cài

```bash
npm run setup:tone      # tạo .venv-tone, cài torch/transformers/librosa (~2 GB)
npm start               # server thấy .venv-tone + trọng số là tự chạy dịch vụ
```

Lần đầu dịch vụ tải backbone (~380 MB) về cache Hugging Face. Kiểm tra ở màn
hình **Kiểm tra → 3b. Chấm thanh điệu**, hoặc `curl 127.0.0.1:8768/health`.
Biến môi trường: `TONE_MODEL_URL` (mặc định `http://127.0.0.1:8768`, `off` để
tắt), `TONE_PYTHON`, `TONE_WEIGHTS`, `TONE_DEVICE` (`mps`/`cuda`/`cpu`).

## Huấn luyện lại

Dữ liệu huấn luyện **không có giọng người thật**: giọng máy đọc chữ đơn, từ 2
chữ trong danh mục HSK và câu ví dụ trong bài học; thanh của từng chữ lấy từ chữ
viết (pinyin-pro + luật thanh nhẹ, biến điệu 一/不 và 3-3 không bắc qua dấu
câu); mốc âm tiết do chính bộ cắt năng lượng của app (hoặc mốc từ của Edge TTS).

```bash
npm run tone:dataset    # data/tone-train/{say,edge}: ~20 nghìn câu/từ, ~1 giờ
npm run tone:train      # giữ lại 2 giọng để kiểm tra; ghi tone/weights/
```

`tone/train.py --human <file.jsonl>` đo thêm trên bản thu người học đã có nhãn
người nghe (tạo bằng `eval/tone-train/segment-recordings.mjs` từ bộ thu riêng,
audio giữ nguyên chỗ cũ, không vào repo). Số đo được ghi ở
`tone/weights/metrics.json` và `eval/results/`. Bộ thu người thật chỉ dùng để
**đo**, không huấn luyện.

## Đối chứng với Azure

`npm run eval:azure -- <thư mục bản thu>` (cần `AZURE_SPEECH_KEY`,
`AZURE_SPEECH_REGION`) gửi cùng bộ thu lên Azure Pronunciation Assessment zh-CN
để so cờ "sai" của Azure, của người nghe và của app trên từng chữ. Azure chấm độ
chính xác phát âm nói chung, không chấm số thanh, nên chỉ là thước đo tham khảo.
Không bắt buộc, không gọi tự động.

## Số đo hiện có (2026-11-07)

Huấn luyện: 12 660 câu/từ giọng máy (2 giọng macOS đọc theo lô, 4 giọng macOS đọc
từng mục, 5 giọng Edge), 42 034 âm tiết; giữ lại 2 giọng (Grandpa, Yunxi) để
kiểm tra. Đo thật trên bộ thu của một người học (55 mục, 70 âm tiết có nhãn
người nghe `peer`; `eval/results/tones-human-model-…2026-11-07`):

| Bộ chấm | Giọng máy giữ lại | Khớp người nghe, chấm hết | Khớp người nghe khi bỏ chữ chưa chắc |
|---|---|---|---|
| Bộ luật cũ (chỉ từ 1–2 chữ) | — | 45/70 = 64 % (14 chữ báo chưa chấm) | 45/56 = 80 % |
| MLP speech + pitch (`tone-mlp.pt`) | 88,2 % | 74 % | ngưỡng 0,6: 83 % chữ, 74 % |
| MLP chỉ cao độ (`tone-mlp-pitch.pt`) | 46,5 % | 77 % | ngưỡng 0,6: 73 % chữ, 78 % |
| **Gộp hai bộ (mặc định dịch vụ)** | — | 76 % | ngưỡng 0,6: 74 % chữ, **83 %**; ngưỡng 0,7: 54 % chữ, 87 % |
| Gộp + đối chiếu bộ luật (đường ống thật của app) | — | **59/70 = 84 %** | — |

Đọc số này đúng cách: 70 âm tiết của **một** người là quá ít để kết luận; sai lệch
còn lại chủ yếu là thanh 1 của người học bị máy nghe thành thanh 4 (8/29), và cả
bộ luật cũ lẫn mô hình đều nghe vậy, nên có thể là người học thật sự đọc ngắn,
rơi giọng. Hàng cuối dùng `heard` sau khi gộp với bộ luật (từ 1–2 chữ), nên cao
hơn mô hình đơn. Không dùng để nói app "đúng 84 %".

## Giới hạn (nói thật)

- Huấn luyện trên giọng máy; giọng người Việt học tiếng Trung khác giọng máy.
  Số đo trên bản thu người học thật được in ra khi huấn luyện, hãy đọc nó trước
  khi tin điểm.
- Mốc âm tiết vẫn do bộ cắt năng lượng ước lượng; đọc thiếu chữ hay nối âm sẽ
  cắt lệch và chấm lệch theo.
- Nhãn "sai" của máy không phải chứng chỉ; app không dùng điểm này để xếp loại
  người học.
