# Giọng clone (không bắt buộc)

Misu có thể đọc bằng một giọng riêng do **một dịch vụ chạy riêng trên máy bạn**
tạo ra (ví dụ một server Python dùng model clone giọng). Repo này không kèm
dịch vụ đó hay mẫu giọng nào. Chỉ dùng giọng của người đã đồng ý.

## Cách kết nối

| Giọng | Biến môi trường | Mặc định |
|---|---|---|
| Giọng riêng tiếng Trung | `VOICE_CLONE_URL` | `http://127.0.0.1:8766` |
| Giọng riêng tiếng Việt | `VOICE_CLONE_VI_URL` | `http://127.0.0.1:8767` |

Khi dịch vụ không trả lời, Misu tự đọc bằng giọng thường.

## Giao tiếp mà dịch vụ cần hỗ trợ

`POST <url>/synthesize`, nội dung JSON:

```json
{ "text": "你好", "language": "Chinese" }
```

`language` là `"Chinese"` hoặc `"Vietnamese"`. Dịch vụ trả về:

- thành công: âm thanh WAV (`audio/wav`) trong thân phản hồi; có thể kèm
  header `x-duration-ms` là độ dài tính bằng mili giây;
- lỗi: mã HTTP khác 2xx, thân JSON `{ "error": "lý do" }`.
