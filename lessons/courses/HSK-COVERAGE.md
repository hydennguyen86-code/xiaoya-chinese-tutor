# Bảng đối chiếu từ vựng và ngữ pháp HSK

Sinh bởi `node scripts/hsk-coverage.mjs` ngày 2026-10-27 · danh sách mức lấy từ nguồn mã mở MIT đã ghi nhận ở [NOTICE.md](../../NOTICE.md): HSK 2.0, HSK 3.0 (2021) và bản sửa 2025, ngữ pháp theo bảng HSK 3.0 (624 điểm, chỉ dùng mức 1–6).

**Đọc bảng này thế nào.** "Dạy" là từ hiện trong `vocab[].word` hoặc chú giải của đề chặng; "gặp" là chuỗi chữ của từ xuất hiện đâu đó trong phần tiếng Trung của lộ trình (đối chiếu chuỗi con, không tách từ). Ô là `số từ đã dạy / số từ danh sách yêu cầu` cho đúng mức đó. **Không có ô nào ở đây chứng nhận người học đạt cấp**: đây là so trùng hình thức giữa kho bài và danh sách mức công bố, chưa có giáo viên duyệt, và chưa tính chất lượng ngữ cảnh của từng từ.

Băng mức mỗi lộ trình tự công bố: Nhập môn Pinyin = HSK 1–2 · HSK 1 · Nghe nói thực tế = HSK 1–2 · HSK 3 · Nghe nói thực tế = HSK 3–4 · HSK 5 · Nghe nói thực tế = HSK 5–6 · 30 bài giao tiếp · Tập 1 = HSK 1–2 · 30 bài giao tiếp · Tập 2 = HSK 3–4 · 30 bài giao tiếp · Tập 3 = HSK 5–6. App chưa có lộ trình mang tên HSK 2, HSK 4, HSK 6.

**Bức tranh chung.** Cả bảy lộ trình dạy 464 từ khác nhau, tức 7% kho từ vựng HSK 2.0 (mức 1–6) và 7% theo bản sửa 2025. Số đó dồn ở mức 1–2 (83/150 từ mức 1, 46/147 từ mức 2). Ở mức 5–6 chỉ dạy 96 từ và chỉ 418 từ trong 3798 từ của hai mức này từng xuất hiện ở đâu đó trong bài. Nói thẳng: đây là khoá giao tiếp thực tế, không phải chương trình luyện thi phủ trọn cấp.

| Lộ trình | Số buổi | Chỗ từ vựng | Từ phân biệt được dạy | Mẫu câu | Buổi có thẻ phát âm |
|---|---|---|---|---|---|
| Nhập môn Pinyin | 10 | 60 | 56 | 20 | 10/10 |
| HSK 1 · Nghe nói thực tế | 24 | 166 | 100 | 48 | 24/24 |
| HSK 3 · Nghe nói thực tế | 24 | 180 | 114 | 60 | 24/24 |
| HSK 5 · Nghe nói thực tế | 24 | 168 | 96 | 48 | 0/24 |
| 30 bài giao tiếp · Tập 1 | 10 | 80 | 80 | 30 | 0/10 |
| 30 bài giao tiếp · Tập 2 | 10 | 80 | 79 | 30 | 0/10 |
| 30 bài giao tiếp · Tập 3 | 10 | 80 | 75 | 30 | 0/10 |

Cột "Buổi có thẻ phát âm" là mô tả, không phải chỗ thiếu cần bù: thẻ nhận âm thanh điệu chỉ soạn cho băng HSK 1–3. Từ HSK 4 người học đã qua giai đoạn nhận âm, luyện nói của các bậc cao đi qua chép lời và nhắc lại theo giọng trong phần Hội thoại nhập vai.

## Từ vựng theo HSK 2.0

