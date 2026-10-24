# Rà soát tài liệu học trong repo

Phạm vi: đọc nội dung cả 13 file `lessons/drafts/*-d1.json`, mục lục bản nháp,
và đối chiếu cách server nạp bài. Đây là rà soát bởi AI; không phải xác nhận của
giáo viên hay đối chiếu đầy đủ với danh mục HSK chính thức. Không đánh giá nội
dung sách 《体验汉语口语》 vì repo không chứa sách.

## Kết luận

Chưa đủ điều kiện gọi là giáo trình hoàn chỉnh. Có khung chủ đề giao tiếp dùng
được, nhưng bài model sinh còn sai nghĩa, và chuỗi bài tự soạn chưa đủ phần
kiến thức để hoàn thành mọi nhiệm vụ. Test cấu trúc không chứng minh độ đúng
của tiếng Trung, dịch nghĩa hay hiệu quả học.

10 bài `misu-original` là bản nháp do chính tác nhân trước đó soạn trong lượt
triển khai, không phải tài liệu đã được chuyên gia duyệt. Những thiếu sót của
chúng cũng thuộc phần việc còn cần biên tập, không chỉ lỗi của model local.

## Bài model sinh: cần sửa trước khi dùng để dạy

| File | Phát hiện | Hướng sửa |
|---|---|---|
| tam-so-cap-2-d1 | 哥哥: “anh trai (em gái)”; 姐姐: “chị gái (em trai)”; 弟弟/妹妹 có phần “(anh chị)” gây hiểu sai | Chỉ ghi lần lượt anh trai, chị gái, em trai, em gái; nếu giải thích quan hệ thì viết thành câu riêng chính xác |
| tam-so-cap-2-d1 | 亲戚 ghi “họ hàng xa”, thu hẹp nghĩa không đúng | “Họ hàng”, có thể cả gần và xa |
| tam-so-cap-2-d1 | ……在…… gộp vị trí và hành động mà không nêu khác biệt | Tách 在 + địa điểm và 在 + động từ; mỗi cấu trúc có ví dụ riêng |
| tam-so-cap-2-d1 | Vai học sinh lớp 6/7 bị tự gán, câu mở đầu gọi cả lớp | Dùng vai theo người học hoặc trung tính; mở đầu hội thoại một đối một |
| tam-trung-cap-2-d1 | 我……了 được giải thích quá rộng; 吗 chỉ giải thích “dùng để hỏi” | Giới hạn cách dùng 了 theo ví dụ/trạng thái thay đổi; 吗 dùng câu hỏi có/không, tránh gợi ý gắn vào mọi câu hỏi |
| tam-trung-cap-2-d1 | Dịch “Bác sĩ bảo tôi làm kiểm tra”, “Nơi đây rất đau”; gọi người đi khám là khách hàng | “Bác sĩ bảo tôi đi khám/kiểm tra thêm” tùy ngữ cảnh; “Chỗ này rất đau”; vai là bệnh nhân |
| tam-trung-cap-2-d1 | Mục tiêu “lắng nghe lời khuyên” không thể xác minh chỉ từ lời người học | Yêu cầu người học nhắc lại một thông tin vừa nghe; tránh coi việc có hội thoại là đã kiểm tra nghe hiểu |
| tam-trung-cap-2-d1 | Mẫu 我……了 / ……吗 khá đơn giản so với nhãn trung cấp | Bổ sung kể thời điểm bắt đầu triệu chứng, mức độ và câu hỏi làm rõ; chưa khẳng định đối chiếu HSK |
| tam-cao-cap-2-d1 | 攀比: “Soi mó, so sánh với người khác để tự ti” sai và khó hiểu | “So bì, đua đòi hơn thua với người khác”; tự ti không phải nghĩa bắt buộc |
| tam-cao-cap-2-d1 | 榜样 dịch “mẫu mực”; 自由 được giải thích như quyền làm gì tùy thích | “Tấm gương/người để noi theo”; “tự do”, giải thích theo ngữ cảnh |
| tam-cao-cap-2-d1 | Vai người học là con nhưng câu hỏi yêu cầu bình luận việc cha mẹ cho con học ngoại khóa | Chọn rõ hai phụ huynh trao đổi hoặc con trao đổi với cha mẹ về việc học của chính mình |
| tam-cao-cap-2-d1 | Mẫu ……很重要 chưa đủ tạo độ khó cao cấp | Giữ như ôn lại; bổ sung yêu cầu lập luận, nêu ví dụ, phản hồi quan điểm và giới hạn của giải pháp |

## Mười bài tự soạn: rà từng bài

