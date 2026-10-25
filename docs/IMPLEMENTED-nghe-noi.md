# Kết quả triển khai nghe – nói

## Mục 4 — Nhiều tốc độ và nghe trước khi xem chữ

- Ba tốc độ 0.7 / 0.85 / 1.0, lưu lựa chọn dùng chung. Nút nghe chậm dùng riêng 0.7×, không đổi lựa chọn mặc định.
- Truyền tốc độ đến Edge, macOS say và speechSynthesis; cache phân biệt tốc độ. Giọng clone chưa hỗ trợ tốc độ được chuyển sang Edge khi nghe chậm, có lý do trả về rõ ràng.
- Bổ sung nghe chậm cho lời thoại, mẫu câu, ví dụ và các phần luyện nghe/nói. Nút trong bài nghe giữ giới hạn lượt nghe.
- Nhập vai mặc định giấu lời trợ lý và bản dịch, có nút hiện chữ và tùy chọn tắt; câu của người học vẫn hiện.
- Kiểm chứng bằng dữ liệu tạm và avatar mẫu: typecheck, 67 test backend/lib + 4 test component, build và kiểm tra allowlist dist đều đạt.
- Thử Edge thật với câu tự soạn “你好，今天我们一起练习中文。”: 0.7× = 4824 ms; 0.85× = 3960 ms; 1× = 3384 ms. Không lưu âm thanh vào repo.
- Trình duyệt: xác nhận lời nhập vai ban đầu bị giấu và bấm mở hiển thị cả chữ Hán lẫn nghĩa. Chưa thử Windows thật, chưa đo trải nghiệm người học; kiểm thử say và giọng trình duyệt thật ở từng tốc độ chưa hoàn tất.

## Mục 5 — Phần mềm sẵn sàng; còn chờ bộ giọng thật

- Bộ nhập `npm run corpus:import`: đọc streaming `validated.tsv`, chọn câu ngắn zh-CN đã được cộng đồng bỏ phiếu, giữ version/URL/CC0, bỏ trường định danh người nói. Không tự gán HSK hay nhãn duyệt.
- Âm thanh ở `XIAOYA_DATA_DIR/listening-corpus`, Git ignore cả khi đổi folder dữ liệu. API danh sách và audio đi qua bảo vệ LAN; chỉ phục vụ ID trong manifest, từ chối symlink/path traversal, không đưa vào dist.
- Trong bài nghe có mục giọng cộng đồng: tải audio khi bấm, tốc độ theo mục 4, nghe chậm, nghe chép chữ Hán hoặc pinyin cách âm tiết, so khác biệt bằng edit distance. Khi chưa nhập có hướng dẫn rõ ràng, không thay giọng máy rồi gọi là giọng người thật.
- Hướng dẫn tải chính thức: `docs/COMMON-VOICE.md`; NOTICE bổ sung nguồn và giấy phép. Người dùng cần tự đăng nhập/xem điều khoản Mozilla Data Collective. Không tải từ mirror không rõ nguồn, không đưa API key vào chat.
- Kiểm chứng: 69 test backend/lib + 4 component, typecheck, build/dist đạt; fixture giả chỉ kiểm tra nhập/lọc/API/alignment, không phải giọng người thật.
- **Chưa hoàn tất kiểm chứng mục 5**: chưa được cung cấp đường dẫn Common Voice tải hợp lệ; chưa phát mp3 Common Voice thật, chưa kiểm tra nhiều người nói và độ phù hợp nội dung. Chờ người dùng cung cấp thư mục zh-CN có `validated.tsv`/`clips` cùng version/URL để thử trong dữ liệu tạm. Mục 6–12 chưa thực hiện trong đợt này, để giữ thứ tự sau khi xác nhận bước 5. Mục 12 cần người học và người gắn nhãn thật; không được thay bằng fixture.


## Mục 5 — Cập nhật theo bộ Beijing Chinese người dùng cung cấp

Phần này thay thế cách sao chép audio và trạng thái chờ dữ liệu của bản trước.

