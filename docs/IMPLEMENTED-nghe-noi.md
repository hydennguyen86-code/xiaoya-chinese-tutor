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