| Bài | Nhận xét | Cần bổ sung/biên tập |
|---|---|---|
| 1. Chào hỏi | Câu giới thiệu nhìn chung dùng được; freeTalk 你想认识什么样的朋友？ đòi cấu trúc vượt phần vừa dạy | Đổi câu hỏi cuối sang tự giới thiệu ngắn; dạy 你叫什么名字？ ngoài 我叫……; có giải thích pinyin/thanh điệu cho người mới |
| 2. Gia đình | Từ chỉ quan hệ cơ bản đúng; câu mở đầu hỏi số người nhưng chưa dạy đếm và 口 | Dạy 我家有……口人 và số đếm; nêu 家 là nhà/gia đình tùy ngữ cảnh, 孩子 là đứa trẻ/con |
| 3. Hẹn thời gian | Câu dùng được, nhưng cần biết số và 几点 / 有空 mới làm được nhiệm vụ | Thêm mẫu hỏi giờ rảnh và xác nhận ngày giờ; đưa số đếm trước bài này |
| 4. Gọi đồ uống | Có ví dụ ít đường/không đá nhưng phần mẫu câu chỉ có 我要…… | Dạy 请少放糖 / 请不要加冰 rõ thành hai mẫu vận dụng, rồi kiểm tra lại bằng đồ uống khác |
| 5. Ăn uống | 这个鸡肉很好吃 hơi vụng làm câu mẫu; mục tiêu ít cay chưa có mẫu hỗ trợ | Ưu tiên 鸡肉很好吃; dạy yêu cầu ít cay; dịch 您 trung tính là “bạn/anh/chị” theo bối cảnh, không tự gán giới |
| 6. Hỏi đường | Có từ hướng, nhưng mẫu chỉ hỏi ở đâu; mục tiêu xác nhận hướng chưa được luyện | Thêm 是往左走吗？ hoặc 往右走，对吗？; giới thiệu địa điểm dùng trong ví dụ và giảm từ ngoài bài |
| 7. Mua đồ | 便宜一点儿 gợi ý so sánh nhưng chưa có đối tượng so; mục tiêu kích cỡ thiếu mẫu hỏi | Thêm 有大一点儿的吗？ và hỏi giá; tách 件 là lượng từ, 衣服 là quần áo |
| 8. Sở thích | Nội dung cơ bản hợp lý; chỉ mẫu 我喜欢…… chưa đủ cho mục tiêu rủ bạn | Dạy 我们一起……吧; 这部电影很好看 phù hợp làm mẫu chuẩn hơn 这个电影很好看 dù cách nói sau gặp trong khẩu ngữ |
| 9. Thời tiết | Câu cơ bản dùng được; mục tiêu nêu lý do và câu 下雨的时候 đòi kiến thức chưa dạy | Cho sẵn mẫu đơn giản nối thời tiết với quyết định; đưa 的时候 thành phần mở rộng sau |
| 10. Sinh hoạt | Câu dùng được; 上班/下班 giả định người học đi làm, trong khi app có nhiều đối tượng | Có lựa chọn 上学/放学; làm rõ thời gian đứng trước động từ và tái dùng kiến thức giờ giấc |

## Thiếu ở mức thiết kế giáo trình

1. Mục lục có 10 bài × 2 buổi, nhưng mới có 10 file buổi 1 của bộ tự soạn.
   Không có nội dung cố định cho buổi 2, bài nghe, bài tập và đáp án tương ứng.
2. Chưa có phần nhập môn pinyin, thanh điệu, biến điệu và cách nghe–nhắc lại.
   Không phải mọi người gắn nhãn HSK1–2 đều bắt đầu từ con số không, nên cần
   nêu điều kiện đầu vào hoặc thêm nhánh nhập môn.
3. Mục lục chỉ có tên/chủ đề/ngày, chưa khóa từ vựng, mẫu câu, kiến thức tiền đề,
   số lần ôn lại và chuẩn đầu ra của mỗi bài.
4. Chưa có đối chiếu chính thức theo từng cấp/phiên bản HSK; gắn nhãn mức học
   rộng không tương đương tuyên bố bao phủ chương trình HSK.
5. Nhiệm vụ và bài thi nhiều chỗ chưa khớp phần kiến thức đã dạy. Cần ma trận
   “dạy cấu trúc nào → luyện dạng nào → kiểm tra nhiệm vụ nào”.
6. 10 bản nháp gốc chưa có pinyin lưu sẵn. Bộ nạp có thể sinh pinyin, nhưng
   các cách đọc đa âm và biến điệu trong ngữ cảnh vẫn cần được kiểm tra.

## Tài liệu này có đang được app sử dụng không?

Chưa được nạp như một khóa học cố định. Không thấy file mục lục thực tế ở
`data/syllabus/tiyan-hanyu-kouyu.json` trong lần kiểm tra này. Server ưu tiên
file đã duyệt trong `data/lessons-reviewed/` hoặc `lessons/reviewed/`; các file
trong `lessons/drafts/` chỉ là bản nháp tham khảo. Chỉ chép mục lục bản nháp
vào data cũng chưa làm server tự dùng nội dung của các file draft.

Nếu muốn cung cấp bài cố định đã được AI biên tập nhưng chưa được người duyệt,
cần trạng thái hiển thị riêng “bản thử nghiệm/chưa duyệt” và một cơ chế nạp có
chủ ý. Không đổi cờ `reviewed` để vượt qua điều kiện của bộ nạp.

## Thứ tự xử lý đề xuất

- Sửa nghĩa sai trong 3 bài thử model; giữ bản đo gốc để biết chất lượng thực tế.
- Biên tập 10 bài tự soạn và bổ sung mẫu câu đủ cho từng nhiệm vụ.
- Bổ sung kiến thức tiền đề về phát âm, số đếm và lượng từ.
- Soạn buổi 2 làm nhiệm vụ ôn chuyển ngữ cảnh, không chỉ thay câu ví dụ.
- Nạp bộ bài cố định theo trạng thái minh bạch, sau đó nhờ người có chuyên môn
  duyệt ngôn ngữ và thử với người học đúng nhóm mục tiêu.
