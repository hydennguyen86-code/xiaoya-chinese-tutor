# Chính sách ghi thanh nhẹ và pinyin

- Ngày: 2026-10-25
- Trạng thái: **AI đề xuất, chưa có giáo viên duyệt**. Không có giáo viên/người bản ngữ duyệt.
- Nguồn máy đọc duy nhất: `server/coursePinyin.mjs` (đọc JSON chính sách trong repo) (sinh pinyin bằng `pinyin-pro`).
- Bản máy đọc: `neutral-tone-policy.json`. Script sinh: không đưa script tác giả vào repo; script kiểm: `server/courseDay2.test.mjs`.
- Phạm vi áp dụng: `course-day2/`, `course-fixes/`, `dictation.json`, `shadowing.json`.

## 1. Hai cách ghi, dùng đúng chỗ

| Cách ghi | Dùng ở đâu | Biến điệu 3+3 | 一 / 不 | Thanh nhẹ |
|---|---|---|---|---|
| **Trích dẫn** | từ vựng, câu ví dụ, mẫu câu, `listening.pinyin`, pinyin trong bản vá checkpoint | Không hạ; ghi thanh từ điển | Giữ dạng đọc bề mặt (`yì`, `bú`) | Bỏ dấu thanh |
| **Đọc thành tiếng** | `dictation.json`, `shadowing.json` | Hạ trong cùng cụm hơi; dấu câu chặn | Giữ dạng đọc bề mặt | Bỏ dấu thanh |

Lý do: người học cần nhìn được thanh gốc của từ (trích dẫn), nhưng khi nghe/chép chính tả thì cần dạng đọc thật. Trộn hai cách trong cùng một trường sẽ khiến người học không biết vì sao cùng một chữ lại ghi hai kiểu.

## 2. Danh sách từ đọc nhẹ (đóng cho học liệu hiện tại)

Chỉ bỏ dấu thanh ở đúng âm tiết liệt kê; không đổi chữ cái, không thêm số 5.

| Từ | Pinyin | Vị trí nhẹ |
|---|---|---|
| 谢谢 | xiè xie | âm tiết 2 |
| 朋友 | péng you | âm tiết 2 |
| 名字 | míng zi | âm tiết 2 |
| 学生 | xué sheng | âm tiết 2 |
| 晚上 | wǎn shang | âm tiết 2 |
| 什么 | shén me | âm tiết 2 |
| 喜欢 | xǐ huan | âm tiết 2 |
| 弟弟 | dì di | âm tiết 2 |
| 妹妹 | mèi mei | âm tiết 2 |
| 杯子 | bēi zi | âm tiết 2 |
| 认识 | rèn shi | âm tiết 2 |
| 意思 | yì si | âm tiết 2 |
| 先生 | xiān sheng | âm tiết 2 |
| 小姐 | xiǎo jie | âm tiết 2 |
| 舒服 | shū fu | âm tiết 2 |
| 客气 | kè qi | âm tiết 2 |
| 左边 | zuǒ bian | âm tiết 2 |
| 右边 | yòu bian | âm tiết 2 |
| 早上 | zǎo shang | âm tiết 2 |
| 麻烦 | má fan | âm tiết 2 |
| 清楚 | qīng chu | âm tiết 2 |
| 关系 | guān xi | âm tiết 2 |

Ba từ 麻烦、清楚、关系 thêm vào 2026-10-28 vì đều là **必读轻声** trong chuẩn khảo thí Phổ thông thoại (PSC): từ điển ghi nhẹ và không có cách đọc thanh đầy đủ nào là chuẩn.

Hư từ đứng sau một âm tiết Hán luôn đọc nhẹ: 们、么、吧、吗、呢、啊、呀、哦、嘛.

的、了、子 **không** đọc nhẹ theo luật chung, vì chúng còn là hình vị mang thanh: 目的 mù dì, 的确 dí què, 了解 liǎo jiě, 电子 diàn zǐ, 王子 wáng zǐ, 女子 nǚ zǐ. Với 的 và 了, dùng cách đọc theo ngữ cảnh của `pinyin-pro` (我的 wǒ de, 吃了 chī le). Với 子, chỉ đọc nhẹ khi từ nằm trong danh sách từ cụ thể ở trên hoặc `pinyin-pro` đã trả về zi (孩子, 桌子…); các danh từ thường ngày mà `pinyin-pro` đọc nhầm thành zǐ (鞋子, 饺子, 例子…) đã được thêm vào danh sách.

Danh sách này là **nguồn duy nhất** trong `server/coursePinyin.mjs` (đọc JSON chính sách trong repo); các validator của học liệu đều import từ đó.