- App chỉ đọc nguồn ngoài repo do `XIAOYA_COMMON_VOICE_DIR` cấu hình; catalog schema 2 không chứa audio/đường dẫn tuyệt đối. Không đọc manifest cũ đã copy audio; không xóa dữ liệu cũ.
- Hỗ trợ train/dev/test.tsv, locale tùy chọn; không sửa nguồn. Không tự đoán URL hay xác nhận lại điều khoản: ghi nhận version/CC0/không chia sẻ lại theo người dùng.
- API Common Voice chỉ cho loopback, chặn client LAN kể cả đã đăng nhập. Chỉ ID thuộc catalog cùng nguồn, từ chối symlink, sai nguồn và tên file bất hợp lệ.
- Lọc câu ngắn/đời thường, loại mẫu bách khoa và chữ ngoài vốn từ bài HSK1/HSK5 của app + từ thông dụng; không gắn nhãn trình độ HSK chính thức. Quét đủ 2.860 dòng: chọn 17, loại 2.843 do nội dung/độ khó. Bộ lọc bảo thủ; chưa là duyệt sư phạm và có thể bỏ sót câu tốt.
- Thử thực trên thư mục người dùng, dữ liệu app ở /tmp, avatar mẫu: 17/17 MP3 giải mã sang null bằng ffmpeg; không ghi audio vào data tạm hoặc repo. Test gồm split/dedup/filter/no-copy/source-binding/symlink/API/LAN.
- Chưa thử Windows thật, chưa được giáo viên duyệt câu và chưa đo hiệu quả với người học. Không thay ngưỡng chấm hay cách cắt âm tiết.

- Kiểm tra cuối: typecheck, 71 test backend/lib + 4 component (75 tổng), build và allowlist dist đều đạt. API trả đúng byte gốc cho 17/17 clip, không lộ tên file nguồn trong danh sách công khai. Trình duyệt phát hết một MP3 thật ở 0.7× (readyState 4, không lỗi), gõ pinyin và mở đối chiếu đúng. Chưa nghe/đánh giá thủ công toàn bộ 17 câu.

## Mục 1 — Luyện tai thanh điệu

- Chép duy nhất JSON thanh điệu và checker cấu trúc (không có script tác giả). 154 mục, giữ nhãn AI soạn, chưa duyệt; checker pinyin/biến điệu của DeepSeek chạy như test trong repo. Bốn mục uncertain được loại khỏi bài chấm, không tự sửa nội dung.
- Nghe rồi chọn thanh, gồm âm tiết/từ đôi; khóa trả lời đến lúc audio bắt đầu. Chấp nhận đúng các acceptTones đã khai báo; baseTone/baseTones giữ làm lời giải, không ghi đè biến điệu bằng pinyin tự suy.
- Ma trận nhầm thanh theo người học nhận cả lỗi nghe và các báo cáo nói có kết quả chấm rõ. Chọn có trọng số ưu tiên nhầm lẫn, vẫn có phần khám phá và tránh lặp câu ngay trước. Không tính chữ chưa chấm được thành lỗi.
- Typecheck, test và build được chạy trước commit. Chưa thu âm người thật hoặc xác nhận TTS đọc đúng từng câu; thuật toán chấm thanh không đổi. Không gắn nhãn giáo viên duyệt.

## Mục 2 — Cặp âm dễ lẫn

- Chép JSON + checker DeepSeek, 12 nhóm âm, giữ nhãn AI soạn, chưa duyệt. Checker kiểm tra cả tính cặp tối thiểu và pinyin; các mục uncertain không đưa vào phần chấm.
- Nghe rồi chọn pinyin A/B, phát âm mẫu tổng hợp, có nghe chậm và giải thích khẩu hình sau trả lời. Không gọi STT để quyết định đáp án. Lịch sử nhầm theo người học được giữ riêng để ôn phát âm ở mục 7.
- Typecheck/test/build đạt trước commit; chưa được người dạy xác nhận độ chính xác từng giọng mẫu hoặc mẹo khẩu hình.

