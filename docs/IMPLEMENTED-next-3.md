# Đợt 3 — kết quả phần A

Thực hiện 2026-10-24–25. Làm trên nhánh `save/learners-lam-avatar`, bắt đầu từ `c17f84b`.
**Chỉ làm A; dừng báo cáo trước B. B/C/D chưa thực hiện.** Một commit riêng cho A.
Không push, không tag/release, không sửa nội dung bài hay gắn nhãn đã duyệt.
Không thêm ảnh/giọng người thật, không chép sách.

## A1. Edge TTS

- Nguyên nhân trong code đang cài: `msedge-tts` 2.1.0 tạo GEC v1, trong khi
  upstream đã ghi nhận thay đổi GEC v2 tháng 10/2026. Lỗi cũ là handshake trả
  HTTP thường (200 ở máy thử) thay vì nâng cấp WebSocket. Không gọi HTTP 200
  là tổng hợp giọng thành công.
- Thay riêng URL builder bằng token GEC v2 theo upstream; giữ parser audio,
  metadata, timeout và cơ chế sửa lệch đồng hồ của msedge-tts. Không sửa node_modules.
- Module port giữ riêng tại `server/edgeGec.mjs`, **LGPLv3**, có source/ghi chú
  sửa đổi/giấy phép LGPL và GPL trong `licenses/`. Không nhầm MIT của subtitle
  composer với giấy phép DRM. Mã app khác giữ giấy phép hiện có.
- Test offline đối chiếu ba vector upstream và cửa sổ thời gian.
- `npm run test:edge:live`: tách khỏi CI, chỉ dùng câu thử tự soạn; yêu cầu
  provider=edge, không chấp nhận Mac fallback. Đã gọi thật: **18.288 byte audio,
  7 mốc từ**, khoảng 1.043 ms ở lượt đầu. Một lượt API /api/tts khác: Edge,
  **16.272 byte**. Không lưu audio vào repo, đây không phải số đo độ chính xác.
- Nguồn: https://github.com/rany2/edge-tts/issues/490 và drm.py của upstream;
  nguồn/giấy phép chi tiết trong NOTICE.md.

## A2. Giọng dự phòng trình duyệt

- Thử Edge trước; chỉ trên macOS mới gọi say; khi server TTS/network lỗi,
  client có đường speechSynthesis dùng đúng zh-CN hoặc vi-VN đã cài.
- Nối vào cả avatar 3D/LAM, nghe trong bài cố định và màn hình thử hệ thống.
  Có thông báo nguồn giọng, xử lý dừng/abort và timeout; không giả lập khẩu
  hình hoặc audio phân tích cao độ cho giọng trình duyệt.
- Không lấy giọng Anh/Đài Loan thay zh-CN khi thiếu giọng. Báo người dùng cài
  gói ngôn ngữ và bấm Nghe nếu autoplay bị chặn. Không mặc định mọi giọng đều offline.
- Test chọn giọng, thông báo nguồn, kết thúc và huỷ bằng mock Web Speech.
  **Chưa nghe/thu thực tế giọng dự phòng trên Windows/Android/iPhone**.

## A3. Windows

- `scripts/setup-whisper.ps1`: Windows x64, whisper.cpp v1.7.6, commit
  `a8d002cfd879315632a579e73f0148d06959de36`; ghim cùng commit script bash.
- Đối chiếu GitHub release chính thức, tải ZIP thử vào /tmp, kiểm tra có
  Release/whisper-server.exe và các DLL. SHA256 ZIP tải thật khớp:
  `0d2eca299c248f965bd0341bcb219db4b433c7f0c0ce2200d4df85765e8156a9`.
- Script kiểm tra SHA256 ZIP và model base/small theo metadata LFS upstream;
  tải model khi người dùng chạy, không đóng gói weights vào source. Có hướng
  dẫn winget ffmpeg, DLL Visual C++, bản base và WHISPER_MODEL.
- Sửa fileURLToPath, path.delimiter, tìm .exe/ffprobe cạnh ffmpeg và PATH cho
  Whisper; chỉ dùng các đường Homebrew ở nhánh macOS. npm start không dùng
  cú pháp gán NODE_ENV của shell POSIX nữa.
- CI có matrix Ubuntu/Windows/macOS, cài ffmpeg theo từng OS và parse script
  PowerShell trên Windows. Edge live test không nằm trong CI.
- **Chưa chạy PowerShell/whisper-server.exe trên Windows thật; chưa thử ARM64**.
  Chưa chạy CI GitHub (không push). Không coi đọc ZIP/test đường dẫn là kiểm
  chứng Whisper hay launcher chạy được trên Windows.

## A4. Khởi động bấm đúp

- Có start-windows.bat và start-mac.command; helper Node kiểm tra phiên bản,
  npm ci lần đầu/khi lockfile đổi, build, kiểm tra Ollama, gợi ý model theo RAM,
  chạy server loopback và mở trình duyệt. Thông báo tiếng Việt, có link hướng dẫn.
- Pipeline cài/build/server đã được thử riêng trong môi trường sạch.
  **Chưa thao tác bấm đúp launcher trong Windows Explorer hoặc macOS Finder**;
  chưa xác minh quyền chạy/quarantine của file tải từ GitHub trên máy khác.

## A5. Máy yếu và API tương thích