## 3. Biến điệu 3+3

| Chữ | Dạng trích dẫn | Dạng đọc thành tiếng |
|---|---|---|
| 你好 | nǐ hǎo | ní hǎo |
| 只好 | zhǐ hǎo | zhí hǎo |

- Trong từ vựng/câu ví dụ/checkpoint: ghi dạng trích dẫn. Nếu bài dạy cần nói cách đọc thật, ghi chú riêng (ví dụ bài 1: 你好 thường đọc `ní hǎo`).
- Trong dictation/shadowing: ghi dạng đọc thành tiếng, kèm `sandhi: true`, `baseTones` và `acceptTones` để app chấp nhận cả hai cách đọc.

## 4. 一 và 不

Giữ dạng đọc bề mặt do `pinyin-pro` trả về: `一杯` → `yì bēi`, `不是` → `bú shì`. Không tự đổi về `yī`/`bù` trong pinyin nội dung; nếu cần dạy thanh gốc, ghi trong `learningNotes` hoặc `focus`.

## 5. Từ 可轻读 — đã chốt 2026-10-28: giữ thanh đầy đủ

Các từ sau từ điển cho phép đọc nhẹ âm tiết 2 nhưng chuẩn PSC xếp vào nhóm **可轻读** (không bắt buộc nhẹ, khác với 必读轻声 ở §2). Quyết định: **giữ thanh đầy đủ** trong học liệu:

| Từ | Đang ghi | Ghi chú |
|---|---|---|
| 哪里 | nǎ lǐ | 可轻读; giữ thanh đầy đủ. |
| 多少 | duō shǎo | 可轻读; giữ thanh đầy đủ. |
| 这里 | zhè lǐ | 可轻读; giữ thanh đầy đủ. |
| 那里 | nà lǐ | 可轻读; giữ thanh đầy đủ. |
| 哪儿 | nǎr | Đã gộp erhua (xem §6); thanh nhẹ không còn áp dụng. |

Nếu sau này có giáo viên chốt đổi, phải chạy lại toàn bộ generator và kiểm tra lại, không sửa lẻ từng file.

## 6. 儿 hoá (erhua) — đã chốt 2026-10-28

Với 6 từ `点儿 这儿 哪儿 那儿 会儿 事儿`, 儿 nói thêm -r vào âm tiết trước, gộp thành **một** âm tiết: `nǎr`, `zhèr`, `diǎnr`, `huìr`, `shìr`. Áp dụng đồng bộ ở cả ba tầng để hiển thị, mảng thanh và bộ chấm không bao giờ lệch nhau:

- `pinyinCitation` (hiển thị): `哪儿` → `nǎr`, `一点儿` → `yì diǎnr` — không còn `nǎ ér` hai âm tiết.
- `readSentence` (dictation/shadowing): cắt lát `parts`/`tones`/`dict`/`baseTones` đã gộp; `syllables` đếm bằng `syllableCount()`.
- `expectedTones` trong `server/tones.mjs` (bộ chấm): trả âm tiết gộp `{ char: '哪儿', pinyin: 'nǎr', expected: 3 }` để `segment()` chia đúng 1 đoạn.

Quy tắc ngoại lệ: `儿子 女儿 儿科 三个儿子` giữ 儿 đứng riêng (từ riêng, không phải erhua). 儿 trong các từ gộp luôn thanh 2, không bao giờ bị hạ 3+3 hay đọc nhẹ, nên gộp sau khi tính thanh là an toàn. Nội dung bài học đã chạy lại bằng công cụ regen; ghi chú `focus` dạy cách đọc đã sửa theo dạng dính (ví dụ "有点儿 yóu diǎnr: 儿 hoá thành r dính vào diǎn, đọc một âm tiết diǎnr").

## 7. Bản vá checkpoint HSK1

Hai bản vá chỉ **thêm** trường, không sửa trường gốc, giữ `official: false`:

| Bản vá | Đoạn nghe | Nhiệm vụ nói | Mục chú giải |
|---|---|---|---|
| `hsk1-practical-6-d2.patch.json` | 2 | 2 | 6 |
| `hsk1-practical-12-d2.patch.json` | 2 | 2 | 9 |

Mỗi bản vá thêm:
- `checkpoint.listening[i].pinyin` cho từng đoạn;
- `checkpoint.speaking[i].pinyin` cho câu mẫu của từng nhiệm vụ;
- `checkpoint.glossary`: từ khóa kèm pinyin và nghĩa tiếng Việt; 旁边/一共 có ghi chú vì chưa xuất hiện trong vocab bài 1–11.

