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

---

## Rà soát đợt 2026-11-08: 82 buổi cố định, 30 bài misu30, nghe, đọc, benchmark

Rà soát bởi AI (không phải giáo viên). Công cụ mới: `node scripts/audit-lessons.mjs [--all] [--section=struct,pinyin,dup,level,meaning,dialog,aux] [--json]`.
Công cụ chỉ liệt kê chỗ để xem tay; không sửa file, không phải cổng chặn. Các checker có sẵn
(`check:assets`, `check-course-day2`, `hsk-coverage`, `review-lesson` cho cả 112 file, 7 checker trong
`scripts/listening-checks/`, `npm test`) đều pass sau khi sửa.

### Đã đọc tay bằng mắt
- Toàn bộ 24 buổi HSK 1 (từ vựng, mẫu câu, nhập vai, nghe, nói, thẻ phát âm, đề chặng) và bộ dictation/shadowing tương ứng.
- 10 bài misu30-1.
- HSK 3 và HSK 5: đọc toàn bộ từ vựng, bản nghe và câu hỏi nghe; đọc nhanh phần còn lại + kiểm bằng script.
- misu30-2, misu30-3, nhập môn pinyin: đọc từ vựng/mẫu câu; phần nhập vai và nói kiểm bằng script.

### Kết quả theo loại (đã sửa)
| Loại | Số | Ví dụ |
|---|---|---|
| Số liệu/logic trong bài nghe | 1 bài (5 chỗ) | hsk3-practical-3-d1: dịch 一百一 thành "111" (đúng là 110); hai chiếc giá 110 trong khi một chiếc 120; 150 − 40 không khớp. Sửa thành 二百一 / 二百五十块 / 找四十, đồng bộ transcript, pinyin, dịch, đáp án, đoạn kể lại |
| Gợi ý phát âm sai | 2 thẻ (3 file) | 学习: ghi "cả hai tiếng đều ü" (xí là i, không phải ü); 预约: ghi "hai thanh 4" (yuē là thanh 1) |
| Nghĩa tiếng Việt sai/gây hiểu nhầm | 11 mục | 习惯 "làm quen" → "quen với"; 电影 "rạp phim" → "điện ảnh"; 合适 "vừa ý" → "vừa vặn; phù hợp"; 菜单 "bảng gọi món" → "thực đơn"; 讲义 "giáo án" → "tài liệu bài giảng"; 米 "cơm" → "gạo"; 请客 "bao tiền" → "đãi"; 邀请 "mời mọc"; 路 "lộ"; 吗 "chăng"; 朋友说什么 dịch "Bạn nói gì?" → "Bạn tôi nói gì?" |
| Bản dịch ví dụ trùng/lệch | 4 | 手机 dịch giống hệt 电话; 锻炼 "tập rèn luyện"; 传统 "Tết Xuân" → "Tết Nguyên đán"; "rủ rê" (nghĩa xấu) → "rủ" (3 chỗ) |
| Câu tiếng Trung không tự nhiên | 1 | 方向: 往前走就是你要的方向 → 你走错方向了，要往回走 (pinyin tính lại) |
| Vượt bậc trong lời lệnh HSK 1 (freeTalk và speaking[1].prompt) | 21 buổi | 对方, 确认, 打招呼, 饮料, 价钱/价格, 比较, 安排, 虚构, 约, 把 → dùng từ HSK 1–2 (他, 问多少钱, 再问一次…); bản dịch giữ ý, chỉnh khi cần |
| Thiếu glossary đọc hiểu | 7 bài đọc | Thêm 很 (6 bài) và 见 (rd-1-010); trước đây chạm chữ không hiện nghĩa |
| Patch checkpoint lệch file bài | 2 patch | `hsk1-practical-12-d2.patch.json` mang pinyin chép nhầm từ bài 6 (và glossary cũ); `node scripts/apply-course-patches.mjs` báo "Patch cannot overwrite existing content". Đã đồng bộ theo file bài |

