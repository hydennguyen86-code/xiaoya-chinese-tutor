# Các việc còn cần dữ liệu hoặc quyết định

## 2026-10-25 — Bộ đo người thật

Hiện đã đọc được 55 mục nhãn nguồn peer và 6 câu hiệu chỉnh riêng tại chỗ;
1 mục bị đánh dấu cắt hỏng. Cần thu lại mục đó và người nghe gắn đủ 56 mục
trước khi thử chỉnh ngưỡng. complete=true chỉ là đủ tập audio dùng được;
fullSetLabeled=false là chưa đủ điều kiện tinh chỉnh. Không lấy expected hay
điểm máy làm nhãn người. Các vai trò self/peer/expert do người nghe chọn,
chưa xác minh chuyên môn. Không cần đợi trả lời để tiếp tục công việc khác.

## Các quyết định Q1–Q3 trong HANDOFF đã chốt

- Q1: giữ sửa grammar của Claude trong 2d21afd.
- Q2: 30 bài giao tiếp là lộ trình song song, giữ mặc định cũ; đã có lựa chọn
  riêng và nút bắt đầu từ bài 1 khi vào giữa lộ trình.
- Q3: người nghe tự chọn self/peer/expert, không suy ra expert từ tên.

## LAN nhiều người

PIN hiện cấp quyền chung, gồm endpoint giọng nói và dữ liệu hồ sơ. Nếu dùng
ngoài nhóm tin cậy, cần quyết định thiết kế tài khoản/phân quyền riêng.
Hiện giữ luồng điện thoại đang có và ghi rõ giới hạn trong README.
