// The Coach: feedback on one learner sentence (why it is wrong, the corrected
// sentence, how a native speaker would say it, a reusable sentence frame) and
// AI notes for vocabulary cards (character meanings, origin, examples).
//
// The model writes the content; everything here keeps it honest: fragments must
// come from the learner's sentence, style-only edits are not called mistakes,
// pinyin is computed locally, and the built-in rules for common Vietnamese-learner
// mistakes always apply, even when no model is available.
import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';
import { completeJson } from './llm.mjs';
import { parseJsonObject } from './jsonStream.mjs';
import { isStyleOnlyEdit } from './correctionFilter.mjs';
import { mergeCorrections, ruleCorrections } from './grammarRules.mjs';

const HAN = /[㐀-鿿]/;
const HAN_ALL = /[㐀-鿿]/g;
const LATIN = /[a-zà-ỹđ]/i;
const CATEGORIES = new Set(['grammar', 'word_choice', 'word_order', 'measure_word', 'other']);
const PUNCT = /[\s，。！？、；：,.!?;:“”"'‘’…（）()《》]/gu;

/** 'foundation' (Vỡ lòng, HSK 1–2) or 'coach' (HSK 3+); mirrors src/lib/tier.ts for levels. */
export function tierOfLevel(level) {
  return level === 'HSK1-2' ? 'foundation' : 'coach';
}

const LEVEL_NOTE = {
  'HSK1-2': 'HSK 1–2 (mới bắt đầu)',
  'HSK3-4': 'HSK 3–4 (trung cấp)',
  'HSK5-6': 'HSK 5–6 (khá)',
  free: 'giao tiếp tự do (khá trở lên)',
};

const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    original: { type: 'string' },
    corrected: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    why: { type: 'string' },
  },
  required: ['original', 'corrected', 'category', 'why'],
};

export const COACH_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'fix', 'polish'] },
    corrected: { type: 'string' },
    issues: { type: 'array', items: ISSUE_SCHEMA },
    natural: { type: 'string' },
    naturalVi: { type: 'string' },
    pattern: { type: 'string' },
    patternVi: { type: 'string' },
    praise: { type: 'string' },
  },
  required: ['verdict', 'corrected', 'issues', 'natural', 'naturalVi', 'pattern', 'patternVi', 'praise'],
};

const FIELD_ORDER = `{"verdict":"","corrected":"","issues":[{"original":"","corrected":"","category":"","why":""}],"natural":"","naturalVi":"","pattern":"","patternVi":"","praise":""}`;