Cách áp dụng: mở bản sao của file đích, thêm đúng các trường theo `ops`; **không** sửa repo `xiaoya-chinese-tutor` gốc. Các bản vá là đề xuất của AI, chưa được duyệt.

## 8. Bảng khoá cách đọc đa âm (POLYPHONE_LOCKS)

`pinyin-pro` tự đoán cách đọc theo ngữ cảnh và thỉnh thoảng đọc sai một từ mà chính nó tra đúng khi để từ đó đứng một mình (银行人 → `yín xíng rén`, 别着急 → `zhe jí`). Repo khoá sẵn các chuỗi hay gặp trong học liệu:

| Chuỗi | Cách đọc khoá | Lý do |
|---|---|---|
| 银行 | yín háng | 行 ở đây không phải `xíng` |
| 着急 | zháo jí | 着 đọc `zháo`, không phải `zhe` |
| 钥匙 | yào shi | âm tiết 2 đọc nhẹ |
| 便宜 | pián yi | 便 đọc `pián`, 宜 đọc nhẹ |
| 还是 | hái shì | 还 đọc `hái` (từ để hỏi), không phải `huán` |
| 写得 / 说得 / 跑得 / 冷得 / 好得 / 用得 / 坐得 / 担得 / 睡得 / 练得 / 背得 / 行得 / 多得 | V + de | 得 làm bổ ngữ tố đứng sau động từ/tính từ đọc nhẹ; `pinyin-pro` ghi `dé` |
| 我得加班, 就得用, 还得看, ，得改, ，得早 | děi | 得 = "phải" là `děi`. Khoá cả chữ đứng sau vì `我得` một mình sẽ bắt nhầm `我得到` (dé), `得早` sẽ bắt nhầm `觉得早上` |
| 不便(宜) | bù pián yi | 不 chỉ hoá `bú` trước thanh 4; `pinyin-pro` nhầm trước 便宜 (thanh 2) |
| 一起 | yì qǐ | Mất biến điệu sau một số ngữ cảnh (周六一起看 → `yī qǐ`) |
| 有空 | yǒu kòng | 空 nghĩa "rảnh" đọc `kòng` thanh 4; `pinyin-pro` ghi `kōng` thanh 1 |
| 空着 | kòng zhe | 空 nghĩa "còn trống" đọc `kòng`; `pinyin-pro` ghi `kōng` |
| 只送 / 只看 / 只统计 / 只访问 | zhǐ + V | 只 = "chỉ" đọc `zhǐ`; `pinyin-pro` ghi `zhī` trước một số động từ |
| 一千 | yì qiān | 一 biến điệu thành `yì` trước thanh 1; `pinyin-pro` trả `yī` khi 一千八百 đứng trong câu dài |
| 时候还。 | huán | 还 cuối câu sau 时候 = "trả lại" đọc `huán`; `pinyin-pro` ghi `hái`. Kèm dấu câu để không bắt nhầm 的时候还没… (hái) |

Lưu ý: trong kiểu câu A不A (是不是, 好不好, 能不能, 贵不贵) `pinyin-pro` đã ghi 不 nhẹ (`bu`) — đó là cách đọc đúng, không khoá thêm. 一 trong 十一点、星期一、一号线、二加一、走一走 giữ `yī`/`yi` đúng, không phải lỗi. `pinyin-pro` cũng đọc đúng 没空 (`méi kòng`), 空白 (`kòng bái`) — không cần khoá; 空调/空气/航空 (`kōng` thanh 1) là nghĩa khác của 空.

Bảng nằm trong `src/lib/coursePinyin.mjs` và được áp cho **cả** `pinyinCitation` (chữ hiển thị, chép chính tả, validator) lẫn `readSentence` (bộ chấm thanh), nên không thể xảy ra chuyện màn hình hiện một cách đọc còn máy chấm dùng cách khác. Test: `server/coursePinyin.test.mjs`.

Thêm từ vào bảng khi: (a) từ đó xuất hiện trong học liệu, (b) `pinyin-pro` trả sai trong ít nhất một ngữ cảnh đã kiểm, và (c) cách đọc khoá là cách đọc đúng ở **mọi** ngữ cảnh trong repo (không dùng cho chữ có hai cách đọc đều hợp lệ). Sau khi thêm, sinh lại mọi trường pinyin từ đúng chữ Hán nguồn của nó (không sửa lẻ từng file), rồi chạy `npm test` và `node scripts/check-course-day2.mjs`.

## 9. Kiểm tra

Các bản vá được soạn và kiểm tra ngoài repo (thư mục nội dung riêng của người soạn). Trong repo, kiểm tra học liệu sau khi áp dụng bằng:

```sh
npm test
node scripts/check-course-day2.mjs
```