| Lộ trình | Mức 1 | Mức 2 | Mức 3 | Mức 4 | Mức 5 | Mức 6 | Lũy kế tới băng | Trong băng | Ngoài băng |
|---|---|---|---|---|---|---|---|---|---|
| Nhập môn Pinyin | 24/150 (16%) | 7/147 (5%) | 3/298 (1%) | 0/598 (0%) | 2/1298 (0%) | 0/2500 (0%) | dạy 31 · gặp 131 / 297 (10%) | 31 dạy · 131 gặp / 297 | 5 |
| HSK 1 · Nghe nói thực tế | 58/150 (39%) | 16/147 (11%) | 5/298 (2%) | 5/598 (1%) | 1/1298 (0%) | 0/2500 (0%) | dạy 74 · gặp 135 / 297 (25%) | 74 dạy · 135 gặp / 297 | 11 |
| HSK 3 · Nghe nói thực tế | – | – | 24/298 (8%) | 18/598 (3%) | 10/1298 (1%) | 4/2500 (0%) | dạy 70 · gặp 453 / 1193 (6%) | 42 dạy · 234 gặp / 896 | 14 |
| HSK 5 · Nghe nói thực tế | – | – | – | – | 29/1298 (2%) | 20/2500 (1%) | dạy 72 · gặp 786 / 4991 (1%) | 49 dạy · 288 gặp / 3798 | 0 |
| 30 bài giao tiếp · Tập 1 | 36/150 (24%) | 19/147 (13%) | 7/298 (2%) | 3/598 (1%) | 0/1298 (0%) | 0/2500 (0%) | dạy 55 · gặp 146 / 297 (19%) | 55 dạy · 146 gặp / 297 | 10 |
| 30 bài giao tiếp · Tập 2 | – | – | 11/298 (4%) | 22/598 (4%) | 8/1298 (1%) | 1/2500 (0%) | dạy 40 · gặp 231 / 1193 (3%) | 33 dạy · 98 gặp / 896 | 9 |
| 30 bài giao tiếp · Tập 3 | – | – | – | – | 24/1298 (2%) | 13/2500 (1%) | dạy 63 · gặp 396 / 4991 (1%) | 37 dạy · 112 gặp / 3798 | 0 |

Mẫu số theo từng mức: mức 1 = 150 từ mới (tổng 150); mức 2 = 147 từ mới (tổng 297); mức 3 = 298 từ mới (tổng 595); mức 4 = 598 từ mới (tổng 1193); mức 5 = 1298 từ mới (tổng 2491); mức 6 = 2500 từ mới (tổng 4991).

## Từ vựng theo HSK 3.0 (2021)

| Lộ trình | Mức 1 | Mức 2 | Mức 3 | Mức 4 | Mức 5 | Mức 6 | Lũy kế tới băng | Trong băng | Ngoài băng |
|---|---|---|---|---|---|---|---|---|---|
| Nhập môn Pinyin | 36/506 (7%) | 6/750 (1%) | 2/953 (0%) | 2/972 (0%) | 1/1059 (0%) | 0/1123 (0%) | dạy 42 · gặp 219 / 1256 (3%) | 42 dạy · 219 gặp / 1256 | 5 |
| HSK 1 · Nghe nói thực tế | 79/506 (16%) | 6/750 (1%) | 3/953 (0%) | 3/972 (0%) | 0/1059 (0%) | 0/1123 (0%) | dạy 85 · gặp 230 / 1256 (7%) | 85 dạy · 230 gặp / 1256 | 6 |
| HSK 3 · Nghe nói thực tế | – | – | 9/953 (1%) | 19/972 (2%) | 5/1059 (0%) | 4/1123 (0%) | dạy 83 · gặp 763 / 3181 (3%) | 28 dạy · 210 gặp / 1925 | 9 |
| HSK 5 · Nghe nói thực tế | – | – | – | – | 13/1059 (1%) | 6/1123 (1%) | dạy 70 · gặp 1166 / 5363 (1%) | 19 dạy · 194 gặp / 2182 | 0 |
| 30 bài giao tiếp · Tập 1 | 60/506 (12%) | 4/750 (1%) | 2/953 (0%) | 4/972 (0%) | 0/1059 (0%) | 0/1123 (0%) | dạy 64 · gặp 242 / 1256 (5%) | 64 dạy · 242 gặp / 1256 | 6 |
| 30 bài giao tiếp · Tập 2 | – | – | 13/953 (1%) | 15/972 (2%) | 3/1059 (0%) | 6/1123 (1%) | dạy 51 · gặp 367 / 3181 (2%) | 28 dạy · 109 gặp / 1925 | 9 |
| 30 bài giao tiếp · Tập 3 | – | – | – | – | 10/1059 (1%) | 5/1123 (0%) | dạy 58 · gặp 596 / 5363 (1%) | 15 dạy · 87 gặp / 2182 | 0 |