## Mục 3 — Nghe chép DeepSeek và câu buổi học

- 180 câu JSON DeepSeek, giữ nhãn AI soạn, chưa duyệt; checker kiểm tra cấu trúc/pinyin/biến điệu chạy trong test repo. Không chép script tác giả.
- Nghe cả câu hoặc từng cụm ngắt theo dấu câu, nhập chữ Hán hoặc pinyin cách âm tiết. Edit-distance tránh lỗi thiếu một chữ kéo sai cả phần sau. Hiện chữ/âm/nghĩa sau nộp. Nhập không dấu được chấp nhận; có dấu/số thanh thì kiểm tra các chuỗi acceptTones, giữ baseTones để giải thích.
- Có lựa chọn câu ví dụ của chính buổi học và câu mở đầu nhập vai. Cách đọc câu hiện có dùng metadata pinyin của bài, hoặc pinyin-pro cho câu mở đầu; không ghi đè pinyin DeepSeek.
- Typecheck/test/build trước commit; chưa được giáo viên duyệt hoặc kiểm tra từng câu TTS thật.

## Mục 8 — Shadowing DeepSeek

- Chép 60 đoạn JSON và checker, giữ nhãn AI soạn, chưa duyệt. Phát mẫu theo tốc độ chung 0.7/0.85/1×; hết tiếng mẫu mới mở thu tự động theo thao tác chủ động của người học. Có dừng, hủy khi rời màn hình; bản ghi chỉ ở bộ nhớ.
- Hiện đường cao độ sẵn có, độ dài và số chỗ ngắt nội bộ hơn một giây theo năng lượng. Giọng tham chiếu theo đúng tốc độ đã chọn; cache tách theo tốc độ. Không sửa ngưỡng thanh điệu hay cách cắt chữ, không dùng timestamp Whisper.
- Test timing dùng tín hiệu tổng hợp kiểm tra loại khoảng lặng đầu/cuối; checker nội dung chạy trong test repo. Chưa kiểm chứng với micro người thật hoặc so sánh chuyên gia, không gắn điểm/nhãn thành thạo.

## Mục 6 — Vòng sửa lỗi phát âm

- Từ chữ bị chấm sai trong bài từ vựng/kiểm tra có nút mở vòng chữ → từ → câu; nghe mẫu/chậm và nói lại. Mỗi bước chỉ chuyển sau hai lần rõ và khớp liên tiếp; sai xóa chuỗi, chưa chấm được không tăng lượt. Bản nhận dạng phải khớp mục tiêu; acceptTones DeepSeek được ưu tiên nếu có.
- Hủy ghi khi đóng vòng; audio chỉ ở bộ nhớ. Test state machine cho đủ ba bước, sai/unclear và chặn kết quả không có báo cáo.
- **Giới hạn còn lại**: bộ chấm hiện hữu chỉ chấm thanh cho 1–2 chữ. Bước câu dài vẫn cho nghe/thu nhưng không tự xác nhận qua vòng (hiện rõ lý do), để tránh giả điểm hoặc thay thuật toán/cách cắt khi chưa có bộ đo người thật. Chưa kiểm chứng bằng người học thật. Đây là phần chưa đạt toàn bộ tiêu chí mục 6, không gắn nhãn hoàn tất sư phạm.

## Mục 7 — Lịch ôn lỗi thanh/cặp âm