export function buildCoachPrompt(level = 'HSK3-4') {
  const foundation = tierOfLevel(level) === 'foundation';
  return `Bạn là Coach dạy nói tiếng Trung cho người Việt. Người học trình độ ${LEVEL_NOTE[level] || LEVEL_NOTE['HSK3-4']}. Bạn nhận MỘT câu người học vừa nói (thường do máy nhận giọng chép lại) và câu Coach nói ngay trước đó (nếu có). Nhiệm vụ: chấm câu đó, giải thích lỗi để người học hiểu VÌ SAO sai và biết cách đặt câu đúng lần sau.

Cách phán:
- "fix": có lỗi thật về ngữ pháp, dùng từ, trật tự từ, lượng từ, hoặc câu không diễn đạt được ý người học muốn nói.
- "polish": câu không sai ngữ pháp nhưng người Trung không nói như vậy (dịch từng chữ từ tiếng Việt, ghép từ gượng, thiếu từ mà người bản xứ luôn dùng).${foundation ? ' Với trình độ HSK 1–2 chỉ dùng "polish" khi chỗ chưa tự nhiên rất rõ và cách nói đúng vẫn đơn giản.' : ''}
- "ok": câu đúng và tự nhiên.
- KHÔNG tính là lỗi: dấu câu, câu tỉnh lược bình thường khi nói, trợ từ ngữ khí, cách nói khác nhưng đều đúng (很/非常, 说/讲), và chữ đồng âm mà rõ ràng do máy chép nhầm (cùng âm cùng thanh với từ người học muốn nói).
- Không nâng câu lên văn viết, không đổi ý người học. Nếu không đoán chắc người học muốn nói gì, chỉ sửa phần chắc chắn.

Trường JSON:
- corrected: cả câu đã sửa (giữ ý và giữ càng nhiều chữ của người học càng tốt). Để "" khi verdict là "ok" hoặc "polish".
- issues: ${foundation ? 'tối đa 2' : 'tối đa 3'} lỗi quan trọng nhất, xếp theo thứ tự trong câu. Rỗng khi "ok" hoặc "polish".
  - original: đoạn sai NGẮN NHẤT, chép nguyên văn từng chữ từ câu người học.
  - corrected: đoạn đó sau khi sửa.
  - category: "grammar" | "word_choice" | "word_order" | "measure_word" | "other".
  - why: tiếng Việt có dấu, ${foundation ? '1 câu ngắn, từ ngữ dễ hiểu, không thuật ngữ khó' : '1–2 câu'}: gọi tên điểm ngữ pháp (vd: vị trí của 在 + nơi chốn, 了 sau động từ, bổ ngữ kết quả, 把, lượng từ…) và nói vì sao sai. Khi lỗi do mang trật tự tiếng Việt sang, nói rõ tiếng Việt nói thế nào và tiếng Trung khác ra sao. Được trích chữ Hán làm ví dụ.
- natural: ${foundation ? 'thường để "". Chỉ điền khi verdict là "polish" hoặc người Trung có cách nói NGẮN, rất thông dụng ở trình độ HSK 1–2.' : 'cách người Trung hay nói câu này trong hội thoại thường ngày, cùng ý, trình độ ngang hoặc cao hơn người học một chút. Để "" nếu giống corrected (hoặc giống câu gốc khi "ok").'}
- naturalVi: vì sao cách nói đó tự nhiên hơn, tiếng Việt, tối đa 25 từ. "" nếu natural rỗng.
- pattern: khuôn câu người học nên mang theo để tự đặt câu khác, viết bằng chữ Hán và chỗ trống, vd "去 + nơi + 做什么" hoặc "A 比 B + tính từ". Chỉ điền khi có một khuôn thật sự hữu ích từ câu này; không thì "".
- patternVi: khi nào dùng khuôn câu đó, tiếng Việt, tối đa 20 từ. "" nếu pattern rỗng.
- praise: khi "ok", một lời khen CỤ THỂ bằng tiếng Việt (chỉ ra điểm làm tốt, vd "Dùng 了 sau 买 rất đúng chỗ"), tối đa 15 từ. Các trường hợp khác để "".

Ví dụ (câu Coach trước: 你昨天做什么了？):
Người học: 我昨天去了超市买东西了
{"verdict":"fix","corrected":"我昨天去超市买了东西","issues":[{"original":"去了超市买东西了","corrected":"去超市买了东西","category":"grammar","why":"Trong chuỗi 去 + nơi + làm gì, 了 đặt sau động từ chính 买, không gắn sau 去 và không lặp 2 lần."}],"natural":"我昨天去超市买了点儿东西","naturalVi":"Người Trung hay thêm 点儿 cho câu nhẹ, tự nhiên như “mua ít đồ”.","pattern":"去 + nơi + 动词 + 了 + tân ngữ","patternVi":"Kể đã đi đâu làm gì; 了 theo động từ chính.","praise":""}

Chỉ trả về MỘT đối tượng JSON, đúng thứ tự trường sau, không markdown, không giải thích ngoài JSON:
${FIELD_ORDER}`;
}

