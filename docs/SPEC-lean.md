# SPEC — Misu bản gọn (nhánh `lean`)

Nguồn sự thật cho mọi agent. Đọc hết trước khi sửa code. Repo: `/home/claude/xiaoya`, nhánh `lean`.
Node 22, React 19, Vite, TypeScript (`npx tsc --noEmit`). UI tiếng Việt có dấu. Không thêm dependency mới.

## 1. Mục tiêu sản phẩm

App đang rời rạc và nặng phát âm. Bản gọn tập trung: **học từ mới → nói chuyện với Coach → Coach sửa lỗi kỹ**.

Hai tầng (đã có sẵn `src/lib/tier.ts`):

| Tầng | Áp dụng | Nội dung |
|---|---|---|
| `foundation` | Vỡ lòng Pinyin, HSK 1–2 (volume có `levels` chứa `HSK1-2`, hoặc level `HSK1-2`) | Từ mới + phát âm mẫu; **giữ nguyên** công cụ phát âm nâng cao (chấm thanh từng chữ, cao độ, sửa phát âm, luyện tai, tập viết); Coach mức dễ |
| `coach` | HSK 3 trở lên | Thẻ từ: Hán Việt + nguồn gốc từ + câu mẫu; rồi nói chuyện với Coach; Coach phân tích lỗi đầy đủ. **Không** chấm thanh, không cao độ, không luyện tai, không tập viết |

```ts
// src/lib/tier.ts  [Opus — đã có]
export type Tier = 'foundation' | 'coach';
export function tierFor(level: Level, volume?: { levels?: readonly string[] } | null): Tier;
export function showsAdvancedPronunciation(tier: Tier): boolean; // true chỉ với foundation
```

Mô hình AI: Coach (trò chuyện) và bước kiểm câu chạy model cloud của người dùng (Claude Sonnet 5.5 qua
VietAPI, OpenAI-compatible) qua cơ chế `routeTask` có sẵn. Không đổi cách gọi provider.

## 2. Kiểu dữ liệu chung  [Opus — đã có trong `src/types.ts`]

```ts
interface CoachIssue { original: string; corrected: string; category: MistakeCategory; why: string }
interface CoachFeedback {
  verdict: 'ok' | 'fix' | 'polish';   // ok = đúng & tự nhiên; fix = có lỗi; polish = đúng nhưng chưa tự nhiên
  said: string;            // câu người học
  corrected: string;       // cả câu đã sửa ('' khi ok)
  correctedPinyin: string; // pinyin có dấu thanh của corrected (có thể '')
  issues: CoachIssue[];    // 0–3; foundation tối đa 2
  natural: string;         // cách người bản xứ hay nói ('' nếu không có)
  naturalVi: string;       // vì sao tự nhiên hơn
  pattern: string;         // khuôn câu, vd "去 + nơi + 做什么" ('' nếu không có)
  patternVi: string;       // cách dùng khuôn câu
  praise: string;          // khen ngắn cụ thể khi ok
}
interface WordNotes {
  word: string;
  parts: Array<{ char: string; meaning: string }>;  // nghĩa gốc từng chữ
  origin: string; memoryTip: string; usage: string;
  examples: Array<{ zh: string; pinyin: string; vi: string }>; // 2 câu
}
// ChatMessage có thêm: coach?: CoachFeedback | null; coachPending?: boolean   (chỉ trên tin nhắn role 'user')
```

API client  [Opus — đã có trong `src/lib/api.ts`]:
```ts
fetchCoach({ provider, model, text, level, context?, signal? }): Promise<{ corrections: Correction[]; coach: CoachFeedback | null }>
fetchWordNotes({ provider, model, word, pinyin, meaning, level }): Promise<WordNotes>
```
- `provider: 'rules'` (model '') = không model, chỉ bộ luật lỗi người Việt; khi đó `coach` có thể vẫn có (dựng từ luật) hoặc null.
- `corrections` giữ dạng cũ `{original, corrected, explanation, category}` để ghi vào hồ sơ học (`recordLearningCorrections`).
- `fetchWordNotes` ném lỗi khi không có model / model lỗi → UI chỉ ẩn phần ghi chú, không báo lỗi to.