- LearningProfile schema 2, giữ khóa lưu cũ để chuyển đổi tại load; thêm pronunciation, giữ từ/lỗi/lịch cũ. Hồ sơ cũ không có phát âm bắt đầu danh sách rỗng. Lỗi nghe/nói đi qua sự kiện của đúng learner, cập nhật state hiện tại tránh ghi đè bằng snapshot cũ.
- Lỗi thanh và nhóm âm lưu mục ôn; khoảng ôn 5 phút/30 phút/6 giờ/1 ngày/3 ngày, ngắn hơn lịch từ vựng. Chưa chấm được không đổi lịch; sai quay về 5 phút.
- Phần Khởi động có Ôn phát âm: thanh được thu/chấm; cặp âm được nghe/chọn không phụ thuộc STT. Test chuyển đổi dữ liệu cũ, giữ từ, tách learner, lịch đúng/sai/unclear. Không tự coi lời tự đánh giá là đúng.
- Chưa đo mức nhớ dài hạn hoặc thử micro người thật; không thay ngưỡng phát âm.

## Mục 9 — Độ trôi chảy tham khảo

- API trả số chữ Hán Whisper nhận được / khoảng từ tiếng đầu đến tiếng cuối, số và độ dài khoảng ngắt nội bộ >1 giây theo năng lượng. Không có tiếng/chữ thì không tạo điểm 0 giả. Không dùng để quy đổi điểm thi, không sửa bộ chấm thanh.
- Lượt hội thoại/nhập vai dùng nhận dạng cục bộ được lưu số đo (không lưu audio/text) theo learner, tối đa 500 lượt. Bài đọc có mục tiêu không trộn vào lịch sử hội thoại. Lịch sử học và màn kiểm tra tuần/tháng hiển thị bảng theo tuần UTC, trung bình có trọng số thời lượng và thay đổi so với tuần có dữ liệu trước.
- Test tiếng tổng hợp/Chinese đếm chữ/nhóm tuần/trọng số/thiếu dữ liệu. Thêm hủy thu trước khi mở một lượt thu khác để tránh hai micro đồng thời. Chưa có người thật để xác nhận độ tin cậy hoặc hiệu quả học; ngắt có thể là lấy hơi/cố ý, số đo chỉ tham khảo.

## Mục 10 — Xem phát âm câu vừa nói

- Mic cục bộ chuyển cả kết quả và Blob cho App; gắn bản ghi với đúng ID lượt người học, tối đa 10 lượt trong RAM, không đưa vào ChatMessage/localStorage/server store. Đóng phiên/tải lại mất bản ghi, chat mới xóa map. Không có bản ghi thì không hiện nút chấm.
- Nút Xem phát âm câu này gửi Blob đã có đến API cục bộ, dùng đúng transcript Whisper đã nhận (không dùng đoạn gõ thêm). Hiện cao độ, replay chữ sẵn có và vòng sửa mục 6. Câu dài không tự gắn chữ sai; người học chọn chữ muốn luyện riêng. Quá giới hạn 120 ký tự thì không tự cắt mục tiêu làm lệch audio.
- Hủy fetch khi rời component; cảnh báo rõ transcript không phải bằng chứng câu người học định nói. Test giới hạn lưu RAM/không giả audio cho transcript trình duyệt. Chưa thử lượt nói người thật; giới hạn tự chấm câu dài ở mục 6 vẫn giữ.

## Mục 11 — Đo và giảm độ trễ

- Lượt nói cục bộ ghi mốc tiếng cuối ước lượng, dừng thu, bắt đầu/kết thúc STT; App ghi lúc yêu cầu model và hoàn thành câu đầu. Avatar nhận trace ID của đúng lượt, đo TTS và thời điểm lập lịch phát tiếng đầu; giọng trình duyệt dùng onstart. Chỉ lưu trace đầy đủ, đơn điệu, không suy ra số 0 khi thiếu mốc.
- Hồ sơ học hiện lần cuối/trung vị, tách chờ im lặng, nhận dạng, model, TTS, giải mã/phát. Giới hạn 100 lượt/learner, không lưu text/audio. Mốc TalkingHead/LAM là lịch phát ước lượng, chưa phải đo thiết bị âm thanh vật lý.
- Giữ cơ chế đọc câu đầu khi stream đã có; thêm warmup model cục bộ khi sẵn sàng, giới hạn 1 token và cache 10 phút, không gọi provider từ xa. Main chat cục bộ chốt sau khoảng 900 ms im lặng thay cho mặc định 1600 ms; bài dài/nhập vai giữ khoảng riêng để tránh cắt sớm câu đang luyện.
- Test trace thiếu/đảo mốc, phân rã thời gian và warmup local/cache/failure. Chưa đo end-to-end với người thật trên máy này; **chưa xác nhận mục tiêu 2,5 giây đạt**. Mô hình lớn, cold start và mạng TTS có thể làm chậm; không hứa số đo chưa có.
- Khi hủy thu, hủy cả fetch nhận dạng đang chờ; sửa hook phát mẫu để shadowing không chờ mãi nếu bấm dừng trước khi mở thu.