Mẫu số theo từng mức: mức 1 = 506 từ mới (tổng 506); mức 2 = 750 từ mới (tổng 1256); mức 3 = 953 từ mới (tổng 2209); mức 4 = 972 từ mới (tổng 3181); mức 5 = 1059 từ mới (tổng 4240); mức 6 = 1123 từ mới (tổng 5363).

## Từ vựng theo HSK 3.0 bản sửa 2025

| Lộ trình | Mức 1 | Mức 2 | Mức 3 | Mức 4 | Mức 5 | Mức 6 | Lũy kế tới băng | Trong băng | Ngoài băng |
|---|---|---|---|---|---|---|---|---|---|
| Nhập môn Pinyin | 28/294 (10%) | 6/197 (3%) | 5/487 (1%) | 1/972 (0%) | 3/1547 (0%) | 0/1684 (0%) | dạy 34 · gặp 167 / 491 (7%) | 34 dạy · 167 gặp / 491 | 9 |
| HSK 1 · Nghe nói thực tế | 72/294 (24%) | 8/197 (4%) | 8/487 (2%) | 1/972 (0%) | 0/1547 (0%) | 1/1684 (0%) | dạy 80 · gặp 179 / 491 (16%) | 80 dạy · 179 gặp / 491 | 10 |
| HSK 3 · Nghe nói thực tế | – | – | 29/487 (6%) | 20/972 (2%) | 10/1547 (1%) | 1/1684 (0%) | dạy 80 · gặp 662 / 1950 (4%) | 49 dạy · 338 gặp / 1459 | 11 |
| HSK 5 · Nghe nói thực tế | – | – | – | – | 39/1547 (3%) | 12/1684 (1%) | dạy 75 · gặp 1147 / 5181 (1%) | 51 dạy · 419 gặp / 3231 | 0 |
| 30 bài giao tiếp · Tập 1 | 54/294 (18%) | 8/197 (4%) | 4/487 (1%) | 1/972 (0%) | 0/1547 (0%) | 0/1684 (0%) | dạy 62 · gặp 197 / 491 (13%) | 62 dạy · 197 gặp / 491 | 5 |
| 30 bài giao tiếp · Tập 2 | – | – | 13/487 (3%) | 28/972 (3%) | 8/1547 (1%) | 2/1684 (0%) | dạy 50 · gặp 326 / 1950 (3%) | 41 dạy · 142 gặp / 1459 | 10 |
| 30 bài giao tiếp · Tập 3 | – | – | – | – | 23/1547 (1%) | 12/1684 (1%) | dạy 66 · gặp 578 / 5181 (1%) | 35 dạy · 177 gặp / 3231 | 0 |

Mẫu số theo từng mức: mức 1 = 294 từ mới (tổng 294); mức 2 = 197 từ mới (tổng 491); mức 3 = 487 từ mới (tổng 978); mức 4 = 972 từ mới (tổng 1950); mức 5 = 1547 từ mới (tổng 3497); mức 6 = 1684 từ mới (tổng 5181).

## Ngữ pháp theo HSK 3.0 (mức 1–6)