export function buildCoachMessages(level, text, context = '') {
  const prior = String(context ?? '').replace(/\u0000/g, '').trim().slice(0, 400);
  const user = `${prior ? `Câu Coach nói trước: ${prior}\n` : ''}Người học: ${String(text).trim()}`;
  return [
    { role: 'system', content: buildCoachPrompt(level) },
    { role: 'user', content: user },
  ];
}

function clean(value, max = 300) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function bare(text) {
  return String(text ?? '').replace(PUNCT, '');
}

/** Vietnamese explanation: must contain Latin letters, not be only Chinese. */
function vietnamese(text, max) {
  const value = clean(text, max);
  return value && LATIN.test(value) ? value : '';
}

export function pinyinOf(text) {
  if (!text || !HAN.test(text)) return '';
  return pinyin(text, { toneType: 'symbol', type: 'array', nonZh: 'consecutive' })
    .join(' ')
    .replace(/\s+([，。！？、,.!?])/g, '$1')
    .trim();
}

/** Applies fragment fixes left to right; skips any fragment that is no longer present. */
export function applyIssues(sentence, issues) {
  let out = sentence;
  for (const item of issues) {
    const at = out.indexOf(item.original);
    if (at >= 0) out = out.slice(0, at) + item.corrected + out.slice(at + item.original.length);
  }
  return out;
}

function toCorrection(issue) {
  return { original: issue.original, corrected: issue.corrected, explanation: issue.why, category: issue.category };
}

/**
 * Turns the model's JSON (or nothing) plus the rule hits into a CoachFeedback.
 * Returns null when there is nothing trustworthy to show.
 */
export function sanitizeCoach(data, said, { level = 'HSK3-4', ruleHits = [] } = {}) {
  const foundation = tierOfLevel(level) === 'foundation';
  const limit = foundation ? 2 : 3;
  const raw = data && typeof data === 'object' ? data : null;

  const modelIssues = (Array.isArray(raw?.issues) ? raw.issues : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      original: clean(item.original, 80),
      corrected: clean(item.corrected, 120),
      category: CATEGORIES.has(item.category) ? item.category : 'other',
      why: vietnamese(item.why, foundation ? 200 : 320),
    }))
    .filter((item) => item.original && item.corrected && item.why)
    .filter((item) => bare(item.original) !== bare(item.corrected))
    .filter((item) => said.includes(item.original))
    .filter((item) => !isStyleOnlyEdit(item.original, item.corrected, said));

  const merged = mergeCorrections(
    ruleHits,
    modelIssues.map((item) => ({ ...toCorrection(item) })),
    limit,
    said,
  );
  const issues = merged.map((item) => ({
    original: item.original,
    corrected: item.corrected,
    category: CATEGORIES.has(item.category) ? item.category : 'other',
    why: item.explanation,
  }));

  let corrected = '';
  if (issues.length) {
    const modelSentence = clean(raw?.corrected, 200);
    const applied = applyIssues(said, issues);
    // the model's whole sentence is used only when it contains every fix
    corrected =
      modelSentence && HAN.test(modelSentence) && bare(modelSentence) !== bare(said) && issues.every((i) => modelSentence.includes(i.corrected))
        ? modelSentence
        : applied;
    if (bare(corrected) === bare(said)) corrected = '';
  }

  let natural = clean(raw?.natural, 200);
  if (!HAN.test(natural) || bare(natural) === bare(corrected || said)) natural = '';
  if (foundation && (natural.match(HAN_ALL) || []).length > 14) natural = '';
  const naturalVi = natural ? vietnamese(raw?.naturalVi, 200) : '';

  let pattern = clean(raw?.pattern, 60);
  if (!HAN.test(pattern)) pattern = '';
  const patternVi = pattern ? vietnamese(raw?.patternVi, 160) : '';

  // the model saw a mistake but its fragments did not survive the checks (misquoted or
  // style-only): offer its sentence as the more natural way instead of calling it wrong
  if (!issues.length && !natural && raw?.verdict === 'fix') {
    const sentence = clean(raw.corrected, 200);
    if (HAN.test(sentence) && bare(sentence) !== bare(said) && !isStyleOnlyEdit(said, sentence, said)) {
      natural = sentence;
      const firstWhy = Array.isArray(raw.issues) ? raw.issues.map((i) => vietnamese(i?.why, 200)).find(Boolean) : '';
      return {
        verdict: 'polish',
        said,
        corrected: '',
        correctedPinyin: '',
        issues: [],
        natural,
        naturalVi: firstWhy || '',
        pattern,
        patternVi,
        praise: '',
      };
    }
  }

  let verdict;
  if (issues.length && corrected) verdict = 'fix';
  else if (natural) verdict = 'polish';
  else if (raw?.verdict === 'ok' && !issues.length) verdict = 'ok';
  else return null; // no model answer and no rule hit: say nothing rather than "correct"

  return {
    verdict,
    said,
    corrected: verdict === 'fix' ? corrected : '',
    correctedPinyin: verdict === 'fix' ? pinyinOf(corrected) : '',
    issues: verdict === 'fix' ? issues : [],
    natural,
    naturalVi,
    pattern,
    patternVi,
    praise: verdict === 'ok' ? vietnamese(raw?.praise, 120) : '',
  };
}