## Phần chờ

- Tại thời điểm kiểm tra chưa có `content-for-misu/cv-curated.json`; chưa thay bộ lọc Common Voice bằng danh sách DeepSeek và không tự bịa danh sách duyệt. Audio/đường dẫn tuyệt đối của nguồn người dùng không vào Git.
- Mục 12 cần ba người học + người gắn nhãn thật. Không có thu âm/nhãn người thật mới trong đợt này, không sửa ngưỡng thanh điệu hay bộ chia âm tiết.


## Mục 5 — Curated DeepSeek đã tới, thay bộ lọc 17 câu

- Sau khi kiểm tra lại nguồn, cv-curated.json đã có 154 mục. Chép JSON vào lessons/listening, giữ nhãn AI soạn, chưa duyệt; chỉ sentence_id/level/meaningVi/focus, không script tác giả, audio, đường dẫn tuyệt đối hay người nói.
- Checker DeepSeek sửa nguồn TSV thành biến môi trường, chạy trong repo trên thư mục thật và đạt. Kiểm tra cấu trúc metadata có trong npm test, không cần kho riêng để chạy CI.
- Bộ nhập nối sentence_id với TSV, không chạy lại bộ lọc 17 câu. Nối đủ 154/154, phân bậc AI 45/58/51; quét 2.860 dòng. Catalog schema 3 tham chiếu tại chỗ; thiếu câu/file hợp lệ thì giữ catalog cũ và báo lỗi. Giữ bảo vệ nguồn, symlink, LAN và không copy audio.
- UI chọn bậc, nghe/chậm/nghe chép; hiện nghĩa Việt và focus sau nộp. Mọi bậc đều ước lượng AI, không phải chứng nhận HSK hay duyệt giáo viên.

### Kiểm chứng cuối đợt

- 90 test (86 backend/lib + 4 component), typecheck và build/dist allowlist đều đạt trước commit curated. Không có ảnh/giọng người thật hoặc đường dẫn nguồn tuyệt đối trong nội dung/script đã chép.
- UI bằng hồ sơ thử: khóa lựa chọn thanh trước khi phát; trả lời sai tạo 1 mục ôn trong LearningProfile schema 2; nghe chép ni3 hao3 khớp acceptTones; Common Voice đổi bậc 45/58/51 câu, nghĩa/focus chỉ hiện sau nộp; shadowing hiển thị nhãn AI và cụm hơi. Không bấm thu micro người thật.
- Giải mã 154/154 MP3 trực tiếp từ nguồn sang null; dữ liệu app tạm có 0 MP3. Warmup Ollama thật trả 200, cached=true. Pipeline pronounce với một câu tự soạn bằng TTS 0.85× có hai đường 60 điểm và timing mẫu/người đọc; chỉ là kiểm thử giọng máy, không phải độ chính xác người thật.
- Chưa thử Windows thật; chưa kiểm chứng micro/căn ngắt/chấm thanh trên người Việt, vòng câu dài chưa thể tự qua, độ trễ dưới 2,5 giây chưa được xác nhận. Không push/tag.

### Vá sau kiểm tra giao diện

