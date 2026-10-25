# Các việc cần bổ sung thông tin

## 2026-10-25 — Nhãn bộ đo giọng thật

Chưa thấy labels.*.json và các nhãn manifest còn trống trong bộ bản thu cắt sẵn. Cần người nghe gắn nhãn đủ 56 mục cho ít nhất một người trước khi thử chỉnh ngưỡng. Không dùng expected/app-scores làm đáp án.

Importer hiện hỗ trợ sidecar v1: `{ "version": 1, "source": "self", "reviewedBy": "người nghe", "labels": [{ "id": "single-1-1", "tones": [4] }] }`. Khi Qoder xuất nhãn cần đối chiếu schema thực tế. 0: chưa rõ, 1–4: thanh nghe được, 5: thanh nhẹ. Vai trò expert không tự đồng nghĩa với giáo viên đã duyệt.

Bổ sung từ HANDOFF: bộ cắt hiện có 55/56 mục dùng được; cần thu lại mục hỏng rồi người nghe gắn nhãn. Hiện chưa tiến hành chỉnh ngưỡng.

## LAN nhiều người

PIN hiện cấp quyền chung cho người dùng LAN, gồm endpoint giọng nói và dữ liệu hồ sơ. Nếu định dùng ngoài nhóm tin cậy, cần quyết định thiết kế tài khoản/phân quyền; chưa tự thay đổi thành owner-only vì sẽ chặn micro điện thoại. README đã nêu giới hạn này.
