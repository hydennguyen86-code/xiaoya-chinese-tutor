import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';
import { completeJson } from './llm.mjs';
import { findLesson } from './syllabus.mjs';

// Practice material for one session of one lesson, written fresh by the local
// model from the lesson's title/topics and the learner's level, then cached so
// every learner on the same lesson sees the same material and reopening is
// instant. Nothing here is copied from the textbook.

const HAN = /\p{Script=Han}/u;

const LESSON_SCHEMA = {
  type: 'object',
  properties: {
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          meaning: { type: 'string' },
          example: { type: 'string' },
          exampleVi: { type: 'string' },
        },
        required: ['word', 'meaning', 'example', 'exampleVi'],
      },
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          explanation: { type: 'string' },
          example: { type: 'string' },
          exampleVi: { type: 'string' },
        },
        required: ['pattern', 'explanation', 'example', 'exampleVi'],
      },
    },
    roleplay: {
      type: 'object',
      properties: {
        setting: { type: 'string' },
        avatarRole: { type: 'string' },
        learnerRole: { type: 'string' },
        goals: { type: 'array', items: { type: 'string' } },
        opening: { type: 'string' },
        openingVi: { type: 'string' },
      },
      required: ['setting', 'avatarRole', 'learnerRole', 'goals', 'opening', 'openingVi'],
    },
    freeTalk: {
      type: 'object',
      properties: { question: { type: 'string' }, questionVi: { type: 'string' } },
      required: ['question', 'questionVi'],
    },
  },
  required: ['vocab', 'patterns', 'roleplay', 'freeTalk'],
};

const LEVEL_NOTE = {
  'HSK1-2': 'HSK1–2：只用最常用的词，例句 5–10 个字，句型最简单。',
  'HSK3-4': 'HSK3–4：日常常用词，例句 8–15 个字。',
  'HSK5-6': 'HSK5–6：自然地道的口语词和表达，例句 12–25 个字，可以有一点挑战。',
  free: '高级：像母语者一样自然的口语表达。',
};

function buildPrompt({ lesson, volume, level, day, dayOneWords }) {
  const given = lesson.vocab.length
    ? `必须包含这些词：${lesson.vocab.map((v) => v.word).join('、')}。`
    : '';
  const givenPatterns = lesson.patterns.length ? `必须包含这些句型：${lesson.patterns.join('；')}。` : '';
  const session =
    day === 1
      ? '这是本课第一次课：介绍新词和新句型。'
      : `这是本课第 ${day} 次课：复习和练习。${dayOneWords.length ? `词语以复习这些为主：${dayOneWords.join('、')}，可以再加 2–3 个相关的新词。` : ''}例句和角色扮演情境都要换成新的。`;
  return `你是给越南学生设计中文口语课的老师。为下面这一课写一节 20 分钟口语课的练习材料。

课程主题（来自教材目录，仅主题）：${volume.title}，第 ${lesson.no} 课「${lesson.title}」；话题：${lesson.topics.join('、') || lesson.title}。
学生水平：${LEVEL_NOTE[level] || LEVEL_NOTE['HSK5-6']}
${session}
${given}${givenPatterns}

版权要求：所有内容必须由你自己原创编写，不要引用、改写或回忆任何教材（包括《体验汉语口语》）里的对话、课文或练习。

内容要求：
- vocab：8–10 个和话题相关、口语常用的词。word 是简体中文词（不超过 6 个字）；meaning 是准确的越南语意思；example 是用这个词的口语例句（简体中文）；exampleVi 是例句的越南语翻译。
- patterns：2–3 个本课最有用的口语句型。pattern 用“……”表示空位；explanation 用越南语说明用法（1–2 句）；example 和 exampleVi 同上。
- roleplay：一个贴近生活、和话题相关的角色扮演。setting、avatarRole、learnerRole 用越南语；goals 是 2–3 个越南语短句，说明学生在对话中要完成的任务；opening 是老师（avatarRole）说的第一句简体中文，以一个问题结尾；openingVi 是越南语翻译。
- freeTalk：一个和话题相关、能让学生说 3–4 句的开放性问题（简体中文 question，越南语 questionVi）。

越南语字段只能写越南语（有声调），不能有汉字或英语。中文字段只能写简体中文。只输出 JSON。`;
}