Điểm ngữ pháp được tính là "dạy" khi một dấu hiệu hình thức của nó (hư từ hoặc khung câu trong bảng) xuất hiện trong `patterns[].pattern` của lộ trình; "gặp" khi dấu hiệu đó xuất hiện ở bất kỳ câu tiếng Trung nào. Ô là `dạy · gặp / số điểm`. Bảng nguồn trộn nhãn phân loại (主谓句, 用动态助词) với dấu hiệu thật, nên cột cuối chỉ đếm các điểm có dấu hiệu từ hai chữ và có mặt trong danh sách từ vựng HSK — phần mà phép so này đủ tin.

| Lộ trình | Mức 1 | Mức 2 | Mức 3 | Mức 4 | Mức 5 | Mức 6 | Lũy kế tới băng | Điểm có dấu hiệu đủ tin đã gặp |
|---|---|---|---|---|---|---|---|---|
| Nhập môn Pinyin | 2 · 8 / 48 | 0 · 19 / 82 | 0 · 16 / 81 | 0 · 6 / 76 | 0 · 6 / 71 | 0 · 6 / 67 | dạy 2 · gặp 27 / 130 (21%) | 19/40 · trong 130 điểm thì chỉ 40 là đủ tin để so |
| HSK 1 · Nghe nói thực tế | 6 · 12 / 48 | 4 · 11 / 82 | 9 · 12 / 81 | 2 · 6 / 76 | 3 · 5 / 71 | 1 · 5 / 67 | dạy 10 · gặp 23 / 130 (18%) | 14/40 · trong 130 điểm thì chỉ 40 là đủ tin để so |
| HSK 3 · Nghe nói thực tế | – | – | 6 · 32 / 81 | 1 · 17 / 76 | 4 · 14 / 71 | 2 · 19 / 67 | dạy 27 · gặp 100 / 287 (35%) | 64/102 · trong 287 điểm thì chỉ 102 là đủ tin để so |
| HSK 5 · Nghe nói thực tế | – | – | – | – | 2 · 15 / 71 | 6 · 18 / 67 | dạy 45 · gặp 140 / 425 (33%) | 90/154 · trong 425 điểm thì chỉ 154 là đủ tin để so |
| 30 bài giao tiếp · Tập 1 | 5 · 9 / 48 | 8 · 11 / 82 | 12 · 16 / 81 | 3 · 5 / 76 | 1 · 2 / 71 | 2 · 6 / 67 | dạy 13 · gặp 20 / 130 (15%) | 13/40 · trong 130 điểm thì chỉ 40 là đủ tin để so |
| 30 bài giao tiếp · Tập 2 | – | – | 2 · 12 / 81 | 3 · 8 / 76 | 1 · 2 / 71 | 2 · 8 / 67 | dạy 17 · gặp 49 / 287 (17%) | 26/102 · trong 287 điểm thì chỉ 102 là đủ tin để so |
| 30 bài giao tiếp · Tập 3 | – | – | – | – | 3 · 9 / 71 | 4 · 13 / 67 | dạy 29 · gặp 95 / 425 (22%) | 56/154 · trong 425 điểm thì chỉ 154 là đủ tin để so |

## Chỗ thiếu rõ nhất (theo HSK 2.0, mức thuộc băng của lộ trình)

Cột "chưa dạy" là số từ của mức đó không có trong `vocab`/chú giải. Cột "chưa thấy đâu" chỉ những từ thậm chí không xuất hiện lần nào trong phần tiếng Trung của lộ trình — đó là khoảng trống thật. Ví dụ lấy từ nhóm "chưa thấy đâu" rồi đến nhóm còn lại.