- Thống nhất khoảng cách/nút/select/input và trạng thái disabled cho các drill mới, tránh nút dính chữ trong giao diện thật.
- Cùng một Blob bản ghi xem phát âm nhiều lần chỉ ghi ma trận nhầm một lần cho mỗi learner (WeakMap, không tạo định danh/audio lưu bền). Có test chống tăng giả số lỗi khi bấm lại. Chuẩn hóa cờ sống của màn ôn khi effect được thiết lập lại.
- Bản vá cuối qua 91 test (87 backend/lib + 4 component), typecheck và build/dist. Giao diện shadowing đã mở lại từ bản build mới để kiểm tra bố cục; chưa thu micro người thật.

## 2026-10-25 — Nhãn sửa kết quả chấm thanh

- Nút “Misu chấm sai?” ở kết quả từ/câu, shadowing, vòng sửa và ôn phát âm. Người nghe chọn từng thanh độc lập, không điền sẵn theo máy; ghi tên và vai trò tự nghe/chuyên môn. 0 không rõ, 5 thanh nhẹ; không tự coi vai trò chuyên môn là giáo viên đã duyệt.
- Chỉ lưu khi có bản thu còn trong bộ nhớ, vào eval-recordings/<hồ sơ>/feedback trong XIAOYA_DATA_DIR; nhãn người tách khỏi expected/heard của máy. Không sửa bộ chấm, không đưa audio vào repo. Mẫu phản hồi không tự tính là đủ bộ đo 56 mục.
- Cài đặt đọc số mục 56 đã gắn nhãn và mẫu phản hồi của từng hồ sơ. Test dữ liệu tổng hợp kiểm tra nhãn khác máy, cách ly hồ sơ, lỗi đường dẫn/nhãn, file âm chỉ ở thư mục tạm. Chưa thử bằng giọng người thật hoặc trên Windows.

## 2026-10-25 — Nhập bản thu cắt sẵn và điều kiện chỉnh ngưỡng

- eval/tones.mjs nhận cả --recordings=<thư mục> và --recordings <thư mục>, đọc manifest v1/.audio tại chỗ; hỗ trợ labels.*.json v1 có labels/items/recordings dạng mảng hoặc map id. Nhãn cần tones, source=self/expert và reviewedBy ở từng dòng hoặc cấp đầu. Không đọc app-scores/expected làm nhãn người. Xung đột nhãn phải chọn --labels=<tên file> cụ thể. Chặn filename/symlink ra ngoài.
- Không có sidecar thực tế để đối chiếu schema Qoder tại thời điểm chạy; các dạng trên có test tổng hợp, cần kiểm tra lại khi Qoder xuất file. Nhãn 0 không rõ/5 thanh nhẹ thống kê riêng, chỉ đo thanh 1–4. Nếu có sentence-* dùng chúng học dải giọng; nếu không, báo rõ học từ chính tập đo, không phải held-out.
- Lần chạy đọc bản thu hiện có: **0 mục gắn nhãn người**, kết quả tổng hợp lưu eval/results/, không chứa tên người, đường dẫn hay audio. Không suy ra nhãn từ thanh mong đợi hoặc điểm máy.
- **Bỏ qua chỉnh classifyIsolated**: chưa có người nào gắn nhãn đủ 56 mục. Không có kết quả trước/sau hay tuyên bố cải thiện; giữ nguyên ngưỡng và số liệu TTS cũ.

## 2026-10-25 — 30 bài giao tiếp HSK1–6