Server  [Opus]: `POST /api/corrections` nhận thêm `level`, `context`; trả `{ corrections, coach }`.
`POST /api/word-notes` trả `WordNotes` (cache theo từ trong `data/word-notes.json`).

## 3. Thành phần và chủ sở hữu (một file một chủ)

| File | Chủ | Việc |
|---|---|---|
| `src/types.ts`, `src/lib/api.ts`, `src/lib/tier.ts`, `src/lib/tier.test.ts` | Opus | đã/ sẽ làm |
| `server/*.mjs` (prompt, coach, index, tests) | Opus | prompt Coach theo tầng, schema, route, cache ghi chú từ |
| `src/lib/modelRouting.ts`, `src/lib/storage.ts`, `src/components/ConnectivitySettings.tsx`, `src/components/SetupCheck.tsx` | Opus | mặc định chat + kiểm câu chạy cloud |
| `src/components/CoachCard.tsx` (mới) | Sonnet A | thẻ sửa lỗi dùng chung |
| `src/components/ChatPanel.tsx`, `src/App.tsx`, `src/styles.css` | Sonnet A | màn trò chuyện, top bar gọn |
| `src/components/DailyLesson.tsx`, `src/lib/lessonPlan.ts`, `src/lib/lessonPlan.test.ts`, `src/components/LearningDialog.tsx`, `src/components/WordNotesCard.tsx` (mới), `src/components/lessonLean.css` (mới) | Sonnet B | bài học theo tầng, thẻ từ HSK3+ |
| `README.md`, `CHANGELOG.md` | Haiku | tài liệu |

Không sửa file của người khác. Cần thứ gì ở file người khác → ghi vào báo cáo cuối, Opus xử lý.
CSS: Sonnet A viết vào `src/styles.css` (khối mới cuối file, có comment `/* ---- lean: coach ---- */`), Sonnet B viết vào
`src/components/lessonLean.css` và `import './lessonLean.css'` trong `DailyLesson.tsx`. Dùng biến CSS sẵn có trong `styles.css`
(đọc phần `:root`), hỗ trợ cả light và dark như phần còn lại của app.

## 4. CoachCard  [Sonnet A tạo, Sonnet B dùng lại]

```ts
// src/components/CoachCard.tsx
export interface CoachCardProps {
  feedback: CoachFeedback;
  tier: Tier;
  /** đọc một câu tiếng Trung bằng giọng mẫu */
  onSay: (text: string) => void;
  /** dùng bộ nhận giọng trên máy để người học nói lại câu đúng; false thì ẩn nút */
  localStt: boolean;
  learnerId?: string;
  compact?: boolean; // dùng trong bài học: bớt khoảng trắng
}
export function CoachCard(props: CoachCardProps): JSX.Element;
export function CoachPending(): JSX.Element; // "Coach đang xem câu của bạn…" (nhỏ, có hiệu ứng nhẹ)
```

Bố cục (nội dung tiếng Việt):
- `verdict === 'ok'`: một dòng xanh "✓ Câu đúng" + `praise` (nếu có). Nếu có `pattern` thì thêm dòng "Khuôn câu: …".
- `fix` / `polish`:
  1. **Bạn nói:** `said`, phần `issues[].original` được gạch/đánh dấu đỏ trong câu (tìm theo chuỗi con; không thấy thì thôi).
  2. **Vì sao:** mỗi issue một dòng: `original → corrected` + `why`. Nhãn category tiếng Việt: grammar=Ngữ pháp, word_choice=Dùng từ, word_order=Trật tự từ, measure_word=Lượng từ, other=Khác.
  3. **Nói đúng:** `corrected` (chữ Hán to, `correctedPinyin` nhỏ bên dưới) + nút 🔊 nghe.
  4. **Người Trung hay nói:** `natural` + `naturalVi` + nút 🔊 (chỉ khi `natural` khác rỗng và khác `corrected`).
  5. **Khuôn câu:** `pattern` — `patternVi` (khi có).
  6. Nút **🎤 Nói lại câu đúng** (khi `localStt`): ghi một lần bằng `listen()` trong `src/lib/voiceInput.ts` (xem cách `DailyLesson.tsx` dùng nó trong hàm `read`), so bằng `readingOk(target, heardText)` từ `src/lib/readingScore.mjs`; hiện "✓ Đúng rồi" hoặc "Máy nghe ra: …, thử lại". Đích nói lại = `natural` nếu tier coach và có natural, ngược lại `corrected`.