- Thêm adapter compatible và form URL/model/key, cần đồng ý gửi bản chép lời,
  hội thoại và dữ liệu học liên quan; đổi URL yêu cầu đồng ý lại. Hiển thị cảnh
  báo nguồn ngoài khi dùng; dịch vụ có thể tính phí.
- Key ở thư mục dữ liệu private/provider.json, ngoài namespace xiaoya.*.
  Không trả lại key trong status/config/store, không phản chiếu body lỗi
  upstream. API cấu hình chỉ cho socket loopback, có chặn Origin/Host sai.
  Key dựa vào bảo vệ filesystem của OS, không phải kho bí mật được mã hoá riêng.
- URL HTTPS, HTTP chỉ cho localhost; không chấp nhận credential/query trong
  URL, không theo redirect mang Authorization. Chỉ dùng model đã cấu hình.
  Adapter đòi JSON-object response, không âm thầm thử lại request tính phí.
- Test bằng key GIẢ và upstream mock: lưu/đọc lại/xoá, consent, URL, header,
  giới hạn model, lỗi an toàn và store không chứa key. Không dùng tài khoản
  API thật, không gửi dữ liệu người học lên dịch vụ model bên ngoài.
- Setup đọc RAM máy chủ và gợi ý; chỉ nhắc tên model đã có số đo cũ trong repo.
  eval:corrections nhận EVAL_PROVIDER để đo model khác khi người dùng tự chọn.
- **Chưa đo sửa câu cho model API bên ngoài nào**, không bổ sung kết quả hay
  đề xuất model bên ngoài vào README. Cấu hình không đồng nghĩa đã kết nối thành công.

## A6. Điện thoại, HTTPS/PIN và PWA

- Mặc định loopback; chỉ HOST=0.0.0.0 bật HTTPS + PIN. Chứng chỉ tự ký có SAN
  cho localhost/IP riêng, key riêng trong thư mục dữ liệu; nhận cặp chứng chỉ/key
  tuỳ chọn đã được tin cậy qua XIAOYA_TLS_CERT/XIAOYA_TLS_KEY.
- Kết nối không phải loopback cần PIN, cookie Secure/HttpOnly/SameSite=Strict,
  phiên 12 giờ, sai 8 lần khoá 10 phút. PIN/QR chỉ đọc từ localhost của máy chủ;
  QR không chứa PIN, client LAN không được đọc/sửa cấu hình API.
- Chặn Host ngoài danh sách, Origin khác; cho phép origin phát triển localhost
  cổng 5173 trên socket loopback. Không mở firewall/router tự động.
- Đã kiểm tra TLS thật với CA/chứng chỉ thử được chỉ định (không tắt verify),
  dùng IP nguồn không phải loopback từ cùng máy: chặn /api/store trước PIN,
  trang đăng nhập không lộ PIN, PIN sai bị từ chối, PIN đúng tạo cookie,
  status đọc được sau đăng nhập, config API vẫn 403.
- Có manifest và service worker không cache API/audio/avatar/dữ liệu; không
  quảng cáo hoạt động offline. Có QR địa chỉ trong Cài đặt.
- Kiểm tra trang chính và form API ở **375×812**, không tràn ngang
  (scrollWidth = innerWidth = 375). Chỉ dùng hồ sơ giả và avatar mẫu đeo kính.
- **Chưa thử điện thoại/Windows thật, micro qua HTTPS, quét QR bằng camera,
  tin cậy chứng chỉ trên Android/iOS hay cài PWA thật**. Chứng chỉ tự ký có
  HTTPS chưa tự động thành secure context tin cậy; hướng dẫn nói rõ giới hạn.
- PIN cấp quyền dùng chung dữ liệu trên máy, không phải phân quyền từng người học.

## Kiểm tra và dữ liệu thử

- Node 24.19.0, npm 11.21.1 trên Mac hiện tại.
- Cài sạch: clone local vào thư mục tạm, phủ source tracked/non-ignored của
  phần A trước commit, npm ci, typecheck, **60 test qua**, build qua. npm ci
  báo 0 vulnerabilities. Không sao chép file ignored/data/avatar cá nhân.
- Server HTTP dùng `/tmp/misu-next3-http`, cổng 8791, XIAOYA_SAMPLE_AVATARS=1.
  HTTPS dùng `/tmp/misu-next3-https`, cổng 8792, cùng cờ avatar mẫu.
- Các unit test tự tạo thư mục tạm; test audio dùng WAV tổng hợp và không
  lưu thành kết quả người thật. Không đụng thư mục data/ thật.
- Kiểm tra bắt buộc trước commit và trạng thái dọn server sẽ được xác nhận
  ở đoạn cuối tài liệu này. Build còn cảnh báo bundle >500 KB.

## Điểm dừng

Dừng sau commit phần A để người dùng xem báo cáo. **Chưa sang B, C hoặc D**;
chưa chỉnh ref Git, chưa làm phát hành, chưa push/tag, chưa duyệt bài thay người.

## Xác nhận trước commit A

Ngày 2026-10-25, đã chạy đúng chuỗi
`npm run typecheck && npm test && npm run build`: **qua, 60/60 test**.
`npm run format:check`, `npm run check:assets`, `git diff --check` đều qua.
Đã dừng cả hai server thử HTTP/HTTPS; đã trả viewport trình duyệt về mặc định.
Không chạy script setup Windows, không dùng API trả phí thật, không đánh dấu
các kiểm chứng thiết bị còn thiếu là đã hoàn thành. Dừng tại A, chờ người dùng
xem báo cáo trước khi làm B.