- Chuyển đủ volume-1..3 của bộ curriculum người dùng chỉ định thành 30 buổi đóng gói, giữ số bài 1–30 và toàn bộ 8 từ/3 mẫu câu, nhập vai/nói tự do mỗi bài. Ghi nguồn tương đối + SHA-256, không ghi đường dẫn tuyệt đối; nhãn AI soạn, chưa duyệt. Mức HSK chỉ là định hướng chủ đề, chưa đối chiếu đầy đủ từ vựng/đề thi.
- Ba tập cùng track, nối 10→11 và 20→21 bằng liên kết rõ; kết thúc bài 30, không tự nhảy sang khóa khác. Giữ nguyên hai khóa thực tế 48 buổi và dữ liệu tiến độ cũ. Chọn tập trung cấp dùng đúng mức HSK3–4 trong hội thoại.
- Thêm bài nghe nhận nghĩa từ ba câu ví dụ gốc và hai lượt nói (nhắc lại/ứng dụng câu hỏi tự do), đáp án nghe cân bằng vị trí. Không tạo audio hay chép sách. Đây là bài nhận nghĩa ngắn, chưa phải đề luyện thi nghe dài.
- Script import có kiểm tra toàn bộ trước khi ghi; cả 30 bài qua normalizeLesson và loader không cần model. Test vẫn kiểm tra riêng 48 buổi cũ, bổ sung 30 bài mới, đáp án/nhãn/chuyển tập. Chưa được giáo viên hoặc người học thẩm định sư phạm.

## Review mức thấp — A7–A9 (sau misu30)

- A7: ruleCorrections chọn hit dài hơn khi khoảng ký tự chồng nhau, trả theo thứ tự câu; merge lọc trùng cả rule–rule và rule–model. Giữ nguyên các sửa A1–A6 của Claude (335717c/910b17a).
- A8: mỗi request transcribe/pronounce giải mã compressed audio một lần thành PCM 16 kHz; dùng lại cho cao độ/năng lượng và đóng gói WAV cho Whisper. Không cache giọng người ra đĩa; không đổi ngưỡng chấm thanh. Whisper vẫn đọc WAV đầu vào, chưa benchmark CPU máy yếu.
- A9: trả fluencyReason rõ khi STT chưa sẵn sàng/lỗi/chưa có lời; kết quả thanh hiển thị lý do. Không ghi lịch sử fluency rỗng. Test WAV từ PCM, chồng gợi ý, API fluency và audio lỗi (D3).

## Review mức thấp — C1–C11

- C1/C2: yêu cầu phát mới khi đang tải chỉ báo thất bại cho lượt mới; callback từng lượt chạy một lần. Thu hồi object URL khi xong/lỗi/abort/unmount; callback cũ không kết thúc lượt mới.
- C3/C4: bỏ nhánh checker rỗng, nextTone trả null khi hết câu hợp lệ.
- C5/C6: bỏ lịch phát âm rỗng/thiếu hạn, khử trùng id; ôn id không tồn tại không đổi updatedAt. Test dữ liệu hỏng.
- C7: nhóm tuần theo giờ địa phương và nhãn “giờ máy”, test ca UTC còn Chủ nhật nhưng Việt Nam đã thứ Hai; từ chối lưu fluency rỗng.
- C8: (đã vào commit A7–A9) lượt thu mới báo micro đang bận, không âm thầm hủy lượt của component khác. C9 dùng prop localStt thật.
- C10: client/server dùng chung module citation pinyin và chính sách Claude đã sửa, không sinh lại âm theo mặc định khác. C11 mẹo Hán Việt khớp đúng từ, không tự gắn chữ đơn vào từ dài.
- Chưa thử lifecycle abort audio/micro bằng thiết bị thật; build và regression dữ liệu không thay thế kiểm thử phần cứng.

## HANDOFF Qoder — xử lý tại app