/**
 * Feedback for one learner sentence. provider 'rules' = no model, only the built-in rules.
 * Never throws for a model failure when the rules found something.
 */
export async function coachFeedback({ provider, model, level = 'HSK3-4', text, context = '', signal }) {
  const said = clean(text, 400);
  if (!said || !HAN.test(said)) return { corrections: [], coach: null };
  const ruleHits = ruleCorrections(said);

  let data = null;
  if (provider !== 'rules') {
    try {
      const timeout = AbortSignal.timeout(provider === 'compatible' ? 45000 : 20000);
      const result = await completeJson({
        provider,
        model,
        messages: buildCoachMessages(level, said, context),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        schema: COACH_SCHEMA,
        maxTokens: 700,
        temperature: 0.2,
      });
      data = parseJsonObject(result.raw);
    } catch (error) {
      if (!ruleHits.length) throw error;
    }
  }

  const coach = sanitizeCoach(data, said, { level, ruleHits });
  const corrections = coach?.issues.map(toCorrection) ?? [];
  return { corrections, coach };
}

// ---- Word notes (HSK 3+ vocabulary cards) -------------------------------------------------

export const WORD_NOTES_SCHEMA = {
  type: 'object',
  properties: {
    parts: {
      type: 'array',
      items: { type: 'object', properties: { char: { type: 'string' }, meaning: { type: 'string' } }, required: ['char', 'meaning'] },
    },
    origin: { type: 'string' },
    memoryTip: { type: 'string' },
    usage: { type: 'string' },
    examples: {
      type: 'array',
      items: { type: 'object', properties: { zh: { type: 'string' }, vi: { type: 'string' } }, required: ['zh', 'vi'] },
    },
  },
  required: ['parts', 'origin', 'memoryTip', 'usage', 'examples'],
};