| Lộ trình | Mức | Chưa dạy | Trong đó chưa thấy đâu | Ví dụ từ còn thiếu |
|---|---|---|---|---|
| Nhập môn Pinyin | 1 | 126/150 | 55/150 | 北京 (Běi jīng), 本 (běn), 不客气 (bù kè qi), 菜 (cài), 出租车 (chū zū chē), 电脑 (diàn nǎo), 电视 (diàn shì), 电影 (diàn yǐng), 东西 (dōng xī), 读 (dòu), 对不起 (duì bu qǐ), 二 (èr) … |
| Nhập môn Pinyin | 2 | 140/147 | 111/147 | 百 (Bǎi), 帮助 (bāng zhù), 报纸 (bào zhǐ), 便宜 (biàn yí), 唱歌 (chàng gē), 出 (chū), 船 (chuán), 次 (cì), 从 (cóng), 错 (Cuò), 打篮球 (dǎ lán qiú), 大家 (dà jiā) … |
| HSK 1 · Nghe nói thực tế | 1 | 92/150 | 51/150 | 爱 (ài), 北京 (Běi jīng), 出租车 (chū zū chē), 打电话 (dǎ diàn huà), 电脑 (diàn nǎo), 电视 (diàn shì), 电影 (diàn yǐng), 都 (Dū), 对不起 (duì bu qǐ), 儿子 (ér zi), 饭馆 (fàn guǎn), 飞机 (fēi jī) … |
| HSK 1 · Nghe nói thực tế | 2 | 131/147 | 111/147 | 白 (Bái), 百 (Bǎi), 报纸 (bào zhǐ), 便宜 (biàn yí), 别 (Bié), 唱歌 (chàng gē), 出 (chū), 穿 (chuān), 船 (chuán), 从 (cóng), 错 (Cuò), 打篮球 (dǎ lán qiú) … |
| HSK 3 · Nghe nói thực tế | 3 | 274/298 | 170/298 | 阿姨 (ā yí), 矮 (ǎi), 办公室 (bàn gōng shì), 饱 (bǎo), 北方 (běi fāng), 鼻子 (bí zi), 比较 (bǐ jiào), 比赛 (bǐ sài), 必须 (bì xū), 变化 (biàn huà), 表示 (biǎo shì), 表演 (biǎo yǎn) … |
| HSK 3 · Nghe nói thực tế | 4 | 580/598 | 492/598 | 爱情 (ài qíng), 安全 (ān quán), 按照 (àn zhào), 暗 (àn), 保证 (bǎo zhèng), 报道 (bào dào), 报名 (bào míng), 倍 (bèi), 笨 (bèn), 笔记本 (bǐ jì běn), 毕业 (bì yè), 遍 (biàn) … |
| HSK 5 · Nghe nói thực tế | 5 | 1269/1298 | 1095/1298 | 唉 (āi), 爱护 (ài hù), 爱惜 (ài xī), 爱心 (ài xīn), 安慰 (ān wèi), 安装 (ān zhuāng), 岸 (àn), 把握 (bǎ wò), 摆 (bǎi), 班主任 (bān zhǔ rèn), 办理 (bàn lǐ), 傍晚 (bàng wǎn) … |
| HSK 5 · Nghe nói thực tế | 6 | 2480/2500 | 2415/2500 | 哎哟 (āi yō), 挨 (āi), 癌症 (ái zhèng), 爱不释手 (ài bù shì shǒu), 爱戴 (ài dài), 暧昧 (ài mèi), 安居乐业 (ān jū lè yè), 安宁 (Ān níng), 安详 (ān xiáng), 安置 (ān zhì), 按摩 (àn mó), 案件 (àn jiàn) … |
| 30 bài giao tiếp · Tập 1 | 1 | 114/150 | 53/150 | 杯子 (bēi zi), 北京 (Běi jīng), 不客气 (bù kè qi), 茶 (chá), 出租车 (chū zū chē), 打电话 (dǎ diàn huà), 电脑 (diàn nǎo), 电视 (diàn shì), 东西 (dōng xī), 读 (dòu), 对不起 (duì bu qǐ), 儿子 (ér zi) … |
| 30 bài giao tiếp · Tập 1 | 2 | 128/147 | 98/147 | 白 (Bái), 帮助 (bāng zhù), 报纸 (bào zhǐ), 比 (Bǐ), 别 (Bié), 出 (chū), 穿 (chuān), 船 (chuán), 次 (cì), 错 (Cuò), 打篮球 (dǎ lán qiú), 大家 (dà jiā) … |
| 30 bài giao tiếp · Tập 2 | 3 | 287/298 | 251/298 | 阿姨 (ā yí), 啊 (ā), 矮 (ǎi), 爱好 (ài hào), 安静 (ān jìng), 把 (bǎ), 办法 (bàn fǎ), 办公室 (bàn gōng shì), 帮忙 (bāng máng), 饱 (bǎo), 北方 (běi fāng), 被 (bèi) … |
| 30 bài giao tiếp · Tập 2 | 4 | 576/598 | 547/598 | 爱情 (ài qíng), 安全 (ān quán), 按照 (àn zhào), 暗 (àn), 保护 (bǎo hù), 保证 (bǎo zhèng), 报道 (bào dào), 报名 (bào míng), 倍 (bèi), 本来 (běn lái), 笨 (bèn), 笔记本 (bǐ jì běn) … |
| 30 bài giao tiếp · Tập 3 | 5 | 1274/1298 | 1217/1298 | 唉 (āi), 爱护 (ài hù), 爱惜 (ài xī), 爱心 (ài xīn), 安慰 (ān wèi), 安装 (ān zhuāng), 岸 (àn), 把握 (bǎ wò), 摆 (bǎi), 班主任 (bān zhǔ rèn), 办理 (bàn lǐ), 傍晚 (bàng wǎn) … |
| 30 bài giao tiếp · Tập 3 | 6 | 2487/2500 | 2469/2500 | 哎哟 (āi yō), 挨 (āi), 癌症 (ái zhèng), 爱不释手 (ài bù shì shǒu), 爱戴 (ài dài), 暧昧 (ài mèi), 安居乐业 (ān jū lè yè), 安宁 (Ān níng), 安详 (ān xiáng), 安置 (ān zhì), 按摩 (àn mó), 案件 (àn jiàn) … |