- `polish` dùng màu nhấn vàng/cam nhẹ thay vì đỏ, tiêu đề "Câu đúng, nói tự nhiên hơn thế này".
- Tier foundation: ẩn khối 4 và 5 nếu rỗng (server đã để rỗng), chữ to hơn một chút.
- Không dùng thư viện mới. Có `aria-label` cho nút.

## 5. Màn trò chuyện  [Sonnet A]

`src/App.tsx`:
1. **Top bar gọn**: bỏ nút "Kiểm tra" và "Bảng động lực" (gỡ luôn state/import/render của `Assessment`, `MotivationBoard` nếu không còn dùng; KHÔNG xoá file component). Thay nút "Bài hôm nay" bằng nhóm 2 nút dạng tab: **Học từ** (mở `DailyLesson`) | **Coach** (màn trò chuyện). Giữ: chip người học, chip model, chip trình độ, nút hồ sơ học (sách), loa, cài đặt.
2. **Tầng**: `const tier = tierFor(settings.level)` cho màn trò chuyện.
3. **Gửi câu**: ngay khi người học gửi (cùng lúc mở stream chat, không đợi trả lời xong), gọi `fetchCoach` với route `routeTask('corrections', …) ?? { provider: 'rules', model: '' }`, `level: settings.level`, `context`: nội dung tin nhắn assistant ngay trước câu này (nếu có). Gắn kết quả vào **tin nhắn user** (`coach`, `coachPending`). Đặt `coachPending: true` khi gửi. Khi có `corrections` → `recordLearningCorrections(...)` như code cũ (giữ điều kiện learningEpoch). Bỏ việc gọi `fetchCorrections` sau `onTurn` và không gắn corrections vào tin nhắn assistant nữa (`correctionsPending` của assistant luôn false). Huỷ request (AbortController) khi bấm "cuộc trò chuyện mới".
4. Truyền thêm cho `LearningDialog` prop `tier={tier}` (Sonnet B thêm prop này, optional).
5. Truyền cho `DailyLesson` hai prop mới (Sonnet B khai báo):
   - `chatRoute={routes.chat ? { provider: routes.chat.provider, model: routes.chat.model } : null}`
   - `checkRoute={routes.corrections ? {...} : { provider: 'rules', model: '' }}`
   (xem cách `routes` đang được tính trong App; nếu chưa có `routes.corrections` thì thêm vào cùng chỗ.)
6. `ChatPanel` nhận thêm `tier` và `onSay(text)` (App: `avatarRef.current?.speakAll(text, settings.voice, 'neutral', 'none')` hoặc cách phát TTS đang dùng ở `handleReplay`), `localStt={Boolean(status?.localStt)}`.

`src/components/ChatPanel.tsx`:
- Dưới mỗi tin nhắn user: `coachPending` → `<CoachPending/>`; có `coach` → `<CoachCard …/>`.
- `SpokenPronunciation` (chấm thanh câu nói trong chat) chỉ hiện khi `showsAdvancedPronunciation(tier)`.
- Khối corrections cũ trong tin nhắn assistant: bỏ (đã chuyển sang CoachCard). Giữ vocab, gợi ý trả lời, dịch.
- Đổi chữ hiển thị "gia sư" → "Coach" ở màn này nếu có.

## 6. Bài học theo tầng  [Sonnet B]

`src/lib/lessonPlan.ts`:
- Giữ `SECTIONS` (foundation) nhưng đổi title `freetalk` thành "Nói với Coach".
- Thêm `COACH_SECTIONS` = review "Khởi động ôn tập" (3') → vocab "Từ mới" (6') → coach "Nói với Coach" (10') → summary "Tổng kết" (1').
- `export function sectionsFor(tier: Tier)`; `SectionId` mở rộng thêm `'coach'`. `sessionMsFor(tier)`. Giữ export cũ để không vỡ chỗ khác. Phiên đã lưu có `section` vượt số bước → kẹp về bước cuối hợp lệ. Cập nhật `lessonPlan.test.ts`.

