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

## 5. Chưa chốt (cần giáo viên quyết)

Các từ sau cũng thường được từ điển ghi nhẹ, nhưng **chưa** đưa vào danh sách áp dụng:

| Từ | Đang ghi | Ghi chú |
|---|---|---|
| 哪里 | nǎ lǐ | Từ điển thường ghi âm tiết 2 nhẹ; chưa đưa vào danh sách áp dụng vì ngoài phạm vi 5 cảnh báo 3.3, cần giáo viên chốt. |
| 多少 | duō shǎo | Từ điển thường ghi âm tiết 2 nhẹ; chưa đưa vào danh sách áp dụng vì ngoài phạm vi 5 cảnh báo 3.3, cần giáo viên chốt. |
| 这里 | zhè lǐ | Từ điển thường ghi âm tiết 2 nhẹ; chưa đưa vào danh sách áp dụng vì ngoài phạm vi 5 cảnh báo 3.3, cần giáo viên chốt. |
| 那里 | nà lǐ | Từ điển thường ghi âm tiết 2 nhẹ; chưa đưa vào danh sách áp dụng vì ngoài phạm vi 5 cảnh báo 3.3, cần giáo viên chốt. |
| 哪儿 | nǎ ér | Từ điển thường ghi âm tiết 2 nhẹ; chưa đưa vào danh sách áp dụng vì ngoài phạm vi 5 cảnh báo 3.3, cần giáo viên chốt. |

Nếu chốt đưa các từ này vào, phải chạy lại toàn bộ generator và kiểm tra lại, không sửa lẻ từng file.

## 6. Bản vá checkpoint HSK1

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

## 7. Kiểm tra

```sh
cd /Users/admin/Documents/AI-Chinese-Teacher/content-for-misu
ELECTRON_RUN_AS_NODE=1 /Applications/Qoder.app/Contents/MacOS/Qoder _make-fixes.mjs
ELECTRON_RUN_AS_NODE=1 /Applications/Qoder.app/Contents/MacOS/Qoder course-fixes.check.mjs
```