## Cả kho bài cộng lại

Một người học đi hết cả bảy lộ trình thì số từ *khác nhau* đã dạy theo từng mức là:

| Chuẩn | Mức 1 | Mức 2 | Mức 3 | Mức 4 | Mức 5 | Mức 6 | Lũy kế 1–6 |
|---|---|---|---|---|---|---|---|
| HSK 2.0 | 83/150 (55%) | 46/147 (31%) | 47/298 (16%) | 68/598 (11%) | 64/1298 (5%) | 32/2500 (1%) | 340/4991 (7%) |
| HSK 3.0 (2021) | 146/506 (29%) | 61/750 (8%) | 61/953 (6%) | 56/972 (6%) | 29/1059 (3%) | 16/1123 (1%) | 369/5363 (7%) |
| HSK 3.0 bản sửa 2025 | 123/294 (42%) | 25/197 (13%) | 56/487 (11%) | 75/972 (8%) | 70/1547 (5%) | 26/1684 (2%) | 375/5181 (7%) |

## Từ vượt băng mà bài vẫn dạy

| Lộ trình | Số từ vượt băng | Ví dụ |
|---|---|---|
| Nhập môn Pinyin | 5 | 绿 (lǜ, mức 3), 马 (Mǎ, mức 3), 米 (Mǐ, mức 3), 骂 (mà, mức 5), 诗 (Shī, mức 5) |
| HSK 1 · Nghe nói thực tế | 11 | 见面 (jiàn miàn, mức 3), 面条 (miàn tiáo, mức 3), 糖 (táng, mức 3), 碗 (wǎn, mức 3), 一共 (yī gòng, mức 3), 对 (duì, mức 4), 号码 (hào mǎ, mức 4), 辣 (là, mức 4), 往 (wǎng, mức 4), 中文 (Zhōng wén, mức 4) … |
| HSK 3 · Nghe nói thực tế | 14 | 保持 (bǎo chí, mức 5), 发票 (fā piào, mức 5), 付款 (fù kuǎn, mức 5), 合同 (hé tong, mức 5), 聚会 (jù huì, mức 5), 零钱 (líng qián, mức 5), 排队 (pái duì, mức 5), 位置 (wèi zhi, mức 5), 现金 (xiàn jīn, mức 5), 预订 (yù dìng, mức 5) … |
| HSK 5 · Nghe nói thực tế | 0 |  |
| 30 bài giao tiếp · Tập 1 | 10 | 爱好 (ài hào, mức 3), 担心 (dān xīn, mức 3), 分 (fēn, mức 3), 附近 (fù jìn, mức 3), 口 (kǒu, mức 3), 面条 (miàn tiáo, mức 3), 舒服 (shū fu, mức 3), 号码 (hào mǎ, mức 4), 辣 (là, mức 4), 试 (shì, mức 4) |
| 30 bài giao tiếp · Tập 2 | 9 | 登记 (dēng jì, mức 5), 过敏 (guò mǐn, mức 5), 合同 (hé tong, mức 5), 汇率 (huì lǜ, mức 5), 现金 (xiàn jīn, mức 5), 预订 (yù dìng, mức 5), 账户 (zhàng hù, mức 5), 招待 (zhāo dài, mức 5), 押金 (yā jīn, mức 6) |
| 30 bài giao tiếp · Tập 3 | 0 |  |