export function buildWordNotesMessages({ word, pinyin: py, meaning, level, example = '' }) {
  const system = `Bạn soạn thẻ từ tiếng Trung cho người Việt trình độ ${LEVEL_NOTE[level] || LEVEL_NOTE['HSK3-4']}. Người Việt đã biết âm Hán Việt (ứng dụng tự hiển thị âm Hán Việt, bạn không cần ghi lại).

Trả về JSON:
- parts: mỗi chữ Hán trong từ một mục {char, meaning}; meaning = nghĩa gốc của riêng chữ đó bằng tiếng Việt, ngắn (vd 电 → "điện", 脑 → "não, đầu óc").
- origin: 1–3 câu tiếng Việt: từ này được ghép/cấu tạo thế nào để ra nghĩa hiện nay. Chỉ nêu nguồn gốc lịch sử hay xuất xứ khi chắc chắn; KHÔNG bịa giai thoại, điển tích hay năm tháng. Không chắc thì chỉ giải thích cách ghép nghĩa.
- memoryTip: mẹo nhớ ngắn cho người Việt, tối đa 25 từ (có thể dựa vào âm Hán Việt hoặc hình chữ).
- usage: tiếng Việt, tối đa 35 từ: từ này hay đi với từ nào, dùng trong văn nói hay văn viết, và bẫy nếu nghĩa khác với từ Hán Việt tiếng Việt.
- examples: đúng 2 câu ví dụ {zh, vi} dùng từ này trong hội thoại đời thường, ngắn, đúng trình độ người học, khác câu ví dụ có sẵn; vi là bản dịch tiếng Việt tự nhiên.
Mọi phần giải thích bằng tiếng Việt có dấu. Chỉ trả về một đối tượng JSON, không markdown.`;
  const user = `Từ: ${word}\nPinyin: ${py}\nNghĩa: ${meaning}${example ? `\nCâu ví dụ có sẵn: ${example}` : ''}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function sanitizeWordNotes(data, word) {
  if (!data || typeof data !== 'object') return null;
  const chars = [...word].filter((c) => HAN.test(c));
  const parts = (Array.isArray(data.parts) ? data.parts : [])
    .filter((p) => p && chars.includes(clean(p.char, 2)))
    .map((p) => ({ char: clean(p.char, 2), meaning: vietnamese(p.meaning, 60) }))
    .filter((p) => p.meaning)
    .slice(0, chars.length);
  const examples = (Array.isArray(data.examples) ? data.examples : [])
    .map((e) => ({ zh: clean(e?.zh, 80), vi: vietnamese(e?.vi, 160) }))
    .filter((e) => e.zh.includes(word) && e.vi && !LATIN.test(e.zh))
    .slice(0, 2)
    .map((e) => ({ zh: e.zh, pinyin: pinyinOf(e.zh), vi: e.vi }));
  const notes = {
    word,
    parts,
    origin: vietnamese(data.origin, 400),
    memoryTip: vietnamese(data.memoryTip, 200),
    usage: vietnamese(data.usage, 280),
    examples,
  };
  return notes.origin || notes.parts.length || notes.examples.length ? notes : null;
}

/** Notes for one word, cached in <dataDir>/word-notes.json so each word costs one call. */
export function createWordNotes(dataDir) {
  const file = path.join(dataDir, 'word-notes.json');
  let cache = null;
  const load = () => {
    if (cache) return cache;
    try {
      cache = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
      cache = {};
    }
    return cache;
  };
  const save = () => {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(cache));
    fs.renameSync(`${file}.tmp`, file);
  };
  return async function wordNotes({ provider, model, word, pinyin: py = '', meaning = '', level = 'HSK3-4', example = '', signal }) {
    const key = clean(word, 12);
    if (!key || !HAN.test(key) || LATIN.test(key)) throw Object.assign(new Error('Từ không hợp lệ.'), { status: 400 });
    const hit = load()[key];
    if (hit) return hit;
    const timeout = AbortSignal.timeout(provider === 'compatible' ? 60000 : 30000);
    const result = await completeJson({
      provider,
      model,
      messages: buildWordNotesMessages({ word: key, pinyin: clean(py, 60), meaning: clean(meaning, 160), level, example: clean(example, 120) }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      schema: WORD_NOTES_SCHEMA,
      maxTokens: 900,
      temperature: 0.3,
    });
    const notes = sanitizeWordNotes(parseJsonObject(result.raw), key);
    if (!notes) throw Object.assign(new Error('Model trả ghi chú chưa đúng cấu trúc.'), { status: 502 });
    load()[key] = notes;
    try {
      save();
    } catch (error) {
      console.error('[word-notes] không lưu được cache:', error.message);
    }
    return notes;
  };
}