- Tìm thấy HANDOFF ở gốc repo nguồn (không ở content-for-misu như đường dẫn ban đầu). Không sửa tài liệu ở repo nguồn; trạng thái thực hiện ghi tại đây theo yêu cầu người dùng.
- P0.1/P1.1–P1.5, D1/D2: Claude đã xử lý A1–A6 trong 335717c/910b17a, giữ nguyên và không làm lại. Module policy nay dùng chung client/server; kiểm tra lại pinyin 30 bài mới không lệch sau các sửa của Claude.
- **P0.2 đã làm**: 48 JSON riêng trong lessons/listening/course, 198 dictation + 48 shadowing, đủ 246 id duy nhất. Không trộn vào bank chung, không sửa đè bài gốc. Loader theo tên khóa whitelist, gắn listeningPractice vào bài đóng gói. UI có nguồn “Nghe của bài”, giữ Bộ DeepSeek/Ví dụ buổi học; shadowing ưu tiên mục của bài và fallback bank khi thiếu. Đổi bài reset nguồn/lượt luyện.
- Giữ nguyên pinyin biên soạn và acceptTones/baseTones; checker dùng policy âm nhẹ hiện tại + utility đọc biến điệu từ bộ nguồn, giữ POLICY_TRAPS, kiểm cụm hơi/ý nghĩa/từ vựng bài. Không chép script _author/_make, không sinh lại pinyin lúc tải bài.
- D3/D4/D5: API fluency/âm lỗi đã thêm ở commit sửa thấp; checker đầy đủ + assert runtime 48/198/48/246, id/cụm/nguồn; test loader giữ nguyên listening/speaking/checkpoint khi merge. SSR kiểm nguồn nghe của bài/fallback, không thay thế thao tác micro thật.
- P2.1: giữ mô hình LAN PIN dùng chung hiện tại và ghi rõ endpoint giọng nói/quyền chung trong README. Không tự khóa micro điện thoại thành owner-only vì sẽ phá luồng LAN đang có; tách quyền tài khoản cần thiết kế riêng nếu chia sẻ ngoài nhóm tin cậy.
- P2.2/P2.3: hạ bộ nhớ phát lại còn 5 lượt, tổng 20 MB, có test ngân sách; object URL đã được xử lý ở C2.
- P3: A7–A9 và C1–C11 đã xử lý trong 2 commit sửa thấp 2cdecae/72edbf5. Không đánh dấu nhãn học liệu/giọng là đã duyệt.
- Chưa có nhãn người; HANDOFF xác nhận bộ cắt hiện có chỉ 55/56 audio và một mục cần thu lại. Không dùng số khớp expected làm độ chính xác, không chỉnh ngưỡng.

## Chốt kiểm tra đợt kế hoạch — 2026-10-25

- Mỗi commit đã chạy typecheck/test/build với dữ liệu tạm và XIAOYA_SAMPLE_AVATARS=1. Mốc sau HANDOFF: **109 test backend/lib + 6 test component qua**, dist allowlist qua.
- Smoke lần đầu bắt lỗi assertion cũ đòi dấu ? ở URL avatar; sửa để chấp nhận URL đúng có/không query. Lần chạy lại clone sạch: npm ci/build, status, đủ 5 tập, tải bài misu30 và nguồn nghe 48 buổi, số mẫu người, hai avatar mẫu và TTS tạo được audio đều qua. Không cần gọi model; không lưu audio TTS vào repo.
- UI thử trên hồ sơ mẫu/dữ liệu tạm: bộ chọn có ba tập misu30, Nghe của bài được chọn trong bài thực tế, vẫn có Bộ DeepSeek/Ví dụ; Cài đặt hiện 0 mục nhãn và 0 phản hồi của hồ sơ thử. Không dùng mic người thật.
- Chạy lại audit grammar sau các sửa: 0 câu đúng bị sửa trong 112 câu đúng; 34/102 câu sai sửa theo thước đo hiện tại. Artifact có hash/commit trong eval/results. Thước đo vẫn dùng expected dạng đoạn ở một phần bộ cũ, chưa thay thế đánh giá LLM/người dạy (review vòng 2 nêu T5).
- Chưa kiểm chứng: Windows/Linux thật, micro/thu-phát trên điện thoại, hành vi abort audio bằng thiết bị thật, giáo viên duyệt nội dung, schema sidecar nhãn thực tế và độ chính xác người học. Chưa có nhãn người, không tinh chỉnh classifyIsolated; không cam kết 0 false positive ngoài bộ thử.
- Không push/tag; không ghi data/ thật; không commit audio/giọng/ảnh người thật. Câu hỏi tồn đọng ở QUESTIONS.md. Người dùng vừa giao review-codex-2, sẽ xử lý tiếp trong các commit riêng sau mốc này.