Không tìm thấy lỗi ở: trường bắt buộc thiếu/rỗng, đáp án nghe ngoài phạm vi, option trùng, cặp d1/d2 lệch nhau (script: 0 phát hiện), nghĩa rỗng, từ trùng giữa các bài ngoài thiết kế (chỉ 12 từ dùng lại, hợp lý).
`pinyin` lưu trong bài lệch pinyin-pro: 0 chỗ lỗi thật (xem mục dưới về 空调).

### Cần người có chuyên môn xem (chưa tự quyết)
1. **Lỗi trong code, ngoài phạm vi sửa lượt này:** `POLYPHONE_LOCKS['有空']` trong `src/lib/coursePinyin.mjs` khớp nhầm bên trong 有空调 (misu30-2-13 "房间里有空调吗？") nên `pinyinCitation` ra *kòng* thay vì *kōng*. Pinyin lưu trong bài đúng (kōng); chỗ nào tính lại bằng `pinyinCitation` (chấm thanh, thẻ thanh điệu) sẽ ra sai. Gợi ý: khóa `有空` kèm ký tự sau không phải 调, hoặc thêm khóa `空调: ['kōng','tiáo']` đứng sau.
2. **Bản dịch bản nghe dạng tóm tắt, không dịch từng lượt** (27 clip: HSK 3, nhập môn pinyin, phần đề chặng). HSK 1 có A:/B: từng câu. Người duyệt quyết định có cần bản dịch từng câu cho HSK 3 trở lên không.
3. **misu30 (30 bài):** bản nghe chỉ ghép 3 câu ví dụ từ vựng và câu hỏi chỉ hỏi nghĩa từ ("Cụm … nghĩa gì?"), không có hội thoại nghe hiểu thật; không có bộ chép chính tả/nhắc lại trong `lessons/listening/course/` (checker hiện loại trừ misu30). Có thể đây là lựa chọn thiết kế; nếu muốn đủ bộ như 82 buổi kia thì cần soạn 30 file và mở rộng `course-listening.check.mjs`, không làm trong lượt này.
4. **Từ ngoài băng mức trong ví dụ/đối thoại** (script `level`, đối chiếu `eval/hsk-standard.words.jsonl`; còn lại 160 dòng, nhiều dòng là chữ lẻ do tách từ): HSK 3 dùng 豆浆, 番茄, 喉咙, 晕, 扛, 尴尬, 宿舍, 业务, 患者…; HSK 5 và misu30 có tình huống tương tự. Đây là từ ngữ cảnh thực tế trong hội thoại nghe, không phải từ vựng mục tiêu; cần quyết định có chú giải sẵn hay thay bằng từ trong băng.
5. **`lessons/listening/course/hsk1-practical-3-d2.json`, dt-1-123 "电话是零。"** (Số điện thoại là không): câu vô nghĩa về nội dung. Sửa cần tính lại pinyin, baseTones, acceptTones, nên để người soạn bộ nghe quyết định.
6. **Chỉ có nghĩa-cặp, chưa kiểm ngữ nghĩa sâu:** nghĩa các từ đa nghĩa (点 giờ/gọi món, 换, 走) khác nhau giữa các bài là chủ ý theo ngữ cảnh; 吗 trong pinyin-intro-1 ghi "trợ từ nghi vấn (…không?)", người duyệt xem cách gọi quen thuộc với học viên Việt.
7. **Đồng bộ `syllabus.json`** (file này do tác nhân khác sửa, không động vào): các nghĩa sau trong `lessons/courses/` đã đổi nhưng mục lục còn bản cũ: 吗 "chăng (hỏi)", 米 "gạo; cơm", 路 "đường; lộ", 电影 "phim; rạp phim", 锻炼 "rèn luyện; tập", 习惯 "thói quen; làm quen", 邀请 "mời; mời mọc", chủ đề "rủ rê" (misu30-2-11). Đã lệch sẵn từ trước: 一把 "một nắm" (bài: "một nắm; một chiếc"), 免疫力 "sức miễn dịch" (bài: "khả năng miễn dịch"). Không có test bắt lệch này, nhưng nên đồng bộ để app không hiển thị hai nghĩa khác nhau.
