# Kế hoạch: tập trung nghe – nói (25/10)

Quyết định của người dùng: Misu **không** làm app học hoàn chỉnh. Mọi nguồn lực dồn vào nghe và nói cho người Việt.

Thứ tự làm:
1. Xong phần A và mục E của `PLAN-next-3.md` (nền tảng chạy được, giấy phép, riêng tư).
2. Làm file này.
3. Các mục B còn lại của PLAN-next-3 chỉ làm khi phục vụ nghe – nói.

**Hoãn:** viết chữ Hán (B12), thống kê độ phủ từ HSK (B13), lộ trình theo nghề (B11). **Giữ nguyên, không đầu tư thêm:** phân tích hồ sơ bằng LLM, phần "Nói tự do".

Luật cũ vẫn giữ: dữ liệu tạm, avatar mẫu, không push, mỗi mục một commit, có typecheck/test/build.

## Đã có, đừng làm lại

- Hồ sơ cao độ theo từng người học.
- Đường cong giọng mẫu, chia chữ và nghe lại từng chữ.
- Bài nghe có transcript trong lộ trình HSK1/HSK5.
- Màn hình ghi bộ đo người thật.
- `mediaTools` tìm ffmpeg.
- Màn hình kiểm tra hệ thống.

**Không** cắt âm tiết theo mốc thời gian của whisper: đã thử, mốc của âm tiết ngắn không đáng tin. Muốn cắt chính xác hơn thì dùng forced alignment, và chỉ nhận nếu đo trên người thật thấy tốt hơn.

## Nghe (đang thiếu nhiều nhất)

1. **Luyện tai thanh điệu**:
   - Nghe một âm tiết hoặc từ 2 chữ, chọn thanh.
   - Cặp tối thiểu (mā/má/mǎ/mà; thanh 2–3; thanh 4 với thanh 2).
   - **Tự thích ứng**: câu hỏi ưu tiên các cặp mà người học hay nhầm, lấy từ ma trận nhầm lẫn của chính họ ở cả phần nghe lẫn phần nói.
2. **Cặp âm dễ lẫn với người Việt**: zh/ch/sh/r với z/c/s, j/q/x, ü với u, an/ang, en/eng, in/ing. Dạng nghe rồi chọn, không phụ thuộc bộ nhận dạng.
3. **Nghe chép**: dùng chính câu ví dụ và câu nhập vai của bài.
   - Người học gõ pinyin (không cần dấu) hoặc chữ Hán.
   - So từng chữ và tô chỗ sai.
   - Cho nghe lại từng đoạn.
4. **Nghe ở nhiều tốc độ**: 0.7 → 0.85 → 1.0. Edge, `say` và giọng trình duyệt đều chỉnh được tốc độ.
   - Nút "nghe chậm" ở mọi câu.
   - Trong nhập vai, mặc định ẩn chữ: người học nghe trước, bấm mới hiện chữ. Có tuỳ chọn tắt.
5. **Giọng người thật**: tập câu Common Voice zh-CN (CC0), tải về khi cần (mục F26 của PLAN-next-3). Dùng cho bài nghe và nghe chép, để tai không chỉ quen giọng máy.

## Nói

6. **Vòng sửa lỗi phát âm**: khi một chữ sai thanh, mở vòng luyện ngắn:
   - nghe mẫu chữ đó đọc riêng, nói theo;
   - rồi cả từ, rồi cả câu;
   - qua khi đúng 2 lần liên tiếp. Chữ chưa chấm được thì không tính.
7. **Ôn phát âm theo lịch**:
   - Lỗi thanh và cặp âm hay lẫn được đưa vào ôn tập như từ vựng, nhưng khoảng cách ôn ngắn hơn.
   - Ghi trong `learning.ts`, có chuyển đổi dữ liệu cũ, có test.
8. **Nói đuổi (shadowing)**: phát câu mẫu, người học nói theo ngay sau; so đường cao độ, độ dài và chỗ ngắt. Có thang tốc độ như mục 4.
9. **Độ trôi chảy** trong hội thoại và nhập vai:
   - Đo số âm tiết mỗi giây và số chỗ ngập ngừng hơn 1 giây, dựa trên năng lượng âm thanh và số chữ whisper nghe được.
   - Hiện xu hướng theo tuần trong lịch sử và trong bài thi tuần/tháng.
   - Ghi rõ đây là chỉ số tham khảo.
10. **Chấm câu vừa nói trong hội thoại**: giữ lại bản ghi của lượt nói. Nút "Xem phát âm câu này" chạy chấm thanh điệu trên chữ whisper nghe được, hiện đường cong và vòng sửa ở mục 6.
11. **Độ trễ khi nói chuyện** (nói chuyện chỉ "đỉnh" khi đáp nhanh):
    - Đo thời gian từ lúc người học ngừng nói đến lúc avatar bắt đầu phát tiếng, chia theo từng khâu: nhận dạng, model, giọng đọc.
    - Ghi lại số đo; mục tiêu dưới khoảng 2,5 giây trên máy này.
    - Giảm bằng cách: đọc câu đầu ngay khi model trả xong câu đó (streaming), làm nóng model trước, và cắt sớm khi im lặng.

## Bằng chứng

12. **Đo trên người thật** (mục F27 của PLAN-next-3, cần người dùng):
    - Ba người học trong nhà ghi bộ đo, nhờ người nói tiếng Trung tốt gắn nhãn.
    - Công bố ma trận nhầm lẫn và độ trôi chảy trong `eval/results/`.
    - Mọi thay đổi ngưỡng chấm hay cách cắt âm tiết đều phải so trước/sau trên bộ này.