## Khung câu có dấu hiệu đủ tin mà lộ trình chưa dùng

Chỉ tính các điểm ngữ pháp từ mức 1 đến đỉnh băng của lộ trình mà bảng nguồn cho dấu hiệu từ hai chữ trở lên và dấu hiệu đó là một mục từ HSK, rồi liệt kê các điểm mà dấu hiệu ấy không xuất hiện ở bất kỳ câu tiếng Trung nào trong lộ trình. Đây là danh sách để bổ sung bài, không phải điểm trừ có tính chứng chỉ.

| Lộ trình | Số điểm | Ví dụ (cấp · nhóm · dấu hiệu) |
|---|---|---|
| Nhập môn Pinyin | 21/40 | mức 1 · 指示代词: 这儿、那儿、这里、那里、这些、那些; mức 1 · 时间副词: 马上、有时、正在; mức 1 · 进行态: 正在; mức 1 · 并列复句: 一边; mức 2 · 疑问代词: 多久; mức 2 · 指示代词: 那么、那样、这么、这样; mức 2 · 频率、重复副词: 重新、经常、老是; mức 2 · 方式副词: 故意; mức 2 · 情态副词: 必须、差不多、好像、也许; mức 2 · 能愿动词: 可能、可以; … |
| HSK 1 · Nghe nói thực tế | 26/40 | mức 1 · 指示代词: 这儿、那儿、这里、那里、这些、那些; mức 1 · 范围、协同副词: 一块儿、一起; mức 1 · 进行态: 正在; mức 1 · 并列复句: 一边; mức 2 · 疑问代词: 多久; mức 2 · 指示代词: 那么、那样、这么、这样; mức 2 · 程度副词: 多么、十分、特别; mức 2 · 时间副词: 刚刚、忽然、一直、已经; mức 2 · 频率、重复副词: 重新、经常、老是; mức 2 · 方式副词: 故意; … |
| HSK 3 · Nghe nói thực tế | 38/102 | mức 1 · 并列复句: 一边; mức 2 · 方式副词: 故意; mức 2 · 其他: 不一会儿; mức 2 · 其他: 越来越; mức 2 · 条件复句: 只要; mức 2 · “是……的”句: 地点、方式; mức 3 · 引出时间、处所: 自从; mức 3 · 程度副词: 比较、更加、相当; mức 3 · 范围、协同副词: 仅仅、至少; mức 3 · 方式副词: 互相、尽量、亲自、相互; … |
| HSK 5 · Nghe nói thực tế | 64/154 | mức 1 · 并列复句: 一边; mức 2 · 方式副词: 故意; mức 2 · 其他: 不一会儿; mức 2 · 其他: 越来越; mức 3 · 引出时间、处所: 自从; mức 3 · 情态副词: 恐怕; mức 3 · 其他: 看起来; mức 3 · 其他: 看上去; mức 3 · 其他: 有的是; mức 3 · 并列复句: 一会儿; … |
| 30 bài giao tiếp · Tập 1 | 27/40 | mức 1 · 频率、重复副词: 常常; mức 1 · 否定副词: 没有; mức 1 · 进行态: 正在; mức 1 · 并列复句: 一边; mức 1 · 比较句: 没有; mức 2 · 疑问代词: 多久; mức 2 · 指示代词: 那么、那样、这么、这样; mức 2 · 范围、协同副词: 一共; mức 2 · 频率、重复副词: 重新、经常、老是; mức 2 · 方式副词: 故意; … |
| 30 bài giao tiếp · Tập 2 | 76/102 | mức 1 · 进行态: 正在; mức 1 · 并列复句: 一边; mức 2 · 疑问代词: 多久; mức 2 · 指示代词: 那么、那样、这么、这样; mức 2 · 范围、协同副词: 一共; mức 2 · 时间副词: 刚刚、忽然、一直、已经; mức 2 · 方式副词: 故意; mức 2 · 情态副词: 必须、差不多、好像、也许; mức 2 · 语气副词: 正好; mức 2 · 能愿动词: 应该; … |
| 30 bài giao tiếp · Tập 3 | 98/154 | mức 1 · 范围、协同副词: 一块儿、一起; mức 1 · 并列复句: 一边; mức 2 · 疑问代词: 多久; mức 2 · 指示代词: 那么、那样、这么、这样; mức 2 · 方式副词: 故意; mức 2 · 能愿动词: 愿意; mức 2 · 其他助词: 的话; mức 2 · 其他: 不一会儿; mức 2 · 因果复句: 因为、所以; mức 2 · “是……的”句: 地点、方式; … |

