# Nguồn soạn phần nghe

Mỗi file `misu30/<buổi>.json` là bản soạn tay phần nghe của một buổi trong
`lessons/courses/`: hội thoại 甲/乙 kèm bản dịch từng lượt, câu hỏi nghe hiểu,
câu chép chính tả và đoạn nói đuổi. File soạn **không chứa pinyin**; mọi pinyin,
id, biến điệu 3+3 và cụm hơi do script sinh, bằng đúng hàm mà checker dùng.

```sh
# Kiểm (không ghi) và in pinyin sinh ra để soát ghi chú phát âm
node scripts/build-course-listening.mjs lessons/authoring/misu30/*.json --check --print
# Dựng: ghi khối listening vào lessons/courses/<buổi>.json
#       và lessons/listening/course/<buổi>.json (id cũ được giữ nguyên)
node scripts/build-course-listening.mjs lessons/authoring/misu30/*.json
node scripts/listening-checks/course-listening.check.mjs
```

`readings` khai báo cách đọc mong muốn của chữ đa âm; script báo khi pinyin-pro
đọc khác. Sửa nội dung nghe thì sửa ở đây rồi dựng lại, không sửa tay file đích.

Nội dung do AI soạn, chưa được giáo viên duyệt.