const clean = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isVi = (text) => Boolean(text) && !HAN.test(text);
const isZh = (text) => Boolean(text) && HAN.test(text);
const PUNCT_TOKEN = /^[\s，。！？、；：,.!?;:“”"'‘’…（）()《》]+$/u;
const py = (text) =>
  pinyin(text, { toneType: 'symbol', type: 'array', nonZh: 'consecutive' })
    .filter((token) => !PUNCT_TOKEN.test(token))
    .join(' ');

export function normalizeLesson(raw, lesson) {
  const givenMeaning = new Map(lesson.vocab.filter((v) => v.meaning).map((v) => [v.word, v.meaning]));
  const seen = new Set();
  const vocab = (Array.isArray(raw?.vocab) ? raw.vocab : [])
    .map((item) => ({
      word: clean(item?.word, 12).replace(/[，。！？、\s]/g, ''),
      meaning: givenMeaning.get(clean(item?.word, 12)) || clean(item?.meaning, 80),
      example: clean(item?.example),
      exampleVi: clean(item?.exampleVi),
    }))
    .filter((item) => isZh(item.word) && item.word.length <= 8 && isVi(item.meaning) && isZh(item.example) && isVi(item.exampleVi))
    .filter((item) => (seen.has(item.word) ? false : seen.add(item.word)))
    .slice(0, 12)
    .map((item) => ({ ...item, pinyin: py(item.word), examplePinyin: py(item.example) }));
  const patterns = (Array.isArray(raw?.patterns) ? raw.patterns : [])
    .map((item) => ({
      pattern: clean(item?.pattern, 40),
      explanation: clean(item?.explanation, 300),
      example: clean(item?.example),
      exampleVi: clean(item?.exampleVi),
    }))
    .filter((item) => isZh(item.pattern) && item.explanation && isZh(item.example) && isVi(item.exampleVi))
    .slice(0, 3)
    .map((item) => ({ ...item, examplePinyin: py(item.example) }));
  const rp = raw?.roleplay || {};
  const roleplay = {
    setting: clean(rp.setting, 300),
    avatarRole: clean(rp.avatarRole, 80),
    learnerRole: clean(rp.learnerRole, 80),
    goals: (Array.isArray(rp.goals) ? rp.goals : []).map((g) => clean(g, 120)).filter(isVi).slice(0, 3),
    opening: clean(rp.opening),
    openingVi: clean(rp.openingVi),
  };
  const ft = raw?.freeTalk || {};
  const freeTalk = { question: clean(ft.question), questionVi: clean(ft.questionVi) };

  const problems = [];
  if (vocab.length < 4) problems.push('quá ít từ vựng hợp lệ');
  if (!patterns.length) problems.push('không có mẫu câu hợp lệ');
  if (!isZh(roleplay.opening) || !isVi(roleplay.setting) || !isVi(roleplay.avatarRole) || !isVi(roleplay.learnerRole)) {
    problems.push('kịch bản nhập vai thiếu hoặc sai ngôn ngữ');
  }
  if (!isZh(freeTalk.question)) problems.push('thiếu câu hỏi nói tự do');
  return { content: { vocab, patterns, roleplay, freeTalk }, problems };
}

function cacheFile(dataDir, volumeId, lessonNo, day) {
  const safe = `${volumeId}`.replace(/[^A-Za-z0-9_-]/g, '');
  return path.join(dataDir, 'lessons', `${safe}-${lessonNo}-d${day}.json`);
}

const inflight = new Map();

export async function getLessonContent({ dataDir, syllabus, volumeId, lessonNo, day, level, provider, model }) {
  const found = findLesson(syllabus, volumeId, lessonNo);
  if (!found) throw Object.assign(new Error('Không tìm thấy bài này trong mục lục.'), { status: 404 });
  const { volume, lesson } = found;
  if (!Number.isInteger(day) || day < 1 || day > lesson.days) {
    throw Object.assign(new Error('Buổi học không hợp lệ.'), { status: 400 });
  }
  const file = cacheFile(dataDir, volumeId, lessonNo, day);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  const key = file;
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    let dayOneWords = [];
    if (day > 1) {
      const first = cacheFile(dataDir, volumeId, lessonNo, 1);
      if (fs.existsSync(first)) dayOneWords = JSON.parse(fs.readFileSync(first, 'utf8')).vocab.map((v) => v.word);
    }
    const messages = [{ role: 'user', content: buildPrompt({ lesson, volume, level, day, dayOneWords }) }];
    let lastProblems = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await completeJson({
        provider,
        model,
        messages,
        schema: LESSON_SCHEMA,
        maxTokens: 1800,
        temperature: attempt ? 0.5 : 0.3,
        signal: AbortSignal.timeout(150000),
      });
      let raw;
      try {
        raw = JSON.parse(result.raw);
      } catch {
        lastProblems = ['model trả JSON hỏng'];
        continue;
      }
      const { content, problems } = normalizeLesson(raw, lesson);
      if (problems.length) {
        lastProblems = problems;
        continue;
      }
      const payload = {
        volumeId,
        volumeTitle: volume.title,
        lessonNo,
        lessonTitle: lesson.title,
        pages: lesson.pages,
        day,
        days: lesson.days,
        placeholder: Boolean(syllabus.placeholder),
        generatedAt: Date.now(),
        ...content,
      };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(payload, null, 1));
      fs.renameSync(`${file}.tmp`, file);
      return payload;
    }
    throw Object.assign(new Error(`Chưa soạn được bài (${lastProblems.join(', ')}). Thử lại nhé.`), { status: 502 });
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}