`src/components/DailyLesson.tsx`:
- Props mới: `chatRoute: { provider: string; model: string } | null; checkRoute: { provider: string; model: string }`.
  Trò chuyện trong bài dùng `chatRoute ?? { provider, model }`; kiểm câu dùng `checkRoute` qua `fetchCoach` (thay mọi `fetchCorrections`).
- `tier = tierFor(level, volume đang học)`; bước lấy từ `sectionsFor(tier)`.
- Tier foundation: giữ hành vi hiện tại (ToneFeedback, HanziWriterCard, PronunciationReview, CoursePractice, ListenFirst…), chỉ thay chỗ hiện lỗi bằng `CoachCard compact`.
- Tier coach:
  - Bước **Từ mới**: chữ + pinyin + nghĩa; `<HanViet word=…/>` như hiện tại; `<WordNotesCard>` (nguồn gốc, nghĩa từng chữ, mẹo nhớ, cách dùng, 2 câu mẫu thêm); câu mẫu của bài (có nút nghe). Nút "Đọc theo" vẫn có nhưng chỉ báo khớp chữ (VocabReadFeedback), **không** ToneFeedback, không HanziWriterCard.
  - Bước **Nói với Coach** (`coach`): dùng lại DialogSection với kịch bản = roleplay scenario + câu hỏi freeTalk của bài, mở đầu bằng `roleplay.opening`. Không CoursePractice, không ẩn chữ kiểu "nghe trước". Phía trên có khối thu gọn "Từ & khuôn câu của bài" (vocab + patterns, bấm để mở) để người học nhìn khi nói. Mỗi câu người học có `CoachCard compact` (pending → `CoachPending`). Gợi ý: mục tiêu ~8 lượt nói, đếm lượt; nút "Xong, tổng kết".
  - Không `PronunciationReview` ở bước ôn.
- Tổng kết: liệt kê các câu đã sửa (corrected) như cũ.

`src/components/WordNotesCard.tsx`:
```ts
export function WordNotesCard(props: { word: string; pinyin: string; meaning: string; level: Level;
  route: { provider: string; model: string } | null; onSay: (text: string) => void }): JSX.Element | null;
```
- `route` null → không render. Đang tải → khung xám mờ 3 dòng. Lỗi → không render gì.
- Nhớ kết quả trong `Map` module-level theo `word` để lật qua lại không gọi lại.
- Nhãn nhỏ "AI soạn · chưa duyệt".

`src/components/LearningDialog.tsx`: thêm prop optional `tier?: Tier` (mặc định 'foundation'). Tier coach: ẩn BenchmarkTest/bài kiểm tra mốc và mọi mục phát âm / thanh điệu / luyện tai / cao độ trong các tab; giữ ôn từ, lỗi hay mắc, phân tích.

## 7. Tiêu chí xong (mỗi agent)

- `npx tsc --noEmit` không lỗi ở file mình sở hữu (lỗi ở file người khác đang làm dở: ghi chú, không sửa).
- `node --test server/*.test.mjs src/lib/*.test.ts` và `npx tsx --tsconfig tsconfig.test.json --test src/components/*.test.tsx` xanh (trừ lỗi do file người khác).
- UI: KHÔNG chạy `npm run build` (thư mục dist dùng chung). Chạy riêng cổng của mình:
  `PORT=<api> XIAOYA_DATA_DIR=/tmp/<tên-agent>/data node server/index.mjs` và `API_PORT=<api> VITE_PORT=<web> npx vite --strictPort`
  (Sonnet A: api 8801 / web 5181; Sonnet B: api 8802 / web 5182). Backend có thể khởi động lại khi Opus sửa server. Chụp màn bằng Python Playwright + `/usr/bin/google-chrome`
  (`p.chromium.launch(executable_path='/usr/bin/google-chrome')`) ở 390×844 và 1280×800, light + dark (`color_scheme`). Không có model nên
  có thể mock `/api/corrections`, `/api/word-notes`, `/api/chat` bằng `page.route(...)` để thấy CoachCard / WordNotesCard. Tự xem ảnh và sửa.
  Script và ảnh để trong `/tmp/<tên-agent>/`, không để trong repo.
- Báo cáo cuối ≤ 15 dòng: file đã sửa, kết quả test, chỗ lệch SPEC, việc cần Opus làm.
- Không commit git (Opus commit).
