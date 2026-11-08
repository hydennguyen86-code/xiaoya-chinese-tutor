# Nhận giọng và chấm đọc

Tài liệu ngắn cho phần nhận dạng giọng nói trên máy: vì sao đổi, cách cài, cách đo.

## Vì sao whisper-small chấm tệ

Whisper là model đa ngôn ngữ, bản `small` đoán chữ theo ngữ cảnh. Với người học đọc
chưa chuẩn nó hay "sửa hộ" thành câu trơn tru, bỏ âm thừa, thêm chữ không có. Khi
đem chữ nó trả về so với câu mẫu thì dễ báo sai dù bạn đọc đúng, hoặc báo đúng dù
bạn đọc lệch. Vì vậy có hai thay đổi:

- Thêm backend chuyên tiếng Trung (sherpa-onnx: SenseVoice hoặc Paraformer), chạy
  trên máy, không gửi âm thanh đi đâu. Whisper vẫn còn làm dự phòng.
- Khi đã biết câu mẫu thì so theo **âm tiết pinyin**, không so chữ Hán. Đồng âm
  (事/是, 他/她) tính là đúng âm; khác thanh thì báo riêng là "có thể sai thanh".
  Lưu ý: máy đoán chữ theo ngữ cảnh nên chuyện "nghe thành thanh mấy" chỉ là gợi ý.

## Cài đặt

```
npm install            # lấy sherpa-onnx-node (optionalDependencies)
npm run setup:stt      # tải model SenseVoice vào models/ (đã gitignore)
```

`STT_MODELS=paraformer` (hoặc `all`) tải thêm Paraformer. Muốn dùng whisper lớn hơn:
`WHISPER_SIZE=large-v3-turbo-q5_0 npm run setup:whisper`.

## Biến môi trường

| Biến                   | Ý nghĩa                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `STT_BACKEND`          | `auto` (mặc định: sherpa nếu có, không thì whisper), `sherpa`, `whisper`, `off`                                              |
| `STT_SHERPA_MODEL_DIR` | thư mục model sherpa cụ thể; không đặt thì tự dò `models/sherpa-onnx-sense-voice-*` rồi `models/sherpa-onnx-paraformer-zh-*` |

Xem backend đang chạy ở `/api/status` (trường `sttBackend`).

## Đo thử trên ghi âm của bạn

1. Ghi âm bằng bộ thu có sẵn trong app (Hồ sơ học tập → bộ thu thanh điệu: 40 chữ, 16 từ,
   có cả câu). Bản thu nằm ở `data/eval-recordings/<mã người học>/` cùng `manifest.json`;
   script đọc thẳng thư mục này: `npm run eval:stt -- data/eval-recordings/<mã người học>`.
   Muốn đo câu dài hơn thì tự ghi `.wav/.m4a/.webm` vào một thư mục riêng (giọng thật luôn
   nằm ngoài repo) rồi khai báo câu mẫu như bước 2.
2. Khai báo câu mẫu bằng `manifest.json` (`{"version":1,"items":[{"file":"a.wav","text":"我今天很忙。"}]}`),
   hoặc `items.json`, hoặc đặt tên file là chính câu (`我今天很忙.wav`).
3. Chạy:

```
npm run eval:stt                      # thư mục mặc định
npm run eval:stt -- <thư-mục> --synth=20   # thêm 20 câu do Edge TTS đọc (cần mạng)
npm run eval:stt -- --backends=sherpa      # chỉ đo một backend
```

Kết quả in thành bảng và lưu ở `eval/results/stt-…json` (kèm commit, không kèm âm thanh).
Không có backend nào chạy được thì script báo rõ và thoát mã 1.

## Đọc kết quả

- **CER**: tỉ lệ chữ Hán sai so với câu mẫu. Thấp là tốt.
- **Đúng âm tiết**: tỉ lệ âm tiết khớp theo pinyin (đồng âm vẫn đúng). Gần với việc app sẽ chấm.
- **Chấm đạt**: tỉ lệ câu `scoreReading` cho qua.
- **ms/câu** và **tốc độ**: thời gian xử lý; dưới 1.0 nghĩa là nhanh hơn thời gian thật.
- Hàng "TTS" là bộ trần: giọng máy đọc chuẩn nên phải đúng gần hết. Thấp thì lỗi ở backend.
- Hàng "người đọc" mới phản ánh trải nghiệm thật. 40 câu của một người chỉ là dấu hiệu, chưa phải kết luận.

## Bước sau (chưa làm)

Dùng API chấm phát âm chuyên dụng (đối chứng bằng `npm run eval:azure` đã có) để chấm
đúng âm vị thay vì đoán qua chữ. Chỉ nên làm sau khi có số đo từ bộ ghi âm thật.