## Giới hạn cần nói thẳng

- "Dạy" chỉ ghi nhận mặt chữ: một từ có thể nằm trong `vocab` nhưng bài không cho đủ ngữ cảnh để dùng được, và ngược lại một từ chỉ xuất hiện trong bản chép lời vẫn có giá trị tiếp xúc.
- Bảng mức của bên thứ ba không thống nhất tuyệt đối: HSK 2.0 trong nguồn này có 4.991 từ lũy kế thay vì 5.000 vì một số mục trùng/gộp; HSK 3.0 (2021) là 5.363 từ cho mức 1–6, bản 2025 là 5.181. Con số làm tròn hay gặp trên mạng (5.000 / 5.500) khác nhau ở phần gộp mức.
- Ngữ pháp chỉ đếm được theo dấu hiệu hình thức. Một điểm như câu chữ 把 có thể bài đã luyện mà không có mẫu câu nào nêu tên nó, nên cột "dạy" luôn thấp hơn thực tế; cột "gặp" thì ngược lại, dễ đánh giá ảo vì hư từ đơn xuất hiện ở khắp nơi. Hai cột kẹp giữa "chắc chắn có" và "chắc chắn không", không cột nào là điểm đạt. Bảng nguồn cũng gộp nhiều điểm trong một dòng (loại từ, lượng từ), nên số "425 điểm mức 1–6" không phải số bài ngữ pháp.
- Chưa đối chiếu chữ Hán (character list) và chưa đối chiếu độ khó câu/độ dài bản nghe. Muốn tuyên bố phủ chương trình thì cần người có chuyên môn duyệt từng mức.
- App không có lộ trình HSK 2, HSK 4, HSK 6; người học cấp đó phải tự ghép từ các băng hiện có.

Chạy lại: `node scripts/hsk-coverage.mjs` (cần `eval/hsk-standard.json`, tái tạo bằng `node scripts/build-hsk-standard.mjs <complete.min.json> <hsk30-grammar.csv>` với hai file nguồn MIT lấy từ GitHub).

Lấy danh sách đầy đủ các từ chưa từng xuất hiện trong một lộ trình: `node scripts/hsk-coverage.mjs --gaps <track> <mức> [old|new|newest]`, ví dụ `--gaps hsk1-practical 1`.
